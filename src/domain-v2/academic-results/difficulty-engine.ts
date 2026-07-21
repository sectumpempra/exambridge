import {
  DifficultyProfileV1Schema,
  type DifficultyProfileV1,
} from "./schema";

export const DIFFICULTY_WEIGHTS = {
  contentGap: 0.30,
  depthUplift: 0.25,
  assessmentDemand: 0.20,
  questionComplexity: 0.15,
  empiricalDemand: 0.10,
} as const;

type DifficultyKey = keyof typeof DIFFICULTY_WEIGHTS;
type EvidenceDimension = DifficultyProfileV1["dimensions"][DifficultyKey];

export type KnowledgeConceptLink = {
  nodeId: string;
  assessmentDepth: "knowledge" | "application" | "reasoning" | "proof";
};

export type KnowledgeStatementEvidence = {
  statementId: string;
  statementType: string;
  reviewStatus: string;
  tiers: string[];
  paperApplicability: { kind: string; papers?: string[] };
  conceptLinks: KnowledgeConceptLink[];
};

export type KnowledgeRouteSelection = {
  statements: KnowledgeStatementEvidence[];
  paperIds: string[];
  tiers?: string[];
  sourceIds: string[];
};

export type OntologyNodeEvidence = {
  nodeId: string;
  comparisonEligible: boolean;
  reviewStatus: string;
};

export type AssessmentStructure = {
  paperCount: number;
  totalMinutes: number;
  totalMarks: number;
  nonCalculatorMarkShare: number;
  sourceIds: string[];
};

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const depthScore = { knowledge: 0, application: 1, reasoning: 2, proof: 3 } as const;

const statementApplies = (statement: KnowledgeStatementEvidence, selection: KnowledgeRouteSelection) => {
  if (statement.statementType !== "assessable-content" || statement.reviewStatus !== "owner-approved") return false;
  if (selection.tiers?.length && statement.tiers.length && !statement.tiers.some(tier => selection.tiers!.some(selected => selected.toLowerCase() === tier.toLowerCase()))) return false;
  const papers = statement.paperApplicability.papers ?? [];
  return papers.some(paper => selection.paperIds.includes(paper));
};

const routeConceptDepths = (selection: KnowledgeRouteSelection, eligibleNodes: ReadonlySet<string>) => {
  const depths = new Map<string, number>();
  for (const statement of selection.statements) {
    if (!statementApplies(statement, selection)) continue;
    for (const link of statement.conceptLinks) {
      if (!eligibleNodes.has(link.nodeId)) continue;
      depths.set(link.nodeId, Math.max(depths.get(link.nodeId) ?? 0, depthScore[link.assessmentDepth]));
    }
  }
  return depths;
};

export function calculateKnowledgeDimensions(
  source: KnowledgeRouteSelection,
  target: KnowledgeRouteSelection,
  ontology: OntologyNodeEvidence[],
): Pick<Record<DifficultyKey, EvidenceDimension>, "contentGap" | "depthUplift"> & {
  sourceNodeIds: string[];
  targetNodeIds: string[];
  missingNodeIds: string[];
} {
  const eligibleNodes = new Set(ontology
    .filter(node => node.comparisonEligible && node.reviewStatus === "owner-approved")
    .map(node => node.nodeId));
  const sourceDepths = routeConceptDepths(source, eligibleNodes);
  const targetDepths = routeConceptDepths(target, eligibleNodes);
  const targetNodeIds = [...targetDepths.keys()].sort();
  const sourceNodeIds = [...sourceDepths.keys()].sort();
  const missingNodeIds = targetNodeIds.filter(nodeId => !sourceDepths.has(nodeId));
  const contentGapScore = targetNodeIds.length ? 100 * missingNodeIds.length / targetNodeIds.length : 0;
  const depthDeficit = targetNodeIds.length
    ? targetNodeIds.reduce((sum, nodeId) => {
      const targetDepth = targetDepths.get(nodeId) ?? 0;
      const sourceDepth = sourceDepths.get(nodeId);
      return sum + (sourceDepth === undefined ? 1 : Math.max(0, targetDepth - sourceDepth) / 3);
    }, 0) / targetNodeIds.length
    : 0;
  const sourceIds = [...new Set([...source.sourceIds, ...target.sourceIds])];
  return {
    contentGap: {
      score: clamp(contentGapScore),
      evidenceCoverage: targetNodeIds.length ? 1 : 0,
      sourceIds,
      explanation: `${missingNodeIds.length} of ${targetNodeIds.length} approved target leaf concepts are not present in the selected source route.`,
    },
    depthUplift: {
      score: clamp(depthDeficit * 100),
      evidenceCoverage: targetNodeIds.length ? 1 : 0,
      sourceIds,
      explanation: "Depth uplift compares the highest approved assessment depth for each target leaf concept with the selected source route.",
    },
    sourceNodeIds,
    targetNodeIds,
    missingNodeIds,
  };
}

const proportionalIncrease = (source: number, target: number) => source > 0 ? clamp((target / source - 1) * 100) : null;

export function calculateAssessmentDemand(source: AssessmentStructure | null, target: AssessmentStructure | null): EvidenceDimension {
  if (!source || !target) return { score: null, evidenceCoverage: 0, sourceIds: [], explanation: "Assessment structure evidence is incomplete." };
  const time = proportionalIncrease(source.totalMinutes, target.totalMinutes) ?? 0;
  const papers = proportionalIncrease(source.paperCount, target.paperCount) ?? 0;
  const sourcePressure = source.totalMinutes > 0 ? source.totalMarks / source.totalMinutes : 0;
  const targetPressure = target.totalMinutes > 0 ? target.totalMarks / target.totalMinutes : 0;
  const pressure = proportionalIncrease(sourcePressure, targetPressure) ?? 0;
  const calculator = clamp((target.nonCalculatorMarkShare - source.nonCalculatorMarkShare) * 100);
  return {
    score: clamp(time * 0.4 + papers * 0.3 + pressure * 0.2 + calculator * 0.1),
    evidenceCoverage: 1,
    sourceIds: [...new Set([...source.sourceIds, ...target.sourceIds])],
    explanation: "Assessment uplift combines total duration (40%), paper count (30%), marks per minute (20%), and non-calculator share (10%).",
  };
}

export function calculateDifficultySummary(dimensions: Record<DifficultyKey, EvidenceDimension>) {
  let knownContribution = 0;
  let missingWeight = 0;
  for (const key of Object.keys(DIFFICULTY_WEIGHTS) as DifficultyKey[]) {
    const weight = DIFFICULTY_WEIGHTS[key];
    const score = dimensions[key].score;
    if (score === null) missingWeight += weight;
    else knownContribution += score * weight;
  }
  return {
    score: clamp(knownContribution + 50 * missingWeight),
    interval: [clamp(knownContribution), clamp(knownContribution + 100 * missingWeight)] as [number, number],
    evidenceCoverage: 1 - missingWeight,
  };
}

export function buildDifficultyProfile(input: {
  profileId: string;
  sourceQualificationVersionId: string;
  sourceRouteId: string;
  sourcePaperIds?: string[];
  sourceTiers?: string[];
  targetQualificationVersionId: string;
  targetRouteId: string;
  targetPaperIds?: string[];
  targetTiers?: string[];
  dimensions: Record<DifficultyKey, EvidenceDimension>;
  verificationStatus?: DifficultyProfileV1["verificationStatus"];
}): DifficultyProfileV1 {
  const summary = calculateDifficultySummary(input.dimensions);
  return DifficultyProfileV1Schema.parse({
    schemaVersion: "1.0.0",
    profileId: input.profileId,
    sourceQualificationVersionId: input.sourceQualificationVersionId,
    sourceRouteId: input.sourceRouteId,
    ...(input.sourcePaperIds ? { sourcePaperIds: input.sourcePaperIds } : {}),
    ...(input.sourceTiers ? { sourceTiers: input.sourceTiers } : {}),
    targetQualificationVersionId: input.targetQualificationVersionId,
    targetRouteId: input.targetRouteId,
    ...(input.targetPaperIds ? { targetPaperIds: input.targetPaperIds } : {}),
    ...(input.targetTiers ? { targetTiers: input.targetTiers } : {}),
    direction: "source-to-target",
    weights: DIFFICULTY_WEIGHTS,
    dimensions: input.dimensions,
    ...summary,
    confidence: summary.evidenceCoverage >= 0.9 ? "high" : summary.evidenceCoverage >= 0.65 ? "medium" : "low",
    methodVersion: "exambridge-transition-difficulty-v1",
    verificationStatus: input.verificationStatus ?? "candidate",
  });
}
