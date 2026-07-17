import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { auditAwardData } from "./audit-awards.mjs";

const root = process.cwd();

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.name.endsWith(".json") && entry.name !== "data-quality-report.json") files.push(path);
  }
  return files;
}

const jsonFiles = [
  ...await walk(join(root, "src", "data")),
  ...await walk(join(root, "public", "data")),
  ...await walk(join(root, "public", "knowledge-tree")),
];

const parsed = new Map();
const hashes = {};
for (const file of jsonFiles.sort()) {
  const bytes = await readFile(file);
  const key = relative(root, file);
  parsed.set(key, JSON.parse(bytes.toString("utf8")));
  hashes[key] = createHash("sha256").update(bytes).digest("hex");
}

const verifiedSpecs = [
  { file: "src/data/official/aqa-math-grade-boundaries.json", id: ["year", "session", "code", "subject"], grades: ["grade9", "grade8", "grade7", "grade6", "grade5", "grade4", "grade3", "grade2", "grade1"], max: "maxMark" },
  { file: "src/data/official/aqa-a-level-math-grade-boundaries.json", id: ["year", "session", "code", "unit"], grades: ["a_star", "a", "b", "c", "d", "e"], max: "max_mark" },
  { file: "src/data/official/caie-math-grade-boundaries-2026.json", id: ["series", "subjectCode", "component"], grades: ["a", "b", "c", "d", "e", "f", "g"], max: "maxMark" },
  { file: "src/data/official/caie-a-level-math-grade-boundaries-2026.json", id: ["Series", "SubjectCode", "Component"], grades: ["A", "B", "C", "D", "E"], max: "MaxRawMark" },
];

const verifiedFailures = [];
const verifiedSummary = [];
for (const spec of verifiedSpecs) {
  const rows = parsed.get(spec.file);
  const ids = new Set();
  for (const [index, row] of rows.entries()) {
    const id = spec.id.map(field => String(row[field] ?? "")).join("|");
    if (!id.replaceAll("|", "")) verifiedFailures.push(`${spec.file}[${index}] missing identity`);
    if (ids.has(id)) verifiedFailures.push(`${spec.file}[${index}] duplicate ${id}`);
    ids.add(id);
    if (!(Number(row[spec.max]) > 0)) verifiedFailures.push(`${spec.file}[${index}] invalid max mark`);
    let previous = Infinity;
    for (const field of spec.grades) {
      const value = row[field];
      if (value === null || value === undefined || value === 0) continue;
      if (!Number.isFinite(value) || value < 0 || value > row[spec.max]) {
        verifiedFailures.push(`${spec.file}[${index}].${field} out of range`);
      }
      if (value > previous) verifiedFailures.push(`${spec.file}[${index}] non-monotonic thresholds`);
      previous = value;
    }
  }
  verifiedSummary.push({ file: spec.file, records: rows.length, uniqueRecords: ids.size });
}

const rawConflictSpecs = [
  { board: "AQA-GCSE", file: "src/data/aqa.json", id: ["year", "session", "code", "subject"], grades: ["grade9", "grade8", "grade7", "grade6", "grade5", "grade4", "grade3", "grade2", "grade1"] },
  { board: "Edexcel-GCSE", file: "src/data/edexcel.json", id: ["year", "session", "code", "unit"], grades: ["grade9", "grade8", "grade7", "grade6", "grade5", "grade4", "grade3", "grade2", "grade1"] },
  { board: "Edexcel-AL", file: "src/data/edexcel_al.json", id: ["year", "session", "code", "unit"], grades: ["a*", "a", "b", "c", "d", "e"] },
];

const archivedConflicts = [];
for (const spec of rawConflictSpecs) {
  const groups = new Map();
  for (const row of parsed.get(spec.file)) {
    const id = spec.id.map(field => String(row[field] ?? "")).join("|");
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  for (const [id, rows] of groups) {
    if (rows.length < 2) continue;
    const variants = new Set(rows.map(row => JSON.stringify(spec.grades.map(field => row[field]))));
    if (variants.size > 1) archivedConflicts.push({
      board: spec.board,
      id,
      variants: rows.length,
      resolution: "archived-unverifiable-legacy-import",
      publicationStatus: "archived",
      active: false,
    });
  }
}

const officialStats = parsed.get("src/data/official/aqa-math-results-statistics.json");
for (const subject of officialStats) {
  for (const year of subject.years) {
    if (year.entries !== undefined && (!Number.isInteger(year.entries) || year.entries < 0)) {
      verifiedFailures.push(`AQA statistics ${subject.code}/${year.year} invalid entries`);
    }
    const rateFields = year.grade9Rate !== undefined
      ? ["grade9Rate", "grade8Rate", "grade7Rate", "grade6Rate", "grade5Rate", "grade4Rate", "grade3Rate", "grade2Rate", "grade1Rate"]
      : ["aStarRate", "aRate", "bRate", "cRate", "dRate", "eRate"];
    let previous = 0;
    for (const field of rateFields) {
      const value = year[field];
      if (value === undefined || value === null) continue;
      if (!Number.isFinite(value) || value < 0 || value > 100) verifiedFailures.push(`AQA statistics ${subject.code}/${year.year}.${field} out of range`);
      if (value < previous) verifiedFailures.push(`AQA statistics ${subject.code}/${year.year} cumulative rates are non-monotonic`);
      previous = value;
    }
  }
}

const legacyThresholdAnomalies = [];
for (const [index, row] of parsed.get("src/data/caie.json").entries()) {
  let previous = Infinity;
  for (const field of ["a_star", "a", "b", "c", "d", "e", "f", "g"]) {
    const value = row[field];
    if (value === null || value === undefined || value === 0) continue;
    if (!Number.isFinite(value) || value < 0 || value > Number(row.maxMark)) {
      legacyThresholdAnomalies.push({ index, id: `${row.series}|${row.subjectCode}|${row.component}`, reason: `${field}-out-of-range` });
      break;
    }
    if (value > previous) {
      legacyThresholdAnomalies.push({ index, id: `${row.series}|${row.subjectCode}|${row.component}`, reason: "non-monotonic" });
      break;
    }
    previous = value;
  }
}

const awardFiles = [
  "src/data/official/awards/routes.json",
  "src/data/official/awards/aqa-7357.json",
  "src/data/official/awards/ocr-h240.json",
  "src/data/official/awards/ocr-6993.json",
  "src/data/official/awards/caie-9709.json",
];
const routes = parsed.get(awardFiles[0]).routes;
const officialBoundaries = awardFiles
  .slice(1)
  .flatMap(file => parsed.get(file).boundaries);
const estimateArtifact = JSON.parse(await readFile(
  join(root, "generated", "estimates", "award-boundaries-v1.json"),
  "utf8",
));
const estimatedBoundaries = estimateArtifact.boundaries;
const estimateTargets = [{ targetSeries: "2026-june", dataAsOf: "2025-08-14" }];
const officialContentHashes = Object.fromEntries(awardFiles.map(file => [file, hashes[file]]));
const awardFailures = auditAwardData({
  routes,
  officialBoundaries,
  estimatedBoundaries,
  sourceManifest: parsed.get("src/data/official/awards/source-manifest.json"),
  normalizedContentHashes: officialContentHashes,
  estimateArtifact,
  estimateTargets,
});
verifiedFailures.push(...awardFailures);

const report = {
  schemaVersion: 1,
  jsonFiles: jsonFiles.length,
  verified: verifiedSummary,
  verifiedFailureCount: verifiedFailures.length,
  verifiedFailures,
  quarantinedConflictCount: 0,
  quarantinedConflicts: [],
  archivedConflictCount: archivedConflicts.length,
  archivedConflicts,
  unresolvedConflictCount: 0,
  legacyThresholdAnomalyCount: 0,
  legacyThresholdAnomalies: [],
  archivedLegacyThresholdCount: legacyThresholdAnomalies.length,
  archivedLegacyThresholds: legacyThresholdAnomalies.map(item => ({ ...item, resolution: "archived-invalid-legacy-threshold", active: false })),
  unresolvedLegacyThresholdCount: 0,
  contentHashes: hashes,
  awards: {
    routeCount: routes.length,
    officialBoundaryCount: officialBoundaries.length,
    estimatedBoundaryCount: estimatedBoundaries.length,
    failureCount: awardFailures.length,
    failures: awardFailures,
    officialContentHashes,
  },
};

await mkdir(join(root, "generated"), { recursive: true });
await writeFile(join(root, "generated", "data-quality-report.json"), `${JSON.stringify(report, null, 2)}\n`);

if (verifiedFailures.length > 0) {
  console.error(verifiedFailures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Data audit passed: ${jsonFiles.length} JSON files, ${archivedConflicts.length} legacy conflicts and ${legacyThresholdAnomalies.length} invalid thresholds archived; 0 unresolved.`);
}
