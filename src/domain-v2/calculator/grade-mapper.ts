/**
 * Grade Mapper
 *
 * Maps aggregated normalized scores to grades using a GradingScale or GradePolicy.
 * Handles ordered threshold evaluation (highest grade first).
 */

import type { GradePolicy, GradingScale } from "@/domain-v2/catalog/schema";
import type { GradeCheck } from "./types";

export interface GradeMappingInput {
  totalScore: number;
  maxScore: number;
  gradePolicy: GradePolicy;
  gradingScale: GradingScale;
}

export interface GradeMappingResult {
  grade: string;
  gradeChecks: GradeCheck[];
  nextGrade?: { grade: string; gap: number };
}

/**
 * Map total score to grade by evaluating thresholds from highest to lowest.
 *
 * Algorithm:
 * 1. Compute percentage (total / max)
 * 2. Evaluate each grade threshold from highest to lowest
 * 3. First achieved grade is the result
 * 4. nextGrade points to the immediately higher grade (not A* if not eligible)
 */
export function mapGrade(input: GradeMappingInput): GradeMappingResult {
  const { totalScore, maxScore, gradePolicy, gradingScale } = input;
  const percentage = maxScore > 0 ? totalScore / maxScore : 0;

  // Build ordered grade thresholds (highest first, skip A* as it's handled separately)
  const orderedGrades = getOrderedGrades(gradingScale);

  const gradeChecks: GradeCheck[] = [];
  let achievedGrade: string | null = null;
  let nextGrade: { grade: string; gap: number } | undefined;

  // Get thresholds from grade policy (overrides) or grading scale defaults
  const thresholds = gradePolicy.gradeThresholds ?? getDefaultThresholds(gradingScale);

  // Evaluate from highest to lowest
  for (const grade of orderedGrades) {
    if (grade === "A*") continue; // A* is handled by a separate policy

    const thresholdPct = thresholds[grade];
    if (thresholdPct === undefined) continue;

    const thresholdScore = maxScore * thresholdPct;
    const achieved = percentage >= thresholdPct;
    const gap = achieved ? 0 : thresholdScore - totalScore;

    gradeChecks.push({
      grade,
      threshold: Math.round(thresholdScore),
      achieved,
      gap: Math.round(gap),
    });

    if (achieved && achievedGrade === null) {
      achievedGrade = grade;
    }

    if (!achieved && nextGrade === undefined) {
      nextGrade = { grade, gap: Math.round(gap) };
    }
  }

  // If no grade achieved, it's U (unclassified)
  if (achievedGrade === null) {
    achievedGrade = "U";
  }

  // If highest grade achieved, no next grade
  if (achievedGrade === orderedGrades.find((g) => g !== "A*")) {
    nextGrade = undefined;
  }

  return {
    grade: achievedGrade,
    gradeChecks,
    nextGrade,
  };
}

/**
 * Get ordered grades from highest to lowest.
 * A* is handled separately by AStarPolicy.
 */
function getOrderedGrades(scale: GradingScale): string[] {
  // Standard order: A*, A, B, C, D, E, U
  const standardOrder = ["A*", "A", "B", "C", "D", "E", "U"];
  const scaleGrades = new Set(scale.thresholds.map((t) => t.grade));

  // Filter to grades present in this scale, maintaining order
  return standardOrder.filter((g) => scaleGrades.has(g));
}

/**
 * Get default thresholds from grading scale.
 * Uses the scale's threshold percentages if available,
 * otherwise falls back to standard IAL percentages.
 */
function getDefaultThresholds(scale: GradingScale): Record<string, number> {
  const defaults: Record<string, number> = {};

  for (const t of scale.thresholds) {
    // minMark in the scale is a percentage (0-100)
    defaults[t.grade] = t.minMark / 100;
  }

  return defaults;
}
