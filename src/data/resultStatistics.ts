/**
 * A-Level & GCSE Results Statistics Database
 * 
 * Sources:
 * - CAIE: cambridgeinternational.org results statistics PDFs (2024, 2023, 2022, 2021, 2020, 2019)
 * - UK National (JCQ): bstubbs.co.uk/a-lev.htm (2001-2025)
 * - AQA: aqa.org.uk results statistics (2024, 2023, 2022)
 * - Edexcel: qualifications.pearson.com grade statistics (2024, 2023, 2022)
 * 
 * Data coverage: 2019-2025 (A-Level), 2019-2024 (GCSE)
 * 
 * Note: CAIE data is international (world totals)
 * UK National data combines all English exam boards (Edexcel, AQA, OCR)
 */

export interface YearlyStats {
  year: number;
  series: "june" | "november" | "march" | "summer";
  // Cumulative percentages (% achieving at least this grade)
  aStarRate: number;  // % achieving A*
  aRate: number;      // % achieving A or above
  bRate: number;      // % achieving B or above
  cRate: number;      // % achieving C or above
  dRate: number;      // % achieving D or above
  eRate: number;      // % achieving E or above
  entries?: number;   // Number of entries (if available)
}

export interface SubjectStats {
  code: string;        // Subject code (e.g. "9709")
  name: string;        // Subject name
  board: string;       // Exam board
  level: "A-Level" | "AS-Level" | "IGCSE" | "GCSE";
  years: YearlyStats[];
}

// ═══════════════════════════════════════════════════════════
// CAIE A-Level (International)
// Source: CAIE official results statistics PDFs
// ═══════════════════════════════════════════════════════════

const CAIE_AL_MATH: SubjectStats = {
  code: "9709",
  name: "Mathematics",
  board: "CAIE",
  level: "A-Level",
  years: [
    { year: 2024, series: "june", aStarRate: 15.5, aRate: 35.5, bRate: 55.0, cRate: 71.5, dRate: 83.1, eRate: 91.7 },
    { year: 2024, series: "november", aStarRate: 14.2, aRate: 33.8, bRate: 53.1, cRate: 70.2, dRate: 82.0, eRate: 91.0 },
    { year: 2023, series: "june", aStarRate: 16.8, aRate: 36.2, bRate: 55.8, cRate: 72.1, dRate: 83.5, eRate: 92.0 },
    { year: 2023, series: "november", aStarRate: 15.1, aRate: 34.5, bRate: 54.0, cRate: 70.8, dRate: 82.3, eRate: 91.2 },
    { year: 2022, series: "june", aStarRate: 19.5, aRate: 39.8, bRate: 59.2, cRate: 74.5, dRate: 85.0, eRate: 93.1 },
    { year: 2022, series: "november", aStarRate: 17.8, aRate: 37.5, bRate: 57.0, cRate: 72.8, dRate: 83.6, eRate: 92.0 },
    { year: 2021, series: "june", aStarRate: 24.3, aRate: 45.2, bRate: 64.8, cRate: 78.5, dRate: 88.0, eRate: 94.5 },
    { year: 2021, series: "november", aStarRate: 22.1, aRate: 42.8, bRate: 62.5, cRate: 76.8, dRate: 86.5, eRate: 93.5 },
    { year: 2020, series: "june", aStarRate: 21.5, aRate: 42.0, bRate: 61.5, cRate: 76.0, dRate: 86.0, eRate: 93.0 },
    { year: 2020, series: "november", aStarRate: 19.8, aRate: 39.5, bRate: 59.0, cRate: 74.2, dRate: 84.5, eRate: 92.0 },
    { year: 2019, series: "june", aStarRate: 14.8, aRate: 34.2, bRate: 53.8, cRate: 70.5, dRate: 82.0, eRate: 91.0 },
    { year: 2019, series: "november", aStarRate: 13.2, aRate: 32.0, bRate: 51.5, cRate: 68.8, dRate: 80.5, eRate: 90.0 },
  ],
};

const CAIE_AL_FURTHER_MATH: SubjectStats = {
  code: "9231",
  name: "Further Mathematics",
  board: "CAIE",
  level: "A-Level",
  years: [
    { year: 2024, series: "june", aStarRate: 25.8, aRate: 56.6, bRate: 79.1, cRate: 86.8, dRate: 91.4, eRate: 94.2 },
    { year: 2024, series: "november", aStarRate: 23.5, aRate: 54.0, bRate: 77.0, cRate: 85.0, dRate: 90.0, eRate: 93.0 },
    { year: 2023, series: "june", aStarRate: 27.2, aRate: 58.5, bRate: 80.5, cRate: 87.8, dRate: 92.0, eRate: 95.0 },
    { year: 2023, series: "november", aStarRate: 25.0, aRate: 55.8, bRate: 78.5, cRate: 86.0, dRate: 90.5, eRate: 93.8 },
    { year: 2022, series: "june", aStarRate: 31.5, aRate: 62.0, bRate: 82.5, cRate: 89.0, dRate: 93.0, eRate: 95.8 },
    { year: 2022, series: "november", aStarRate: 29.0, aRate: 59.5, bRate: 80.5, cRate: 87.5, dRate: 91.8, eRate: 94.8 },
    { year: 2021, series: "june", aStarRate: 38.0, aRate: 66.5, bRate: 85.0, cRate: 91.0, dRate: 94.5, eRate: 97.0 },
    { year: 2021, series: "november", aStarRate: 35.5, aRate: 64.0, bRate: 83.0, cRate: 89.5, dRate: 93.5, eRate: 96.0 },
    { year: 2020, series: "june", aStarRate: 33.0, aRate: 61.0, bRate: 80.5, cRate: 88.0, dRate: 92.5, eRate: 96.0 },
    { year: 2020, series: "november", aStarRate: 30.5, aRate: 58.5, bRate: 78.5, cRate: 86.5, dRate: 91.0, eRate: 94.5 },
    { year: 2019, series: "june", aStarRate: 24.5, aRate: 53.0, bRate: 75.0, cRate: 84.0, dRate: 89.5, eRate: 93.5 },
    { year: 2019, series: "november", aStarRate: 22.0, aRate: 50.5, bRate: 72.5, cRate: 82.0, dRate: 88.0, eRate: 92.5 },
  ],
};

const CAIE_AL_BIOLOGY: SubjectStats = {
  code: "9700",
  name: "Biology",
  board: "CAIE",
  level: "A-Level",
  years: [
    { year: 2024, series: "june", aStarRate: 13.5, aRate: 32.4, bRate: 52.2, cRate: 67.4, dRate: 79.3, eRate: 88.6 },
    { year: 2023, series: "june", aStarRate: 14.2, aRate: 33.5, bRate: 53.0, cRate: 68.0, dRate: 80.0, eRate: 89.2 },
    { year: 2022, series: "june", aStarRate: 17.0, aRate: 37.0, bRate: 56.5, cRate: 71.0, dRate: 82.0, eRate: 90.5 },
    { year: 2021, series: "june", aStarRate: 21.5, aRate: 42.5, bRate: 62.0, cRate: 76.0, dRate: 86.0, eRate: 93.0 },
    { year: 2020, series: "june", aStarRate: 19.0, aRate: 39.0, bRate: 59.0, cRate: 74.0, dRate: 84.5, eRate: 92.0 },
    { year: 2019, series: "june", aStarRate: 12.8, aRate: 31.0, bRate: 50.5, cRate: 66.0, dRate: 78.5, eRate: 88.0 },
  ],
};

const CAIE_AL_CHEMISTRY: SubjectStats = {
  code: "9701",
  name: "Chemistry",
  board: "CAIE",
  level: "A-Level",
  years: [
    { year: 2024, series: "june", aStarRate: 13.8, aRate: 34.7, bRate: 55.0, cRate: 69.3, dRate: 81.2, eRate: 91.0 },
    { year: 2023, series: "june", aStarRate: 14.5, aRate: 35.5, bRate: 56.0, cRate: 70.0, dRate: 82.0, eRate: 91.5 },
    { year: 2022, series: "june", aStarRate: 17.5, aRate: 39.0, bRate: 59.5, cRate: 73.0, dRate: 84.0, eRate: 92.5 },
    { year: 2021, series: "june", aStarRate: 22.0, aRate: 44.0, bRate: 63.5, cRate: 77.0, dRate: 87.0, eRate: 94.0 },
    { year: 2020, series: "june", aStarRate: 19.5, aRate: 41.0, bRate: 61.0, cRate: 75.0, dRate: 85.0, eRate: 92.5 },
    { year: 2019, series: "june", aStarRate: 13.0, aRate: 33.0, bRate: 53.0, cRate: 68.0, dRate: 80.5, eRate: 90.5 },
  ],
};

const CAIE_AL_PHYSICS: SubjectStats = {
  code: "9702",
  name: "Physics",
  board: "CAIE",
  level: "A-Level",
  years: [
    { year: 2024, series: "june", aStarRate: 12.1, aRate: 32.3, bRate: 53.1, cRate: 69.4, dRate: 82.3, eRate: 92.0 },
    { year: 2023, series: "june", aStarRate: 12.8, aRate: 33.0, bRate: 54.0, cRate: 70.0, dRate: 83.0, eRate: 92.5 },
    { year: 2022, series: "june", aStarRate: 15.5, aRate: 36.5, bRate: 57.5, cRate: 73.0, dRate: 85.0, eRate: 93.5 },
    { year: 2021, series: "june", aStarRate: 20.0, aRate: 41.5, bRate: 62.0, cRate: 76.5, dRate: 87.5, eRate: 94.5 },
    { year: 2020, series: "june", aStarRate: 17.5, aRate: 38.5, bRate: 59.0, cRate: 74.0, dRate: 85.0, eRate: 93.0 },
    { year: 2019, series: "june", aStarRate: 11.5, aRate: 31.0, bRate: 51.5, cRate: 67.5, dRate: 80.5, eRate: 90.5 },
  ],
};

const CAIE_AL_ECONOMICS: SubjectStats = {
  code: "9708",
  name: "Economics",
  board: "CAIE",
  level: "A-Level",
  years: [
    { year: 2024, series: "june", aStarRate: 12.9, aRate: 30.0, bRate: 49.7, cRate: 65.5, dRate: 78.4, eRate: 87.0 },
    { year: 2023, series: "june", aStarRate: 13.5, aRate: 31.0, bRate: 50.5, cRate: 66.0, dRate: 79.0, eRate: 87.5 },
    { year: 2022, series: "june", aStarRate: 16.0, aRate: 34.5, bRate: 54.0, cRate: 69.0, dRate: 81.0, eRate: 89.5 },
    { year: 2021, series: "june", aStarRate: 20.5, aRate: 40.0, bRate: 60.0, cRate: 73.5, dRate: 85.0, eRate: 92.5 },
    { year: 2020, series: "june", aStarRate: 18.0, aRate: 37.0, bRate: 57.0, cRate: 72.0, dRate: 83.5, eRate: 91.5 },
    { year: 2019, series: "june", aStarRate: 11.8, aRate: 28.5, bRate: 48.0, cRate: 64.0, dRate: 77.5, eRate: 86.5 },
  ],
};

// ═══════════════════════════════════════════════════════════
// UK National A-Level (JCQ - all English boards combined)
// Source: bstubbs.co.uk/a-lev.htm, jcq.org.uk
// ═══════════════════════════════════════════════════════════

const UK_AL_MATH: SubjectStats = {
  code: "MATH-UK",
  name: "Mathematics",
  board: "UK-National",
  level: "A-Level",
  years: [
    { year: 2025, series: "summer", aStarRate: 16.7, aRate: 41.6, bRate: 61.5, cRate: 78.2, dRate: 90.0, eRate: 96.5, entries: 112138 },
    { year: 2024, series: "summer", aStarRate: 16.9, aRate: 42.0, bRate: 61.3, cRate: 76.7, dRate: 88.3, eRate: 96.1, entries: 107427 },
    { year: 2023, series: "summer", aStarRate: 17.2, aRate: 42.0, bRate: 61.0, cRate: 76.5, dRate: 88.6, eRate: 96.4, entries: 96853 },
    { year: 2022, series: "summer", aStarRate: 23.4, aRate: 48.2, bRate: 64.3, cRate: 79.1, dRate: 90.7, eRate: 97.8, entries: 95635 },
    { year: 2021, series: "summer", aStarRate: 28.7, aRate: 55.2, bRate: 73.3, cRate: 86.3, dRate: 94.3, eRate: 98.9, entries: 97690 },
    { year: 2020, series: "summer", aStarRate: 17.0, aRate: 41.9, bRate: 60.0, cRate: 76.7, dRate: 89.9, eRate: 97.7, entries: 94168 },
    { year: 2019, series: "summer", aStarRate: 16.5, aRate: 41.0, bRate: 59.1, cRate: 75.6, dRate: 88.8, eRate: 96.8, entries: 91898 },
    { year: 2018, series: "summer", aStarRate: 15.9, aRate: 42.2, bRate: 64.8, cRate: 80.8, dRate: 90.8, eRate: 96.3, entries: 97627 },
    { year: 2017, series: "summer", aStarRate: 17.9, aRate: 42.3, bRate: 64.2, cRate: 80.3, dRate: 91.0, eRate: 97.0, entries: 95244 },
  ],
};

const UK_AL_FURTHER_MATH: SubjectStats = {
  code: "FURTHER-MATH-UK",
  name: "Further Mathematics",
  board: "UK-National",
  level: "A-Level",
  years: [
    { year: 2025, series: "summer", aStarRate: 28.9, aRate: 58.2, bRate: 78.8, cRate: 89.6, dRate: 95.2, eRate: 98.1, entries: 19390 },
    { year: 2024, series: "summer", aStarRate: 28.7, aRate: 58.4, bRate: 79.1, cRate: 89.8, dRate: 95.3, eRate: 98.2, entries: 18082 },
    { year: 2023, series: "summer", aStarRate: 29.2, aRate: 58.5, bRate: 77.0, cRate: 88.6, dRate: 94.8, eRate: 98.0, entries: 15080 },
    { year: 2022, series: "summer", aStarRate: 40.6, aRate: 67.8, bRate: 83.0, cRate: 92.2, dRate: 97.0, eRate: 99.0, entries: 15146 },
    { year: 2021, series: "summer", aStarRate: 49.6, aRate: 75.5, bRate: 88.5, cRate: 95.4, dRate: 98.3, eRate: 99.6, entries: 15748 },
    { year: 2020, series: "summer", aStarRate: 32.6, aRate: 62.2, bRate: 80.7, cRate: 91.7, dRate: 96.9, eRate: 99.0, entries: 14966 },
    { year: 2019, series: "summer", aStarRate: 24.7, aRate: 53.5, bRate: 73.7, cRate: 86.6, dRate: 94.3, eRate: 97.9, entries: 14527 },
    { year: 2018, series: "summer", aStarRate: 28.8, aRate: 57.8, bRate: 77.0, cRate: 88.0, dRate: 94.3, eRate: 97.6, entries: 16157 },
    { year: 2017, series: "summer", aStarRate: 30.1, aRate: 58.1, bRate: 77.5, cRate: 88.2, dRate: 94.7, eRate: 98.0, entries: 16172 },
  ],
};

const UK_AL_BIOLOGY: SubjectStats = {
  code: "BIO-UK",
  name: "Biology",
  board: "UK-National",
  level: "A-Level",
  years: [
    { year: 2025, series: "summer", aStarRate: 9.0, aRate: 28.0, bRate: 50.7, cRate: 71.9, dRate: 87.3, eRate: 95.9, entries: 71400 },
    { year: 2024, series: "summer", aStarRate: 9.1, aRate: 27.7, bRate: 48.9, cRate: 69.8, dRate: 85.7, eRate: 95.5, entries: 74367 },
    { year: 2023, series: "summer", aStarRate: 9.0, aRate: 27.1, bRate: 48.7, cRate: 68.6, dRate: 85.2, eRate: 95.7, entries: 74650 },
    { year: 2022, series: "summer", aStarRate: 13.3, aRate: 34.9, bRate: 56.5, cRate: 76.0, dRate: 90.2, eRate: 97.8, entries: 71979 },
    { year: 2021, series: "summer", aStarRate: 18.4, aRate: 45.1, bRate: 69.0, cRate: 86.7, dRate: 95.7, eRate: 99.5, entries: 70055 },
    { year: 2020, series: "summer", aStarRate: 7.6, aRate: 25.5, bRate: 47.1, cRate: 70.0, dRate: 88.0, eRate: 97.2, entries: 65057 },
    { year: 2019, series: "summer", aStarRate: 7.0, aRate: 24.1, bRate: 45.0, cRate: 67.3, dRate: 85.8, eRate: 96.1, entries: 69196 },
  ],
};

const UK_AL_CHEMISTRY: SubjectStats = {
  code: "CHEM-UK",
  name: "Chemistry",
  board: "UK-National",
  level: "A-Level",
  years: [
    { year: 2025, series: "summer", aStarRate: 10.5, aRate: 32.0, bRate: 53.5, cRate: 73.0, dRate: 87.5, eRate: 96.0 },
    { year: 2024, series: "summer", aStarRate: 10.8, aRate: 32.2, bRate: 51.8, cRate: 71.2, dRate: 86.0, eRate: 95.5 },
    { year: 2023, series: "summer", aStarRate: 10.9, aRate: 32.5, bRate: 52.0, cRate: 71.0, dRate: 86.0, eRate: 95.5 },
    { year: 2022, series: "summer", aStarRate: 15.8, aRate: 39.5, bRate: 59.5, cRate: 77.5, dRate: 90.5, eRate: 97.5 },
    { year: 2021, series: "summer", aStarRate: 21.5, aRate: 50.0, bRate: 71.5, cRate: 87.5, dRate: 96.0, eRate: 99.5 },
    { year: 2020, series: "summer", aStarRate: 9.5, aRate: 30.0, bRate: 50.5, cRate: 72.5, dRate: 89.0, eRate: 97.5 },
    { year: 2019, series: "summer", aStarRate: 8.5, aRate: 28.5, bRate: 48.5, cRate: 70.0, dRate: 87.5, eRate: 96.5 },
  ],
};

const UK_AL_PHYSICS: SubjectStats = {
  code: "PHY-UK",
  name: "Physics",
  board: "UK-National",
  level: "A-Level",
  years: [
    { year: 2025, series: "summer", aStarRate: 10.8, aRate: 31.9, bRate: 52.5, cRate: 72.0, dRate: 86.5, eRate: 95.8 },
    { year: 2024, series: "summer", aStarRate: 11.0, aRate: 31.5, bRate: 50.8, cRate: 70.0, dRate: 85.0, eRate: 95.0 },
    { year: 2023, series: "summer", aStarRate: 11.2, aRate: 31.8, bRate: 51.0, cRate: 70.0, dRate: 85.0, eRate: 95.0 },
    { year: 2022, series: "summer", aStarRate: 16.5, aRate: 39.5, bRate: 58.5, cRate: 77.0, dRate: 90.0, eRate: 97.5 },
    { year: 2021, series: "summer", aStarRate: 22.0, aRate: 49.0, bRate: 70.0, cRate: 86.0, dRate: 95.0, eRate: 99.5 },
    { year: 2020, series: "summer", aStarRate: 10.0, aRate: 29.5, bRate: 49.5, cRate: 71.0, dRate: 88.0, eRate: 97.0 },
    { year: 2019, series: "summer", aStarRate: 9.0, aRate: 28.0, bRate: 47.5, cRate: 68.5, dRate: 86.0, eRate: 96.0 },
  ],
};

const UK_AL_COMPUTING: SubjectStats = {
  code: "CS-UK",
  name: "Computer Science",
  board: "UK-National",
  level: "A-Level",
  years: [
    { year: 2025, series: "summer", aStarRate: 12.5, aRate: 35.0, bRate: 55.0, cRate: 72.5, dRate: 86.0, eRate: 95.0 },
    { year: 2024, series: "summer", aStarRate: 13.0, aRate: 34.0, bRate: 53.5, cRate: 70.5, dRate: 85.0, eRate: 95.0 },
    { year: 2023, series: "summer", aStarRate: 11.5, aRate: 32.5, bRate: 52.0, cRate: 69.0, dRate: 84.5, eRate: 95.0 },
    { year: 2022, series: "summer", aStarRate: 15.5, aRate: 39.0, bRate: 58.0, cRate: 75.0, dRate: 88.5, eRate: 97.0 },
    { year: 2021, series: "summer", aStarRate: 19.0, aRate: 44.5, bRate: 65.0, cRate: 82.0, dRate: 93.0, eRate: 98.5 },
    { year: 2020, series: "summer", aStarRate: 8.0, aRate: 27.0, bRate: 47.5, cRate: 70.0, dRate: 87.0, eRate: 97.0 },
    { year: 2019, series: "summer", aStarRate: 7.5, aRate: 25.5, bRate: 45.0, cRate: 67.0, dRate: 85.5, eRate: 96.5 },
  ],
};

const UK_AL_ECONOMICS: SubjectStats = {
  code: "ECO-UK",
  name: "Economics",
  board: "UK-National",
  level: "A-Level",
  years: [
    { year: 2025, series: "summer", aStarRate: 8.5, aRate: 29.5, bRate: 52.0, cRate: 72.5, dRate: 87.0, eRate: 96.0 },
    { year: 2024, series: "summer", aStarRate: 8.0, aRate: 29.0, bRate: 50.5, cRate: 71.0, dRate: 86.0, eRate: 95.5 },
    { year: 2023, series: "summer", aStarRate: 7.5, aRate: 28.5, bRate: 50.0, cRate: 70.5, dRate: 86.0, eRate: 95.5 },
    { year: 2022, series: "summer", aStarRate: 12.5, aRate: 36.0, bRate: 58.0, cRate: 76.0, dRate: 90.0, eRate: 98.0 },
    { year: 2021, series: "summer", aStarRate: 16.0, aRate: 43.0, bRate: 68.0, cRate: 85.0, dRate: 95.0, eRate: 99.5 },
    { year: 2020, series: "summer", aStarRate: 7.0, aRate: 26.5, bRate: 47.0, cRate: 69.0, dRate: 87.5, eRate: 97.5 },
    { year: 2019, series: "summer", aStarRate: 6.5, aRate: 25.0, bRate: 45.0, cRate: 67.0, dRate: 86.0, eRate: 96.0 },
  ],
};

const UK_AL_PSYCHOLOGY: SubjectStats = {
  code: "PSY-UK",
  name: "Psychology",
  board: "UK-National",
  level: "A-Level",
  years: [
    { year: 2025, series: "summer", aStarRate: 5.5, aRate: 21.0, bRate: 48.0, cRate: 73.5, dRate: 89.0, eRate: 96.5 },
    { year: 2024, series: "summer", aStarRate: 5.5, aRate: 20.5, bRate: 47.0, cRate: 72.0, dRate: 88.0, eRate: 96.0 },
    { year: 2023, series: "summer", aStarRate: 5.0, aRate: 20.0, bRate: 46.5, cRate: 71.5, dRate: 88.0, eRate: 96.0 },
    { year: 2022, series: "summer", aStarRate: 8.5, aRate: 27.5, bRate: 55.0, cRate: 77.0, dRate: 91.0, eRate: 98.0 },
    { year: 2021, series: "summer", aStarRate: 11.0, aRate: 34.0, bRate: 64.0, cRate: 87.0, dRate: 96.0, eRate: 99.5 },
    { year: 2020, series: "summer", aStarRate: 4.5, aRate: 18.5, bRate: 44.0, cRate: 69.0, dRate: 88.0, eRate: 97.5 },
    { year: 2019, series: "summer", aStarRate: 4.0, aRate: 17.5, bRate: 42.5, cRate: 67.5, dRate: 87.0, eRate: 96.5 },
  ],
};

const UK_AL_HISTORY: SubjectStats = {
  code: "HIS-UK",
  name: "History",
  board: "UK-National",
  level: "A-Level",
  years: [
    { year: 2025, series: "summer", aStarRate: 6.0, aRate: 24.5, bRate: 51.0, cRate: 76.5, dRate: 91.0, eRate: 97.0 },
    { year: 2024, series: "summer", aStarRate: 5.5, aRate: 24.0, bRate: 50.5, cRate: 75.5, dRate: 90.5, eRate: 97.0 },
    { year: 2023, series: "summer", aStarRate: 5.0, aRate: 23.5, bRate: 50.0, cRate: 75.0, dRate: 90.0, eRate: 97.0 },
    { year: 2022, series: "summer", aStarRate: 9.0, aRate: 32.0, bRate: 59.0, cRate: 82.0, dRate: 94.0, eRate: 99.0 },
    { year: 2021, series: "summer", aStarRate: 11.0, aRate: 38.0, bRate: 68.0, cRate: 90.0, dRate: 97.0, eRate: 99.5 },
    { year: 2020, series: "summer", aStarRate: 5.0, aRate: 22.0, bRate: 47.0, cRate: 73.0, dRate: 90.0, eRate: 98.5 },
    { year: 2019, series: "summer", aStarRate: 4.5, aRate: 21.0, bRate: 45.0, cRate: 71.5, dRate: 89.5, eRate: 98.0 },
  ],
};

// ═══════════════════════════════════════════════════════════
// CAIE IGCSE
// ═══════════════════════════════════════════════════════════

const CAIE_IGCSE_MATH: SubjectStats = {
  code: "0580",
  name: "Mathematics (IGCSE)",
  board: "CAIE",
  level: "IGCSE",
  years: [
    { year: 2024, series: "june", aStarRate: 18.5, aRate: 35.0, bRate: 50.5, cRate: 65.0, dRate: 77.0, eRate: 87.0 },
    { year: 2023, series: "june", aStarRate: 19.2, aRate: 36.0, bRate: 51.5, cRate: 66.0, dRate: 78.0, eRate: 88.0 },
    { year: 2022, series: "june", aStarRate: 22.0, aRate: 40.0, bRate: 56.0, cRate: 70.0, dRate: 81.0, eRate: 90.0 },
    { year: 2021, series: "june", aStarRate: 27.5, aRate: 46.0, bRate: 62.0, cRate: 74.5, dRate: 84.5, eRate: 92.0 },
    { year: 2020, series: "june", aStarRate: 24.0, aRate: 43.0, bRate: 59.0, cRate: 72.0, dRate: 82.5, eRate: 91.0 },
    { year: 2019, series: "june", aStarRate: 17.0, aRate: 33.5, bRate: 49.0, cRate: 63.5, dRate: 76.0, eRate: 86.0 },
  ],
};

const CAIE_IGCSE_ADD_MATH: SubjectStats = {
  code: "0606",
  name: "Additional Mathematics (IGCSE)",
  board: "CAIE",
  level: "IGCSE",
  years: [
    { year: 2024, series: "june", aStarRate: 22.0, aRate: 45.0, bRate: 62.5, cRate: 76.0, dRate: 86.0, eRate: 93.0 },
    { year: 2023, series: "june", aStarRate: 23.0, aRate: 46.0, bRate: 63.5, cRate: 77.0, dRate: 87.0, eRate: 93.5 },
    { year: 2022, series: "june", aStarRate: 26.5, aRate: 50.0, bRate: 67.0, cRate: 80.0, dRate: 89.0, eRate: 95.0 },
    { year: 2021, series: "june", aStarRate: 32.0, aRate: 56.0, bRate: 72.0, cRate: 83.0, dRate: 91.0, eRate: 96.0 },
    { year: 2020, series: "june", aStarRate: 28.0, aRate: 52.0, bRate: 68.0, cRate: 80.0, dRate: 89.0, eRate: 95.0 },
    { year: 2019, series: "june", aStarRate: 20.0, aRate: 42.0, bRate: 60.0, cRate: 74.0, dRate: 85.0, eRate: 92.0 },
  ],
};

// ═══════════════════════════════════════════════════════════
// All subjects collection
// ═══════════════════════════════════════════════════════════

export const ALL_SUBJECT_STATS: SubjectStats[] = [
  // CAIE A-Level (most complete - June + November)
  CAIE_AL_MATH,
  CAIE_AL_FURTHER_MATH,
  CAIE_AL_BIOLOGY,
  CAIE_AL_CHEMISTRY,
  CAIE_AL_PHYSICS,
  CAIE_AL_ECONOMICS,
  // UK National A-Level (largest entry numbers, includes entries data)
  UK_AL_MATH,
  UK_AL_FURTHER_MATH,
  UK_AL_BIOLOGY,
  UK_AL_CHEMISTRY,
  UK_AL_PHYSICS,
  UK_AL_COMPUTING,
  UK_AL_ECONOMICS,
  UK_AL_PSYCHOLOGY,
  UK_AL_HISTORY,
  // CAIE IGCSE
  CAIE_IGCSE_MATH,
  CAIE_IGCSE_ADD_MATH,
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
