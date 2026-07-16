import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assetHref,
  buildPastPaperSets,
  getPastPaperCatalogMaturity,
  getPastPaperCatalogRegistryEntry,
  loadPastPaperCatalog,
  resolvePastPaperCatalogKey,
} from "@/domain-v2/past-papers/catalog";
import {
  PastPaperAssetSchema,
  PastPaperCatalogCandidateSchema,
  PastPaperCatalogSchema,
  type PastPaperAsset,
  type PastPaperCatalog,
} from "@/domain-v2/past-papers/schema";

const baseAsset = (overrides: Partial<PastPaperAsset> = {}): PastPaperAsset => ({
  id: "asset-1",
  year: 2025,
  series: "june",
  materialType: "examiner-report",
  title: "Official material",
  sourcePageUrl: "https://example.com/materials",
  accessStatus: "public",
  distributionStatus: "link-only",
  syllabusApplicability: "current",
  rights: { basis: "official-link-only", note: "Official link only" },
  provenance: { sourceType: "official", verifiedAt: "2026-07-16", verifiedBy: "human" },
  linkStatus: { status: "ok", checkedAt: "2026-07-16" },
  ...overrides,
});

const baseCatalog = (assets: PastPaperAsset[]): PastPaperCatalog => ({
  schemaVersion: "1.1.0",
  key: "test",
  board: "CAIE",
  qualificationCode: "9709",
  subjectCode: "9709",
  qualificationName: "Mathematics",
  aliases: [],
  sourcePageUrl: "https://example.com/official",
  accessNote: "Official links only",
  release: { status: "approved", approvedAt: "2026-07-16", verifiedAt: "2026-07-16", approvedBy: "human" },
  coverage: [2021, 2022, 2023, 2024, 2025].map((year) => ({
    year,
    scope: "year-summary" as const,
    status: "review-required" as const,
    sourcePageUrl: "https://example.com/official",
    verifiedAt: "2026-07-16",
    note: "Awaiting complete sitting-level review",
  })),
  assets,
});

afterEach(() => vi.unstubAllGlobals());

describe("past-paper catalog resolution and loading", () => {
  it("normalizes boards, codes and aliases without guessing unknown catalogs", () => {
    expect(resolvePastPaperCatalogKey("Cambridge International", "9709/12")).toBe("caie-9709");
    expect(resolvePastPaperCatalogKey("Pearson Edexcel", "wma11")).toBe("pearson-yma01");
    expect(resolvePastPaperCatalogKey("OCR", "h240")).toBe("ocr-h240");
    expect(resolvePastPaperCatalogKey("Unknown", "9709")).toBeUndefined();
    expect(getPastPaperCatalogRegistryEntry("missing")).toBeUndefined();
  });

  it("loads, validates and caches a supported official catalog", async () => {
    const payload = JSON.parse(readFileSync("public/data/past-papers/caie-9709.json", "utf8"));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);
    const first = await loadPastPaperCatalog("caie-9709");
    const second = await loadPastPaperCatalog("caie-9709");
    expect(first.key).toBe("caie-9709");
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(loadPastPaperCatalog("unsupported")).rejects.toThrow("Unsupported past-paper catalog");
  });

  it("rejects HTTP failures and evicts the failed request so it can retry", async () => {
    const payload = JSON.parse(readFileSync("public/data/past-papers/caie-9231.json", "utf8"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadPastPaperCatalog("caie-9231")).rejects.toThrow("503");
    await Promise.resolve();
    await expect(loadPastPaperCatalog("caie-9231")).resolves.toMatchObject({ key: "caie-9231" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("past-paper maturity, grouping and distribution", () => {
  const question = baseAsset({ id: "q", paperSetId: "set-1", paperCode: "9709/12", componentCode: "12", materialType: "question-paper", officialFileUrl: "https://example.com/q.pdf" });
  const markScheme = baseAsset({ id: "ms", paperSetId: "set-1", componentCode: "12", materialType: "mark-scheme", officialFileUrl: "https://example.com/ms.pdf" });

  it("distinguishes every catalog maturity state", () => {
    expect(getPastPaperCatalogMaturity(baseCatalog([]))).toBe("catalogued");
    expect(getPastPaperCatalogMaturity(baseCatalog([baseAsset()]))).toBe("metadata-ready");
    expect(getPastPaperCatalogMaturity(baseCatalog([{ ...question, accessStatus: "account-required" }]))).toBe("metadata-ready");
    expect(getPastPaperCatalogMaturity(baseCatalog([{ ...question, linkStatus: { ...question.linkStatus, status: "broken" } }]))).toBe("metadata-ready");
    expect(getPastPaperCatalogMaturity(baseCatalog([question]))).toBe("past-paper-ready");
    expect(getPastPaperCatalogMaturity(baseCatalog([question, { ...markScheme, provenance: { ...markScheme.provenance, verifiedBy: "candidate-only" } }]))).toBe("past-paper-ready");
    expect(getPastPaperCatalogMaturity(baseCatalog([question, markScheme]))).toBe("verified");
  });

  it("pairs and sorts assets while respecting component filters", () => {
    const older = baseAsset({ ...question, id: "q-old", paperSetId: "set-old", componentCode: "22", year: 2024, series: "november" });
    const report = baseAsset({ id: "er", paperSetId: "set-1", materialType: "examiner-report" });
    const catalog = baseCatalog([older, markScheme, report, question]);
    expect(buildPastPaperSets(catalog).map((set) => set.id)).toEqual(["set-1", "set-old"]);
    expect(buildPastPaperSets(catalog)[0]).toMatchObject({ markScheme: { id: "ms" }, companions: [{ id: "er" }] });
    expect(buildPastPaperSets(catalog, ["22"]).map((set) => set.id)).toEqual(["set-old"]);
    expect(buildPastPaperSets(catalog, ["99"])).toEqual([]);
    expect(buildPastPaperSets(catalog, undefined, { forPlanning: true })).toHaveLength(2);
    expect(buildPastPaperSets(baseCatalog([{ ...question, syllabusApplicability: "review-required" }]), undefined, { forPlanning: true })).toEqual([]);
  });

  it("only returns a download target allowed by the distribution policy", () => {
    expect(assetHref({ ...question, distributionStatus: "hosting-permitted", hostedPath: "/exam-materials/permitted.pdf", rights: { basis: "written-permission", note: "Permission on file" } })).toBe("/exam-materials/permitted.pdf");
    expect(assetHref(question)).toBe("https://example.com/q.pdf");
    expect(assetHref({ ...question, officialFileUrl: undefined })).toBe(question.sourcePageUrl);
    expect(assetHref({ ...question, distributionStatus: "restricted" })).toBeUndefined();
  });
});

describe("past-paper schemas", () => {
  it("requires set identity for papers and explicit redistribution evidence for hosting", () => {
    expect(PastPaperAssetSchema.safeParse({ ...baseAsset(), materialType: "question-paper" }).success).toBe(false);
    expect(PastPaperAssetSchema.safeParse({ ...baseAsset(), distributionStatus: "hosting-permitted" }).success).toBe(false);
    expect(PastPaperAssetSchema.safeParse({ ...baseAsset(), distributionStatus: "hosting-permitted", hostedPath: "/exam-materials/x.pdf" }).success).toBe(false);
    expect(PastPaperAssetSchema.safeParse({ ...baseAsset(), hostedPath: "/exam-materials/x.pdf" }).success).toBe(false);
    expect(PastPaperAssetSchema.safeParse({ ...baseAsset(), distributionStatus: "hosting-permitted", hostedPath: "/exam-materials/x.pdf", rights: { basis: "public-licence", note: "Licence", evidenceUrl: "https://example.com/licence" } }).success).toBe(true);
  });

  it("separates approved active catalogs from model-generated candidates", () => {
    const approved = baseCatalog([]);
    expect(PastPaperCatalogSchema.safeParse(approved).success).toBe(true);
    expect(PastPaperCatalogCandidateSchema.safeParse({ ...approved, release: { status: "candidate", generatedAt: "2026-07-16", sourceRun: "run-1", requestedModelId: "kimi-k2.7-code-highspeed", responseModelId: "kimi-k2.7-code-highspeed", promptVersion: "1" } }).success).toBe(true);
    expect(PastPaperCatalogCandidateSchema.safeParse(approved).success).toBe(false);
  });

  it("requires an honest 2021–2025 coverage accounting", () => {
    const missingYear = { ...baseCatalog([]), coverage: baseCatalog([]).coverage.slice(1) };
    expect(PastPaperCatalogSchema.safeParse(missingYear).success).toBe(false);
    const falseComplete = { ...baseCatalog([]), coverage: baseCatalog([]).coverage.map((entry) => entry.year === 2025 ? { ...entry, status: "complete" as const } : entry) };
    expect(PastPaperCatalogSchema.safeParse(falseComplete).success).toBe(false);
  });
});
