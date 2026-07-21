import { describe, expect, it } from "vitest";
import candidate from "../data/candidates/academic-results-v2/migration-candidate.json";
import report from "../generated/academic-results-v2/migration-report.json";
import pearsonReview from "../data/candidates/academic-results-v2/pearson-8ma0-statistics-review.json";
import pearsonReviewUsage from "../generated/academic-results-v2/pearson-8ma0-statistics-review-usage.json";
import ocr2019Review from "../data/candidates/academic-results-v2/ocr-2019-statistics-review.json";
import ocr2019ReviewUsage from "../generated/academic-results-v2/ocr-2019-statistics-review-usage.json";
import {
  GradeBoundaryV2Schema,
  GradeStatisticsV2Schema,
  QualificationAwardRuleV2Schema,
  SourceEvidenceV1Schema,
} from "../src/domain-v2/academic-results";

const statisticsProvenance = candidate.statisticsProvenance as Record<string, { migrationOrigin: string }>;

describe("Academic Results V2 migration candidate", () => {
  it("keeps every migrated record schema-valid", () => {
    candidate.sources.forEach(row => expect(SourceEvidenceV1Schema.safeParse(row).success).toBe(true));
    candidate.boundaries.forEach(row => expect(GradeBoundaryV2Schema.safeParse(row).success).toBe(true));
    candidate.statistics.forEach(row => {
      expect(statisticsProvenance[row.statisticsId]?.migrationOrigin).toBeTruthy();
      expect(GradeStatisticsV2Schema.safeParse(row).success).toBe(true);
    });
    candidate.awardRules.forEach(row => expect(QualificationAwardRuleV2Schema.safeParse(row).success).toBe(true));
  });

  it("has no unresolved in-scope statistics conflicts and never selects an unresolved variant", () => {
    expect(candidate.statisticsConflicts.length).toBe(report.statisticsConflictCount);
    expect(candidate.statisticsConflicts).toHaveLength(0);
  });

  it("keeps AQA local and pending exact row-level source verification", () => {
    const aqa = candidate.statistics.filter(row => row.awardQualificationId.startsWith("award:aqa:"));
    expect(aqa.length).toBeGreaterThan(0);
    expect(aqa.every(row => statisticsProvenance[row.statisticsId]?.migrationOrigin === "official-local-aqa" && row.verificationStatus === "candidate")).toBe(true);
  });

  it("includes OCR 6993 row-level official statistics for every available in-scope year", () => {
    const rows = candidate.statistics.filter(row => row.awardQualificationId === "award:ocr:6993");
    expect(rows.map(row => row.year)).toEqual([2019, 2021, 2022, 2023, 2024, 2025]);
    expect(rows.every(row => row.verificationStatus === "codex-reviewed" && row.sourceIds.length === 1)).toBe(true);
    expect(rows.find(row => row.year === 2019)).toMatchObject({
      candidateCount: 7889,
      gradeOrder: ["A", "B", "C", "D", "E"],
      gradeRates: { A: 45.86, B: 60.86, C: 73.46, D: 81.95, E: 88.16 },
    });
  });

  it("adds OCR 2019 statistics for all four scoped routes with independent review provenance", () => {
    const rows = candidate.statistics.filter(row =>
      row.year === 2019 && ["award:ocr:h240", "award:ocr:h245", "award:ocr:h640", "award:ocr:6993"].includes(row.awardQualificationId));
    expect(rows).toHaveLength(4);
    expect(rows.every(row => row.verificationStatus === "codex-reviewed" && row.sourceIds.length === 1)).toBe(true);
    expect(rows.find(row => row.awardQualificationId === "award:ocr:h245")).toMatchObject({
      candidateCount: 1415,
      gradeRates: { "A*": 31.52, A: 61.34, B: 79.79, C: 91.38, D: 96.89, E: 99.01 },
    });
    expect(ocr2019Review).toMatchObject({ reviewStatus: "machine-reviewed", provider: "deepseek", verdict: "pass" });
    expect(ocr2019ReviewUsage.usage).toHaveLength(1);
    expect(ocr2019ReviewUsage.usage[0]).toMatchObject({ status: "success", returnedModel: "deepseek-v4-pro", totalTokens: 2938 });
  });

  it("resolves the four Pearson IAL conflicts against exact official rows", () => {
    const rows = candidate.statistics.filter(row =>
      ["award:pearson:ial-mathematics", "award:pearson:ial-further-mathematics"].includes(row.awardQualificationId)
      && ((row.year === 2025 && row.series === "june") || (row.year === 2026 && row.series === "january")),
    );
    expect(rows).toHaveLength(4);
    expect(rows.every(row => row.verificationStatus === "codex-reviewed" && row.sourceIds.length === 1)).toBe(true);
    expect(rows.find(row => row.awardQualificationId.endsWith("ial-mathematics") && row.year === 2025)?.gradeRates).toEqual({
      "A*": 32.7, A: 53.2, B: 71.1, C: 82.7, D: 90.3, E: 94.9,
    });
    expect(rows.find(row => row.awardQualificationId.endsWith("ial-further-mathematics") && row.year === 2026)?.gradeRates).toEqual({
      "A*": 47.7, A: 69.2, B: 81.3, C: 88.2, D: 92.9, E: 96.1,
    });
  });

  it("uses row-level Pearson 8MA0 evidence and never treats zero as a missing A-star grade", () => {
    const rows = candidate.statistics.filter(row => row.awardQualificationId === "award:pearson:8ma0");
    const reviewed = rows.filter(row => row.verificationStatus === "codex-reviewed");
    expect(reviewed.map(row => row.year)).toEqual([2019, 2022, 2023, 2024]);
    expect(reviewed.every(row => row.sourceIds.length === 1 && row.rateKind === "cumulative")).toBe(true);
    expect(reviewed.find(row => row.year === 2019)).toMatchObject({
      candidateCount: 9878,
      gradeRates: { A: 24.7, B: 37.2, C: 51.2, D: 65.9, E: 79.3 },
    });
    expect(rows.every(row => !row.gradeOrder.includes("A*") && !Object.hasOwn(row.gradeRates, "A*"))).toBe(true);
  });

  it("keeps the 8MA0 machine review candidate-only with complete retry usage", () => {
    expect(pearsonReview).toMatchObject({
      reviewStatus: "machine-reviewed",
      provider: "deepseek",
      requestedModel: "deepseek-v4-pro",
      returnedModel: "deepseek-v4-pro",
    });
    expect(pearsonReview.codexAdjudication.acceptedYears).toEqual([2019, 2022, 2023, 2024]);
    expect(pearsonReviewUsage.usage.map(entry => entry.status)).toEqual(["invalid-json", "invalid-json", "success"]);
    expect(pearsonReviewUsage.usage.every(entry => entry.provider === "deepseek" && entry.returnedModel === "deepseek-v4-pro")).toBe(true);
    expect(pearsonReviewUsage.totals.totalTokens).toBe(14213);
  });

  it("preserves raw values whenever normalization occurred", () => {
    const normalized = candidate.statistics.filter(row => row.normalization);
    for (const row of normalized) {
      expect(row.rawGradeRates).toBeDefined();
      expect(row.normalization?.reason).not.toBe("");
    }
  });

  it("covers all 13 approved qualifications without activating any candidate rule", () => {
    expect(candidate.awardRules).toHaveLength(34);
    expect(new Set(candidate.awardRules.map(row => row.awardQualificationId)).size).toBe(13);
    expect(candidate.awardRules.every(row => row.verificationStatus !== "owner-approved")).toBe(true);
  });
});
