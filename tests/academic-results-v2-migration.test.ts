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

  it("rebuilds the complete official 0580 statistics series without legacy sentinel values", () => {
    const rows = candidate.statistics.filter(row => row.awardQualificationId === "award:caie:0580");
    expect(rows).toHaveLength(17);
    const seriesOrder: Record<string, number> = { march: 0, june: 1, november: 2 };
    expect(rows
      .map(row => ({ year: row.year, series: row.series }))
      .sort((left, right) => left.year - right.year || seriesOrder[left.series] - seriesOrder[right.series])
      .map(row => `${row.year}-${row.series}`)).toEqual([
      "2019-june",
      "2021-march", "2021-june", "2021-november",
      "2022-march", "2022-june", "2022-november",
      "2023-march", "2023-june", "2023-november",
      "2024-march", "2024-june", "2024-november",
      "2025-march", "2025-june", "2025-november",
      "2026-march",
    ]);
    expect(rows.every(row => row.verificationStatus === "codex-reviewed"
      && row.publicationStatus === "final"
      && row.rateKind === "cumulative"
      && row.sourceIds.length === 1)).toBe(true);
    expect(rows.every(row => JSON.stringify(row.gradeRates).includes("99.9") === false)).toBe(true);
    expect(rows.every(row => row.gradeOrder.join(",") === "A*,A,B,C,D,E,F,G")).toBe(true);

    expect(rows.find(row => row.year === 2019 && row.series === "june")).toMatchObject({
      qualificationVersionId: "CAIE-0580:2019",
      gradeRates: { "A*": 18.4, A: 36, B: 53.6, C: 73.5, D: 83.1, E: 90.1, F: 92.1, G: 93.5 },
    });
    expect(rows.find(row => row.year === 2021 && row.series === "june")).toMatchObject({
      qualificationVersionId: "CAIE-0580:2020-2022",
      gradeRates: { "A*": 27.8, A: 44.3, B: 58.5, C: 80, D: 88.1, E: 94, F: 95.8, G: 97 },
    });
    expect(rows.find(row => row.year === 2025 && row.series === "june")).toMatchObject({
      qualificationVersionId: "CAIE-0580:2025-2027",
      gradeRates: { "A*": 19.8, A: 34.1, B: 50, C: 70.9, D: 80.3, E: 87.8, F: 90.3, G: 92.1 },
    });

    const sourceIds = rows.flatMap(row => row.sourceIds);
    const sources = candidate.sources.filter(source => sourceIds.includes(source.sourceId));
    expect(sources).toHaveLength(17);
    expect(sources.every(source => source.officialUrl.startsWith("https://www.cambridgeinternational.org/Images/")
      && [1, 2].includes(source.printedPage ?? 0)
      && source.printedPage === source.pdfPage
      && source.sourceRowId?.includes("0580"))).toBe(true);
    expect(sources.filter(source => /^[a-f0-9]{64}$/.test(source.sourceDocumentHash ?? ""))).toHaveLength(16);
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
    expect(candidate.awardRules).toHaveLength(40);
    expect(new Set(candidate.awardRules.map(row => row.awardQualificationId)).size).toBe(13);
    expect(candidate.awardRules.every(row => row.verificationStatus !== "owner-approved")).toBe(true);
  });
});
