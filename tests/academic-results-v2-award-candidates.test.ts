import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GradeBoundaryV2Schema,
  GradeStatisticsV2Schema,
  QualificationAwardRuleV2Schema,
  SourceEvidenceV1Schema,
  calculateBestQualificationAwardV2,
  calculateQualificationAwardV2,
  type QualificationAwardRuleV2,
} from "@/domain-v2/academic-results";

const candidate = JSON.parse(readFileSync("data/candidates/academic-results-v2/migration-candidate.json", "utf8"));
const rules: QualificationAwardRuleV2[] = candidate.awardRules.map((rule: unknown) => QualificationAwardRuleV2Schema.parse(rule));
const reviewUsage = JSON.parse(readFileSync("generated/academic-results-v2/deepseek-award-rule-review-usage.json", "utf8")).usage;

describe("official award-rule candidates", () => {
  it("validates every migrated row and covers all 13 approved qualifications", () => {
    expect(candidate.sources.every((source: unknown) => SourceEvidenceV1Schema.safeParse(source).success)).toBe(true);
    expect(candidate.boundaries.every((boundary: unknown) => GradeBoundaryV2Schema.safeParse(boundary).success)).toBe(true);
    expect(candidate.statistics.every((row: unknown) => GradeStatisticsV2Schema.safeParse(row).success)).toBe(true);
    expect(new Set(rules.map(rule => rule.awardQualificationId)).size).toBe(13);
    expect(rules).toHaveLength(26);
    expect(rules.every(rule => rule.verificationStatus !== "owner-approved")).toBe(true);
  });

  it("keeps AQA out of external review and records the requested DeepSeek provider and model", () => {
    expect(reviewUsage.length).toBeGreaterThan(0);
    expect(reviewUsage.every((entry: { provider: string }) => entry.provider === "deepseek")).toBe(true);
    expect(reviewUsage.every((entry: { returnedModel?: string }) => entry.returnedModel === "deepseek-v4-pro")).toBe(true);
    expect(reviewUsage.some((entry: { label: string }) => entry.label.toLowerCase().includes("aqa"))).toBe(false);
  });

  it("migrates option-specific AQA 7367 and OCR H245 overall boundaries without aggregating component thresholds", () => {
    const aqaFurther = candidate.boundaries.filter((row: { awardQualificationId: string }) => row.awardQualificationId === "award:aqa:7367");
    const ocrFurther = candidate.boundaries.filter((row: { awardQualificationId: string }) => row.awardQualificationId === "award:ocr:h245");
    expect(aqaFurther).toHaveLength(21);
    expect(new Set(aqaFurther.map((row: { optionCode: string }) => row.optionCode))).toEqual(new Set(["DS", "MD", "SM"]));
    expect(aqaFurther.every((row: { boundaryScope: string; maximumMark: number; verificationStatus: string }) => row.boundaryScope === "overall" && row.maximumMark === 300 && row.verificationStatus === "codex-reviewed")).toBe(true);
    expect(ocrFurther).toHaveLength(6);
    expect(ocrFurther.every((row: { boundaryScope: string; maximumMark: number }) => row.boundaryScope === "overall" && row.maximumMark === 300)).toBe(true);
    expect(candidate.boundaries.find((row: { awardQualificationId: string }) => row.awardQualificationId === "award:ocr:h640")).toMatchObject({
      year: 2025,
      series: "june",
      maximumMark: 275,
      thresholds: { "A*": 226, A: 190, B: 159, C: 128, D: 97, E: 66 },
    });
  });

  it("uses the legacy 9231 two-paper award only in 2019 and versioned modern rules afterwards", () => {
    const furtherRules = rules.filter(rule => rule.awardQualificationId === "award:caie:9231");
    expect(furtherRules).toHaveLength(10);
    expect(furtherRules.find(rule => rule.routeId === "award:caie:9231:legacy-al")).toMatchObject({
      qualificationVersionId: "CAIE-9231:2019",
      effectiveFrom: "2019-01-01",
      effectiveTo: "2019-12-31",
      totalMaximumAwardMark: 200,
    });
    for (const version of ["2020-2022", "2023-2025", "2026-2027"]) {
      const versionRules = furtherRules.filter(rule => rule.ruleId.includes(version));
      expect(versionRules).toHaveLength(3);
      expect(new Set(versionRules.map(rule => rule.routeId))).toEqual(new Set([
        "award:caie:9231:as",
        "award:caie:9231:al:same-series",
        "award:caie:9231:al:staged",
      ]));
    }
  });

  it("keeps tiered, staged, optional-paper and modular routes distinct", () => {
    const routeIds = new Set(rules.map(rule => rule.routeId));
    for (const routeId of [
      "award:caie:0580:core",
      "award:caie:0580:extended",
      "award:caie:9231:al:staged",
      "award:pearson:4ma1:foundation",
      "award:pearson:4ma1:higher",
      "award:pearson:ial-mathematics:YMA01",
      "award:pearson:ial-further-mathematics:YFM01",
      "award:aqa:7367:linear",
      "award:ocr:h245:linear",
      "award:ocr:h640:linear",
    ]) expect(routeIds.has(routeId), routeId).toBe(true);
    expect(rules.find(rule => rule.routeId === "award:ocr:h245:linear")?.validCombinations).toHaveLength(6);
    expect(rules.find(rule => rule.routeId === "award:aqa:7367:linear")?.validCombinations).toHaveLength(3);
  });

  it("marks a component optional exactly when at least one valid combination omits it", () => {
    for (const rule of rules) {
      for (const component of rule.components) {
        const includedInEveryCombination = rule.validCombinations.every(combination => combination.componentCodes.includes(component.code));
        expect(component.optional, `${rule.ruleId}/${component.code}`).toBe(!includedInEveryCombination);
      }
    }
  });

  it("applies Pearson IAL Further Mathematics best-three IA2 A-star logic", () => {
    const rule = rules.find(item => item.routeId === "award:pearson:ial-further-mathematics:YFM01")!;
    const selected = rule.validCombinations.find(item => ["FP2", "FP3", "M2", "M3"].every(code => item.componentCodes.includes(code)))!;
    const advanced = new Set(["FP2", "FP3", "M2", "M3", "S2", "S3"]);
    let advancedIndex = 0;
    const marks = Object.fromEntries(selected.componentCodes.map(code => {
      if (!advanced.has(code)) return [code, 100];
      advancedIndex += 1;
      return [code, advancedIndex <= 3 ? 90 : 10];
    }));
    const boundary = GradeBoundaryV2Schema.parse({
      schemaVersion: "2.0.0",
      boundaryId: "boundary:test:yfm01:2025-june",
      qualificationVersionId: rule.qualificationVersionId,
      awardQualificationId: rule.awardQualificationId,
      year: 2025,
      series: "june",
      routeId: rule.routeId,
      boundaryScope: "overall",
      maximumMark: 600,
      gradeOrder: ["A*", "A", "B", "C", "D", "E"],
      thresholds: { "A*": 480, A: 480, B: 420, C: 360, D: 300, E: 240 },
      publicationStatus: "final",
      sourceIds: [rule.sourceIds[0]],
      verificationStatus: "codex-reviewed",
    });
    const result = calculateQualificationAwardV2({
      ruleId: rule.ruleId,
      routeId: rule.routeId,
      targetSeries: "2025-june",
      combinationId: selected.combinationId,
      componentScores: selected.componentCodes.map(componentCode => ({ componentCode, series: "2025-june", awardMark: marks[componentCode] ?? 0 })),
    }, rule, boundary);
    expect(result).toMatchObject({ totalAwardMark: 480, grade: "A*", aStarSatisfied: true });
  });

  it("selects OCR H245 optional papers by best official grade rather than highest raw total", () => {
    const rule = rules.find(item => item.routeId === "award:ocr:h245:linear")!;
    const boundaries = rule.validCombinations.map(combination => GradeBoundaryV2Schema.parse({
      schemaVersion: "2.0.0",
      boundaryId: `boundary:test:${combination.combinationId}`,
      qualificationVersionId: rule.qualificationVersionId,
      awardQualificationId: rule.awardQualificationId,
      year: 2025,
      series: "june",
      routeId: rule.routeId,
      optionCode: combination.optionCode,
      boundaryScope: "overall",
      maximumMark: 300,
      gradeOrder: ["A*", "A", "B", "C", "D", "E"],
      thresholds: combination.optionCode === "Y542+Y543"
        ? { "A*": 240, A: 200, B: 170, C: 140, D: 110, E: 80 }
        : { "A*": 290, A: 280, B: 250, C: 200, D: 150, E: 100 },
      publicationStatus: "final",
      sourceIds: [rule.sourceIds[0]],
      verificationStatus: "codex-reviewed",
    }));
    const result = calculateBestQualificationAwardV2({
      ruleId: rule.ruleId,
      routeId: rule.routeId,
      targetSeries: "2025-june",
      componentScores: ([
        ["Y540", 60], ["Y541", 60], ["Y542", 75], ["Y543", 20], ["Y544", 70], ["Y545", 10],
      ] as const).map(([componentCode, rawMark]) => ({ componentCode, series: "2025-june", rawMark })),
    }, rule, boundaries);
    expect(result.selected).toMatchObject({ combinationId: "h245-y542-y543", totalAwardMark: 215, grade: "A" });
    expect(result.consideredCombinationIds).toHaveLength(6);
  });
});
