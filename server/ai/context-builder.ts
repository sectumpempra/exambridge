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
  AIClarification,
  AIChatRequest,
  AIResolvedContext,
} from "@/domain-v2/ai-assistant";
import {
  AcademicResultsManifestV2Schema,
  type AcademicResultsManifestV2,
} from "@/domain-v2/academic-results";
import { buildAcademicToolContext, type AcademicToolContext } from "./academic-tools";
import { resolveApprovedQualificationAliases, resolveCatalogQualificationMentions } from "./qualification-resolver";
import { detectRequiredInputClarification } from "./required-input-resolver";
import {
  buildUniversityAdmissionsToolContext,
  universityAdmissionsSourceMap,
  type UniversityAdmissionsToolContext,
} from "./university-admissions-tools";

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

type PromptItemBucket = {
  items: unknown[];
  omitted: number;
};

type ComparisonPromptContext = {
  mode: "comparison";
  sharedConcepts: PromptItemBucket;
  sideA: PromptItemBucket;
  sideB: PromptItemBucket;
  truncationNotice: string;
};

export type AIContextBuildResult = {
  promptContext: string;
  sources: AICitation[];
  resolvedContext: AIResolvedContext;
  paperFacts: AIPaperFact[];
  clarification?: string;
  clarificationChoices?: AIClarification;
  localAnswer?: string;
  academicTools?: AcademicToolContext;
  universityAdmissionsTools?: UniversityAdmissionsToolContext;
  containsAqa: boolean;
  externalSearchIdentity?: { board: string; qualificationCode: string };
};

const MAX_PROMPT_CONTEXT_CHARACTERS = 52_000;
const MAX_SINGLE_PAPER_CONTEXT_CHARACTERS = 240_000;
const MAX_SHARED_CONCEPTS = 32;
const MAX_STATEMENT_ITEMS_PER_SIDE = 12;

export type AIPaperFact = {
  paperId: string;
  code: string;
  name: string;
  durationMinutes?: number;
  marks?: number;
  weighting?: string;
  calculator?: string;
};

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

function awardQualificationIdForCourse(course: CourseContextEntry): string {
  const board = normalizedBoard(course.boardName);
  const code = course.subjectCode.toLowerCase();
  if (board === "edexcel" && code === "yma01") return "award:pearson:ial-mathematics";
  if (board === "edexcel" && code === "yfm01") return "award:pearson:ial-further-mathematics";
  const awardBoard = board === "edexcel" ? "pearson" : board;
  return `award:${awardBoard}:${code}`;
}

function catalogCodeForCourse(course: CourseContextEntry): string {
  if (course.knowledgeTreeCode) return course.knowledgeTreeCode;
  const board = normalizedBoard(course.boardName);
  const prefix = board === "edexcel" ? "Pearson" : board.toUpperCase();
  return `${prefix}-${course.subjectCode}`;
}

function scopePriority(source: AIChatRequest["scopes"][number]["source"]): number {
  return { "explicit-query": 0, "manual-selection": 1, "page-context": 2, inferred: 3 }[source];
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
  if (/^[A-Z]+$/.test(normalizedCode)) {
    return new RegExp(`(?:^|[^A-Z])${normalizedCode}(?:$|[^A-Z])`, "i").test(message);
  }
  const normalizedMessage = normalizedToken(message);
  return normalizedMessage.includes(normalizedCode);
}

function explicitCodePosition(message: string, ...codes: string[]): number {
  const normalizedMessage = normalizedToken(message);
  const positions = codes.map(code => normalizedMessage.indexOf(normalizedToken(code))).filter(position => position >= 0);
  return positions.length > 0 ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
}

function trimArray<T>(items: T[], limit: number): { items: T[]; omitted: number } {
  return { items: items.slice(0, limit), omitted: Math.max(0, items.length - limit) };
}

function isComparisonPromptContext(value: unknown): value is ComparisonPromptContext {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ComparisonPromptContext>;
  return candidate.mode === "comparison"
    && Array.isArray(candidate.sharedConcepts?.items)
    && Array.isArray(candidate.sideA?.items)
    && Array.isArray(candidate.sideB?.items);
}

function remapAcademicSourceIds(
  value: unknown,
  manifest: AcademicResultsManifestV2,
  sources: SourceRegistry,
): unknown {
  const sourceMap = new Map(manifest.sources.map(source => [source.sourceId, source]));
  const citationMap = new Map<string, string>();
  const citationFor = (sourceId: string) => {
    const cached = citationMap.get(sourceId);
    if (cached) return cached;
    const source = sourceMap.get(sourceId);
    if (!source) return undefined;
    const citationId = sources.add({
      title: source.documentTitle,
      url: source.officialUrl,
      dataVersion: source.documentVersion ?? `${source.effectiveFrom}${source.effectiveTo ? `–${source.effectiveTo}` : ""}`,
    });
    citationMap.set(sourceId, citationId);
    return citationId;
  };
  const walk = (item: unknown, key?: string): unknown => {
    if (Array.isArray(item)) {
      if (key === "sourceIds") return item.map(sourceId => typeof sourceId === "string" ? citationFor(sourceId) : undefined).filter(Boolean);
      return item.map(child => walk(child));
    }
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(Object.entries(item).map(([childKey, child]) => [childKey, walk(child, childKey)]));
  };
  return walk(value);
}

function remapUniversityAdmissionsSourceIds(
  value: UniversityAdmissionsToolContext,
  sources: SourceRegistry,
): UniversityAdmissionsToolContext {
  const sourceMap = universityAdmissionsSourceMap();
  const citationMap = new Map<string, string>();
  const citationFor = (sourceId: string) => {
    const cached = citationMap.get(sourceId);
    if (cached) return cached;
    const source = sourceMap.get(sourceId);
    if (!source) return undefined;
    const citationId = sources.add({
      title: source.title,
      url: source.finalUrl || source.url,
      dataVersion: `${source.publishedOrUpdatedAt ?? source.accessedAt} · ${source.locator}`,
    });
    citationMap.set(sourceId, citationId);
    return citationId;
  };
  const walk = (item: unknown, key?: string): unknown => {
    if (Array.isArray(item)) {
      if (key === "sourceIds") return item
        .map(sourceId => typeof sourceId === "string" ? citationFor(sourceId) : undefined)
        .filter(Boolean);
      return item.map(child => walk(child));
    }
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(Object.entries(item).map(([childKey, child]) => [childKey, walk(child, childKey)]));
  };
  return walk(value) as UniversityAdmissionsToolContext;
}

function buildLocalAqaAnswer(
  locale: AIChatRequest["locale"],
  knowledge: unknown,
  academic: AcademicToolContext | undefined,
  citations: AICitation[],
  originalTextDetected: boolean,
): string {
  const sourceMarkers = citations.slice(0, 4).map(source => `[${source.sourceId}]`).join("");
  const knowledgeObject = knowledge && typeof knowledge === "object" ? knowledge as Record<string, unknown> : undefined;
  const lines = locale === "en-GB"
    ? ["This question includes AQA. ExamBridge answered it with a deterministic local template; no AQA material was sent to an external model."]
    : ["这个问题包含 AQA。ExamBridge 已使用本地确定性模板回答；AQA 材料没有发送给任何外部模型。"];
  if (originalTextDetected) {
    lines.push(locale === "en-GB"
      ? "The pasted wording was processed locally and is not repeated here."
      : "你粘贴的考纲原文只在本地处理，本回答不复述该段原文。");
  }
  if (knowledgeObject?.mode === "comparison") {
    const exact = knowledgeObject.exactMetrics as { coverageA?: number; coverageB?: number; jaccard?: number; sharedNodeCount?: number } | undefined;
    if (exact) {
      const format = (value: number | undefined) => typeof value === "number" ? `${value.toFixed(1)}%` : "—";
      lines.push(locale === "en-GB"
        ? `Verified exact scope: ${exact.sharedNodeCount ?? 0} shared concepts; A→B ${format(exact.coverageA)}, B→A ${format(exact.coverageB)}, Jaccard ${format(exact.jaccard)}.`
        : `已核验的精确知识范围：共同概念 ${exact.sharedNodeCount ?? 0} 个；A→B 覆盖率 ${format(exact.coverageA)}，B→A 覆盖率 ${format(exact.coverageB)}，Jaccard ${format(exact.jaccard)}。`);
    }
  } else if (knowledgeObject?.mode === "single-qualification") {
    const qualification = knowledgeObject.qualification as { selectedPaper?: { name?: string }; statementCount?: number; paperCatalog?: unknown[] } | undefined;
    lines.push(locale === "en-GB"
      ? `Verified local coverage: ${qualification?.selectedPaper?.name ?? "the selected qualification"}; ${qualification?.statementCount ?? qualification?.paperCatalog?.length ?? 0} mapped item(s).`
      : `本地已核验范围：${qualification?.selectedPaper?.name ?? "当前资格"}；共 ${qualification?.statementCount ?? qualification?.paperCatalog?.length ?? 0} 条映射记录。`);
  }
  for (const call of academic?.calls ?? []) {
    if (["explain_qualification_rule", "compare_qualification_rules"].includes(call.name) && call.status === "ok" && Array.isArray(call.result)) {
      for (const record of call.result as Array<{
        subjectCode?: string;
        routeId?: string;
        routeType?: string;
        scoringSystem?: string;
        validCombinations?: Array<{ awardLevel?: string; componentCodes?: string[] }>;
        totalMaximumAwardMark?: number;
        gradeScale?: string[];
        roundingRule?: string;
        resitRule?: { allowed?: boolean; selectionMethod?: string; notes?: string[] };
        carryForwardRule?: { allowed?: boolean; maximumMonths?: number; unit?: string; notes?: string[] };
        cashInRule?: { required?: boolean; entryCode?: string; notes?: string[] };
        unitLockingRule?: { lockedAfterCashIn?: boolean; unlockAllowed?: boolean; notes?: string[] };
        aStarRule?: { available?: boolean; ruleKind?: string; notes?: string[] };
        effectiveFrom?: string;
        effectiveTo?: string;
        sourceIds?: string[];
      }>) {
        const combinations = record.validCombinations?.map(combination =>
          `${combination.awardLevel ?? "Award"}: ${(combination.componentCodes ?? []).join(" + ")}`,
        ).join("；") ?? "—";
        const markers = record.sourceIds?.map(sourceId => `[${sourceId}]`).join("") ?? "";
        if (locale === "en-GB") {
          lines.push([
            `Verified award rule (${record.subjectCode ?? "AQA"} · ${record.routeType ?? "route"})${markers}`,
            `Valid combination(s): ${combinations}.`,
            `Scale: ${record.scoringSystem ?? "—"}; maximum award mark ${record.totalMaximumAwardMark ?? "—"}; grades ${(record.gradeScale ?? []).join("–") || "—"}; rounding ${record.roundingRule ?? "—"}.`,
            `Resit: ${record.resitRule?.allowed ? "allowed as a complete award entry" : "not allowed"}${record.resitRule?.selectionMethod ? ` (${record.resitRule.selectionMethod})` : ""}.`,
            `A*: ${record.aStarRule?.available ? `available under ${record.aStarRule.ruleKind ?? "the official overall rule"}` : "not available"}.`,
            `Effective: ${record.effectiveFrom ?? "—"}${record.effectiveTo ? ` to ${record.effectiveTo}` : " onward"}.`,
          ].join("\n"));
        } else {
          lines.push([
            `已核验合分规则（${record.subjectCode ?? "AQA"} · ${record.routeType ?? "当前路线"}）${markers}`,
            `有效组合：${combinations}。`,
            `计分：${record.scoringSystem ?? "—"}；资格总满分 ${record.totalMaximumAwardMark ?? "—"}；等级 ${(record.gradeScale ?? []).join("、") || "—"}；舍入规则 ${record.roundingRule ?? "—"}。`,
            `重考：${record.resitRule?.allowed ? "允许，但线性资格须作为完整资格入口参加" : "不允许"}${record.resitRule?.selectionMethod ? `（${record.resitRule.selectionMethod}）` : ""}。`,
            `A*：${record.aStarRule?.available ? `可获得，按 ${record.aStarRule.ruleKind ?? "官方整体资格规则"} 判定` : "不设 A*"}。`,
            `适用期：${record.effectiveFrom ?? "—"}${record.effectiveTo ? ` 至 ${record.effectiveTo}` : " 起"}。`,
          ].join("\n"));
        }
      }
      continue;
    }
    if (call.name === "lookup_misconception" && call.status === "ok" && Array.isArray(call.result)) {
      for (const record of call.result as Array<{ correctedFact?: string; applicabilityNotes?: string[]; sourceIds?: string[] }>) {
        if (record.correctedFact) lines.push(`${record.correctedFact}${record.sourceIds?.map(sourceId => `[${sourceId}]`).join("") ?? ""}`);
        if (record.applicabilityNotes?.length) lines.push(record.applicabilityNotes.join("；"));
      }
      continue;
    }
    const count = Array.isArray(call.result) ? call.result.length : call.result ? 1 : 0;
    lines.push(locale === "en-GB"
      ? `${call.name}: ${call.status}${count ? ` (${count} record(s))` : ""}.`
      : `${call.name}：${call.status}${count ? `（${count} 条）` : ""}。`);
  }
  if (academic?.calls.some(call => call.status === "data-unavailable")) {
    lines.push(locale === "en-GB"
      ? "The approved active dataset does not yet contain the requested value, so no number is inferred."
      : "当前 owner-approved active 数据尚未包含所问数值，因此不会猜测或用模型记忆补齐。");
  }
  if (sourceMarkers) lines.push(`${locale === "en-GB" ? "Sources" : "来源"}: ${sourceMarkers}`);
  return lines.join("\n\n");
}

function buildLocalCatalogAnswer(
  locale: AIChatRequest["locale"],
  courses: CourseContextEntry[],
  citations: AICitation[],
): string {
  const markers = citations.slice(0, 4).map(source => `[${source.sourceId}]`).join("");
  const labels = courses.map(course => `${course.boardName} ${course.level} ${course.subjectName} (${course.subjectCode})`).join("；");
  return locale === "en-GB"
    ? `ExamBridge identified: ${labels}.${markers}\n\nThe active verified dataset currently contains only catalogue-level or partial coverage for this selection. I can identify the qualification, but I cannot infer an award rule, grade boundary, Grade Statistics value, or which qualification is easier from missing evidence.`
    : `ExamBridge 已识别：${labels}。${markers}\n\n当前 active 已核验数据对这些选择只有课程目录或部分资料覆盖。我可以确认资格身份，但不能在缺少证据时推测合分规则、分数线、Grade Statistics 数值，或直接断言哪一门更容易。`;
}

function appliesToPaper(statement: KnowledgeMappingV5["statements"][number], paperId: string | null): boolean {
  if (!paperId) return true;
  return statement.paperApplicability.kind !== "not-specified"
    && statement.paperApplicability.papers.includes(paperId);
}

function paperCodeVariants(code: string): string[] {
  const normalized = code.trim().toLowerCase();
  const numeric = /^0*([1-9]\d*)$/.exec(normalized)?.[1];
  return [...new Set([normalized, numeric].filter((value): value is string => Boolean(value)))];
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function paperNameAliases(name: string): string[] {
  const lower = name.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  const aliases = new Set([lower]);
  const numbered = /^(.*?)(\d+)$/.exec(lower.replace(/\s+/g, ""));
  const trailingNumber = /\b(\d+)\s*$/.exec(lower)?.[1];
  if (/probability\s+and\s+statistics|statistics/.test(lower) && trailingNumber) {
    aliases.add(`s${trailingNumber}`);
    aliases.add(`statistics ${trailingNumber}`);
    aliases.add(`ps${trailingNumber}`);
  }
  if (/further\s+pure/.test(lower) && trailingNumber) aliases.add(`fp${trailingNumber}`);
  if (/mechanics/.test(lower)) aliases.add(trailingNumber ? `m${trailingNumber}` : "mechanics");
  if (/decision\s+mathematics/.test(lower) && trailingNumber) aliases.add(`d${trailingNumber}`);
  if (numbered && numbered[1].length >= 3) aliases.add(numbered[0]);
  return [...aliases];
}

export function resolvePaperIdFromMessage(message: string, entry: KnowledgeManifestEntry): string | null {
  const normalized = message.toLowerCase().replace(/[‐‑–—]/g, "-");
  const compact = normalized.replace(/[^a-z0-9]+/g, " ").trim();
  const matches = entry.paperDefinitions?.filter((paper) => {
    const codes = paperCodeVariants(paper.code);
    if (paperNameAliases(paper.name).some((alias) => {
      const pattern = alias.split(/\s+/).map(escaped).join("\\s+");
      return new RegExp(`(?:^|\\b)${pattern}(?:\\b|$)`, "i").test(compact);
    })) return true;
    return codes.some((code) => {
      const safeCode = escaped(code);
      if (new RegExp(`\\bpaper\\s*${safeCode}\\b`, "i").test(normalized)) return true;
      if (new RegExp(`\\bp\\s*${safeCode}\\b`, "i").test(normalized)) return true;
      const subject = escaped(entry.subjectCode.toLowerCase());
      return new RegExp(`\\b${subject}\\s*[/\\-]\\s*${safeCode}(?:\\d)?\\b`, "i").test(normalized);
    });
  }) ?? [];
  return matches.length === 1 ? matches[0].paperId : null;
}

function resolveSelectedPaperIds(
  request: AIChatRequest,
  entries: KnowledgeManifestEntry[],
): Array<string | null> {
  const explicit = request.pageContext.selectedPaperIds.slice(0, 4).map((paperId) => paperId || null);
  if (entries.length !== 1) return explicit;
  const entry = entries[0];
  const valid = new Set(entry.papers);
  const selected = explicit[0];
  if (selected && valid.has(selected)) return [selected];
  for (const message of [...request.messages].reverse()) {
    if (message.role !== "user") continue;
    const paperId = resolvePaperIdFromMessage(message.content, entry);
    if (paperId) return [paperId];
  }
  const resolved = request.resolvedContext?.paperIds.find((paperId) => valid.has(paperId));
  if (resolved) return [resolved];
  return [null];
}

export class AIContextBuilder {
  private readonly publicRoot: string;
  private manifestPromise: Promise<KnowledgeManifest> | null = null;
  private ontologyPromise: Promise<CanonicalNodeSemanticsV5[]> | null = null;
  private mappingPromises = new Map<string, Promise<KnowledgeMappingV5>>();
  private academicManifestPromise: Promise<AcademicResultsManifestV2> | null = null;

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

  private loadAcademicManifest(): Promise<AcademicResultsManifestV2> {
    this.academicManifestPromise ??= this.readJson("/data/academic-results-v2/manifest.json")
      .then(value => AcademicResultsManifestV2Schema.parse(value));
    return this.academicManifestPromise;
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

  private resolveCourseEntries(
    request: AIChatRequest,
    aliasAwardIds: string[] = [],
    catalogMatches: CourseContextEntry[] = [],
  ) {
    const result = [] as typeof COURSE_CATALOG;
    const seen = new Set<string>();
    const add = (entry: (typeof COURSE_CATALOG)[number] | undefined) => {
      if (!entry || result.length >= 4) return;
      const canonicalKey = overviewForCourse(entry)?.id ?? entry.knowledgeTreeCode ?? entry.qualificationId;
      if (seen.has(canonicalKey)) return;
      seen.add(canonicalKey);
      result.push(entry);
    };

    const message = latestUserMessage(request);
    COURSE_CATALOG
      .filter((entry) => messageExplicitlyNamesCode(message, entry.subjectCode))
      .sort((a, b) => explicitCodePosition(message, a.subjectCode) - explicitCodePosition(message, b.subjectCode)
        || Number(Boolean(b.capabilities.examOverview.href)) - Number(Boolean(a.capabilities.examOverview.href)))
      .forEach(add);
    if (result.length > 0) return result;
    catalogMatches.forEach(add);
    if (result.length > 0) return result;
    aliasAwardIds.forEach(awardId => add(COURSE_CATALOG.find(entry => awardQualificationIdForCourse(entry) === awardId)));
    if (result.length > 0) return result;
    [...request.scopes].sort((a, b) => scopePriority(a.source) - scopePriority(b.source)).forEach((scope) => {
      scope.catalogQualificationIds.forEach((id) => add(COURSE_CATALOG.find((entry) => entry.qualificationId === id)));
      scope.awardQualificationIds.forEach((id) => add(COURSE_CATALOG.find((entry) => awardQualificationIdForCourse(entry) === id)));
    });
    request.qualificationIds.forEach((id) => add(COURSE_CATALOG.find((entry) => entry.qualificationId === id)));
    request.resolvedContext?.qualificationIds.forEach((id) => add(COURSE_CATALOG.find((entry) => entry.qualificationId === id)));
    return result;
  }

  private addCatalogContext(courses: typeof COURSE_CATALOG, sources: SourceRegistry) {
    return courses.map(course => ({
      qualificationId: course.qualificationId,
      board: course.boardName,
      level: course.level,
      subjectCode: course.subjectCode,
      subjectName: course.subjectName,
      lifecycleStatus: course.lifecycleStatus,
      lastObservedYear: course.lastObservedYear,
      capabilities: Object.fromEntries(Object.entries(course.capabilities).map(([feature, state]) => [feature, {
        status: state.status,
        verificationStatus: state.verificationStatus,
        reason: state.reason,
      }])),
      sourceId: sources.add({
        title: `${course.boardName} qualification catalogue — ${course.subjectCode} ${course.subjectName}`,
        url: course.sourceUrl,
        dataVersion: course.specificationLabel ?? `catalogue-${course.accessedAt}`,
      }),
    }));
  }

  private resolveKnowledgeEntries(
    request: AIChatRequest,
    manifest: KnowledgeManifest,
    courses: typeof COURSE_CATALOG,
  ): KnowledgeManifestEntry[] {
    const result: KnowledgeManifestEntry[] = [];
    const seen = new Set<string>();
    const add = (entry: KnowledgeManifestEntry | undefined) => {
      if (!entry || seen.has(entry.code) || result.length >= 4) return;
      seen.add(entry.code);
      result.push(entry);
    };

    const message = latestUserMessage(request);
    manifest.mappings
      .filter((entry) => messageExplicitlyNamesCode(message, entry.code) || messageExplicitlyNamesCode(message, entry.subjectCode))
      .sort((a, b) => explicitCodePosition(message, a.code, a.subjectCode) - explicitCodePosition(message, b.code, b.subjectCode))
      .forEach(add);
    if (result.length > 0) return result;
    [...request.scopes].sort((a, b) => scopePriority(a.source) - scopePriority(b.source)).forEach((scope) => {
      scope.qualificationVersionIds.forEach((versionId) => add(manifest.mappings.find((entry) => entry.qualificationVersionId === versionId)));
      scope.awardQualificationIds.forEach((awardId) => {
        const course = COURSE_CATALOG.find((entry) => awardQualificationIdForCourse(entry) === awardId);
        add(manifest.mappings.find((entry) => entry.code === course?.knowledgeTreeCode));
      });
      scope.catalogQualificationIds.forEach((catalogId) => {
        const course = COURSE_CATALOG.find((entry) => entry.qualificationId === catalogId);
        add(manifest.mappings.find((entry) => entry.code === course?.knowledgeTreeCode));
      });
    });
    request.pageContext.comparisonIds.forEach((code) => add(manifest.mappings.find((entry) => entry.code === code)));
    courses.forEach((course) => add(manifest.mappings.find((entry) => entry.code === course.knowledgeTreeCode)));
    request.resolvedContext?.qualificationCodes.forEach((code) => add(manifest.mappings.find((entry) => entry.code === code)));
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

  private paperFactsForSelections(
    courses: typeof COURSE_CATALOG,
    entries: KnowledgeManifestEntry[],
    selectedPaperIds: Array<string | null>,
  ): AIPaperFact[] {
    return entries.flatMap((entry, index) => {
      const course = courses.find((candidate) => candidate.knowledgeTreeCode === entry.code);
      const overview = course ? overviewForCourse(course) : undefined;
      const selected = selectedPaperIds[index] ?? null;
      return (entry.paperDefinitions ?? [])
        .filter((paper) => !selected || paper.paperId === selected)
        .map((paper) => {
          const code = normalizedToken(paper.code);
          const name = normalizedToken(paper.name);
          const component = overview?.components.find((candidate) => {
            const componentCode = normalizedToken(candidate.code);
            return normalizedToken(candidate.name) === name
              || componentCode === code
              || (code.length > 0 && componentCode.endsWith(code));
          });
          return {
            paperId: paper.paperId,
            code: paper.code,
            name: paper.name,
            durationMinutes: component?.durationMinutes,
            marks: component?.marks,
            weighting: component?.weighting,
            calculator: component?.calculator,
          };
        });
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
      const assessableStatements = mapping.statements.filter((statement) => statement.statementType === "assessable-content");
      const selectedStatements = assessableStatements.filter((statement) => appliesToPaper(statement, paperId));
      const concepts = new Map<string, CanonicalNodeSemanticsV5>();
      for (const statement of selectedStatements) {
        for (const link of statement.conceptLinks) {
          const semantic = semantics.get(link.nodeId);
          if (semantic?.reviewStatus === "owner-approved") concepts.set(link.nodeId, semantic);
        }
      }
      const paperCatalog = (entries[0].paperDefinitions ?? []).map((paper) => {
        const statements = assessableStatements.filter((statement) => appliesToPaper(statement, paper.paperId));
        return {
          ...paper,
          statementCount: statements.length,
          conceptCount: new Set(statements.flatMap((statement) => statement.conceptLinks.map((link) => link.nodeId))).size,
          topicHeadings: mapping.board === "AQA" ? undefined : [...new Set(statements.map((statement) => statement.topicHeading).filter(Boolean))],
        };
      });
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
          paperCatalog,
          selectedPaper: paperId ? entries[0].paperDefinitions?.find((paper) => paper.paperId === paperId) : undefined,
          statements: paperId ? selectedStatements.map((statement) => ({
            statementId: statement.statementId,
            sectionId: statement.sectionId,
            topicHeading: mapping.board === "AQA" ? undefined : statement.topicHeading,
            statementText: mapping.board === "AQA" ? undefined : statement.statementText,
            tiers: statement.tiers,
            routes: statement.routes,
            conceptLinks: statement.conceptLinks.map((link) => ({ nodeId: link.nodeId, relation: link.relation })),
          })) : undefined,
          statementCount: paperId ? selectedStatements.length : undefined,
          statementsAreExhaustiveForSelectedPaper: Boolean(paperId),
          concepts: (paperId ? [...concepts.values()] : []).map((node) => ({
            nodeId: node.nodeId,
            definition: node.definition,
            aliases: node.aliases,
            dimension: node.dimension,
            objectScopes: node.objectScopes,
          })),
          aqaOriginalTextPolicy: mapping.board === "AQA" ? "Original AQA wording is intentionally withheld from the model." : undefined,
        },
      };
    }

    if (mappings.length > 2) {
      return {
        mode: "multi-qualification-overview",
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
        knowledgeComparisonPolicy: "Exact knowledge overlap is intentionally not aggregated across three or four qualifications. Request a pairwise comparison for exact directional coverage and Jaccard metrics.",
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
      exactMetrics: {
        sharedNodeCount: comparison.exact.sharedNodeIds.length,
        aOnlyNodeCount: comparison.exact.aOnlyNodeIds.length,
        bOnlyNodeCount: comparison.exact.bOnlyNodeIds.length,
        unionCount: comparison.exact.unionCount,
        jaccard: comparison.exact.jaccard,
        coverageA: comparison.exact.coverageA,
        coverageB: comparison.exact.coverageB,
      },
      statementCounts: comparison.counts,
      sharedConcepts,
      sideA: aItems,
      sideB: bItems,
      truncationNotice: "Lists may be truncated for the assistant context. The ExamBridge comparison page remains the exhaustive source.",
    };
  }

  async build(request: AIChatRequest): Promise<AIContextBuildResult> {
    const manifest = await this.loadManifest();
    const academicManifest = await this.loadAcademicManifest();
    const rawUniversityAdmissions = buildUniversityAdmissionsToolContext(request);
    const catalogResolution = resolveCatalogQualificationMentions(latestUserMessage(request), COURSE_CATALOG, request.locale);
    if (catalogResolution.ambiguity && !rawUniversityAdmissions) {
      const matched = catalogResolution.matchedCourses;
      return {
        promptContext: "{}",
        sources: [],
        paperFacts: [],
        resolvedContext: {
          awardQualificationIds: matched.map(awardQualificationIdForCourse).slice(0, 4),
          qualificationVersionIds: [],
          qualificationIds: matched.map(course => course.qualificationId).slice(0, 4),
          qualificationCodes: matched.map(catalogCodeForCourse).slice(0, 4),
          paperIds: [],
          labels: matched.map(course => course.label).slice(0, 4),
        },
        clarification: catalogResolution.ambiguity.clarification,
        clarificationChoices: catalogResolution.ambiguity.choices,
        containsAqa: false,
      };
    }
    const aliasMatches = resolveApprovedQualificationAliases(latestUserMessage(request), academicManifest.qualificationIdentities);
    const courses = this.resolveCourseEntries(
      request,
      aliasMatches.map(identity => identity.awardQualificationId),
      catalogResolution.matchedCourses,
    );
    const knowledgeEntries = this.resolveKnowledgeEntries(request, manifest, courses);
    const aqaEntries = knowledgeEntries.filter((entry) => entry.board === "AQA");
    let aqaOriginalTextDetected = false;
    if (aqaEntries.length > 0) {
      const aqaMappings = await Promise.all(aqaEntries.map((entry) => this.loadMapping(entry)));
      aqaOriginalTextDetected = request.messages
        .filter((message) => message.role === "user")
        .some((message) => aqaMappings.some((mapping) => containsAqaOriginalText(message.content, mapping)));
    }
    const sources = createSourceRegistry();
    const catalogFacts = this.addCatalogContext(courses, sources);
    const overviews = this.addOverviewContext(courses, sources);
    const selectedPaperIds = resolveSelectedPaperIds(request, knowledgeEntries);
    const knowledge = await this.addKnowledgeContext(knowledgeEntries, manifest, selectedPaperIds, sources);
    const paperFacts = this.paperFactsForSelections(courses, knowledgeEntries, selectedPaperIds);
    const rawAcademic = buildAcademicToolContext(
      request,
      academicManifest,
      knowledgeEntries.map(entry => entry.qualificationVersionId),
      [...new Set([
        ...aliasMatches.map(identity => identity.awardQualificationId),
        ...courses.map(awardQualificationIdForCourse),
        ...request.scopes.flatMap(scope => scope.awardQualificationIds),
      ])],
    );
    const academic = rawAcademic
      ? remapAcademicSourceIds(rawAcademic, academicManifest, sources) as AcademicToolContext
      : undefined;
    const universityAdmissions = rawUniversityAdmissions
      ? remapUniversityAdmissionsSourceIds(rawUniversityAdmissions, sources)
      : undefined;

    const resolvedContext: AIResolvedContext = {
      awardQualificationIds: [...new Set([
        ...courses.map(awardQualificationIdForCourse),
      ])].slice(0, 4),
      qualificationVersionIds: [...new Set([
        ...knowledgeEntries.map(entry => entry.qualificationVersionId),
      ])].slice(0, 4),
      qualificationIds: courses.map((course) => course.qualificationId).slice(0, 4),
      qualificationCodes: [...new Set([
        ...knowledgeEntries.map((entry) => entry.code),
        ...courses.map(catalogCodeForCourse),
      ])].slice(0, 4),
      paperIds: selectedPaperIds.filter((paperId): paperId is string => Boolean(paperId)),
      labels: (knowledgeEntries.length > 0
        ? knowledgeEntries.map((entry) => `${entry.board} ${entry.subjectCode} ${entry.subjectName}`)
        : courses.map((course) => course.label)).slice(0, 4),
    };

    if (universityAdmissions?.calls.some(call => call.status === "input-required")) {
      return {
        promptContext: "{}",
        sources: [],
        paperFacts: [],
        resolvedContext,
        clarification: request.locale === "en-GB"
          ? "The owner-approved active university dataset could not resolve a queryable institution and programme from this question. Please provide a currently verified university name plus the programme or subject. The active dataset currently covers 2027 entry only."
          : "当前 owner-approved 大学 active 数据无法从这条问题中解析出可查询的大学和专业。请提供一所当前已核验的大学名称，以及专业或学科；现有 active 数据仅覆盖 2027 年入学。",
        universityAdmissionsTools: universityAdmissions,
        containsAqa: false,
      };
    }

    const requiredInput = detectRequiredInputClarification(request, resolvedContext.awardQualificationIds);
    if (requiredInput) {
      return {
        promptContext: "{}",
        sources: [],
        paperFacts: [],
        resolvedContext,
        clarification: requiredInput.clarification,
        containsAqa: false,
      };
    }

    const hasVerifiedAcademicContext = academic?.calls.some(call => call.status === "ok") === true;
    const hasUniversityAdmissionsContext = Boolean(universityAdmissions);
    if (catalogFacts.length === 0 && overviews.length === 0 && !knowledge && !hasVerifiedAcademicContext && !hasUniversityAdmissionsContext) {
      return {
        promptContext: "{}",
        sources: [],
        paperFacts: [],
        resolvedContext,
        clarification: request.locale === "en-GB"
          ? "Please choose a course or include an exact qualification code, such as 9709, before asking this question."
          : "请先选择课程，或在问题中写明准确的资格代码（例如 9709）；当前没有足够上下文，不能猜测你指的是哪门考试。",
        containsAqa: false,
      };
    }

    const serializePayload = () => JSON.stringify({
      generatedFor: request.pageContext.pageType,
      sourcePolicy: "Only owner-approved ExamBridge data is included. Source IDs are resolved by the server.",
      courseCatalog: catalogFacts,
      examOverviews: overviews,
      deterministicPaperFacts: paperFacts,
      knowledge,
      academicResults: academic,
      universityAdmissions,
    });
    let payload = serializePayload();
    if (payload.length > MAX_PROMPT_CONTEXT_CHARACTERS && isComparisonPromptContext(knowledge)) {
      const buckets = [knowledge.sideA, knowledge.sideB, knowledge.sharedConcepts];
      while (payload.length > MAX_PROMPT_CONTEXT_CHARACTERS) {
        const target = buckets
          .filter((bucket) => bucket.items.length > 0)
          .sort((a, b) => JSON.stringify(b.items.at(-1)).length - JSON.stringify(a.items.at(-1)).length)[0];
        if (!target) break;
        target.items.pop();
        target.omitted += 1;
        payload = serializePayload();
      }
      knowledge.truncationNotice = "Lists were reduced to fit the verified assistant context budget. The ExamBridge comparison page remains the exhaustive source.";
      payload = serializePayload();
    }
    const promptLimit = knowledge && typeof knowledge === "object"
      && "mode" in knowledge && knowledge.mode === "single-qualification"
      && selectedPaperIds.some(Boolean)
      ? MAX_SINGLE_PAPER_CONTEXT_CHARACTERS
      : MAX_PROMPT_CONTEXT_CHARACTERS;
    if (payload.length > promptLimit) {
      throw new Error(`AI prompt context exceeded ${promptLimit} characters`);
    }
    const sourceList = sources.list();
    const containsAqaCourse = courses.some(course => course.boardName === "AQA");
    const useCatalogOnlyAqaAnswer = containsAqaCourse && aqaEntries.length === 0 && !hasVerifiedAcademicContext;
    return {
      promptContext: payload,
      sources: sourceList,
      resolvedContext,
      paperFacts,
      ...((aqaEntries.length > 0 || academic?.containsAqa || useCatalogOnlyAqaAnswer) ? {
        localAnswer: useCatalogOnlyAqaAnswer
          ? buildLocalCatalogAnswer(request.locale, courses, sourceList)
          : buildLocalAqaAnswer(request.locale, knowledge, academic, sourceList, aqaOriginalTextDetected),
      } : {}),
      academicTools: academic,
      universityAdmissionsTools: universityAdmissions,
      containsAqa: containsAqaCourse || aqaEntries.length > 0 || academic?.containsAqa === true,
      ...(knowledgeEntries.length === 1 && aqaEntries.length === 0 ? {
        externalSearchIdentity: { board: knowledgeEntries[0].board, qualificationCode: knowledgeEntries[0].subjectCode },
      } : {}),
    };
  }
}
