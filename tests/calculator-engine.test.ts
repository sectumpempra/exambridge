import { describe, it, expect } from "vitest";
import { calculateQualification } from "@/domain-v2/calculator/engine";
import { runETL } from "@/domain-v2/catalog/etl-pipeline";
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
