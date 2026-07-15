/**
 * Characterization Fixture: Pearson Edexcel IAL Mathematics (YMA01)
 * New Specification — P1+P2+P3+P4 + applied pair
 *
 * These cases are treated as "golden truth" for the legacy implementation.
 * When v2 is implemented, shadow diff must match these for the same inputs.
 *
 * Sources:
 * - Pearson IAL Mathematics specification (YMA01), 2018 onwards
 * - Grade boundaries published by Pearson
 */

export interface YMA01Fixture {
  name: string;
  description: string;
  papers: Array<{
    unit: string; // e.g. "P1", "P2", "P3", "P4", "M1", "S1"
    rawScore: number;
    maxMark: number;
    series: string; // e.g. "2025-june"
  }>;
  // Expected legacy results (established as correct through prior review)
  expected: {
    validRoute: boolean;
    predictedGrade: string | null;
    totalUMS: number;
    maxUMS: number;
    aStarEligible: boolean;
  };
}

/** Valid route: P1+P2+P3+P4+M1+S1, scores at A threshold */
export const YMA01_VALID_A: YMA01Fixture = {
  name: "YMA01 Valid A",
  description: "All 6 required units with scores around A threshold (480/600)",
  papers: [
    { unit: "P1", rawScore: 65, maxMark: 75, series: "2025-june" },
    { unit: "P2", rawScore: 65, maxMark: 75, series: "2025-june" },
    { unit: "P3", rawScore: 65, maxMark: 75, series: "2025-june" },
    { unit: "P4", rawScore: 65, maxMark: 75, series: "2025-june" },
    { unit: "M1", rawScore: 65, maxMark: 75, series: "2025-june" },
    { unit: "S1", rawScore: 65, maxMark: 75, series: "2025-june" },
  ],
  expected: {
    validRoute: true,
    predictedGrade: "A",
    totalUMS: 480,
    maxUMS: 600,
    aStarEligible: false, // P3+P4 < 180 threshold for A*
  },
};

/** Valid route: P1+P2+P3+P4+M1+S1, scores at A* threshold */
export const YMA01_VALID_A_STAR: YMA01Fixture = {
  name: "YMA01 Valid A*",
  description: "All 6 required units with high scores, P3+P4 >= 180 for A*",
  papers: [
    { unit: "P1", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "P2", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "P3", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "P4", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "M1", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "S1", rawScore: 70, maxMark: 75, series: "2025-june" },
  ],
  expected: {
    validRoute: true,
    predictedGrade: "A*",
    totalUMS: 540,
    maxUMS: 600,
    aStarEligible: true,
  },
};

/** Invalid: missing P4 */
export const YMA01_MISSING_P4: YMA01Fixture = {
  name: "YMA01 Missing P4",
  description: "Missing required P4 unit",
  papers: [
    { unit: "P1", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "P2", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "P3", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "M1", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "S1", rawScore: 70, maxMark: 75, series: "2025-june" },
  ],
  expected: {
    validRoute: false,
    predictedGrade: null,
    totalUMS: 0, // not calculable as incomplete route
    maxUMS: 600,
    aStarEligible: false,
  },
};

/** Invalid: old/new spec mix */
export const YMA01_MIXED_SPEC: YMA01Fixture = {
  name: "YMA01 Mixed Spec",
  description: "Mixing new P1-P4 with old C12",
  papers: [
    { unit: "P1", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "P2", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "C12", rawScore: 100, maxMark: 125, series: "2020-june" },
    { unit: "P4", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "M1", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "S1", rawScore: 70, maxMark: 75, series: "2025-june" },
  ],
  expected: {
    validRoute: false,
    predictedGrade: null,
    totalUMS: 0,
    maxUMS: 600,
    aStarEligible: false,
  },
};

/** Invalid: illegal applied combination (M1 + M3) */
export const YMA01_ILLEGAL_APPLIED: YMA01Fixture = {
  name: "YMA01 Illegal Applied",
  description: "M1 + M3 is not an allowed applied pair",
  papers: [
    { unit: "P1", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "P2", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "P3", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "P4", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "M1", rawScore: 70, maxMark: 75, series: "2025-june" },
    { unit: "M3", rawScore: 70, maxMark: 75, series: "2025-june" },
  ],
  expected: {
    validRoute: false,
    predictedGrade: null,
    totalUMS: 0,
    maxUMS: 600,
    aStarEligible: false,
  },
};

/** Old spec: C12 + C34 + S1 + D1 */
export const YMA01_OLD_SPEC_VALID: YMA01Fixture = {
  name: "YMA01 Old Spec Valid",
  description: "C12 + C34 + 2 applied (old spec route, 4 units total)",
  papers: [
    { unit: "C12", rawScore: 100, maxMark: 125, series: "2020-june" },
    { unit: "C34", rawScore: 100, maxMark: 125, series: "2020-june" },
    { unit: "S1", rawScore: 65, maxMark: 75, series: "2020-june" },
    { unit: "D1", rawScore: 65, maxMark: 75, series: "2020-june" },
  ],
  expected: {
    validRoute: true,
    predictedGrade: "A",
    totalUMS: 400, // 2×200 + 2×100
    maxUMS: 600,
    aStarEligible: false,
  },
};

export const ALL_YMA01_FIXTURES: YMA01Fixture[] = [
  YMA01_VALID_A,
  YMA01_VALID_A_STAR,
  YMA01_MISSING_P4,
  YMA01_MIXED_SPEC,
  YMA01_ILLEGAL_APPLIED,
  YMA01_OLD_SPEC_VALID,
];
