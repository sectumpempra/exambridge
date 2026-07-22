import type { AICitation } from "@/domain-v2/ai-assistant";

export interface AIAnswerExportModel {
  messageId: string;
  markdown: string;
  plainText: string;
  renderedHtml: string;
  citations: AICitation[];
  contextLabels: string[];
  exportedAt: string;
  completionState: "complete";
}

export interface PngSlice {
  start: number;
  height: number;
}

const EXPORT_WIDTH = 960;
const MAX_PNG_SLICE_HEIGHT = 14_000;

export function escapeExportHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeCitationUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function formattedExportTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function buildAnswerPlainText(model: AIAnswerExportModel): string {
  const context = model.contextLabels.length > 0
    ? `检索范围：${model.contextLabels.join("；")}`
    : "检索范围：未限定范围";
  const sources = model.citations.length > 0
    ? `\n\n来源\n${model.citations.map((citation) =>
      `[${citation.sourceId}] ${citation.title}（${citation.dataVersion}）\n${citation.url}`,
    ).join("\n")}`
    : "";
  return [
    "ExamBridge AI 回答",
    context,
    `导出时间：${formattedExportTime(model.exportedAt)}`,
    "",
    model.plainText.trim(),
  ].join("\n") + sources;
}

export function buildAnswerFragmentHtml(model: AIAnswerExportModel): string {
  const context = model.contextLabels.length > 0
    ? model.contextLabels.map(escapeExportHtml).join(" · ")
    : "未限定范围";
  const citations = model.citations
    .map((citation) => {
      const url = safeCitationUrl(citation.url);
      const label = `[${escapeExportHtml(citation.sourceId)}] ${escapeExportHtml(citation.title)}`;
      const linked = url
        ? `<a href="${escapeExportHtml(url)}" rel="noreferrer">${label}</a>`
        : `<span>${label}</span>`;
      return `<li>${linked}<small>${escapeExportHtml(citation.dataVersion)}</small></li>`;
    })
    .join("");

  return `<article class="exambridge-answer-export">
    <header>
      <div class="brand" aria-label="ExamBridge">
        <svg viewBox="0 0 215 184" role="img" aria-hidden="true"><path d="M0 1C34-1 68 10 99 32V79C64 81 31 92 0 114Z" fill="#253C4B"/><path d="M116 32C147 10 181-1 215 1V114C184 92 151 81 116 79Z" fill="#AB9E92"/><path d="M0 134C33 112 69 100 101 97C106 96 111 96 116 97C149 100 183 113 215 134V179C196 170 177 164 158 160C154 136 134 117 108 117C82 117 62 136 58 160C39 164 19 170 0 179Z" fill="#253C4B"/></svg>
        <strong>ExamBridge</strong>
      </div>
      <p class="eyebrow">EXAMBRIDGE AI · 已完成回答</p>
      <p class="meta">${escapeExportHtml(context)} · ${escapeExportHtml(formattedExportTime(model.exportedAt))}</p>
    </header>
    <main>${model.renderedHtml}</main>
    ${citations ? `<footer><h2>来源</h2><ol>${citations}</ol></footer>` : ""}
  </article>`;
}

const EXPORT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f7f4f1; color: #3f3a34; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif; }
  .exambridge-answer-export { width: 960px; margin: 0 auto; padding: 64px 68px; background: #fdfcf9; }
  header { padding-bottom: 28px; border-bottom: 1px solid #d9d4ce; }
  .brand { display: flex; align-items: center; gap: 14px; color: #253c4b; font-size: 31px; letter-spacing: -.03em; }
  .brand svg { width: 44px; height: 38px; display: block; }
  .eyebrow { margin: 20px 0 0; color: #526b7e; font-size: 13px; font-weight: 700; letter-spacing: .12em; }
  .meta { margin: 8px 0 0; color: #756e67; font-size: 13px; }
  main { padding: 30px 0 10px; font-size: 17px; line-height: 1.85; overflow-wrap: anywhere; }
  main h1, main h2, main h3, main h4 { color: #302d2a; line-height: 1.4; margin: 1.25em 0 .5em; }
  main h1:first-child, main h2:first-child, main h3:first-child, main h4:first-child, main p:first-child { margin-top: 0; }
  main p { margin: .7em 0 0; white-space: pre-wrap; }
  main ul, main ol { margin: .7em 0 0; padding-left: 1.5em; }
  main blockquote { margin: 1em 0; padding: 8px 16px; border-left: 3px solid #8fa3aa; background: #f2f6f5; color: #5f5a54; }
  main pre { overflow-wrap: anywhere; white-space: pre-wrap; border-radius: 12px; background: #253b46; color: #edf3f3; padding: 16px; }
  main code { border-radius: 4px; background: #f0ede8; padding: 2px 5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  main pre code { background: transparent; padding: 0; }
  main table { width: 100%; border-collapse: collapse; font-size: 14px; }
  main th, main td { border: 1px solid #ddd7cf; padding: 9px; text-align: left; vertical-align: top; }
  main th { background: #f3f0eb; }
  main a, footer a { color: #405e70; text-decoration: underline; overflow-wrap: anywhere; }
  footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #d9d4ce; }
  footer h2 { margin: 0; font-size: 15px; }
  footer ol { margin: 12px 0 0; padding-left: 22px; }
  footer li { margin-top: 8px; font-size: 13px; line-height: 1.6; }
  footer small { display: block; color: #81796f; }
`;

export function buildStandaloneAnswerHtml(model: AIAnswerExportModel): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ExamBridge AI 回答</title>
  <style>${EXPORT_CSS}</style>
</head>
<body>${buildAnswerFragmentHtml(model)}</body>
</html>`;
}

export function calculatePngSlices(totalHeight: number, maxHeight = MAX_PNG_SLICE_HEIGHT): PngSlice[] {
  if (!Number.isFinite(totalHeight) || totalHeight <= 0 || !Number.isFinite(maxHeight) || maxHeight <= 0) return [];
  const slices: PngSlice[] = [];
  for (let start = 0; start < totalHeight; start += maxHeight) {
    slices.push({ start, height: Math.min(maxHeight, totalHeight - start) });
  }
  return slices;
}

export function answerExportFileStem(exportedAt: string): string {
  const date = new Date(exportedAt);
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `exambridge-answer-${safe.getFullYear()}${pad(safe.getMonth() + 1)}${pad(safe.getDate())}-${pad(safe.getHours())}${pad(safe.getMinutes())}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function copyAnswerRichText(model: AIAnswerExportModel): Promise<"rich" | "plain"> {
  const html = buildStandaloneAnswerHtml(model);
  const plain = buildAnswerPlainText(model);
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html;charset=utf-8" }),
      "text/plain": new Blob([plain], { type: "text/plain;charset=utf-8" }),
    })]);
    return "rich";
  }
  await navigator.clipboard.writeText(plain);
  return "plain";
}

export function downloadAnswerHtml(model: AIAnswerExportModel): void {
  downloadBlob(
    new Blob([buildStandaloneAnswerHtml(model)], { type: "text/html;charset=utf-8" }),
    `${answerExportFileStem(model.exportedAt)}.html`,
  );
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("无法生成 PNG 文件")), "image/png");
  });
}

export async function downloadAnswerPng(model: AIAnswerExportModel): Promise<number> {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = `position:fixed;left:-12000px;top:0;width:${EXPORT_WIDTH}px;background:#f7f4f1;z-index:-1;`;
  root.innerHTML = `<style>${EXPORT_CSS}</style>${buildAnswerFragmentHtml(model)}`;
  document.body.append(root);
  try {
    await document.fonts?.ready;
    const estimatedHeight = Math.max(root.scrollHeight, 1);
    const scale = Math.min(2, Math.max(0.8, 28_000 / estimatedHeight));
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(root, {
      backgroundColor: "#f7f4f1",
      logging: false,
      scale,
      useCORS: true,
      width: EXPORT_WIDTH,
      windowWidth: EXPORT_WIDTH,
    });
    const slices = calculatePngSlices(canvas.height);
    if (slices.length === 0) throw new Error("回答内容为空，无法导出 PNG");
    const stem = answerExportFileStem(model.exportedAt);
    for (let index = 0; index < slices.length; index += 1) {
      const slice = slices[index];
      const page = document.createElement("canvas");
      page.width = canvas.width;
      page.height = slice.height;
      const context = page.getContext("2d");
      if (!context) throw new Error("浏览器无法创建 PNG 画布");
      context.drawImage(canvas, 0, -slice.start);
      const suffix = slices.length === 1 ? "" : `-${String(index + 1).padStart(2, "0")}`;
      downloadBlob(await canvasToBlob(page), `${stem}${suffix}.png`);
    }
    return slices.length;
  } finally {
    root.remove();
  }
}
