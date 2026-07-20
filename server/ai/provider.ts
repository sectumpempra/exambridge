import { randomUUID } from "node:crypto";
import type { AIChatMessage, AICitation } from "@/domain-v2/ai-assistant";

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "unavailable" | "configuration",
    readonly status = 0,
  ) {
    super(message);
  }
}

type StreamProviderOptions = {
  system: string;
  messages: AIChatMessage[];
  reasoningEffort: "low" | "max";
  signal: AbortSignal;
  onDelta: (text: string) => void;
};

type ProviderResult = {
  answer: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  providerRequestId?: string;
};

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => typeof part === "string" ? part : String((part as { text?: string; content?: string })?.text ?? (part as { content?: string })?.content ?? "")).join("");
}

function sanitizeAnswer(answer: string): string {
  return answer
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, "$1")
    .replace(/https?:\/\/[^\s)\]]+/gi, "[未展示的外部链接]")
    .trim();
}

class StreamingUrlSanitizer {
  private pending = "";
  private inUrl = false;
  private readonly protocols = ["http://", "https://"];

  write(input: string): string {
    let output = "";
    for (const character of input) {
      if (this.inUrl) {
        if (/\s|[)\]}]/.test(character)) {
          output += `[未展示的外部链接]${character}`;
          this.inUrl = false;
        }
        continue;
      }
      this.pending += character;
      while (this.pending) {
        const lower = this.pending.toLowerCase();
        if (this.protocols.includes(lower)) {
          this.pending = "";
          this.inUrl = true;
          break;
        }
        if (this.protocols.some((protocol) => protocol.startsWith(lower))) break;
        output += this.pending[0];
        this.pending = this.pending.slice(1);
      }
    }
    return output;
  }

  finish(): string {
    const output = this.inUrl ? "[未展示的外部链接]" : this.pending;
    this.inUrl = false;
    this.pending = "";
    return output;
  }
}

export function hydrateCitations(answer: string, allowedSources: AICitation[]): AICitation[] {
  const allowed = new Map(allowedSources.map((source) => [source.sourceId, source]));
  const requested = [...answer.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]);
  return [...new Set(requested)].flatMap((sourceId) => allowed.get(sourceId) ?? []);
}

export class DeepSeekChatProvider {
  private readonly apiKey = process.env.DEEPSEEK_API_KEY;
  private readonly baseUrl = process.env.DEEPSEEK_BASE_URL;
  private readonly model = process.env.DEEPSEEK_MODEL;
  private readonly timeoutMs = Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 60_000);

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.baseUrl && this.model);
  }

  async stream(options: StreamProviderOptions): Promise<ProviderResult> {
    if (!this.apiKey || !this.baseUrl || !this.model) {
      throw new AIProviderError("DeepSeek server configuration is incomplete", "configuration");
    }
    const clientRequestId = randomUUID();
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const signal = AbortSignal.any([options.signal, timeoutSignal]);
    let response: Response;
    try {
      response = await fetch(chatCompletionsUrl(this.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "ExamBridge-AI/1.0",
          "X-Client-Request-Id": clientRequestId,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "system", content: options.system }, ...options.messages],
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: 2_500,
          thinking: { type: "enabled" },
          reasoning_effort: options.reasoningEffort,
          user_id: "exambridge-anonymous",
        }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw new AIProviderError("DeepSeek request timed out or was cancelled", "timeout");
      throw new AIProviderError(error instanceof Error ? error.message : "DeepSeek network error", "unavailable");
    }

    const providerRequestId = response.headers.get("x-request-id")
      ?? response.headers.get("request-id")
      ?? response.headers.get("trace-id")
      ?? undefined;
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new AIProviderError(payload.error?.message ?? `DeepSeek HTTP ${response.status}`, "unavailable", response.status);
    }
    if (!response.body) throw new AIProviderError("DeepSeek streaming body is missing", "unavailable");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let returnedModel = "";
    let usage: ProviderResult["usage"];
    const streamSanitizer = new StreamingUrlSanitizer();
    const consume = (event: string) => {
      const data = event.split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")
        .trim();
      if (!data || data === "[DONE]") return;
      const chunk = JSON.parse(data) as {
        model?: string;
        usage?: ProviderResult["usage"];
        choices?: Array<{ delta?: { content?: unknown }; message?: { content?: unknown } }>;
      };
      returnedModel = chunk.model ?? returnedModel;
      usage = chunk.usage ?? usage;
      const text = contentText(chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content);
      if (text) {
        answer += text;
        const safeDelta = streamSanitizer.write(text);
        if (safeDelta) options.onDelta(safeDelta);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        events.forEach(consume);
        if (done) break;
      }
      if (buffer.trim()) consume(buffer);
      const finalDelta = streamSanitizer.finish();
      if (finalDelta) options.onDelta(finalDelta);
    } catch (error) {
      if (signal.aborted) throw new AIProviderError("DeepSeek request timed out or was cancelled", "timeout");
      throw new AIProviderError(error instanceof Error ? error.message : "Invalid DeepSeek stream", "unavailable");
    }
    if (returnedModel && returnedModel !== this.model) {
      throw new AIProviderError(`Unexpected model response: ${returnedModel}`, "unavailable");
    }
    return { answer: sanitizeAnswer(answer), model: returnedModel || this.model, usage, providerRequestId };
  }
}

export function ensureAnswerCitations(answer: string, sources: AICitation[]): string {
  if (hydrateCitations(answer, sources).length > 0 || sources.length === 0) return answer;
  const ids = sources.slice(0, 2).map((source) => `[${source.sourceId}]`).join(" ");
  return `${answer}\n\n资料来源：${ids}`;
}
