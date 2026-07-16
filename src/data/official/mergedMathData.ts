import aqaGcseData from "../aqa.json";
import aqaALevelData from "../aqa_al.json";
import caieGcseData from "../caie.json";
import officialAqaGcseMath from "./aqa-math-grade-boundaries.json";
import officialAqaALevelMath from "./aqa-a-level-math-grade-boundaries.json";
import officialCaieGcse2026Math from "./caie-math-grade-boundaries-2026.json";
import officialCaieALevel2026Math from "./caie-a-level-math-grade-boundaries-2026.json";

export type GradeBoundaryRow = Record<string, string | number>;

const asRows = (rows: unknown) => rows as GradeBoundaryRow[];

const AQA_GCSE_MATH_CODES = new Set(["8300", "8360", "8365"]);
const AQA_A_LEVEL_MATH_CODES = new Set(["7357", "7367"]);

const ACCESSED_AT = "2026-07-11";
const AQA_SOURCE = "https://www.aqa.org.uk/exams-administration/results-days/grade-boundaries";
const CAIE_SOURCE = "https://www.cambridgeinternational.org/programmes-and-qualifications/grade-threshold-tables/";

function annotateRows(
  rows: GradeBoundaryRow[],
  status: "verified" | "unverified",
  sourceUrl: string,
): GradeBoundaryRow[] {
  return rows.map((row, index) => {
    const annotated: GradeBoundaryRow = {
      ...row,
      _verificationStatus: status,
      _sourceUrl: sourceUrl,
      _accessedAt: ACCESSED_AT,
      _extractionMethod: status === "verified" ? "official-pdf" : "legacy-import",
      _publicationStatus: status === "verified" ? "verified-active" : "legacy-visible",
    };
    // Only verified rows receive a stable business identity. Giving legacy
    // conflicts a synthetic identity would incorrectly make them calculable.
    if (status === "verified") annotated._sourceRowId = `official-${index + 1}`;
    return annotated;
  });
}

function hasMonotonicThresholds(row: GradeBoundaryRow): boolean {
  let previous = Infinity;
  for (const field of ["a_star", "a", "b", "c", "d", "e", "f", "g"]) {
    const value = row[field];
    if (value === null || value === undefined || value === 0) continue;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > Number(row.maxMark) || numeric > previous) return false;
    previous = numeric;
  }
  return true;
}

export const QUARANTINED_CAIE_LEGACY_DATA = asRows(caieGcseData).filter((row) => !hasMonotonicThresholds(row));

/** Data sources used by the live board routes after replacing stale math rows. */
export const MERGED_AQA_GCSE_DATA: GradeBoundaryRow[] = [
  ...annotateRows(asRows(aqaGcseData).filter(row => !AQA_GCSE_MATH_CODES.has(String(row.code))), "unverified", AQA_SOURCE),
  ...annotateRows(asRows(officialAqaGcseMath), "verified", AQA_SOURCE),
];

export const MERGED_AQA_A_LEVEL_DATA: GradeBoundaryRow[] = [
  ...annotateRows(asRows(aqaALevelData).filter(row => !AQA_A_LEVEL_MATH_CODES.has(String(row.code))), "unverified", AQA_SOURCE),
  ...annotateRows(asRows(officialAqaALevelMath), "verified", AQA_SOURCE),
];

export const MERGED_CAIE_GCSE_DATA: GradeBoundaryRow[] = [
  ...annotateRows(asRows(caieGcseData).filter(row => hasMonotonicThresholds(row) &&
    !(String(row.series) === "m-2026" && ["0580", "0606"].includes(String(row.subjectCode)))
  ), "unverified", CAIE_SOURCE),
  ...annotateRows(asRows(officialCaieGcse2026Math), "verified", CAIE_SOURCE),
];

export const MERGED_CAIE_A_LEVEL_DATA: GradeBoundaryRow[] = [
  ...annotateRows(asRows(officialCaieALevel2026Math), "verified", CAIE_SOURCE),
];
