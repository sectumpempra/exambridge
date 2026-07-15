import { describe, expect, it } from "vitest";
import { checkAStar } from "@/domain-v2/calculator/astar-checker";
import { mapGrade } from "@/domain-v2/calculator/grade-mapper";
import { validateRoute } from "@/domain-v2/calculator/route-validator";
import type { AStarPolicy, AssessmentUnit, AwardRoute, GradePolicy, GradingScale } from "@/domain-v2/catalog/schema";
import type { PaperCalculationResult } from "@/domain-v2/calculator/types";

const unitMap = new Map<string, AssessmentUnit>([
  ["u1", { id: "unit:u1", specificationId: "spec:test", code: "P3", aliases: ["P3"], name: "P3", paperIds: [], status: "verified", sources: [] }],
  ["u2", { id: "unit:u2", specificationId: "spec:test", code: "P4", aliases: [], name: "P4", paperIds: [], status: "verified", sources: [] }],
]);

const papers = (a: number, b: number): PaperCalculationResult[] => [
  { unitId: "u1", rawScore: a, maxMark: 100, normalizedScore: a, normalizedMax: 100, scoreType: "UMS", grade: "A" },
  { unitId: "u2", rawScore: b, maxMark: 100, normalizedScore: b, normalizedMax: 100, scoreType: "UMS", grade: "A" },
];

function astar(conditions: AStarPolicy["conditions"]): AStarPolicy {
  return { id: "astar:test", name: "test", conditions, sources: [] };
}

describe("A* policy branch coverage", () => {
  it("rejects a non-A grade before evaluating conditions", () => {
    const result = checkAStar({ policy: astar([{ kind: "TOTAL_MIN", minTotal: 160 }]), paperResults: papers(90, 90), totalUMS: 180, maxUMS: 200, currentGrade: "B", unitMap });
    expect(result.eligible).toBe(false);
    expect(result.totalThreshold).toBe(0);
  });

  it("evaluates passing total, A2 average, pair and unit requirements", () => {
    const result = checkAStar({
      policy: astar([
        { kind: "TOTAL_MIN", minTotal: 160 },
        { kind: "A2_AVERAGE_MIN", minAverage: 0.85, unitIds: ["u1", "u2"] },
        { kind: "UNIT_PAIR_MIN", minSum: 170, unitIds: ["u1", "u2"] },
        { kind: "UNIT_MIN", minScore: 80, unitId: "u1" },
      ]),
      paperResults: papers(90, 85), totalUMS: 175, maxUMS: 200, currentGrade: "A", unitMap,
    });
    expect(result.eligible).toBe(true);
    expect(result.details.at(-1)).toContain("全部满足");
  });

  it("reports every unmet condition including empty A2 sets and unknown units", () => {
    const result = checkAStar({
      policy: astar([
        { kind: "TOTAL_MIN", minTotal: 190 },
        { kind: "A2_AVERAGE_MIN", minAverage: 0.9, unitIds: ["missing"] },
        { kind: "UNIT_PAIR_MIN", minSum: 190, unitIds: ["u1", "missing"] },
        { kind: "UNIT_MIN", minScore: 95, unitId: "missing" },
      ]),
      paperResults: papers(80, 80), totalUMS: 160, maxUMS: 200, currentGrade: "A*", unitMap,
    });
    expect(result.eligible).toBe(false);
    expect(result.totalMet).toBe(false);
    expect(result.a2Met).toBe(false);
    expect(result.details.at(-1)).toContain("未全部满足");
  });

  it("fails closed for an unknown runtime condition", () => {
    const policy = astar([{ kind: "TOTAL_MIN", minTotal: 1 }]);
    policy.conditions = [{ kind: "UNKNOWN" } as never];
    const result = checkAStar({ policy, paperResults: [], totalUMS: 0, maxUMS: 0, currentGrade: "A", unitMap });
    expect(result.details[0]).toContain("未知条件类型");
  });
});

describe("grade mapper branch coverage", () => {
  const scale: GradingScale = {
    id: "scale:test", name: "test", kind: "A_STAR_TO_E", hasAStar: true, sources: [],
    thresholds: [{ grade: "A*", minMark: 90 }, { grade: "A", minMark: 80 }, { grade: "B", minMark: 70 }, { grade: "C", minMark: 60 }, { grade: "U", minMark: 0 }],
  };
  const policy: GradePolicy = { id: "grade:test", name: "test", gradingScaleId: scale.id, sources: [] };

  it("uses default thresholds and omits next grade for the highest ordinary grade", () => {
    expect(mapGrade({ totalScore: 80, maxScore: 100, gradePolicy: policy, gradingScale: scale })).toMatchObject({ grade: "A", nextGrade: undefined });
  });

  it("uses overrides, records the next grade and returns U below all classified grades", () => {
    const overridden = { ...policy, gradeThresholds: { A: 0.9, B: 0.8, C: 0.7 } };
    expect(mapGrade({ totalScore: 75, maxScore: 100, gradePolicy: overridden, gradingScale: scale })).toMatchObject({ grade: "C", nextGrade: { grade: "A", gap: 15 } });
    expect(mapGrade({ totalScore: 10, maxScore: 0, gradePolicy: overridden, gradingScale: scale }).grade).toBe("U");
  });
});

describe("selection rule branch coverage", () => {
  function route(selectionRules: AwardRoute["selectionRules"]): AwardRoute {
    return { id: "route:test", specificationId: "spec:test", name: "test", awardType: "FULL", selectionRules, aggregationPolicyId: "agg:test", gradePolicyId: "grade:test", status: "verified", sources: [] };
  }

  it("covers at-least, group extras, duplicate and too-many count failures", () => {
    const result = validateRoute({
      route: route([
        { kind: "AT_LEAST_N_FROM", count: 2, unitIds: ["u1", "u2", "u3"] },
        { kind: "ONE_OF_GROUPS", groups: [["u1"], ["u2"]] },
        { kind: "TOTAL_UNIT_COUNT", count: 2 },
        { kind: "NO_DUPLICATES" },
      ]),
      selectedUnitIds: ["u1", "u1", "extra"], unitMap,
    });
    expect(result.valid).toBe(false);
    expect(result.extraUnits).toContain("extra");
    expect(result.explanation.some((message) => message.includes("重复"))).toBe(true);
    expect(result.explanation.some((message) => message.includes("多选"))).toBe(true);
  });

  it("passes at-least and group rules and falls back to IDs for unknown units", () => {
    const result = validateRoute({
      route: route([{ kind: "AT_LEAST_N_FROM", count: 1, unitIds: ["u1", "unknown"] }, { kind: "ONE_OF_GROUPS", groups: [["u1"], ["u2", "unknown"]] }]),
      selectedUnitIds: ["u1", "unknown"], unitMap,
    });
    expect(result.valid).toBe(true);
  });
});
