export const MASTERY_VALUES = {
  "not-studied": 0,
  weak: 1 / 3,
  basic: 2 / 3,
  proficient: 1,
} as const;

export type ReadinessRequirement = {
  nodeId: string;
  criticality: number;
  targetDepth: "knowledge" | "application" | "reasoning" | "proof";
  prerequisiteNodeIds: string[];
  statements: Array<{
    statementId: string;
    statementText: string;
    sourceLocator: string;
    paperIds: string[];
  }>;
};

export type ReadinessResult = {
  courseTransitionDifficulty: number;
  masteryGapScore: number;
  personalDifficulty: number;
  satisfiedNodeIds: string[];
  gapNodeIds: string[];
  orderedGaps: Array<ReadinessRequirement & { mastery: keyof typeof MASTERY_VALUES; gap: number; riskReason: string }>;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

const topologicalGapOrder = (requirements: ReadinessRequirement[], gaps: Set<string>) => {
  const byId = new Map(requirements.map(item => [item.nodeId, item]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: ReadinessRequirement[] = [];
  const visit = (nodeId: string) => {
    if (visited.has(nodeId) || !gaps.has(nodeId)) return;
    if (visiting.has(nodeId)) return;
    visiting.add(nodeId);
    for (const dependency of byId.get(nodeId)?.prerequisiteNodeIds ?? []) visit(dependency);
    visiting.delete(nodeId);
    visited.add(nodeId);
    const requirement = byId.get(nodeId);
    if (requirement) ordered.push(requirement);
  };
  [...gaps].sort().forEach(visit);
  return ordered;
};

export function evaluateStudentReadiness(input: {
  courseTransitionDifficulty: number;
  requirements: ReadinessRequirement[];
  mastery: Record<string, keyof typeof MASTERY_VALUES>;
}): ReadinessResult {
  if (!Number.isFinite(input.courseTransitionDifficulty) || input.courseTransitionDifficulty < 0 || input.courseTransitionDifficulty > 100) {
    throw new Error("INVALID_COURSE_DIFFICULTY");
  }
  const nodeIds = input.requirements.map(item => item.nodeId);
  if (new Set(nodeIds).size !== nodeIds.length) throw new Error("DUPLICATE_REQUIREMENT_NODE");
  if (input.requirements.some(item => !Number.isFinite(item.criticality) || item.criticality <= 0)) throw new Error("INVALID_CRITICALITY");

  const totalWeight = input.requirements.reduce((sum, item) => sum + item.criticality, 0);
  const gaps = new Map(input.requirements.map(item => {
    const mastery = input.mastery[item.nodeId] ?? "not-studied";
    return [item.nodeId, { mastery, gap: 1 - MASTERY_VALUES[mastery] }];
  }));
  const masteryGapScore = totalWeight
    ? 100 * input.requirements.reduce((sum, item) => sum + item.criticality * gaps.get(item.nodeId)!.gap, 0) / totalWeight
    : 0;
  const gapNodeIds = new Set([...gaps].filter(([, value]) => value.gap > 0).map(([nodeId]) => nodeId));
  const ordered = topologicalGapOrder(input.requirements, gapNodeIds).map(requirement => {
    const value = gaps.get(requirement.nodeId)!;
    return {
      ...requirement,
      ...value,
      riskReason: value.mastery === "not-studied"
        ? "This prerequisite has not been studied."
        : `Current mastery is ${value.mastery}; the target requires ${requirement.targetDepth}.`,
    };
  });
  return {
    courseTransitionDifficulty: input.courseTransitionDifficulty,
    masteryGapScore: clamp(masteryGapScore),
    personalDifficulty: clamp(0.65 * input.courseTransitionDifficulty + 0.35 * masteryGapScore),
    satisfiedNodeIds: nodeIds.filter(nodeId => !gapNodeIds.has(nodeId)).sort(),
    gapNodeIds: [...gapNodeIds].sort(),
    orderedGaps: ordered,
  };
}
