/**
 * JSON download / safe import of scene documents (spec §7).
 *
 * Export is the plain VectorGeometrySceneV1 document — the same document
 * shape the schema validates — so the Stage 4 rejection surface is reused
 * verbatim on import: broken JSON, unknown schemaVersion and structurally
 * invalid payloads all come back as structured results, never throws.
 *
 * Import additionally resolves WHICH built-in analyzer explains the scene.
 * Inference order (all deterministic, refusal instead of guessing):
 *   1. sceneId "<exampleId>-edited"  (scenes edited in the lab)
 *   2. sceneId of a built-in example ("ex-01"…"ex-16")
 *   3. exact structural match against a built-in example scene
 *   4. otherwise → "unsupported-scene" (no analyzer ⇒ no fake analysis)
 */

import { migrateScene } from "@/features/vector-geometry-lab/schema";
import type { VectorGeometrySceneV1 } from "@/features/vector-geometry-lab/schema";
import { BUILTIN_EXAMPLES, getExample } from "../examples/builtin-examples.js";

export const TRANSFER_ERROR_CODES = [
  "invalid-json",
  "invalid-scene",
  "unsupported-schema-version",
  "unsupported-scene",
] as const;
export type TransferErrorCode = (typeof TRANSFER_ERROR_CODES)[number];

export interface TransferError {
  readonly code: TransferErrorCode;
  readonly message: string;
}

export type TransferResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: TransferError };

function transferFailure<T>(code: TransferErrorCode, message: string): TransferResult<T> {
  return { ok: false, error: { code, message } };
}

/** Pretty-printed scene document for download. */
export function sceneToJson(scene: VectorGeometrySceneV1): string {
  return JSON.stringify(scene, null, 2);
}

/* --------------------------------------------------------------------------
 * exampleId inference
 * ------------------------------------------------------------------------ */

function literalTriple(vector: {
  readonly x: { readonly input: string };
  readonly y: { readonly input: string };
  readonly z: { readonly input: string };
}): string {
  return `${vector.x.input},${vector.y.input},${vector.z.input}`;
}

/**
 * Structural fingerprint: entity counts + every coordinate literal, sorted
 * so entity ORDER does not matter. Two scenes with the same fingerprint run
 * the same mathematics.
 */
function sceneSignature(scene: VectorGeometrySceneV1): string {
  const points = scene.points.map((p) => literalTriple(p.position)).sort();
  const vectors = scene.vectors.map((v) => literalTriple(v.components)).sort();
  const lines = scene.lines
    .map((l) => `${literalTriple(l.point.position)}|${literalTriple(l.direction)}`)
    .sort();
  const planes = scene.planes
    .map((p) => `${literalTriple(p.point.position)}|${literalTriple(p.normal)}`)
    .sort();
  return [
    `P${String(scene.points.length)}`,
    `V${String(scene.vectors.length)}`,
    `L${String(scene.lines.length)}`,
    `N${String(scene.planes.length)}`,
    ...points,
    ...vectors,
    ...lines,
    ...planes,
  ].join(";");
}

const EDITED_SCENE_ID_SUFFIX = "-edited";

export function inferExampleId(scene: VectorGeometrySceneV1): string | undefined {
  // 1. "<exampleId>-edited" (produced by the lab's coordinate editor).
  if (scene.sceneId.endsWith(EDITED_SCENE_ID_SUFFIX)) {
    const candidate = scene.sceneId.slice(0, -EDITED_SCENE_ID_SUFFIX.length);
    if (getExample(candidate) !== undefined) {
      return candidate;
    }
  }
  // 2. A built-in example's own sceneId.
  const bySceneId = BUILTIN_EXAMPLES.find(
    (example) => example.scene.sceneId === scene.sceneId,
  );
  if (bySceneId !== undefined) {
    return bySceneId.id;
  }
  // 3. Exact structural match — must be UNAMBIGUOUS.
  const signature = sceneSignature(scene);
  const matches = BUILTIN_EXAMPLES.filter(
    (example) => sceneSignature(example.scene) === signature,
  );
  if (matches.length === 1) {
    return matches[0]?.id;
  }
  return undefined;
}

export interface ImportedScene {
  readonly scene: VectorGeometrySceneV1;
  readonly exampleId: string;
}

/**
 * Safe import entry point. Never throws; the current lab state must only be
 * replaced when this returns ok.
 */
export function importSceneJson(text: string): TransferResult<ImportedScene> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch (error) {
    return transferFailure(
      "invalid-json",
      `The file is not valid JSON (${error instanceof Error ? error.message : String(error)}). Nothing was imported.`,
    );
  }
  // migrateScene = parseVectorGeometryScene + the reserved migration path;
  // unknown schemaVersion is refused safely inside (Stage 4 contract).
  const parsed = migrateScene(decoded);
  if (!parsed.ok) {
    if (parsed.error.code === "unsupported-schema-version") {
      return transferFailure("unsupported-schema-version", parsed.error.message);
    }
    const firstIssue = parsed.error.issues[0];
    return transferFailure(
      "invalid-scene",
      `The JSON is not a VectorGeometrySceneV1 document (${firstIssue !== undefined ? `${firstIssue.path}: ${firstIssue.message}` : parsed.error.message}). Nothing was imported.`,
    );
  }
  const exampleId = inferExampleId(parsed.value);
  if (exampleId === undefined) {
    return transferFailure(
      "unsupported-scene",
      "The scene is valid, but it does not match any of the 16 built-in analysis types, so no worked solution could be produced. Nothing was imported.",
    );
  }
  return { ok: true, value: { scene: parsed.value, exampleId } };
}
