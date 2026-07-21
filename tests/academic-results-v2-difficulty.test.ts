import { describe, expect, it } from "vitest";
import {
  buildDifficultyProfile,
  calculateAssessmentDemand,
  calculateDifficultySummary,
  calculateKnowledgeDimensions,
  evaluateStudentReadiness,
} from "@/domain-v2/academic-results";

const dimension = (score: number | null) => ({ score, evidenceCoverage: score === null ? 0 : 1, sourceIds: [], explanation: "test" });

describe("Academic Results V2 transition difficulty", () => {
  it("uses the locked missing-evidence interval without redistributing weights", () => {
    const result = calculateDifficultySummary({
      contentGap: dimension(80),
      depthUplift: dimension(60),
      assessmentDemand: dimension(null),
      questionComplexity: dimension(null),
      empiricalDemand: dimension(40),
    });
    expect(result).toEqual({ score: 60.5, interval: [43, 78], evidenceCoverage: 0.65 });
  });

  it("calculates directional leaf-concept gap and depth uplift", () => {
    const source = {
      paperIds: ["S"], sourceIds: ["source:s"],
      statements: [{ statementId: "s1", statementType: "assessable-content", reviewStatus: "owner-approved", tiers: [], paperApplicability: { kind: "eligible", papers: ["S"] }, conceptLinks: [{ nodeId: "N1", assessmentDepth: "knowledge" as const }] }],
    };
    const target = {
      paperIds: ["T"], sourceIds: ["source:t"],
      statements: [{ statementId: "t1", statementType: "assessable-content", reviewStatus: "owner-approved", tiers: [], paperApplicability: { kind: "eligible", papers: ["T"] }, conceptLinks: [{ nodeId: "N1", assessmentDepth: "reasoning" as const }, { nodeId: "N2", assessmentDepth: "application" as const }] }],
    };
    const result = calculateKnowledgeDimensions(source, target, [
      { nodeId: "N1", comparisonEligible: true, reviewStatus: "owner-approved" },
      { nodeId: "N2", comparisonEligible: true, reviewStatus: "owner-approved" },
      { nodeId: "ANCESTOR", comparisonEligible: false, reviewStatus: "owner-approved" },
    ]);
    expect(result.contentGap.score).toBe(50);
    expect(result.depthUplift.score).toBeCloseTo(83.333, 2);
    expect(result.missingNodeIds).toEqual(["N2"]);
  });

  it("builds a 0-100 profile and a five-dimensional score", () => {
    const assessment = calculateAssessmentDemand(
      { paperCount: 2, totalMinutes: 180, totalMarks: 200, nonCalculatorMarkShare: 0.5, sourceIds: ["s"] },
      { paperCount: 4, totalMinutes: 300, totalMarks: 250, nonCalculatorMarkShare: 0, sourceIds: ["t"] },
    );
    const profile = buildDifficultyProfile({
      profileId: "difficulty:test",
      sourceQualificationVersionId: "S",
      sourceRouteId: "S-R",
      targetQualificationVersionId: "T",
      targetRouteId: "T-R",
      dimensions: { contentGap: dimension(60), depthUplift: dimension(40), assessmentDemand: assessment, questionComplexity: dimension(null), empiricalDemand: dimension(null) },
    });
    expect(profile.score).toBeGreaterThanOrEqual(0);
    expect(profile.score).toBeLessThanOrEqual(100);
    expect(Object.keys(profile.dimensions)).toHaveLength(5);
  });
});

describe("Academic Results V2 personalised readiness", () => {
  const requirements = [
    { nodeId: "ALG", criticality: 2, targetDepth: "application" as const, prerequisiteNodeIds: [], statements: [] },
    { nodeId: "CALC", criticality: 3, targetDepth: "reasoning" as const, prerequisiteNodeIds: ["ALG"], statements: [] },
  ];

  it("combines course difficulty and weighted personal gaps at 65/35", () => {
    const result = evaluateStudentReadiness({ courseTransitionDifficulty: 70, requirements, mastery: { ALG: "proficient", CALC: "not-studied" } });
    expect(result.masteryGapScore).toBe(60);
    expect(result.personalDifficulty).toBe(66.5);
    expect(result.orderedGaps.map(item => item.nodeId)).toEqual(["CALC"]);
  });

  it("covers all-mastered and all-unlearned boundary cases", () => {
    expect(evaluateStudentReadiness({ courseTransitionDifficulty: 40, requirements, mastery: { ALG: "proficient", CALC: "proficient" } }).personalDifficulty).toBe(26);
    expect(evaluateStudentReadiness({ courseTransitionDifficulty: 40, requirements, mastery: {} }).personalDifficulty).toBe(61);
  });
});
