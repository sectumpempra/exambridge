import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const scopePath = join(root, "data", "candidates", "academic-results-v2", "scope.json");
const activePath = join(root, "public", "data", "academic-results-v2", "manifest.json");
const generatedDirectory = join(root, "generated", "academic-results-v2");
const failures = [];

const expectedAwardIds = [
  "award:caie:0580",
  "award:caie:9709",
  "award:caie:9231",
  "award:pearson:4ma1",
  "award:pearson:ial-mathematics",
  "award:pearson:ial-further-mathematics",
  "award:aqa:7357",
  "award:aqa:7367",
  "award:ocr:h240",
  "award:ocr:h245",
  "award:ocr:h640",
  "award:ocr:6993",
  "award:pearson:8ma0",
];

const scope = JSON.parse(await readFile(scopePath, "utf8"));
const active = JSON.parse(await readFile(activePath, "utf8"));

if (scope.schemaVersion !== "1.0.0") failures.push("scope schemaVersion must be 1.0.0");
if (!/^[a-f0-9]{40}$/.test(scope.baselineCommit ?? "")) failures.push("scope baselineCommit must be a full commit hash");
if (scope.startYear !== 2019) failures.push("scope startYear must remain 2019");
if (!Number.isInteger(scope.latestYear) || scope.latestYear < scope.startYear) failures.push("scope latestYear is invalid");
if (scope.activationPolicy !== "owner-approval-required") failures.push("scope activation policy must require owner approval");

const qualifications = Array.isArray(scope.qualifications) ? scope.qualifications : [];
const awardIds = qualifications.map(item => item.awardQualificationId);
if (new Set(awardIds).size !== awardIds.length) failures.push("scope contains duplicate awardQualificationId values");
if (JSON.stringify([...awardIds].sort()) !== JSON.stringify([...expectedAwardIds].sort())) {
  failures.push("scope must contain exactly the 13 approved award qualifications");
}
if (JSON.stringify(scope).includes("8M1")) failures.push("scope must not contain the withdrawn 8M1 typo");

for (const qualification of qualifications) {
  for (const field of ["awardQualificationId", "currentKnowledgeQualificationVersionId", "board", "subjectCode", "label", "processingPolicy"]) {
    if (typeof qualification[field] !== "string" || qualification[field].length === 0) failures.push(`${qualification.awardQualificationId ?? "qualification"} missing ${field}`);
  }
  const expectedPolicy = qualification.board === "AQA" ? "local-only" : "deepseek-candidate";
  if (qualification.processingPolicy !== expectedPolicy) failures.push(`${qualification.awardQualificationId} must use ${expectedPolicy}`);
}

if (active.schemaVersion !== "2.0.0") failures.push("active manifest schemaVersion must be 2.0.0");
for (const collection of ["sources", "boundaries", "statistics", "awardRules", "difficultyProfiles"]) {
  if (!Array.isArray(active[collection])) failures.push(`active manifest ${collection} must be an array`);
  for (const [index, record] of (active[collection] ?? []).entries()) {
    if (record.verificationStatus !== "owner-approved") failures.push(`active ${collection}[${index}] must be owner-approved`);
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

for (const directory of ["app", "src", "server"]) {
  for (const file of await walk(join(root, directory))) {
    const text = await readFile(file, "utf8");
    if (/data[\\/]candidates/.test(text) || /data\/candidates/.test(text)) {
      failures.push(`runtime source imports candidate data: ${relative(root, file)}`);
    }
  }
}

const trackedPdfs = execFileSync("git", ["ls-files", "*.pdf"], { cwd: root, encoding: "utf8" })
  .split("\n").filter(Boolean);
if (trackedPdfs.length > 0) failures.push(`repository tracks ${trackedPdfs.length} PDF file(s)`);

const coverageCells = qualifications.flatMap(qualification =>
  Array.from({ length: scope.latestYear - scope.startYear + 1 }, (_, offset) => ({
    awardQualificationId: qualification.awardQualificationId,
    knowledgeQualificationVersionId: qualification.currentKnowledgeQualificationVersionId,
    year: scope.startYear + offset,
    expectedSeriesStatus: "official-calendar-review-required",
    boundaryStatus: "pending-research",
    statisticsStatus: "pending-research",
    awardRuleStatus: "pending-research",
  })),
);

const coverageMatrix = {
  schemaVersion: "1.0.0",
  baselineCommit: scope.baselineCommit,
  startYear: scope.startYear,
  latestYear: scope.latestYear,
  qualificationCount: qualifications.length,
  cells: coverageCells,
};

const report = {
  schemaVersion: "1.0.0",
  baselineCommit: scope.baselineCommit,
  targetQualificationCount: qualifications.length,
  coverageCellCount: coverageCells.length,
  activeCounts: {
    sources: active.sources.length,
    boundaries: active.boundaries.length,
    statistics: active.statistics.length,
    awardRules: active.awardRules.length,
    difficultyProfiles: active.difficultyProfiles.length,
  },
  trackedPdfCount: trackedPdfs.length,
  failureCount: failures.length,
  failures,
};

await mkdir(generatedDirectory, { recursive: true });
await writeFile(join(generatedDirectory, "coverage-matrix.json"), `${JSON.stringify(coverageMatrix, null, 2)}\n`);
await writeFile(join(generatedDirectory, "baseline-audit.json"), `${JSON.stringify(report, null, 2)}\n`);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Academic Results V2 audit passed: ${qualifications.length} qualifications, ${coverageCells.length} year cells, ${trackedPdfs.length} tracked PDFs.`);
}
