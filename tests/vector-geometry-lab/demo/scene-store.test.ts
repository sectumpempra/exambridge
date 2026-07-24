import { afterEach, describe, expect, it } from "vitest";
import { getExample } from "@/pages/vector-geometry-lab/examples/builtin-examples.js";
import {
  clearStore,
  deleteScene,
  listScenes,
  loadStore,
  renameScene,
  saveScene,
  SCENE_STORE_KEY,
  storeMigrations,
} from "@/pages/vector-geometry-lab/storage/scene-store.js";
import type { StorageLike } from "@/pages/vector-geometry-lab/storage/scene-store.js";

/** In-memory StorageLike with switchable read/write failures. */
function createMemoryStorage(): {
  storage: StorageLike;
  data: Map<string, string>;
  failReads: () => void;
  failWrites: () => void;
} {
  const data = new Map<string, string>();
  let readsFail = false;
  let writesFail = false;
  return {
    data,
    failReads: () => {
      readsFail = true;
    },
    failWrites: () => {
      writesFail = true;
    },
    storage: {
      getItem(key: string) {
        if (readsFail) {
          throw new Error("SecurityError: read access denied");
        }
        return data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (writesFail) {
          throw new Error("QuotaExceededError: storage quota reached");
        }
        data.set(key, value);
      },
      removeItem(key: string) {
        data.delete(key);
      },
    },
  };
}

const exampleScene = getExample("angle-between-vectors")!.scene;
const otherScene = getExample("point-point-distance")!.scene;

afterEach(() => {
  // The migration hook is mutable by design; tests must not leak entries.
  for (const key of Object.keys(storeMigrations)) {
    delete storeMigrations[key];
  }
});

describe("scene store — save / list / rename / delete round trip", () => {
  it("starts empty and persists under the exact spec key", () => {
    const { storage, data } = createMemoryStorage();
    const loaded = loadStore(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.envelope.scenes).toEqual([]);
    expect(loaded.value.envelope.storageVersion).toBe(1);
    expect(loaded.value.droppedEntries).toBe(0);

    saveScene(storage, {
      name: "my scene",
      exampleId: "angle-between-vectors",
      scene: exampleScene,
      id: "s1",
      savedAt: "2026-07-24T00:00:00.000Z",
    });
    // Envelope is versioned and lives under the exact key (spec §7).
    const raw = data.get(SCENE_STORE_KEY);
    expect(raw).toBeDefined();
    const envelope = JSON.parse(raw!) as { storageVersion: number; scenes: unknown[] };
    expect(envelope.storageVersion).toBe(1);
    expect(envelope.scenes).toHaveLength(1);
  });

  it("saves multiple scenes, upserts by id, renames and deletes", () => {
    const { storage } = createMemoryStorage();
    saveScene(storage, {
      name: "first",
      exampleId: "angle-between-vectors",
      scene: exampleScene,
      id: "s1",
      savedAt: "2026-07-24T00:00:00.000Z",
    });
    saveScene(storage, {
      name: "second",
      exampleId: "point-point-distance",
      scene: otherScene,
      id: "s2",
      savedAt: "2026-07-24T00:01:00.000Z",
    });
    // Upsert same id → still two entries, name replaced.
    saveScene(storage, {
      name: "first (edited)",
      exampleId: "angle-between-vectors",
      scene: exampleScene,
      id: "s1",
      savedAt: "2026-07-24T00:02:00.000Z",
    });
    let listed = listScenes(storage);
    expect(listed.ok && listed.value).toHaveLength(2);
    expect(listed.ok && listed.value[1]?.name).toBe("first (edited)");

    const renamed = renameScene(storage, "s2", "distance scene");
    expect(renamed.ok).toBe(true);
    listed = listScenes(storage);
    expect(listed.ok && listed.value.map((e) => e.name)).toEqual([
      "distance scene",
      "first (edited)",
    ]);

    const removed = deleteScene(storage, "s1");
    expect(removed.ok).toBe(true);
    listed = listScenes(storage);
    expect(listed.ok && listed.value.map((e) => e.id)).toEqual(["s2"]);

    // The scene payload round-trips losslessly through the schema.
    const entry = listed.ok ? listed.value[0] : undefined;
    expect(entry?.scene).toEqual(otherScene);
    expect(entry?.exampleId).toBe("point-point-distance");
  });

  it("rename/delete of unknown ids → scene-not-found, store untouched", () => {
    const { storage } = createMemoryStorage();
    saveScene(storage, {
      name: "only",
      exampleId: "angle-between-vectors",
      scene: exampleScene,
      id: "s1",
      savedAt: "2026-07-24T00:00:00.000Z",
    });
    const renamed = renameScene(storage, "nope", "x");
    expect(!renamed.ok && renamed.error.code).toBe("scene-not-found");
    const removed = deleteScene(storage, "nope");
    expect(!removed.ok && removed.error.code).toBe("scene-not-found");
    const listed = listScenes(storage);
    expect(listed.ok && listed.value).toHaveLength(1);
  });

  it("rejects empty names without writing", () => {
    const { storage, data } = createMemoryStorage();
    const saved = saveScene(storage, {
      name: "   ",
      exampleId: "angle-between-vectors",
      scene: exampleScene,
    });
    expect(saved.ok).toBe(false);
    expect(data.has(SCENE_STORE_KEY)).toBe(false);
  });

  it("clearStore removes the whole key (one-click reset)", () => {
    const { storage, data } = createMemoryStorage();
    saveScene(storage, {
      name: "x",
      exampleId: "angle-between-vectors",
      scene: exampleScene,
    });
    expect(data.has(SCENE_STORE_KEY)).toBe(true);
    const cleared = clearStore(storage);
    expect(cleared.ok).toBe(true);
    expect(data.has(SCENE_STORE_KEY)).toBe(false);
  });
});

describe("scene store — failure safety (spec §7 损坏 JSON 和未知版本安全拒绝)", () => {
  it("corrupted JSON → storage-corrupted, data left untouched", () => {
    const { storage, data } = createMemoryStorage();
    data.set(SCENE_STORE_KEY, "{not json at all");
    const loaded = loadStore(storage);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe("storage-corrupted");
    expect(loaded.error.message).toContain("not valid JSON");
    // The corrupted payload was NOT wiped — nothing destructive on read.
    expect(data.get(SCENE_STORE_KEY)).toBe("{not json at all");
  });

  it("wrong envelope shape → storage-corrupted", () => {
    const { storage, data } = createMemoryStorage();
    data.set(SCENE_STORE_KEY, JSON.stringify({ scenes: "nope" }));
    const loaded = loadStore(storage);
    expect(!loaded.ok && loaded.error.code).toBe("storage-corrupted");
  });

  it("unknown storageVersion → unsupported-storage-version (migration hook reserved)", () => {
    const { storage, data } = createMemoryStorage();
    data.set(SCENE_STORE_KEY, JSON.stringify({ storageVersion: 99, scenes: [] }));
    const loaded = loadStore(storage);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe("unsupported-storage-version");
    expect(loaded.error.message).toContain("99");
  });

  it("a registered migration upgrades an old envelope through the hook", () => {
    const { storage, data } = createMemoryStorage();
    data.set(
      SCENE_STORE_KEY,
      JSON.stringify({ storageVersion: 0, savedScenes: [] }),
    );
    storeMigrations["0"] = (input) => {
      const legacy = input as { savedScenes: unknown[] };
      return { storageVersion: 1, scenes: legacy.savedScenes };
    };
    const loaded = loadStore(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.envelope.storageVersion).toBe(1);
    expect(loaded.value.envelope.scenes).toEqual([]);
  });

  it("individually invalid entries are skipped and counted, valid ones survive", () => {
    const { storage, data } = createMemoryStorage();
    const validEntry = {
      id: "good",
      name: "good scene",
      exampleId: "angle-between-vectors",
      savedAt: "2026-07-24T00:00:00.000Z",
      scene: exampleScene,
    };
    const brokenEntry = { id: "bad", name: "bad scene", scene: { schemaVersion: "1.0.0" } };
    data.set(
      SCENE_STORE_KEY,
      JSON.stringify({ storageVersion: 1, scenes: [validEntry, brokenEntry] }),
    );
    const loaded = loadStore(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.envelope.scenes.map((e) => e.id)).toEqual(["good"]);
    expect(loaded.value.droppedEntries).toBe(1);
  });

  it("unreadable storage → storage-unavailable", () => {
    const { storage, failReads } = createMemoryStorage();
    failReads();
    const loaded = loadStore(storage);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe("storage-unavailable");
  });

  it("write failure (quota) → storage-write-failed, in-memory state kept", () => {
    const { storage, failWrites } = createMemoryStorage();
    failWrites();
    const saved = saveScene(storage, {
      name: "x",
      exampleId: "angle-between-vectors",
      scene: exampleScene,
    });
    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.code).toBe("storage-write-failed");
    expect(saved.error.message).toContain("quota");
  });
});
