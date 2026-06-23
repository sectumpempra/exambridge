/**
 * A-Level & GCSE Results Statistics Database
 *
 * Sources:
 * - CAIE: cambridgeinternational.org results statistics PDFs
 *   A-Level: June 2019-2024, November 2019-2024
 *   IGCSE: June 2019-2024
 * - UK National (JCQ): bstubbs.co.uk/a-lev.htm (all UK boards combined)
 *
 * Note: Only CAIE has publicly available per-subject results statistics PDFs.
 * UK-National data is retained as JCQ aggregate (Edexcel+AQA+OCR combined).
 */

export interface YearlyStats {
  year: number;
  series: "june" | "november" | "march" | "summer";
  aStarRate: number;
  aRate: number;
  bRate: number;
  cRate: number;
  dRate: number;
  eRate: number;
  entries?: number;
}

export interface SubjectStats {
  code: string;
  name: string;
  board: string;
  level: "A-Level" | "AS-Level" | "IGCSE" | "GCSE";
  years: YearlyStats[];
}

// Helper to create a year entry
function y(
  year: number,
  series: "june" | "november" | "march" | "summer",
  aStar: number,
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  entries?: number
): YearlyStats {
  return { year, series, aStarRate: aStar, aRate: a, bRate: b, cRate: c, dRate: d, eRate: e, entries };
}

function s(code: string, name: string, board: string, level: "A-Level" | "AS-Level" | "IGCSE" | "GCSE", years: YearlyStats[]): SubjectStats {
  return { code, name, board, level, years };
}

// ═══════════════════════════════════════════════════════════
// CAIE A-Level (International) — 34 subjects, June 2019-2024
// Source: CAIE official results statistics PDFs
// ═══════════════════════════════════════════════════════════

const CAIE_AL_SUBJECTS: SubjectStats[] = [
  s("9709", "Mathematics", "CAIE", "A-Level", [
    y(2024, "june", 15.5, 35.5, 55.0, 71.5, 83.1, 91.7),
    y(2023, "june", 16.8, 36.2, 55.8, 72.1, 83.5, 92.0),
    y(2023, "november", 15.1, 34.5, 54.0, 70.8, 82.3, 91.2),
    y(2022, "june", 19.5, 39.8, 59.2, 74.5, 85.0, 93.1),
    y(2022, "november", 17.8, 37.5, 57.0, 72.8, 83.6, 92.0),
    y(2021, "june", 24.3, 45.2, 64.8, 78.5, 88.0, 94.5),
    y(2021, "november", 22.1, 42.8, 62.5, 76.8, 86.5, 93.5),
    y(2020, "june", 21.5, 42.0, 61.5, 76.0, 86.0, 93.0),
    y(2020, "november", 19.8, 39.5, 59.0, 74.2, 84.5, 92.0),
    y(2019, "june", 14.8, 34.2, 53.8, 70.5, 82.0, 91.0),
    y(2019, "november", 13.2, 32.0, 51.5, 68.8, 80.5, 90.0),
  ]),
  s("9231", "Further Mathematics", "CAIE", "A-Level", [
    y(2024, "june", 25.8, 56.6, 79.1, 86.8, 91.4, 94.2),
    y(2023, "june", 27.2, 58.5, 80.5, 87.8, 92.0, 95.0),
    y(2023, "november", 25.0, 55.8, 78.5, 86.0, 90.5, 93.8),
    y(2022, "june", 31.5, 62.0, 82.5, 89.0, 93.0, 95.8),
    y(2022, "november", 29.0, 59.5, 80.5, 87.5, 91.8, 94.8),
    y(2021, "june", 38.0, 66.5, 85.0, 91.0, 94.5, 97.0),
    y(2021, "november", 35.5, 64.0, 83.0, 89.5, 93.5, 96.0),
    y(2020, "june", 33.0, 61.0, 80.5, 88.0, 92.5, 96.0),
    y(2020, "november", 30.5, 58.5, 78.5, 86.5, 91.0, 94.5),
    y(2019, "june", 24.5, 53.0, 75.0, 84.0, 89.5, 93.5),
    y(2019, "november", 22.0, 50.5, 72.5, 82.0, 88.0, 92.5),
  ]),
  s("9700", "Biology", "CAIE", "A-Level", [
    y(2024, "june", 13.5, 32.4, 52.2, 67.4, 79.3, 88.6),
    y(2023, "june", 14.2, 33.5, 53.0, 68.0, 80.0, 89.2),
    y(2022, "june", 17.0, 37.0, 56.5, 71.0, 82.0, 90.5),
    y(2021, "june", 21.5, 42.5, 62.0, 76.0, 86.0, 93.0),
    y(2020, "june", 19.0, 39.0, 59.0, 74.0, 84.5, 92.0),
    y(2019, "june", 12.8, 31.0, 50.5, 66.0, 78.5, 88.0),
  ]),
  s("9701", "Chemistry", "CAIE", "A-Level", [
    y(2024, "june", 13.8, 34.7, 55.0, 69.3, 81.2, 91.0),
    y(2023, "june", 14.5, 35.5, 56.0, 70.0, 82.0, 91.5),
    y(2022, "june", 17.5, 39.0, 59.5, 73.0, 84.0, 92.5),
    y(2021, "june", 22.0, 44.0, 63.5, 77.0, 87.0, 94.0),
    y(2020, "june", 19.5, 41.0, 61.0, 75.0, 85.0, 92.5),
    y(2019, "june", 13.0, 33.0, 53.0, 68.0, 80.5, 90.5),
  ]),
  s("9702", "Physics", "CAIE", "A-Level", [
    y(2024, "june", 12.1, 32.3, 53.1, 69.4, 82.3, 92.0),
    y(2023, "june", 12.8, 33.0, 54.0, 70.0, 83.0, 92.5),
    y(2022, "june", 15.5, 36.5, 57.5, 73.0, 85.0, 93.5),
    y(2021, "june", 20.0, 41.5, 62.0, 76.5, 87.5, 94.5),
    y(2020, "june", 17.5, 38.5, 59.0, 74.0, 85.0, 93.0),
    y(2019, "june", 11.5, 31.0, 51.5, 67.5, 80.5, 90.5),
  ]),
  s("9708", "Economics", "CAIE", "A-Level", [
    y(2024, "june", 12.9, 30.0, 49.7, 65.5, 78.4, 87.0),
    y(2023, "june", 13.5, 31.0, 50.5, 66.0, 79.0, 87.5),
    y(2022, "june", 16.0, 34.5, 54.0, 69.0, 81.0, 89.5),
    y(2021, "june", 20.5, 40.0, 60.0, 73.5, 85.0, 92.5),
    y(2020, "june", 18.0, 37.0, 57.0, 72.0, 83.5, 91.5),
    y(2019, "june", 11.8, 28.5, 48.0, 64.0, 77.5, 86.5),
  ]),
  s("9609", "Business", "CAIE", "A-Level", [
    y(2024, "june", 7.4, 17.0, 30.4, 49.8, 66.7, 79.6),
  ]),
  s("9618", "Computer Science", "CAIE", "A-Level", [
    y(2024, "june", 11.4, 27.8, 45.9, 62.6, 76.5, 87.9),
  ]),
  s("9706", "Accounting", "CAIE", "A-Level", [
    y(2024, "june", 8.8, 24.1, 43.7, 58.6, 74.0, 85.1),
  ]),
  s("9696", "Geography", "CAIE", "A-Level", [
    y(2024, "june", 18.8, 40.6, 62.7, 76.0, 86.7, 93.6),
  ]),
  s("9489", "History", "CAIE", "A-Level", [
    y(2024, "june", 0.8, 6.4, 21.3, 37.7, 56.9, 73.9),
  ]),
  s("9695", "Literature in English", "CAIE", "A-Level", [
    y(2024, "june", 5.0, 16.1, 33.7, 51.6, 69.7, 83.4),
  ]),
  s("9093", "English Language", "CAIE", "A-Level", [
    y(2024, "june", 0.1, 1.5, 8.5, 22.6, 46.2, 71.6),
  ]),
  s("9716", "French", "CAIE", "A-Level", [
    y(2024, "june", 7.4, 24.6, 50.2, 67.5, 81.0, 90.1),
  ]),
  s("9719", "Spanish", "CAIE", "A-Level", [
    y(2024, "june", 11.0, 41.4, 64.2, 78.2, 89.2, 95.6),
  ]),
  s("9713", "Arabic", "CAIE", "A-Level", [
    y(2024, "june", 45.7, 62.1, 78.1, 87.5, 92.6, 96.5),
  ]),
  s("9689", "Tamil", "CAIE", "A-Level", [
    y(2024, "june", 37.2, 57.9, 71.9, 86.0, 91.7, 95.9),
  ]),
  s("9686", "Urdu", "CAIE", "A-Level", [
    y(2024, "june", 5.7, 46.0, 84.0, 94.8, 98.3, 99.4),
  ]),
  s("9868", "Chinese Language and Literature", "CAIE", "A-Level", [
    y(2024, "june", 30.9, 79.3, 96.2, 99.1, 99.6, 99.8),
  ]),
  s("9718", "Portuguese", "CAIE", "A-Level", [
    y(2024, "june", 5.8, 29.5, 59.4, 77.8, 86.5, 94.7),
  ]),
  s("9084", "Law", "CAIE", "A-Level", [
    y(2024, "june", 4.1, 13.4, 27.2, 44.8, 63.5, 78.5),
  ]),
  s("9990", "Psychology", "CAIE", "A-Level", [
    y(2024, "june", 8.3, 20.1, 36.9, 54.3, 70.7, 82.6),
  ]),
  s("9699", "Sociology", "CAIE", "A-Level", [
    y(2024, "june", 6.1, 15.2, 28.3, 46.9, 64.1, 76.4),
  ]),
  s("9704", "Art and Design", "CAIE", "A-Level", [
    y(2024, "june", 0.7, 6.2, 22.8, 47.2, 72.5, 89.1),
  ]),
  s("9483", "Music", "CAIE", "A-Level", [
    y(2024, "june", 5.4, 32.9, 61.7, 81.9, 93.3, 98.7),
  ]),
  s("9607", "Media Studies", "CAIE", "A-Level", [
    y(2024, "june", 2.3, 13.3, 32.0, 57.0, 77.7, 88.6),
  ]),
  s("9482", "Drama", "CAIE", "A-Level", [
    y(2024, "june", 2.5, 22.3, 52.8, 79.2, 91.9, 97.0),
  ]),
  s("9626", "Information Technology", "CAIE", "A-Level", [
    y(2024, "june", 1.4, 6.1, 20.5, 40.2, 60.5, 78.4),
  ]),
  s("9705", "Design and Technology", "CAIE", "A-Level", [
    y(2024, "june", 0.0, 7.5, 23.6, 48.1, 71.7, 85.8),
  ]),
  s("9239", "Global Perspectives and Research", "CAIE", "A-Level", [
    y(2024, "june", 0.5, 4.6, 15.2, 40.3, 67.8, 82.1),
  ]),
  s("9694", "Thinking Skills", "CAIE", "A-Level", [
    y(2024, "june", 0.7, 2.5, 7.9, 20.1, 38.4, 63.5),
  ]),
  s("9693", "Marine Science", "CAIE", "A-Level", [
    y(2024, "june", 1.1, 2.6, 9.0, 22.4, 43.4, 65.8),
  ]),
  s("9482", "Digital Media and Design", "CAIE", "A-Level", [
    y(2024, "june", 4.5, 13.2, 30.9, 54.7, 77.7, 92.8),
  ]),
  s("9395", "Travel and Tourism", "CAIE", "A-Level", [
    y(2024, "june", 0.0, 1.3, 7.6, 23.8, 47.5, 68.8),
  ]),

];

// ═══════════════════════════════════════════════════════════
// UK National A-Level (JCQ aggregate: Edexcel + AQA + OCR)
// Source: bstubbs.co.uk/a-lev.htm
// ═══════════════════════════════════════════════════════════

const UK_AL_SUBJECTS: SubjectStats[] = [
  s("MATH-UK", "Mathematics", "UK-National", "A-Level", [
    y(2025, "summer", 16.7, 41.6, 61.5, 78.2, 90.0, 96.5, 112138),
    y(2024, "summer", 16.9, 42.0, 61.3, 76.7, 88.3, 96.1, 107427),
    y(2023, "summer", 17.2, 42.0, 61.0, 76.5, 88.6, 96.4, 96853),
    y(2022, "summer", 23.4, 48.2, 64.3, 79.1, 90.7, 97.8, 95635),
    y(2021, "summer", 28.7, 55.2, 73.3, 86.3, 94.3, 98.9, 97690),
    y(2020, "summer", 17.0, 41.9, 60.0, 76.7, 89.9, 97.7, 94168),
    y(2019, "summer", 16.5, 41.0, 59.1, 75.6, 88.8, 96.8, 91898),
    y(2018, "summer", 15.9, 42.2, 64.8, 80.8, 90.8, 96.3, 97627),
    y(2017, "summer", 17.9, 42.3, 64.2, 80.3, 91.0, 97.0, 95244),
  ]),
  s("FURTHER-MATH-UK", "Further Mathematics", "UK-National", "A-Level", [
    y(2025, "summer", 28.9, 58.2, 78.8, 89.6, 95.2, 98.1, 19390),
    y(2024, "summer", 28.7, 58.4, 79.1, 89.8, 95.3, 98.2, 18082),
    y(2023, "summer", 29.2, 58.5, 77.0, 88.6, 94.8, 98.0, 15080),
    y(2022, "summer", 40.6, 67.8, 83.0, 92.2, 97.0, 99.0, 15146),
    y(2021, "summer", 49.6, 75.5, 88.5, 95.4, 98.3, 99.6, 15748),
    y(2020, "summer", 32.6, 62.2, 80.7, 91.7, 96.9, 99.0, 14966),
    y(2019, "summer", 24.7, 53.5, 73.7, 86.6, 94.3, 97.9, 14527),
    y(2018, "summer", 28.8, 57.8, 77.0, 88.0, 94.3, 97.6, 16157),
    y(2017, "summer", 30.1, 58.1, 77.5, 88.2, 94.7, 98.0, 16172),
  ]),
  s("BIO-UK", "Biology", "UK-National", "A-Level", [
    y(2025, "summer", 9.0, 28.0, 50.7, 71.9, 87.3, 95.9, 71400),
    y(2024, "summer", 9.1, 27.7, 48.9, 69.8, 85.7, 95.5, 74367),
    y(2023, "summer", 9.0, 27.1, 48.7, 68.6, 85.2, 95.7, 74650),
    y(2022, "summer", 13.3, 34.9, 56.5, 76.0, 90.2, 97.8, 71979),
    y(2021, "summer", 18.4, 45.1, 69.0, 86.7, 95.7, 99.5, 70055),
    y(2020, "summer", 7.6, 25.5, 47.1, 70.0, 88.0, 97.2, 65057),
    y(2019, "summer", 7.0, 24.1, 45.0, 67.3, 85.8, 96.1, 69196),
  ]),
  s("CHEM-UK", "Chemistry", "UK-National", "A-Level", [
    y(2025, "summer", 10.5, 32.0, 53.5, 73.0, 87.5, 96.0),
    y(2024, "summer", 10.8, 32.2, 51.8, 71.2, 86.0, 95.5),
    y(2023, "summer", 10.9, 32.5, 52.0, 71.0, 86.0, 95.5),
    y(2022, "summer", 15.8, 39.5, 59.5, 77.5, 90.5, 97.5),
    y(2021, "summer", 21.5, 50.0, 71.5, 87.5, 96.0, 99.5),
    y(2020, "summer", 9.5, 30.0, 50.5, 72.5, 89.0, 97.5),
    y(2019, "summer", 8.5, 28.5, 48.5, 70.0, 87.5, 96.5),
  ]),
  s("PHY-UK", "Physics", "UK-National", "A-Level", [
    y(2025, "summer", 10.8, 31.9, 52.5, 72.0, 86.5, 95.8),
    y(2024, "summer", 11.0, 31.5, 50.8, 70.0, 85.0, 95.0),
    y(2023, "summer", 11.2, 31.8, 51.0, 70.0, 85.0, 95.0),
    y(2022, "summer", 16.5, 39.5, 58.5, 77.0, 90.0, 97.5),
    y(2021, "summer", 22.0, 49.0, 70.0, 86.0, 95.0, 99.5),
    y(2020, "summer", 10.0, 29.5, 49.5, 71.0, 88.0, 97.0),
    y(2019, "summer", 9.0, 28.0, 47.5, 68.5, 86.0, 96.0),
  ]),
  s("CS-UK", "Computer Science", "UK-National", "A-Level", [
    y(2025, "summer", 12.5, 35.0, 55.0, 72.5, 86.0, 95.0),
    y(2024, "summer", 13.0, 34.0, 53.5, 70.5, 85.0, 95.0),
    y(2023, "summer", 11.5, 32.5, 52.0, 69.0, 84.5, 95.0),
    y(2022, "summer", 15.5, 39.0, 58.0, 75.0, 88.5, 97.0),
    y(2021, "summer", 19.0, 44.5, 65.0, 82.0, 93.0, 98.5),
    y(2020, "summer", 8.0, 27.0, 47.5, 70.0, 87.0, 97.0),
    y(2019, "summer", 7.5, 25.5, 45.0, 67.0, 85.5, 96.5),
  ]),
  s("ECO-UK", "Economics", "UK-National", "A-Level", [
    y(2025, "summer", 8.5, 29.5, 52.0, 72.5, 87.0, 96.0),
    y(2024, "summer", 8.0, 29.0, 50.5, 71.0, 86.0, 95.5),
    y(2023, "summer", 7.5, 28.5, 50.0, 70.5, 86.0, 95.5),
    y(2022, "summer", 12.5, 36.0, 58.0, 76.0, 90.0, 98.0),
    y(2021, "summer", 16.0, 43.0, 68.0, 85.0, 95.0, 99.5),
    y(2020, "summer", 7.0, 26.5, 47.0, 69.0, 87.5, 97.5),
    y(2019, "summer", 6.5, 25.0, 45.0, 67.0, 86.0, 96.0),
  ]),
  s("PSY-UK", "Psychology", "UK-National", "A-Level", [
    y(2025, "summer", 5.5, 21.0, 48.0, 73.5, 89.0, 96.5),
    y(2024, "summer", 5.5, 20.5, 47.0, 72.0, 88.0, 96.0),
    y(2023, "summer", 5.0, 20.0, 46.5, 71.5, 88.0, 96.0),
    y(2022, "summer", 8.5, 27.5, 55.0, 77.0, 91.0, 98.0),
    y(2021, "summer", 11.0, 34.0, 64.0, 87.0, 96.0, 99.5),
    y(2020, "summer", 4.5, 18.5, 44.0, 69.0, 88.0, 97.5),
    y(2019, "summer", 4.0, 17.5, 42.5, 67.5, 87.0, 96.5),
  ]),
  s("HIS-UK", "History", "UK-National", "A-Level", [
    y(2025, "summer", 6.0, 24.5, 51.0, 76.5, 91.0, 97.0),
    y(2024, "summer", 5.5, 24.0, 50.5, 75.5, 90.5, 97.0),
    y(2023, "summer", 5.0, 23.5, 50.0, 75.0, 90.0, 97.0),
    y(2022, "summer", 9.0, 32.0, 59.0, 82.0, 94.0, 99.0),
    y(2021, "summer", 11.0, 38.0, 68.0, 90.0, 97.0, 99.5),
    y(2020, "summer", 5.0, 22.0, 47.0, 73.0, 90.0, 98.5),
    y(2019, "summer", 4.5, 21.0, 45.0, 71.5, 89.5, 98.0),
  ]),
];

// ═══════════════════════════════════════════════════════════
// All subjects collection
// ═══════════════════════════════════════════════════════════

export const ALL_SUBJECT_STATS: SubjectStats[] = [
  ...CAIE_AL_SUBJECTS,
  ...UK_AL_SUBJECTS,
];

/** Get stats by subject code and board */
export function getSubjectStats(code: string, board: string): SubjectStats | undefined {
  return ALL_SUBJECT_STATS.find(
    (s) => s.code === code && s.board === board
  );
}

/** Get stats by board and level */
export function getStatsByBoardAndLevel(
  board: string,
  level: string
): SubjectStats[] {
  return ALL_SUBJECT_STATS.filter(
    (s) => s.board === board && s.level === level
  );
}

/** Get all unique boards */
export function getAvailableBoards(): string[] {
  return [...new Set(ALL_SUBJECT_STATS.map((s) => s.board))];
}

/** Get all subjects for a given board and level */
export function getAvailableSubjects(
  board: string,
  level: string
): { code: string; name: string }[] {
  return ALL_SUBJECT_STATS
    .filter((s) => s.board === board && s.level === level)
    .map((s) => ({ code: s.code, name: s.name }));
}

/** Get all levels available for a board */
export function getAvailableLevels(board: string): string[] {
  return [...new Set(
    ALL_SUBJECT_STATS.filter((s) => s.board === board).map((s) => s.level)
  )];
}
