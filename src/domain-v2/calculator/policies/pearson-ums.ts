/**
 * Pearson UMS Calculation Policy
 *
 * Implements piece-wise linear interpolation from raw score to UMS
 * based on grade boundaries.
 *
 * Source: Pearson Edexcel IAL specification
 *   - A = 80% UMS, B = 70%, C = 60%, D = 50%, E = 40%
 *   - Linear interpolation between adjacent grade boundaries
 *   - Below E = 0 UMS, at/above max = 100% UMS max
 */

import type { BoundarySet } from "@/domain-v2/catalog/schema";

export interface UMSCalculationInput {
  rawScore: number;
  maxMark: number;
  umsMax: number;
  boundarySet: BoundarySet;
}

export interface UMSCalculationResult {
  ums: number;
  umsMax: number;
  grade: string;
  explanation: string;
}

/** Grade to UMS percentage mapping for Pearson */
const GRADE_TO_UMS_PCT: Record<string, number> = {
  MAX: 1.0,   // 100% — at or above max raw score
  A: 0.8,     // 80%
  B: 0.7,     // 70%
  C: 0.6,     // 60%
  D: 0.5,     // 50%
  E: 0.4,     // 40%
  U: 0.0,     // 0% — below E boundary
};

// Grade order for interpolation points: MAX, A, B, C, D, E, U

/**
 * Calculate UMS from raw score using Pearson's piece-wise linear method.
 *
 * Algorithm:
 * 1. Find the grade boundary segments the raw score falls between
 * 2. Linearly interpolate between the two boundary UMS percentages
 * 3. Round to nearest integer (standard Pearson rounding)
 */
export function calculateUMS(input: UMSCalculationInput): UMSCalculationResult {
  const { rawScore, maxMark, umsMax, boundarySet } = input;

  // Clamp raw score to [0, maxMark]
  const clampedScore = Math.max(0, Math.min(rawScore, maxMark));

  // Build sorted boundary points: [{grade, rawMark, umsPct}, ...]
  const points = buildBoundaryPoints(boundarySet, maxMark);

  // Determine grade first (needed for UMS calculation)
  const grade = determineGrade(clampedScore, points);

  // If grade is U (below E boundary), UMS is 0 — no interpolation below E
  if (grade === "U") {
    return {
      ums: 0,
      umsMax,
      grade: "U",
      explanation: `Raw ${clampedScore}/${maxMark} → below E boundary → UMS 0/${umsMax} (0%) → Grade U`,
    };
  }

  // Find which segment the score falls into
  const segment = findSegment(clampedScore, points);

  // Linear interpolation
  const ums = interpolate(clampedScore, segment, umsMax);

  // Round to nearest integer
  const roundedUMS = Math.round(ums);

  return {
    ums: roundedUMS,
    umsMax,
    grade,
    explanation: buildExplanation(clampedScore, maxMark, roundedUMS, umsMax, segment, grade),
  };
}

interface BoundaryPoint {
  grade: string;
  rawMark: number;
  umsPct: number;
}

function buildBoundaryPoints(boundarySet: BoundarySet, maxMark: number): BoundaryPoint[] {
  const points: BoundaryPoint[] = [];

  // Add max point (100% raw = 100% UMS)
  points.push({ grade: "MAX", rawMark: maxMark, umsPct: 1.0 });

  // Add boundary thresholds in order (A, B, C, D, E)
  for (const grade of ["A", "B", "C", "D", "E"]) {
    const threshold = boundarySet.thresholds.find((t) => t.grade === grade);
    if (threshold !== undefined) {
      points.push({
        grade,
        rawMark: threshold.minMark,
        umsPct: GRADE_TO_UMS_PCT[grade] ?? 0,
      });
    }
  }

  // Add U point (0 raw = 0 UMS)
  // The E threshold defines the bottom of the UMS scale
  const eThreshold = boundarySet.thresholds.find((t) => t.grade === "E");
  if (eThreshold !== undefined) {
    points.push({ grade: "U", rawMark: 0, umsPct: 0.0 });
  }

  // Sort by rawMark descending (highest raw first)
  points.sort((a, b) => b.rawMark - a.rawMark);

  return points;
}

interface Segment {
  upper: BoundaryPoint;
  lower: BoundaryPoint;
}

function findSegment(score: number, points: BoundaryPoint[]): Segment {
  // Find the segment where: upper.rawMark >= score >= lower.rawMark
  for (let i = 0; i < points.length - 1; i++) {
    const upper = points[i];
    const lower = points[i + 1];
    if (score >= lower.rawMark && score <= upper.rawMark) {
      return { upper, lower };
    }
  }

  // Score is below the lowest defined boundary point
  // In Pearson UMS, below E boundary = 0 UMS (no interpolation below E)
  const lowest = points[points.length - 1];
  return {
    upper: lowest,
    lower: { grade: "U", rawMark: 0, umsPct: 0 },
  };
}

function interpolate(score: number, segment: Segment, umsMax: number): number {
  const { upper, lower } = segment;
  const rawRange = upper.rawMark - lower.rawMark;

  if (rawRange === 0) {
    // No range — return the upper UMS
    return upper.umsPct * umsMax;
  }

  const umsRange = upper.umsPct - lower.umsPct;
  const ratio = (score - lower.rawMark) / rawRange;

  return (lower.umsPct + ratio * umsRange) * umsMax;
}

function determineGrade(score: number, points: BoundaryPoint[]): string {
  // Points are sorted by rawMark descending
  for (const point of points) {
    if (score >= point.rawMark) {
      return point.grade === "MAX" ? "A" : point.grade;
    }
  }
  return "U";
}

function buildExplanation(
  rawScore: number,
  maxMark: number,
  ums: number,
  umsMax: number,
  segment: Segment,
  grade: string
): string {
  const pct = ((ums / umsMax) * 100).toFixed(1);
  return (
    `Raw ${rawScore}/${maxMark} → ` +
    `${segment.upper.grade}(${segment.upper.rawMark})/${segment.lower.grade}(${segment.lower.rawMark}) ` +
    `→ UMS ${ums}/${umsMax} (${pct}%) → Grade ${grade}`
  );
}
