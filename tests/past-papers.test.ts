import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PastPaperCatalogCandidateSchema,
  PastPaperCatalogSchema,
  buildPastPaperSets,
  resolvePastPaperCatalogKey,
  type PastPaperCatalog,
} from "@/domain-v2/past-papers";

const dataDirectory = join(process.cwd(), "public/data/past-papers");
const index = JSON.parse(readFileSync(join(dataDirectory, "index.json"), "utf8")) as { schemaVersion: string; catalogs: Array<{ file: string }> };
const catalogs: PastPaperCatalog[] = index.catalogs.map((entry) =>
  PastPaperCatalogSchema.parse(JSON.parse(readFileSync(join(dataDirectory, entry.file), "utf8")))
);
const researchAudit = JSON.parse(readFileSync(join(process.cwd(), "generated/past-paper-research-audit-report.json"), "utf8"));

describe("past-paper catalog", () => {
  it("publishes ten approved mathematics pilot catalogs", () => {
    expect(index.schemaVersion).toBe("1.2.0");
    expect(catalogs.map((catalog) => catalog.key)).toEqual([
      "caie-0580",
      "caie-0606",
      "caie-9231",
      "caie-9709",
      "ocr-h240",
      "pearson-1ma1",
      "pearson-4ma1",
      "pearson-9fm0",
      "pearson-9ma0",
      "pearson-yma01",
    ]);
    expect(catalogs.every((catalog) => catalog.release.status === "approved")).toBe(true);
    expect(catalogs.every((catalog) => catalog.coverage.map((entry) => entry.year).join(",") === "2021,2022,2023,2024,2025")).toBe(true);
    expect(catalogs.every((catalog) => [2021, 2022, 2023, 2024, 2025].every((year) => catalog.sittings.some((sitting) => sitting.year === year && sitting.expected)))).toBe(true);
    expect(catalogs.every((catalog) => catalog.qualificationVersion.source.sha256.length === 64)).toBe(true);
  });

  it("publishes only official links unless redistribution is explicitly permitted", () => {
    const assets = catalogs.flatMap((catalog) => catalog.assets);
    expect(assets).toHaveLength(1196);
    expect(assets.every((asset) => asset.provenance.sourceType === "official")).toBe(true);
    expect(assets.every((asset) => asset.accessStatus === "public" ? asset.distributionStatus === "link-only" : asset.distributionStatus === "restricted")).toBe(true);
    expect(assets.filter((asset) => asset.accessStatus === "public")).toHaveLength(974);
    expect(assets.filter((asset) => asset.accessStatus === "account-required")).toHaveLength(222);
    expect(assets.every((asset) => asset.hostedPath === undefined)).toBe(true);
  });

  it("pairs question papers and mark schemes by stable paperSetId", () => {
    const caie9709 = catalogs.find((catalog) => catalog.key === "caie-9709")!;
    const sets = buildPastPaperSets(caie9709);
    expect(sets).toHaveLength(6);
    expect(sets.every((set) => set.markScheme?.materialType === "mark-scheme")).toBe(true);
    expect(buildPastPaperSets(caie9709, ["11"]).map((set) => set.id)).toEqual(["caie-9709-2024-june-11"]);
  });

  it("maps course and planner aliases to the same independent catalogs", () => {
    expect(resolvePastPaperCatalogKey("Cambridge International", "9709")).toBe("caie-9709");
    expect(resolvePastPaperCatalogKey("CAIE", "0580")).toBe("caie-0580");
    expect(resolvePastPaperCatalogKey("Pearson Edexcel", "4MA1")).toBe("pearson-4ma1");
    expect(resolvePastPaperCatalogKey("Edexcel", "WMA11")).toBe("pearson-yma01");
    expect(resolvePastPaperCatalogKey("Cambridge International", "9231/31")).toBe("caie-9231");
    expect(resolvePastPaperCatalogKey("CAIE", "0606")).toBe("caie-0606");
    expect(resolvePastPaperCatalogKey("Pearson", "9MA0/31")).toBe("pearson-9ma0");
    expect(resolvePastPaperCatalogKey("Edexcel", "9FM0")).toBe("pearson-9fm0");
    expect(resolvePastPaperCatalogKey("Pearson Edexcel", "1MA1")).toBe("pearson-1ma1");
    expect(resolvePastPaperCatalogKey("OCR", "H240/02")).toBe("ocr-h240");
  });

  it("pairs every published pilot question paper with a mark scheme", () => {
    const sets = catalogs.flatMap((catalog) => buildPastPaperSets(catalog));
    expect(sets).toHaveLength(402);
    expect(sets.every((set) => set.markScheme?.materialType === "mark-scheme")).toBe(true);
  });

  it("schedules only current-syllabus, human-verified public QP/MS pairs", () => {
    const sets = catalogs.flatMap((catalog) => buildPastPaperSets(catalog, undefined, { forPlanning: true }));
    expect(sets).toHaveLength(312);
    expect(sets.every((set) => set.questionPaper.accessStatus === "public" && set.questionPaper.syllabusApplicability === "current" && set.questionPaper.provenance.verifiedBy === "human")).toBe(true);
    expect(sets.every((set) => set.markScheme?.accessStatus === "public" && set.markScheme.syllabusApplicability === "current" && set.markScheme.provenance.verifiedBy === "human")).toBe(true);
    expect(catalogs.filter((catalog) => catalog.board === "Cambridge International").flatMap((catalog) => buildPastPaperSets(catalog, undefined, { forPlanning: true }))).toEqual([]);
  });

  it("requires model and prompt provenance on candidate catalogs", () => {
    const active = catalogs[0];
    expect(PastPaperCatalogCandidateSchema.safeParse({
      ...active,
      release: { status: "candidate", generatedAt: "2026-07-16", sourceRun: "kimi-pilot" },
    }).success).toBe(false);
  });

  it("records K3 identity, source verification and the clean final link audit", () => {
    expect(researchAudit.modelAudit).toMatchObject({
      primaryModel: "k3",
      fallbackModel: "kimi-k3",
      providers: ["kimi-code"],
      requestedModels: ["k3"],
      returnedModels: ["k3"],
      fallbackOccurred: false,
      successfulCallCount: 14,
    });
    expect(researchAudit.linkAudit.outcomes).toEqual({ ok: 974, redirected: 0, "login-required": 0, broken: 0 });
    expect(researchAudit.quarantine.quarantinedAssetCount).toBe(13);
    expect(researchAudit.finalActive).toMatchObject({ catalogs: 10, assets: 1196, publicAssets: 974, restrictedAssets: 222, questionPapers: 402 });
  });
});
