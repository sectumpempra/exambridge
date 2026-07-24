/**
 * HTML handout export (spec §7: 导出包含公式、三维截图、结论和验证过程的
 * HTML). Pure string builder — fully self-contained output: inline styles
 * only, embedded data-URL screenshot, NO external references of any kind.
 * Refused analyses are exported as refusals, never with a fabricated answer.
 */

import type {
  ExplanationItem,
  ExplanationModel,
  ExplanationSection,
} from "@/features/vector-geometry-lab/explain";

export interface HandoutInput {
  /** Scene/analysis title shown as the document heading. */
  readonly title: string;
  readonly models: readonly ExplanationModel[];
  /** data:image/png;base64 URL, or null when WebGL was unavailable. */
  readonly pngDataUrl: string | null;
  /** Injectable timestamp for deterministic tests. */
  readonly generatedAt: string;
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function itemToHtml(item: ExplanationItem): string {
  switch (item.kind) {
    case "text":
      return `<p>${escapeHtml(item.text)}</p>`;
    case "formula":
      return `<pre class="formula">${escapeHtml(item.formula)}</pre>${
        item.note !== undefined
          ? `<p class="note">${escapeHtml(item.note)}</p>`
          : ""
      }`;
    case "key-value":
      return `<tr><th scope="row">${escapeHtml(item.key)}</th><td>${escapeHtml(item.value)}</td></tr>`;
  }
}

function sectionToHtml(section: ExplanationSection): string {
  // Consecutive key-value items collapse into one table for readability.
  const parts: string[] = [];
  let openTable = false;
  for (const item of section.items) {
    if (item.kind === "key-value") {
      if (!openTable) {
        parts.push("<table><tbody>");
        openTable = true;
      }
      parts.push(itemToHtml(item));
    } else {
      if (openTable) {
        parts.push("</tbody></table>");
        openTable = false;
      }
      parts.push(itemToHtml(item));
    }
  }
  if (openTable) {
    parts.push("</tbody></table>");
  }
  return `<section class="block"><h2>${String(section.order)}. ${escapeHtml(section.title)}</h2>${parts.join("\n")}</section>`;
}

function modelToHtml(model: ExplanationModel): string {
  const status =
    model.status === "solved"
      ? '<p class="status solved">Status: solved — every claim below is backed by the verification section.</p>'
      : `<p class="status refused" role="alert">Status: refused (${escapeHtml(model.refusal?.code ?? "unknown")}) — ${escapeHtml(model.refusal?.message ?? "no result is displayed")}. No answer is shown, because inventing one would be dishonest.</p>`;
  return `<article class="analysis"><h1>${escapeHtml(model.title)}</h1>${status}${model.sections.map(sectionToHtml).join("\n")}</article>`;
}

const HANDOUT_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; max-width: 820px; padding: 32px 24px 64px;
    font-family: "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: #24292f; background: #ffffff; line-height: 1.55; }
  header.doc { border-bottom: 3px solid #002fa7; margin-bottom: 24px; }
  header.doc h1 { margin: 0 0 4px; font-size: 24px; }
  header.doc p.meta { margin: 0 0 12px; color: #57606a; font-size: 13px; }
  figure.snapshot { margin: 0 0 24px; }
  figure.snapshot img { display: block; max-width: 100%; border: 1px solid #d0d7de; }
  figure.snapshot figcaption { font-size: 12px; color: #57606a; margin-top: 4px; }
  div.no-snapshot { border: 1px dashed #d0d7de; padding: 12px 16px; margin-bottom: 24px;
    color: #57606a; font-size: 14px; }
  article.analysis { margin-bottom: 40px; }
  article.analysis > h1 { font-size: 20px; margin: 0 0 8px; }
  p.status { font-size: 14px; padding: 8px 12px; border-left: 4px solid; }
  p.status.solved { border-color: #1a7f37; background: #dafbe1; }
  p.status.refused { border-color: #cf222e; background: #ffebe9; }
  section.block { margin-bottom: 20px; }
  section.block h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.04em;
    color: #002fa7; border-bottom: 1px solid #d0d7de; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { text-align: left; padding: 4px 10px; border-bottom: 1px solid #eaeef2;
    font-size: 14px; vertical-align: top; }
  th { width: 34%; color: #57606a; font-weight: 600; }
  pre.formula { background: #f6f8fa; border: 1px solid #d0d7de; padding: 10px 12px;
    font-size: 14px; overflow-x: auto; }
  p.note { font-size: 13px; color: #57606a; }
  footer.doc { margin-top: 40px; font-size: 12px; color: #57606a;
    border-top: 1px solid #d0d7de; padding-top: 8px; }
  @media print {
    body { padding: 0; }
    figure.snapshot img { max-height: 320px; }
  }
`;

/**
 * Builds the standalone handout document. The returned string is a complete
 * HTML file: inline <style>, embedded data-URL image, zero external URLs.
 */
export function buildHandoutHtml(input: HandoutInput): string {
  const { title, models, pngDataUrl, generatedAt } = input;
  const snapshot =
    pngDataUrl !== null
      ? `<figure class="snapshot"><img alt="3D view snapshot of the scene" src="${escapeHtml(pngDataUrl)}" /><figcaption>3D view at export time.</figcaption></figure>`
      : `<div class="no-snapshot">3D snapshot unavailable (WebGL missing or blocked at export time). The text results in this handout are complete and independently usable.</div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)} — ExamBridge Vector Geometry Lab handout</title>
<style>${HANDOUT_STYLES}</style>
</head>
<body>
<header class="doc">
<h1>${escapeHtml(title)}</h1>
<p class="meta">Teaching handout exported from ExamBridge Vector Geometry Lab at ${escapeHtml(generatedAt)}. Fully self-contained — no network access required.</p>
</header>
${snapshot}
${models.map(modelToHtml).join("\n")}
<footer class="doc">Generated by ExamBridge Vector Geometry Lab. All mathematics was computed by the deterministic core engine and verified before export.</footer>
</body>
</html>
`;
}
