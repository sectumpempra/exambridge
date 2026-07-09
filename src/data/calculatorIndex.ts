/**
 * Calculator Data Index
 * Pre-built indexes for fast (subject, component, series) -> record lookups
 */

import caieJson from "./caie.json";
import edexcelJson from "./edexcel.json";
import ocrJson from "./ocr.json";
import aqaJson from "./aqa.json";
import edexcelALJson from "./edexcel_al.json";
import cieALJson from "./caie_al.json";
import ocrALJson from "./ocr_al.json";
import aqaALJson from "./aqa_al.json";
import subjectsConfig from "./subjects_config.json";
import { getSubjectCategory, type SubjectCategory } from "./examDates";

// ── Subject name overrides for board-specific code prefixes ──────────
const SUBJECT_NAME_OVERRIDES: Record<string, Record<string, string>> = {
  "Edexcel-AL": {
    WMA: "Mathematics", WFM: "Further Mathematics", WME: "Mechanics",
    WST: "Statistics", WDM: "Decision Mathematics",
    WPH: "Physics", WCH: "Chemistry", WBI: "Biology",
    WEC: "Economics", WBS: "Business", WPS: "Psychology",
    WGE: "Geography", WEN: "English Language", WET: "English Literature",
    WHI: "History", WIT: "Information Technology",
    WAC: "Accounting", WAA: "Arabic", WFR: "French",
    WGK: "Greek", WGN: "German", WSP: "Spanish", YLA: "Law",
  },
  "OCR-AL": {
    H240: "Mathematics", H245: "Further Mathematics",
    H420: "Biology", H422: "Chemistry B (Salters)", H432: "Chemistry A",
    H556: "Physics A", H557: "Physics B",
    H567: "Psychology",
    H404: "Design Engineering", H405: "Fashion & Textiles", H406: "Product Design",
    H407: "Ancient History", H408: "Classical Civilisation",
    H409: "Media Studies", H410: "Film Studies",
    H414: "Geology", H415: "Law", H418: "Law (New)",
    H431: "Biology B", H433: "Chemistry B",
    H443: "Computer Science", H444: "Computer Science", H446: "Computer Science",
    H459: "Classics", H460: "Classical Heritage",
    H470: "English Language", H472: "English Literature",
    H474: "English Lang & Lit",
    H481: "Geography", H543: "History",
    H555: "Religious Studies", H573: "Religious Studies (New)",
    H580: "Sociology",
    H600: "Arabic", H601: "Chinese", H602: "French",
    H603: "German", H604: "Italian", H605: "Spanish", H606: "Turkish",
    H640: "French (New)",
  },
};

// ── Grade field configuration per board ──────────────────────────────
export interface BoardGradeConfig {
  labels: string[];   // e.g. ["A*","A","B",...]
  fields: string[];   // e.g. ["a_star","a","b",...] (keys in record)
}

export const BOARD_GRADE_CONFIG: Record<string, BoardGradeConfig> = {
  "CAIE-GCSE": {
    labels: ["A*", "A", "B", "C", "D", "E", "F", "G"],
    fields: ["a_star", "a", "b", "c", "d", "e", "f", "g"],
  },
  "Edexcel-GCSE": {
    labels: ["9", "8", "7", "6", "5", "4", "3", "2", "1"],
    fields: ["grade9", "grade8", "grade7", "grade6", "grade5", "grade4", "grade3", "grade2", "grade1"],
  },
  "OCR-GCSE": {
    labels: ["9", "8", "7", "6", "5", "4", "3", "2", "1"],
    fields: ["grade9", "grade8", "grade7", "grade6", "grade5", "grade4", "grade3", "grade2", "grade1"],
  },
  "AQA-GCSE": {
    labels: ["9", "8", "7", "6", "5", "4", "3", "2", "1"],
    fields: ["grade9", "grade8", "grade7", "grade6", "grade5", "grade4", "grade3", "grade2", "grade1"],
  },
  "Edexcel-AL": {
    labels: ["A*", "A", "B", "C", "D", "E"],
    fields: ["a_star", "a", "b", "c", "d", "e"],
  },
  "CAIE-AL": {
    labels: ["A", "B", "C", "D", "E"],
    fields: ["a", "b", "c", "d", "e"],
  },
  "OCR-AL": {
    labels: ["A*", "A", "B", "C", "D", "E"],
    fields: ["a_star", "a", "b", "c", "d", "e"],
  },
  "AQA-AL": {
    labels: ["A*", "A", "B", "C", "D", "E"],
    fields: ["a_star", "a", "b", "c", "d", "e"],
  },
};

// ── Board metadata ───────────────────────────────────────────────────
export interface BoardMeta {
  key: string;
  name: string;
  level: string;
  dataKey: string;
  codeField: string;
  compField: string;
  seriesField: string;
  maxMarkField: string;
  gradeConfig: BoardGradeConfig;
  // Field name remapping from data file -> canonical form
  fieldMap: Record<string, string>;
  // Fallback fields for building series from year+session (for boards without a single series field)
  yearField?: string;
  sessionFieldAlt?: string;
}

export const BOARD_META: Record<string, BoardMeta> = {
  "CAIE-GCSE": {
    key: "CAIE-GCSE",
    name: "CAIE",
    level: "GCSE",
    dataKey: "caie",
    codeField: "subjectCode",
    compField: "component",
    seriesField: "series",
    maxMarkField: "maxMark",
    gradeConfig: BOARD_GRADE_CONFIG["CAIE-GCSE"],
    fieldMap: { a_star: "a_star", a: "a", b: "b", c: "c", d: "d", e: "e", f: "f", g: "g" },
  },
  "Edexcel-GCSE": {
    key: "Edexcel-GCSE",
    name: "Edexcel",
    level: "GCSE",
    dataKey: "edexcel",
    codeField: "code",
    compField: "unit",
    seriesField: "series",
    maxMarkField: "maxMark",
    gradeConfig: BOARD_GRADE_CONFIG["Edexcel-GCSE"],
    fieldMap: { grade9: "grade9", grade8: "grade8", grade7: "grade7", grade6: "grade6", grade5: "grade5", grade4: "grade4", grade3: "grade3", grade2: "grade2", grade1: "grade1" },
    yearField: "year",
    sessionFieldAlt: "session",
  },
  "OCR-GCSE": {
    key: "OCR-GCSE",
    name: "OCR",
    level: "GCSE",
    dataKey: "ocr",
    codeField: "code",
    compField: "component",
    seriesField: "series",
    maxMarkField: "maxMark",
    gradeConfig: BOARD_GRADE_CONFIG["OCR-GCSE"],
    fieldMap: { grade9: "grade9", grade8: "grade8", grade7: "grade7", grade6: "grade6", grade5: "grade5", grade4: "grade4", grade3: "grade3", grade2: "grade2", grade1: "grade1" },
    yearField: "year",
    sessionFieldAlt: "session",
  },
  "AQA-GCSE": {
    key: "AQA-GCSE",
    name: "AQA",
    level: "GCSE",
    dataKey: "aqa",
    codeField: "code",
    compField: "subject",
    seriesField: "series",
    maxMarkField: "maxMark",
    gradeConfig: BOARD_GRADE_CONFIG["AQA-GCSE"],
    fieldMap: { grade9: "grade9", grade8: "grade8", grade7: "grade7", grade6: "grade6", grade5: "grade5", grade4: "grade4", grade3: "grade3", grade2: "grade2", grade1: "grade1" },
    yearField: "year",
    sessionFieldAlt: "session",
  },
  "Edexcel-AL": {
    key: "Edexcel-AL",
    name: "Edexcel",
    level: "A-Level",
    dataKey: "edexcel_al",
    codeField: "code",
    compField: "unit",
    seriesField: "series",
    maxMarkField: "max_mark",
    gradeConfig: BOARD_GRADE_CONFIG["Edexcel-AL"],
    fieldMap: { a_star: "a*", a: "a", b: "b", c: "c", d: "d", e: "e" },
    yearField: "year",
    sessionFieldAlt: "session",
  },
  "CAIE-AL": {
    key: "CAIE-AL",
    name: "CAIE",
    level: "A-Level",
    dataKey: "caie_al",
    codeField: "SubjectCode",
    compField: "Component",
    seriesField: "Series",
    maxMarkField: "MaxRawMark",
    gradeConfig: BOARD_GRADE_CONFIG["CAIE-AL"],
    fieldMap: { a: "A", b: "B", c: "C", d: "D", e: "E" },
  },
  "OCR-AL": {
    key: "OCR-AL",
    name: "OCR",
    level: "A-Level",
    dataKey: "ocr_al",
    codeField: "code",
    compField: "component",
    seriesField: "series",
    maxMarkField: "max_mark",
    gradeConfig: BOARD_GRADE_CONFIG["OCR-AL"],
    yearField: "year",
    sessionFieldAlt: "session",
    fieldMap: { a_star: "a*", a: "a", b: "b", c: "c", d: "d", e: "e" },
  },
  "AQA-AL": {
    key: "AQA-AL",
    name: "AQA",
    level: "A-Level",
    dataKey: "aqa_al",
    codeField: "code",
    compField: "unit",
    seriesField: "series",
    maxMarkField: "max_mark",
    gradeConfig: BOARD_GRADE_CONFIG["AQA-AL"],
    fieldMap: { a_star: "a_star", a: "a", b: "b", c: "c", d: "d", e: "e" },
    yearField: "year",
    sessionFieldAlt: "session",
  },
};

// ── Subject config type ──────────────────────────────────────────────
export interface SubjectConfig {
  board: string;
  level: string;
  code: string;
  name: string;
  components: Record<string, { maxMark: number; label: string }>;
  gradeSystem: string;
  grades: string[];
  aggregation: string;
}

// ── Build lookup indexes ─────────────────────────────────────────────

/** P1-3: Removed COMPONENT_REMAP for OCR 6993.
 *  Previously Y533/Y534/Y535 were remapped to "01", causing:
 *  - Y533 (maxMark 60) and Y534 (maxMark 40) to conflict under "01"
 *  - config says 01 maxMark=100, but merge kept 60
 *  Y533/Y534 now stay as independent components; config update needed to expose them.
 */
function remapComponent(_code: string, component: string): string {
  return component;
}

/**
 * Canonicalize Edexcel GCSE component names.
 * Removes leading zeros from paper numbers to avoid duplicates:
 *   "Mathematics Paper 01H" → "Mathematics Paper 1H"
 *   "Mathematics Paper 01HR" → "Mathematics Paper 1HR"
 */
function canonicalizeEdexcelGCSEComp(code: string, component: string): string {
  // Only apply to known GCSE math codes with leading-zero issues
  const mathCodes = ["4MA1", "4PM1", "1MA1"];
  if (!mathCodes.includes(code)) return component;

  return component.replace(/Paper\s+0+(\d)/, "Paper $1");
}

/** Per-subject component aliases: raw data unit name → canonical config ID */
const COMPONENT_ALIASES: Record<string, Record<string, string>> = {
  // Edexcel GCSE: short ID configs
  "1MA1": { "Mathematics Paper 1F": "P1F", "Mathematics Paper 2F": "P2F", "Mathematics Paper 1H": "P1H", "Mathematics Paper 2H": "P2H", "Mathematics Paper 3F": "P3F", "Mathematics Paper 3H": "P3H" },
  "1EN0": { "English Language Paper 1": "P1", "English Language Paper 2": "P2" },
  "1ET0": { "English Literature Paper 1": "P1", "English Literature Paper 2": "P2" },
  "1BI0": { "Biology Paper 1F": "P1F", "Biology Paper 1H": "P1H", "Biology Paper 2F": "P2F" },
  "1CH0": { "Chemistry Paper 1F": "P1F", "Chemistry Paper 1H": "P1H", "Chemistry Paper 2F": "P2F" },
  "1PH0": { "Physics Paper 1F": "P1F", "Physics Paper 1H": "P1H", "Physics Paper 2F": "P2F" },
};

/**
 * Normalize raw-data component names to canonical config IDs.
 * Uses per-subject aliases first, then falls back to pattern matching.
 */
function normalizeComponent(boardKey: string, code: string, comp: string): string {
  // 1. Per-subject aliases (Edexcel GCSE short IDs)
  const aliases = COMPONENT_ALIASES[code];
  if (aliases && aliases[comp]) return aliases[comp];

  // 2. AQA-GCSE: "Mathematics Paper 1F" → "P1F"
  if (boardKey === "AQA-GCSE") {
    const m = comp.match(/Paper\s+(\d[A-Za-z]*)/);
    if (m) return `P${m[1]}`;
  }

  return comp;
}

/** Single variant record */
export type VariantRecord = Record<string, string | number>;

/** component -> series -> VariantRecord[] */
export interface SubjectIndex {
  [component: string]: {
    [series: string]: VariantRecord[];
  };
}

/** dataKey -> subjectCode -> SubjectIndex */
export interface DataIndex {
  [dataKey: string]: {
    [subjectCode: string]: SubjectIndex;
  };
}

function buildIndex(records: VariantRecord[], meta: BoardMeta): Record<string, SubjectIndex> {
  const idx: Record<string, SubjectIndex> = {};
  for (const r of records) {
    const code = String(r[meta.codeField] ?? "");
    let comp = String(r[meta.compField] ?? "");
    let series = String(r[meta.seriesField] ?? "").trim();
    // Fallback: if no series field, combine year + session
    if (!series && meta.yearField && meta.sessionFieldAlt) {
      const year = String(r[meta.yearField] ?? "").trim();
      const session = String(r[meta.sessionFieldAlt] ?? "").trim();
      if (year && session) {
        series = `${session}-${year}`;
      }
    }
    if (!code || !comp || !series) continue;
    // Apply component remapping (e.g. OCR 6993 Y533→01)
    comp = remapComponent(code, comp);
    // Canonicalize Edexcel GCSE component names (remove leading zeros)
    comp = canonicalizeEdexcelGCSEComp(code, comp);
    // Normalize to canonical config IDs (e.g. "Mathematics Paper 1F" → "P1F")
    comp = normalizeComponent(meta.key, code, comp);
    if (!idx[code]) idx[code] = {};
    if (!idx[code][comp]) idx[code][comp] = {};
    if (!idx[code][comp][series]) idx[code][comp][series] = [];
    idx[code][comp][series].push(r);
  }

  // P0-1: Warn on conflicting duplicates (same code/comp/series but different boundaries)
  for (const [code, compMap] of Object.entries(idx)) {
    for (const [comp, seriesMap] of Object.entries(compMap)) {
      for (const [series, variants] of Object.entries(seriesMap)) {
        if (variants.length > 1) {
          // Check if boundaries differ
          const firstMarks = JSON.stringify(meta.gradeConfig.fields.map(f => variants[0][f]));
          const hasDiff = variants.some(v => JSON.stringify(meta.gradeConfig.fields.map(f => v[f])) !== firstMarks);
          if (hasDiff) {
            console.warn(`[calculatorIndex] Conflicting duplicates: ${meta.key}/${code}/${comp}/${series} has ${variants.length} variants with different boundaries. Using first variant.`);
          }
        }
      }
    }
  }

  return idx;
}

// Build all indexes
export const DATA_INDEX: DataIndex = {
  caie: buildIndex(caieJson as Record<string, string | number>[], BOARD_META["CAIE-GCSE"]),
  edexcel: buildIndex(edexcelJson as Record<string, string | number>[], BOARD_META["Edexcel-GCSE"]),
  ocr: buildIndex(ocrJson as Record<string, string | number>[], BOARD_META["OCR-GCSE"]),
  aqa: buildIndex(aqaJson as Record<string, string | number>[], BOARD_META["AQA-GCSE"]),
  edexcel_al: buildIndex(edexcelALJson as Record<string, string | number>[], BOARD_META["Edexcel-AL"]),
  caie_al: buildIndex(cieALJson as Record<string, string | number>[], BOARD_META["CAIE-AL"]),
  ocr_al: buildIndex(ocrALJson as Record<string, string | number>[], BOARD_META["OCR-AL"]),
  aqa_al: buildIndex(aqaALJson as Record<string, string | number>[], BOARD_META["AQA-AL"]),
};

// Subject config as typed record
export const SUBJECTS_CONFIG = subjectsConfig as Record<string, SubjectConfig>;

// ── Edexcel AL Merged Subject Groupings ─────────────────────────────
// WMA (Pure) + WME (Mechanics) + WST (Statistics) + WDM (Decision) → Mathematics
const EDEXCEL_AL_MATH_MERGE: Record<string, { name: string; prefixes: string[] }> = {
  // P0-3: WFM removed — YFM01 requires 6 units (FP1-3 + 3 options) but data only has WFM01-03.
  // WMA kept: YMA01 is a valid 4-unit award with WMA11-14.
  "WMA": { name: "Mathematics", prefixes: ["WMA", "WME", "WST", "WDM"] },
};

/** Check if an Edexcel AL subjectCode is a merged math subject */
function isEdexcelALMathMerge(subjectCode: string): boolean {
  return subjectCode in EDEXCEL_AL_MATH_MERGE;
}

/** Get all prefixes for an Edexcel AL merged subject */
function getEdexcelALMergePrefixes(subjectCode: string): string[] {
  return EDEXCEL_AL_MATH_MERGE[subjectCode]?.prefixes ?? [subjectCode];
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Get available years/series for a component, sorted newest first */
export function getAvailableSeries(
  boardKey: string,
  subjectCode: string,
  component: string
): string[] {
  const meta = BOARD_META[boardKey];
  if (!meta) return [];
  const idx = DATA_INDEX[meta.dataKey];
  if (!idx) return [];

  // Edexcel AL: subjectCode may be a 3-letter prefix, merge series from all matching codes
  // Supports merged subjects: "WMA" → search WMA + WME + WST + WDM codes
  if (boardKey === "Edexcel-AL" && subjectCode.length === 3) {
    const searchPrefixes = isEdexcelALMathMerge(subjectCode)
      ? getEdexcelALMergePrefixes(subjectCode)
      : [subjectCode];
    const allSeries = new Set<string>();
    for (const sp of searchPrefixes) {
      for (const [code, compMap] of Object.entries(idx)) {
        if (code.startsWith(sp) && compMap?.[component]) {
          Object.keys(compMap[component]).forEach(s => allSeries.add(s));
        }
      }
    }
    if (allSeries.size === 0) return [];
    return Array.from(allSeries).sort((a, b) => {
      const yearA = parseInt(a.match(/\d{4}/)?.[0] ?? "0");
      const yearB = parseInt(b.match(/\d{4}/)?.[0] ?? "0");
      if (yearB !== yearA) return yearB - yearA;
      return b.localeCompare(a);
    });
  }

  const compMap = idx[subjectCode]?.[component];
  if (!compMap) return [];
  return Object.keys(compMap).sort((a, b) => {
    // Sort by year descending (newest first)
    const yearA = parseInt(a.match(/\d{4}/)?.[0] ?? "0");
    const yearB = parseInt(b.match(/\d{4}/)?.[0] ?? "0");
    if (yearB !== yearA) return yearB - yearA;
    return b.localeCompare(a);
  });
}

/** Get first record for specific (board, subject, component, series).
 *  P0-1: Index now stores Record[] per series; this returns the first variant for compatibility. */
export function getRecord(
  boardKey: string,
  subjectCode: string,
  component: string,
  series: string
): Record<string, string | number> | null {
  const variants = getRecordAll(boardKey, subjectCode, component, series);
  return variants.length > 0 ? variants[0] : null;
}

/** Get all record variants for (board, subject, component, series).
 *  P0-1: Returns all variants when duplicates exist. */
export function getRecordAll(
  boardKey: string,
  subjectCode: string,
  component: string,
  series: string
): Record<string, string | number>[] {
  const meta = BOARD_META[boardKey];
  if (!meta) return [];
  const idx = DATA_INDEX[meta.dataKey];
  if (!idx) return [];

  const all: Record<string, string | number>[] = [];

  // Edexcel AL: subjectCode may be a 3-letter prefix, search all matching codes
  if (boardKey === "Edexcel-AL" && subjectCode.length === 3) {
    const searchPrefixes = isEdexcelALMathMerge(subjectCode)
      ? getEdexcelALMergePrefixes(subjectCode)
      : [subjectCode];
    for (const sp of searchPrefixes) {
      for (const [code, compMap] of Object.entries(idx)) {
        if (code.startsWith(sp) && compMap?.[component]?.[series]) {
          all.push(...compMap[component][series]);
        }
      }
    }
    return all;
  }

  return idx[subjectCode]?.[component]?.[series] ?? [];
}

/** Extract max mark from record */
export function getMaxMark(record: Record<string, string | number> | null, meta: BoardMeta): number {
  if (!record) return 0;
  return Number(record[meta.maxMarkField] ?? 0);
}

/** Extract grade boundaries from record */
export function getBoundaries(
  record: Record<string, string | number> | null,
  meta: BoardMeta
): Record<string, number> {
  if (!record) return {};
  const result: Record<string, number> = {};
  // Use fieldMap to translate canonical field -> actual data field
  const fieldMap = meta.fieldMap;
  for (const [canonical, displayLabel] of Object.entries(fieldMap)) {
    const val = Number(record[displayLabel] ?? 0);
    if (val > 0) {
      result[canonical] = val;
    }
  }
  return result;
}

/** Get component label from config */
export function getComponentLabel(boardKey: string, subjectCode: string, component: string): string {
  const prefix = boardKey === "CAIE-GCSE" ? `CAIE-`
    : boardKey === "Edexcel-GCSE" ? `Edexcel-`
    : boardKey === "OCR-GCSE" ? `OCR-`
    : boardKey === "AQA-GCSE" ? `AQA-`
    : boardKey === "Edexcel-AL" ? `EdexcelAL-`
    : boardKey === "CAIE-AL" ? `CAIEAL-`
    : boardKey === "AQA-AL" ? `AQAAL-`
    : boardKey === "OCR-AL" ? `OCRAL-`
    : `${boardKey.split("-")[0]}-`;

  // Edexcel AL: subjectCode may be a 3-letter prefix, search all matching configs
  // Supports merged subjects: "WMA" → search WMA + WME + WST + WDM configs
  if (boardKey === "Edexcel-AL" && subjectCode.length === 3) {
    const searchPrefixes = isEdexcelALMathMerge(subjectCode)
      ? getEdexcelALMergePrefixes(subjectCode)
      : [subjectCode];
    for (const sp of searchPrefixes) {
      for (const [key, cfg] of Object.entries(SUBJECTS_CONFIG)) {
        if (key.startsWith(prefix) && cfg.code.startsWith(sp)) {
          if (cfg.components?.[component]?.label) {
            return cfg.components[component].label;
          }
        }
      }
    }
    return component; // Return component name as-is for descriptive names
  }

  const configKey = `${prefix}${subjectCode}`;
  const cfg = SUBJECTS_CONFIG[configKey];
  if (cfg?.components?.[component]?.label) {
    return cfg.components[component].label;
  }
  return `Paper ${component}`;
}

/** Get subject name from config */
export function getSubjectName(boardKey: string, subjectCode: string): string {
  const prefix = boardKey === "CAIE-GCSE" ? "CAIE"
    : boardKey === "Edexcel-GCSE" ? "Edexcel"
    : boardKey === "OCR-GCSE" ? "OCR"
    : boardKey === "AQA-GCSE" ? "AQA"
    : boardKey === "Edexcel-AL" ? "EdexcelAL"
    : boardKey === "CAIE-AL" ? "CAIEAL"
    : boardKey === "AQA-AL" ? "AQAAL"
    : boardKey === "OCR-AL" ? "OCRAL"
    : boardKey.split("-")[0];

  const configKey = `${prefix}-${subjectCode}`;
  return SUBJECTS_CONFIG[configKey]?.name ?? subjectCode;
}

/** Get all subjects for a board from config, sorted by category (Math→Physics→Chemistry→Econ→Bio→CS→Other) */
export function getSubjectsForBoard(boardKey: string): { code: string; name: string; category: SubjectCategory }[] {
  const prefix = boardKey === "CAIE-GCSE" ? "CAIE-"
    : boardKey === "Edexcel-GCSE" ? "Edexcel-"
    : boardKey === "OCR-GCSE" ? "OCR-"
    : boardKey === "AQA-GCSE" ? "AQA-"
    : boardKey === "Edexcel-AL" ? "EdexcelAL-"
    : boardKey === "CAIE-AL" ? "CAIEAL-"
    : boardKey === "AQA-AL" ? "AQAAL-"
    : boardKey === "OCR-AL" ? "OCRAL-"
    : `${boardKey.split("-")[0]}-`;

  const subjects: { code: string; name: string; category: SubjectCategory }[] = [];
  for (const [key, cfg] of Object.entries(SUBJECTS_CONFIG)) {
    if (key.startsWith(prefix)) {
      subjects.push({ code: cfg.code, name: cfg.name, category: getSubjectCategory(cfg.code) });
    }
  }

  // Deduplicate by code
  const deduped = subjects.filter((s, i, arr) => arr.findIndex(x => x.code === s.code) === i);

  // Apply name overrides and group Edexcel AL by subject prefix
  const overrides = SUBJECT_NAME_OVERRIDES[boardKey];
  if (overrides) {
    if (boardKey === "Edexcel-AL") {
      // Group by merged math subjects (WMA+WME+WST+WDM → Mathematics, WFM → Further Mathematics)
      const grouped = new Map<string, { code: string; name: string; category: SubjectCategory }>();

      // First: add merged math subjects
      for (const [mergeCode, mergeInfo] of Object.entries(EDEXCEL_AL_MATH_MERGE)) {
        grouped.set(mergeCode, {
          code: mergeCode,
          name: mergeInfo.name,
          category: getSubjectCategory(mergeCode),
        });
      }

      // Then: add non-math subjects
      for (const s of deduped) {
        const prefix3 = s.code.substring(0, 3);
        // Skip if this prefix is part of a merged math subject
        const isInMerge = Object.values(EDEXCEL_AL_MATH_MERGE).some(m => m.prefixes.includes(prefix3));
        if (isInMerge) continue;

        const subjectName = overrides[prefix3];
        if (subjectName && !grouped.has(prefix3)) {
          grouped.set(prefix3, { code: prefix3, name: subjectName, category: getSubjectCategory(prefix3) });
        } else if (!subjectName) {
          grouped.set(s.code, s);
        }
      }
      return Array.from(grouped.values()).sort((a, b) => {
        const catOrder: Record<string, number> = { math: 0, physics: 1, chemistry: 2, economics: 3, biology: 4, cs: 5, other: 99 };
        const oa = catOrder[a.category] ?? 99;
        const ob = catOrder[b.category] ?? 99;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      });
    } else {
      // Just override names
      for (const s of deduped) {
        const overrideName = overrides[s.code];
        if (overrideName) s.name = overrideName;
      }
    }
  }

  // Sort by category order, then by code
  const catOrder: Record<string, number> = { math: 0, physics: 1, chemistry: 2, economics: 3, biology: 4, cs: 5, other: 99 };
  return deduped.sort((a, b) => {
    const oa = catOrder[a.category] ?? 99;
    const ob = catOrder[b.category] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.code.localeCompare(b.code);
  });
}

/** Get components for a subject from config */
export function getComponentsForSubject(boardKey: string, subjectCode: string): string[] {
  const prefix = boardKey === "CAIE-GCSE" ? "CAIE-"
    : boardKey === "Edexcel-GCSE" ? "Edexcel-"
    : boardKey === "OCR-GCSE" ? "OCR-"
    : boardKey === "AQA-GCSE" ? "AQA-"
    : boardKey === "Edexcel-AL" ? "EdexcelAL-"
    : boardKey === "CAIE-AL" ? "CAIEAL-"
    : boardKey === "AQA-AL" ? "AQAAL-"
    : boardKey === "OCR-AL" ? "OCRAL-"
    : `${boardKey.split("-")[0]}-`;

  // Edexcel AL: subjectCode is a 3-letter prefix (WMA, WFM, etc.), find all matching configs
  // Supports merged subjects: "WMA" → WMA + WME + WST + WDM components
  if (boardKey === "Edexcel-AL" && subjectCode.length === 3) {
    const searchPrefixes = isEdexcelALMathMerge(subjectCode)
      ? getEdexcelALMergePrefixes(subjectCode)
      : [subjectCode];
    const comps: string[] = [];
    for (const sp of searchPrefixes) {
      for (const [key, cfg] of Object.entries(SUBJECTS_CONFIG)) {
        if (key.startsWith(prefix) && cfg.code.startsWith(sp)) {
          comps.push(...Object.keys(cfg.components));
        }
      }
    }
    return [...new Set(comps)].sort((a, b) => a.localeCompare(b));
  }

  const cfg = SUBJECTS_CONFIG[`${prefix}${subjectCode}`];
  if (!cfg) return [];
  return Object.keys(cfg.components).sort((a, b) => a.localeCompare(b));
}

/** Get grade fields (label + canonical key) for a board */
export function getGradeFields(boardKey: string): { label: string; key: string; fieldKey: string }[] {
  const config = BOARD_GRADE_CONFIG[boardKey];
  if (!config) return [];
  return config.labels.map((label, i) => ({ label, key: config.fields[i], fieldKey: config.fields[i] }));
}

/** Format series name for display */
export function formatSeries(series: string): string {
  // e.g. "s-2024" -> "June 2024", "w-2025" -> "November 2025", "m-2025" -> "March 2025"
  // e.g. "june-2024" -> "June 2024", "november-2025" -> "Nov 2025"
  const parts = series.split("-");
  if (parts.length >= 2) {
    const session = parts[0];
    const year = parts[parts.length - 1];
    const sessionMap: Record<string, string> = {
      s: "June", m: "March", w: "November",
      june: "June", march: "March", november: "November",
      jan: "January", january: "January",
    };
    const sessionName = sessionMap[session.toLowerCase()] || session;
    return `${sessionName} ${year}`;
  }
  return series;
} 