/**
 * Grade Calculation Engine
 * Implements precise PUM/UMS/GNS calculation, A* determination, and precision assessment
 * per the four major exam boards (CAIE, Edexcel, AQA, OCR)
 *
 * Weighting factors sourced from:
 * - CAIE: 206341-syllabus-component-weighting-factors.pdf
 * - Syllabus version data from official CAIE syllabus documents
 */

import { getAwardRule, getTotalMaxUMS, getA2MaxUMS, getAThresholdUMS, getAStarA2ThresholdUMS } from "@/data/award-rules";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PaperInput {
  component: string;
  label: string;
  score: number;
  maxMark: number;
  series: string;        // e.g. "s-2024", "w-2025"
  boundaries?: Record<string, number>;  // grade thresholds for this paper
}

export interface PaperResult extends PaperInput {
  percentage: number;
  normalizedScore: number;  // PUM (0-100) or UMS or GNS
  scoreType: "PUM" | "UMS" | "GNS" | "RAW";
  asA2Tag?: "AS" | "A2";
  syllabusVersion?: string;
}

export interface AStarCheck {
  eligible: boolean;       // meets A* requirements
  totalMet: boolean;       // total score >= A threshold
  a2Met: boolean;          // A2 portion >= 90%
  totalThreshold: number;  // required total
  a2Threshold: number;     // required A2
  details: string[];       // human-readable check details
}

export interface CalculationOutput {
  papers: PaperResult[];
  totalNormalized: number;    // weighted total (PUM/UMS/GNS)
  maxNormalized: number;      // max possible
  percentage: number;
  predictedGrade: string;
  gradeResults: GradeBoundaryResult[];
  aStarCheck: AStarCheck | null;
  precision: PrecisionRating;
  completenessWarning?: string;
  nextGradeGap: number | null;
  avgPum?: number;            // CAIE: average PUM across papers
  totalScore: number;         // sum of raw scores
  maxTotal: number;           // sum of max marks
}

export interface GradeBoundaryResult {
  gradeLabel: string;
  requiredTotal: number;
  achieved: boolean;
  gap: number;
}

export interface PrecisionRating {
  stars: string;      // e.g. "★★★★★"
  level: string;      // e.g. "最高", "高", "中等"
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weighting Factor Database
// Sourced from CAIE 206341-syllabus-component-weighting-factors.pdf
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get weighting factor for a CAIE paper.
 * For A-Level: most components have weight=1 (direct sum).
 * For IGCSE: weights vary by paper (e.g. 0580 Extended = 50/50).
 * Returns 0 if no specific weight is defined (caller should use equal weights).
 */
export function getPaperWeight(
  boardKey: string,
  subjectCode: string,
  component: string
): number {
  // ── CAIE A-Level ──
  if (boardKey === "CAIE-AL") {
    // 9709 Mathematics: all components weight=1
    // P1(1x) + P3(3x) + M1(4x) + S1(5x) + S2(6x) all weight=1
    if (subjectCode === "9709") return 1;

    // 9231 Further Mathematics: all components weight=1
    if (subjectCode === "9231") return 1;

    // 9700 Biology:
    if (subjectCode === "9700") {
      if (["31", "32", "33"].includes(component)) return 0.75; // AS Practical
      return 1;
    }

    // 9701 Chemistry:
    if (subjectCode === "9701") {
      if (["31", "32", "33", "34", "35"].includes(component)) return 0.75; // Practical
      return 1;
    }

    // 9702 Physics:
    if (subjectCode === "9702") {
      if (["31", "32", "33", "34", "35"].includes(component)) return 0.75; // Practical
      return 1;
    }

    // 9708 Economics:
    if (subjectCode === "9708") return 1;

    // 9609 Business:
    if (subjectCode === "9609") return 1;

    // 9618 Computer Science:
    if (subjectCode === "9618") return 1;

    // 9706 Accounting:
    if (subjectCode === "9706") {
      if (component === "80") return 0.75;
      return 1;
    }

    // Default: equal weighting
    return 1;
  }

  // ── CAIE IGCSE ──
  if (boardKey === "CAIE-GCSE") {
    // 0580 Mathematics Extended (2025+): Paper 2 = 50%, Paper 4 = 50%
    if (subjectCode === "0580") {
      if (["21", "22", "23"].includes(component)) return 0.5; // Paper 2
      if (["41", "42", "43"].includes(component)) return 0.5; // Paper 4
      if (["11", "12", "13"].includes(component)) return 0.5; // Paper 1 (Core)
      if (["31", "32", "33"].includes(component)) return 0.5; // Paper 3 (Core)
      return 0;
    }

    // 0606 Additional Mathematics: Paper 1 = 50%, Paper 2 = 50%
    if (subjectCode === "0606") {
      if (["11", "12", "13"].includes(component)) return 0.5;
      if (["21", "22", "23"].includes(component)) return 0.5;
      return 0;
    }

    return 1;
  }

  // ── Edexcel / AQA / OCR ──
  // These boards use UMS with fixed grade boundaries; weight is implicit in UMS allocation
  return 0; // Use UMS sum method instead
}

// ─────────────────────────────────────────────────────────────────────────────
// Syllabus Version Detection
// ─────────────────────────────────────────────────────────────────────────────

/** Known syllabus version change years by (board, subject, component) */
const SYLLABUS_VERSIONS: Record<string, Record<string, Array<{
  yearStart: number;
  yearEnd: number;
  version: string;
  description?: string;
  changes?: string[];
}>>> = {
  "CAIE-GCSE": {
    // 0580 Mathematics: major spec changes in 2020 and 2025
    "0580": [
      {
        yearStart: 0, yearEnd: 2019,
        version: "v2 (旧版)",
        description: "2016-2019 旧考纲",
        changes: ["Paper 2: 56 marks", "Paper 4: 130 marks"],
      },
      {
        yearStart: 2020, yearEnd: 2024,
        version: "v3 (过渡版)",
        description: "2020-2024 过渡考纲",
        changes: ["Paper 2: 70 marks (从56增加)", "Paper 4: 130 marks"],
      },
      {
        yearStart: 2025, yearEnd: 9999,
        version: "v4 (2025新版)",
        description: "2025-2027 新考纲",
        changes: [
          "Paper 2: 100 marks (non-calculator, 从70增加)",
          "Paper 4: 100 marks (calculator, 从130减少)",
          "各 50% 权重 (原为 35/65)",
          "新增 surds, exact trig values, domain/range",
          "删除 linear programming, box plots, congruence criteria",
        ],
      },
    ],
    // 0606 Additional Mathematics: 2025 changes
    "0606": [
      {
        yearStart: 0, yearEnd: 2024,
        version: "v2 (旧版)",
        description: "Paper 1 允许计算器",
      },
      {
        yearStart: 2025, yearEnd: 9999,
        version: "v3 (2025新版)",
        description: "Paper 1 变为 non-calculator",
        changes: ["新增 Geometry of a Circle", "移除指数和根式", "Paper 1: 80 marks non-calc"],
      },
    ],
  },
  "CAIE-AL": {
    // 9709 Mathematics: relatively stable
    "9709": [
      {
        yearStart: 0, yearEnd: 2019,
        version: "旧版",
        description: "~2019及以前",
      },
      {
        yearStart: 2020, yearEnd: 9999,
        version: "新版 (2020+)",
        description: "2020+ Paper 结构稳定",
      },
    ],
  },
};

/**
 * Detect syllabus version for subjects with spec changes.
 * Returns human-readable version string with change descriptions.
 */
export function detectSyllabusVersion(
  boardKey: string,
  subjectCode: string,
  _component: string,
  series: string
): string | undefined {
  const yearMatch = series.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;
  if (year === 0) return undefined;

  const boardData = SYLLABUS_VERSIONS[boardKey];
  if (!boardData) return undefined;

  const versions = boardData[subjectCode];
  if (!versions) return undefined;

  // Find matching version by year
  for (const v of versions) {
    if (year >= v.yearStart && year <= v.yearEnd) {
      // For the newest version, don't show version label
      const isLatest = v.yearEnd === 9999;
      if (isLatest) return undefined; // Don't label latest version
      return `${v.version} ${v.description || ""}`.trim();
    }
  }

  return undefined;
}

/**
 * Get syllabus change description for display in results.
 */
export function getSyllabusChanges(
  boardKey: string,
  subjectCode: string,
  _component: string,
  series: string
): string[] | undefined {
  const yearMatch = series.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;
  if (year === 0) return undefined;

  const boardData = SYLLABUS_VERSIONS[boardKey];
  if (!boardData) return undefined;

  const versions = boardData[subjectCode];
  if (!versions) return undefined;

  for (const v of versions) {
    if (year >= v.yearStart && year <= v.yearEnd) {
      return v.changes;
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// AS/A2 Division
// ─────────────────────────────────────────────────────────────────────────────

/** Detailed AS/A2 rules per subject */
const AS_A2_RULES: Record<string, Record<string, (comp: string) => "AS" | "A2" | undefined>> = {
  "CAIE-AL": {
    // 9709 Mathematics
    "9709": (comp: string) => {
      if (comp.startsWith("1")) return "AS"; // P1 Pure
      if (comp.startsWith("2")) return "AS"; // P2 (legacy AS)
      if (comp.startsWith("5")) return "AS"; // S1 (can be AS applied)
      if (comp.startsWith("3")) return "A2"; // P3 Pure
      if (comp.startsWith("4")) return "A2"; // M1 (A2 applied)
      if (comp.startsWith("6")) return "A2"; // S2 (A2 applied)
      if (comp.startsWith("7")) return "A2"; // Old codes
      if (comp.startsWith("8")) return "A2"; // Old codes
      if (comp.startsWith("9")) return "A2"; // Old codes
      return undefined;
    },
    // 9231 Further Mathematics
    "9231": (comp: string) => {
      if (comp.startsWith("1")) return "AS"; // FP1
      if (comp.startsWith("2")) return "AS"; // FP2 (or old)
      if (["31", "32", "33", "41", "42", "43", "50", "51", "60", "61"].some(c => comp.startsWith(c.substring(0, 1)) && comp >= c)) {
        // Components 3x, 4x, 5x, 6x are A2
        const num = parseInt(comp);
        if (num >= 30 && num <= 49) return "A2";
        if (num >= 50) return "A2";
      }
      return undefined;
    },
    // 9700 Biology
    "9700": (comp: string) => {
      if (comp.startsWith("1")) return "AS"; // MCQ
      if (comp.startsWith("2")) return "AS"; // AS Structured
      if (comp.startsWith("3")) return "AS"; // AS Practical
      if (comp.startsWith("4")) return "A2"; // A2 Structured
      if (comp.startsWith("5")) return "A2"; // A2 MCQ/Options
      return undefined;
    },
    // 9701 Chemistry
    "9701": (comp: string) => {
      if (comp.startsWith("1")) return "AS"; // MCQ
      if (comp.startsWith("2")) return "AS"; // AS Structured
      if (comp.startsWith("3")) return "AS"; // AS Practical
      if (comp.startsWith("4")) return "A2"; // A2 Structured
      if (comp.startsWith("5")) return "A2"; // A2 Options
      return undefined;
    },
    // 9702 Physics
    "9702": (comp: string) => {
      if (comp.startsWith("1")) return "AS"; // MCQ
      if (comp.startsWith("2")) return "AS"; // AS Structured
      if (comp.startsWith("3")) return "AS"; // AS Practical
      if (comp.startsWith("4")) return "A2"; // A2 Structured
      if (comp.startsWith("5")) return "A2"; // A2 Options/Practical
      return undefined;
    },
    // 9708 Economics
    "9708": (comp: string) => {
      if (comp.startsWith("1")) return "AS"; // MCQ
      if (comp.startsWith("2")) return "AS"; // AS Structured
      if (comp.startsWith("3")) return "AS"; // Data Response
      if (comp.startsWith("4")) return "A2"; // Essays
      if (comp.startsWith("5")) return "A2"; // Case Study
      return undefined;
    },
    // 9609 Business
    "9609": (comp: string) => {
      if (comp.startsWith("1")) return "AS"; // MCQ
      if (comp.startsWith("2")) return "AS"; // Case Study
      if (comp.startsWith("3")) return "A2"; // Case Study 2
      if (comp.startsWith("4")) return "A2"; // Essay
      return undefined;
    },
    // 9618 Computer Science
    "9618": (comp: string) => {
      if (comp.startsWith("1")) return "AS"; // Theory
      if (comp.startsWith("2")) return "AS"; // Problem-solving
      if (comp.startsWith("3")) return "A2"; // Advanced Theory
      return undefined;
    },
    // 9706 Accounting
    "9706": (comp: string) => {
      if (comp.startsWith("1")) return "AS"; // MCQ
      if (comp.startsWith("2")) return "AS"; // Structured
      if (comp.startsWith("3")) return "AS"; // Structured
      if (comp.startsWith("4")) return "A2"; // Structured
      if (comp.startsWith("5")) return "A2"; // Options
      return undefined;
    },
  },
};

/**
 * Tag each paper as AS or A2 based on board + subject + component rules.
 */
export function getASA2Tag(
  boardKey: string,
  subjectCode: string,
  component: string
): "AS" | "A2" | undefined {
  // Use detailed rules if available
  const boardRules = AS_A2_RULES[boardKey];
  if (boardRules) {
    const subjectRule = boardRules[subjectCode];
    if (subjectRule) {
      return subjectRule(component);
    }
  }

  // Edexcel AL heuristic
  if (boardKey === "Edexcel-AL") {
    const unitNum = parseInt(component.match(/\d+/)?.[0] ?? "0");
    const lastDigit = unitNum % 10;
    if (lastDigit <= 2) return "AS";
    return "A2";
  }

  // AQA AL heuristic
  if (boardKey === "AQA-AL") {
    const unitNum = parseInt(component.match(/\d+/)?.[0] ?? "0");
    if (unitNum <= 2) return "AS";
    return "A2";
  }

  // OCR AL heuristic
  if (boardKey === "OCR-AL") {
    const unitNum = parseInt(component.match(/\d+/)?.[0] ?? "0");
    if (unitNum <= 2) return "AS";
    return "A2";
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CAIE PUM Calculation (Strict Piece-wise Linear Interpolation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate PUM for CAIE papers using the exact formula from the spec.
 *
 * A-Level PUM formula:
 *   A 以上:  PUM = 80 + (raw - A) / (M - A) × 20
 *   B~A:     PUM = 70 + (raw - B) / (A - B) × 10
 *   C~B:     PUM = 60 + (raw - C) / (B - C) × 10
 *   D~C:     PUM = 50 + (raw - D) / (C - D) × 10
 *   E~D:     PUM = 40 + (raw - E) / (D - E) × 10
 *   E 以下:  PUM = (raw / E) × 40
 *
 * IGCSE PUM formula (includes A* threshold):
 *   A* 以上: PUM = 90 + (raw - A*) / (M - A*) × 10
 *   A~A*:    PUM = 80 + (raw - A) / (A* - A) × 10
 *   A 以下同 A-Level 公式
 */
export function calculateCAIEPUM(
  raw: number,
  maxMark: number,
  boundaries: Record<string, number> | undefined,
  hasAStar: boolean = false
): number {
  if (maxMark <= 0) return 0;
  if (raw <= 0) return 0;
  if (raw >= maxMark) return 100;
  if (!boundaries) return Math.round((raw / maxMark) * 100 * 10) / 10;

  const aStar = boundaries["a_star"];
  const a = boundaries["a"];
  const b = boundaries["b"];
  const c = boundaries["c"];
  const d = boundaries["d"];
  const e = boundaries["e"];

  // IGCSE path with A* threshold
  if (hasAStar && aStar && aStar > 0) {
    if (raw >= aStar) {
      const ratio = maxMark > aStar ? (raw - aStar) / (maxMark - aStar) : 0;
      return Math.min(100, Math.round((90 + ratio * 10) * 10) / 10);
    }
    if (a && raw >= a) {
      const ratio = aStar > a ? (raw - a) / (aStar - a) : 0;
      return Math.round((80 + ratio * 10) * 10) / 10;
    }
  }

  // A-Level path (no A* at component level) or IGCSE without A* threshold
  if (a && raw >= a) {
    const upper = hasAStar && aStar && aStar > 0 ? aStar : maxMark;
    const range = upper > a ? upper - a : maxMark - a;
    const ratio = range > 0 ? (raw - a) / range : 0;
    const base = hasAStar && aStar && aStar > 0 ? 80 : 80;
    const spread = hasAStar && aStar && aStar > 0 ? 10 : 20;
    return Math.min(100, Math.round((base + ratio * spread) * 10) / 10);
  }
  if (b && raw >= b) {
    const ratio = a && a > b ? (raw - b) / (a - b) : 0;
    return Math.round((70 + ratio * 10) * 10) / 10;
  }
  if (c && raw >= c) {
    const ratio = b && b > c ? (raw - c) / (b - c) : 0;
    return Math.round((60 + ratio * 10) * 10) / 10;
  }
  if (d && raw >= d) {
    const ratio = c && c > d ? (raw - d) / (c - d) : 0;
    return Math.round((50 + ratio * 10) * 10) / 10;
  }
  if (e && raw >= e) {
    const ratio = d && d > e ? (raw - e) / (d - e) : 0;
    return Math.round((40 + ratio * 10) * 10) / 10;
  }
  // Below E
  if (e && e > 0) {
    return Math.round(Math.max(0, (raw / e) * 40) * 10) / 10;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. UMS Calculation (Edexcel / AQA / OCR A-Level)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate UMS using fixed grade boundaries (A=80%, B=70%, C=60%, D=50%, E=40%)
 * with piece-wise linear interpolation.
 */
export function calculateUMS(
  raw: number,
  maxMark: number,
  boundaries: Record<string, number> | undefined,
  maxUMS: number = 100
): number {
  if (maxMark <= 0) return 0;
  if (raw <= 0) return 0;
  if (raw >= maxMark) return maxUMS;
  if (!boundaries) return Math.round((raw / maxMark) * maxUMS * 10) / 10;

  const aStarRaw = boundaries["a_star"] && boundaries["a_star"] > 0
    ? boundaries["a_star"]
    : null;
  const aRaw = boundaries["a"];
  const bRaw = boundaries["b"];
  const cRaw = boundaries["c"];
  const dRaw = boundaries["d"];
  const eRaw = boundaries["e"];

  const aStarUMS = maxUMS * 0.9;
  const aUMS = maxUMS * 0.8;
  const bUMS = maxUMS * 0.7;
  const cUMS = maxUMS * 0.6;
  const dUMS = maxUMS * 0.5;
  const eUMS = maxUMS * 0.4;

  // A* or above (when a_star boundary exists)
  if (aStarRaw && raw >= aStarRaw) {
    const ratio = maxMark > aStarRaw ? (raw - aStarRaw) / (maxMark - aStarRaw) : 0;
    return Math.min(maxUMS, Math.round((aStarUMS + ratio * (maxUMS - aStarUMS)) * 10) / 10);
  }
  // A~A* interval (when a_star boundary exists)
  if (aStarRaw && aRaw && raw >= aRaw) {
    const ratio = aStarRaw > aRaw ? (raw - aRaw) / (aStarRaw - aRaw) : 0;
    return Math.round((aUMS + ratio * (aStarUMS - aUMS)) * 10) / 10;
  }
  // A or above (no a_star boundary)
  if (!aStarRaw && aRaw && raw >= aRaw) {
    const ratio = maxMark > aRaw ? (raw - aRaw) / (maxMark - aRaw) : 0;
    return Math.min(maxUMS, Math.round((aUMS + ratio * (maxUMS - aUMS)) * 10) / 10);
  }
  // B~A
  if (bRaw && raw >= bRaw && aRaw) {
    const ratio = aRaw > bRaw ? (raw - bRaw) / (aRaw - bRaw) : 0;
    return Math.round((bUMS + ratio * (aUMS - bUMS)) * 10) / 10;
  }
  // C~B
  if (cRaw && raw >= cRaw && bRaw) {
    const ratio = bRaw > cRaw ? (raw - cRaw) / (bRaw - cRaw) : 0;
    return Math.round((cUMS + ratio * (bUMS - cUMS)) * 10) / 10;
  }
  // D~C
  if (dRaw && raw >= dRaw && cRaw) {
    const ratio = cRaw > dRaw ? (raw - dRaw) / (cRaw - dRaw) : 0;
    return Math.round((dUMS + ratio * (cUMS - dUMS)) * 10) / 10;
  }
  // E~D
  if (eRaw && raw >= eRaw && dRaw) {
    const ratio = dRaw > eRaw ? (raw - eRaw) / (dRaw - eRaw) : 0;
    return Math.round((eUMS + ratio * (dUMS - eUMS)) * 10) / 10;
  }
  // Below E
  if (eRaw && eRaw > 0) {
    return Math.round(Math.max(0, (raw / eRaw) * eUMS) * 10) / 10;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GCSE Normalized Score (GNS) for 9-1 GCSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate GNS (GCSE Normalized Score) for 9-1 GCSE boards.
 * Engineering approximation for cross-year practice.
 */
export function calculateGNS(
  raw: number,
  maxMark: number,
  boundaries: Record<string, number> | undefined
): number {
  if (maxMark <= 0) return 0;
  if (raw <= 0) return 0;
  if (raw >= maxMark) return 100;
  if (!boundaries) return Math.round((raw / maxMark) * 100 * 10) / 10;

  // Try 9-1 boundaries
  const grades = ["grade9", "grade8", "grade7", "grade6", "grade5", "grade4", "grade3", "grade2", "grade1"];
  const available = grades
    .map(g => ({ grade: g, threshold: boundaries[g] }))
    .filter((v): v is { grade: string; threshold: number } => v.threshold !== undefined && v.threshold > 0);

  if (available.length === 0) return Math.round((raw / maxMark) * 100 * 10) / 10;

  // Check each grade band from highest to lowest
  for (let i = 0; i < available.length; i++) {
    const { grade, threshold } = available[i];
    const upper = i === 0 ? maxMark : available[i - 1].threshold;
    const gradeNum = parseInt(grade.replace("grade", ""));
    const baseScore = gradeNum * 10;

    if (raw >= threshold) {
      const range = upper > threshold ? upper - threshold : maxMark - threshold;
      const ratio = range > 0 ? (raw - threshold) / range : 0;
      return Math.min(100, Math.round((baseScore + ratio * 10) * 10) / 10);
    }
  }

  // Below lowest grade
  const lowest = available[available.length - 1];
  if (lowest && lowest.threshold > 0) {
    return Math.round(Math.max(0, (raw / lowest.threshold) * 10) * 10) / 10;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. A* Determination
// ─────────────────────────────────────────────────────────────────────────────

interface AStarParams {
  boardKey: string;
  subjectCode: string;
  papers: PaperResult[];
  totalNormalized: number;
}

/**
 * Check A* eligibility per board-specific rules.
 */
export function checkAStar(params: AStarParams): AStarCheck | null {
  const { boardKey, subjectCode, papers, totalNormalized } = params;

  // CAIE A-Level: total PUM >= 90 AND A2 weighted PUM >= 90
  if (boardKey === "CAIE-AL") {
    const a2Papers = papers.filter(p => p.asA2Tag === "A2");
    const asPapers = papers.filter(p => p.asA2Tag === "AS");

    if (a2Papers.length === 0 && asPapers.length === 0) {
      return null;
    }

    const a2PUM = a2Papers.length > 0
      ? a2Papers.reduce((s, p) => s + p.normalizedScore, 0) / a2Papers.length
      : 0;

    const totalMet = totalNormalized >= 90;
    const a2Met = a2PUM >= 90;
    const eligible = totalMet && a2Met;

    return {
      eligible,
      totalMet,
      a2Met,
      totalThreshold: 90,
      a2Threshold: 90,
      details: [
        `总 PUM: ${totalNormalized.toFixed(1)} (需 ≥ 90) ${totalMet ? "✅" : "❌"}`,
        `A2 平均 PUM: ${a2PUM.toFixed(1)} (需 ≥ 90) ${a2Met ? "✅" : "❌"}`,
        ...(eligible ? ["满足 CAIE A* 条件 ✅"] : ["未达到 CAIE A* 条件 ❌"]),
      ],
    };
  }

  // Edexcel IAL (with award-rule configuration)
  if (boardKey === "Edexcel-AL") {
    const rule = getAwardRule(subjectCode);
    if (rule) {
      // Use configured award rule
      const totalMax = getTotalMaxUMS(rule);
      const a2Max = getA2MaxUMS(rule);
      const aThreshold = getAThresholdUMS(rule);
      const a2Threshold = getAStarA2ThresholdUMS(rule);

      // A2 papers: use getASA2Tag (handles descriptive component names like "Mathematics: Pure Maths P3 (New)")
      // Do NOT use rule.a2Components.includes(p.component) — component values are descriptive labels, not short codes
      const a2Papers = papers.filter(p => getASA2Tag(boardKey, subjectCode, p.component) === "A2");
      const a2UMS = a2Papers.reduce((s, p) => s + p.normalizedScore, 0);

      const totalMet = totalNormalized >= aThreshold;
      const a2Met = a2Papers.length === 0 ? false : a2UMS >= a2Threshold;

      // Math special rule: Core 34 (P3+P4) >= 180
      // Detect P3/P4 by checking component label patterns (unit codes WMA13/WMA14 or descriptive names)
      if (rule.mathCore34Threshold && rule.mathCore34Threshold > 0) {
        const p3p4 = papers
          .filter(p => /\bP3\b|\bWMA13\b|\bPure Maths P3\b/.test(p.component) || /\bP4\b|\bWMA14\b|\bPure Maths P4\b/.test(p.component))
          .reduce((s, p) => s + p.normalizedScore, 0);
        const core34Met = p3p4 >= rule.mathCore34Threshold;
        const eligible = totalMet && core34Met;
        return {
          eligible,
          totalMet,
          a2Met: core34Met,
          totalThreshold: aThreshold,
          a2Threshold: rule.mathCore34Threshold,
          details: [
            `总 UMS: ${totalNormalized.toFixed(0)} / ${totalMax} (A 需 ≥ ${aThreshold}) ${totalMet ? "✅" : "❌"}`,
            `Core 34 (P3+P4) UMS: ${p3p4.toFixed(0)} (需 ≥ ${rule.mathCore34Threshold}) ${core34Met ? "✅" : "❌"}`,
            ...(eligible ? ["满足 Edexcel 数学 A* 条件 ✅"] : ["未达到 A* 条件 ❌"]),
          ],
        };
      }

      const eligible = totalMet && a2Met;
      return {
        eligible,
        totalMet,
        a2Met,
        totalThreshold: aThreshold,
        a2Threshold: a2Threshold,
        details: [
          `总 UMS: ${totalNormalized.toFixed(0)} / ${totalMax} (A 需 ≥ ${aThreshold}) ${totalMet ? "✅" : "❌"}`,
          `A2 UMS: ${a2UMS.toFixed(0)} / ${a2Max} (需 ≥ ${a2Threshold}) ${a2Met ? "✅" : "❌"}`,
          ...(eligible ? ["满足 Edexcel A* 条件 ✅"] : ["未达到 A* 条件 ❌"]),
        ],
      };
    }

    // Fallback: legacy heuristic (no award rule configured)
    const is6Unit = papers.length >= 5;
    const totalMax = is6Unit ? 600 : 400;
    const aThreshold = totalMax * 0.8;
    const a2Max = is6Unit ? 300 : 200;
    const a2Threshold = a2Max * 0.9;

    const a2Papers = papers.filter(p => p.asA2Tag === "A2");
    const a2UMS = a2Papers.reduce((s, p) => s + p.normalizedScore, 0);

    const totalMet = totalNormalized >= aThreshold;
    const a2Met = a2Papers.length === 0 ? false : a2UMS >= a2Threshold;

    const eligible = totalMet && a2Met;
    return {
      eligible,
      totalMet,
      a2Met,
      totalThreshold: aThreshold,
      a2Threshold: a2Threshold,
      details: [
        `总 UMS: ${totalNormalized.toFixed(0)} / ${totalMax} (A 需 ≥ ${aThreshold}) ${totalMet ? "✅" : "❌"}`,
        `A2 UMS: ${a2UMS.toFixed(0)} / ${a2Max} (需 ≥ ${a2Threshold}) ${a2Met ? "✅" : "❌"}`,
        ...(eligible ? ["满足 Edexcel A* 条件 ✅"] : ["未达到 A* 条件 ❌"]),
      ],
    };
  }

  // AQA A-Level
  if (boardKey === "AQA-AL") {
    const a2Papers = papers.filter(p => p.asA2Tag === "A2");
    const totalMax = 400;
    const aThreshold = totalMax * 0.8;
    const a2Max = 200; // AQA A2: 2 units × 100 UMS = 200
    const a2Threshold = a2Max * 0.9; // 180
    const a2UMS = a2Papers.reduce((s, p) => s + p.normalizedScore, 0);

    const totalMet = totalNormalized >= aThreshold;
    const a2Met = a2Papers.length === 0 ? false : a2UMS >= a2Threshold;
    const eligible = totalMet && a2Met;

    return {
      eligible,
      totalMet,
      a2Met,
      totalThreshold: aThreshold,
      a2Threshold,
      details: [
        `总 UMS: ${totalNormalized.toFixed(0)} / ${totalMax} (A 需 ≥ ${aThreshold}) ${totalMet ? "✅" : "❌"}`,
        `A2 UMS: ${a2UMS.toFixed(0)} / ${a2Max} (需 ≥ ${a2Threshold}) ${a2Met ? "✅" : "❌"}`,
        ...(eligible ? ["满足 AQA A* 条件 ✅"] : ["未达到 A* 条件 ❌"]),
      ],
    };
  }

  // OCR A-Level
  if (boardKey === "OCR-AL") {
    const a2Papers = papers.filter(p => p.asA2Tag === "A2");
    const totalMax = 400;
    const aThreshold = totalMax * 0.8;
    const a2Max = 200;
    const a2Threshold = a2Max * 0.9;
    const a2UMS = a2Papers.reduce((s, p) => s + p.normalizedScore, 0);

    const totalMet = totalNormalized >= aThreshold;
    const a2Met = a2Papers.length === 0 ? false : a2UMS >= a2Threshold;
    const eligible = totalMet && a2Met;

    return {
      eligible,
      totalMet,
      a2Met,
      totalThreshold: aThreshold,
      a2Threshold,
      details: [
        `总 UMS: ${totalNormalized.toFixed(0)} / ${totalMax} (A 需 ≥ ${aThreshold}) ${totalMet ? "✅" : "❌"}`,
        `A2 UMS: ${a2UMS.toFixed(0)} / ${a2Max} (需 ≥ ${a2Threshold}) ${a2Met ? "✅" : "❌"}`,
        ...(eligible ? ["满足 OCR A* 条件 ✅"] : ["未达到 A* 条件 ❌"]),
      ],
    };
  }

  return null;
}

/** Heuristic: determine if a unit/component is A2 level */
// ─────────────────────────────────────────────────────────────────────────────
// 6. Precision Assessment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assess calculation precision based on year span and syllabus consistency.
 */
export function calculatePrecision(papers: { series: string; syllabusVersion?: string }[]): PrecisionRating {
  const years = papers.map(p => {
    const match = p.series.match(/(\d{4})/);
    return match ? parseInt(match[1]) : new Date().getFullYear();
  }).filter(y => y > 2000);

  if (years.length === 0) {
    return { stars: "★★★★★", level: "最高", description: "精度无法评估" };
  }

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const span = maxYear - minYear;

  // Check for syllabus version differences
  const versions = papers.map(p => p.syllabusVersion).filter(Boolean);
  const hasVersionDiff = versions.length > 1 && new Set(versions).size > 1;

  if (span === 0) {
    return { stars: "★★★★★", level: "最高", description: "所有 Paper 来自同一考季，等同于官方合分逻辑" };
  }
  if (span <= 1) {
    return { stars: "★★★★★", level: "最高", description: "Paper 来自相邻考季，PUM/UMS 完全支持跨考季" };
  }
  if (span <= 3 && !hasVersionDiff) {
    return { stars: "★★★★☆", level: "高", description: "±3 年内且同考纲，PUM 高度可比" };
  }
  if (span <= 5 && !hasVersionDiff) {
    return { stars: "★★★★☆", level: "较高", description: "±5 年且同考纲，考纲可能有小幅调整" };
  }
  if (hasVersionDiff && span <= 5) {
    return { stars: "★★★☆☆", level: "中等", description: "跨考纲版本，PUM 提供近似参照但非精确等值" };
  }
  if (span <= 7) {
    return { stars: "★★☆☆☆", level: "有限", description: "时间跨度较大，教育标准可能有差异，结果仅供参考" };
  }
  return { stars: "★☆☆☆☆", level: "低", description: "跨度过大（10年+），仅具参考意义，建议优先使用近年试卷" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Main Calculation Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export interface CalcOptions {
  boardKey: string;
  subjectCode: string;
  papers: PaperInput[];
  useWeighting: boolean;
  targetGradeScale: string;
  /** Optional callback to check paper selection completeness */
  completenessCheck?: (boardKey: string, subjectCode: string, selectedComponents: string[]) => string | undefined;
}

/**
 * Main entry point: run full grade calculation.
 */
export function runGradeCalculation(options: CalcOptions): CalculationOutput {
  const { boardKey, subjectCode, papers, useWeighting, completenessCheck } = options;

  if (papers.length === 0) {
    return {
      papers: [], totalNormalized: 0, maxNormalized: 0, percentage: 0,
      predictedGrade: "U", gradeResults: [], aStarCheck: null,
      precision: { stars: "★★★★★", level: "最高", description: "精度无法评估" },
      nextGradeGap: null, totalScore: 0, maxTotal: 0,
    };
  }

  const isCAIE = boardKey.startsWith("CAIE");
  const isAL = boardKey.includes("AL");

  // Step 1: Calculate normalized scores per paper
  let totalScore = 0;
  let maxTotal = 0;

  const results: PaperResult[] = papers.map(p => {
    const percentage = p.maxMark > 0 ? (p.score / p.maxMark) * 100 : 0;
    let normalizedScore: number;
    let scoreType: PaperResult["scoreType"];

    totalScore += p.score;
    maxTotal += p.maxMark;

    if (isCAIE) {
      const hasAStar = !isAL;
      normalizedScore = calculateCAIEPUM(p.score, p.maxMark, p.boundaries, hasAStar);
      scoreType = "PUM";
    } else if (isAL) {
      normalizedScore = calculateUMS(p.score, p.maxMark, p.boundaries);
      scoreType = "UMS";
    } else if (boardKey.includes("GCSE") && !isCAIE) {
      normalizedScore = calculateGNS(p.score, p.maxMark, p.boundaries);
      scoreType = "GNS";
    } else {
      normalizedScore = percentage;
      scoreType = "RAW";
    }

    const asA2Tag = getASA2Tag(boardKey, subjectCode, p.component);
    const syllabusVersion = detectSyllabusVersion(boardKey, subjectCode, p.component, p.series);

    return {
      ...p,
      percentage: Math.round(percentage * 10) / 10,
      normalizedScore: Math.round(normalizedScore * 10) / 10,
      scoreType,
      asA2Tag,
      syllabusVersion,
    };
  });

  // Step 2: Weighted aggregation
  let totalNormalized = 0;
  let maxNormalized = 0;

  if (boardKey === "CAIE-AL" && useWeighting) {
    // CAIE A-Level: apply weighting factors, then normalize to 100 scale
    let totalWeighted = 0;
    let totalWeight = 0;
    for (const r of results) {
      const w = getPaperWeight(boardKey, subjectCode, r.component);
      const effectiveWeight = w > 0 ? w : 1;
      totalWeighted += r.normalizedScore * effectiveWeight;
      totalWeight += effectiveWeight;
    }
    totalNormalized = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    maxNormalized = 100;
  } else if (isAL && !isCAIE) {
    // UMS: sum of all units
    totalNormalized = results.reduce((s, r) => s + r.normalizedScore, 0);
    maxNormalized = results.length * 100;
  } else {
    // PUM/GNS: average across papers
    totalNormalized = results.reduce((s, r) => s + r.normalizedScore, 0) / results.length;
    maxNormalized = 100;
  }

  totalNormalized = Math.round(totalNormalized * 10) / 10;
  const percentage = maxNormalized > 0
    ? Math.round((totalNormalized / maxNormalized) * 1000) / 10
    : 0;

  // Step 3: Grade mapping
  // For non-CAIE A-Level, use normalized percentage (0-100) instead of raw UMS sum
  const gradeInput = (isAL && !isCAIE)
    ? percentage
    : totalNormalized;
  const { predictedGrade, gradeResults, nextGradeGap } = mapGrade(
    boardKey,
    gradeInput,
  );

  // Step 4: A* check
  const aStarCheck = isAL
    ? checkAStar({ boardKey, subjectCode, papers: results, totalNormalized })
    : null;

  // Override predicted grade with A* if eligible
  const finalPredictedGrade = aStarCheck?.eligible ? "A*" : predictedGrade;

  // Step 5: Precision
  const precision = calculatePrecision(
    results.map(r => ({ series: r.series, syllabusVersion: r.syllabusVersion }))
  );

  // Step 6: Extra metrics
  const pumValues = results
    .filter(r => r.scoreType === "PUM")
    .map(r => r.normalizedScore);
  const avgPum = pumValues.length > 0
    ? Math.round((pumValues.reduce((a, b) => a + b, 0) / pumValues.length) * 10) / 10
    : undefined;

  // Step 7: Completeness check
  const completenessWarning = completenessCheck
    ? completenessCheck(boardKey, subjectCode, papers.map(p => p.component))
    : undefined;

  return {
    papers: results,
    totalNormalized,
    maxNormalized,
    percentage,
    predictedGrade: finalPredictedGrade,
    gradeResults,
    aStarCheck,
    precision,
    nextGradeGap,
    avgPum,
    totalScore: Math.round(totalScore * 10) / 10,
    maxTotal,
    completenessWarning,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Grade Mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapGrade(
  boardKey: string,
  totalNormalized: number,
): {
  predictedGrade: string;
  gradeResults: GradeBoundaryResult[];
  nextGradeGap: number | null;
} {
  const gradeResults: GradeBoundaryResult[] = [];
  let predictedGrade = "U";
  let nextGradeGap: number | null = null;

  if (boardKey.startsWith("CAIE") && !boardKey.includes("AL")) {
    const scale = [
      { label: "A*", threshold: 90 }, { label: "A", threshold: 80 },
      { label: "B", threshold: 70 }, { label: "C", threshold: 60 },
      { label: "D", threshold: 50 }, { label: "E", threshold: 40 },
      { label: "F", threshold: 30 }, { label: "G", threshold: 20 },
    ];
    for (const g of scale) {
      gradeResults.push({ gradeLabel: g.label, requiredTotal: g.threshold, achieved: totalNormalized >= g.threshold, gap: Math.round((totalNormalized - g.threshold) * 10) / 10 });
    }
    for (const g of scale) {
      if (totalNormalized >= g.threshold) { predictedGrade = g.label; break; }
    }
    const next = scale.find(g => totalNormalized < g.threshold);
    nextGradeGap = next ? Math.ceil(next.threshold - totalNormalized) : null;
  } else if (boardKey.includes("AL")) {
    const scale = [
      { label: "A*", threshold: 90 }, { label: "A", threshold: 80 },
      { label: "B", threshold: 70 }, { label: "C", threshold: 60 },
      { label: "D", threshold: 50 }, { label: "E", threshold: 40 },
    ];
    for (const g of scale) {
      gradeResults.push({ gradeLabel: g.label, requiredTotal: g.threshold, achieved: totalNormalized >= g.threshold, gap: Math.round((totalNormalized - g.threshold) * 10) / 10 });
    }
    for (const g of scale) {
      if (totalNormalized >= g.threshold) { predictedGrade = g.label; break; }
    }
    const next = scale.find(g => totalNormalized < g.threshold);
    nextGradeGap = next ? Math.ceil(next.threshold - totalNormalized) : null;
  } else {
    const scale = [
      { label: "9", threshold: 90 }, { label: "8", threshold: 80 },
      { label: "7", threshold: 70 }, { label: "6", threshold: 60 },
      { label: "5", threshold: 50 }, { label: "4", threshold: 40 },
      { label: "3", threshold: 30 }, { label: "2", threshold: 20 },
      { label: "1", threshold: 10 },
    ];
    for (const g of scale) {
      gradeResults.push({ gradeLabel: g.label, requiredTotal: g.threshold, achieved: totalNormalized >= g.threshold, gap: Math.round((totalNormalized - g.threshold) * 10) / 10 });
    }
    for (const g of scale) {
      if (totalNormalized >= g.threshold) { predictedGrade = g.label; break; }
    }
    const next = scale.find(g => totalNormalized < g.threshold);
    nextGradeGap = next ? Math.ceil(next.threshold - totalNormalized) : null;
  }

  return { predictedGrade, gradeResults, nextGradeGap };
}
