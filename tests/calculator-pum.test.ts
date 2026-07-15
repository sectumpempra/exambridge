import { describe, it, expect } from "vitest";
import { calculatePUM } from "@/domain-v2/calculator/policies/caie-pum";
import type { BoundarySet } from "@/domain-v2/catalog/schema";

function makeBoundary(
  maxMark: number,
  thresholds: { grade: string; minMark: number }[]
): BoundarySet {
  return {
    id: "boundary:caie:9709:1:2025-june",
    series: "2025-june",
    maxMark,
    thresholds,
    scale: "RAW",
    status: "verified",
    sources: [],
  };
}

describe("CAIE PUM Calculation", () => {
  // Standard CAIE paper: maxMark=75
  const standardBoundary = makeBoundary(75, [
    { grade: "A", minMark: 60 },
    { grade: "B", minMark: 51 },
    { grade: "C", minMark: 40 },
    { grade: "D", minMark: 28 },
    { grade: "E", minMark: 16 },
  ]);

  it("returns 100 PUM for full marks", () => {
    const result = calculatePUM({ rawScore: 75, maxMark: 75, boundarySet: standardBoundary });
    expect(result.pum).toBe(100);
    expect(result.grade).toBe("A");
  });

  it("returns 80 PUM at A boundary", () => {
    const result = calculatePUM({ rawScore: 60, maxMark: 75, boundarySet: standardBoundary });
    expect(result.pum).toBe(80);
    expect(result.grade).toBe("A");
  });

  it("returns 70 PUM at B boundary", () => {
    const result = calculatePUM({ rawScore: 51, maxMark: 75, boundarySet: standardBoundary });
    expect(result.pum).toBe(70);
    expect(result.grade).toBe("B");
  });

  it("returns 40 PUM at E boundary", () => {
    const result = calculatePUM({ rawScore: 16, maxMark: 75, boundarySet: standardBoundary });
    expect(result.pum).toBe(40);
    expect(result.grade).toBe("E");
  });

  it("returns 0 PUM for 0 score", () => {
    const result = calculatePUM({ rawScore: 0, maxMark: 75, boundarySet: standardBoundary });
    expect(result.pum).toBe(0);
    expect(result.grade).toBe("U");
  });

  it("linearly interpolates between A and B", () => {
    // A=60(raw)→80 PUM, B=51(raw)→70 PUM
    // Score 55.5: (55.5-51)/(60-51) * (80-70) + 70 = 4.5/9 * 10 + 70 = 75
    const result = calculatePUM({ rawScore: 55, maxMark: 75, boundarySet: standardBoundary });
    // (55-51)/(60-51) * 10 + 70 = 4/9*10 + 70 = 74.44 → 74
    expect(result.pum).toBe(74);
  });

  it("linearly interpolates between B and C", () => {
    // B=51(raw)→70 PUM, C=40(raw)→60 PUM
    // Score 45: (45-40)/(51-40) * (70-60) + 60 = 5/11 * 10 + 60 = 64.5 → 65
    const result = calculatePUM({ rawScore: 45, maxMark: 75, boundarySet: standardBoundary });
    expect(result.pum).toBe(65);
  });

  it("interpolates below E boundary (0 to E)", () => {
    // E=16(raw)→40 PUM, U=0(raw)→0 PUM
    // Score 8: (8-0)/(16-0) * 40 + 0 = 8/16 * 40 = 20
    const result = calculatePUM({ rawScore: 8, maxMark: 75, boundarySet: standardBoundary });
    expect(result.pum).toBe(20);
    expect(result.grade).toBe("U");
  });

  it("one mark below A boundary gives B grade", () => {
    const result = calculatePUM({ rawScore: 59, maxMark: 75, boundarySet: standardBoundary });
    expect(result.grade).toBe("B"); // 59 < A boundary of 60
  });

  it("clamps score above maxMark to 100 PUM", () => {
    const result = calculatePUM({ rawScore: 100, maxMark: 75, boundarySet: standardBoundary });
    expect(result.pum).toBe(100);
  });

  it("clamps negative score to 0 PUM", () => {
    const result = calculatePUM({ rawScore: -10, maxMark: 75, boundarySet: standardBoundary });
    expect(result.pum).toBe(0);
  });

  it("determines correct grades", () => {
    expect(calculatePUM({ rawScore: 75, maxMark: 75, boundarySet: standardBoundary }).grade).toBe("A");
    expect(calculatePUM({ rawScore: 60, maxMark: 75, boundarySet: standardBoundary }).grade).toBe("A");
    expect(calculatePUM({ rawScore: 51, maxMark: 75, boundarySet: standardBoundary }).grade).toBe("B");
    expect(calculatePUM({ rawScore: 40, maxMark: 75, boundarySet: standardBoundary }).grade).toBe("C");
    expect(calculatePUM({ rawScore: 28, maxMark: 75, boundarySet: standardBoundary }).grade).toBe("D");
    expect(calculatePUM({ rawScore: 16, maxMark: 75, boundarySet: standardBoundary }).grade).toBe("E");
    expect(calculatePUM({ rawScore: 15, maxMark: 75, boundarySet: standardBoundary }).grade).toBe("U");
    expect(calculatePUM({ rawScore: 0, maxMark: 75, boundarySet: standardBoundary }).grade).toBe("U");
  });

  it("handles 50-mark paper", () => {
    const boundary50 = makeBoundary(50, [
      { grade: "A", minMark: 40 },
      { grade: "B", minMark: 34 },
      { grade: "C", minMark: 27 },
      { grade: "D", minMark: 19 },
      { grade: "E", minMark: 11 },
    ]);
    const result = calculatePUM({ rawScore: 40, maxMark: 50, boundarySet: boundary50 });
    expect(result.pum).toBe(80);
    expect(result.grade).toBe("A");
  });
});
