/**
 * Scene store — versioned multi-scene persistence on top of localStorage
 * (spec §7 存储). Pure logic, DOM-free: every function takes a StorageLike
 * so the whole module is unit-testable under jsdom with an in-memory stub.
 *
 * Failure contract (never throws, never destroys current state):
 * - unavailable storage (getItem/setItem throws)  → "storage-unavailable" /
 *   "storage-write-failed"
 * - corrupted JSON / wrong envelope shape         → "storage-corrupted"
 * - unknown storageVersion                        → "unsupported-storage-version"
 *   (storeMigrations is the reserved migration hook)
 * - individually invalid scene entries are SKIPPED (counted in
 *   droppedEntries) instead of poisoning the whole store.
 */

import { parseVectorGeometryScene } from "@/features/vector-geometry-lab/schema";
import type { VectorGeometrySceneV1 } from "@/features/vector-geometry-lab/schema";

/** The exact key required by spec §7. */
export const SCENE_STORE_KEY = "exambridge:vector-geometry-lab:v1:scenes";
export const SCENE_STORE_VERSION = 1;

export interface StoredSceneEntry {
  readonly id: string;
  readonly name: string;
  /** Which of the 16 built-in analyzers produces this scene's explanation. */
  readonly exampleId: string;
  /** ISO timestamp; injectable for deterministic tests. */
  readonly savedAt: string;
  readonly scene: VectorGeometrySceneV1;
}

export interface SceneStoreEnvelope {
  readonly storageVersion: typeof SCENE_STORE_VERSION;
  readonly scenes: readonly StoredSceneEntry[];
}

export const STORE_ERROR_CODES = [
  "storage-unavailable",
  "storage-corrupted",
  "unsupported-storage-version",
  "storage-write-failed",
  "scene-not-found",
] as const;
export type StoreErrorCode = (typeof STORE_ERROR_CODES)[number];

export interface StoreError {
  readonly code: StoreErrorCode;
  readonly message: string;
  readonly cause?: string;
}

export type StoreResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: StoreError };

/** The DOM Storage subset this module needs (jsdom localStorage satisfies it). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadOutcome {
  readonly envelope: SceneStoreEnvelope;
  /** Entries skipped because their scene payload failed schema validation. */
  readonly droppedEntries: number;
}

function storeFailure<T>(
  code: StoreErrorCode,
  message: string,
  cause?: string,
): StoreResult<T> {
  return {
    ok: false,
    error: { code, message, ...(cause !== undefined ? { cause } : {}) },
  };
}

function storeSuccess<T>(value: T): StoreResult<T> {
  return { ok: true, value };
}

export function emptyEnvelope(): SceneStoreEnvelope {
  return { storageVersion: SCENE_STORE_VERSION, scenes: [] };
}

/**
 * Reserved migration hook, keyed by the SOURCE storageVersion found in the
 * persisted envelope. A migration upgrades the decoded JSON one step closer
 * to the current envelope shape; the migrated value is validated again.
 * (Not frozen on purpose: future versions register here; tests may register
 * a temporary migration and remove it afterwards.)
 */
export const storeMigrations: Record<string, (input: unknown) => unknown> = {};

/* --------------------------------------------------------------------------
 * Envelope validation
 * ------------------------------------------------------------------------ */

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function validateEntry(input: unknown): StoredSceneEntry | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const { id, name, exampleId, savedAt, scene } = input;
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    typeof name !== "string" ||
    name.length === 0 ||
    typeof exampleId !== "string" ||
    exampleId.length === 0 ||
    typeof savedAt !== "string" ||
    savedAt.length === 0
  ) {
    return undefined;
  }
  const parsed = parseVectorGeometryScene(scene);
  if (!parsed.ok) {
    return undefined;
  }
  return { id, name, exampleId, savedAt, scene: parsed.value };
}

function validateEnvelope(input: unknown): StoreResult<LoadOutcome> {
  if (!isRecord(input) || !Array.isArray(input["scenes"])) {
    return storeFailure(
      "storage-corrupted",
      "Stored data is not a scene-store envelope ({ storageVersion, scenes: [...] }).",
    );
  }
  const version = input["storageVersion"];
  if (version !== SCENE_STORE_VERSION) {
    return storeFailure(
      "unsupported-storage-version",
      `Unsupported storageVersion "${String(version)}". This build supports: ${String(SCENE_STORE_VERSION)}.`,
    );
  }
  const rawScenes = input["scenes"] as readonly unknown[];
  const scenes: StoredSceneEntry[] = [];
  let droppedEntries = 0;
  for (const raw of rawScenes) {
    const entry = validateEntry(raw);
    if (entry === undefined) {
      droppedEntries += 1;
    } else {
      scenes.push(entry);
    }
  }
  return storeSuccess({
    envelope: { storageVersion: SCENE_STORE_VERSION, scenes },
    droppedEntries,
  });
}

/* --------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------ */

/**
 * Reads + validates the store. A missing key yields an empty envelope.
 * Corrupted data yields a structured error and is left untouched on disk —
 * the caller keeps its current in-memory state.
 */
export function loadStore(storage: StorageLike): StoreResult<LoadOutcome> {
  let raw: string | null;
  try {
    raw = storage.getItem(SCENE_STORE_KEY);
  } catch (error) {
    return storeFailure(
      "storage-unavailable",
      "localStorage is not readable (disabled or blocked).",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (raw === null || raw.trim() === "") {
    return storeSuccess({ envelope: emptyEnvelope(), droppedEntries: 0 });
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch (error) {
    return storeFailure(
      "storage-corrupted",
      "Stored scenes are not valid JSON. The saved data was left untouched.",
      error instanceof Error ? error.message : String(error),
    );
  }
  // Migration hook: unknown versions get one chance through a registered
  // step migration before the structured refusal.
  if (isRecord(decoded) && decoded["storageVersion"] !== SCENE_STORE_VERSION) {
    const migrate = storeMigrations[String(decoded["storageVersion"])];
    if (migrate !== undefined) {
      return validateEnvelope(migrate(decoded));
    }
  }
  return validateEnvelope(decoded);
}

function writeEnvelope(
  storage: StorageLike,
  envelope: SceneStoreEnvelope,
): StoreResult<SceneStoreEnvelope> {
  try {
    storage.setItem(SCENE_STORE_KEY, JSON.stringify(envelope));
    return storeSuccess(envelope);
  } catch (error) {
    return storeFailure(
      "storage-write-failed",
      "Could not write to localStorage (quota exceeded or storage blocked). Nothing was saved.",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export interface SaveSceneInput {
  readonly name: string;
  readonly exampleId: string;
  readonly scene: VectorGeometrySceneV1;
  /** Upsert: replace the entry with this id when present. */
  readonly id?: string;
  /** Injectable timestamp (tests). */
  readonly savedAt?: string;
}

let entryCounter = 0;

function nextEntryId(): string {
  entryCounter += 1;
  return `scene-${Date.now().toString(36)}-${entryCounter.toString(36)}`;
}

/** Saves (or overwrites, when `id` matches) a named scene. */
export function saveScene(
  storage: StorageLike,
  input: SaveSceneInput,
): StoreResult<SceneStoreEnvelope> {
  const loaded = loadStore(storage);
  if (!loaded.ok) {
    return storeFailure(loaded.error.code, loaded.error.message, loaded.error.cause);
  }
  const name = input.name.trim();
  if (name === "") {
    return storeFailure(
      "storage-corrupted",
      "A scene name must not be empty.",
    );
  }
  const entry: StoredSceneEntry = {
    id: input.id ?? nextEntryId(),
    name,
    exampleId: input.exampleId,
    savedAt: input.savedAt ?? new Date().toISOString(),
    scene: input.scene,
  };
  const scenes = loaded.value.envelope.scenes.filter(
    (existing) => existing.id !== entry.id,
  );
  return writeEnvelope(storage, {
    storageVersion: SCENE_STORE_VERSION,
    scenes: [...scenes, entry],
  });
}

/** Renames an existing entry. Unknown ids → "scene-not-found". */
export function renameScene(
  storage: StorageLike,
  id: string,
  name: string,
): StoreResult<SceneStoreEnvelope> {
  const loaded = loadStore(storage);
  if (!loaded.ok) {
    return storeFailure(loaded.error.code, loaded.error.message, loaded.error.cause);
  }
  const trimmed = name.trim();
  if (trimmed === "") {
    return storeFailure("storage-corrupted", "A scene name must not be empty.");
  }
  const target = loaded.value.envelope.scenes.find((entry) => entry.id === id);
  if (target === undefined) {
    return storeFailure("scene-not-found", `No saved scene with id "${id}".`);
  }
  const scenes = loaded.value.envelope.scenes.map((entry) =>
    entry.id === id ? { ...entry, name: trimmed } : entry,
  );
  return writeEnvelope(storage, {
    storageVersion: SCENE_STORE_VERSION,
    scenes,
  });
}

/** Deletes an entry. Unknown ids → "scene-not-found". */
export function deleteScene(
  storage: StorageLike,
  id: string,
): StoreResult<SceneStoreEnvelope> {
  const loaded = loadStore(storage);
  if (!loaded.ok) {
    return storeFailure(loaded.error.code, loaded.error.message, loaded.error.cause);
  }
  const scenes = loaded.value.envelope.scenes.filter((entry) => entry.id !== id);
  if (scenes.length === loaded.value.envelope.scenes.length) {
    return storeFailure("scene-not-found", `No saved scene with id "${id}".`);
  }
  return writeEnvelope(storage, {
    storageVersion: SCENE_STORE_VERSION,
    scenes,
  });
}

/** Lists the saved scenes (empty when none / none readable). */
export function listScenes(
  storage: StorageLike,
): StoreResult<readonly StoredSceneEntry[]> {
  const loaded = loadStore(storage);
  if (!loaded.ok) {
    return storeFailure(loaded.error.code, loaded.error.message, loaded.error.cause);
  }
  return storeSuccess(loaded.value.envelope.scenes);
}

/** Removes the whole store (one-click reset, spec §7 一键重置). */
export function clearStore(storage: StorageLike): StoreResult<null> {
  try {
    storage.removeItem(SCENE_STORE_KEY);
    return storeSuccess(null);
  } catch (error) {
    return storeFailure(
      "storage-unavailable",
      "localStorage is not writable (disabled or blocked).",
      error instanceof Error ? error.message : String(error),
    );
  }
}
