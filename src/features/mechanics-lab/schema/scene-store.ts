/**
 * 场景存储（localStorage）纯逻辑：多场景存取、版本化、损坏安全拒绝。
 * 浏览器侧的 localStorage 读写由 apps/demo 封装；本模块只处理序列化与解析。
 */
import { LOCAL_STORAGE_SCENES_KEY_V1, SCHEMA_VERSION_V1 } from "./constants.js";
import { parseSceneData } from "./parse.js";
import type { MechanicsSceneV1 } from "./types.js";

export const SCENE_STORE_VERSION = 1;

export interface SceneStoreEntry {
  /** 存储内稳定 id（保存时生成） */
  storeId: string;
  title: string;
  savedAt: string;
  scene: MechanicsSceneV1;
}

export interface SceneStoreDataV1 {
  storeVersion: 1;
  entries: SceneStoreEntry[];
}

export type SceneStoreParseResult =
  | { ok: true; store: SceneStoreDataV1 }
  | { ok: false; message: string };

export function createEmptySceneStore(): SceneStoreDataV1 {
  return { storeVersion: SCENE_STORE_VERSION, entries: [] };
}

/** 序列化存储数据 */
export function serializeSceneStore(store: SceneStoreDataV1): string {
  return JSON.stringify(store);
}

/** 解析存储数据：损坏/未知版本/场景非法均安全拒绝 */
export function parseSceneStore(text: string): SceneStoreParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: "存档数据不是合法 JSON（可能已损坏）" };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, message: "存档数据格式不正确（应为对象）" };
  }
  const version = (raw as Record<string, unknown>).storeVersion;
  if (version !== SCENE_STORE_VERSION) {
    return { ok: false, message: `不支持的存档版本：${typeof version === "number" ? version : "缺失"}（当前支持 ${SCENE_STORE_VERSION}）` };
  }
  const entries = (raw as Record<string, unknown>).entries;
  if (!Array.isArray(entries)) {
    return { ok: false, message: "存档数据缺少 entries 列表" };
  }
  const parsed: SceneStoreEntry[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) {
      return { ok: false, message: "存档条目格式不正确" };
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.storeId !== "string" || typeof e.title !== "string" || typeof e.savedAt !== "string") {
      return { ok: false, message: "存档条目缺少 storeId/title/savedAt 字段" };
    }
    const sceneResult = parseSceneData(e.scene);
    if (!sceneResult.ok) {
      return { ok: false, message: `存档条目「${e.title}」的场景数据非法：${sceneResult.message}` };
    }
    parsed.push({ storeId: e.storeId, title: e.title, savedAt: e.savedAt, scene: sceneResult.scene });
  }
  return { ok: true, store: { storeVersion: SCENE_STORE_VERSION, entries: parsed } };
}

/** 保存场景到存储（同 storeId 覆盖，否则追加；新条目 storeId 由调用方生成） */
export function upsertSceneEntry(
  store: SceneStoreDataV1,
  entry: SceneStoreEntry,
): SceneStoreDataV1 {
  const idx = store.entries.findIndex((e) => e.storeId === entry.storeId);
  if (idx >= 0) {
    const entries = [...store.entries];
    entries[idx] = entry;
    return { ...store, entries };
  }
  return { ...store, entries: [...store.entries, entry] };
}

/** 删除条目 */
export function removeSceneEntry(store: SceneStoreDataV1, storeId: string): SceneStoreDataV1 {
  return { ...store, entries: store.entries.filter((e) => e.storeId !== storeId) };
}

/** 按标题查找（用于"保存同名场景覆盖"提示） */
export function findEntryByTitle(store: SceneStoreDataV1, title: string): SceneStoreEntry | null {
  return store.entries.find((e) => e.title === title) ?? null;
}

export { LOCAL_STORAGE_SCENES_KEY_V1, SCHEMA_VERSION_V1 };
