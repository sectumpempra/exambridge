/**
 * Award Rule Configuration for Edexcel IAL A/A* Calculation
 *
 * YMA01 (IAL Mathematics): 6 units, 600 UMS total.
 *   A = 480/600, A* = total ≥ 480 AND P3+P4 ≥ 180/200.
 *   Valid combination: P1 + P2 + P3 + P4 + 2 applied (M/S/D).
 *
 * YFM01 (IAL Further Maths): 6 units, 600 UMS total. INACTIVE (data incomplete).
 *
 * Unit max UMS is normally 100, but science practicals are 60 and some theory units are 120.
 * Per-unit UMS should come from qualification-rules.ts, not assumed here.
 */

export interface AwardRule {
  /** Subject code from subjects_config (e.g. "YMA01") */
  subjectCode: string;
  /** Human-readable name */
  name: string;
  /** Number of units required for the full qualification */
  unitCount: number;
  /** Default UMS per unit (fallback when per-unit metadata unavailable) */
  unitMaxUMS: number;
  /** Total qualification max UMS (e.g. 600 for YMA01). Overrides unitCount * unitMaxUMS. */
  qualificationMaxUMS?: number;
  /** Number of A2 units (for threshold calc). Defaults to a2Components.length if omitted. */
  a2UnitCount?: number;
  /** Which component IDs count as A2. Used for paper matching. */
  a2Components: string[];
  /** Grade boundaries as percentage of total UMS */
  gradeBoundaries: Record<string, number>;
  /** A* requires total ≥ this percentage of qualification max UMS */
  aStarTotalThresholdPct: number;
  /** A* requires A2 average ≥ this percentage of A2 max UMS */
  aStarA2ThresholdPct: number;
  /** Math special: Core 34 (P3+P4) must ≥ this UMS (0 = no special rule) */
  mathCore34Threshold?: number;
  /** Minimum number of selected papers to output a qualification grade */
  minPapersForQualification?: number;
}

/** IAL Award Rules database */
export const IAL_AWARD_RULES: Record<string, AwardRule> = {
  // ── IAL Mathematics (6 units, 600 UMS) ──
  // P0-1: Was incorrectly modeled as 4 units / 400 UMS.
  // Pearson IAL Mathematics is P1+P2+P3+P4 + 2 applied units = 6 units.
  // A = 480/600. A* = total ≥ 480 AND P3+P4 ≥ 180.
  YMA01: {
    subjectCode: "YMA01",
    name: "IAL Mathematics",
    unitCount: 6,
    unitMaxUMS: 100,
    qualificationMaxUMS: 600,
    a2Components: ["P3", "P4"],
    gradeBoundaries: { A: 0.8, B: 0.7, C: 0.6, D: 0.5, E: 0.4 },
    aStarA2ThresholdPct: 0.9,
    aStarTotalThresholdPct: 0.8,
    mathCore34Threshold: 180, // P3+P4 ≥ 180 UMS
    minPapersForQualification: 6,
  },
  // ── IAL Further Mathematics (6 units) ──
  // P1: INACTIVE — YFM01 requires 6 units (FP1 + FP2 + FP3 + 3 options from applied).
  // Current data only has WFM01-03 (3 FP units). No resolver path from PREFIX_TO_QUAL_CODE.
  // To activate: add WME/WST/WDM option units to Edexcel AL data and enable WFM → YFM01 lookup.
  // YFM01: {
  //   subjectCode: "YFM01",
  //   name: "IAL Further Mathematics",
  //   unitCount: 6,
  //   unitMaxUMS: 100,
  //   a2UnitCount: 3,
  //   a2Components: ["FP2", "FP3"],
  //   gradeBoundaries: { A: 0.8, B: 0.7, C: 0.6, D: 0.5, E: 0.4 },
  //   aStarRule: " proportional",
  //   aStarA2ThresholdPct: 0.9,
  //   aStarTotalThresholdPct: 0.8,
  // },
  // ── IAL Pure Mathematics (4 units) ──
  // P1-2: YPM01 disabled — no WPM prefix in subjects_config or data.
  // Re-enable when Pure Mathematics units are added to the dataset.
  // YPM01: {
  //   subjectCode: "YPM01",
  //   name: "IAL Pure Mathematics",
  //   unitCount: 4,
  //   unitMaxUMS: 100,
  //   a2Components: ["P3", "P4"],
  //   gradeBoundaries: { A: 0.8, B: 0.7, C: 0.6, D: 0.5, E: 0.4 },
  //   aStarRule: " proportional",
  //   aStarA2ThresholdPct: 0.9,
  //   aStarTotalThresholdPct: 0.8,
  // },
};

/** Map from 3-letter subject prefix (as used by calculatorIndex / GradeCalculator) to qualification code. */
const PREFIX_TO_QUAL_CODE: Record<string, string> = {
  WMA: "YMA01", // IAL Mathematics (valid 4-unit)
  // P0-3: WFM disabled — no complete 6-unit data path for YFM01.
  // WFM: "YFM01",
  // P1-2: WPM disabled — no data path for YPM01.
  // WPM: "YPM01",
};

/**
 * Get award rule for a subject code.
 * Supports both qualification codes ("YMA01") and 3-letter prefixes ("WMA").
 * Returns null if no specific rule is configured (fallback to generic 4-unit logic).
 */
export function getAwardRule(subjectCode: string): AwardRule | null {
  // Direct lookup by qualification code
  const direct = IAL_AWARD_RULES[subjectCode];
  if (direct) return direct;
  // Prefix lookup (e.g. "WMA" → "YMA01")
  const qualCode = PREFIX_TO_QUAL_CODE[subjectCode];
  if (qualCode) return IAL_AWARD_RULES[qualCode] || null;
  return null;
}

/**
 * Check if a subject has a configured award rule.
 */
export function hasAwardRule(subjectCode: string): boolean {
  return subjectCode in IAL_AWARD_RULES || subjectCode in PREFIX_TO_QUAL_CODE;
}

/**
 * Calculate total UMS max for a rule.
 * Uses explicit qualificationMaxUMS if set, otherwise unitCount * unitMaxUMS.
 */
export function getTotalMaxUMS(rule: AwardRule): number {
  return rule.qualificationMaxUMS ?? rule.unitCount * rule.unitMaxUMS;
}

/**
 * Calculate A2 UMS max for a rule.
 * Uses explicit a2UnitCount if set (needed for FM where a2Components.length ≠ actual A2 count),
 * otherwise falls back to a2Components.length.
 */
export function getA2MaxUMS(rule: AwardRule): number {
  const a2Count = rule.a2UnitCount ?? rule.a2Components.length;
  return a2Count * rule.unitMaxUMS;
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
