import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = {
  source: "official",
  series: "2025-june",
  sourceUrl: "https://www.cambridgeinternational.org/Images/740340-mathematics-9709-june-2025-grade-threshold-table.pdf",
  publishedAt: "2025-08-12",
  accessedAt: "2026-07-22",
  sourceDocumentHash: "97d20864ca653e7a772eddc9950ecc1dc55b2ed6e506d72f181786707bd025c3",
  verificationStatus: "verified",
};

// option, maximum, component variants, thresholds in printed grade order.
const aLevelRows = [
  ["AC", 250, ["15", "35", "45", "55"], [225, 201, 175, 136, 97, 59]],
  ["AX", 250, ["11", "31", "41", "51"], [224, 198, 171, 133, 95, 57]],
  ["AY", 250, ["12", "32", "42", "52"], [224, 198, 171, 138, 105, 72]],
  ["AZ", 250, ["13", "33", "43", "53"], [223, 197, 170, 131, 93, 55]],
  ["CC", 250, ["15", "35", "55", "65"], [226, 202, 178, 139, 101, 63]],
  ["CX", 250, ["11", "31", "51", "61"], [221, 195, 169, 133, 97, 61]],
  ["CY", 250, ["12", "32", "52", "62"], [224, 198, 169, 132, 95, 59]],
  ["CZ", 250, ["13", "33", "53", "63"], [219, 195, 171, 134, 97, 61]],
  ["DN", 250, ["35", "55", "86"], [220, 193, 166, 128, 91, 54]],
  ["DX", 250, ["31", "51", "84"], [208, 185, 162, 126, 90, 55]],
  ["DY", 250, ["32", "52", "85"], [220, 190, 159, 123, 87, 51]],
  ["DZ", 250, ["33", "53", "86"], [220, 191, 162, 125, 88, 52]],
  ["EN", 250, ["35", "45", "89"], [224, 198, 171, 133, 96, 59]],
  ["EX", 250, ["31", "41", "87"], [208, 185, 162, 125, 88, 52]],
  ["EY", 250, ["32", "42", "88"], [222, 194, 165, 132, 100, 68]],
  ["EZ", 250, ["33", "43", "89"], [222, 195, 167, 130, 93, 56]],
  ["GN", 250, ["35", "65", "89"], [224, 199, 174, 137, 100, 63]],
  ["GX", 250, ["31", "61", "87"], [204, 182, 160, 125, 90, 56]],
  ["GY", 250, ["32", "62", "88"], [222, 194, 163, 127, 91, 55]],
  ["GZ", 250, ["33", "63", "89"], [218, 193, 168, 132, 97, 62]],
  ["HN", 250, ["35", "55", "96"], [217, 192, 167, 131, 96, 61]],
  ["HY", 250, ["32", "52", "95"], [207, 179, 151, 117, 84, 51]],
  ["HZ", 250, ["33", "53", "96"], [217, 190, 163, 128, 93, 59]],
  ["IN", 250, ["35", "45", "99"], [217, 191, 165, 130, 96, 62]],
  ["IX", 250, ["31", "41", "97"], [214, 190, 166, 130, 94, 58]],
  ["IY", 250, ["32", "42", "98"], [214, 190, 166, 135, 105, 75]],
  ["IZ", 250, ["33", "43", "99"], [215, 188, 161, 127, 93, 59]],
  ["KN", 250, ["35", "65", "99"], [216, 192, 168, 134, 100, 66]],
  ["KX", 250, ["31", "61", "97"], [210, 187, 164, 130, 96, 62]],
  ["KY", 250, ["32", "62", "98"], [216, 190, 164, 130, 96, 62]],
  ["KZ", 250, ["33", "63", "99"], [210, 186, 162, 129, 97, 65]],
];

const asRows = [
  ["P3", 75, ["59"], [64, 59, 49, 39, 30]],
  ["S1", 125, ["11", "21"], [97, 82, 63, 45, 27]],
  ["S2", 125, ["11", "41"], [102, 87, 67, 47, 27]],
  ["S3", 125, ["11", "51"], [100, 85, 66, 47, 29]],
  ["S4", 125, ["12", "22"], [99, 83, 64, 45, 27]],
  ["S5", 125, ["12", "42"], [104, 91, 75, 60, 45]],
  ["S6", 125, ["12", "52"], [100, 85, 65, 46, 27]],
  ["S7", 125, ["13", "23"], [100, 85, 65, 45, 26]],
  ["S8", 125, ["13", "43"], [103, 88, 67, 46, 25]],
  ["S9", 125, ["13", "53"], [104, 90, 69, 49, 29]],
  ["SA", 125, ["15", "25"], [102, 85, 65, 45, 25]],
  ["SB", 125, ["15", "45"], [105, 89, 68, 47, 27]],
  ["SC", 125, ["15", "55"], [105, 91, 70, 50, 30]],
];

const specialAlevelRows = [
  ["P4", 150, ["59", "60"], [138, 128, 118, 101, 84, 67]],
];

const regularAlevel = new Set(["AC", "AX", "AY", "AZ", "CC", "CX", "CY", "CZ"]);
const routeId = option => option.startsWith("S")
  ? `award:caie:9709:2023-2025:as:${option}`
  : regularAlevel.has(option)
    ? `award:caie:9709:2023-2025:al:same-series:${option}`
    : option === "P3" || option === "P4"
      ? `award:caie:9709:2023-2025:special-composite:${option}`
      : `award:caie:9709:2023-2025:al:staged:${option}`;

const makeRow = ([optionCode, maximumMarkAfterWeighting, componentVariants, values], grades, pdfPage) => ({
  ...source,
  routeId: routeId(optionCode),
  optionCode,
  componentVariants,
  maximumMarkAfterWeighting,
  thresholds: Object.fromEntries(grades.map((grade, index) => [grade, values[index]])),
  sourceRowId: `CAIE-9709-2025-JUNE-P${pdfPage}-ROW-${optionCode}`,
  printedPage: pdfPage,
  pdfPage,
});

const boundaries = [
  ...aLevelRows.map(row => makeRow(row, ["A*", "A", "B", "C", "D", "E"], 2)),
  ...specialAlevelRows.map(row => makeRow(row, ["A*", "A", "B", "C", "D", "E"], 2)),
  ...asRows.map(row => makeRow(row, ["a", "b", "c", "d", "e"], ["S3", "S4", "S5", "S6", "S7", "S8", "S9", "SA", "SB", "SC"].includes(row[0]) ? 3 : 2)),
].sort((a, b) => a.optionCode.localeCompare(b.optionCode));

const v2Path = resolve("src/data/official/academic-results-v2/caie-9709-2025.json");
await mkdir(resolve("src/data/official/academic-results-v2"), { recursive: true });
await writeFile(v2Path, `${JSON.stringify({ boundaries }, null, 2)}\n`);
console.log(`Wrote ${boundaries.length} complete Academic Results V2 rows; the legacy calculator catalog remains unchanged.`);
