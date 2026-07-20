import { readFile } from "node:fs/promises";
import path from "node:path";
import { COURSE_CATALOG } from "@/course-context/catalog";
import {
  EXAM_OVERVIEW_CATALOG,
  examOverviewIdForCourse,
  type ExamOverview,
} from "@/domain-v2/exam-overview";
import type { CourseContextEntry } from "@/course-context/types";
import {
  KnowledgeMappingV5Schema,
  KnowledgeOntologyV5Schema,
  compareKnowledgeMappingsV5,
  type CanonicalNodeSemanticsV5,
  type KnowledgeMappingV5,
  type StatementComparisonV5,
} from "@/domain-v2/knowledge-tree";
import type {
  AICitation,
  AIChatRequest,
  AIResolvedContext,
} from "@/domain-v2/ai-assistant";

type KnowledgeManifestEntry = {
  code: string;
  qualificationVersionId: string;
  board: string;
  subjectCode: string;
  subjectName: string;
  level: string;
  mappingUrl: string;
  papers: string[];
  paperDefinitions?: Array<{ paperId: string; code: string; name: string; tiers: string[] }>;
};

type KnowledgeManifest = {
  schemaVersion: string;
  activeBatch: string;
  ontologyUrl: string;
  mappings: KnowledgeManifestEntry[];
};

type SourceRegistry = {
  add: (source: Omit<AICitation, "sourceId">) => string;
  list: () => AICitation[];
};

export type AIContextBuildResult = {
  promptContext: string;
  sources: AICitation[];
  resolvedContext: AIResolvedContext;
  clarification?: string;
};

const MAX_PROMPT_CONTEXT_CHARACTERS = 52_000;
const MAX_SHARED_CONCEPTS = 32;
const MAX_STATEMENT_ITEMS_PER_SIDE = 12;

function createSourceRegistry(): SourceRegistry {
  const citations: AICitation[] = [];
  const byKey = new Map<string, string>();
  return {
    add(source) {
      const key = `${source.url}|${source.dataVersion}`;
      const existing = byKey.get(key);
      if (existing) return existing;
      const sourceId = `S${citations.length + 1}`;
      citations.push({ sourceId, ...source });
      byKey.set(key, sourceId);
      return sourceId;
    },
    list: () => citations,
  };
}

function normalizedToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function normalizedBoard(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("cambridge") || normalized === "caie") return "caie";
  if (normalized.includes("pearson") || normalized.includes("edexcel")) return "edexcel";
  return normalized.replace(/[^a-z0-9]+/g, "");
}

export function overviewIdentityMatches(
  course: Pick<CourseContextEntry, "boardName" | "subjectCode">,
  overview: Pick<ExamOverview, "board" | "code">,
): boolean {
  if (normalizedBoard(course.boardName) !== normalizedBoard(overview.board)) return false;
  const courseCode = normalizedToken(course.subjectCode);
  return overview.code.split(/[\/·,|]+/).some((part) => normalizedToken(part) === courseCode);
}

function overviewForCourse(course: CourseContextEntry): ExamOverview | undefined {
  return EXAM_OVERVIEW_CATALOG.find((overview) => overviewIdentityMatches(course, overview))
    ?? EXAM_OVERVIEW_CATALOG.find((overview) => overview.id === examOverviewIdForCourse(course));
}

function words(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function containsAqaOriginalText(message: string, mapping: KnowledgeMappingV5): boolean {
  const messageWords = words(message);
  if (messageWords.length === 0) return false;
  const normalizedMessage = ` ${messageWords.join(" ")} `;
  return mapping.statements.some((statement) => {
    const statementWords = words(statement.statementText);
    if (statementWords.length === 0) return false;
    if (statementWords.length < 6) {
      const phrase = statementWords.join(" ");
      return phrase.length >= 18 && normalizedMessage.includes(` ${phrase} `);
    }
    for (let index = 0; index <= statementWords.length - 6; index += 1) {
      if (normalizedMessage.includes(` ${statementWords.slice(index, index + 6).join(" ")} `)) return true;
    }
    return false;
  });
}

function latestUserMessage(request: AIChatRequest): string {
  return [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function messageExplicitlyNamesCode(message: string, code: string): boolean {
  const normalizedCode = normalizedToken(code);
  if (normalizedCode.length < 3) return false;
  const normalizedMessage = normalizedToken(message);
  return normalizedMessage.includes(normalizedCode);
}

function trimArray<T>(items: T[], limit: number): { items: T[]; omitted: number } {
  return { items: items.slice(0, limit), omitted: Math.max(0, items.length - limit) };
}

function appliesToPaper(statement: KnowledgeMappingV5["statements"][number], paperId: string | null): boolean {
  if (!paperId) return true;
  return statement.paperApplicability.kind !== "not-specified"
    && statement.paperApplicability.papers.includes(paperId);
}

export class AIContextBuilder {
  private readonly publicRoot: string;
  private manifestPromise: Promise<KnowledgeManifest> | null = null;
  private ontologyPromise: Promise<CanonicalNodeSemanticsV5[]> | null = null;
  private mappingPromises = new Map<string, Promise<KnowledgeMappingV5>>();

  constructor(root = process.env.EXAMBRIDGE_DATA_ROOT ?? process.cwd()) {
    this.publicRoot = path.resolve(process.env.EXAMBRIDGE_PUBLIC_ROOT ?? path.join(root, "public"));
  }

  private publicPath(url: string): string {
    if (!url.startsWith("/data/")) throw new Error("AI context can only read published data paths");
    return path.join(this.publicRoot, url.slice(1));
  }

  private async readJson(url: string): Promise<unknown> {
    return JSON.parse(await readFile(this.publicPath(url), "utf8"));
  }

  private loadManifest(): Promise<KnowledgeManifest> {
    this.manifestPromise ??= this.readJson("/data/knowledge-v5/manifest.json").then((value) => {
      const manifest = value as KnowledgeManifest;
      if (manifest.schemaVersion !== "5.0.0" || !manifest.activeBatch || !Array.isArray(manifest.mappings)) {
        throw new Error("Knowledge V5 manifest is not an active approved release");
      }
      return manifest;
    });
    return this.manifestPromise;
  }

  private async loadOntology(manifest: KnowledgeManifest): Promise<CanonicalNodeSemanticsV5[]> {
    this.ontologyPromise ??= this.readJson(manifest.ontologyUrl).then((value) => {
      const ontology = KnowledgeOntologyV5Schema.parse(value);
      if (ontology.reviewStatus !== "owner-approved") throw new Error("Knowledge ontology is not approved");
      return ontology.nodes;
    });
    return this.ontologyPromise;
  }

  private loadMapping(entry: KnowledgeManifestEntry): Promise<KnowledgeMappingV5> {
    const cached = this.mappingPromises.get(entry.code);
    if (cached) return cached;
    const promise = this.readJson(entry.mappingUrl).then((value) => {
      const mapping = KnowledgeMappingV5Schema.parse(value);
      if (mapping.reviewStatus !== "owner-approved") throw new Error(`${entry.code} mapping is not approved`);
      return mapping;
    });
    this.mappingPromises.set(entry.code, promise);
    return promise;
  }

  private resolveCourseEntries(request: AIChatRequest) {
    const result = [] as typeof COURSE_CATALOG;
    const seen = new Set<string>();
    const add = (entry: (typeof COURSE_CATALOG)[number] | undefined) => {
      if (!entry || result.length >= 2) return;
      const canonicalKey = overviewForCourse(entry)?.id ?? entry.knowledgeTreeCode ?? entry.qualificationId;
      if (seen.has(canonicalKey)) return;
      seen.add(canonicalKey);
      result.push(entry);
    };

    request.qualificationIds.forEach((id) => add(COURSE_CATALOG.find((entry) => entry.qualificationId === id)));
    request.resolvedContext?.qualificationIds.forEach((id) => add(COURSE_CATALOG.find((entry) => entry.qualificationId === id)));

    const message = latestUserMessage(request);
    COURSE_CATALOG
      .filter((entry) => messageExplicitlyNamesCode(message, entry.subjectCode))
      .sort((a, b) => Number(Boolean(b.capabilities.examOverview.href)) - Number(Boolean(a.capabilities.examOverview.href)))
      .forEach(add);
    return result;
  }

  private resolveKnowledgeEntries(
    request: AIChatRequest,
    manifest: KnowledgeManifest,
    courses: typeof COURSE_CATALOG,
  ): KnowledgeManifestEntry[] {
    const result: KnowledgeManifestEntry[] = [];
    const seen = new Set<string>();
    const add = (entry: KnowledgeManifestEntry | undefined) => {
      if (!entry || seen.has(entry.code) || result.length >= 2) return;
      seen.add(entry.code);
      result.push(entry);
    };

    request.pageContext.comparisonIds.forEach((code) => add(manifest.mappings.find((entry) => entry.code === code)));
    request.resolvedContext?.qualificationCodes.forEach((code) => add(manifest.mappings.find((entry) => entry.code === code)));
    courses.forEach((course) => add(manifest.mappings.find((entry) => entry.code === course.knowledgeTreeCode)));

    const message = latestUserMessage(request);
    manifest.mappings
      .filter((entry) => messageExplicitlyNamesCode(message, entry.code) || messageExplicitlyNamesCode(message, entry.subjectCode))
      .forEach(add);
    return result;
  }

  private addOverviewContext(
    courses: typeof COURSE_CATALOG,
    sources: SourceRegistry,
  ) {
    return courses.flatMap((course) => {
      const overview = overviewForCourse(course);
      if (!overview) return [];
      const materials = overview.materials.map((material) => ({
        type: material.type,
        title: material.title,
        status: material.status,
        sourceId: sources.add({ title: material.title, url: material.officialUrl, dataVersion: material.version }),
      }));
      const sourceIdsByType = (types: Array<(typeof overview.materials)[number]["type"]>) => {
        const ids = materials.filter((material) => types.includes(material.type)).map((material) => material.sourceId);
        return ids.length > 0 ? ids : materials.map((material) => material.sourceId);
      };
      return [{
        materials,
        factSourceIds: {
          qualificationAndComponents: sourceIdsByType(["syllabus", "reference-document"]),
          schedule: sourceIdsByType(["timetable", "update-notice"]),
          calculator: sourceIdsByType(["syllabus", "reference-document"]),
          formula: sourceIdsByType(["formula", "syllabus", "reference-document"]),
          practical: sourceIdsByType(["practical-guidance", "syllabus", "reference-document"]),
        },
        board: overview.board,
        qualification: overview.qualification,
        code: overview.code,
        region: overview.region,
        examSeries: overview.examSeries,
        paperCount: overview.paperCount,
        nextExam: overview.nextExam,
        components: overview.components,
        routes: overview.routes,
        qualificationViews: overview.qualificationViews,
        calculator: overview.calculator,
        formula: overview.formula,
        practical: overview.practical,
        upcomingSeries: overview.upcomingSeries,
        timetableStatus: overview.timetableStatus,
        upcomingExams: overview.upcomingExams,
        verifiedAt: overview.release.verifiedAt,
        releaseStatus: overview.release.status,
      }];
    });
  }

  private safeStatementItem(
    item: StatementComparisonV5,
    mapping: KnowledgeMappingV5,
    semantics: Map<string, CanonicalNodeSemanticsV5>,
  ) {
    const concepts = item.statement.conceptLinks.map((link) => {
      const node = semantics.get(link.nodeId);
      return {
        nodeId: link.nodeId,
        relation: link.relation,
        definition: node?.definition,
        aliases: node?.aliases ?? [],
        dimension: node?.dimension,
        objectScopes: node?.objectScopes ?? [],
      };
    });
    const shared = {
      statementId: item.statement.statementId,
      status: item.status,
      reason: item.reason,
      concepts,
      tiers: item.statement.tiers,
      routes: item.statement.routes,
      paperApplicability: item.statement.paperApplicability,
    };
    if (mapping.board === "AQA") return shared;
    return {
      ...shared,
      topicHeading: item.statement.topicHeading,
      statementText: item.statement.statementText,
      printedPage: item.statement.printedPage,
      pdfPage: item.statement.pdfPage,
    };
  }

  private async addKnowledgeContext(
    entries: KnowledgeManifestEntry[],
    manifest: KnowledgeManifest,
    selectedPaperIds: Array<string | null>,
    sources: SourceRegistry,
  ) {
    if (entries.length === 0) return undefined;
    const ontology = await this.loadOntology(manifest);
    const semantics = new Map(ontology.map((node) => [node.nodeId, node]));
    const mappings = await Promise.all(entries.map((entry) => this.loadMapping(entry)));
    const sourceIds = new Map<string, string[]>();
    mappings.forEach((mapping) => sourceIds.set(mapping.qualificationVersionId, mapping.sources.map((source) => sources.add({
      title: source.title,
      url: source.url,
      dataVersion: source.documentVersion,
    }))));

    if (mappings.length === 1) {
      const paperId = selectedPaperIds[0] ?? null;
      const mapping = mappings[0];
      const concepts = new Map<string, CanonicalNodeSemanticsV5>();
      for (const statement of mapping.statements) {
        if (!appliesToPaper(statement, paperId) || statement.statementType !== "assessable-content") continue;
        for (const link of statement.conceptLinks) {
          const semantic = semantics.get(link.nodeId);
          if (semantic?.comparisonEligible && semantic.reviewStatus === "owner-approved") concepts.set(link.nodeId, semantic);
        }
      }
      return {
        mode: "single-qualification",
        activeBatch: manifest.activeBatch,
        qualification: {
          code: entries[0].code,
          qualificationVersionId: mapping.qualificationVersionId,
          board: mapping.board,
          subjectCode: mapping.subjectCode,
          subjectName: mapping.subjectName,
          level: mapping.level,
          syllabusVersion: mapping.syllabusVersion,
          selectedPaperId: paperId,
          sourceIds: sourceIds.get(mapping.qualificationVersionId),
          concepts: trimArray([...concepts.values()].map((node) => ({
            nodeId: node.nodeId,
            definition: node.definition,
            aliases: node.aliases,
            dimension: node.dimension,
            objectScopes: node.objectScopes,
          })), 72),
          aqaOriginalTextPolicy: mapping.board === "AQA" ? "Original AQA wording is intentionally withheld from the model." : undefined,
        },
      };
    }

    const [mappingA, mappingB] = mappings;
    const paperA = selectedPaperIds[0] || null;
    const paperB = selectedPaperIds[1] || null;
    const comparison = compareKnowledgeMappingsV5(mappingA, mappingB, ontology, paperA, paperB);
    const sharedConcepts = trimArray(comparison.exact.sharedNodeIds.map((nodeId) => {
      const node = semantics.get(nodeId);
      return { nodeId, definition: node?.definition, aliases: node?.aliases ?? [], dimension: node?.dimension, objectScopes: node?.objectScopes ?? [] };
    }), MAX_SHARED_CONCEPTS);
    const aItems = trimArray(
      comparison.aStatements
        .filter((item) => ["exclusive", "partial", "unresolved"].includes(item.status))
        .map((item) => this.safeStatementItem(item, mappingA, semantics)),
      MAX_STATEMENT_ITEMS_PER_SIDE,
    );
    const bItems = trimArray(
      comparison.bStatements
        .filter((item) => ["exclusive", "partial", "unresolved"].includes(item.status))
        .map((item) => this.safeStatementItem(item, mappingB, semantics)),
      MAX_STATEMENT_ITEMS_PER_SIDE,
    );
    return {
      mode: "comparison",
      activeBatch: manifest.activeBatch,
      selections: mappings.map((mapping, index) => ({
        code: entries[index].code,
        qualificationVersionId: mapping.qualificationVersionId,
        board: mapping.board,
        subjectCode: mapping.subjectCode,
        subjectName: mapping.subjectName,
        level: mapping.level,
        syllabusVersion: mapping.syllabusVersion,
        selectedPaperId: selectedPaperIds[index] ?? null,
        sourceIds: sourceIds.get(mapping.qualificationVersionId),
        aqaOriginalTextPolicy: mapping.board === "AQA" ? "Original AQA wording is intentionally withheld from the model." : undefined,
      })),
      exactMetrics: comparison.exact,
      statementCounts: comparison.counts,
      sharedConcepts,
      sideA: aItems,
      sideB: bItems,
      truncationNotice: "Lists may be truncated for the assistant context. The ExamBridge comparison page remains the exhaustive source.",
    };
  }

  async build(request: AIChatRequest): Promise<AIContextBuildResult> {
    const manifest = await this.loadManifest();
    const courses = this.resolveCourseEntries(request);
    const knowledgeEntries = this.resolveKnowledgeEntries(request, manifest, courses);
    const aqaEntries = knowledgeEntries.filter((entry) => entry.board === "AQA");
    if (aqaEntries.length > 0) {
      const aqaMappings = await Promise.all(aqaEntries.map((entry) => this.loadMapping(entry)));
      const hasOriginalText = request.messages
        .filter((message) => message.role === "user")
        .some((message) => aqaMappings.some((mapping) => containsAqaOriginalText(message.content, mapping)));
      if (hasOriginalText) {
        return {
          promptContext: "{}",
          sources: [],
          resolvedContext: {
            qualificationIds: courses.map((course) => course.qualificationId).slice(0, 2),
            qualificationCodes: knowledgeEntries.map((entry) => entry.code).slice(0, 2),
            paperIds: request.pageContext.selectedPaperIds.filter(Boolean).slice(0, 2),
            labels: knowledgeEntries.map((entry) => `${entry.board} ${entry.subjectCode} ${entry.subjectName}`).slice(0, 2),
          },
          clarification: request.locale === "en-GB"
            ? "To respect AQA material restrictions, this wording will not be sent to the AI. Please ask again in your own words using only the qualification code and topic name."
            : "为遵守 AQA 材料使用限制，这段考纲原文不会发送给 AI。请只保留资格代码和主题名称，并用自己的话重新提问。",
        };
      }
    }
    const sources = createSourceRegistry();
    const overviews = this.addOverviewContext(courses, sources);
    const selectedPaperIds = request.pageContext.selectedPaperIds.slice(0, 2).map((paperId) => paperId || null);
    const knowledge = await this.addKnowledgeContext(knowledgeEntries, manifest, selectedPaperIds, sources);

    const resolvedContext: AIResolvedContext = {
      qualificationIds: courses.map((course) => course.qualificationId).slice(0, 2),
      qualificationCodes: knowledgeEntries.map((entry) => entry.code).slice(0, 2),
      paperIds: selectedPaperIds.filter((paperId): paperId is string => Boolean(paperId)),
      labels: (knowledgeEntries.length > 0
        ? knowledgeEntries.map((entry) => `${entry.board} ${entry.subjectCode} ${entry.subjectName}`)
        : courses.map((course) => course.label)).slice(0, 2),
    };

    if (overviews.length === 0 && !knowledge) {
      return {
        promptContext: "{}",
        sources: [],
        resolvedContext,
        clarification: request.locale === "en-GB"
          ? "Please choose a course or include an exact qualification code, such as 9709, before asking this question."
          : "请先选择课程，或在问题中写明准确的资格代码（例如 9709）；当前没有足够上下文，不能猜测你指的是哪门考试。",
      };
    }

    const payload = JSON.stringify({
      generatedFor: request.pageContext.pageType,
      sourcePolicy: "Only owner-approved ExamBridge data is included. Source IDs are resolved by the server.",
      examOverviews: overviews,
      knowledge,
    });
    if (payload.length > MAX_PROMPT_CONTEXT_CHARACTERS) {
      throw new Error(`AI prompt context exceeded ${MAX_PROMPT_CONTEXT_CHARACTERS} characters`);
    }
    return { promptContext: payload, sources: sources.list(), resolvedContext };
  }
}
