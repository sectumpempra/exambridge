/**
 * Knowledge Tree Loader v2
 *
 * Manifest-driven loading with caching.
 * No hardcoded MAPPING_FILES list — all files discovered via manifest.json.
 */

import type {
  KnowledgeManifest,
  KnowledgeTree,
  MappingFile,
  SubjectInfo,
  OverlapResult,
  OverlapInput,
} from "./schema";
import {
  KnowledgeManifestSchema,
  KnowledgeTreeSchema,
  MappingFileSchema,
} from "./schema";

// ── Cache ──

interface CacheEntry<T> {
  key: string;
  promise: Promise<T>;
}

const manifestCache: { entry: CacheEntry<KnowledgeManifest> | null } = { entry: null };
const treeCache: { entry: CacheEntry<KnowledgeTree> | null } = { entry: null };
const mappingCache = new Map<string, CacheEntry<MappingFile>>();

/** Clear all caches. For testing only. */
export function clearKnowledgeCache(): void {
  manifestCache.entry = null;
  treeCache.entry = null;
  mappingCache.clear();
}

// ── Shared fetch with in-flight Promise dedup ──

async function cachedFetch<T>(
  url: string,
  cache: { entry: CacheEntry<T> | null },
  cacheKey: string,
  parser: (data: unknown) => T
): Promise<T> {
  if (cache.entry && cache.entry.key === cacheKey) {
    return cache.entry.promise;
  }

  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const data = await res.json();
    return parser(data);
  })();

  cache.entry = { key: cacheKey, promise };
  return promise;
}

// ── Loaders ──

const BASE = `${import.meta.env.BASE_URL}data/v3.2`.replace(/\/+$/, "");

/** Load the knowledge manifest. */
export async function loadKnowledgeManifest(): Promise<KnowledgeManifest> {
  const result = KnowledgeManifestSchema.safeParse(
    await (await fetch(`${BASE}/manifest.json`)).json()
  );
  if (!result.success) {
    throw new Error(`Invalid manifest: ${result.error.message}`);
  }
  return result.data;
}

/** Load the knowledge tree. */
export async function loadKnowledgeTree(): Promise<KnowledgeTree> {
  return cachedFetch(
    `${BASE}/knowledge-tree-v3.2.json`,
    treeCache,
    "tree",
    (data) => {
      const result = KnowledgeTreeSchema.safeParse(data);
      if (!result.success) throw new Error(`Invalid tree: ${result.error.message}`);
      return result.data;
    }
  );
}

/** Load a single mapping file by subject ID. */
export async function loadMapping(subjectId: string): Promise<MappingFile> {
  // subjectId format: "CAIE-9709"
  const manifest = await loadKnowledgeManifest();
  const entry = manifest.mappings.find((m) => m.id === subjectId);
  if (!entry) throw new Error(`Mapping not found for ${subjectId}`);

  const cacheKey = `${entry.sha256}-${entry.path}`;
  const existing = mappingCache.get(subjectId);
  if (existing && existing.key === cacheKey) return existing.promise;

  const promise = (async () => {
    const res = await fetch(`${BASE}/${entry.path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${entry.path}`);
    const data = await res.json();
    const result = MappingFileSchema.safeParse(data);
    if (!result.success) throw new Error(`Invalid mapping ${subjectId}: ${result.error.message}`);
    return result.data;
  })();

  mappingCache.set(subjectId, { key: cacheKey, promise });
  return promise;
}

/** List all available knowledge subjects. */
export async function listKnowledgeSubjects(): Promise<SubjectInfo[]> {
  const manifest = await loadKnowledgeManifest();
  const subjects: SubjectInfo[] = manifest.mappings.map((m) => {
    const isGCSE =
      m.id.includes("0580") ||
      m.id.includes("0606") ||
      m.id.includes("4MA1") ||
      m.id.includes("4PM1") ||
      m.id.includes("1MA1") ||
      m.id.includes("8300") ||
      m.id.includes("8365") ||
      m.id.includes("J560") ||
      m.id.includes("3300");

    return {
      id: m.id,
      board: m.boardId,
      subjectCode: m.subjectId.split("-")[1] ?? m.subjectId,
      name: m.subjectId,
      level: isGCSE ? "GCSE" : "A-Level",
      hasPapers: false,
      papers: [],
      isGCSE,
    };
  });

  return subjects.sort((a, b) => a.id.localeCompare(b.id));
}

// ── Overlap Calculator (pure function) ──

export function calculateOverlap(
  input: OverlapInput,
  mappingA: MappingFile,
  mappingB: MappingFile,
  tree: KnowledgeTree
): OverlapResult {
  const { subjectA, subjectB, paperA, paperB } = input;

  // Collect all mapped nodeIds from both subjects
  const nodesA = collectMappedNodes(mappingA, paperA ?? null);
  const nodesB = collectMappedNodes(mappingB, paperB ?? null);

  const nodeMap = new Map(tree.nodes.map((n) => [n.nodeId, n]));

  // Find shared and exclusive nodes
  const shared: OverlapResult["sharedNodes"] = [];
  const aOnly: OverlapResult["aOnlyNodes"] = [];
  const bOnly: OverlapResult["bOnlyNodes"] = [];

  // Weight map for match strengths
  const weights: Record<string, number> = { exact: 1.0, strong: 0.8, partial: 0.5, weak: 0.2 };

  let totalWeightShared = 0;
  let totalWeightA = 0;
  let totalWeightB = 0;

  // Process all unique nodeIds from both subjects
  const allNodeIds = new Set([...nodesA.keys(), ...nodesB.keys()]);

  for (const nodeId of allNodeIds) {
    const infoA = nodesA.get(nodeId);
    const infoB = nodesB.get(nodeId);
    const node = nodeMap.get(nodeId);
    const nodeName = node?.name ?? nodeId;

    if (infoA && infoB) {
      // Shared node
      const weightA = weights[infoA.strength] ?? 0.5;
      const weightB = weights[infoB.strength] ?? 0.5;
      const avgWeight = (weightA + weightB) / 2;
      totalWeightShared += avgWeight;
      totalWeightA += weightA;
      totalWeightB += weightB;

      shared.push({
        nodeId,
        nodeName,
        matchStrength: infoA.strength === "exact" || infoB.strength === "exact"
          ? "exact"
          : infoA.strength,
        topicA: infoA.topic,
        topicB: infoB.topic,
      });
    } else if (infoA) {
      // A only
      const w = weights[infoA.strength] ?? 0.5;
      totalWeightA += w;
      aOnly.push({ nodeId, nodeName, topicA: infoA.topic });
    } else if (infoB) {
      // B only
      const w = weights[infoB.strength] ?? 0.5;
      totalWeightB += w;
      bOnly.push({ nodeId, nodeName, topicB: infoB.topic });
    }
  }

  // Metrics
  const unionCount = aOnly.length + bOnly.length + shared.length;
  const jaccardUnweighted = unionCount > 0 ? shared.length / unionCount : 0;
  const totalWeight = totalWeightA + totalWeightB - totalWeightShared;
  const jaccardWeighted = totalWeight > 0 ? totalWeightShared / totalWeight : 0;
  const coverageA = totalWeightA > 0 ? totalWeightShared / totalWeightA : 0;
  const coverageB = totalWeightB > 0 ? totalWeightShared / totalWeightB : 0;

  return {
    subjectA,
    subjectB,
    totalNodesA: nodesA.size,
    totalNodesB: nodesB.size,
    sharedNodes: shared.sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
    aOnlyNodes: aOnly.sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
    bOnlyNodes: bOnly.sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
    jaccardUnweighted,
    jaccardWeighted,
    coverageA,
    coverageB,
  };
}

interface NodeMappingInfo {
  strength: "exact" | "strong" | "partial" | "weak";
  topic: string;
}

/** Collect all mapped nodeIds from a mapping file, optionally filtered by paper. */
function collectMappedNodes(
  mapping: MappingFile,
  paperFilter: string | null
): Map<string, NodeMappingInfo> {
  const result = new Map<string, NodeMappingInfo>();

  for (const topic of mapping.mappings) {
    // Skip if paper filter doesn't match
    if (paperFilter && topic.paperReference && !topic.paperReference.includes(paperFilter)) {
      continue;
    }

    for (const sub of topic.subtopicMappings) {
      // Skip if paper filter doesn't match subtopic paper reference
      if (paperFilter && sub.paperReference && !sub.paperReference.includes(paperFilter)) {
        continue;
      }

      for (const mn of sub.mappedNodes) {
        const existing = result.get(mn.nodeId);
        // Keep the strongest match
        const strengthOrder = ["exact", "strong", "partial", "weak"] as const;
        if (!existing || strengthOrder.indexOf(mn.matchStrength) < strengthOrder.indexOf(existing.strength)) {
          result.set(mn.nodeId, {
            strength: mn.matchStrength,
            topic: topic.topicName,
          });
        }
      }
    }
  }

  return result;
}

// ── Validator ──

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ code: string; message: string; entity?: string }>;
  warnings: Array<{ code: string; message: string; entity?: string }>;
}

/** Validate a knowledge tree. */
export function validateTree(tree: KnowledgeTree): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  // 1. nodeId uniqueness
  const nodeIds = new Map<string, number>();
  for (const node of tree.nodes) {
    nodeIds.set(node.nodeId, (nodeIds.get(node.nodeId) ?? 0) + 1);
  }
  for (const [id, count] of nodeIds) {
    if (count > 1) {
      errors.push({ code: "DUPLICATE_NODE_ID", message: `nodeId "${id}" appears ${count} times`, entity: id });
    }
  }

  // 2. Parent exists
  const nodeIdSet = new Set(tree.nodes.map((n) => n.nodeId));
  for (const node of tree.nodes) {
    if (node.parentNodeId && !nodeIdSet.has(node.parentNodeId)) {
      errors.push({ code: "MISSING_PARENT", message: `parentNodeId "${node.parentNodeId}" of "${node.nodeId}" does not exist`, entity: node.nodeId });
    }
  }

  // 3. No cycles
  for (const node of tree.nodes) {
    const visited = new Set<string>();
    let current: string | undefined = node.nodeId;
    while (current) {
      if (visited.has(current)) {
        errors.push({ code: "CYCLE_DETECTED", message: `Cycle detected involving "${current}"`, entity: current });
        break;
      }
      visited.add(current);
      const n = tree.nodes.find((x) => x.nodeId === current);
      current = n?.parentNodeId;
    }
  }

  // 4. Path consistency
  for (const node of tree.nodes) {
    if (node.path.length === 0 && node.level > 0) {
      warnings.push({ code: "EMPTY_PATH", message: `node "${node.nodeId}" has empty path but level > 0`, entity: node.nodeId });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Validate a mapping file against a tree. */
export function validateMapping(mapping: MappingFile, tree: KnowledgeTree): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  const nodeIdSet = new Set(tree.nodes.map((n) => n.nodeId));

  // Check all mapped nodeIds exist in tree
  for (const topic of mapping.mappings) {
    for (const sub of topic.subtopicMappings) {
      for (const mn of sub.mappedNodes) {
        if (!nodeIdSet.has(mn.nodeId)) {
          errors.push({
            code: "UNKNOWN_NODE_ID",
            message: `mapped nodeId "${mn.nodeId}" in ${topic.topicName}/${sub.subtopicName} does not exist in tree`,
            entity: mn.nodeId,
          });
        }
      }
    }
  }

  // Check topic counts
  const actualTopics = mapping.mappings.length;
  if (actualTopics !== mapping.totalTopics) {
    warnings.push({
      code: "TOPIC_COUNT_MISMATCH",
      message: `totalTopics=${mapping.totalTopics} but actual=${actualTopics}`,
      entity: mapping.subjectCode,
    });
  }

  // Check mapped topics
  const mappedTopics = mapping.mappings.filter((t) =>
    t.subtopicMappings.some((s) => s.mappedNodes.length > 0)
  ).length;
  if (mappedTopics !== mapping.mappedTopics) {
    warnings.push({
      code: "MAPPED_TOPIC_COUNT_MISMATCH",
      message: `mappedTopics=${mapping.mappedTopics} but actual=${mappedTopics}`,
      entity: mapping.subjectCode,
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
