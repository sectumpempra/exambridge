import { SUBJECT_LOOKUP, TREE_NODES, calculateOverlap as calcOverlap } from "./lookup";
import type { KnowledgeTree, OverlapData } from "./types";

const BASE = "/knowledge-tree";

let cachedTree: KnowledgeTree | null = null;

/** Load the unified knowledge tree */
export async function loadKnowledgeTree(): Promise<KnowledgeTree> {
  if (cachedTree) return cachedTree;
  const res = await fetch(`${BASE}/unified-knowledge-tree.json`);
  if (!res.ok) throw new Error("Failed to load knowledge tree");
  cachedTree = await res.json();
  return cachedTree as KnowledgeTree;
}

/** Real-time overlap calculation using bundled lookup data */
export function calculateOverlap(codeA: string, codeB: string): OverlapData | null {
  const result = calcOverlap(codeA, codeB);
  if (!result) return null;

  // Convert to OverlapData format
  return {
    version: "1.0-realtime",
    comparison: result.comparison,
    summary: result.summary,
    details: {
      AtoB: result.sharedNodes.map((nid) => ({
        topicId: nid,
        topicName: nid,
        hasOverlap: true,
        overlappingTopicsB: [nid],
        sharedNodes: [nid],
        nodeCount: 1,
      })),
      BtoA: result.sharedNodes.map((nid) => ({
        topicId: nid,
        topicName: nid,
        hasOverlap: true,
        overlappingTopicsA: [nid],
        sharedNodes: [nid],
        nodeCount: 1,
      })),
    },
  };
}

/** Get shared/a-only/b-only node sets for highlighting */
export function getOverlapSets(codeA: string, codeB: string) {
  const result = calcOverlap(codeA, codeB);
  if (!result) return { shared: new Set<string>(), aOnly: new Set<string>(), bOnly: new Set<string>() };
  return {
    shared: new Set(result.sharedNodes),
    aOnly: new Set(result.aOnlyNodes),
    bOnly: new Set(result.bOnlyNodes),
  };
}

/** Get tree nodes for display */
export function getTreeNodes() {
  return TREE_NODES.map((n) => ({
    nodeId: n.id,
    path: n.path,
    level: n.level,
    description: n.desc,
    parentNodeId: n.parent || undefined,
    childNodeIds: [] as string[],
    relatedNodes: [] as string[],
    tags: [] as string[],
  }));
}

/** List all available subjects from bundled lookup */
export function listSubjects(): { code: string; board: string; subjectCode: string; name: string; level: string }[] {
  return Object.entries(SUBJECT_LOOKUP).map(([code, info]) => {
    const parts = code.split("-");
    const board = parts[0];
    const subjectCode = parts.slice(1).join("-");
    const isGCSE = ["0580", "0606", "1MA1", "4MA1", "8300", "8365", "J560", "3300", "1300"].some(
      (c) => subjectCode.includes(c)
    );
    return {
      code,
      board,
      subjectCode,
      name: info.fullName,
      level: isGCSE ? "GCSE" : "A-Level",
    };
  });
}

/** Build tree hierarchy for visualization */
export function buildTreeHierarchy(
  nodes: { nodeId: string; path: string[]; level: number; parentNodeId?: string }[]
) {
  interface TreeNode {
    node: (typeof nodes)[0];
    children: TreeNode[];
  }
  const map = new Map<string, TreeNode>();
  for (const n of nodes) map.set(n.nodeId, { node: n, children: [] });
  const roots: TreeNode[] = [];
  for (const n of nodes) {
    const item = map.get(n.nodeId)!;
    if (n.parentNodeId && map.has(n.parentNodeId)) {
      map.get(n.parentNodeId)!.children.push(item);
    } else if (n.level <= 1) roots.push(item);
  }
  return { roots, map };
}
