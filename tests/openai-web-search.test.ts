import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIWebSearchError, OpenAIWebSearchProvider } from "../server/ai/openai-web-search";

const directories: string[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function provider() {
  const directory = await mkdtemp(path.join(tmpdir(), "exambridge-openai-search-"));
  directories.push(directory);
  return {
    directory,
    provider: new OpenAIWebSearchProvider({
      OPENAI_API_KEY: "test-only-placeholder",
      OPENAI_SEARCH_MODEL: "gpt-5",
      OPENAI_RESPONSES_URL: "https://api.openai.example/v1/responses",
      OPENAI_SEARCH_CANDIDATE_DIR: directory,
    }),
  };
}

const request = (query = "9709 June 2025 overall threshold") => ({
  ip: "203.0.113.30",
  query,
  board: "CAIE",
  qualificationCode: "9709",
  year: 2025,
  series: "june" as const,
  conflictsWithActive: false,
  signal: new AbortController().signal,
});

const officialUrl = "https://www.cambridgeinternational.org/example/9709-june-2025.pdf";
const successfulPayload = {
  model: "gpt-5-2025-08-07",
  output: [
    { type: "web_search_call", action: { type: "search", sources: [{ type: "url", url: officialUrl }] } },
    {
      type: "message",
      content: [{
        type: "output_text",
        text: JSON.stringify({
          board: "CAIE",
          qualificationCode: "9709",
          year: 2025,
          series: "june",
          documentTitle: "9709 June 2025 grade threshold table",
          officialUrl,
          locator: "PDF page 2, row AX",
          summary: "The official row reports the overall threshold.",
          numericFacts: [{ label: "A", value: 180, maximum: 250 }],
        }),
        annotations: [{ type: "url_citation", url: officialUrl }],
      }],
    },
  ],
};

describe("OpenAI official web search adapter", () => {
  it("uses Responses API safeguards and persists only candidate evidence", async () => {
    const configured = await provider();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(successfulPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
    const result = await configured.provider.search(request());
    expect(result.evidence).toMatchObject({
      provider: "openai-web-search",
      requestedModel: "gpt-5",
      returnedModel: "gpt-5-2025-08-07",
      allowedDomain: true,
      exactIdentityMatch: true,
      numericValidationPassed: true,
      directAnswerEligible: true,
      verificationStatus: "candidate",
    });
    expect(await readdir(configured.directory)).toHaveLength(1);
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({ store: false, model: "gpt-5", tool_choice: "required", max_tool_calls: 4 });
    expect(body.tools[0]).toMatchObject({
      type: "web_search",
      filters: { allowed_domains: expect.arrayContaining(["cambridgeinternational.org", "qualifications.pearson.com"]) },
    });
    expect(JSON.stringify(body)).not.toContain("aqa.org.uk");
  });

  it("reuses a 12-hour in-memory cache without another API request", async () => {
    const configured = await provider();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify(successfulPayload), { status: 200 })));
    expect((await configured.provider.search(request())).cached).toBe(false);
    expect((await configured.provider.search(request())).cached).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects AQA before any external call and rejects third-party evidence for direct answers", async () => {
    const configured = await provider();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(configured.provider.search({ ...request(), board: "AQA" })).rejects.toMatchObject({ kind: "policy" } satisfies Partial<OpenAIWebSearchError>);
    expect(fetchMock).not.toHaveBeenCalled();

    const thirdPartyUrl = "https://example.com/9709.pdf";
    const payload = JSON.parse(JSON.stringify(successfulPayload));
    payload.output[0].action.sources[0].url = thirdPartyUrl;
    payload.output[1].content[0].annotations[0].url = thirdPartyUrl;
    payload.output[1].content[0].text = JSON.stringify({
      ...JSON.parse(payload.output[1].content[0].text),
      officialUrl: thirdPartyUrl,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    const rejected = await configured.provider.search(request("different uncached query"));
    expect(rejected.evidence).toMatchObject({ allowedDomain: false, directAnswerEligible: false });
  });

  it("enforces five searches per IP per ten minutes", async () => {
    const configured = await provider();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify(successfulPayload), { status: 200 })));
    for (let index = 0; index < 5; index += 1) await configured.provider.search(request(`query-${index}`));
    await expect(configured.provider.search(request("query-5"))).rejects.toMatchObject({ kind: "rate-limited" });
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});
