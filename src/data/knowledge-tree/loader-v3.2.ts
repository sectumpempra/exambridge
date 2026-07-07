import type {
  KnowledgeTreeV32,
  MappingFile,
  SubjectInfoV32,
  OverlapResultV32,
  CompareMode,
  ExclusiveSubtopicItem,
} from "./types-v3.2";

const BASE = "/data/v3.2-new";

// Mapping file list (derived from actual files)
const MAPPING_FILES: string[] = [
  "mapping-CAIE-0580.json",
  "mapping-CAIE-0606.json",
  "mapping-CAIE-9709.json",
  "mapping-CAIE-9231.json",
  "mapping-Edexcel-4MA1.json",
  "mapping-Edexcel-4PM1.json",
  "mapping-Edexcel-1MA1.json",
  "mapping-Edexcel-8MA0.json",
  "mapping-Edexcel-9MA0.json",
  "mapping-Edexcel-9FM0.json",
  "mapping-Edexcel-IAL.json",
  "mapping-AQA-8300.json",
  "mapping-AQA-8365.json",
  "mapping-AQA-7357.json",
  "mapping-AQA-7367.json",
  "mapping-OCR-J560.json",
  "mapping-OCR-H240.json",
  "mapping-OCR-H640.json",
  "mapping-OCR-H245.json",
  "mapping-OCR-6993.json",
  "mapping-WJEC-3300.json",
];

// --- Cached state ---
let cachedTree: KnowledgeTreeV32 | null = null;
let cachedMappings: Map<string, MappingFile> | null = null;
let cachedSubjects: SubjectInfoV32[] | null = null;

/** Load the knowledge tree */
export async function loadKnowledgeTreeV32(): Promise<KnowledgeTreeV32> {
  if (cachedTree) return cachedTree;
  const res = await fetch(`${BASE}/knowledge-tree.json`);
  if (!res.ok) throw new Error("Failed to load knowledge tree");
  cachedTree = await res.json();
  return cachedTree!;
}

/** Load all mapping files */
export async function loadAllMappingsV32(): Promise<Map<string, MappingFile>> {
  if (cachedMappings) return cachedMappings;
  const map = new Map<string, MappingFile>();
  const promises = MAPPING_FILES.map(async (file) => {
    try {
      const res = await fetch(`${BASE}/${file}`);
      if (!res.ok) {
        console.warn(`Failed to load ${file}: ${res.status}`);
        return;
      }
      const data: MappingFile = await res.json();
      const code = `${data.board}-${data.subjectCode}`;
      map.set(code, data);
    } catch (e) {
      console.warn(`Error loading ${file}:`, e);
    }
  });
  await Promise.all(promises);
  cachedMappings = map;
  return map;
}

/** Extract subject list from loaded mappings */
export async function listSubjectsV32(): Promise<SubjectInfoV32[]> {
  if (cachedSubjects) return cachedSubjects;
  const mappings = await loadAllMappingsV32();
  const subjects: SubjectInfoV32[] = [];
  for (const [code, m] of mappings) {
    const isGCSE =
      m.level === "GCSE" ||
      m.level === "IGCSE" ||
      ["0580", "0606", "4MA1", "4PM1", "1MA1", "8300", "8365", "J560", "6993", "3300"].some(
        (c) => m.subjectCode.includes(c)
      );
    const papers = m.paperStructure?.papers ?? [];
    subjects.push({
      code,
      board: m.board,
      subjectCode: m.subjectCode,
      name: m.subjectName,
      level: m.level,
      hasPapers: papers.length > 0,
      papers,
      isGCSE,
    });
  }
  subjects.sort((a, b) => {
    if (a.isGCSE !== b.isGCSE) return a.isGCSE ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  cachedSubjects = subjects;
  return subjects;
}

/** Get a single mapping by subject code */
export async function getMappingV32(code: string): Promise<MappingFile | undefined> {
  const mappings = await loadAllMappingsV32();
  return mappings.get(code);
}

/** Get paper list for a subject */
export async function getPapersForSubjectV32(code: string): Promise<string[]> {
  const m = await getMappingV32(code);
  return m?.paperStructure?.papers ?? [];
}

// --- Overlap calculation ---

interface NodeFreq {
  nodes: Set<string>;
  ancestors: Set<string>;
  weighted: Map<string, number>;
}

function extractNodeSet(
  mapping: MappingFile,
  paperFilter: string | null,
  tree: KnowledgeTreeV32
): NodeFreq {
  const nodes = new Set<string>();
  const ancestors = new Set<string>();
  const weighted = new Map<string, number>();

  const parentMap = new Map<string, string>();
  for (const n of tree.nodes) {
    if (n.parentNodeId) {
      parentMap.set(n.nodeId, n.parentNodeId);
    }
  }

  for (const topic of mapping.mappings) {
    for (const sm of topic.subtopicMappings) {
      if (paperFilter !== null) {
        const pr = sm.paperReference;
        if (pr !== null && !pr.includes(paperFilter)) {
          continue;
        }
      }

      for (const mn of sm.mappedNodes) {
        const nid = mn.nodeId;
        nodes.add(nid);
        weighted.set(nid, (weighted.get(nid) || 0) + 1);

        let current = nid;
        while (parentMap.has(current)) {
          const pid = parentMap.get(current)!;
          ancestors.add(pid);
          weighted.set(pid, (weighted.get(pid) || 0) + 1);
          current = pid;
        }
      }
    }
  }

  return { nodes, ancestors, weighted };
}

/** Calculate Jaccard overlap between two subjects/papers */
export async function calculateOverlapV32(
  codeA: string,
  codeB: string,
  paperA: string | null = null,
  paperB: string | null = null
): Promise<OverlapResultV32 | null> {
  const [tree, mappings] = await Promise.all([
    loadKnowledgeTreeV32(),
    loadAllMappingsV32(),
  ]);

  const mA = mappings.get(codeA);
  const mB = mappings.get(codeB);
  if (!mA || !mB) return null;

  const setA = extractNodeSet(mA, paperA, tree);
  const setB = extractNodeSet(mB, paperB, tree);

  const allA = new Set([...setA.nodes, ...setA.ancestors]);
  const allB = new Set([...setB.nodes, ...setB.ancestors]);

  const shared = new Set([...allA].filter((x) => allB.has(x)));
  const union = new Set([...allA, ...allB]);

  const aOnly = new Set([...allA].filter((x) => !allB.has(x)));
  const bOnly = new Set([...allB].filter((x) => !allA.has(x)));

  const unweighted = union.size > 0 ? (shared.size / union.size) * 100 : 0;

  const allKeys = new Set([...setA.weighted.keys(), ...setB.weighted.keys()]);
  let intersectionW = 0;
  let unionW = 0;
  for (const k of allKeys) {
    const wa = setA.weighted.get(k) || 0;
    const wb = setB.weighted.get(k) || 0;
    intersectionW += Math.min(wa, wb);
    unionW += Math.max(wa, wb);
  }
  const weighted = unionW > 0 ? (intersectionW / unionW) * 100 : 0;

  let mode: CompareMode = "subject-vs-subject";
  if (paperA && paperB) mode = "paper-vs-paper";
  else if (paperA || paperB) mode = "paper-vs-subject";

  const aName = paperA ? `${mA.subjectName} ${paperA}` : mA.subjectName;
  const bName = paperB ? `${mB.subjectName} ${paperB}` : mB.subjectName;

  return {
    subjectA: codeA,
    subjectB: codeB,
    paperA,
    paperB,
    mode,
    unweighted,
    weighted,
    sharedNodes: [...shared],
    aOnlyNodes: [...aOnly],
    bOnlyNodes: [...bOnly],
    sharedCount: shared.size,
    aTotal: allA.size,
    bTotal: allB.size,
    aName,
    bName,
  };
}

/** Get overlap sets for tree highlighting */
export async function getOverlapSetsV32(
  codeA: string,
  codeB: string,
  paperA: string | null = null,
  paperB: string | null = null
): Promise<{
  shared: Set<string>;
  aOnly: Set<string>;
  bOnly: Set<string>;
}> {
  const result = await calculateOverlapV32(codeA, codeB, paperA, paperB);
  if (!result) {
    return { shared: new Set(), aOnly: new Set(), bOnly: new Set() };
  }
  return {
    shared: new Set(result.sharedNodes),
    aOnly: new Set(result.aOnlyNodes),
    bOnly: new Set(result.bOnlyNodes),
  };
}

/** Find exclusive subtopics for a subject (考纲原文展示) */
export async function findExclusiveSubtopics(
  codeA: string,
  codeB: string,
  paperA: string | null = null,
  paperB: string | null = null
): Promise<{
  aExclusive: ExclusiveSubtopicItem[];
  bExclusive: ExclusiveSubtopicItem[];
}> {
  const [tree, mappings] = await Promise.all([
    loadKnowledgeTreeV32(),
    loadAllMappingsV32(),
  ]);

  const mA = mappings.get(codeA);
  const mB = mappings.get(codeB);
  if (!mA || !mB) return { aExclusive: [], bExclusive: [] };

  // Build parent map
  const parentMap = new Map<string, string>();
  for (const n of tree.nodes) {
    if (n.parentNodeId) {
      parentMap.set(n.nodeId, n.parentNodeId);
    }
  }

  // Helper: get all nodes (with ancestors) for a mapping
  function getAllNodes(mapping: MappingFile, paperFilter: string | null): Set<string> {
    const result = new Set<string>();
    for (const topic of mapping.mappings) {
      for (const sm of topic.subtopicMappings) {
        if (paperFilter !== null) {
          const pr = sm.paperReference;
          if (pr !== null && !pr.includes(paperFilter)) continue;
        }
        for (const mn of sm.mappedNodes) {
          const nid = mn.nodeId;
          result.add(nid);
          let current = nid;
          while (parentMap.has(current)) {
            result.add(parentMap.get(current)!);
            current = parentMap.get(current)!;
          }
        }
      }
    }
    return result;
  }

  const bAllNodes = getAllNodes(mB, paperB);
  const aExclusive: Array<{
    subtopicId: string;
    subtopicName: string;
    description?: string;
    topicName: string;
    paperRef: string[] | null;
  }> = [];

  for (const topic of mA.mappings) {
    for (const sm of topic.subtopicMappings) {
      if (paperA !== null) {
        const pr = sm.paperReference;
        if (pr !== null && !pr.includes(paperA)) continue;
      }
      const aNodeIds = new Set(sm.mappedNodes.map((mn) => mn.nodeId));
      const hasOverlap = [...aNodeIds].some((nid) => bAllNodes.has(nid));
      if (!hasOverlap) {
        aExclusive.push({
          subtopicId: sm.subtopicId,
          subtopicName: sm.subtopicName,
          description: sm.description,
          topicName: topic.topicName,
          paperRef: sm.paperReference,
        });
      }
    }
  }

  const aAllNodes = getAllNodes(mA, paperA);
  const bExclusive: Array<{
    subtopicId: string;
    subtopicName: string;
    description?: string;
    topicName: string;
    paperRef: string[] | null;
  }> = [];

  for (const topic of mB.mappings) {
    for (const sm of topic.subtopicMappings) {
      if (paperB !== null) {
        const pr = sm.paperReference;
        if (pr !== null && !pr.includes(paperB)) continue;
      }
      const bNodeIds = new Set(sm.mappedNodes.map((mn) => mn.nodeId));
      const hasOverlap = [...bNodeIds].some((nid) => aAllNodes.has(nid));
      if (!hasOverlap) {
        bExclusive.push({
          subtopicId: sm.subtopicId,
          subtopicName: sm.subtopicName,
          description: sm.description,
          topicName: topic.topicName,
          paperRef: sm.paperReference,
        });
      }
    }
  }

  return { aExclusive, bExclusive };
}

/** Get tree nodes for display */
export async function getTreeNodesV32(): Promise<
  {
    nodeId: string;
    path: string[];
    level: number;
    description?: string;
    parentNodeId?: string;
  }[]
> {
  const tree = await loadKnowledgeTreeV32();
  return tree.nodes.map((n) => ({
    nodeId: n.nodeId,
    path: n.path,
    level: n.level,
    description: n.description ?? "",
    parentNodeId: n.parentNodeId,
  }));
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
