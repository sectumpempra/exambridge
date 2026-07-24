/**
 * 结构化分析文本（复制到剪贴板用）：由 ExplanationDocument 生成纯文本。
 */
import { explainSolution } from "./explain.js";
import type { MechanicsSolutionV1 } from "@/features/mechanics-lab/schema";

/** 生成可粘贴的结构化中文分析文本（Markdown 风格） */
export function formatAnalysisText(solution: MechanicsSolutionV1): string {
  const doc = explainSolution(solution);
  const lines: string[] = [];
  lines.push(`# 力学分析结果（${doc.statusLabel}）`);
  lines.push("");
  lines.push(doc.statusReason);
  lines.push("");
  for (const section of doc.sections) {
    lines.push(`## ${section.order}. ${section.title}`);
    for (const item of section.items) {
      const prefix =
        item.kind === "check-pass" ? "✓ " : item.kind === "check-fail" || item.kind === "error" ? "✗ " : item.kind === "warning" ? "⚠ " : "- ";
      lines.push(`${prefix}${item.text}`);
    }
    lines.push("");
  }
  lines.push("—— 由 ExamBridge Mechanics Lab V1 确定性求解器生成（非 AI 数值）");
  return lines.join("\n");
}
