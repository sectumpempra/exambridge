import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { AIChatRequestSchema, AIStreamEventSchema, type AIStreamEvent } from "@/domain-v2/ai-assistant";
import { pruneAIChatHistory } from "@/domain-v2/ai-assistant/history";
import { AIContextBuilder } from "./context-builder";
import { DeepSeekChatProvider, AIProviderError, ensureAnswerCitations, hydrateCitations } from "./provider";
import { AnonymousAIRateLimiter } from "./rate-limit";
import { AIServiceGuard, createAIServiceGuardFromEnv } from "./service-guard";
import { buildAISystemPrompt, isComplexAIQuestion } from "./prompt";
import { enforceDeterministicPaperFacts } from "./answer-grounding";

const PORT = Number(process.env.AI_PORT ?? 8789);
const HOST = process.env.AI_HOST ?? "127.0.0.1";
const MAX_BODY_BYTES = 64 * 1_024;

export interface AIHttpServerDependencies {
  builder: Pick<AIContextBuilder, "build">;
  provider: Pick<DeepSeekChatProvider, "isConfigured" | "stream">;
  limiter: Pick<AnonymousAIRateLimiter, "acquire">;
  serviceGuard: Pick<AIServiceGuard, "beginProviderRequest" | "recordProviderSuccess" | "recordProviderFailure">;
}

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

function sseHeaders(res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Content-Type-Options": "nosniff",
  });
  res.flushHeaders();
}

function sendEvent(res: ServerResponse, event: AIStreamEvent) {
  const validated = AIStreamEventSchema.parse(event);
  if (!res.destroyed && !res.writableEnded) res.write(`data: ${JSON.stringify(validated)}\n\n`);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("request-body-too-large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requestIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return first?.trim() || req.socket.remoteAddress || "unknown";
}

function isLoopbackHost(value: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(value);
}

function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host ?? "";
  try {
    const originHost = new URL(origin).host;
    if (originHost === host) return true;
    if (isLoopbackHost(originHost) && isLoopbackHost(host)) return true;
    const allowed = (process.env.AI_ALLOWED_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    return allowed.includes(origin);
  } catch {
    return false;
  }
}

function errorEvent(code: AIStreamEvent & { type: "error" }): AIStreamEvent {
  return code;
}

async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: AIHttpServerDependencies,
) {
  const { builder, provider, limiter, serviceGuard } = dependencies;
  if (!originAllowed(req)) {
    json(res, 403, { error: "origin-not-allowed" });
    return;
  }

  let parsed;
  try {
    parsed = AIChatRequestSchema.safeParse(await readBody(req));
  } catch (error) {
    json(res, error instanceof Error && error.message === "request-body-too-large" ? 413 : 400, { error: "invalid-request" });
    return;
  }
  if (!parsed.success) {
    json(res, 400, { error: "invalid-request", fields: parsed.error.issues.map((issue) => issue.path.join(".")) });
    return;
  }

  const decision = limiter.acquire(requestIp(req));
  if (!decision.allowed) {
    json(res, decision.reason === "rate-limited" ? 429 : 503, {
      error: decision.reason,
      retryAfterSeconds: decision.retryAfterSeconds,
    });
    return;
  }

  const requestId = randomUUID();
  const startedAt = Date.now();
  const controller = new AbortController();
  res.on("close", () => controller.abort());
  sseHeaders(res);
  let status = "success";
  let model = "none";
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let paperFactCorrections = 0;
  let reasoningEffort: "none" | "low" | "max" = "none";
  let providerAttempted = false;
  let providerSucceeded = false;
  try {
    const request = { ...parsed.data, messages: pruneAIChatHistory(parsed.data.messages) };
    const context = await builder.build(request);
    sendEvent(res, { type: "meta", requestId, resolvedContext: context.resolvedContext });

    if (context.clarification) {
      sendEvent(res, { type: "delta", text: context.clarification });
      sendEvent(res, { type: "suggestions", suggestions: ["选择当前课程", "输入资格代码，例如 9709"] });
      sendEvent(res, { type: "done", answer: context.clarification, requestId, resolvedContext: context.resolvedContext });
      return;
    }
    if (!provider.isConfigured()) {
      status = "configuration-error";
      sendEvent(res, errorEvent({
        type: "error",
        code: "configuration-error",
        message: "AI 服务尚未在服务器完成配置，请稍后再试。",
      }));
      return;
    }

    const guardDecision = serviceGuard.beginProviderRequest();
    if (!guardDecision.allowed) {
      status = guardDecision.reason;
      sendEvent(res, errorEvent({
        type: "error",
        code: "service-limit",
        message: guardDecision.reason === "provider-circuit-open"
          ? "AI 服务连续失败，已暂时停止生成，请稍后再试。"
          : "AI 服务今日使用额度已达到安全上限，请明日再试。",
        retryAfterSeconds: guardDecision.retryAfterSeconds,
      }));
      return;
    }

    reasoningEffort = isComplexAIQuestion(request) ? "max" : "low";
    const system = buildAISystemPrompt(request, context.promptContext);
    providerAttempted = true;
    const result = await provider.stream({
      system,
      messages: request.messages,
      reasoningEffort,
      signal: controller.signal,
      onDelta: (text) => sendEvent(res, { type: "delta", text }),
    });
    model = result.model;
    promptTokens = result.usage?.prompt_tokens ?? 0;
    completionTokens = result.usage?.completion_tokens ?? 0;
    const reportedTotalTokens = result.usage?.total_tokens ?? promptTokens + completionTokens;
    totalTokens = reportedTotalTokens > 0
      ? reportedTotalTokens
      : Math.ceil((system.length + request.messages.reduce((sum, message) => sum + message.content.length, 0) + result.answer.length) / 4);
    const grounded = enforceDeterministicPaperFacts(result.answer, context.paperFacts ?? []);
    paperFactCorrections = grounded.corrections.length;
    const answer = ensureAnswerCitations(grounded.answer, context.sources);
    const citations = hydrateCitations(answer, context.sources);
    if (context.sources.length > 0 && citations.length === 0) {
      throw new AIProviderError("DeepSeek answer did not cite an allowed source", "unavailable");
    }
    providerSucceeded = true;
    serviceGuard.recordProviderSuccess(totalTokens);
    sendEvent(res, { type: "citations", citations });
    sendEvent(res, {
      type: "suggestions",
      suggestions: request.pageContext.pageType === "knowledge-comparison"
        ? ["解释方向性覆盖率", "列出最重要的独有内容", "用家长容易理解的方式总结"]
        : ["说明各张 Paper 的区别", "解释计算器规则", "用家长容易理解的方式总结"],
    });
    sendEvent(res, { type: "done", answer, requestId, resolvedContext: context.resolvedContext });
  } catch (error) {
    if (controller.signal.aborted && res.destroyed) {
      status = "client-aborted";
      return;
    }
    if (error instanceof AIProviderError) {
      if (providerAttempted && !providerSucceeded && error.kind !== "configuration") serviceGuard.recordProviderFailure();
      status = `provider-${error.kind}`;
      sendEvent(res, errorEvent({
        type: "error",
        code: error.kind === "timeout" ? "provider-timeout" : error.kind === "configuration" ? "configuration-error" : "provider-unavailable",
        message: error.kind === "timeout" ? "生成超时，请缩短问题后重试。" : "AI 服务暂时不可用，请稍后再试。",
        ...(error.status === 429 ? { retryAfterSeconds: 30 } : {}),
      }));
    } else {
      status = "internal-error";
      sendEvent(res, errorEvent({ type: "error", code: "internal-error", message: "当前资料上下文构建失败，请稍后再试。" }));
    }
  } finally {
    decision.release();
    if (!res.writableEnded) res.end();
    console.info(JSON.stringify({
      event: "exambridge-ai-request",
      requestId,
      status,
      model,
      reasoningEffort,
      promptTokens,
      completionTokens,
      totalTokens,
      paperFactCorrections,
      elapsedMs: Date.now() - startedAt,
    }));
  }
}

export function createAIHttpServer(overrides: Partial<AIHttpServerDependencies> = {}) {
  const dependencies: AIHttpServerDependencies = {
    builder: overrides.builder ?? new AIContextBuilder(),
    provider: overrides.provider ?? new DeepSeekChatProvider(),
    limiter: overrides.limiter ?? new AnonymousAIRateLimiter(),
    serviceGuard: overrides.serviceGuard ?? createAIServiceGuardFromEnv(),
  };
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (req.method === "GET" && url.pathname === "/api/ai/health") {
      json(res, dependencies.provider.isConfigured() ? 200 : 503, {
        status: dependencies.provider.isConfigured() ? "ok" : "not-configured",
        service: "exambridge-ai",
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/ai/chat") {
      await handleChat(req, res, dependencies);
      return;
    }
    json(res, 404, { error: "not-found" });
  });
}

if (process.env.NODE_ENV !== "test") {
  createAIHttpServer().listen(PORT, HOST, () => {
    console.info(JSON.stringify({ event: "exambridge-ai-started", host: HOST, port: PORT }));
  });
}
