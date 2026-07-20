import type { YearlyStats } from "./resultStatistics";

export type OverviewTopGradeDefinition = {
  label: "A*" | "9" | "D*" | "A";
  rows: Array<Pick<YearlyStats, "year" | "series"> & { rate: number; entries?: number }>;
  sourceUrl: string;
  sourceStatus: "official";
};

export const OFFICIAL_STATISTICS_UNAVAILABLE_MESSAGE = "官方尚未发布，不提供估算";

/** Qualifications whose highest grade does not fit the generic A-star / 9-1 model. */
export const SPECIAL_OVERVIEW_TOP_GRADES: Record<string, OverviewTopGradeDefinition> = {
  "pearson-uk-8ma0": {
    label: "A",
    rows: [{ year: 2025, series: "june", rate: 28.2, entries: 5014 }],
    sourceUrl: "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-statistics/A-level/grade-statistics-june-2025-provisional-advanced-subsidiary-level.pdf",
    sourceStatus: "official",
  },
  "pearson-uk-7m20": {
    label: "D*",
    rows: [{ year: 2025, series: "june", rate: 8.6, entries: 2512 }],
    sourceUrl: "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-statistics/level-2-extended-maths-certificate/grade-statistics-june-2025-provisional-extended-mathematics.pdf",
    sourceStatus: "official",
  },
  "ocr-6993": {
    label: "A",
    rows: [
      { year: 2021, series: "june", rate: 60.59, entries: 5199 },
      { year: 2022, series: "june", rate: 55.2, entries: 5447 },
      { year: 2023, series: "june", rate: 50, entries: 5592 },
      { year: 2024, series: "june", rate: 51.63, entries: 5607 },
      { year: 2025, series: "june", rate: 47.6, entries: 5169 },
    ],
    sourceUrl: "https://www.ocr.org.uk/administration/results-statistics/results-statistics-archive/",
    sourceStatus: "official",
  },
};

export const SPECIAL_OVERVIEW_BOUNDARIES: Record<string, {
  rows: Array<Record<string, string | number>>;
  codeField: string;
  sessionField: string;
  yearField: string;
  maxMarkField: string;
  componentField?: string;
  gradeFields: Array<{ key: string; label: string; color: string }>;
  isCaie?: boolean;
}> = {
  "cambridge-0607": {
    rows: [
      { subjectCode: "0607", component: "12", series: "m-2026", maxMark: 60, c: 42, d: 35, e: 28, f: 20, g: 12 },
      { subjectCode: "0607", component: "22", series: "m-2026", maxMark: 75, a: 60, b: 46, c: 32, d: 25, e: 18 },
      { subjectCode: "0607", component: "32", series: "m-2026", maxMark: 60, c: 40, d: 33, e: 25, f: 18, g: 11 },
      { subjectCode: "0607", component: "42", series: "m-2026", maxMark: 75, a: 57, b: 44, c: 32, d: 26, e: 20 },
      { subjectCode: "0607", component: "52", series: "m-2026", maxMark: 40, c: 28, d: 24, e: 20, f: 16, g: 12 },
      { subjectCode: "0607", component: "62", series: "m-2026", maxMark: 50, a: 38, b: 32, c: 26, d: 22, e: 18 },
      { subjectCode: "0607", component: "Core 12,32,52", series: "m-2026", maxMark: 200, c: 137, d: 114, e: 91, f: 67, g: 43 },
      { subjectCode: "0607", component: "Extended 22,42,62", series: "m-2026", maxMark: 250, "a*": 222, a: 194, b: 152, c: 111, d: 90, e: 69 },
    ],
    codeField: "subjectCode", sessionField: "series", yearField: "series", maxMarkField: "maxMark",
    componentField: "component", isCaie: true,
    gradeFields: [
      { key: "a*", label: "A*", color: "#A9471F" }, { key: "a", label: "A", color: "#526B7E" }, { key: "b", label: "B", color: "#506D58" },
      { key: "c", label: "C", color: "#6E5C40" }, { key: "d", label: "D", color: "#775E55" },
      { key: "e", label: "E", color: "#655A70" }, { key: "f", label: "F", color: "#B5A88A" },
      { key: "g", label: "G", color: "#A0A8A0" },
    ],
  },
  "pearson-uk-7m20": {
    rows: [{ code: "7M20", component: "Overall", session: "June", year: 2025, maxMark: 120, dStar: 98, d: 77, m: 53, p: 29 }],
    codeField: "code", sessionField: "session", yearField: "year", maxMarkField: "maxMark", componentField: "component",
    gradeFields: [
      { key: "dStar", label: "D*", color: "#A9471F" }, { key: "d", label: "D", color: "#2E7D6F" },
      { key: "m", label: "M", color: "#3B6EA5" }, { key: "p", label: "P", color: "#7B5EA7" },
    ],
  },
  "pearson-uk-8ma0": {
    rows: [{ code: "8MA0", component: "Overall", session: "June", year: 2025, maxMark: 160, a: 108, b: 95, c: 82, d: 69, e: 57 }],
    codeField: "code", sessionField: "session", yearField: "year", maxMarkField: "maxMark", componentField: "component",
    gradeFields: [
      { key: "a", label: "A", color: "#526B7E" }, { key: "b", label: "B", color: "#506D58" },
      { key: "c", label: "C", color: "#6E5C40" }, { key: "d", label: "D", color: "#775E55" },
      { key: "e", label: "E", color: "#655A70" },
    ],
  },
  "ocr-6993": {
    rows: [{ code: "6993", component: "01", session: "June", year: 2025, maxMark: 100, a: 67, b: 60, c: 53, d: 47, e: 41 }],
    codeField: "code", sessionField: "session", yearField: "year", maxMarkField: "maxMark", componentField: "component",
    gradeFields: [
      { key: "a", label: "A", color: "#526B7E" }, { key: "b", label: "B", color: "#506D58" },
      { key: "c", label: "C", color: "#6E5C40" }, { key: "d", label: "D", color: "#775E55" },
      { key: "e", label: "E", color: "#655A70" },
    ],
  },
};

export const EXAM_OVERVIEW_INSIGHT_SOURCES = {
  "cambridge-0607-statistics": "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/results-statistics/",
  "cambridge-0607-boundaries": "https://www.cambridgeinternational.org/Images/758469-cambridge-international-mathematics-0607-march-2026-grade-threshold-table.pdf",
  "pearson-7m20-boundaries": "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-boundaries/Level-2-extended-maths-certificate/grade-boundaries-june-2025-l2-ext-maths.pdf",
  "pearson-8ma0-boundaries": "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-boundaries/A-level/grade-boundaries-june-2025-gce.pdf",
  "pearson-8ma0-statistics": "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-statistics/A-level/grade-statistics-june-2025-provisional-advanced-subsidiary-level.pdf",
  "ocr-6993-boundaries": "https://www.ocr.org.uk/Images/739510-core-maths-extended-project-and-fsmq-grade-boundaries-june-2025.pdf",
} as const;
