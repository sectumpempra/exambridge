import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { createServer } from "vite";
import { buildAcademicResultsCoverageMatrix, loadAcademicResultsCoverageInputs } from "./lib/academic-results-v2-coverage.mjs";
import {
  buildCoverageExpectationPolicies,
  buildCoverageMigrationReport,
  buildSparseCoverageMatrices,
} from "./lib/academic-results-v3-coverage.mjs";

const root = process.cwd();
const scopePath = join(root, "data", "candidates", "academic-results-v2", "scope.json");
const identityPath = join(root, "data", "candidates", "academic-results-v2", "qualification-identities.json");
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
const identityCatalog = JSON.parse(await readFile(identityPath, "utf8"));
const active = JSON.parse(await readFile(activePath, "utf8"));

async function loadAcademicSchemas() {
  const server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
    logLevel: "silent",
  });
  try {
    return await server.ssrLoadModule("/src/domain-v2/academic-results/schema.ts");
  } finally {
    await server.close();
  }
}

const academicSchemas = await loadAcademicSchemas();

const identityParse = academicSchemas.QualificationIdentityCatalogV2Schema.safeParse(identityCatalog);
if (!identityParse.success) {
  failures.push(`qualification identity schema failure: ${identityParse.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
}

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

const identityAwardIds = (identityCatalog.identities ?? []).map(identity => identity.awardQualificationId);
if (JSON.stringify([...identityAwardIds].sort()) !== JSON.stringify([...expectedAwardIds].sort())) {
  failures.push("qualification identity catalog must contain exactly the 13 approved award qualifications");
}

const compactCourseCatalog = JSON.parse(await readFile(join(root, "src", "course-context", "courseCatalog.generated.json"), "utf8"));
const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const catalogQualificationIds = new Set((compactCourseCatalog.entries ?? []).map(row => `qual:${slug(row[0])}:${slug(row[1])}:${slug(row[2])}`));
const knowledgeManifest = JSON.parse(await readFile(join(root, "public", "data", "knowledge-v5", "manifest.json"), "utf8"));
const knowledgeMappingCodes = new Set((knowledgeManifest.mappings ?? []).map(mapping => mapping.code));
const claimedCatalogIds = new Set();
for (const identity of identityCatalog.identities ?? []) {
  const expectedPolicy = identity.board === "AQA" ? "local-only" : "deepseek-candidate";
  if (identity.processingPolicy !== expectedPolicy) failures.push(`${identity.awardQualificationId} identity must use ${expectedPolicy}`);
  for (const catalogQualificationId of identity.catalogQualificationIds ?? []) {
    if (!catalogQualificationIds.has(catalogQualificationId)) failures.push(`${identity.awardQualificationId} references unknown catalog qualification ${catalogQualificationId}`);
    if (claimedCatalogIds.has(catalogQualificationId)) failures.push(`catalog qualification ${catalogQualificationId} is claimed by multiple award identities`);
    claimedCatalogIds.add(catalogQualificationId);
  }
  for (const knowledgeMappingCode of identity.knowledgeMappingCodes ?? []) {
    if (!knowledgeMappingCodes.has(knowledgeMappingCode)) failures.push(`${identity.awardQualificationId} references unknown knowledge mapping ${knowledgeMappingCode}`);
  }
}

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
const activeParse = academicSchemas.AcademicResultsManifestV2Schema.safeParse(active);
if (!activeParse.success) failures.push(`active manifest schema failure: ${activeParse.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);

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

const coverageInputs = await loadAcademicResultsCoverageInputs(root);
const candidate = coverageInputs.candidate;
const candidateCollections = [
  ["sources", academicSchemas.SourceEvidenceV1Schema, "sourceId"],
  ["boundaries", academicSchemas.GradeBoundaryV2Schema, "boundaryId"],
  ["statistics", academicSchemas.GradeStatisticsV2Schema, "statisticsId"],
  ["awardRules", academicSchemas.QualificationAwardRuleV2Schema, "ruleId"],
];
for (const [collectionName, schema, idField] of candidateCollections) {
  const records = candidate[collectionName];
  if (!Array.isArray(records)) {
    failures.push(`candidate ${collectionName} must be an array`);
    continue;
  }
  const ids = new Set();
  for (const [index, record] of records.entries()) {
    const parsed = schema.safeParse(record);
    if (!parsed.success) failures.push(`candidate ${collectionName}[${index}] schema failure: ${parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    const id = record?.[idField];
    if (typeof id !== "string") continue;
    if (ids.has(id)) failures.push(`candidate ${collectionName} contains duplicate ${idField} ${id}`);
    ids.add(id);
  }
}

const candidateSourceIds = new Set((candidate.sources ?? []).map(source => source.sourceId));
for (const identity of identityCatalog.identities ?? []) {
  for (const sourceId of identity.sourceIds ?? []) {
    if (!candidateSourceIds.has(sourceId)) failures.push(`${identity.awardQualificationId} identity references unknown source ${sourceId}`);
  }
  const ruleVersionIds = new Set((candidate.awardRules ?? [])
    .filter(rule => rule.awardQualificationId === identity.awardQualificationId)
    .map(rule => rule.qualificationVersionId));
  for (const version of identity.qualificationVersions ?? []) {
    if (!ruleVersionIds.has(version.qualificationVersionId)) failures.push(`${identity.awardQualificationId} identity version ${version.qualificationVersionId} has no award-rule record`);
  }
}
for (const collectionName of ["boundaries", "statistics", "awardRules"]) {
  for (const record of candidate[collectionName] ?? []) {
    for (const sourceId of record.sourceIds ?? []) {
      if (!candidateSourceIds.has(sourceId)) failures.push(`candidate ${collectionName} ${record.boundaryId ?? record.statisticsId ?? record.ruleId} references unknown source ${sourceId}`);
    }
  }
}

const boundaryIdentity = new Set();
for (const boundary of candidate.boundaries ?? []) {
  const key = [boundary.awardQualificationId, boundary.qualificationVersionId, boundary.year, boundary.series, boundary.routeId, boundary.tier ?? "", boundary.optionCode ?? "", boundary.region ?? "", boundary.componentCode ?? "", boundary.boundaryScope].join("|");
  if (boundaryIdentity.has(key)) failures.push(`candidate boundaries contain duplicate canonical identity ${key}`);
  boundaryIdentity.add(key);
}

const coverageMatrix = await buildAcademicResultsCoverageMatrix(coverageInputs.scope, coverageInputs.candidate);
const policyCatalog = buildCoverageExpectationPolicies(coverageInputs.scope, coverageInputs.candidate, identityCatalog);
const sparseMatrices = buildSparseCoverageMatrices(coverageInputs.scope, coverageInputs.candidate, policyCatalog);
const migrationReport = buildCoverageMigrationReport(coverageMatrix, sparseMatrices);

const sparseArtifacts = [
  ["coverage expectation policies", academicSchemas.CoverageExpectationPolicyCatalogV1Schema, policyCatalog],
  ["boundary coverage matrix", academicSchemas.BoundaryCoverageMatrixV1Schema, sparseMatrices.boundaries],
  ["statistics coverage matrix", academicSchemas.StatisticsCoverageMatrixV1Schema, sparseMatrices.statistics],
  ["rule coverage matrix", academicSchemas.RuleCoverageMatrixV1Schema, sparseMatrices.rules],
];
for (const [label, schema, value] of sparseArtifacts) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) failures.push(`${label} schema failure: ${parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
}

if (sparseMatrices.statistics.blockingCellCount > 0) failures.push("unexpected or conflicting Grade Statistics records must be adjudicated");
if (sparseMatrices.boundaries.blockingCellCount > 0) failures.push("unexpected or conflicting boundary records must be adjudicated");
if (sparseMatrices.rules.blockingCellCount > 0) failures.push("unexpected or conflicting award-rule records must be adjudicated");

const report = {
  schemaVersion: "1.0.0",
  baselineCommit: scope.baselineCommit,
  targetQualificationCount: qualifications.length,
  qualificationIdentityCount: identityCatalog.identities?.length ?? 0,
  coverageCellCount: coverageMatrix.cells.length,
  expectedCoverageCellCount: coverageMatrix.expectedCellCount,
  unresolvedCoverageCellCount: coverageMatrix.unresolvedCellCount,
  sparseCoverage: {
    boundaries: {
      expected: sparseMatrices.boundaries.expectedCellCount,
      satisfied: sparseMatrices.boundaries.satisfiedCellCount,
      explainedUnavailable: sparseMatrices.boundaries.explainedUnavailableCellCount,
      pending: sparseMatrices.boundaries.pendingCellCount,
      unexpected: sparseMatrices.boundaries.unexpectedRecordCount,
      blocking: sparseMatrices.boundaries.blockingCellCount,
    },
    statistics: {
      expected: sparseMatrices.statistics.expectedCellCount,
      satisfied: sparseMatrices.statistics.satisfiedCellCount,
      explainedUnavailable: sparseMatrices.statistics.explainedUnavailableCellCount,
      pending: sparseMatrices.statistics.pendingCellCount,
      unexpected: sparseMatrices.statistics.unexpectedRecordCount,
      blocking: sparseMatrices.statistics.blockingCellCount,
      blocksRuleMaturity: false,
    },
    rules: {
      expected: sparseMatrices.rules.expectedCellCount,
      satisfied: sparseMatrices.rules.satisfiedCellCount,
      pending: sparseMatrices.rules.pendingCellCount,
      unexpected: sparseMatrices.rules.unexpectedRecordCount,
      blocking: sparseMatrices.rules.blockingCellCount,
    },
  },
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
await Promise.all([
  writeFile(join(generatedDirectory, "coverage-matrix.json"), `${JSON.stringify(coverageMatrix, null, 2)}\n`),
  writeFile(join(generatedDirectory, "legacy-combined-coverage.json"), `${JSON.stringify(coverageMatrix, null, 2)}\n`),
  writeFile(join(generatedDirectory, "coverage-expectation-policies.json"), `${JSON.stringify(policyCatalog, null, 2)}\n`),
  writeFile(join(generatedDirectory, "boundary-coverage-matrix.json"), `${JSON.stringify(sparseMatrices.boundaries, null, 2)}\n`),
  writeFile(join(generatedDirectory, "statistics-coverage-matrix.json"), `${JSON.stringify(sparseMatrices.statistics, null, 2)}\n`),
  writeFile(join(generatedDirectory, "rule-coverage-matrix.json"), `${JSON.stringify(sparseMatrices.rules, null, 2)}\n`),
  writeFile(join(generatedDirectory, "coverage-migration-report.json"), `${JSON.stringify(migrationReport, null, 2)}\n`),
  writeFile(join(generatedDirectory, "baseline-audit.json"), `${JSON.stringify(report, null, 2)}\n`),
]);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Academic Results V2 audit passed: ${qualifications.length} qualifications; sparse coverage boundary/statistics/rules pending ${sparseMatrices.boundaries.pendingCellCount}/${sparseMatrices.statistics.pendingCellCount}/${sparseMatrices.rules.pendingCellCount}; legacy unresolved ${coverageMatrix.unresolvedCellCount}; ${trackedPdfs.length} tracked PDFs.`);
}
