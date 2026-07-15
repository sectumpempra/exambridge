/**
 * Qualification Rules — Per-unit UMS configuration
 *
 * P0-4: C12/C34 are combined units worth 200 UMS each (not 100).
 * P0-6: Edexcel IAL sciences have non-uniform per-unit UMS allocations.
 *
 * When no specific rule is found, units default to 100 UMS (standard IAL).
 */

export interface UnitRule {
  /** Maximum UMS for this unit (default 100) */
  maxUMS: number;
}

/** Per-unit rules keyed by (boardKey -> subjectCode -> componentPattern) */
const QUALIFICATION_RULES: Record<
  string,
  Record<string, Record<string, UnitRule>>
> = {
  // ── Edexcel IAL A-Level ──
  "Edexcel-AL": {
    // IAL Mathematics — old spec C12/C34 are 200-UMS combined units
    WMA: {
      // C12 = Core Mathematics 12 (P1+P2 combined) — 200 UMS
      "Core Mathematics C12": { maxUMS: 200 },
      WMA01: { maxUMS: 200 },
      // C34 = Core Mathematics 34 (P3+P4 combined) — 200 UMS
      "Core Mathematics C34": { maxUMS: 200 },
      "Core Mathematics C34: Paper 01C": { maxUMS: 200 },
      WMA02: { maxUMS: 200 },
      // New spec P1-P4 + applied: standard 100 UMS each (no entry needed = default)
    },
    // IAL Physics — non-uniform UMS (P0-6)
    // Source: Edexcel IAL Physics specification
    // Theory units (1,2,4,5) = 100 UMS, Practical units (3,6) = 50 UMS
    WPH: {
      WPH11: { maxUMS: 100 },
      "Unit 1: Mechanics and Materials": { maxUMS: 100 },
      WPH12: { maxUMS: 100 },
      "Unit 2: Waves and Electricity": { maxUMS: 100 },
      WPH13: { maxUMS: 50 },
      "Unit 3: Practical Skills in Physics I": { maxUMS: 50 },
      WPH14: { maxUMS: 100 },
      "Unit 4: Further Mechanics, Fields and Particles": { maxUMS: 100 },
      WPH15: { maxUMS: 100 },
      "Unit 5: Thermodynamics, Radiation, Oscillations and Cosmology": { maxUMS: 100 },
      WPH16: { maxUMS: 50 },
      "Unit 6: Practical Skills in Physics II": { maxUMS: 50 },
    },
    // IAL Chemistry — non-uniform UMS
    // Theory units (1,2,4,5) = 100 UMS, Practical units (3,6) = 50 UMS
    WCH: {
      WCH11: { maxUMS: 100 },
      "Unit 1: Structure, Bonding and Introduction to Organic Chemistry": { maxUMS: 100 },
      WCH12: { maxUMS: 100 },
      "Unit 2: Energetics, Group Chemistry, Halogenoalkanes and Alcohols": { maxUMS: 100 },
      WCH13: { maxUMS: 50 },
      "Unit 3: Practical Skills in Chemistry I": { maxUMS: 50 },
      WCH14: { maxUMS: 100 },
      "Unit 4: Rates, Equilibria and Further Organic Chemistry": { maxUMS: 100 },
      WCH15: { maxUMS: 100 },
      "Unit 5: Transition Metals and Organic Nitrogen Chemistry": { maxUMS: 100 },
      WCH16: { maxUMS: 50 },
      "Unit 6: Practical Skills in Chemistry II": { maxUMS: 50 },
    },
    // IAL Biology — non-uniform UMS
    // Theory units (1,2,4,5) = 100 UMS, Practical units (3,6) = 50 UMS
    WBI: {
      WBI11: { maxUMS: 100 },
      "Unit 1: Molecules, Diet, Transport and Health": { maxUMS: 100 },
      WBI12: { maxUMS: 100 },
      "Unit 2: Cells, Development, Biodiversity and Conservation": { maxUMS: 100 },
      WBI13: { maxUMS: 50 },
      "Unit 3: Practical Skills in Biology I": { maxUMS: 50 },
      WBI14: { maxUMS: 100 },
      "Unit 4: Energy, Environment, Microbiology and Immunity": { maxUMS: 100 },
      WBI15: { maxUMS: 100 },
      "Unit 5: Respiration, Internal Environment, Coordination and Gene Technology": { maxUMS: 100 },
      WBI16: { maxUMS: 50 },
      "Unit 6: Practical Skills in Biology II": { maxUMS: 50 },
    },
  },
};

/** Subject-level default overrides (when all units of a subject share a non-100 default) */
const SUBJECT_DEFAULTS: Record<string, Record<string, number>> = {
  // No subject-level overrides needed — all defaults are 100
};

const DEFAULT_MAX_UMS = 100;

/**
 * Get the max UMS for a specific unit/component.
 * Matches by component name (e.g. "Core Mathematics C12") or unit code (e.g. "WMA01").
 * Falls back to 100 if no specific rule is configured.
 */
export function getUnitMaxUMS(
  boardKey: string,
  subjectCode: string,
  component: string
): number {
  const boardRules = QUALIFICATION_RULES[boardKey];
  if (!boardRules) return DEFAULT_MAX_UMS;

  // Find rules for this subject (exact match or prefix match)
  let subjectRules: Record<string, UnitRule> | undefined;

  // Exact match on subjectCode
  subjectRules = boardRules[subjectCode];

  // For Edexcel AL: try 3-letter prefix if no exact match
  if (!subjectRules && boardKey === "Edexcel-AL" && subjectCode.length > 3) {
    subjectRules = boardRules[subjectCode.substring(0, 3)];
  }

  if (!subjectRules) {
    // Check subject-level default
    const subjectDefault = SUBJECT_DEFAULTS[boardKey]?.[subjectCode];
    return subjectDefault ?? DEFAULT_MAX_UMS;
  }

  // Try exact match on component name/code
  const exact = subjectRules[component];
  if (exact) return exact.maxUMS;

  // Try partial match (component contains the key)
  for (const [pattern, rule] of Object.entries(subjectRules)) {
    if (component.includes(pattern)) return rule.maxUMS;
  }

  return DEFAULT_MAX_UMS;
}

/**
 * Calculate the total max UMS for a set of selected papers.
 * P0-4: Uses per-unit maxUMS instead of assuming 100 per unit.
 */
export function getTotalMaxUMSForPapers(
  boardKey: string,
  _subjectCode: string,
  components: string[]
): number {
  // Edexcel AL with merged subjects: subjectCode is 3-letter prefix (WMA, WPH, etc.)
  const subjectPrefix = boardKey === "Edexcel-AL" && _subjectCode.length === 3
    ? _subjectCode
    : _subjectCode;

  return components.reduce((sum, comp) => {
    return sum + getUnitMaxUMS(boardKey, subjectPrefix, comp);
  }, 0);
}

/**
 * Get unit rules for an entire subject (for award-rule integration).
 * Returns a map of component -> UnitRule.
 */
export function getSubjectUnitRules(
  boardKey: string,
  subjectCode: string
): Record<string, UnitRule> {
  const boardRules = QUALIFICATION_RULES[boardKey];
  if (!boardRules) return {};

  let rules = boardRules[subjectCode];
  if (!rules && boardKey === "Edexcel-AL" && subjectCode.length > 3) {
    rules = boardRules[subjectCode.substring(0, 3)];
  }
  return rules ?? {};
}
