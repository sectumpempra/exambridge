import { describe, it, expect } from "vitest";
import { searchPapers, getPaperDetail, listPaperBoundaries, comparePapers } from "@/domain-v2/papers/adapter";
import { runETL } from "@/domain-v2/catalog/etl-pipeline";
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
});
