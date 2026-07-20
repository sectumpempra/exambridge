/** v3.2 Knowledge Tree Types */

export interface KnowledgeTreeV32 {
  version: string;
  description: string;
  nodes: KnowledgeTreeNodeV32[];
}

export interface KnowledgeTreeNodeV32 {
  nodeId: string;
  name: string;
  level: number;
  domain?: string;
  area?: string;
  parentNodeId?: string;
  path: string[];
  description?: string;
  stage?: string[];
  tags?: string[];
}

/** Mapped node reference inside a subtopic mapping */
export interface MappedNode {
  nodeId: string;
  matchStrength: "exact" | "strong" | "partial" | "weak";
  matchReason: string;
}

/** Subtopic-level mapping */
export interface SubtopicMapping {
  subtopicId: string;
  subtopicName: string;
  description?: string;
  paperReference: string[] | null;
  paperApplicabilityKind?: "fixed" | "eligible" | "not-specified";
  eligiblePaperReference?: string[];
  mappedNodes: MappedNode[];
}

/** Exclusive subtopic item (for display) */
export interface ExclusiveSubtopicItem {
  subtopicId: string;
  subtopicName: string;
  description?: string;
  topicName: string;
  paperRef: string[] | null;
  comparisonStatus?: "shared" | "partial" | "exclusive" | "unresolved" | "non-comparable";
  syllabusVersion?: string;
  sectionId?: string;
  printedPage?: number;
  pdfPage?: number;
  sourceUrl?: string;
  sourceLocator?: string;
  notesText?: string[];
  examplesText?: string[];
  tiers?: string[];
  routes?: string[];
  conceptLabels?: string[];
  dimensionLabels?: string[];
  decisionReason?: string;
}

/** Topic-level mapping */
export interface TopicMapping {
  topicId: string;
  topicName: string;
  paperReference: string[] | null;
  subtopicMappings: SubtopicMapping[];
}

/** Paper structure metadata for A-Level subjects */
export interface PaperStructure {
  papers: string[];
  compulsory?: string[];
  applicationGroups?: string[][];
  mutuallyExclusive?: string[][];
  asOnly?: string[];
  alevelOnly?: string[];
}

/** Full mapping file for a subject */
export interface MappingFile {
  board: string;
  subjectCode: string;
  subjectName: string;
  level: string;
  version: string;
  totalTopics: number;
  mappedTopics: number;
  paperStructure?: PaperStructure;
  sourceUrl?: string;
  syllabusVersion?: string;
  verificationStatus?: "verified" | "candidate" | "rejected";
  sourceSchemaVersion?: "4.0.0";
  qualificationVersionId?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  approval?: { approvedAt: string; approvalBatch: string };
  mappings: TopicMapping[];
}

/** Subject info derived from mapping files */
export interface SubjectInfoV32 {
  code: string;       // e.g. "CAIE-9709"
  board: string;      // e.g. "CAIE"
  subjectCode: string; // e.g. "9709"
  name: string;       // e.g. "A-Level Mathematics"
  level: string;      // e.g. "A-Level"
  hasPapers: boolean; // true if paperStructure exists
  papers: string[];   // list of paper codes
  paperOptions: Array<{ id: string; code: string; name: string; tiers: string[] }>;
  isGCSE: boolean;
  paperMappingCoverage: number;
  paperComparisonReady: boolean;
  /** Exact comparisons are only safe after owner-approved/verified review. */
  comparisonReady: boolean;
  verificationStatus: "verified" | "candidate" | "rejected";
}

export interface PaperMappingReadiness {
  ready: boolean;
  coverage: number;
  referencedSubtopics: number;
  totalSubtopics: number;
  invalidReferences: string[];
  reason?: string;
}

/** Paper selection for a subject */
export interface PaperSelection {
  subjectCode: string;
  paper: string | null; // null = whole subject
}

/** Comparison mode */
export type CompareMode = "subject-vs-subject" | "paper-vs-paper" | "paper-vs-subject";

/** Overlap calculation result */
export interface OverlapResultV32 {
  subjectA: string;
  subjectB: string;
  paperA: string | null;
  paperB: string | null;
  mode: CompareMode;
  unweighted: number;
  weighted: number;
  sharedNodes: string[];
  aOnlyNodes: string[];
  bOnlyNodes: string[];
  sharedCount: number;
  aTotal: number;
  bTotal: number;
  aName: string;
  bName: string;
}
