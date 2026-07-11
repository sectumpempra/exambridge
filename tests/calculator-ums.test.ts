import { describe, it, expect } from "vitest";
import { calculateUMS } from "@/domain-v2/calculator/policies/pearson-ums";
import type { BoundarySet } from "@/domain-v2/catalog/schema";

// Helper: create a boundary set for testing
function makeBoundary(
  maxMark: number,
  thresholds: { grade: string; minMark: number }[]
): BoundarySet {
  return {
    id: "boundary:test",
    series: "2025-june",
    maxMark,
    thresholds,
    scale: "RAW",
    status: "verified",
    sources: [],
  };
}

describe("Pearson UMS Calculation", () => {
  // Standard IAL unit: maxMark=75, umsMax=100
  const standardBoundary = makeBoundary(75, [
    { grade: "A", minMark: 60 },
    { grade: "B", minMark: 52 },
    { grade: "C", minMark: 44 },
    { grade: "D", minMark: 36 },
    { grade: "E", minMark: 28 },
  ]);

  it("returns 100 UMS for full marks", () => {
    const result = calculateUMS({
      rawScore: 75,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(100);
    expect(result.grade).toBe("A");
  });

  it("returns 80 UMS at A boundary", () => {
    const result = calculateUMS({
      rawScore: 60,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(80);
    expect(result.grade).toBe("A");
  });

  it("returns 70 UMS at B boundary", () => {
    const result = calculateUMS({
      rawScore: 52,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(70);
    expect(result.grade).toBe("B");
  });

  it("returns 40 UMS at E boundary", () => {
    const result = calculateUMS({
      rawScore: 28,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(40);
    expect(result.grade).toBe("E");
  });

  it("returns 0 UMS below E boundary", () => {
    const result = calculateUMS({
      rawScore: 10,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(0);
    expect(result.grade).toBe("U");
  });

  it("returns 0 UMS for 0 score", () => {
    const result = calculateUMS({
      rawScore: 0,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(0);
    expect(result.grade).toBe("U");
  });

  it("linearly interpolates between A and B", () => {
    // A=60(raw)→80(UMS), B=52(raw)→70(UMS)
    // Score 56: (56-52)/(60-52) * (80-70) + 70 = 4/8 * 10 + 70 = 75
    const result = calculateUMS({
      rawScore: 56,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(75);
  });

  it("linearly interpolates between B and C", () => {
    // B=52(raw)→70(UMS), C=44(raw)→60(UMS)
    // Score 48: (48-44)/(52-44) * (70-60) + 60 = 4/8 * 10 + 60 = 65
    const result = calculateUMS({
      rawScore: 48,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(65);
  });

  it("handles C12 with 200 UMS max", () => {
    // C12: maxMark=125, umsMax=200
    const c12Boundary = makeBoundary(125, [
      { grade: "A", minMark: 100 },
      { grade: "B", minMark: 87 },
      { grade: "C", minMark: 74 },
      { grade: "D", minMark: 61 },
      { grade: "E", minMark: 48 },
    ]);
    const result = calculateUMS({
      rawScore: 100,
      maxMark: 125,
      umsMax: 200,
      boundarySet: c12Boundary,
    });
    expect(result.ums).toBe(160); // 80% of 200
    expect(result.grade).toBe("A");
  });

  it("clamps score above maxMark to max", () => {
    const result = calculateUMS({
      rawScore: 100, // > maxMark=75
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(100);
  });

  it("clamps negative score to 0", () => {
    const result = calculateUMS({
      rawScore: -10,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(0);
  });

  it("one mark below A boundary gives correct UMS and grade B", () => {
    // Score 59 (1 below A=60)
    // A=60→80 UMS, B=52→70 UMS
    // (59-52)/(60-52) * (80-70) + 70 = 7/8 * 10 + 70 = 78.75 → 79
    const result = calculateUMS({
      rawScore: 59,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(79);
    expect(result.grade).toBe("B"); // 59 < A boundary of 60
  });

  it("one mark above B boundary gives correct UMS", () => {
    // Score 53 (1 above B=52)
    // (53-52)/(60-52) * (80-70) + 70 = 1/8 * 10 + 70 = 71.25 → 71
    const result = calculateUMS({
      rawScore: 53,
      maxMark: 75,
      umsMax: 100,
      boundarySet: standardBoundary,
    });
    expect(result.ums).toBe(71);
  });
});
