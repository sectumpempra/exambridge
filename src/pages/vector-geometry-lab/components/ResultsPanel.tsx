/**
 * ResultsPanel — the bottom region: worked solutions, relation verdicts and
 * verification (spec §6 下方区域), collapsible per analysis, with a
 * copy-the-full-analysis button (spec §7 复制完整分析文字).
 */

import { useState } from "react";
import { explanationToPlainText } from "@/features/vector-geometry-lab/explain";
import type { ExplanationModel } from "@/features/vector-geometry-lab/explain";
import { ExplanationView } from "./ExplanationView.js";
import styles from "./results.module.css";

export interface ResultsPanelProps {
  readonly models: readonly ExplanationModel[];
  readonly inputError: string | null;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard !== undefined
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea fallback
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export function ResultsPanel(props: ResultsPanelProps): React.JSX.Element {
  const { models, inputError } = props;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const fullText = models.map(explanationToPlainText).join("\n");

  const handleCopy = async (): Promise<void> => {
    const ok = await copyText(fullText);
    setCopyState(ok ? "copied" : "failed");
  };

  return (
    <section className={styles.results} aria-label="Worked results">
      <div className={styles.resultsHeader}>
        <h2>
          解答过程与核验
          <span className={styles.englishSubtitle}>Worked solution &amp; verification</span>
        </h2>
        <button
          type="button"
          aria-label="Copy full analysis text"
          onClick={handleCopy}
          className={styles.copyButton}
        >
          复制完整分析
        </button>
        {copyState === "copied" && (
          <span role="status" className={styles.copyOk}>
            已复制。
          </span>
        )}
        {copyState === "failed" && (
          <span role="alert" className={styles.copyFailed}>
            复制失败，请手动选择文字。
          </span>
        )}
      </div>
      {inputError !== null && (
        <p role="alert" className={styles.inputError}>
          {inputError} (showing the last valid scene and results)
        </p>
      )}
      {models.length === 0 ? (
        <p>尚未选择分析。</p>
      ) : (
        models.map((model) => <ExplanationView key={model.analysisId} model={model} />)
      )}
    </section>
  );
}
