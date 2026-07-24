/**
 * explanationToPlainText — deterministic plain-text rendering of an
 * ExplanationModel, for the "copy the complete analysis text" feature
 * (spec §7). Pure string assembly; identical model ⇒ identical text.
 */

import type { ExplanationItem, ExplanationModel } from "./model.js";

function renderItem(item: ExplanationItem): string {
  switch (item.kind) {
    case "text":
      return `- ${item.text}`;
    case "formula":
      return item.note !== undefined && item.note.length > 0
        ? `- ${item.formula}   [${item.note}]`
        : `- ${item.formula}`;
    case "key-value":
      return `- ${item.key}: ${item.value}`;
  }
}

/** Renders the full model as copy-pasteable plain text. */
export function explanationToPlainText(model: ExplanationModel): string {
  const lines: string[] = [];
  lines.push(model.title);
  lines.push(
    model.status === "solved"
      ? "Status: solved"
      : `Status: refused (${model.refusal?.code ?? "unknown"})`,
  );
  if (model.status === "refused" && model.refusal !== undefined) {
    lines.push(`Refusal: ${model.refusal.message}`);
  }
  for (const section of model.sections) {
    lines.push("");
    lines.push(`== ${section.order}. ${section.title} ==`);
    if (section.items.length === 0) {
      lines.push("- (none)");
      continue;
    }
    for (const item of section.items) {
      lines.push(renderItem(item));
    }
  }
  lines.push("");
  return lines.join("\n");
}
