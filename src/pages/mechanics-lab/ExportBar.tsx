/**
 * 导出与场景管理工具条（规格书第十一节）：
 * 保存/读取 localStorage、下载/导入场景 JSON、下载 SVG、导出 PNG、复制分析文本、打印、重置。
 */
import { useEffect, useRef, useState } from "react";
import {
  migrateScene,
  serializeScene,
  type MechanicsSceneV1,
  type MechanicsSolutionV1,
  type SceneStoreEntry,
} from "@/features/mechanics-lab/schema";
import { formatAnalysisText } from "@/features/mechanics-lab/explain";
import { buildSceneSvg } from "@/features/mechanics-lab/svg";
import { downloadSvgAsPng, downloadTextFile, safeFilename } from "./file-utils.js";
import { loadSceneStore, newStoreEntry, saveSceneStore } from "./storage.js";

export interface ExportBarProps {
  scene: MechanicsSceneV1;
  solution: MechanicsSolutionV1 | null;
  onLoadScene: (scene: MechanicsSceneV1) => void;
  onResetScene: () => void;
  onMessage: (message: string) => void;
}

export function ExportBar({ scene, solution, onLoadScene, onResetScene, onMessage }: ExportBarProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [storeDialogOpen, setStoreDialogOpen] = useState(false);
  const [entries, setEntries] = useState<SceneStoreEntry[]>([]);
  const [busy, setBusy] = useState(false);

  // 对话框 Escape 关闭（全局监听，保证焦点在任何位置都可关闭）
  useEffect(() => {
    if (!storeDialogOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setStoreDialogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [storeDialogOpen]);

  const doSave = (): void => {
    const loaded = loadSceneStore();
    if (!loaded.ok || loaded.value === undefined) {
      onMessage(loaded.message);
      return;
    }
    const existing = loaded.value.entries.find((e) => e.title === scene.title);
    const entry = newStoreEntry(scene.title, scene, existing?.storeId);
    const next = { ...loaded.value, entries: existing !== undefined ? loaded.value.entries.map((e) => (e.storeId === entry.storeId ? entry : e)) : [...loaded.value.entries, entry] };
    const saved = saveSceneStore(next);
    onMessage(saved.ok ? `已保存场景「${scene.title}」到 localStorage（${existing !== undefined ? "覆盖同名" : "新增"}）` : saved.message);
  };

  const openStoreDialog = (): void => {
    const loaded = loadSceneStore();
    if (!loaded.ok || loaded.value === undefined) {
      onMessage(loaded.message);
      return;
    }
    setEntries(loaded.value.entries);
    setStoreDialogOpen(true);
  };

  const doLoadEntry = (entry: SceneStoreEntry): void => {
    onLoadScene(entry.scene);
    setStoreDialogOpen(false);
    onMessage(`已载入场景「${entry.title}」`);
  };

  const doDeleteEntry = (storeId: string): void => {
    const next = entries.filter((e) => e.storeId !== storeId);
    setEntries(next);
    const loaded = loadSceneStore();
    if (loaded.ok && loaded.value !== undefined) {
      saveSceneStore({ ...loaded.value, entries: next });
    }
    onMessage("已删除存档条目");
  };

  const doDownloadJson = (): void => {
    downloadTextFile(safeFilename(scene.title, "json"), serializeScene(scene), "application/json");
    onMessage("已下载场景 JSON");
  };

  const doImportJson = async (file: File): Promise<void> => {
    const text = await file.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      onMessage("导入失败：文件不是合法 JSON（损坏或格式错误）");
      return;
    }
    const migrated = migrateScene(raw);
    if (!migrated.ok) {
      onMessage(`导入失败：${migrated.message}`);
      return;
    }
    onLoadScene(migrated.scene);
    onMessage(`已导入场景「${migrated.scene.title}」${migrated.migratedFrom !== undefined ? `（自版本 ${migrated.migratedFrom} 迁移）` : ""}`);
  };

  const doDownloadSvg = (): void => {
    const svg = buildSceneSvg(scene, { solution, exportedAt: new Date().toISOString() });
    downloadTextFile(safeFilename(scene.title, "svg"), svg, "image/svg+xml");
    onMessage("已下载完整 SVG（含力箭头、文字、公式标签、坐标轴、标题与元数据）");
  };

  const doExportPng = async (): Promise<void> => {
    setBusy(true);
    try {
      const svg = buildSceneSvg(scene, { solution, exportedAt: new Date().toISOString() });
      await downloadSvgAsPng(safeFilename(scene.title, "png"), svg);
      onMessage("已导出 PNG");
    } catch (error) {
      onMessage(`PNG 导出失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const doCopyText = async (): Promise<void> => {
    if (solution === null) {
      onMessage("无求解结果可复制");
      return;
    }
    const text = formatAnalysisText(solution);
    try {
      await navigator.clipboard.writeText(text);
      onMessage("已复制结构化分析文本到剪贴板");
    } catch {
      // 剪贴板 API 不可用时的降级：临时 textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      onMessage(ok ? "已复制结构化分析文本到剪贴板" : "复制失败：浏览器拒绝剪贴板访问");
    }
  };

  return (
    <div className="export-bar" role="toolbar" aria-label="导出与场景管理">
      <button type="button" onClick={doSave}>保存场景</button>
      <button type="button" onClick={openStoreDialog}>读取场景</button>
      <button type="button" onClick={doDownloadJson}>下载 JSON</button>
      <button type="button" onClick={() => fileInputRef.current?.click()}>导入 JSON</button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f !== undefined) void doImportJson(f);
          e.target.value = "";
        }}
      />
      <button type="button" onClick={doDownloadSvg}>下载 SVG</button>
      <button type="button" onClick={() => void doExportPng()} disabled={busy}>
        {busy ? "导出中…" : "导出 PNG"}
      </button>
      <button type="button" onClick={() => void doCopyText()}>复制分析文本</button>
      <button type="button" onClick={() => window.print()}>打印</button>
      <button
        type="button"
        className="danger"
        onClick={() => {
          onResetScene();
          onMessage("已重置为空白场景");
        }}
      >
        一键重置
      </button>

      {storeDialogOpen && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setStoreDialogOpen(false)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="读取场景存档"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setStoreDialogOpen(false);
            }}
          >
            <h3>读取场景存档（localStorage）</h3>
            {entries.length === 0 && <p>暂无存档。使用「保存场景」创建。</p>}
            <ul className="store-list">
              {entries.map((entry) => (
                <li key={entry.storeId}>
                  <span className="store-title">{entry.title}</span>
                  <span className="store-date">{new Date(entry.savedAt).toLocaleString()}</span>
                  <button type="button" onClick={() => doLoadEntry(entry)}>载入</button>
                  <button type="button" className="danger" onClick={() => doDeleteEntry(entry.storeId)}>删除</button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setStoreDialogOpen(false)}>关闭（Esc）</button>
          </div>
        </div>
      )}
    </div>
  );
}
