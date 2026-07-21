import { describe, expect, it } from "vitest";
import { calculateQualificationAwardV2, AwardCalculationErrorV2 } from "@/domain-v2/academic-results";
import type { GradeBoundaryV2, QualificationAwardRuleV2 } from "@/domain-v2/academic-results";

const rule: QualificationAwardRuleV2 = {
  schemaVersion: "2.0.0",
  ruleId: "rule:test:linear",
  qualificationVersionId: "TEST:1",
  awardQualificationId: "award:test",
  board: "TEST",
  subjectCode: "T1",
  routeId: "award:test:linear",
  routeType: "linear",
  scoringSystem: "raw",
  components: ["P1", "P2"].map(code => ({ code, inputKind: "raw", maximumRawMark: 100, maximumAwardMark: 100, weightingFactor: 1, optional: false })),
  validCombinations: [{ combinationId: "all", componentCodes: ["P1", "P2"], awardLevel: "A-Level" }],
  totalMaximumAwardMark: 200,
  gradeScale: ["A*", "A", "B", "C", "D", "E"],
  roundingRule: "none",
  resitRule: { allowed: true, selectionMethod: "complete-award-entry", notes: [] },
  aStarRule: { available: true, ruleKind: "boundary-only", notes: [] },
  effectiveFrom: "2019-01-01",
  sourceIds: ["source:rule"],
  verificationStatus: "candidate",
};

const boundary: GradeBoundaryV2 = {
  schemaVersion: "2.0.0",
  boundaryId: "boundary:test:2025-june",
  qualificationVersionId: "TEST:1",
  awardQualificationId: "award:test",
  year: 2025,
  series: "june",
  routeId: rule.routeId,
  boundaryScope: "overall",
  maximumMark: 200,
  gradeOrder: ["A*", "A", "B", "C", "D", "E"],
  thresholds: { "A*": 180, A: 160, B: 140, C: 120, D: 100, E: 80 },
  publicationStatus: "final",
  sourceIds: ["source:boundary"],
  verificationStatus: "candidate",
};

const input = {
  ruleId: rule.ruleId,
  routeId: rule.routeId,
  targetSeries: "2025-june",
  combinationId: "all",
  componentScores: [
    { componentCode: "P1", series: "2025-june", rawMark: 90 },
    { componentCode: "P2", series: "2025-june", rawMark: 85 },
  ],
};

describe("Academic Results V2 award engine", () => {
  it("calculates only from the declared combination and official boundary", () => {
    const result = calculateQualificationAwardV2(input, rule, boundary);
    expect(result).toMatchObject({ totalAwardMark: 175, grade: "A", calculationStatus: "official" });
    expect(result.sourceIds).toEqual(["source:rule", "source:boundary"]);
  });

  it("rejects cross-series input for a linear qualification", () => {
    expect(() => calculateQualificationAwardV2({
      ...input,
      componentScores: [input.componentScores[0], { ...input.componentScores[1], series: "2024-june" }],
    }, rule, boundary)).toThrowError(expect.objectContaining({ code: "CROSS_SERIES" }));
  });

  it("rejects incomplete, duplicate and out-of-range component sets", () => {
    const cases = [
      { ...input, componentScores: [input.componentScores[0]] },
      { ...input, componentScores: [input.componentScores[0], input.componentScores[0]] },
      { ...input, componentScores: [input.componentScores[0], { ...input.componentScores[1], rawMark: 101 }] },
    ];
    for (const value of cases) expect(() => calculateQualificationAwardV2(value, rule, boundary)).toThrow(AwardCalculationErrorV2);
  });

  it("supports modular UMS with a separate advanced-unit A* condition", () => {
    const modular: QualificationAwardRuleV2 = {
      ...rule,
      ruleId: "rule:test:modular",
      routeId: "award:test:modular",
      routeType: "modular",
      scoringSystem: "UMS",
      components: ["U1", "U2", "U3"].map(code => ({ code, inputKind: "ums", maximumRawMark: null, maximumAwardMark: 100, weightingFactor: 1, optional: false })),
      validCombinations: [{ combinationId: "cash-in", componentCodes: ["U1", "U2", "U3"], awardLevel: "A-Level" }],
      totalMaximumAwardMark: 300,
      aStarRule: { available: true, ruleKind: "overall-plus-advanced-units", overallMinimumAwardMark: 240, advancedUnitCodes: ["U2", "U3"], advancedUnitMinimumAwardMark: 180, notes: [] },
    };
    const modularBoundary: GradeBoundaryV2 = {
      ...boundary,
      boundaryId: "boundary:test:modular",
      routeId: modular.routeId,
      maximumMark: 300,
      thresholds: { "A*": 240, A: 240, B: 210, C: 180, D: 150, E: 120 },
    };
    const result = calculateQualificationAwardV2({
      ruleId: modular.ruleId,
      routeId: modular.routeId,
      targetSeries: "2025-june",
      combinationId: "cash-in",
      componentScores: [
        { componentCode: "U1", series: "2023-june", awardMark: 90 },
        { componentCode: "U2", series: "2024-june", awardMark: 90 },
        { componentCode: "U3", series: "2025-june", awardMark: 70 },
      ],
    }, modular, modularBoundary);
    expect(result).toMatchObject({ totalAwardMark: 250, grade: "A", aStarSatisfied: false });
  });
});
