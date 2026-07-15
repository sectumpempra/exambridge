import { describe, it, expect } from "vitest";
import { searchPapers, getPaperDetail, listPaperBoundaries, listPaperVariants, listExamSittings, comparePapers } from "@/domain-v2/papers/adapter";
import { runETL } from "@/domain-v2/catalog/etl-pipeline";
import { Catalog } from "@/domain-v2/catalog/catalog";
import edexcelALJson from "@/data/edexcel_al.json";

describe("Paper Catalog Adapter v2", () => {
  const { catalogInstance } = runETL({ edexcelAL: edexcelALJson as unknown[] });

  it("searchPapers returns all YMA01 papers by default", () => {
    const results = searchPapers(catalogInstance, {});
    expect(results.length).toBeGreaterThan(0);
  });

  it("searchPapers filters by qualificationId", () => {
    const results = searchPapers(catalogInstance, {
      qualificationId: "qual:pearson:ial:yma01",
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.qualificationId).toBe("qual:pearson:ial:yma01");
    }
  });

  it("searchPapers filters by subjectCode", () => {
    const results = searchPapers(catalogInstance, {
      subjectCode: "yma01",
    });
    expect(results.length).toBeGreaterThan(0);
  });

  it("searchPapers text search finds P1", () => {
    const results = searchPapers(catalogInstance, {
      qualificationId: "qual:pearson:ial:yma01",
      search: "pure mathematics 1",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.name.toLowerCase().includes("pure mathematics 1"))).toBe(true);
  });

  it("searchPapers returns empty for unknown subject", () => {
    const results = searchPapers(catalogInstance, {
      subjectCode: "UNKNOWN999",
    });
    expect(results.length).toBe(0);
  });

  it("getPaperDetail returns paper + variants", () => {
    const paperId = "paper:pearson:yma01:wma11";
    const detail = getPaperDetail(catalogInstance, paperId);
    expect(detail).toBeDefined();
    expect(detail!.paper).toBeDefined();
    expect(detail!.variants).toBeDefined();
  });

  it("getPaperDetail returns undefined for unknown paper", () => {
    const detail = getPaperDetail(catalogInstance, "paper:unknown");
    expect(detail).toBeUndefined();
  });

  it("listPaperBoundaries returns boundaries for a paper", () => {
    const paperId = "paper:pearson:yma01:wma11";
    const boundaries = listPaperBoundaries(catalogInstance, paperId);
    expect(boundaries.length).toBeGreaterThan(0);
  });

  it("listPaperBoundaries filters by exact series", () => {
    const paperId = "paper:pearson:yma01:wma11";
    const boundaries = listPaperBoundaries(catalogInstance, paperId, {
      exact: "2025-june",
    });
    for (const b of boundaries) {
      expect(b.series).toBe("2025-june");
    }
  });

  it("listPaperBoundaries returns empty for unknown paper", () => {
    const boundaries = listPaperBoundaries(catalogInstance, "paper:unknown");
    expect(boundaries.length).toBe(0);
  });

  it("comparePapers returns comparison for two papers", () => {
    const comp = comparePapers(
      catalogInstance,
      "paper:pearson:yma01:wma11",
      "paper:pearson:yma01:wma12"
    );
    expect(comp).toBeDefined();
    expect(comp!.sameQualification).toBe(true);
    expect(comp!.sameUnit).toBe(false);
  });

  it("comparePapers returns undefined for unknown paper", () => {
    const comp = comparePapers(catalogInstance, "paper:unknown", "paper:pearson:yma01:wma11");
    expect(comp).toBeUndefined();
  });

  it("filters papers by board and paper type and normalizes punctuation in search", () => {
    const first = catalogInstance.rawCatalog.papers[0];
    expect(searchPapers(catalogInstance, { boardId: "board:pearson" }).length).toBeGreaterThan(0);
    expect(searchPapers(catalogInstance, { boardId: "missing" })).toEqual([]);
    if (first.paperType) expect(searchPapers(catalogInstance, { paperType: first.paperType }).length).toBeGreaterThan(0);
    expect(searchPapers(catalogInstance, { search: first.numberOrCode.replace(/[-_\s]/g, "_") }).length).toBeGreaterThan(0);
  });

  it("lists variants and applies boundary ranges", () => {
    const paperId = "paper:pearson:yma01:wma11";
    expect(listPaperVariants(catalogInstance, paperId).length).toBeGreaterThan(0);
    const ranged = listPaperBoundaries(catalogInstance, paperId, { from: "2024", to: "2025-z" });
    expect(ranged.every((boundary) => boundary.series >= "2024" && boundary.series <= "2025-z")).toBe(true);
  });

  it("supports variant-level boundaries and filtered sittings", () => {
    const raw = structuredClone(catalogInstance.rawCatalog);
    const paper = raw.papers[0];
    const variant = raw.paperVariants.find((item) => item.paperId === paper.id)!;
    raw.boundarySets.push({ id: "boundary:test:variant", paperVariantId: variant.id, series: "2090-june", maxMark: 10, thresholds: [{ grade: "A", minMark: 8 }], scale: "RAW", status: "verified", sources: [] });
    raw.sittings.push({ id: "sitting:test", paperVariantId: variant.id, series: "2090-june", localDate: "2090-06-01", status: "verified", sources: [] });
    const custom = new Catalog(raw);
    expect(listPaperBoundaries(custom, paper.id, { exact: "2090-june" }).some((boundary) => boundary.paperVariantId === variant.id)).toBe(true);
    expect(listExamSittings(custom, paper.id, { from: "2090-01-01", to: "2090-12-31" })).toHaveLength(1);
    expect(listExamSittings(custom, paper.id, { from: "2091-01-01" })).toEqual([]);
    expect(listExamSittings(custom, "missing")).toEqual([]);
  });

  it("handles papers without units or known qualifications", () => {
    const raw = structuredClone(catalogInstance.rawCatalog);
    raw.papers.push({ id: "paper:test:orphan", qualificationId: "qual:missing", numberOrCode: "X", name: "Orphan", variantIds: [], sources: [] });
    const custom = new Catalog(raw);
    expect(searchPapers(custom, { search: "orphan" })[0].qualificationName).toBe("Unknown");
    expect(getPaperDetail(custom, "paper:test:orphan")).toMatchObject({ qualificationName: "Unknown", unitName: undefined });
    expect(comparePapers(custom, "paper:test:orphan", "paper:test:orphan")?.sameUnit).toBe(false);
  });
});
