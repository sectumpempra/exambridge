/**
 * Award Rule Configuration for Edexcel IAL A/A* Calculation
 *
 * Edexcel IAL uses a modular system where each unit is worth 100 UMS.
 * A* rules differ between 4-unit and 6-unit qualifications:
 *   - 4-unit: Total ≥ 320 (80%), A2 units ≥ 180 (90% of 200)
 *   - 6-unit: Total ≥ 480 (80%), A2 units ≥ 270 (90% of 300)
 *
 * A2 units are the higher-numbered units in each qualification.
 */

export interface AwardRule {
  /** Subject code from subjects_config (e.g. "YMA01") */
  subjectCode: string;
  /** Human-readable name */
  name: string;
  /** Number of units: 4 or 6 */
  unitCount: 4 | 6;
  /** UMS per unit (IAL = 100) */
  unitMaxUMS: number;
  /** Which component IDs count as A2 (rest are AS) */
  a2Components: string[];
  /** Grade boundaries as percentage of total UMS */
  gradeBoundaries: Record<string, number>;
  /** A* calculation method */
  aStarRule: " proportional";
  /** A* requires A2 average ≥ this percentage */
  aStarA2ThresholdPct: number;
  /** A* requires total ≥ this percentage */
  aStarTotalThresholdPct: number;
  /** Math special: Core 34 (P3+P4) must ≥ this UMS (0 = no special rule) */
  mathCore34Threshold?: number;
}

/** IAL Award Rules database */
export const IAL_AWARD_RULES: Record<string, AwardRule> = {
  // ── IAL Mathematics (4 units) ──
  YMA01: {
    subjectCode: "YMA01",
    name: "IAL Mathematics",
    unitCount: 4,
    unitMaxUMS: 100,
    a2Components: ["P3", "P4"],
    gradeBoundaries: { A: 0.8, B: 0.7, C: 0.6, D: 0.5, E: 0.4 },
    aStarRule: " proportional",
    aStarA2ThresholdPct: 0.9,
    aStarTotalThresholdPct: 0.8,
    mathCore34Threshold: 180, // P3+P4 ≥ 180 UMS
  },
  // ── IAL Further Mathematics (6 units) ──
  YFM01: {
    subjectCode: "YFM01",
    name: "IAL Further Mathematics",
    unitCount: 6,
    unitMaxUMS: 100,
    a2Components: ["FP2", "FP3"], // A2 = FP2 + FP3 + 3 options (all non-FP1)
    gradeBoundaries: { A: 0.8, B: 0.7, C: 0.6, D: 0.5, E: 0.4 },
    aStarRule: " proportional",
    aStarA2ThresholdPct: 0.9,
    aStarTotalThresholdPct: 0.8,
  },
  // ── IAL Pure Mathematics (4 units) ──
  YPM01: {
    subjectCode: "YPM01",
    name: "IAL Pure Mathematics",
    unitCount: 4,
    unitMaxUMS: 100,
    a2Components: ["P3", "P4"],
    gradeBoundaries: { A: 0.8, B: 0.7, C: 0.6, D: 0.5, E: 0.4 },
    aStarRule: " proportional",
    aStarA2ThresholdPct: 0.9,
    aStarTotalThresholdPct: 0.8,
  },
};

/**
 * Get award rule for a subject code.
 * Returns null if no specific rule is configured (fallback to generic 4-unit logic).
 */
export function getAwardRule(subjectCode: string): AwardRule | null {
  return IAL_AWARD_RULES[subjectCode] || null;
}

/**
 * Check if a subject has a configured award rule.
 */
export function hasAwardRule(subjectCode: string): boolean {
  return subjectCode in IAL_AWARD_RULES;
}

/**
 * Calculate total UMS max for a rule.
 */
export function getTotalMaxUMS(rule: AwardRule): number {
  return rule.unitCount * rule.unitMaxUMS;
}

/**
 * Calculate A2 UMS max for a rule.
 */
export function getA2MaxUMS(rule: AwardRule): number {
  return rule.a2Components.length * rule.unitMaxUMS;
}

/**
 * Get A threshold UMS.
 */
export function getAThresholdUMS(rule: AwardRule): number {
  return getTotalMaxUMS(rule) * rule.gradeBoundaries.A;
}

/**
 * Get A* A2 threshold UMS.
 */
export function getAStarA2ThresholdUMS(rule: AwardRule): number {
  return getA2MaxUMS(rule) * rule.aStarA2ThresholdPct;
}
