import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ExternalEvidenceV1Schema, type ExternalEvidenceV1 } from "@/domain-v2/academic-results";

export const OPENAI_SEARCH_ALLOWED_DOMAINS = [
  "cambridgeinternational.org",
  "qualifications.pearson.com",
  "ocr.org.uk",
  "wjec.co.uk",
  "gov.uk",
  "jcq.org.uk",
] as const;

export type OfficialSearchRequest = {
  ip: string;
  query: string;
  board: string;
  qualificationCode: string;
  year?: number;
  series?: "january" | "march" | "june" | "october" | "november" | "other";
  conflictsWithActive: boolean;
  signal: AbortSignal;
};

export type OfficialSearchResult = {
  evidence: ExternalEvidenceV1;
  summary: string;
  numericFacts: Array<{ label: string; value: number; maximum?: number }>;
  cached: boolean;
};

export class OpenAIWebSearchError extends Error {
  constructor(
    message: string,
    public readonly kind: "configuration" | "rate-limited" | "busy" | "timeout" | "unavailable" | "policy",
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "OpenAIWebSearchError";
  }
}

type CacheEntry = { expiresAt: number; result: OfficialSearchResult };
type WindowRecord = { startedAt: number; count: number };

const normalizedBoard = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
const normalizedCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");

const allowedUrl = (value: string) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return OPENAI_SEARCH_ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

const outputText = (payload: Record<string, unknown>) => {
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.flatMap(item => {
    if (!item || typeof item !== "object" || !Array.isArray((item as { content?: unknown[] }).content)) return [];
    return (item as { content: unknown[] }).content.flatMap(content => {
      if (!content || typeof content !== "object") return [];
      const text = (content as { text?: unknown }).text;
      return typeof text === "string" ? [text] : [];
    });
  }).join("").trim();
};

const responseUrls = (payload: Record<string, unknown>) => {
  const urls: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "url" && typeof child === "string") urls.push(child);
      else visit(child);
    }
  };
  visit(payload.output);
  return [...new Set(urls)];
};

const parseExtraction = (text: string) => {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const numericFacts = Array.isArray(parsed.numericFacts)
    ? parsed.numericFacts.flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const fact = item as { label?: unknown; value?: unknown; maximum?: unknown };
        if (typeof fact.label !== "string" || typeof fact.value !== "number") return [];
        return [{
          label: fact.label,
          value: fact.value,
          ...(typeof fact.maximum === "number" ? { maximum: fact.maximum } : {}),
        }];
      })
    : [];
  return {
    board: String(parsed.board ?? ""),
    qualificationCode: String(parsed.qualificationCode ?? ""),
    year: typeof parsed.year === "number" ? parsed.year : undefined,
    series: typeof parsed.series === "string" ? parsed.series : undefined,
    documentTitle: String(parsed.documentTitle ?? ""),
    officialUrl: String(parsed.officialUrl ?? ""),
    locator: String(parsed.locator ?? ""),
    summary: String(parsed.summary ?? ""),
    numericFacts,
  };
};

export class OpenAIWebSearchProvider {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly candidateDirectory: string;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly windows = new Map<string, WindowRecord>();
  private active = 0;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.apiKey = env.OPENAI_API_KEY;
    this.model = env.OPENAI_SEARCH_MODEL || "gpt-5";
    this.endpoint = env.OPENAI_RESPONSES_URL || "https://api.openai.com/v1/responses";
    this.timeoutMs = Number(env.OPENAI_SEARCH_TIMEOUT_MS ?? 45_000);
    this.candidateDirectory = path.resolve(env.OPENAI_SEARCH_CANDIDATE_DIR || path.join(process.cwd(), "var/candidates/external-evidence"));
  }

  isConfigured() {
    return Boolean(this.apiKey && this.model && this.endpoint.startsWith("https://"));
  }

  private acquire(ip: string, now: number) {
    let record = this.windows.get(ip);
    if (!record || now - record.startedAt >= 10 * 60_000) {
      record = { startedAt: now, count: 0 };
      this.windows.set(ip, record);
    }
    if (record.count >= 5) {
      throw new OpenAIWebSearchError("External search rate limit reached", "rate-limited", Math.max(1, Math.ceil((record.startedAt + 10 * 60_000 - now) / 1_000)));
    }
    if (this.active >= 3) throw new OpenAIWebSearchError("External search is busy", "busy", 10);
    record.count += 1;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }

  private async persist(result: OfficialSearchResult) {
    await mkdir(this.candidateDirectory, { recursive: true });
    const filename = `${result.evidence.evidenceId.replace(/[^a-zA-Z0-9._-]+/g, "-")}.json`;
    const target = path.join(this.candidateDirectory, filename);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, target);
  }

  async search(request: OfficialSearchRequest): Promise<OfficialSearchResult> {
    if (!this.isConfigured()) throw new OpenAIWebSearchError("OpenAI web search is not configured", "configuration");
    if (normalizedBoard(request.board) === "aqa") throw new OpenAIWebSearchError("AQA is excluded from external AI calls", "policy");
    const cacheKey = createHash("sha256").update(JSON.stringify({
      query: request.query,
      board: request.board,
      qualificationCode: request.qualificationCode,
      year: request.year,
      series: request.series,
    })).digest("hex");
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ...cached.result, cached: true };

    const release = this.acquire(request.ip, Date.now());
    try {
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(this.timeoutMs)]);
      const prompt = [
        "Search only the allowed official domains for the requested qualification fact.",
        "Do not use third-party summaries. Return one JSON object and no Markdown.",
        "Required keys: board, qualificationCode, year, series, documentTitle, officialUrl, locator, summary, numericFacts.",
        "locator must identify a page, table, or row. numericFacts is an array of {label,value,maximum?}.",
        `Identity: board=${request.board}; qualificationCode=${request.qualificationCode}; year=${request.year ?? "unspecified"}; series=${request.series ?? "unspecified"}.`,
        `Question: ${request.query}`,
      ].join("\n");
      let response: Response;
      try {
        response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "ExamBridge-Official-Search/1.0",
          },
          body: JSON.stringify({
            model: this.model,
            store: false,
            input: prompt,
            tools: [{
              type: "web_search",
              filters: { allowed_domains: OPENAI_SEARCH_ALLOWED_DOMAINS },
              search_context_size: "medium",
            }],
            tool_choice: "required",
            max_tool_calls: 4,
            max_output_tokens: 2_500,
          }),
          signal,
        });
      } catch (error) {
        if (signal.aborted) throw new OpenAIWebSearchError("OpenAI web search timed out or was cancelled", "timeout");
        throw new OpenAIWebSearchError(error instanceof Error ? error.message : "OpenAI web search network error", "unavailable");
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new OpenAIWebSearchError(error.error?.message ?? `OpenAI HTTP ${response.status}`, response.status === 429 ? "rate-limited" : "unavailable", response.status === 429 ? 30 : undefined);
      }
      const payload = await response.json() as Record<string, unknown>;
      const returnedModel = typeof payload.model === "string" ? payload.model : this.model;
      const searchCalls = Array.isArray(payload.output)
        ? payload.output.filter(item => item && typeof item === "object" && (item as { type?: unknown }).type === "web_search_call").length
        : 0;
      if (searchCalls > 4) throw new OpenAIWebSearchError("OpenAI exceeded the configured web search call limit", "unavailable");
      let extracted: ReturnType<typeof parseExtraction>;
      try {
        extracted = parseExtraction(outputText(payload));
      } catch {
        throw new OpenAIWebSearchError("OpenAI web search did not return valid structured evidence", "unavailable");
      }
      const urls = responseUrls(payload);
      const allowedDomain = allowedUrl(extracted.officialUrl) && urls.includes(extracted.officialUrl);
      const exactIdentityMatch = normalizedBoard(extracted.board) === normalizedBoard(request.board)
        && normalizedCode(extracted.qualificationCode) === normalizedCode(request.qualificationCode)
        && (request.year === undefined || extracted.year === request.year)
        && (request.series === undefined || extracted.series === request.series);
      const numericValidationPassed = extracted.numericFacts.length > 0 && extracted.numericFacts.every(fact =>
        Number.isFinite(fact.value)
        && fact.value >= 0
        && fact.value <= 100_000
        && (fact.maximum === undefined || (Number.isFinite(fact.maximum) && fact.maximum > 0 && fact.value <= fact.maximum)),
      );
      const retrievedAt = new Date().toISOString();
      const evidence = ExternalEvidenceV1Schema.parse({
        schemaVersion: "1.0.0",
        evidenceId: `external:${cacheKey.slice(0, 24)}:${retrievedAt}`,
        provider: "openai-web-search",
        requestedModel: this.model,
        returnedModel,
        query: request.query,
        board: request.board,
        qualificationCode: request.qualificationCode,
        ...(request.year === undefined ? {} : { year: request.year }),
        ...(request.series === undefined ? {} : { series: request.series }),
        officialUrl: extracted.officialUrl,
        documentTitle: extracted.documentTitle,
        locator: extracted.locator || undefined,
        retrievedAt,
        allowedDomain,
        exactIdentityMatch,
        numericValidationPassed,
        conflictsWithActive: request.conflictsWithActive,
        directAnswerEligible: Boolean(allowedDomain && exactIdentityMatch && numericValidationPassed && extracted.locator && !request.conflictsWithActive),
        verificationStatus: "candidate",
      });
      const result = { evidence, summary: extracted.summary, numericFacts: extracted.numericFacts, cached: false };
      await this.persist(result);
      this.cache.set(cacheKey, { expiresAt: Date.now() + 12 * 60 * 60_000, result });
      return result;
    } finally {
      release();
    }
  }
}
