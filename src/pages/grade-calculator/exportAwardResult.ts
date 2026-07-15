import type { AwardCalculationResult } from "@/domain-v2/awards/schema";
import { downloadCSV } from "@/utils/csvExport";
import { buildObjectSheet } from "@/utils/excelExport";

export type AwardExportRow = Record<string, string | number>;

export function buildAwardExportRows(result: AwardCalculationResult): AwardExportRow[] {
  return [{
    结果类型: result.source === "estimated" ? "非官方预估等级" : "官方整体边界 · 已核验",
    资格路线: result.routeId,
    考季: result.series,
    "Option code": result.optionCode ?? "",
    总分: result.total,
    满分: result.maximumMarkAfterWeighting,
    等级: result.grade,
    合理范围: result.gradeRange?.join("–") ?? "",
    置信度: result.confidence ?? "",
    样本考季: result.sampleSeries?.join("、") ?? "",
    算法版本: result.methodVersion ?? "",
    警告: result.warning ?? "",
    来源: result.sourceUrls.join("\n"),
  }];
}

const safeFilenamePart = (value: string) => value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 80);

export function awardExportFilename(result: AwardCalculationResult, extension: "csv" | "xlsx"): string {
  const source = result.source === "estimated" ? "非官方预估" : "官方";
  return `ExamBridge_${source}_${safeFilenamePart(result.routeId)}_${result.series}.${extension}`;
}

export function exportAwardCsv(result: AwardCalculationResult): void {
  downloadCSV(buildAwardExportRows(result), awardExportFilename(result, "csv"));
}

export async function exportAwardExcel(result: AwardCalculationResult): Promise<void> {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  await writeExcelFile([buildObjectSheet("等级结果", buildAwardExportRows(result), [20, 42, 16, 16, 12, 12, 12, 18, 12, 38, 34, 60, 80])])
    .toFile(awardExportFilename(result, "xlsx"));
}
