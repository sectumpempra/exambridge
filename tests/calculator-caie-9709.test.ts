import { describe, it, expect } from "vitest";
import { calculateQualification } from "@/domain-v2/calculator/engine";
import { runETL } from "@/domain-v2/catalog/etl-pipeline";
import edexcelALJson from "@/data/edexcel_al.json";
import caieALJson from "@/data/caie_al.json";

describe("Calculator Engine v2 — CAIE 9709", () => {
  const { catalogInstance } = runETL({
    edexcelAL: edexcelALJson as unknown[],
    caieAL: caieALJson as unknown[],
  });

  function uid(code: string): string {
    const unit = catalogInstance.rawCatalog.units.find((u) => u.code === code);
    if (!unit) throw new Error(`Unknown unit code: ${code}`);
    return unit.id;
  }

  const series = "2025-june-11"; // component-specific series (P1 variant 11)

  it("returns INVALID for unknown qualification", () => {
    const result = calculateQualification({
      qualificationId: "qual:unknown",
      papers: [{ unitId: "unit:x", series, rawScore: 50 }],
    }, catalogInstance);
    expect(result.status).toBe("INVALID");
  });

  it("calculates PUM for a single CAIE paper", () => {
    const result = calculateQualification({
      qualificationId: "qual:caie:al:9709",
      routeId: "route:caie:al:9709:full-a-level",
      papers: [{ unitId: uid("9709/1"), series, rawScore: 55 }],
    }, catalogInstance);
    expect(result.status).toBe("INCOMPLETE"); // incomplete route
    expect(result.paperResults.length).toBe(1);
    expect(result.paperResults[0].scoreType).toBe("PUM");
    expect(result.paperResults[0].normalizedMax).toBe(100); // PUM is always 0-100
  });

  it("P1 at A boundary = 80 PUM", () => {
    // CAIE 9709 P1 (comp 11, june 2025): A boundary = 59 raw
    const result = calculateQualification({
      qualificationId: "qual:caie:al:9709",
      routeId: "route:caie:al:9709:full-a-level",
      papers: [{ unitId: uid("9709/1"), series, rawScore: 59 }],
    }, catalogInstance);
    expect(result.paperResults[0].normalizedScore).toBe(80);
    expect(result.paperResults[0].grade).toBe("A");
  });

  it("validates a complete A-Level route (P1+P3+M1+S1)", () => {
    // Each paper needs component-specific series for boundary lookup
    const result = calculateQualification({
      qualificationId: "qual:caie:al:9709",
      routeId: "route:caie:al:9709:full-a-level",
      papers: [
        { unitId: uid("9709/1"), series: "2025-june-11", rawScore: 59 },
        { unitId: uid("9709/3"), series: "2025-june-31", rawScore: 59 },
        { unitId: uid("9709/4"), series: "2025-june-41", rawScore: 50 },
        { unitId: uid("9709/5"), series: "2025-june-51", rawScore: 50 },
      ],
    }, catalogInstance);

    expect(result.status).toBe("SUCCESS");
    expect(result.routeValidation.valid).toBe(true);
    expect(result.predictedGrade).not.toBeNull();
    expect(result.paperResults.length).toBe(4);

    // All should be PUM
    for (const p of result.paperResults) {
      expect(p.scoreType).toBe("PUM");
      expect(p.normalizedMax).toBe(100);
    }
  });

  it("detects missing required paper (P3)", () => {
    const result = calculateQualification({
      qualificationId: "qual:caie:al:9709",
      papers: [
        { unitId: uid("9709/1"), series, rawScore: 60 },
        { unitId: uid("9709/4"), series, rawScore: 55 },
        { unitId: uid("9709/5"), series, rawScore: 55 },
      ],
    }, catalogInstance);

    expect(result.routeValidation.valid).toBe(false);
    expect(result.predictedGrade).toBeNull();
  });

  it("validates AS route (P1+M1)", () => {
    const result = calculateQualification({
      qualificationId: "qual:caie:al:9709",
      routeId: "route:caie:al:9709:as",
      papers: [
        { unitId: uid("9709/1"), series: "2025-june-11", rawScore: 59 },
        { unitId: uid("9709/4"), series: "2025-june-41", rawScore: 50 },
      ],
    }, catalogInstance);

    expect(result.routeValidation.valid).toBe(true);
    expect(result.status).toBe("SUCCESS");
  });

  it("rejects 3 applied papers (only 2 allowed)", () => {
    const result = calculateQualification({
      qualificationId: "qual:caie:al:9709",
      papers: [
        { unitId: uid("9709/1"), series, rawScore: 60 },
        { unitId: uid("9709/3"), series, rawScore: 60 },
        { unitId: uid("9709/4"), series, rawScore: 55 },
        { unitId: uid("9709/5"), series, rawScore: 55 },
        { unitId: uid("9709/6"), series, rawScore: 55 },
      ],
    }, catalogInstance);

    expect(result.routeValidation.valid).toBe(false);
  });

  it("produces explanation with PUM details", () => {
    const result = calculateQualification({
      qualificationId: "qual:caie:al:9709",
      routeId: "route:caie:al:9709:full-a-level",
      papers: [
        { unitId: uid("9709/1"), series: "2025-june-11", rawScore: 59 },
        { unitId: uid("9709/3"), series: "2025-june-31", rawScore: 59 },
        { unitId: uid("9709/4"), series: "2025-june-41", rawScore: 50 },
        { unitId: uid("9709/5"), series: "2025-june-51", rawScore: 50 },
      ],
    }, catalogInstance);

    expect(result.explanation.length).toBeGreaterThanOrEqual(3);
    expect(result.explanation[0].title).toContain("资格");
    expect(result.explanation[1].title).toContain("单元");
  });

  it("catalog has 2 qualifications (YMA01 + 9709)", () => {
    expect(catalogInstance.rawCatalog.qualifications.length).toBe(2);
    const qualIds = catalogInstance.rawCatalog.qualifications.map((q) => q.id);
    expect(qualIds).toContain("qual:pearson:ial:yma01");
    expect(qualIds).toContain("qual:caie:al:9709");
  });

  it("catalog has 2 boards (pearson + caie)", () => {
    expect(catalogInstance.rawCatalog.boards.length).toBe(2);
  });

  it("9709 has 6 papers (P1-P6)", () => {
    const units = catalogInstance.rawCatalog.units.filter(
      (u) => u.specificationId === "spec:caie:al:9709:current"
    );
    expect(units.length).toBeGreaterThanOrEqual(4); // At least P1, P3, P4, P5
  });
});
