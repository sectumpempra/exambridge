/**
 * Knowledge Tree v2 — Zod Schemas
 *
 * Canonical schemas for knowledge tree, mapping files, and manifest.
 * Used for runtime validation and TypeScript type inference.
 */

import { z } from "zod";

// ── Match Strength ──

export const MatchStrengthSchema = z.enum(["exact", "strong", "partial", "weak"]);

export type MatchStrength = z.infer<typeof MatchStrengthSchema>;

// ── Knowledge Tree Node ──

export const KnowledgeTreeNodeSchema = z.object({
  nodeId: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().min(0).max(10),
  domain: z.string().optional(),
  area: z.string().optional(),
  parentNodeId: z.string().optional(),
  path: z.array(z.string()),
  description: z.string().optional(),
  stage: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type KnowledgeTreeNode = z.infer<typeof KnowledgeTreeNodeSchema>;

// ── Knowledge Tree ──

export const KnowledgeTreeSchema = z.object({
  version: z.string().min(1),
  description: z.string().optional(),
  metadata: z.object({
    totalNodes: z.number().int().nonnegative(),
    maxDepth: z.number().int().nonnegative(),
    domains: z.array(z.string()).optional(),
  }).optional(),
  nodes: z.array(KnowledgeTreeNodeSchema),
});

export type KnowledgeTree = z.infer<typeof KnowledgeTreeSchema>;

// ── Mapping File ──

export const MappedNodeSchema = z.object({
  nodeId: z.string().min(1),
  matchStrength: MatchStrengthSchema,
  matchReason: z.string().min(1),
});

export type MappedNode = z.infer<typeof MappedNodeSchema>;

export const SubtopicMappingSchema = z.object({
  subtopicId: z.string().min(1),
  subtopicName: z.string().min(1),
  description: z.string().optional(),
  paperReference: z.array(z.string()).nullable(),
  mappedNodes: z.array(MappedNodeSchema),
});

export type SubtopicMapping = z.infer<typeof SubtopicMappingSchema>;

export const TopicMappingSchema = z.object({
  topicId: z.string().min(1),
  topicName: z.string().min(1),
  paperReference: z.array(z.string()).nullable(),
  subtopicMappings: z.array(SubtopicMappingSchema),
});

export type TopicMapping = z.infer<typeof TopicMappingSchema>;

export const PaperStructureSchema = z.object({
  papers: z.array(z.string()),
  compulsory: z.array(z.string()).optional(),
  applicationGroups: z.array(z.array(z.string())).optional(),
  mutuallyExclusive: z.array(z.array(z.string())).optional(),
  asOnly: z.array(z.string()).optional(),
  alevelOnly: z.array(z.string()).optional(),
});

export type PaperStructure = z.infer<typeof PaperStructureSchema>;

export const MappingFileSchema = z.object({
  board: z.string().min(1),
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  level: z.string().min(1),
  version: z.string().min(1),
  totalTopics: z.number().int().nonnegative(),
  mappedTopics: z.number().int().nonnegative(),
  totalSubtopics: z.number().int().nonnegative().optional(),
  mappedSubtopics: z.number().int().nonnegative().optional(),
  paperStructure: PaperStructureSchema.optional(),
  mappings: z.array(TopicMappingSchema),
});

export type MappingFile = z.infer<typeof MappingFileSchema>;

// ── Knowledge Manifest ──

export const KnowledgeManifestEntrySchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  boardId: z.string().min(1),
  qualificationId: z.string().optional(),
  path: z.string().min(1),
  version: z.string().min(1),
  sha256: z.string().length(64),
  topicCount: z.number().int().nonnegative(),
});

export type KnowledgeManifestEntry = z.infer<typeof KnowledgeManifestEntrySchema>;

export const KnowledgeManifestSchema = z.object({
  schemaVersion: z.string().default("2.0.0"),
  generatedAt: z.string().datetime(),
  tree: z.object({
    path: z.string().min(1),
    version: z.string().min(1),
    sha256: z.string().length(64),
    nodeCount: z.number().int().nonnegative(),
  }),
  mappings: z.array(KnowledgeManifestEntrySchema),
});

export type KnowledgeManifest = z.infer<typeof KnowledgeManifestSchema>;

// ── Subject Info ──

export const SubjectInfoSchema = z.object({
  id: z.string().min(1),        // e.g. "CAIE-9709"
  board: z.string().min(1),
  subjectCode: z.string().min(1),
  name: z.string().min(1),
  level: z.string().min(1),
  hasPapers: z.boolean(),
  papers: z.array(z.string()),
  isGCSE: z.boolean(),
});

export type SubjectInfo = z.infer<typeof SubjectInfoSchema>;

// ── Overlap ──

export const OverlapInputSchema = z.object({
  subjectA: z.string().min(1),
  subjectB: z.string().min(1),
  paperA: z.string().nullable().optional(),
  paperB: z.string().nullable().optional(),
});

export type OverlapInput = z.infer<typeof OverlapInputSchema>;

export const OverlapDetailSchema = z.object({
  nodeId: z.string(),
  nodeName: z.string(),
  matchStrength: MatchStrengthSchema,
  topicA: z.string(),
  topicB: z.string(),
});

export const OverlapResultSchema = z.object({
  subjectA: z.string(),
  subjectB: z.string(),
  totalNodesA: z.number().int(),
  totalNodesB: z.number().int(),
  sharedNodes: z.array(OverlapDetailSchema),
  aOnlyNodes: z.array(z.object({ nodeId: z.string(), nodeName: z.string(), topicA: z.string() })),
  bOnlyNodes: z.array(z.object({ nodeId: z.string(), nodeName: z.string(), topicB: z.string() })),
  // Metrics
  jaccardUnweighted: z.number(),
  jaccardWeighted: z.number(),
  coverageA: z.number(),
  coverageB: z.number(),
});

export type OverlapResult = z.infer<typeof OverlapResultSchema>;
