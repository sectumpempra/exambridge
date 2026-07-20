import { format } from "date-fns";
import { toast } from "sonner";
import type { ExclusiveSubtopicItem } from "@/data/knowledge-tree/types-v3.2";
import { buildObjectSheet } from "./excelExport";

export interface ExportExclusiveTopicsParams {
  aName: string;
  bName: string;
  aExclusive: ExclusiveSubtopicItem[];
  bExclusive: ExclusiveSubtopicItem[];
}

/** Show export error toast */
function handleExportError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  toast.error("Excel 导出失败", {
    description: msg,
    duration: 4000,
  });
  console.error("[exportExclusiveTopics] Export failed:", err);
}

/** Build safe filename from comparison names */
function buildFilename(aName: string, bName: string, includesV5Statuses: boolean): string {
  const safe = (s: string) =>
    s.replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff]/g, "_").replace(/_+/g, "_");
  const dateStr = format(new Date(), "yyyyMMdd");
  return `${includesV5Statuses ? "考纲差异" : "独有知识点"}_${safe(aName)}_vs_${safe(bName)}_${dateStr}.xlsx`;
}

const comparisonStatusLabels = {
  shared: "共享",
  partial: "部分重合",
  exclusive: "确定独有",
  unresolved: "待核验",
  "non-comparable": "不参与比较",
} as const;

function comparisonStatus(item: ExclusiveSubtopicItem) {
  return item.comparisonStatus ?? "exclusive";
}

export function buildComparisonSummaryRows(params: ExportExclusiveTopicsParams) {
  const { aName, bName, aExclusive, bExclusive } = params;
  const includesV5Statuses = [...aExclusive, ...bExclusive].some((item) => item.comparisonStatus);
  const rows: Array<{ 项目: string; 内容: string | number }> = [
    { 项目: "标题", 内容: includesV5Statuses ? "ExamBridge 考纲陈述差异导出" : "ExamBridge 独有知识点导出" },
    { 项目: "对比对象 A", 内容: aName },
    { 项目: "对比对象 B", 内容: bName },
  ];
  for (const [status, label] of Object.entries(comparisonStatusLabels)) {
    const countA = aExclusive.filter((item) => comparisonStatus(item) === status).length;
    const countB = bExclusive.filter((item) => comparisonStatus(item) === status).length;
    if (countA || countB || (includesV5Statuses && status !== "shared")) {
      rows.push({ 项目: `A ${label}数量`, 内容: countA }, { 项目: `B ${label}数量`, 内容: countB });
    }
  }
  rows.push(
    { 项目: "导出时间", 内容: format(new Date(), "yyyy-MM-dd HH:mm:ss") },
    { 项目: "说明", 内容: includesV5Statuses
      ? "网页与 Excel 使用同一份 V5 view model；每行保留完整原子考纲 statement、来源定位和比较状态。"
      : "当前导出来自旧版知识映射，仅包含旧版独有项。" },
  );
  return rows;
}

/** Sort items by paperRef → topicName → subtopicId */
function sortItems(items: ExclusiveSubtopicItem[]): ExclusiveSubtopicItem[] {
  return [...items].sort((a, b) => {
    const pa = a.paperRef ? a.paperRef.join(",") : "整科";
    const pb = b.paperRef ? b.paperRef.join(",") : "整科";
    if (pa !== pb) return pa.localeCompare(pb);
    if (a.topicName !== b.topicName) return a.topicName.localeCompare(b.topicName);
    return a.subtopicId.localeCompare(b.subtopicId);
  });
}

/** Format paperRef for display */
function fmtPaperRef(ref: string[] | null): string {
  return ref ? ref.join(", ") : "整科";
}

/** Build data rows for A/B exclusive sheet */
export function buildExclusiveTopicExportRows(
  items: ExclusiveSubtopicItem[],
  subjectName: string
): Record<string, string | number>[] {
  const sorted = sortItems(items);
  return sorted.map((item, idx) => ({
    序号: idx + 1,
    "考纲 / Paper": subjectName,
    Topic: item.topicName,
    "Paper Reference": fmtPaperRef(item.paperRef),
    "Subtopic ID": item.subtopicId,
    考纲原文: item.subtopicName,
    补充说明: item.description ?? "",
    状态: comparisonStatusLabels[comparisonStatus(item)],
    "Syllabus Version": item.syllabusVersion ?? "",
    "Section ID": item.sectionId ?? item.subtopicId,
    "Printed Page": item.printedPage ?? "",
    "PDF Page": item.pdfPage ?? "",
    "Source Ref": item.sourceLocator ?? item.sourceUrl ?? "",
    "Decision Reason": item.decisionReason ?? "",
    "Canonical Concepts": item.conceptLabels?.join("; ") ?? "",
    Notes: item.notesText?.join("\n") ?? "",
    Examples: item.examplesText?.join("\n") ?? "",
  }));
}

/** Build rows for All Unique sheet */
function buildAllRows(
  aItems: ExclusiveSubtopicItem[],
  bItems: ExclusiveSubtopicItem[],
  aName: string,
  bName: string
): Record<string, string | number>[] {
  const aRows = sortItems(aItems).map((item, idx) => ({
    Side: "A",
    序号: idx + 1,
    "考纲 / Paper": aName,
    Topic: item.topicName,
    "Paper Reference": fmtPaperRef(item.paperRef),
    "Subtopic ID": item.subtopicId,
    考纲原文: item.subtopicName,
    补充说明: item.description ?? "",
    状态: comparisonStatusLabels[comparisonStatus(item)],
    "Syllabus Version": item.syllabusVersion ?? "",
    "Section ID": item.sectionId ?? item.subtopicId,
    "Printed Page": item.printedPage ?? "",
    "PDF Page": item.pdfPage ?? "",
    "Source Ref": item.sourceLocator ?? item.sourceUrl ?? "",
    "Decision Reason": item.decisionReason ?? "",
    "Canonical Concepts": item.conceptLabels?.join("; ") ?? "",
    Notes: item.notesText?.join("\n") ?? "",
    Examples: item.examplesText?.join("\n") ?? "",
  }));
  const bRows = sortItems(bItems).map((item, idx) => ({
    Side: "B",
    序号: idx + 1,
    "考纲 / Paper": bName,
    Topic: item.topicName,
    "Paper Reference": fmtPaperRef(item.paperRef),
    "Subtopic ID": item.subtopicId,
    考纲原文: item.subtopicName,
    补充说明: item.description ?? "",
    状态: comparisonStatusLabels[comparisonStatus(item)],
    "Syllabus Version": item.syllabusVersion ?? "",
    "Section ID": item.sectionId ?? item.subtopicId,
    "Printed Page": item.printedPage ?? "",
    "PDF Page": item.pdfPage ?? "",
    "Source Ref": item.sourceLocator ?? item.sourceUrl ?? "",
    "Decision Reason": item.decisionReason ?? "",
    "Canonical Concepts": item.conceptLabels?.join("; ") ?? "",
    Notes: item.notesText?.join("\n") ?? "",
    Examples: item.examplesText?.join("\n") ?? "",
  }));
  return [...aRows, ...bRows];
}

/** Main export function */
export function exportExclusiveTopicsToExcel(params: ExportExclusiveTopicsParams): void {
  import("write-excel-file/browser")
    .then(async ({ default: writeExcelFile }) => {
      const { aName, bName, aExclusive, bExclusive } = params;
      const includesV5Statuses = [...aExclusive, ...bExclusive].some((item) => item.comparisonStatus);

      if (aExclusive.length === 0 && bExclusive.length === 0) {
        toast.info("没有考纲差异可导出");
        return;
      }

      // ── Sheet 1: Summary ──
      const summaryRows = buildComparisonSummaryRows(params);
      // ── Sheet 2: A statements ──
      const aRows = buildExclusiveTopicExportRows(aExclusive, aName);

      // ── Sheet 3: B statements ──
      const bRows = buildExclusiveTopicExportRows(bExclusive, bName);

      // ── Sheet 4: all differences ──
      const allRows = buildAllRows(aExclusive, bExclusive, aName, bName);
      // Write file
      const filename = buildFilename(aName, bName, includesV5Statuses);
      await writeExcelFile([
        buildObjectSheet("Summary", summaryRows, [16, 80]),
        buildObjectSheet(includesV5Statuses ? "A 考纲陈述" : "A 独有", aRows, [6, 24, 28, 14, 18, 80, 32, 14, 18, 18, 14, 12, 44, 44, 40, 32, 32]),
        buildObjectSheet(includesV5Statuses ? "B 考纲陈述" : "B 独有", bRows, [6, 24, 28, 14, 18, 80, 32, 14, 18, 18, 14, 12, 44, 44, 40, 32, 32]),
        buildObjectSheet(includesV5Statuses ? "全部差异" : "All Unique", allRows, [10, 6, 24, 28, 14, 18, 80, 32, 14, 18, 18, 14, 12, 44, 44, 40, 32, 32]),
      ]).toFile(filename);

      toast.success("Excel 导出成功", {
        description: filename,
        duration: 3000,
      });
    })
    .catch(err => handleExportError(err));
}
