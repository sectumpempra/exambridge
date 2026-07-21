import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AIChatRequestSchema,
  pruneAIChatHistory,
  type AIChatRequest,
} from "@/domain-v2/ai-assistant";
import { AIContextBuilder, overviewIdentityMatches, resolvePaperIdFromMessage } from "../server/ai/context-builder";
import { enforceDeterministicPaperFacts } from "../server/ai/answer-grounding";
import { AnonymousAIRateLimiter } from "../server/ai/rate-limit";
import { AIServiceGuard, createAIServiceGuardFromEnv } from "../server/ai/service-guard";
import { AIProviderError, DeepSeekChatProvider, ensureAnswerCitations, hydrateCitations } from "../server/ai/provider";
import { isComplexAIQuestion } from "../server/ai/prompt";
import { createAIHttpServer, type AIHttpServerDependencies } from "../server/ai";

function request(overrides: Partial<AIChatRequest> = {}): AIChatRequest {
  return {
    version: 2,
    mode: "exam_assistant",
    scopes: [],
    qualificationIds: [],
    syllabusVersions: [],
    pageContext: { pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: [], comparisonIds: [] },
    messages: [{ role: "user", content: "9709 可以使用计算器吗？" }],
    locale: "zh-CN",
    roleView: "consulting",
    ...overrides,
  };
}

function parseSSE(body: string): Array<Record<string, unknown>> {
  return body
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/).find((line) => line.startsWith("data:")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice(5).trimStart()) as Record<string, unknown>);
}

describe("AI assistant request and history safety", () => {
  it("rejects oversized messages, excessive courses, and unknown modes", () => {
    expect(AIChatRequestSchema.safeParse({ ...request(), messages: [{ role: "user", content: "x".repeat(2_001) }] }).success).toBe(false);
    expect(AIChatRequestSchema.safeParse({ ...request(), qualificationIds: ["a", "b", "c", "d", "e"] }).success).toBe(false);
    expect(AIChatRequestSchema.safeParse({ ...request(), mode: "advisor_consult" }).success).toBe(false);
  });

  it("keeps the newest bounded history without splitting a message", () => {
    const messages = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 ? "assistant" as const : "user" as const,
      content: `${index}`.repeat(200),
    }));
    const result = pruneAIChatHistory(messages, 6, 1_000);
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result.at(-1)?.content).toBe(messages.at(-1)?.content);
    expect(result.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(1_000);
  });
});

describe("AI assistant context builder", () => {
  const builder = new AIContextBuilder(process.cwd());

  it("resolves the real CAIE 9709 context used by the provider smoke test", async () => {
    const result = await builder.build(request());
    expect(result.clarification).toBeUndefined();
    expect(result.resolvedContext.qualificationCodes).toContain("CAIE-9709");
    expect(result.promptContext).toContain("CAIE-9709");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("lets explicit question qualifications replace conflicting page context", async () => {
    const result = await builder.build(request({
      scopes: [{
        awardQualificationIds: ["award:aqa:7357"],
        qualificationVersionIds: ["AQA-7357:1.3"],
        catalogQualificationIds: ["qual:aqa:a-level:7357"],
        source: "page-context",
      }],
      qualificationIds: ["qual:aqa:a-level:7357"],
      pageContext: { pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: [], comparisonIds: ["AQA-7357"] },
      messages: [{ role: "user", content: "比较 9709 和 9231 的考试结构" }],
    }));
    expect(result.resolvedContext.qualificationCodes).toEqual(["CAIE-9709", "CAIE-9231"]);
    expect(result.resolvedContext.awardQualificationIds).toEqual(["award:caie:9709", "award:caie:9231"]);
    expect(result.resolvedContext.qualificationCodes).not.toContain("AQA-7357");
  });

  it("supports three-qualification fact context without inventing a multi-way knowledge percentage", async () => {
    const result = await builder.build(request({
      messages: [{ role: "user", content: "比较 0580、9709 和 9231 的考试结构" }],
    }));
    const payload = JSON.parse(result.promptContext) as { knowledge: { mode: string; selections: unknown[]; knowledgeComparisonPolicy: string } };
    expect(result.resolvedContext.qualificationCodes).toEqual(["CAIE-0580", "CAIE-9709", "CAIE-9231"]);
    expect(payload.knowledge.mode).toBe("multi-qualification-overview");
    expect(payload.knowledge.selections).toHaveLength(3);
    expect(payload.knowledge.knowledgeComparisonPolicy).toContain("pairwise");
  });

  it("resolves S1, Paper 5, P5 and component variants to the approved 9709 Paper 5 ID", async () => {
    const manifest = JSON.parse(await readFile(path.join(process.cwd(), "public/data/knowledge-v5/manifest.json"), "utf8")) as {
      mappings: Array<{ code: string; subjectCode: string; papers: string[]; paperDefinitions: Array<{ paperId: string; code: string; name: string; tiers: string[] }> }>;
    };
    const entry = manifest.mappings.find((mapping) => mapping.code === "CAIE-9709")!;
    for (const message of ["S1 考哪些内容？", "Paper 5 有哪些知识点？", "P5 topics", "9709/52 考什么？", "Statistics 1 syllabus"]) {
      expect(resolvePaperIdFromMessage(message, { ...entry, board: "CAIE", subjectName: "Mathematics", level: "A Level", qualificationVersionId: "x", mappingUrl: "x" }))
        .toBe("CAIE-9709-Paper-5");
    }
  });

  it("sends the exhaustive approved 9709 Paper 5 statements instead of a qualification-wide concept prefix", async () => {
    const result = await builder.build(request({
      qualificationIds: ["qual:caie:a-level:9709"],
      pageContext: { pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: [], comparisonIds: ["CAIE-9709"] },
      messages: [{ role: "user", content: "S1 具体考哪些统计与概率知识点？" }],
    }));
    const payload = JSON.parse(result.promptContext) as { knowledge: { qualification: { selectedPaperId: string; statementCount: number; statementsAreExhaustiveForSelectedPaper: boolean; statements: Array<{ topicHeading: string; statementText: string }>; concepts: unknown[] } }; deterministicPaperFacts: Array<{ marks?: number }> };
    expect(result.resolvedContext.paperIds).toEqual(["CAIE-9709-Paper-5"]);
    expect(payload.knowledge.qualification.selectedPaperId).toBe("CAIE-9709-Paper-5");
    expect(payload.knowledge.qualification.statementCount).toBe(22);
    expect(payload.knowledge.qualification.statementsAreExhaustiveForSelectedPaper).toBe(true);
    expect(payload.knowledge.qualification.statements.some((statement) => statement.topicHeading.includes("The normal distribution"))).toBe(true);
    expect(payload.knowledge.qualification.statements.some((statement) => statement.statementText.includes("stem-and-leaf"))).toBe(true);
    expect(payload.knowledge.qualification.concepts.length).toBe(47);
    expect(payload.deterministicPaperFacts[0]?.marks).toBe(50);
    expect(result.promptContext.length).toBeLessThanOrEqual(240_000);
  });

  it("lets an explicit follow-up Paper override an older resolved Paper while preserving vague follow-ups", async () => {
    const base = {
      awardQualificationIds: ["award:caie:9709"],
      qualificationVersionIds: ["CAIE-9709:2026-2027"],
      qualificationIds: ["qual:caie:a-level:9709"],
      qualificationCodes: ["CAIE-9709"],
      paperIds: ["CAIE-9709-Paper-5"],
      labels: ["CAIE 9709 Mathematics"],
    };
    const switched = await builder.build(request({
      resolvedContext: base,
      pageContext: { pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: [], comparisonIds: ["CAIE-9709"] },
      messages: [{ role: "user", content: "Paper 6 又考哪些内容？" }],
    }));
    expect(switched.resolvedContext.paperIds).toEqual(["CAIE-9709-Paper-6"]);
    const continued = await builder.build(request({
      resolvedContext: base,
      pageContext: { pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: [], comparisonIds: ["CAIE-9709"] },
      messages: [{ role: "user", content: "它和前一张有什么关系？" }],
    }));
    expect(continued.resolvedContext.paperIds).toEqual(["CAIE-9709-Paper-5"]);
  });

  it("builds a non-empty exhaustive Paper context for every Paper in the active mathematics manifest", async () => {
    const manifest = JSON.parse(await readFile(path.join(process.cwd(), "public/data/knowledge-v5/manifest.json"), "utf8")) as {
      mappings: Array<{ code: string; papers: string[] }>;
    };
    for (const entry of manifest.mappings) {
      for (const paperId of entry.papers) {
        const result = await builder.build(request({
          pageContext: { pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: [paperId], comparisonIds: [entry.code] },
          messages: [{ role: "user", content: `${entry.code} 这张 Paper 的知识范围是什么？` }],
        }));
        const payload = JSON.parse(result.promptContext) as { knowledge: { qualification: { selectedPaperId: string; statementCount: number; statementsAreExhaustiveForSelectedPaper: boolean } } };
        expect(payload.knowledge.qualification.selectedPaperId, `${entry.code} ${paperId}`).toBe(paperId);
        expect(payload.knowledge.qualification.statementCount, `${entry.code} ${paperId}`).toBeGreaterThan(0);
        expect(payload.knowledge.qualification.statementsAreExhaustiveForSelectedPaper).toBe(true);
        expect(result.promptContext.length, `${entry.code} ${paperId}`).toBeLessThanOrEqual(240_000);
      }
    }
  }, 30_000);

  it("resolves an explicitly named course code without a hard-coded prompt whitelist", async () => {
    const result = await builder.build(request({ messages: [{ role: "user", content: "0607 的 Paper 结构是什么？" }] }));
    expect(result.clarification).toBeUndefined();
    expect(result.promptContext).toContain("0607");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("matches a newly structured course to an overview without course-specific assistant code", () => {
    expect(overviewIdentityMatches(
      { boardName: "Example Award Board", subjectCode: "X123" },
      { board: "Example Award Board", code: "X123" },
    )).toBe(true);
    expect(overviewIdentityMatches(
      { boardName: "Example Award Board", subjectCode: "X123" },
      { board: "Different Board", code: "X123" },
    )).toBe(false);
  });

  it("asks for a course instead of guessing vague context", async () => {
    const result = await builder.build(request({ messages: [{ role: "user", content: "这门数学可以使用计算器吗？" }] }));
    expect(result.clarification).toContain("请先选择课程");
    expect(result.sources).toHaveLength(0);
  });

  it("builds owner-approved comparison metrics while withholding AQA wording", async () => {
    const rawAqa = JSON.parse(await readFile(path.join(process.cwd(), "public/data/knowledge-v5/mappings/AQA-8300.json"), "utf8")) as { statements: Array<{ statementText: string; conceptLinks: Array<{ evidenceSpan: string }> }> };
    const original = rawAqa.statements.find((statement) => statement.statementText.length > 20)!;
    const result = await builder.build(request({
      pageContext: { pageType: "knowledge-comparison", route: "/knowledge-tree", selectedPaperIds: ["", ""], comparisonIds: ["AQA-8300", "CAIE-0580"] },
      messages: [{ role: "user", content: "比较 AQA 8300 和 CAIE 0580 的独有知识点" }],
    }));
    expect(result.promptContext).toContain("exactMetrics");
    expect(result.promptContext).toContain("Original AQA wording is intentionally withheld");
    expect(result.promptContext).not.toContain(original.statementText);
    for (const link of original.conceptLinks) expect(result.promptContext).not.toContain(link.evidenceSpan);
  });

  it("handles pasted AQA statement wording locally without constructing a provider answer", async () => {
    const rawAqa = JSON.parse(await readFile(path.join(process.cwd(), "public/data/knowledge-v5/mappings/AQA-8300.json"), "utf8")) as { statements: Array<{ statementText: string }> };
    const original = rawAqa.statements.find((statement) => statement.statementText.split(/\s+/).length >= 6)!;
    const result = await builder.build(request({
      pageContext: { pageType: "knowledge-comparison", route: "/knowledge-tree", selectedPaperIds: [], comparisonIds: ["AQA-8300"] },
      messages: [{ role: "user", content: `请解释这段：${original.statementText}` }],
    }));
    expect(result.clarification).toBeUndefined();
    expect(result.localAnswer).toContain("AQA");
    expect(result.localAnswer).toContain("只在本地处理");
    expect(result.promptContext).not.toContain(original.statementText);
  });

  it("preserves the second Paper slot in a Paper-vs-subject comparison", async () => {
    const result = await builder.build(request({
      pageContext: { pageType: "knowledge-comparison", route: "/knowledge-tree", selectedPaperIds: ["", "4MA1-1H"], comparisonIds: ["CAIE-0580", "Edexcel-4MA1"] },
      messages: [{ role: "user", content: "这两个选择的差异是什么？" }],
    }));
    expect(result.promptContext).toContain('"selectedPaperId":null');
    expect(result.promptContext).toContain('"selectedPaperId":"4MA1-1H"');
  });

  it("fits the real 9709 versus 9MA0 comparison into the prompt budget", async () => {
    const result = await builder.build(request({
      pageContext: { pageType: "knowledge-comparison", route: "/knowledge-tree", selectedPaperIds: ["", ""], comparisonIds: ["CAIE-9709", "Edexcel-9MA0"] },
      messages: [{ role: "user", content: "比较 CAIE 9709 和 Pearson Edexcel 9MA0 的知识范围" }],
    }));
    const payload = JSON.parse(result.promptContext) as {
      knowledge: {
        mode: string;
        selections: Array<{ code: string }>;
        exactMetrics: { sharedNodeCount: number; unionCount: number };
        sharedConcepts: { items: unknown[] };
        sideA: { items: unknown[] };
        sideB: { items: unknown[] };
        truncationNotice: string;
      };
    };
    expect(result.clarification).toBeUndefined();
    expect(result.promptContext.length).toBeLessThanOrEqual(52_000);
    expect(payload.knowledge.mode).toBe("comparison");
    expect(payload.knowledge.selections.map((selection) => selection.code)).toEqual(["CAIE-9709", "Edexcel-9MA0"]);
    expect(payload.knowledge.exactMetrics.unionCount).toBeGreaterThan(0);
    expect(
      payload.knowledge.sharedConcepts.items.length
      + payload.knowledge.sideA.items.length
      + payload.knowledge.sideB.items.length,
    ).toBeGreaterThan(0);
    expect(payload.knowledge.truncationNotice).toContain("assistant context");
  });

  it("reuses the server-resolved course context for a realistic follow-up", async () => {
    const first = await builder.build(request());
    const result = await builder.build(request({
      resolvedContext: first.resolvedContext,
      messages: [
        { role: "user", content: "9709 可以使用计算器吗？" },
        { role: "assistant", content: "9709 的各张 Paper 均允许使用符合规定的计算器。" },
        { role: "user", content: "刚才提到的 Paper 2 为什么允许使用计算器？" },
      ],
    }));
    expect(result.clarification).toBeUndefined();
    expect(result.resolvedContext.qualificationCodes).toContain("CAIE-9709");
    expect(result.promptContext).toContain("CAIE-9709");
  });
});

describe("AI assistant provider boundaries", () => {
  const originalEnv = {
    key: process.env.DEEPSEEK_API_KEY,
    base: process.env.DEEPSEEK_BASE_URL,
    model: process.env.DEEPSEEK_MODEL,
  };
  afterEach(() => {
    if (originalEnv.key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = originalEnv.key;
    if (originalEnv.base === undefined) delete process.env.DEEPSEEK_BASE_URL; else process.env.DEEPSEEK_BASE_URL = originalEnv.base;
    if (originalEnv.model === undefined) delete process.env.DEEPSEEK_MODEL; else process.env.DEEPSEEK_MODEL = originalEnv.model;
    vi.unstubAllGlobals();
  });

  it("hydrates only allow-listed source IDs", () => {
    const sources = [{ sourceId: "S1", title: "Official", url: "https://example.com/official", dataVersion: "v1" }];
    expect(hydrateCitations("Fact [S1], invented [S9].", sources)).toEqual(sources);
  });

  it("repairs deterministic marks and duration before the authoritative answer is emitted", () => {
    const result = enforceDeterministicPaperFacts(
      "**Paper 5: Probability & Statistics 1**\n\n- 时长：90 分钟\n- 满分：75 分 [S1]",
      [{ paperId: "CAIE-9709-Paper-5", code: "5", name: "Probability & Statistics 1", durationMinutes: 75, marks: 50 }],
    );
    expect(result.answer).toContain("时长：75 分钟");
    expect(result.answer).toContain("满分：50 分 [S1]");
    expect(result.corrections).toEqual(expect.arrayContaining([
      { paperId: "CAIE-9709-Paper-5", field: "durationMinutes" },
      { paperId: "CAIE-9709-Paper-5", field: "marks" },
    ]));
  });

  it("repairs each named Paper independently in a multi-Paper answer", () => {
    const result = enforceDeterministicPaperFacts(
      "Paper 4: Mechanics — duration: 90 minutes, marks: 75.\nPaper 5: Probability & Statistics 1 — duration: 60 mins, total marks: 75.",
      [
        { paperId: "CAIE-9709-Paper-4", code: "4", name: "Mechanics", durationMinutes: 75, marks: 50 },
        { paperId: "CAIE-9709-Paper-5", code: "5", name: "Probability & Statistics 1", durationMinutes: 75, marks: 50 },
      ],
    );
    expect(result.answer).toContain("Paper 4: Mechanics — duration: 75 minutes, marks: 50");
    expect(result.answer).toContain("Paper 5: Probability & Statistics 1 — duration: 75 mins, total marks: 50");
    expect(result.corrections).toHaveLength(4);
  });

  it("leaves answers unchanged when no complete fact or matching Paper anchor is available", () => {
    expect(enforceDeterministicPaperFacts("No deterministic fields.", []).answer).toBe("No deterministic fields.");
    expect(enforceDeterministicPaperFacts("A general overview with marks: 99.", [
      { paperId: "P1", code: "1", name: "Pure Mathematics 1", marks: 75 },
      { paperId: "P2", code: "2", name: "Pure Mathematics 2", marks: 50 },
    ])).toEqual({ answer: "A general overview with marks: 99.", corrections: [] });
  });

  it("normalizes grouped citations and removes unknown citation markers", () => {
    const sources = [
      { sourceId: "S1", title: "First", url: "https://example.com/first", dataVersion: "v1" },
      { sourceId: "S2", title: "Second", url: "https://example.com/second", dataVersion: "v1" },
    ];
    const answer = ensureAnswerCitations("Shared fact [S1,S2], invented [S9].", sources);
    expect(answer).toBe("Shared fact [S1][S2], invented.");
    expect(hydrateCitations(answer, sources)).toEqual(sources);
  });

  it("removes internal comparison field markers from user-facing answers", () => {
    const sources = [{ sourceId: "S1", title: "First", url: "https://example.com/first", dataVersion: "v1" }];
    expect(ensureAnswerCitations("共同内容 [sharedConcepts] [S1]，独有内容 [aOnlyNodeIds]。", sources))
      .toBe("共同内容 [S1]，独有内容。");
  });

  it("never invents citations when the provider omitted them", () => {
    const sources = [
      { sourceId: "S1", title: "First", url: "https://example.com/first", dataVersion: "v1" },
      { sourceId: "S2", title: "Second", url: "https://example.com/second", dataVersion: "v1" },
    ];
    const answer = ensureAnswerCitations("没有引用的回答。", sources);
    expect(answer).toBe("没有引用的回答。");
    expect(hydrateCitations(answer, sources)).toEqual([]);
  });

  it("uses maximum reasoning for comparisons and lower reasoning for simple facts", () => {
    expect(isComplexAIQuestion(request())).toBe(false);
    expect(isComplexAIQuestion(request({ messages: [{ role: "user", content: "比较 9709 和 9MA0 的区别" }] }))).toBe(true);
    expect(isComplexAIQuestion(request({
      pageContext: { pageType: "knowledge-comparison", route: "/knowledge-tree", selectedPaperIds: [], comparisonIds: ["CAIE-9709"] },
    }))).toBe(true);
    expect(isComplexAIQuestion(request({
      resolvedContext: { awardQualificationIds: ["award:a", "award:b"], qualificationVersionIds: ["A:v1", "B:v1"], qualificationIds: ["a", "b"], qualificationCodes: ["A", "B"], paperIds: [], labels: ["A", "B"] },
    }))).toBe(true);
  });

  it("fails safely when the server API key is absent", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_BASE_URL = "https://example.com/v1";
    process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
    const provider = new DeepSeekChatProvider();
    expect(provider.isConfigured()).toBe(false);
    await expect(provider.stream({
      system: "system",
      messages: [{ role: "user", content: "question" }],
      reasoningEffort: "low",
      signal: new AbortController().signal,
      onDelta: () => undefined,
    })).rejects.toMatchObject({ kind: "configuration" } satisfies Partial<AIProviderError>);
  });

  it("parses a valid DeepSeek SSE stream and checks the returned model", async () => {
    process.env.DEEPSEEK_API_KEY = "test-only-placeholder";
    process.env.DEEPSEEK_BASE_URL = "https://example.com/v1";
    process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
    const body = [
      'data: {"model":"deepseek-v4-pro","choices":[{"delta":{"content":"回答 https://evil."}}]}',
      '',
      'data: {"model":"deepseek-v4-pro","choices":[{"delta":{"content":"example/path [S1]"}}],"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}',
      '',
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } })));
    const deltas: string[] = [];
    const result = await new DeepSeekChatProvider().stream({
      system: "system",
      messages: [{ role: "user", content: "question" }],
      reasoningEffort: "low",
      signal: new AbortController().signal,
      onDelta: (delta) => deltas.push(delta),
    });
    expect(result.answer).toBe("回答 [未展示的外部链接] [S1]");
    expect(result.usage?.total_tokens).toBe(12);
    expect(deltas.join("")).toBe(result.answer);
    const requestBody = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit)?.body));
    expect(requestBody.max_tokens).toBe(2_500);
  });

  it("allocates a larger output budget to maximum reasoning and rejects empty answers", async () => {
    process.env.DEEPSEEK_API_KEY = "test-only-placeholder";
    process.env.DEEPSEEK_BASE_URL = "https://example.com/v1";
    process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
    const emptyBody = [
      'data: {"model":"deepseek-v4-pro","choices":[{"delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":6000,"total_tokens":6010}}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(emptyBody, { status: 200 })));
    await expect(new DeepSeekChatProvider().stream({
      system: "system",
      messages: [{ role: "user", content: "compare" }],
      reasoningEffort: "max",
      signal: new AbortController().signal,
      onDelta: () => undefined,
    })).rejects.toMatchObject({ kind: "unavailable", message: "DeepSeek returned an empty answer" });
    const requestBody = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit)?.body));
    expect(requestBody.max_tokens).toBe(6_000);
  });

  it("surfaces provider HTTP failures and rejects unexpected returned models", async () => {
    process.env.DEEPSEEK_API_KEY = "test-only-placeholder";
    process.env.DEEPSEEK_BASE_URL = "https://example.com/v1/";
    process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "rate limited" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })));
    await expect(new DeepSeekChatProvider().stream({
      system: "system",
      messages: [{ role: "user", content: "question" }],
      reasoningEffort: "low",
      signal: new AbortController().signal,
      onDelta: () => undefined,
    })).rejects.toMatchObject({ kind: "unavailable", status: 429, message: "rate limited" });

    const mismatched = [
      'data: {"model":"unexpected-model","choices":[{"delta":{"content":"answer"}}]}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(mismatched, { status: 200 })));
    await expect(new DeepSeekChatProvider().stream({
      system: "system",
      messages: [{ role: "user", content: "question" }],
      reasoningEffort: "max",
      signal: new AbortController().signal,
      onDelta: () => undefined,
    })).rejects.toMatchObject({ kind: "unavailable", message: "Unexpected model response: unexpected-model" });
  });

  it("handles structured stream content and fails safely on missing bodies or network errors", async () => {
    process.env.DEEPSEEK_API_KEY = "test-only-placeholder";
    process.env.DEEPSEEK_BASE_URL = "https://example.com/v1";
    process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
    const structured = [
      'data: {"model":"deepseek-v4-pro","choices":[{"delta":{"content":["A",{"text":"B"},{"content":"C"},null]}}]}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(structured, { status: 200 })));
    await expect(new DeepSeekChatProvider().stream({
      system: "system",
      messages: [{ role: "user", content: "question" }],
      reasoningEffort: "low",
      signal: new AbortController().signal,
      onDelta: () => undefined,
    })).resolves.toMatchObject({ answer: "ABC", model: "deepseek-v4-pro" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    await expect(new DeepSeekChatProvider().stream({
      system: "system",
      messages: [{ role: "user", content: "question" }],
      reasoningEffort: "low",
      signal: new AbortController().signal,
      onDelta: () => undefined,
    })).rejects.toMatchObject({ kind: "unavailable", message: "DeepSeek streaming body is missing" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(new DeepSeekChatProvider().stream({
      system: "system",
      messages: [{ role: "user", content: "question" }],
      reasoningEffort: "low",
      signal: new AbortController().signal,
      onDelta: () => undefined,
    })).rejects.toMatchObject({ kind: "unavailable", message: "network down" });
  });

  it("enforces per-IP request and concurrency limits", () => {
    const limiter = new AnonymousAIRateLimiter(2, 300_000, 1, 2);
    const first = limiter.acquire("ip", 0);
    expect(first.allowed).toBe(true);
    expect(limiter.acquire("ip", 1)).toMatchObject({ allowed: false, reason: "ip-busy" });
    if (first.allowed) first.release();
    const second = limiter.acquire("ip", 2);
    expect(second.allowed).toBe(true);
    if (second.allowed) second.release();
    expect(limiter.acquire("ip", 3)).toMatchObject({ allowed: false, reason: "rate-limited" });

    const globalLimiter = new AnonymousAIRateLimiter(10, 60_000, 2, 1);
    const globalFirst = globalLimiter.acquire("first", 0);
    expect(globalFirst.allowed).toBe(true);
    expect(globalLimiter.acquire("second", 0)).toMatchObject({ allowed: false, reason: "service-busy" });
    if (globalFirst.allowed) globalFirst.release();
  });

  it("allows 20 accepted requests per IP in the default five-minute window", () => {
    const limiter = new AnonymousAIRateLimiter();
    const now = Date.UTC(2026, 6, 21, 0, 0, 0);
    for (let index = 0; index < 20; index += 1) {
      const decision = limiter.acquire("203.0.113.20", now);
      expect(decision.allowed).toBe(true);
      if (decision.allowed) decision.release();
    }
    expect(limiter.acquire("203.0.113.20", now)).toMatchObject({
      allowed: false,
      reason: "rate-limited",
      retryAfterSeconds: 300,
    });
  });

  it("enforces daily request and token ceilings with a UTC reset", () => {
    const start = Date.UTC(2026, 6, 21, 12);
    const requestGuard = new AIServiceGuard(2, 1_000, 5, 60_000);
    expect(requestGuard.beginProviderRequest(start)).toEqual({ allowed: true });
    requestGuard.recordProviderSuccess(10, start);
    expect(requestGuard.beginProviderRequest(start + 1)).toEqual({ allowed: true });
    requestGuard.recordProviderSuccess(10, start + 1);
    expect(requestGuard.beginProviderRequest(start + 2)).toMatchObject({ allowed: false, reason: "daily-request-limit" });
    expect(requestGuard.beginProviderRequest(start + 24 * 60 * 60_000)).toEqual({ allowed: true });

    const tokenGuard = new AIServiceGuard(10, 100, 5, 60_000);
    expect(tokenGuard.beginProviderRequest(start)).toEqual({ allowed: true });
    tokenGuard.recordProviderSuccess(100, start);
    expect(tokenGuard.beginProviderRequest(start + 1)).toMatchObject({ allowed: false, reason: "daily-token-limit" });
  });

  it("opens and recovers the provider circuit after consecutive failures", () => {
    const guard = new AIServiceGuard(10, 1_000, 2, 1_000);
    const start = Date.UTC(2026, 6, 21, 12);
    expect(guard.beginProviderRequest(start)).toEqual({ allowed: true });
    guard.recordProviderFailure(start);
    expect(guard.beginProviderRequest(start + 1)).toEqual({ allowed: true });
    guard.recordProviderFailure(start + 1);
    expect(guard.beginProviderRequest(start + 2)).toMatchObject({ allowed: false, reason: "provider-circuit-open" });
    expect(guard.snapshot(start + 2).circuitOpen).toBe(true);
    expect(guard.beginProviderRequest(start + 1_001)).toEqual({ allowed: true });
    guard.recordProviderSuccess(20, start + 1_001);
    expect(guard.snapshot(start + 1_001)).toMatchObject({ consecutiveProviderFailures: 0, circuitOpen: false });
  });

  it("loads positive service limits from environment and safely falls back for invalid values", () => {
    const configured = createAIServiceGuardFromEnv({
      AI_DAILY_REQUEST_LIMIT: "1",
      AI_DAILY_TOKEN_LIMIT: "100",
      AI_PROVIDER_FAILURE_THRESHOLD: "2",
      AI_PROVIDER_COOLDOWN_MS: "1000",
    });
    const now = Date.UTC(2026, 6, 21, 12);
    expect(configured.beginProviderRequest(now)).toEqual({ allowed: true });
    expect(configured.beginProviderRequest(now + 1)).toMatchObject({ allowed: false, reason: "daily-request-limit" });
    const fallback = createAIServiceGuardFromEnv({ AI_DAILY_REQUEST_LIMIT: "invalid", AI_DAILY_TOKEN_LIMIT: "0" });
    expect(fallback.beginProviderRequest(now)).toEqual({ allowed: true });
  });
});

describe("AI assistant HTTP/SSE boundary", () => {
  it("adds eligible official live evidence to the DeepSeek context without activating it", async () => {
    const provider = {
      isConfigured: () => true,
      stream: vi.fn().mockImplementation(async ({ system }) => ({
        answer: system.includes("official-live-candidate-direct-answer-eligible")
          ? "官方实时检索、尚未入库：A 等级线为 180/250 [S1]"
          : "missing",
        model: "deepseek-v4-pro",
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })),
    };
    const webSearch = {
      isConfigured: () => true,
      search: vi.fn().mockResolvedValue({
        evidence: {
          schemaVersion: "1.0.0",
          evidenceId: "external:test",
          provider: "openai-web-search",
          requestedModel: "gpt-5",
          returnedModel: "gpt-5-snapshot",
          query: "联网查 9709 最新分数线",
          board: "CAIE",
          qualificationCode: "9709",
          year: 2025,
          series: "june",
          officialUrl: "https://www.cambridgeinternational.org/example.pdf",
          documentTitle: "Official threshold table",
          locator: "PDF page 2, row AX",
          retrievedAt: "2026-07-21T12:00:00.000Z",
          allowedDomain: true,
          exactIdentityMatch: true,
          numericValidationPassed: true,
          conflictsWithActive: false,
          directAnswerEligible: true,
          verificationStatus: "candidate",
        },
        summary: "Official row",
        numericFacts: [{ label: "A", value: 180, maximum: 250 }],
        cached: false,
      }),
    };
    const server = createAIHttpServer({
      builder: {
        build: vi.fn().mockResolvedValue({
          promptContext: JSON.stringify({ academicResults: { calls: [] } }),
          sources: [],
          resolvedContext: { qualificationIds: [], qualificationCodes: ["CAIE-9709"], paperIds: [], labels: ["9709"] },
          paperFacts: [],
          containsAqa: false,
          externalSearchIdentity: { board: "CAIE", qualificationCode: "9709" },
          academicTools: { activeBatch: null, dataPolicy: "test", calls: [{ name: "lookup_grade_boundary", status: "data-unavailable", result: [], sourceIds: [] }] },
        }),
      },
      provider,
      webSearch,
      limiter: new AnonymousAIRateLimiter(),
      serviceGuard: {
        beginProviderRequest: vi.fn().mockReturnValue({ allowed: true }),
        recordProviderSuccess: vi.fn(),
        recordProviderFailure: vi.fn(),
      },
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request({
          messages: [{ role: "user", content: "联网查 9709 最新分数线" }],
          featureConsent: { externalSearch: { enabled: true } },
        })),
      });
      const events = parseSSE(await response.text());
      expect(webSearch.search).toHaveBeenCalledOnce();
      expect(provider.stream).toHaveBeenCalledOnce();
      expect(events.find(event => event.type === "citations")?.citations).toEqual([
        expect.objectContaining({ sourceId: "S1", title: expect.stringContaining("尚未入库") }),
      ]);
      expect(events.at(-1)?.answer).toContain("180/250");
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("streams AQA local answers without provider configuration, quota, or calls", async () => {
    const resolvedContext = { awardQualificationIds: ["award:aqa:7357"], qualificationVersionIds: ["AQA-7357:1.3"], qualificationIds: ["aqa"], qualificationCodes: ["AQA-7357"], paperIds: [], labels: ["AQA 7357"] };
    const provider = { isConfigured: () => false, stream: vi.fn() };
    const serviceGuard = {
      beginProviderRequest: vi.fn(),
      recordProviderSuccess: vi.fn(),
      recordProviderFailure: vi.fn(),
    };
    const server = createAIHttpServer({
      builder: {
        build: vi.fn().mockResolvedValue({
          promptContext: "{}",
          sources: [{ sourceId: "S1", title: "AQA official", url: "https://www.aqa.org.uk/example", dataVersion: "v1" }],
          resolvedContext,
          paperFacts: [],
          localAnswer: "AQA 本地确定性回答 [S1]",
        }),
      },
      provider,
      limiter: new AnonymousAIRateLimiter(),
      serviceGuard,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request()),
      });
      const events = parseSSE(await response.text());
      expect(events.map(event => event.type)).toEqual(["meta", "delta", "citations", "suggestions", "done"]);
      expect(events.at(-1)).toMatchObject({ answer: "AQA 本地确定性回答 [S1]" });
      expect(provider.stream).not.toHaveBeenCalled();
      expect(serviceGuard.beginProviderRequest).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("streams typed data-only events with resolved context and allow-listed citations", async () => {
    const resolvedContext = {
      awardQualificationIds: ["award:caie:9709"],
      qualificationVersionIds: ["CAIE-9709:2026-2027"],
      qualificationIds: ["qual:caie:a-level:9709"],
      qualificationCodes: ["CAIE-9709"],
      paperIds: [],
      labels: ["CAIE 9709 Mathematics"],
    };
    const source = {
      sourceId: "S1",
      title: "Cambridge International AS & A Level Mathematics 9709",
      url: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-mathematics-9709/",
      dataVersion: "2026-2027",
    };
    const dependencies: AIHttpServerDependencies = {
      builder: {
        build: vi.fn().mockResolvedValue({
          promptContext: "{\"course\":\"CAIE-9709\"}",
          sources: [source],
          resolvedContext,
        }),
      },
      provider: {
        isConfigured: () => true,
        stream: vi.fn().mockImplementation(async ({ onDelta }) => {
          onDelta("Paper 1 不可使用计算器 [S1]");
          return {
            answer: "Paper 1 不可使用计算器 [S1]，无效引用会被忽略 [S9]。",
            model: "deepseek-v4-pro",
            usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
          };
        }),
      },
      limiter: new AnonymousAIRateLimiter(10, 60_000, 2, 10),
      serviceGuard: {
        beginProviderRequest: vi.fn().mockReturnValue({ allowed: true }),
        recordProviderSuccess: vi.fn(),
        recordProviderFailure: vi.fn(),
      },
    };
    const server = createAIHttpServer(dependencies);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: `http://127.0.0.1:${port}` },
        body: JSON.stringify(request()),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("x-accel-buffering")).toBe("no");

      const body = await response.text();
      expect(body).not.toContain("event:");
      const events = parseSSE(body);

      expect(events.map((event) => event.type)).toEqual([
        "meta",
        "delta",
        "citations",
        "suggestions",
        "done",
      ]);
      expect(events[0].resolvedContext).toEqual(resolvedContext);
      expect(events[2].citations).toEqual([source]);
      expect(events[4]).toMatchObject({
        type: "done",
        answer: "Paper 1 不可使用计算器 [S1]，无效引用会被忽略。",
        resolvedContext,
      });
      expect(dependencies.builder.build).toHaveBeenCalledOnce();
      expect(dependencies.provider.stream).toHaveBeenCalledOnce();
      expect(dependencies.serviceGuard.recordProviderSuccess).toHaveBeenCalledWith(30);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("rejects unsafe HTTP requests before any provider call", async () => {
    const dependencies: AIHttpServerDependencies = {
      builder: { build: vi.fn() },
      provider: { isConfigured: () => true, stream: vi.fn() },
      limiter: new AnonymousAIRateLimiter(),
      serviceGuard: new AIServiceGuard(),
    };
    const server = createAIHttpServer(dependencies);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const base = `http://127.0.0.1:${port}`;
      const health = await fetch(`${base}/api/ai/health`);
      expect(health.status).toBe(200);
      await expect(health.json()).resolves.toMatchObject({ status: "ok", service: "exambridge-ai" });
      expect((await fetch(`${base}/unknown`)).status).toBe(404);
      expect((await fetch(`${base}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
        body: JSON.stringify(request()),
      })).status).toBe(403);
      expect((await fetch(`${base}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })).status).toBe(400);
      expect((await fetch(`${base}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ padding: "x".repeat(70_000) }),
      })).status).toBe(413);
      expect(dependencies.builder.build).not.toHaveBeenCalled();
      expect(dependencies.provider.stream).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("returns local clarification and configuration errors without using provider quota", async () => {
    const resolvedContext = { awardQualificationIds: [], qualificationVersionIds: [], qualificationIds: [], qualificationCodes: [], paperIds: [], labels: [] };
    const builder = vi.fn()
      .mockResolvedValueOnce({ promptContext: "{}", sources: [], resolvedContext, clarification: "请先选择课程。" })
      .mockResolvedValueOnce({ promptContext: "{}", sources: [], resolvedContext });
    const serviceGuard = {
      beginProviderRequest: vi.fn().mockReturnValue({ allowed: true }),
      recordProviderSuccess: vi.fn(),
      recordProviderFailure: vi.fn(),
    };
    const server = createAIHttpServer({
      builder: { build: builder },
      provider: { isConfigured: () => false, stream: vi.fn() },
      limiter: new AnonymousAIRateLimiter(),
      serviceGuard,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const post = () => fetch(`http://127.0.0.1:${port}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request()),
      });
      expect(parseSSE(await (await post()).text()).map((event) => event.type)).toEqual(["meta", "delta", "suggestions", "done"]);
      expect(parseSSE(await (await post()).text())).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "error", code: "configuration-error" }),
      ]));
      expect(serviceGuard.beginProviderRequest).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("blocks exhausted service limits and records provider failures", async () => {
    const resolvedContext = { awardQualificationIds: ["award:caie:9709"], qualificationVersionIds: ["CAIE-9709:2026-2027"], qualificationIds: [], qualificationCodes: ["CAIE-9709"], paperIds: [], labels: ["9709"] };
    const builder = { build: vi.fn().mockResolvedValue({ promptContext: "{}", sources: [], resolvedContext }) };
    const provider = {
      isConfigured: () => true,
      stream: vi.fn().mockRejectedValue(new AIProviderError("rate", "unavailable", 429)),
    };
    const serviceGuard = {
      beginProviderRequest: vi.fn()
        .mockReturnValueOnce({ allowed: false, reason: "daily-token-limit", retryAfterSeconds: 60 })
        .mockReturnValueOnce({ allowed: true }),
      recordProviderSuccess: vi.fn(),
      recordProviderFailure: vi.fn(),
    };
    const server = createAIHttpServer({ builder, provider, limiter: new AnonymousAIRateLimiter(), serviceGuard });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const post = () => fetch(`http://127.0.0.1:${port}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request()),
      });
      expect(parseSSE(await (await post()).text())).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "error", code: "service-limit", retryAfterSeconds: 60 }),
      ]));
      expect(provider.stream).not.toHaveBeenCalled();
      expect(parseSSE(await (await post()).text())).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "error", code: "provider-unavailable", retryAfterSeconds: 30 }),
      ]));
      expect(provider.stream).toHaveBeenCalledOnce();
      expect(serviceGuard.recordProviderFailure).toHaveBeenCalledOnce();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("rejects an ungrounded provider answer instead of attaching unrelated sources", async () => {
    const source = {
      sourceId: "S1",
      title: "Official syllabus",
      url: "https://example.com/syllabus",
      dataVersion: "2026",
    };
    const serviceGuard = {
      beginProviderRequest: vi.fn().mockReturnValue({ allowed: true }),
      recordProviderSuccess: vi.fn(),
      recordProviderFailure: vi.fn(),
    };
    const server = createAIHttpServer({
      builder: {
        build: vi.fn().mockResolvedValue({
          promptContext: "{}",
          sources: [source],
          resolvedContext: { qualificationIds: [], qualificationCodes: ["CAIE-9709"], paperIds: [], labels: ["9709"] },
        }),
      },
      provider: {
        isConfigured: () => true,
        stream: vi.fn().mockResolvedValue({
          answer: "这段回答没有任何来源标记。",
          model: "deepseek-v4-pro",
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      },
      limiter: new AnonymousAIRateLimiter(),
      serviceGuard,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request()),
      });
      const events = parseSSE(await response.text());
      expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "error", code: "provider-unavailable" }),
      ]));
      expect(events.some((event) => event.type === "citations" || event.type === "done")).toBe(false);
      expect(serviceGuard.recordProviderFailure).toHaveBeenCalledOnce();
      expect(serviceGuard.recordProviderSuccess).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
