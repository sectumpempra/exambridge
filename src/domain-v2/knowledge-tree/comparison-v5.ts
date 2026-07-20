import type {
  CanonicalNodeSemanticsV5,
  KnowledgeMappingV5,
  OfficialStatementV5,
} from "./v5-schema";

export type ComparisonStatus =
  | "shared"
  | "partial"
  | "exclusive"
  | "unresolved"
  | "non-comparable";

export interface StatementComparisonV5 {
  statement: OfficialStatementV5;
  status: ComparisonStatus;
  matchedStatementIds: string[];
  matchedNodeIds: string[];
  reason: string;
}

export interface KnowledgeComparisonV5 {
  subjectA: string;
  subjectB: string;
  paperA: string | null;
  paperB: string | null;
  exact: {
    sharedNodeIds: string[];
    aOnlyNodeIds: string[];
    bOnlyNodeIds: string[];
    unionCount: number;
    jaccard: number;
    coverageA: number;
    coverageB: number;
  };
  aStatements: StatementComparisonV5[];
  bStatements: StatementComparisonV5[];
  counts: Record<ComparisonStatus, number>;
}

function appliesToPaper(statement: OfficialStatementV5, paper: string | null): boolean {
  if (!paper) return true;
  if (statement.paperApplicability.kind === "not-specified") return false;
  return statement.paperApplicability.papers.includes(paper);
}

function isComparableStatement(statement: OfficialStatementV5): boolean {
  return statement.statementType === "assessable-content";
}

function normalizedTier(tier: string): string {
  const value = tier.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (value === "core" || value === "foundation" || value === "foundation-tier") return "lower-tier";
  if (value === "extended" || value === "higher" || value === "higher-tier") return "higher-tier";
  if (value === "intermediate" || value === "intermediate-tier") return "intermediate-tier";
  return value;
}

function hasCoveringScope(left: OfficialStatementV5, right: OfficialStatementV5): boolean {
  const leftTiers = [...new Set(left.tiers.map(normalizedTier))].sort();
  const rightTiers = [...new Set(right.tiers.map(normalizedTier))].sort();
  if (leftTiers.length === 0 || rightTiers.length === 0) return leftTiers.length === rightTiers.length;
  return leftTiers.every((tier) => rightTiers.includes(tier));
}

function approvedEligibleLinks(
  statement: OfficialStatementV5,
  semantics: Map<string, CanonicalNodeSemanticsV5>,
) {
  if (statement.reviewStatus !== "owner-approved" || !isComparableStatement(statement)) return [];
  return statement.conceptLinks.filter((link) => {
    const semantic = semantics.get(link.nodeId);
    return semantic?.reviewStatus === "owner-approved" && semantic.comparisonEligible;
  });
}

function isApprovedPracticeOnly(
  statement: OfficialStatementV5,
  semantics: Map<string, CanonicalNodeSemanticsV5>,
): boolean {
  if (statement.reviewStatus !== "owner-approved" || !isComparableStatement(statement) || statement.conceptLinks.length === 0) return false;
  return statement.conceptLinks.every((link) => {
    const semantic = semantics.get(link.nodeId);
    return semantic?.reviewStatus === "owner-approved"
      && !semantic.comparisonEligible
      && (semantic.semanticClass === "mathematical-practice" || semantic.semanticClass === "assessment-rule");
  });
}

function approvedOccurrences(
  mapping: KnowledgeMappingV5,
  paper: string | null,
  semantics: Map<string, CanonicalNodeSemanticsV5>,
): Map<string, Array<{ statement: OfficialStatementV5; relation: OfficialStatementV5["conceptLinks"][number]["relation"] }>> {
  const result = new Map<string, Array<{ statement: OfficialStatementV5; relation: OfficialStatementV5["conceptLinks"][number]["relation"] }>>();
  for (const statement of mapping.statements) {
    if (!appliesToPaper(statement, paper)) continue;
    for (const link of approvedEligibleLinks(statement, semantics)) {
      result.set(link.nodeId, [...(result.get(link.nodeId) ?? []), { statement, relation: link.relation }]);
    }
  }
  return result;
}

function classifyStatements(
  mapping: KnowledgeMappingV5,
  other: KnowledgeMappingV5,
  paper: string | null,
  otherPaper: string | null,
  semantics: Map<string, CanonicalNodeSemanticsV5>,
): StatementComparisonV5[] {
  const otherStatements = other.statements.filter((statement) => appliesToPaper(statement, otherPaper));
  const otherByNode = new Map<string, Array<{ statement: OfficialStatementV5; relation: OfficialStatementV5["conceptLinks"][number]["relation"] }>>();
  for (const statement of otherStatements) {
    for (const link of approvedEligibleLinks(statement, semantics)) {
      otherByNode.set(link.nodeId, [...(otherByNode.get(link.nodeId) ?? []), { statement, relation: link.relation }]);
    }
  }
  const otherHasUnresolvedContent = otherStatements.some((statement) =>
    isComparableStatement(statement)
      && !isApprovedPracticeOnly(statement, semantics)
      && approvedEligibleLinks(statement, semantics).length === 0
  );

  return mapping.statements
    .filter((statement) => appliesToPaper(statement, paper))
    .map((statement) => {
      if (!isComparableStatement(statement)) {
        return { statement, status: "non-comparable", matchedStatementIds: [], matchedNodeIds: [], reason: "The source row is not assessable mathematical content." };
      }
      if (isApprovedPracticeOnly(statement, semantics)) {
        return { statement, status: "non-comparable", matchedStatementIds: [], matchedNodeIds: [], reason: "The statement is an approved mathematical practice or assessment rule, not a comparable knowledge concept." };
      }
      const links = approvedEligibleLinks(statement, semantics);
      if (statement.reviewStatus !== "owner-approved" || links.length === 0) {
        return { statement, status: "unresolved", matchedStatementIds: [], matchedNodeIds: [], reason: "The statement or its canonical mapping is not fully approved." };
      }
      const matchedNodeIds = links.map((link) => link.nodeId).filter((nodeId) => otherByNode.has(nodeId));
      const matchedStatements = new Set(matchedNodeIds.flatMap((nodeId) => (otherByNode.get(nodeId) ?? []).map((item) => item.statement.statementId)));
      if (matchedNodeIds.length === 0) {
        if (otherHasUnresolvedContent) {
          return { statement, status: "unresolved", matchedStatementIds: [], matchedNodeIds: [], reason: "The comparison selection contains unresolved assessable content, so exclusivity cannot be proven." };
        }
        return { statement, status: "exclusive", matchedStatementIds: [], matchedNodeIds: [], reason: "No approved counterpart exists in the comparison selection." };
      }
      const everyOwnLinkMatched = matchedNodeIds.length === links.length;
      const ownNodeIds = new Set(links.map((link) => link.nodeId));
      // A statement is fully shared only when one or more equivalently scoped
      // counterpart statements cover the complete concept set without adding a
      // broader concept. Merely finding every A node somewhere inside a broader
      // B statement would otherwise mislabel a directional subset as shared.
      const exactCounterpartCoverage = new Set(otherStatements.flatMap((candidate) => {
        if (!hasCoveringScope(statement, candidate)) return [];
        const candidateLinks = approvedEligibleLinks(candidate, semantics);
        if (candidateLinks.length === 0 || candidateLinks.some((link) => link.relation !== "exact" || !ownNodeIds.has(link.nodeId))) return [];
        return candidateLinks.map((link) => link.nodeId);
      }));
      const allRelationsAndScopesExact = links.every((link) =>
        link.relation === "exact" && exactCounterpartCoverage.has(link.nodeId)
      );
      return {
        statement,
        status: everyOwnLinkMatched && allRelationsAndScopesExact ? "shared" : "partial",
        matchedStatementIds: [...matchedStatements],
        matchedNodeIds: [...new Set(matchedNodeIds)],
        reason: everyOwnLinkMatched && allRelationsAndScopesExact
          ? "Every approved concept link has an exact counterpart covering this direction's normalized tier scope. Qualification-local route and Paper IDs are not compared as semantic concepts."
          : "Only part of the statement, a broader/narrower concept, or a different normalized tier scope is shared.",
      };
    });
}

export function compareKnowledgeMappingsV5(
  mappingA: KnowledgeMappingV5,
  mappingB: KnowledgeMappingV5,
  ontology: CanonicalNodeSemanticsV5[],
  paperA: string | null = null,
  paperB: string | null = null,
): KnowledgeComparisonV5 {
  if (mappingA.reviewStatus !== "owner-approved" || mappingB.reviewStatus !== "owner-approved") {
    throw new Error("V5 comparison requires owner-approved mappings");
  }
  const semantics = new Map(ontology.map((node) => [node.nodeId, node]));
  const occurrencesA = approvedOccurrences(mappingA, paperA, semantics);
  const occurrencesB = approvedOccurrences(mappingB, paperB, semantics);
  const exactA = new Set([...occurrencesA].filter(([, occurrences]) => occurrences.some((item) => item.relation === "exact")).map(([nodeId]) => nodeId));
  const exactB = new Set([...occurrencesB].filter(([, occurrences]) => occurrences.some((item) => item.relation === "exact")).map(([nodeId]) => nodeId));
  // The exact node set represents mathematical concept scope. Qualification-local
  // tier, route and Paper labels are evaluated on statement status below; they must
  // not turn the same canonical concept into simultaneous A-only and B-only nodes.
  const shared = [...exactA].filter((nodeId) => exactB.has(nodeId));
  const sharedSet = new Set(shared);
  const aOnly = [...exactA].filter((nodeId) => !sharedSet.has(nodeId));
  const bOnly = [...exactB].filter((nodeId) => !sharedSet.has(nodeId));
  const unionCount = new Set([...exactA, ...exactB]).size;
  const aStatements = classifyStatements(mappingA, mappingB, paperA, paperB, semantics);
  const bStatements = classifyStatements(mappingB, mappingA, paperB, paperA, semantics);
  const counts: Record<ComparisonStatus, number> = {
    shared: 0,
    partial: 0,
    exclusive: 0,
    unresolved: 0,
    "non-comparable": 0,
  };
  for (const item of [...aStatements, ...bStatements]) counts[item.status] += 1;

  return {
    subjectA: mappingA.qualificationVersionId,
    subjectB: mappingB.qualificationVersionId,
    paperA,
    paperB,
    exact: {
      sharedNodeIds: shared,
      aOnlyNodeIds: aOnly,
      bOnlyNodeIds: bOnly,
      unionCount,
      jaccard: unionCount ? (shared.length / unionCount) * 100 : 0,
      coverageA: exactA.size ? (shared.length / exactA.size) * 100 : 0,
      coverageB: exactB.size ? (shared.length / exactB.size) * 100 : 0,
    },
    aStatements,
    bStatements,
    counts,
  };
}
