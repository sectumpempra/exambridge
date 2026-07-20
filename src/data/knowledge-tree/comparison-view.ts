import type { KnowledgeTreeNode } from "./types";
import type { KnowledgeComparisonV5 } from "@/domain-v2/knowledge-tree/comparison-v5";

export interface ComparisonMetric {
  overlap: number;
  total: number;
  percentage: number;
}

export interface KnowledgeComparisonViewData {
  version: "5.0";
  comparison: {
    A: string;
    B: string;
    topicCountA: number;
    topicCountB: number;
  };
  metrics: {
    /** Shared nodes divided by the union of both knowledge-node sets. */
    unionOverlap: ComparisonMetric;
    /** Share of A's knowledge nodes also represented in B. */
    coverageA: ComparisonMetric;
    /** Share of B's knowledge nodes also represented in A. */
    coverageB: ComparisonMetric;
    partialStatementCount?: number;
    unresolvedStatementCount?: number;
  };
}

export function buildKnowledgeComparisonV5ViewData(
  result: KnowledgeComparisonV5,
  displayA: string,
  displayB: string,
): KnowledgeComparisonViewData {
  return {
    version: "5.0",
    comparison: {
      A: displayA,
      B: displayB,
      topicCountA: result.exact.sharedNodeIds.length + result.exact.aOnlyNodeIds.length,
      topicCountB: result.exact.sharedNodeIds.length + result.exact.bOnlyNodeIds.length,
    },
    metrics: {
      unionOverlap: {
        overlap: result.exact.sharedNodeIds.length,
        total: result.exact.unionCount,
        percentage: result.exact.jaccard,
      },
      coverageA: {
        overlap: result.exact.sharedNodeIds.length,
        total: result.exact.sharedNodeIds.length + result.exact.aOnlyNodeIds.length,
        percentage: result.exact.coverageA,
      },
      coverageB: {
        overlap: result.exact.sharedNodeIds.length,
        total: result.exact.sharedNodeIds.length + result.exact.bOnlyNodeIds.length,
        percentage: result.exact.coverageB,
      },
      partialStatementCount: result.counts.partial,
      unresolvedStatementCount: result.counts.unresolved,
    },
  };
}

export interface NodeDomainGroup {
  domain: string;
  items: KnowledgeTreeNode[];
}

export function getKnowledgeNodeTitle(node: KnowledgeTreeNode) {
  return node.name || node.path.at(-1) || node.nodeId;
}

export function getKnowledgeNodeDomain(node: KnowledgeTreeNode) {
  return node.domain || node.path[1] || node.path[0] || "其他";
}

/**
 * Difference sets contain taxonomy ancestors. Keep end nodes in the main
 * teacher-facing list and move parent/category nodes into a separate section.
 */
export function partitionKnowledgeNodes(
  items: KnowledgeTreeNode[],
  allNodes: KnowledgeTreeNode[],
) {
  const parentIds = new Set(
    allNodes.map((node) => node.parentNodeId).filter((id): id is string => Boolean(id)),
  );
  const teachingPoints: KnowledgeTreeNode[] = [];
  const structuralNodes: KnowledgeTreeNode[] = [];

  for (const item of items) {
    if (parentIds.has(item.nodeId)) structuralNodes.push(item);
    else teachingPoints.push(item);
  }

  return { teachingPoints, structuralNodes };
}

export function groupKnowledgeNodesByDomain(items: KnowledgeTreeNode[]): NodeDomainGroup[] {
  const grouped = new Map<string, KnowledgeTreeNode[]>();
  for (const item of items) {
    const domain = getKnowledgeNodeDomain(item);
    const current = grouped.get(domain) ?? [];
    current.push(item);
    grouped.set(domain, current);
  }

  return Array.from(grouped, ([domain, domainItems]) => ({
    domain,
    items: domainItems.sort((a, b) =>
      getKnowledgeNodeTitle(a).localeCompare(getKnowledgeNodeTitle(b)),
    ),
  })).sort((a, b) => a.domain.localeCompare(b.domain));
}
