import { describe, it, expect } from "vitest";
import { runETL } from "@/domain-v2/catalog/etl-pipeline";
import { Catalog } from "@/domain-v2/catalog/catalog";
import edexcelALJson from "@/data/edexcel_al.json";

describe("YMA01 ETL Pipeline", () => {
  const legacyData = { edexcelAL: edexcelALJson as unknown[] };
  const result = runETL(legacyData);

  it("ETL succeeds with no blocking errors", () => {
    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("produces a valid Catalog instance", () => {
    expect(result.catalogInstance).toBeInstanceOf(Catalog);
  });

  it("has 1 board (Pearson)", () => {
    expect(result.manifest.entityCounts.boards).toBe(1);
    const board = result.catalogInstance.rawCatalog.boards[0];
    expect(board.code).toBe("PEARSON");
    expect(board.aliases).toContain("Edexcel");
  });

  it("has 1 qualification (YMA01)", () => {
    expect(result.manifest.entityCounts.qualifications).toBe(1);
    const qual = result.catalogInstance.rawCatalog.qualifications[0];
    expect(qual.subjectCode).toBe("YMA01");
    expect(qual.level).toBe("IAL");
    expect(qual.status).toBe("verified");
  });

  it("has 2 specifications (new + old)", () => {
    expect(result.manifest.entityCounts.specifications).toBe(2);
    const specs = result.catalogInstance.rawCatalog.specifications;
    const labels = specs.map((s) => s.label);
    expect(labels).toContain("New Specification (2018+)");
    expect(labels).toContain("Old Specification (Pre-2018)");
  });

  it("has expected units", () => {
    const units = result.catalogInstance.rawCatalog.units;
    const unitCodes = units.map((u) => u.code).sort();
    // Should have at least the core new spec units
    expect(unitCodes).toContain("WMA11"); // P1
    expect(unitCodes).toContain("WMA12"); // P2
    expect(unitCodes).toContain("WMA13"); // P3
    expect(unitCodes).toContain("WMA14"); // P4
    expect(unitCodes).toContain("WMA01"); // C12
    expect(unitCodes).toContain("WMA02"); // C34
  });

  it("C12 has umsMax=200", () => {
    const c12 = result.catalogInstance.rawCatalog.units.find((u) => u.code === "WMA01");
    expect(c12).toBeDefined();
    expect(c12!.umsMax).toBe(200);
  });

  it("C34 has umsMax=200", () => {
    const c34 = result.catalogInstance.rawCatalog.units.find((u) => u.code === "WMA02");
    expect(c34).toBeDefined();
    expect(c34!.umsMax).toBe(200);
  });

  it("P1 has umsMax=100", () => {
    const p1 = result.catalogInstance.rawCatalog.units.find((u) => u.code === "WMA11");
    expect(p1).toBeDefined();
    expect(p1!.umsMax).toBe(100);
  });

  it("has papers 1:1 with units", () => {
    const { units, papers } = result.catalogInstance.rawCatalog;
    expect(papers.length).toBe(units.length);
    for (const paper of papers) {
      expect(paper.unitId).toBeDefined();
    }
  });

  it("has paper variants 1:1 with papers", () => {
    const { papers, paperVariants } = result.catalogInstance.rawCatalog;
    expect(paperVariants.length).toBe(papers.length);
  });

  it("has boundary sets from raw data", () => {
    expect(result.manifest.entityCounts.boundarySets).toBeGreaterThan(0);
  });

  it("has 2 award routes (new + old spec)", () => {
    expect(result.manifest.entityCounts.routes).toBe(2);
    const routes = result.catalogInstance.rawCatalog.routes;
    const newRoute = routes.find((r) => r.name.includes("New"));
    const oldRoute = routes.find((r) => r.name.includes("Old"));
    expect(newRoute).toBeDefined();
    expect(oldRoute).toBeDefined();
    expect(newRoute!.selectionRules.length).toBeGreaterThan(0);
    expect(oldRoute!.selectionRules.length).toBeGreaterThan(0);
  });

  it("new spec route has A* policy", () => {
    const newRoute = result.catalogInstance.rawCatalog.routes.find((r) => r.name.includes("New"));
    expect(newRoute).toBeDefined();
    expect(newRoute!.aStarPolicyId).toBeDefined();
  });

  it("has A* policy with P3+P4 condition", () => {
    const aStar = result.catalogInstance.rawCatalog.aStarPolicies[0];
    expect(aStar).toBeDefined();
    expect(aStar.conditions.length).toBe(2);
    expect(aStar.conditions[0].kind).toBe("TOTAL_MIN");
    expect(aStar.conditions[0].minTotal).toBe(480);
    // P3+P4 condition populated in ETL
    expect(aStar.conditions[1].kind).toBe("UNIT_PAIR_MIN");
    expect(aStar.conditions[1].unitIds!.length).toBe(2);
  });

  it("has grading scale with A*-E", () => {
    const scale = result.catalogInstance.rawCatalog.gradingScales[0];
    expect(scale.hasAStar).toBe(true);
    expect(scale.thresholds.some((t) => t.grade === "A*")).toBe(true);
    expect(scale.thresholds.some((t) => t.grade === "A")).toBe(true);
    expect(scale.thresholds.some((t) => t.grade === "E")).toBe(true);
  });

  it("manifest lists supported qualifications", () => {
    expect(result.manifest.supportedQualifications.length).toBe(1);
    expect(result.manifest.supportedQualifications[0]).toContain("yma01");
  });

  it("QA report has all invariants passed", () => {
    const { invariants } = result.qaReport;
    const failed = invariants.filter((i) => !i.passed);
    expect(failed.length).toBe(0);
  });

  it("catalog has sources on verified entities", () => {
    const { qualifications, specifications, units, routes } = result.catalogInstance.rawCatalog;
    for (const q of qualifications) {
      if (q.status === "verified") expect(q.sources.length).toBeGreaterThan(0);
    }
    for (const s of specifications) {
      if (s.status === "verified") expect(s.sources.length).toBeGreaterThan(0);
    }
    for (const u of units) {
      if (u.status === "verified") expect(u.sources.length).toBeGreaterThan(0);
    }
    for (const r of routes) {
      if (r.status === "verified") expect(r.sources.length).toBeGreaterThan(0);
    }
  });
});

describe("Catalog Query Interface", () => {
  const legacyData = { edexcelAL: edexcelALJson as unknown[] };
  const { catalogInstance } = runETL(legacyData);

  it("gets qualification by ID", () => {
    const qual = catalogInstance.getQualification("qual:pearson:ial:yma01");
    expect(qual).toBeDefined();
    expect(qual!.subjectCode).toBe("YMA01");
  });

  it("lists units for specification", () => {
    const units = catalogInstance.listUnits("spec:pearson:ial:yma01:new-spec-2018");
    expect(units.length).toBeGreaterThan(0);
    // All new spec units should be here
    expect(units.some((u) => u.code === "WMA11")).toBe(true);
  });

  it("gets specification for series (2025-june → new spec)", () => {
    const spec = catalogInstance.getSpecificationForSeries("qual:pearson:ial:yma01", "2025-june");
    expect(spec).toBeDefined();
    expect(spec!.label).toContain("New");
  });

  it("gets specification for old series (2017-june → old spec)", () => {
    const spec = catalogInstance.getSpecificationForSeries("qual:pearson:ial:yma01", "2017-june");
    expect(spec).toBeDefined();
    expect(spec!.label).toContain("Old");
  });

  it("gets route by ID", () => {
    const routes = catalogInstance.rawCatalog.routes;
    for (const route of routes) {
      const found = catalogInstance.getRoute(route.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(route.id);
    }
  });

  it("gets boundary with FOUND result", () => {
    const units = catalogInstance.rawCatalog.units;
    const wma11 = units.find((u) => u.code === "WMA11");
    if (wma11) {
      const result = catalogInstance.getBoundary({
        unitId: wma11.id,
        series: "2025-june",
      });
      expect(result.kind).toBe("FOUND");
      if (result.kind === "FOUND") {
        expect(result.boundary.maxMark).toBeGreaterThan(0);
        expect(result.boundary.thresholds.length).toBeGreaterThan(0);
      }
    }
  });

  it("gets boundary with NOT_FOUND for unknown series", () => {
    const result = catalogInstance.getBoundary({
      unitId: "unit:pearson:ial:wma11",
      series: "1990-june",
    });
    expect(result.kind).toBe("NOT_FOUND");
  });
});
