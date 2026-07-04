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

/** Load an overlap report between two subjects */
export async function loadOverlap(codeA: string, codeB: string): Promise<OverlapData | null> {
  // Try both naming conventions
  const candidates = [
    `${BASE}/${codeA.toLowerCase()}_vs_${codeB.toLowerCase()}.json`,
    `${BASE}/${codeB.toLowerCase()}_vs_${codeA.toLowerCase()}.json`,
    `${BASE}/${codeA}_vs_${codeB}.json`,
    `${BASE}/${codeB}_vs_${codeA}.json`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch { /* try next */ }
  }
  return null;
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
  const nodeMap = new Map(nodes.map((n) => [n.nodeId, n]));
  const roots: TreeNode[] = [];
  const treeNodeMap = new Map<string, TreeNode>();

  interface TreeNode {
    node: import("./types").KnowledgeTreeNode;
    children: TreeNode[];
    expanded: boolean;
  }

  for (const node of nodes) {
    if (!treeNodeMap.has(node.nodeId)) {
      treeNodeMap.set(node.nodeId, { node, children: [], expanded: false });
    }
  }

  for (const node of nodes) {
    const treeNode = treeNodeMap.get(node.nodeId)!;
    if (node.parentNodeId && treeNodeMap.has(node.parentNodeId)) {
      treeNodeMap.get(node.parentNodeId)!.children.push(treeNode);
    } else if (node.level <= 1) {
      roots.push(treeNode);
    }
  }

  return { roots, nodeMap, treeNodeMap };
}
