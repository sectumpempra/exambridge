import { describe, it, expect } from "vitest";
import { calculateQualification } from "@/domain-v2/calculator/engine";
import { runETL } from "@/domain-v2/catalog/etl-pipeline";
import { Catalog } from "@/domain-v2/catalog/catalog";
import type { ExamCatalog } from "@/domain-v2/catalog/schema";
import edexcelALJson from "@/data/edexcel_al.json";

describe("Calculator Engine v2 — YMA01", () => {
  const { catalogInstance } = runETL({ edexcelAL: edexcelALJson as unknown[] });

  // Helper to get unit ID by code
  function uid(code: string): string {
    const unit = catalogInstance.rawCatalog.units.find((u) => u.code === code);
    if (!unit) throw new Error(`Unknown unit code: ${code}`);
    return unit.id;
  }

  // Use a series that has boundary data
  const series = "2025-june";

  const validPapers = (targetSeries = series) => ["WMA11", "WMA12", "WMA13", "WMA14", "WME01", "WST01"].map((code) => ({ unitId: uid(code), series: targetSeries, rawScore: 65 }));
  const customCatalog = (mutate: (raw: ExamCatalog) => void) => {
    const raw = structuredClone(catalogInstance.rawCatalog);
    mutate(raw);
    return new Catalog(raw);
  };

  it("returns INVALID for unknown qualification", () => {
    const result = calculateQualification({
      qualificationId: "qual:unknown",
      papers: [{ unitId: "unit:x", series, rawScore: 50 }],
    }, catalogInstance);
    expect(result.status).toBe("INVALID");
    expect(result.predictedGrade).toBeNull();
  });

  it("returns INVALID for empty paper list", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [],
    }, catalogInstance);
    expect(result.status).toBe("INVALID");
  });

  it("returns INVALID for score out of range", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [{ unitId: uid("WMA11"), series, rawScore: 999 }],
    }, catalogInstance);
    expect(result.status).toBe("INVALID");
    expect(result.errors[0].code).toBe("SCORE_OUT_OF_RANGE");
  });

  it("returns INVALID for negative score", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [{ unitId: uid("WMA11"), series, rawScore: -5 }],
    }, catalogInstance);
    expect(result.status).toBe("INVALID");
  });

  it("returns INVALID for non-finite scores", () => {
    const result = calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: [{ unitId: uid("WMA11"), series, rawScore: Number.NaN }] }, catalogInstance);
    expect(result.errors[0].code).toBe("SCORE_OUT_OF_RANGE");
  });

  it("rejects unsupported qualifications and series outside a specification", () => {
    const unsupported = customCatalog((raw) => { raw.qualifications[0].status = "unsupported"; });
    expect(calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: validPapers() }, unsupported).errors[0].code).toBe("UNSUPPORTED_QUALIFICATION");
    expect(calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: validPapers("1500-june") }, catalogInstance).errors[0].code).toBe("SERIES_SPEC_MISMATCH");
  });

  it("rejects absent, ambiguous and explicitly unknown award routes", () => {
    const absent = customCatalog((raw) => { raw.routes = []; });
    expect(calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: validPapers() }, absent).errors[0].code).toBe("INVALID_ROUTE");
    const ambiguous = customCatalog((raw) => {
      const route = raw.routes.find((item) => item.specificationId.includes("new-spec"))!;
      raw.routes.push({ ...route, id: `${route.id}:alternative`, name: "Alternative" });
    });
    expect(calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: validPapers() }, ambiguous).errors[0].code).toBe("AMBIGUOUS_ROUTE");
    expect(calculateQualification({ qualificationId: "qual:pearson:ial:yma01", routeId: "route:missing", papers: validPapers() }, catalogInstance).errors[0].code).toBe("INVALID_ROUTE");
  });

  it("rejects unknown units, missing boundaries and ambiguous boundaries", () => {
    expect(calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: [{ unitId: "unit:missing", series, rawScore: 1 }] }, catalogInstance).errors[0].code).toBe("UNKNOWN_UNIT");
    expect(calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: validPapers("2099-june") }, catalogInstance).errors[0].code).toBe("MISSING_BOUNDARY");
    const ambiguous = customCatalog((raw) => {
      const boundary = raw.boundarySets.find((item) => item.unitId === uid("WMA11") && item.series === series)!;
      raw.boundarySets.push({ ...boundary, id: `${boundary.id}:alternative` });
    });
    expect(calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: validPapers() }, ambiguous).errors[0].code).toBe("AMBIGUOUS_BOUNDARY");
  });

  it.each(["aggregation", "grade", "scale"] as const)("rejects a missing %s policy dependency", (kind) => {
    const broken = customCatalog((raw) => {
      const route = raw.routes.find((item) => item.specificationId.includes("new-spec"))!;
      if (kind === "aggregation") route.aggregationPolicyId = "agg:missing";
      if (kind === "grade") route.gradePolicyId = "grade:missing";
      if (kind === "scale") raw.gradePolicies[0].gradingScaleId = "scale:missing";
    });
    expect(calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: validPapers() }, broken).errors[0].code).toBe("UNVERIFIED_RULE");
  });

  it("calculates the CAIE PUM branch and tolerates a missing optional A* policy", () => {
    const caie = customCatalog((raw) => {
      raw.boards[0].code = "CAIE";
      raw.routes.find((item) => item.specificationId.includes("new-spec"))!.aStarPolicyId = "astar:missing";
    });
    const result = calculateQualification({ qualificationId: "qual:pearson:ial:yma01", papers: validPapers() }, caie);
    expect(result.paperResults.every((paper) => paper.scoreType === "PUM")).toBe(true);
    expect(result.aStarCheck).toBeUndefined();
  });

  it("calculates UMS for a single paper", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [{ unitId: uid("WMA11"), series, rawScore: 60 }],
    }, catalogInstance);
    expect(result.status).toBe("INCOMPLETE"); // incomplete route
    expect(result.paperResults.length).toBe(1);
    expect(result.paperResults[0].normalizedScore).toBeGreaterThan(0);
    expect(result.paperResults[0].scoreType).toBe("UMS");
  });

  it("validates a complete new spec route (6 papers)", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: uid("WMA11"), series, rawScore: 65 },
        { unitId: uid("WMA12"), series, rawScore: 65 },
        { unitId: uid("WMA13"), series, rawScore: 65 },
        { unitId: uid("WMA14"), series, rawScore: 65 },
        { unitId: uid("WME01"), series, rawScore: 65 },
        { unitId: uid("WST01"), series, rawScore: 65 },
      ],
    }, catalogInstance);

    expect(result.status).toBe("SUCCESS");
    expect(result.routeValidation.valid).toBe(true);
    expect(result.predictedGrade).not.toBeNull();
    expect(result.paperResults.length).toBe(6);
  });

  it("detects missing required unit (P4)", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: uid("WMA11"), series, rawScore: 70 },
        { unitId: uid("WMA12"), series, rawScore: 70 },
        { unitId: uid("WMA13"), series, rawScore: 70 },
        { unitId: uid("WME01"), series, rawScore: 70 },
        { unitId: uid("WST01"), series, rawScore: 70 },
      ],
    }, catalogInstance);

    expect(result.routeValidation.valid).toBe(false);
    expect(result.predictedGrade).toBeNull();
    expect(result.routeValidation.explanation.some((e) =>
      e.includes("P4") || e.includes("WMA14")
    )).toBe(true);
  });

  it("detects wrong total unit count (5 instead of 6)", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: uid("WMA11"), series, rawScore: 70 },
        { unitId: uid("WMA12"), series, rawScore: 70 },
        { unitId: uid("WMA13"), series, rawScore: 70 },
        { unitId: uid("WMA14"), series, rawScore: 70 },
        { unitId: uid("WME01"), series, rawScore: 70 },
      ],
    }, catalogInstance);

    expect(result.routeValidation.valid).toBe(false);
    expect(result.predictedGrade).toBeNull();
  });

  it("detects duplicate unit selection", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: uid("WMA11"), series, rawScore: 70 },
        { unitId: uid("WMA11"), series, rawScore: 70 },
      ],
    }, catalogInstance);

    expect(result.status).toBe("INVALID");
    expect(result.errors[0].code).toBe("DUPLICATE_UNIT");
  });

  it("produces explanation with multiple steps", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: uid("WMA11"), series, rawScore: 65 },
        { unitId: uid("WMA12"), series, rawScore: 65 },
        { unitId: uid("WMA13"), series, rawScore: 65 },
        { unitId: uid("WMA14"), series, rawScore: 65 },
        { unitId: uid("WME01"), series, rawScore: 65 },
        { unitId: uid("WST01"), series, rawScore: 65 },
      ],
    }, catalogInstance);

    expect(result.explanation.length).toBeGreaterThanOrEqual(4);
    expect(result.explanation[0].title).toContain("资格");
    expect(result.explanation[1].title).toContain("单元");
    expect(result.explanation[2].title).toContain("聚合");
    expect(result.explanation[3].title).toContain("等级");
  });

  it("includes sources in result", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: uid("WMA11"), series, rawScore: 65 },
        { unitId: uid("WMA12"), series, rawScore: 65 },
        { unitId: uid("WMA13"), series, rawScore: 65 },
        { unitId: uid("WMA14"), series, rawScore: 65 },
        { unitId: uid("WME01"), series, rawScore: 65 },
        { unitId: uid("WST01"), series, rawScore: 65 },
      ],
    }, catalogInstance);

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0].publisher).toBe("Pearson");
  });

  it("has gradeChecks for A through E", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: uid("WMA11"), series, rawScore: 65 },
        { unitId: uid("WMA12"), series, rawScore: 65 },
        { unitId: uid("WMA13"), series, rawScore: 65 },
        { unitId: uid("WMA14"), series, rawScore: 65 },
        { unitId: uid("WME01"), series, rawScore: 65 },
        { unitId: uid("WST01"), series, rawScore: 65 },
      ],
    }, catalogInstance);

    const grades = result.gradeChecks.map((g) => g.grade);
    expect(grades).toContain("A");
    expect(grades).toContain("B");
    expect(grades).toContain("C");
    expect(grades).toContain("D");
    expect(grades).toContain("E");
  });

  it("calculates nextGrade for non-A results", () => {
    // Low scores should result in B or lower
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: uid("WMA11"), series, rawScore: 50 },
        { unitId: uid("WMA12"), series, rawScore: 50 },
        { unitId: uid("WMA13"), series, rawScore: 50 },
        { unitId: uid("WMA14"), series, rawScore: 50 },
        { unitId: uid("WME01"), series, rawScore: 50 },
        { unitId: uid("WST01"), series, rawScore: 50 },
      ],
    }, catalogInstance);

    if (result.predictedGrade && result.predictedGrade !== "A" && result.predictedGrade !== "A*") {
      expect(result.nextGrade).toBeDefined();
      expect(result.nextGrade!.gap).toBeGreaterThan(0);
    }
  });

  it("computes correct total UMS for 6 papers at 65 raw", () => {
    const result = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: uid("WMA11"), series, rawScore: 65 },
        { unitId: uid("WMA12"), series, rawScore: 65 },
        { unitId: uid("WMA13"), series, rawScore: 65 },
        { unitId: uid("WMA14"), series, rawScore: 65 },
        { unitId: uid("WME01"), series, rawScore: 65 },
        { unitId: uid("WST01"), series, rawScore: 65 },
      ],
    }, catalogInstance);

    expect(result.normalizedMax).toBe(600);
    expect(result.paperResults.length).toBe(6);
    // Each paper should have some UMS
    for (const p of result.paperResults) {
      expect(p.normalizedScore).toBeGreaterThan(0);
      expect(p.normalizedMax).toBe(100);
    }
  });

  it("C12/C34 units have 200 UMS max in catalog", () => {
    // Verify catalog metadata directly
    const c12 = catalogInstance.getUnit(uid("WMA01"));
    const c34 = catalogInstance.getUnit(uid("WMA02"));
    expect(c12?.umsMax).toBe(200);
    expect(c34?.umsMax).toBe(200);

    // Verify new spec units have 100 UMS max
    const p1 = catalogInstance.getUnit(uid("WMA11"));
    expect(p1?.umsMax).toBe(100);
  });
});
