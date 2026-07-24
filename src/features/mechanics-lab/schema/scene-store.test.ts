import { describe, expect, it } from "vitest";
import {
  LOCAL_STORAGE_SCENES_KEY_V1,
  SCHEMA_VERSION_V1,
  createEmptySceneStore,
  findEntryByTitle,
  parseSceneStore,
  removeSceneEntry,
  serializeSceneStore,
  upsertSceneEntry,
  type SceneStoreEntry,
} from "./index.js";
import { makeMinimalScene } from "./schema.test.js";

function entry(id: string, title: string): SceneStoreEntry {
  return { storeId: id, title, savedAt: "2026-07-16T10:00:00.000Z", scene: { ...makeMinimalScene(), title } };
}

describe("scene-store 场景存储", () => {
  it("localStorage 键与协议版本", () => {
    expect(LOCAL_STORAGE_SCENES_KEY_V1).toBe("exambridge:mechanics-lab:v1:scenes");
    expect(SCHEMA_VERSION_V1).toBe("1.0.0");
  });

  it("空存储往返序列化", () => {
    const store = createEmptySceneStore();
    const parsed = parseSceneStore(serializeSceneStore(store));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.store.entries).toEqual([]);
  });

  it("upsert 追加与覆盖；remove 删除", () => {
    let store = createEmptySceneStore();
    store = upsertSceneEntry(store, entry("s-1", "场景A"));
    store = upsertSceneEntry(store, entry("s-2", "场景B"));
    expect(store.entries).toHaveLength(2);
    store = upsertSceneEntry(store, { ...entry("s-1", "场景A2"), storeId: "s-1" });
    expect(store.entries).toHaveLength(2);
    expect(store.entries[0]?.title).toBe("场景A2");
    store = removeSceneEntry(store, "s-2");
    expect(store.entries).toHaveLength(1);
    expect(findEntryByTitle(store, "场景A2")?.storeId).toBe("s-1");
    expect(findEntryByTitle(store, "不存在")).toBeNull();
  });

  it("含场景的存储往返", () => {
    let store = createEmptySceneStore();
    store = upsertSceneEntry(store, entry("s-1", "场景A"));
    const parsed = parseSceneStore(serializeSceneStore(store));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.store.entries[0]?.scene.title).toBe("场景A");
    }
  });

  it("损坏 JSON 安全拒绝", () => {
    const r = parseSceneStore('{"storeVersion": 1, "entries": [');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("损坏");
  });

  it("未知版本安全拒绝", () => {
    const r = parseSceneStore(JSON.stringify({ storeVersion: 99, entries: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("99");
  });

  it("非对象/缺字段拒绝", () => {
    expect(parseSceneStore("[1,2]").ok).toBe(false);
    expect(parseSceneStore('"x"').ok).toBe(false);
    expect(parseSceneStore(JSON.stringify({ storeVersion: 1 })).ok).toBe(false);
    expect(parseSceneStore(JSON.stringify({ storeVersion: 1, entries: [42] })).ok).toBe(false);
    expect(parseSceneStore(JSON.stringify({ storeVersion: 1, entries: [{ storeId: "s-1" }] })).ok).toBe(false);
  });

  it("场景数据非法的条目被拒绝并给出中文提示", () => {
    const bad = {
      storeVersion: 1,
      entries: [
        { storeId: "s-1", title: "坏场景", savedAt: "2026-07-16T10:00:00.000Z", scene: { schemaVersion: "2.0.0" } },
      ],
    };
    const r = parseSceneStore(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("坏场景");
  });
});
