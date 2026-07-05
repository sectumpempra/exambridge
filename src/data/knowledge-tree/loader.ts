import type { KnowledgeTree, SubjectMapping, OverlapData, SubjectSyllabus } from "./types";

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

/** Load a subject mapping file */
export async function loadMapping(boardCode: string): Promise<SubjectMapping> {
  const res = await fetch(`${BASE}/mapping-${boardCode}.json`);
  if (!res.ok) throw new Error(`Failed to load mapping for ${boardCode}`);
  return res.json();
}

/** Real-time overlap calculation from two subject mappings */
export async function calculateOverlap(codeA: string, codeB: string): Promise<OverlapData | null> {
  const [mappingA, mappingB] = await Promise.all([
    loadMapping(codeA).catch(() => null),
    loadMapping(codeB).catch(() => null),
  ]);
  if (!mappingA || !mappingB) return null;

  // Extract node sets: each node keeps its strongest match
  const extractBestNodes = (mapping: SubjectMapping) => {
    const best = new Map<string, { strength: string; topicName: string; topicId: string }>();
    const weightMap: Record<string, number> = { exact: 1.0, strong: 0.7, partial: 0.3 };
    for (const m of mapping.mappings) {
      for (const node of m.mappedNodes) {
        const existing = best.get(node.nodeId);
        const newWeight = weightMap[node.matchStrength] || 0.3;
        const oldWeight = existing ? (weightMap[existing.strength] || 0.3) : 0;
        if (newWeight > oldWeight) {
          best.set(node.nodeId, {
            strength: node.matchStrength,
            topicName: m.topicName,
            topicId: m.topicId,
          });
        }
      }
    }
    return best;
  };

  const nodesA = extractBestNodes(mappingA);
  const nodesB = extractBestNodes(mappingB);

  const setA = new Set(nodesA.keys());
  const setB = new Set(nodesB.keys());
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  const weightMap: Record<string, number> = { exact: 1.0, strong: 0.7, partial: 0.3 };

  // Weighted intersection: min weight for shared nodes
  let weightedIntersection = 0;
  let weightedUnion = 0;
  for (const nodeId of union) {
    const wA = nodesA.has(nodeId) ? (weightMap[nodesA.get(nodeId)!.strength] || 0.3) : 0;
    const wB = nodesB.has(nodeId) ? (weightMap[nodesB.get(nodeId)!.strength] || 0.3) : 0;
    weightedUnion += Math.max(wA, wB);
    if (nodesA.has(nodeId) && nodesB.has(nodeId)) {
      weightedIntersection += Math.min(wA, wB);
    }
  }

  // Build overlap data
  const overlapData: OverlapData = {
    version: "1.0-realtime",
    comparison: {
      A: `${mappingA.board} ${mappingA.subjectCode}`,
      B: `${mappingB.board} ${mappingB.subjectCode}`,
      topicCountA: mappingA.totalTopics,
      topicCountB: mappingB.totalTopics,
    },
    summary: {
      AtoB: {
        name: `${mappingA.subjectCode} → ${mappingB.subjectCode}`,
        unweighted: {
          overlap: intersection.size,
          total: setA.size || 1,
          percentage: setA.size > 0 ? (intersection.size / setA.size) * 100 : 0,
        },
        weighted: {
          overlap: weightedIntersection,
          total: weightedUnion || 1,
          percentage: weightedUnion > 0 ? (weightedIntersection / weightedUnion) * 100 : 0,
        },
      },
      BtoA: {
        name: `${mappingB.subjectCode} → ${mappingA.subjectCode}`,
        unweighted: {
          overlap: intersection.size,
          total: setB.size || 1,
          percentage: setB.size > 0 ? (intersection.size / setB.size) * 100 : 0,
        },
        weighted: {
          overlap: weightedIntersection,
          total: weightedUnion || 1,
          percentage: weightedUnion > 0 ? (weightedIntersection / weightedUnion) * 100 : 0,
        },
      },
      symmetric: {
        unweighted: union.size > 0 ? (intersection.size / union.size) * 100 : 0,
        weighted: weightedUnion > 0 ? (weightedIntersection / weightedUnion) * 100 : 0,
      },
    },
    details: {
      AtoB: mappingA.mappings.map((m) => ({
        topicId: m.topicId,
        topicName: m.topicName,
        hasOverlap: m.mappedNodes.some((n) => setB.has(n.nodeId)),
        overlappingTopicsB: m.mappedNodes
          .filter((n) => setB.has(n.nodeId))
          .map((n) => n.nodeId),
        sharedNodes: m.mappedNodes.filter((n) => setB.has(n.nodeId)).map((n) => n.nodeId),
        nodeCount: m.mappedNodes.length,
      })),
      BtoA: mappingB.mappings.map((m) => ({
        topicId: m.topicId,
        topicName: m.topicName,
        hasOverlap: m.mappedNodes.some((n) => setA.has(n.nodeId)),
        overlappingTopicsA: m.mappedNodes
          .filter((n) => setA.has(n.nodeId))
          .map((n) => n.nodeId),
        sharedNodes: m.mappedNodes.filter((n) => setA.has(n.nodeId)).map((n) => n.nodeId),
        nodeCount: m.mappedNodes.length,
      })),
    },
  };

  return overlapData;
}

/** Load a pre-calculated overlap report (fallback) */
export async function loadOverlap(codeA: string, codeB: string): Promise<OverlapData | null> {
  return calculateOverlap(codeA, codeB);
}

/** Load a syllabus file */
export async function loadSyllabus(boardCode: string): Promise<SubjectSyllabus | null> {
  const res = await fetch(`${BASE}/syllabus/syllabus-${boardCode}.json`);
  if (!res.ok) return null;
  return res.json();
}

/** List all available subjects from mapping files */
export async function listSubjects(): Promise<{ code: string; board: string; subjectCode: string; name: string; level: string }[]> {
  const subjects = [
    // GCSE / IGCSE
    { code: "CAIE-0580", board: "CAIE", subjectCode: "0580", name: "IGCSE Mathematics", level: "GCSE" },
    { code: "CAIE-0606", board: "CAIE", subjectCode: "0606", name: "IGCSE Further Mathematics", level: "GCSE" },
    { code: "Edexcel-1MA1", board: "Edexcel", subjectCode: "1MA1", name: "GCSE Mathematics", level: "GCSE" },
    { code: "Edexcel-4MA1", board: "Edexcel", subjectCode: "4MA1", name: "IGCSE Mathematics A", level: "GCSE" },
    { code: "AQA-8300", board: "AQA", subjectCode: "8300", name: "GCSE Mathematics", level: "GCSE" },
    { code: "AQA-8365", board: "AQA", subjectCode: "8365", name: "GCSE Further Mathematics", level: "GCSE" },
    { code: "OCR-J560", board: "OCR", subjectCode: "J560", name: "GCSE Mathematics", level: "GCSE" },
    { code: "WJEC-3300", board: "WJEC", subjectCode: "3300", name: "GCSE Mathematics", level: "GCSE" },
    // A-Level Mathematics
    { code: "CAIE-9709", board: "CAIE", subjectCode: "9709", name: "A-Level Mathematics", level: "A-Level" },
    { code: "Edexcel-9MA0", board: "Edexcel", subjectCode: "9MA0", name: "A-Level Mathematics", level: "A-Level" },
    { code: "Edexcel-8MA0", board: "Edexcel", subjectCode: "8MA0", name: "AS-Level Mathematics", level: "A-Level" },
    { code: "Edexcel-YMA01", board: "Edexcel", subjectCode: "YMA01", name: "IAL Mathematics", level: "A-Level" },
    { code: "AQA-7357", board: "AQA", subjectCode: "7357", name: "A-Level Mathematics", level: "A-Level" },
    { code: "OCR-H240", board: "OCR", subjectCode: "H240", name: "A-Level Mathematics", level: "A-Level" },
    // A-Level Further Mathematics
    { code: "CAIE-9231", board: "CAIE", subjectCode: "9231", name: "A-Level Further Mathematics", level: "A-Level" },
    { code: "Edexcel-9FM0", board: "Edexcel", subjectCode: "9FM0", name: "A-Level Further Mathematics", level: "A-Level" },
    { code: "Edexcel-YFM01", board: "Edexcel", subjectCode: "YFM01", name: "IAL Further Mathematics", level: "A-Level" },
    { code: "AQA-7367", board: "AQA", subjectCode: "7367", name: "A-Level Further Mathematics", level: "A-Level" },
    { code: "OCR-H245", board: "OCR", subjectCode: "H245", name: "A-Level Further Mathematics", level: "A-Level" },
    { code: "WJEC-FM", board: "WJEC", subjectCode: "FM", name: "A-Level Further Mathematics", level: "A-Level" },
  ];
  return subjects;
}

/** Build tree hierarchy for visualization */
export function buildTreeHierarchy(nodes: import("./types").KnowledgeTreeNode[]) {
  const roots: TreeNode[] = [];
  const map = new Map<string, TreeNode>();

  interface TreeNode {
    node: import("./types").KnowledgeTreeNode;
    children: TreeNode[];
  }

  for (const n of nodes) map.set(n.nodeId, { node: n, children: [] });
  for (const n of nodes) {
    const item = map.get(n.nodeId)!;
    if (n.parentNodeId && map.has(n.parentNodeId)) {
      map.get(n.parentNodeId)!.children.push(item);
    } else if (n.level <= 1) roots.push(item);
  }

  return { roots, map };
}
