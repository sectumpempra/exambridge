/**
 * ExportPanel — every export / import / reset entry point of the lab
 * (spec §7). Composition only: JSON transfer, PNG capture, HTML handout and
 * downloads live in pure modules; this panel wires them to the buttons and
 * surfaces structured outcomes as status/alert text.
 *
 * Degradation rules (never fake a capability):
 * - PNG buttons are DISABLED while the viewport is not "ready", with the
 *   reason shown next to them.
 * - HTML handout export always works: without a screenshot it embeds the
 *   explicit text fallback instead.
 */

import { useRef, useState } from "react";
import type { VectorGeometrySceneV1 } from "@/features/vector-geometry-lab/schema";
import type {
  CapturedPng,
  CapturePixelRatio,
  RendererError,
  Result,
} from "@/features/vector-geometry-lab/three";
import type { ExplanationModel } from "@/features/vector-geometry-lab/explain";
import { downloadDataUrl, downloadText } from "../export/download.js";
import type { DownloadDeps } from "../export/download.js";
import { buildHandoutHtml } from "../export/html-export.js";
import { importSceneJson, sceneToJson } from "../export/json-transfer.js";
import type { ImportedScene } from "../export/json-transfer.js";
import styles from "./export.module.css";

export type CaptureFn = (
  ratio: CapturePixelRatio,
) => Result<CapturedPng, RendererError>;

export interface ExportPanelProps {
  readonly scene: VectorGeometrySceneV1;
  readonly sceneTitle: string;
  readonly models: readonly ExplanationModel[];
  readonly viewportReady: boolean;
  readonly capturePng: CaptureFn;
  readonly onImportScene: (imported: ImportedScene) => void;
  readonly onResetLab: () => void;
  readonly downloadDeps?: DownloadDeps;
  readonly printFn?: () => void;
  readonly confirmFn?: (message: string) => boolean;
  readonly nowFn?: () => string;
}

const PIXEL_RATIOS: readonly CapturePixelRatio[] = [1, 2, 3];

export function ExportPanel(props: ExportPanelProps): React.JSX.Element {
  const {
    scene,
    sceneTitle,
    models,
    viewportReady,
    capturePng,
    onImportScene,
    onResetLab,
    downloadDeps = {},
    printFn = () => window.print(),
    confirmFn = (message) => window.confirm(message),
    nowFn = () => new Date().toISOString(),
  } = props;

  const [pixelRatio, setPixelRatio] = useState<CapturePixelRatio>(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const flash = (ok: string | null, err: string | null): void => {
    setNotice(ok);
    setError(err);
  };

  // jsdom (and older browsers) lack Blob.text(); FileReader is universal.
  const readFileText = (file: File): Promise<string> => {
    if (typeof file.text === "function") {
      return file.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () =>
        reject(reader.error ?? new Error("could not read the file"));
      reader.readAsText(file);
    });
  };

  const exportJson = (): void => {
    const result = downloadText(
      `${scene.sceneId}.json`,
      sceneToJson(scene),
      "application/json",
      downloadDeps,
    );
    flash(
      result.ok ? `Scene JSON downloaded as ${result.filename}.` : null,
      result.ok ? null : result.message,
    );
  };

  const exportPng = (): void => {
    const captured = capturePng(pixelRatio);
    if (!captured.ok) {
      flash(null, `PNG export failed: ${captured.error.message}`);
      return;
    }
    const suffix = pixelRatio === 1 ? "" : `@${String(pixelRatio)}x`;
    const result = downloadDataUrl(
      `${scene.sceneId}${suffix}.png`,
      captured.value.dataUrl,
      downloadDeps,
    );
    flash(
      result.ok
        ? `PNG downloaded (${String(captured.value.width)}×${String(captured.value.height)}).`
        : null,
      result.ok ? null : result.message,
    );
  };

  const exportHtml = (): void => {
    // The handout embeds a fresh screenshot when possible; a capture failure
    // degrades to the explicit text fallback INSIDE the document.
    const captured = viewportReady ? capturePng(1) : null;
    const pngDataUrl = captured !== null && captured.ok ? captured.value.dataUrl : null;
    const html = buildHandoutHtml({
      title: sceneTitle,
      models,
      pngDataUrl,
      generatedAt: nowFn(),
    });
    const result = downloadText(
      `${scene.sceneId}-handout.html`,
      html,
      "text/html",
      downloadDeps,
    );
    flash(
      result.ok
        ? pngDataUrl !== null
          ? "HTML handout downloaded (with embedded 3D snapshot)."
          : "HTML handout downloaded (text fallback — no 3D snapshot)."
        : null,
      result.ok ? null : result.message,
    );
  };

  const importFile = async (file: File): Promise<void> => {
    const text = await readFileText(file);
    const imported = importSceneJson(text);
    if (!imported.ok) {
      flash(null, imported.error.message);
      return;
    }
    onImportScene(imported.value);
    flash(`Scene imported from ${file.name}.`, null);
  };

  const resetLab = (): void => {
    const confirmed = confirmFn(
      "确认重置实验室吗？这会清除当前场景，并删除保存在本机浏览器中的所有场景。",
    );
    if (!confirmed) {
      return;
    }
    onResetLab();
    flash("已恢复默认示例，并清除本机保存的场景。", null);
  };

  return (
    <section className={styles.exportPanel} aria-label="Export and storage actions">
      <h2 className={styles.heading}>导出与重置</h2>
      <div className={styles.actions}>
        <button type="button" aria-label="Download scene JSON" onClick={exportJson}>
          下载场景 JSON
        </button>
        <button
          type="button"
          aria-label="Import scene JSON"
          onClick={() => fileInputRef.current?.click()}
        >
          导入场景 JSON…
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className={styles.fileInput}
          aria-label="Import scene JSON file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) {
              void importFile(file);
            }
            event.target.value = "";
          }}
        />

        <label className={styles.ratioLabel}>
          PNG 清晰度
          <select
            value={pixelRatio}
            aria-label="PNG export scale"
            onChange={(event) =>
              setPixelRatio(Number(event.target.value) as CapturePixelRatio)
            }
          >
            {PIXEL_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}×{ratio === 1 ? " (canvas)" : " (high resolution)"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label="Download PNG"
          onClick={exportPng}
          disabled={!viewportReady}
        >
          下载 PNG
        </button>
        <button type="button" aria-label="Download HTML handout" onClick={exportHtml}>
          下载 HTML 讲义
        </button>
        <button type="button" aria-label="Print handout" onClick={() => printFn()}>
          打印讲义
        </button>
        <button
          type="button"
          aria-label="Reset lab"
          className={styles.resetButton}
          onClick={resetLab}
        >
          重置实验室
        </button>
      </div>
      {!viewportReady && (
        <p className={styles.degradedNote}>
          三维视图不可用或仍在加载时，PNG 导出会停用。HTML 讲义仍可导出，
          并以完整文字结果替代三维快照。
        </p>
      )}
      {notice !== null && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {error !== null && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  );
}
