import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AIChatRequestSchema,
  pruneAIChatHistory,
  type AIChatRequest,
} from "@/domain-v2/ai-assistant";
import { AIContextBuilder, overviewIdentityMatches } from "../server/ai/context-builder";
import { AnonymousAIRateLimiter } from "../server/ai/rate-limit";
import { AIProviderError, DeepSeekChatProvider, hydrateCitations } from "../server/ai/provider";
import { isComplexAIQuestion } from "../server/ai/prompt";
import { createAIHttpServer, type AIHttpServerDependencies } from "../server/ai";

function request(overrides: Partial<AIChatRequest> = {}): AIChatRequest {
  return {
    mode: "exam_assistant",
    qualificationIds: [],
    syllabusVersions: [],
    pageContext: { pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: [], comparisonIds: [] },
    messages: [{ role: "user", content: "9709 可以使用计算器吗？" }],
    locale: "zh-CN",
    ...overrides,
  };
}

describe("AI assistant request and history safety", () => {
  it("rejects oversized messages, excessive courses, and unknown modes", () => {
    expect(AIChatRequestSchema.safeParse({ ...request(), messages: [{ role: "user", content: "x".repeat(2_001) }] }).success).toBe(false);
    expect(AIChatRequestSchema.safeParse({ ...request(), qualificationIds: ["a", "b", "c"] }).success).toBe(false);
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

  it("blocks pasted AQA statement wording before any provider prompt is built", async () => {
    const rawAqa = JSON.parse(await readFile(path.join(process.cwd(), "public/data/knowledge-v5/mappings/AQA-8300.json"), "utf8")) as { statements: Array<{ statementText: string }> };
    const original = rawAqa.statements.find((statement) => statement.statementText.split(/\s+/).length >= 6)!;
    const result = await builder.build(request({
      pageContext: { pageType: "knowledge-comparison", route: "/knowledge-tree", selectedPaperIds: [], comparisonIds: ["AQA-8300"] },
      messages: [{ role: "user", content: `请解释这段：${original.statementText}` }],
    }));
    expect(result.clarification).toContain("AQA");
    expect(result.promptContext).toBe("{}");
    expect(result.sources).toHaveLength(0);
  });

  it("preserves the second Paper slot in a Paper-vs-subject comparison", async () => {
    const result = await builder.build(request({
      pageContext: { pageType: "knowledge-comparison", route: "/knowledge-tree", selectedPaperIds: ["", "4MA1-1H"], comparisonIds: ["CAIE-0580", "Edexcel-4MA1"] },
      messages: [{ role: "user", content: "这两个选择的差异是什么？" }],
    }));
    expect(result.promptContext).toContain('"selectedPaperId":null');
    expect(result.promptContext).toContain('"selectedPaperId":"4MA1-1H"');
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

  it("uses maximum reasoning for comparisons and lower reasoning for simple facts", () => {
    expect(isComplexAIQuestion(request())).toBe(false);
    expect(isComplexAIQuestion(request({ messages: [{ role: "user", content: "比较 9709 和 9MA0 的区别" }] }))).toBe(true);
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
  });
});

describe("AI assistant HTTP/SSE boundary", () => {
  it("streams typed data-only events with resolved context and allow-listed citations", async () => {
    const resolvedContext = {
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
      const events = body
        .split(/\r?\n\r?\n/)
        .map((block) => block.split(/\r?\n/).find((line) => line.startsWith("data:")))
        .filter((line): line is string => Boolean(line))
        .map((line) => JSON.parse(line.slice(5).trimStart()));

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
        answer: "Paper 1 不可使用计算器 [S1]，无效引用会被忽略 [S9]。",
        resolvedContext,
      });
      expect(dependencies.builder.build).toHaveBeenCalledOnce();
      expect(dependencies.provider.stream).toHaveBeenCalledOnce();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
