import type { KnowledgeTreeNode } from "./types";
import type { OverlapResultV32 } from "./types-v3.2";

export interface ComparisonMetric {
  overlap: number;
  total: number;
  percentage: number;
}

export interface KnowledgeComparisonViewData {
  version: "3.2";
  comparison: {
    A: string;
    B: string;
    topicCountA: number;
    topicCountB: number;
  };
  metrics: {
    /** Shared nodes divided by the union of both knowledge-node sets. */
    unionOverlap: ComparisonMetric;
    /** Frequency-weighted Jaccard similarity across mapped nodes and ancestors. */
    emphasisSimilarity: number;
    /** Share of A's knowledge nodes also represented in B. */
    coverageA: ComparisonMetric;
    /** Share of B's knowledge nodes also represented in A. */
    coverageB: ComparisonMetric;
  };
}

function percentage(overlap: number, total: number) {
  return total > 0 ? (overlap / total) * 100 : 0;
}

export function buildKnowledgeComparisonViewData(
  result: OverlapResultV32,
  displayA: string,
  displayB: string,
): KnowledgeComparisonViewData {
  const unionTotal = result.aTotal + result.bTotal - result.sharedCount;

  return {
    version: "3.2",
    comparison: {
      A: displayA,
      B: displayB,
      topicCountA: result.aTotal,
      topicCountB: result.bTotal,
    },
    metrics: {
      unionOverlap: {
        overlap: result.sharedCount,
        total: unionTotal,
        percentage: percentage(result.sharedCount, unionTotal),
      },
      emphasisSimilarity: result.weighted,
      coverageA: {
        overlap: result.sharedCount,
        total: result.aTotal,
        percentage: percentage(result.sharedCount, result.aTotal),
      },
      coverageB: {
        overlap: result.sharedCount,
        total: result.bTotal,
        percentage: percentage(result.sharedCount, result.bTotal),
      },
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
