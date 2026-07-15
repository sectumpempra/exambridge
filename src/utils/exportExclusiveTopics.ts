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
function buildFilename(aName: string, bName: string): string {
  const safe = (s: string) =>
    s.replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff]/g, "_").replace(/_+/g, "_");
  const dateStr = format(new Date(), "yyyyMMdd");
  return `独有知识点_${safe(aName)}_vs_${safe(bName)}_${dateStr}.xlsx`;
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
function buildDataRows(
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
    "Source Ref": "-",
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
    Side: "A 独有",
    序号: idx + 1,
    "考纲 / Paper": aName,
    Topic: item.topicName,
    "Paper Reference": fmtPaperRef(item.paperRef),
    "Subtopic ID": item.subtopicId,
    考纲原文: item.subtopicName,
    补充说明: item.description ?? "",
    "Source Ref": "-",
  }));
  const bRows = sortItems(bItems).map((item, idx) => ({
    Side: "B 独有",
    序号: idx + 1,
    "考纲 / Paper": bName,
    Topic: item.topicName,
    "Paper Reference": fmtPaperRef(item.paperRef),
    "Subtopic ID": item.subtopicId,
    考纲原文: item.subtopicName,
    补充说明: item.description ?? "",
    "Source Ref": "-",
  }));
  return [...aRows, ...bRows];
}

/** Main export function */
export function exportExclusiveTopicsToExcel(params: ExportExclusiveTopicsParams): void {
  import("write-excel-file/browser")
    .then(async ({ default: writeExcelFile }) => {
      const { aName, bName, aExclusive, bExclusive } = params;

      if (aExclusive.length === 0 && bExclusive.length === 0) {
        toast.info("没有独有知识点可导出");
        return;
      }

      // ── Sheet 1: Summary ──
      const summaryRows = [
        { 项目: "标题", 内容: "ExamBridge 独有知识点导出" },
        { 项目: "对比对象 A", 内容: aName },
        { 项目: "对比对象 B", 内容: bName },
        { 项目: "A 独有数量", 内容: aExclusive.length },
        { 项目: "B 独有数量", 内容: bExclusive.length },
        { 项目: "导出时间", 内容: format(new Date(), "yyyy-MM-dd HH:mm:ss") },
        { 项目: "说明", 内容: "独有知识点基于知识树节点交集识别，导出文本为考纲 statement 原文或最接近原文的 statement 字段。" },
      ];
      // ── Sheet 2: A 独有 ──
      const aRows = buildDataRows(aExclusive, aName);

      // ── Sheet 3: B 独有 ──
      const bRows = buildDataRows(bExclusive, bName);

      // ── Sheet 4: All Unique ──
      const allRows = buildAllRows(aExclusive, bExclusive, aName, bName);
      // Write file
      const filename = buildFilename(aName, bName);
      await writeExcelFile([
        buildObjectSheet("Summary", summaryRows, [16, 80]),
        buildObjectSheet("A 独有", aRows, [6, 24, 28, 14, 18, 80, 40, 12]),
        buildObjectSheet("B 独有", bRows, [6, 24, 28, 14, 18, 80, 40, 12]),
        buildObjectSheet("All Unique", allRows, [10, 6, 24, 28, 14, 18, 80, 40, 12]),
      ]).toFile(filename);

      toast.success("Excel 导出成功", {
        description: filename,
        duration: 3000,
      });
    })
    .catch(err => handleExportError(err));
}
