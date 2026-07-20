import {
  KnowledgeMappingV5Schema,
  KnowledgeOntologyV5Schema,
  compareKnowledgeMappingsV5,
  type KnowledgeComparisonV5,
  type KnowledgeMappingV5,
} from "@/domain-v2/knowledge-tree";
import type { ExclusiveSubtopicItem, SubjectInfoV32 } from "./types-v3.2";
import type { KnowledgeTreeNode } from "./types";

export interface KnowledgeV5ManifestEntry {
  code: string;
  qualificationVersionId: string;
  board: string;
  subjectCode: string;
  subjectName: string;
  level: string;
  papers: string[];
  paperDefinitions: Array<{ paperId: string; code: string; name: string; tiers: string[] }>;
  paperMappingCoverage: number;
  paperComparisonReady: boolean;
  mappingUrl: string;
}

export interface KnowledgeV5Manifest {
  schemaVersion: "5.0.0";
  activeBatch: string;
  ontologyUrl: string;
  treeUrl: string;
  ontologyNodeCount: number;
  treeVersion: string;
  mappings: KnowledgeV5ManifestEntry[];
}

export interface KnowledgeV5ComparisonPayload {
  result: KnowledgeComparisonV5;
  aItems: ExclusiveSubtopicItem[];
  bItems: ExclusiveSubtopicItem[];
}

let manifestPromise: Promise<KnowledgeV5Manifest> | null = null;
let ontologyPromise: Promise<ReturnType<typeof KnowledgeOntologyV5Schema.parse>> | null = null;
let treePromise: Promise<KnowledgeTreeNode[]> | null = null;
const mappingPromises = new Map<string, Promise<KnowledgeMappingV5>>();

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

export async function loadKnowledgeV5Manifest(): Promise<KnowledgeV5Manifest> {
  manifestPromise ??= fetch("/data/knowledge-v5/manifest.json").then(async (response) => {
    if (!response.ok) throw new Error(`${response.status} /data/knowledge-v5/manifest.json`);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("json")) {
      throw new Error(`Unexpected content type for Knowledge V5 manifest: ${contentType}`);
    }
    const value = await response.json();
    if (value?.schemaVersion !== "5.0.0"
      || !Array.isArray(value.mappings)
      || value.mappings.some((entry: Partial<KnowledgeV5ManifestEntry>) => !Array.isArray(entry.papers)
        || !Array.isArray(entry.paperDefinitions)
        || new Set(entry.papers).size !== entry.papers.length
        || new Set(entry.paperDefinitions.map((paper) => paper.paperId)).size !== entry.paperDefinitions.length
        || entry.paperDefinitions.length !== entry.papers.length
        || entry.paperDefinitions.some((paper) => !entry.papers?.includes(paper.paperId) || !paper.code || !paper.name || !Array.isArray(paper.tiers)))
      || !Number.isInteger(value.ontologyNodeCount)
      || value.ontologyNodeCount <= 0
      || typeof value.treeUrl !== "string"
      || typeof value.treeVersion !== "string") throw new Error("Invalid Knowledge V5 manifest");
    return value as KnowledgeV5Manifest;
  });
  return manifestPromise;
}

export async function loadKnowledgeV5Tree(manifest: KnowledgeV5Manifest): Promise<KnowledgeTreeNode[]> {
  treePromise ??= fetchJson(manifest.treeUrl).then((value) => {
    if (value?.version !== manifest.treeVersion
      || !Array.isArray(value.nodes)
      || value.nodes.length !== manifest.ontologyNodeCount) throw new Error("Invalid Knowledge V5 tree");
    return value.nodes as KnowledgeTreeNode[];
  });
  return treePromise;
}

async function loadOntology(manifest: KnowledgeV5Manifest) {
  ontologyPromise ??= fetchJson(manifest.ontologyUrl).then((value) => KnowledgeOntologyV5Schema.parse(value));
  return ontologyPromise;
}

async function loadMapping(entry: KnowledgeV5ManifestEntry): Promise<KnowledgeMappingV5> {
  let promise = mappingPromises.get(entry.qualificationVersionId);
  if (!promise) {
    promise = fetchJson(entry.mappingUrl).then((value) => KnowledgeMappingV5Schema.parse(value));
    mappingPromises.set(entry.qualificationVersionId, promise);
  }
  return promise;
}

export async function listSubjectsV5(): Promise<SubjectInfoV32[]> {
  const manifest = await loadKnowledgeV5Manifest();
  return manifest.mappings.map((entry) => ({
    code: entry.code,
    board: entry.board,
    subjectCode: entry.subjectCode,
    name: entry.subjectName,
    level: entry.level,
    hasPapers: entry.papers.length > 0,
    papers: entry.papers,
    paperOptions: entry.paperDefinitions.map((paper) => ({ id: paper.paperId, code: paper.code, name: paper.name, tiers: paper.tiers })),
    isGCSE: /GCSE|IGCSE/i.test(entry.level),
    paperMappingCoverage: entry.paperMappingCoverage,
    paperComparisonReady: entry.paperComparisonReady,
    comparisonReady: true,
    verificationStatus: "verified",
  }));
}

function toDisplayItems(
  comparisons: KnowledgeComparisonV5["aStatements"],
  mapping: KnowledgeMappingV5,
  ontology: ReturnType<typeof KnowledgeOntologyV5Schema.parse>,
  paperDefinitions: KnowledgeV5ManifestEntry["paperDefinitions"],
): ExclusiveSubtopicItem[] {
  const semanticById = new Map(ontology.nodes.map((node) => [node.nodeId, node]));
  const paperLabelById = new Map(paperDefinitions.map((paper) => [paper.paperId, `${paper.code} · ${paper.name}`]));
  return comparisons.map((item) => {
    const source = mapping.sources[0];
    const paperRef = item.statement.paperApplicability.kind === "not-specified"
      ? null
      : item.statement.paperApplicability.papers.map((paperId) => paperLabelById.get(paperId) ?? paperId);
    return {
      subtopicId: item.statement.statementId,
      subtopicName: item.statement.statementText,
      topicName: item.statement.topicHeading,
      paperRef,
      comparisonStatus: item.status,
      syllabusVersion: mapping.syllabusVersion,
      sectionId: item.statement.sectionId,
      printedPage: item.statement.printedPage,
      pdfPage: item.statement.pdfPage,
      sourceUrl: source.url,
      sourceLocator: item.statement.sourceLocator,
      notesText: item.statement.notesText,
      examplesText: item.statement.examplesText,
      tiers: item.statement.tiers,
      routes: item.statement.routes,
      conceptLabels: item.statement.conceptLinks.map((link) => semanticById.get(link.nodeId)?.definition ?? link.nodeId),
      dimensionLabels: [...new Set(item.statement.conceptLinks
        .map((link) => semanticById.get(link.nodeId)?.dimension)
        .filter((value): value is "2d" | "3d" | "mixed" => value === "2d" || value === "3d" || value === "mixed"))],
      decisionReason: item.reason,
    };
  });
}

export async function calculateKnowledgeV5Comparison(
  codeA: string,
  codeB: string,
  paperA: string | null = null,
  paperB: string | null = null,
): Promise<KnowledgeV5ComparisonPayload> {
  const manifest = await loadKnowledgeV5Manifest();
  const entryA = manifest.mappings.find((entry) => entry.code === codeA);
  const entryB = manifest.mappings.find((entry) => entry.code === codeB);
  if (!entryA || !entryB) throw new Error(`Knowledge V5 mapping is unavailable for ${codeA} or ${codeB}.`);
  const [mappingA, mappingB, ontology] = await Promise.all([loadMapping(entryA), loadMapping(entryB), loadOntology(manifest)]);
  const result = compareKnowledgeMappingsV5(mappingA, mappingB, ontology.nodes, paperA, paperB);
  return {
    result,
    aItems: toDisplayItems(result.aStatements, mappingA, ontology, entryA.paperDefinitions),
    bItems: toDisplayItems(result.bStatements, mappingB, ontology, entryB.paperDefinitions),
  };
}

export function clearKnowledgeV5Cache() {
  manifestPromise = null;
  ontologyPromise = null;
  treePromise = null;
  mappingPromises.clear();
}
