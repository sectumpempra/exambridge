/** localStorage 场景存取封装（浏览器侧；纯逻辑在 mechanics-schema/scene-store） */
import {
  LOCAL_STORAGE_SCENES_KEY_V1,
  createEmptySceneStore,
  parseSceneStore,
  serializeSceneStore,
  type SceneStoreDataV1,
  type SceneStoreEntry,
} from "@/features/mechanics-lab/schema";

export interface StorageResult<T> {
  ok: boolean;
  value?: T;
  message: string;
}

export function loadSceneStore(): StorageResult<SceneStoreDataV1> {
  try {
    const text = window.localStorage.getItem(LOCAL_STORAGE_SCENES_KEY_V1);
    if (text === null) return { ok: true, value: createEmptySceneStore(), message: "无存档" };
    const parsed = parseSceneStore(text);
    if (!parsed.ok) return { ok: false, message: `读取存档失败：${parsed.message}` };
    return { ok: true, value: parsed.store, message: `已读取 ${parsed.store.entries.length} 个存档` };
  } catch (error) {
    return { ok: false, message: `localStorage 不可用：${error instanceof Error ? error.message : String(error)}` };
  }
}

export function saveSceneStore(store: SceneStoreDataV1): StorageResult<null> {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_SCENES_KEY_V1, serializeSceneStore(store));
    return { ok: true, message: "已保存" };
  } catch (error) {
    return { ok: false, message: `保存失败（存储配额或隐私模式）：${error instanceof Error ? error.message : String(error)}` };
  }
}

export function newStoreEntry(title: string, scene: SceneStoreEntry["scene"], existingStoreId?: string): SceneStoreEntry {
  return {
    storeId: existingStoreId ?? `store-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    savedAt: new Date().toISOString(),
    scene,
  };
}
