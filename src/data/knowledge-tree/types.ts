export interface KnowledgeTreeNode {
  nodeId: string;
  /** Human-readable node label from the unified knowledge tree. */
  name?: string;
  path: string[];
  level: number;
  /** Top-level teaching domain, for example Number or Geometry. */
  domain?: string;
  description: string;
  parentNodeId?: string;
  childNodeIds?: string[];
  relatedNodes?: string[];
  tags?: string[];
}

export interface KnowledgeTree {
  treeId: string;
  treeName: string;
  version: string;
  phase: string;
  description: string;
  metadata: {
    totalNodes: number;
    maxDepth: number;
    domains: string[];
    stages: string[];
    subjects: string[];
    examBoards: string[];
    createdBy: string;
    createdAt: string;
  };
  levels: { level: number; name: string; description: string }[];
  nodes: KnowledgeTreeNode[];
}

export interface MappingEntry {
  topicId: string;
  topicName: string;
  topicCategory: string;
  paperReference?: string;
  mappedNodes: {
    nodeId: string;
    matchStrength: "exact" | "strong" | "partial";
    matchReason: string;
  }[];
}

export interface SubjectMapping {
  board: string;
  subjectCode: string;
  subjectName: string;
  knowledgeTreeVersion: string;
  totalTopics: number;
  mappedTopics: number;
  unmappedTopics: number;
  mappingRate: number;
  mappings: MappingEntry[];
  unmapped: { topicId: string; topicName: string; reason: string }[];
}

export interface OverlapSummary {
  unweighted: { overlap: number; total: number; percentage: number };
  weighted: { overlap: number; total: number; percentage: number };
}

export interface OverlapData {
  version: string;
  comparison: {
    A: string;
    B: string;
    topicCountA: number;
    topicCountB: number;
  };
  summary: {
    AtoB: { name: string; unweighted: { overlap: number; total: number; percentage: number }; weighted: { overlap: number; total: number; percentage: number } };
    BtoA: { name: string; unweighted: { overlap: number; total: number; percentage: number }; weighted: { overlap: number; total: number; percentage: number } };
    symmetric: { unweighted: number; weighted: number };
  };
  details: {
    AtoB: { topicId: string; topicName?: string; hasOverlap: boolean; overlappingTopicsB: string[]; sharedNodes: string[]; nodeCount: number }[];
    BtoA: { topicId: string; topicName?: string; hasOverlap: boolean; overlappingTopicsA: string[]; sharedNodes: string[]; nodeCount: number }[];
  };
}

export interface SyllabusTopic {
  topicId: string;
  topicName: string;
  topicCategory: string;
  paperReferences: string[];
  description: string;
  subtopics: string[];
}

export interface SubjectSyllabus {
  board: string;
  subjectCode: string;
  subjectName: string;
  level: string;
  syllabusYear: string;
  sourceUrl: string;
  totalPapers: number;
  papers: { paperCode: string; paperName: string; topics: number[] }[];
  topics: SyllabusTopic[];
}
