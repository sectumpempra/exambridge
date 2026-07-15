/**
 * CAIE PUM (Percentage Uniform Mark) Calculation Policy
 *
 * CAIE uses PUM (0-100) instead of UMS. The mapping from raw score to PUM
 * uses piece-wise linear interpolation between fixed grade boundaries.
 *
 * Source: CAIE A-Level Mathematics (9709) specification
 *   - A = 80% PUM, B = 70%, C = 60%, D = 50%, E = 40%
 *   - Linear interpolation between adjacent grade boundaries
 *   - Above A boundary → PUM >= 80 (up to 100 at full marks)
 *   - Below E boundary → PUM < 40 (linear from 0 to E boundary)
 */

import type { BoundarySet } from "@/domain-v2/catalog/schema";

export interface PUMCalculationInput {
  rawScore: number;
  maxMark: number;
  boundarySet: BoundarySet;
}

export interface PUMCalculationResult {
  pum: number;
  grade: string;
  explanation: string;
}

/** Grade to PUM percentage mapping for CAIE */
const GRADE_TO_PUM_PCT: Record<string, number> = {
  MAX: 1.0,   // 100% — full marks
  A: 0.8,     // 80%
  B: 0.7,     // 70%
  C: 0.6,     // 60%
  D: 0.5,     // 50%
  E: 0.4,     // 40%
  U: 0.0,     // 0%
};

/**
 * Calculate PUM from raw score using CAIE's piece-wise linear method.
 *
 * Algorithm:
 * 1. Build boundary points from A/B/C/D/E thresholds
 * 2. Linearly interpolate between adjacent boundaries
 * 3. Full marks → 100 PUM
 * 4. Below E → linear from 0 raw to E boundary = 0-40 PUM
 * 5. Round to nearest integer
 */
export function calculatePUM(input: PUMCalculationInput): PUMCalculationResult {
  const { rawScore, maxMark, boundarySet } = input;

  // Clamp raw score
  const clampedScore = Math.max(0, Math.min(rawScore, maxMark));

  // Build sorted boundary points (rawMark → pumPct)
  const points = buildBoundaryPoints(boundarySet, maxMark);

  // Find segment and interpolate
  const pumPct = interpolatePUM(clampedScore, points);
  const pum = Math.round(pumPct * 100);

  // Determine grade
  const grade = determineGradePUM(pum);

  return {
    pum,
    grade,
    explanation: `Raw ${clampedScore}/${maxMark} → PUM ${pum}/100 (${(pumPct * 100).toFixed(1)}%) → Grade ${grade}`,
  };
}

interface BoundaryPoint {
  grade: string;
  rawMark: number;
  pumPct: number;
}

function buildBoundaryPoints(boundarySet: BoundarySet, maxMark: number): BoundaryPoint[] {
  const points: BoundaryPoint[] = [];

  // Add max point
  points.push({ grade: "MAX", rawMark: maxMark, pumPct: 1.0 });

  // Add grade boundaries (A, B, C, D, E)
  for (const grade of ["A", "B", "C", "D", "E"]) {
    const threshold = boundarySet.thresholds.find((t) => t.grade === grade);
    if (threshold !== undefined) {
      points.push({
        grade,
        rawMark: threshold.minMark,
        pumPct: GRADE_TO_PUM_PCT[grade] ?? 0,
      });
    }
  }

  // Add U point (0 raw = 0 PUM)
  points.push({ grade: "U", rawMark: 0, pumPct: 0.0 });

  // Sort by rawMark descending
  points.sort((a, b) => b.rawMark - a.rawMark);

  return points;
}

function interpolatePUM(score: number, points: BoundaryPoint[]): number {
  // Find the segment
  for (let i = 0; i < points.length - 1; i++) {
    const upper = points[i];
    const lower = points[i + 1];
    if (score >= lower.rawMark && score <= upper.rawMark) {
      const rawRange = upper.rawMark - lower.rawMark;
      if (rawRange === 0) return upper.pumPct;
      const pumRange = upper.pumPct - lower.pumPct;
      const ratio = (score - lower.rawMark) / rawRange;
      return lower.pumPct + ratio * pumRange;
    }
  }

  // Below all points
  return 0;
}

function determineGradePUM(pum: number): string {
  if (pum >= 80) return "A";
  if (pum >= 70) return "B";
  if (pum >= 60) return "C";
  if (pum >= 50) return "D";
  if (pum >= 40) return "E";
  return "U";
}
