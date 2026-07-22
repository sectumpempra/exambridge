import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const root = process.cwd();
const sourceRoot = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  throw new Error("Usage: node scripts/import-university-admissions-v1-candidate.mjs <sol-final-handoff-directory>");
}

const readJson = async relativePath => JSON.parse(await readFile(join(sourceRoot, relativePath), "utf8"));
const readJsonl = async relativePath => (await readFile(join(sourceRoot, relativePath), "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${relativePath}:${index + 1}: ${error.message}`);
    }
  });
const sha256 = value => createHash("sha256").update(value).digest("hex");

const manifestText = await readFile(join(sourceRoot, "manifest.sha256"), "utf8");
const manifestRows = manifestText.split(/\r?\n/).filter(Boolean).map(line => {
  const match = /^([a-f0-9]{64})\s{2}(.+)$/.exec(line);
  if (!match) throw new Error(`Invalid source manifest row: ${line}`);
  return { hash: match[1], relativePath: match[2] };
});
for (const row of manifestRows) {
  const content = await readFile(join(sourceRoot, row.relativePath));
  if (sha256(content) !== row.hash) throw new Error(`Source manifest hash mismatch: ${row.relativePath}`);
}

const sourceValidation = await readJson("audit/validation-report.json");
if (sourceValidation.result !== "pass" || sourceValidation.errors?.length) {
  throw new Error("Source handoff validation did not pass");
}

const institutions = await readJson("codex-reviewed/institutions.json");
const programmes = await readJsonl("codex-reviewed/programmes.jsonl");
const requirements = await readJsonl("codex-reviewed/requirements.jsonl");
const assessments = await readJsonl("codex-reviewed/assessments.jsonl");
const programmeAssessmentLinks = await readJsonl("codex-reviewed/programme-assessment-links.jsonl");
const sources = await readJsonl("codex-reviewed/sources.jsonl");
const unresolved = await readJsonl("audit/unresolved.jsonl");
const rejectedRecords = await readJsonl("audit/rejected-records.jsonl");
const resolvedConflicts = await readJsonl("audit/conflicts-resolved.jsonl");
const sourceCoverage = await readJson("audit/coverage.json");
const deepseekUsage = await readJsonl("provenance/deepseek-usage.jsonl");

const recordCollections = [institutions, programmes, requirements, assessments, programmeAssessmentLinks, sources];
for (const records of recordCollections) {
  for (const record of records) {
    if (record.verificationStatus !== "codex-reviewed") {
      throw new Error(`Status ceiling violated by ${record.requirementId ?? record.programmeId ?? record.sourceId ?? "unknown record"}`);
    }
  }
}
if (deepseekUsage.some(entry => (entry.totalTokens ?? 0) !== 0 || entry.returnedModel)) {
  throw new Error("Handoff claims a DeepSeek result even though the reviewed batch records no completed call");
}

const institutionIds = new Set(institutions.map(row => row.institutionId));
const programmeIds = new Set(programmes.map(row => row.programmeId));
const assessmentIds = new Set(assessments.map(row => row.assessmentId));
const sourceIds = new Set(sources.map(row => row.sourceId));
const unresolvedRecordIds = new Set(unresolved.map(row => row.recordId));
for (const row of programmes) {
  if (!institutionIds.has(row.institutionId)) throw new Error(`Unknown institution for ${row.programmeId}`);
}
for (const row of requirements) {
  if (!institutionIds.has(row.institutionId) || !programmeIds.has(row.programmeId)) {
    throw new Error(`Broken requirement foreign key: ${row.requirementId}`);
  }
}
for (const row of programmeAssessmentLinks) {
  if (!institutionIds.has(row.institutionId) || !programmeIds.has(row.programmeId) || !assessmentIds.has(row.assessmentId)) {
    throw new Error(`Broken assessment-link foreign key: ${row.linkId}`);
  }
}
for (const records of [institutions, programmes, requirements, assessments, programmeAssessmentLinks]) {
  for (const record of records) {
    for (const sourceId of record.sourceIds ?? []) {
      if (!sourceIds.has(sourceId)) throw new Error(`Unknown source ${sourceId}`);
    }
  }
}

const candidate = {
  schemaVersion: "1.0.0",
  batchId: "university-admissions-2027-sol-final-20260722",
  importedAt: "2026-07-23",
  reviewStatus: "codex-reviewed",
  activationStatus: "candidate-only",
  sourceHandoff: {
    directoryName: basename(sourceRoot),
    manifestSha256: sha256(manifestText),
    validationResult: sourceValidation.result,
    maximumImportedStatus: "codex-reviewed",
    deepseekCompletedCalls: 0,
  },
  institutions,
  programmes,
  requirements,
  assessments,
  programmeAssessmentLinks,
  sources,
  quarantine: {
    unresolved,
    rejectedRecords,
    resolvedConflicts,
    unresolvedRecordIds: [...unresolvedRecordIds].sort(),
  },
};

const actualCounts = {
  institutions: institutions.length,
  programmes: programmes.length,
  requirements: requirements.length,
  assessments: assessments.length,
  assessmentLinks: programmeAssessmentLinks.length,
  sources: sources.length,
  unresolved: unresolved.length,
  rejectedRecords: rejectedRecords.length,
  resolvedConflicts: resolvedConflicts.length,
  verifiedRequirements: requirements.filter(row => row.overallOffer?.status === "verified").length,
  notPublishedRequirements: requirements.filter(row => row.overallOffer?.status !== "verified").length,
};
for (const [key, expected] of Object.entries(sourceCoverage.totals)) {
  if (actualCounts[key] !== expected) throw new Error(`Count mismatch for ${key}: ${actualCounts[key]} !== ${expected}`);
}

const outputDirectory = join(root, "data/candidates/university-admissions-v1");
const reportDirectory = join(root, "generated/university-admissions-v1");
await Promise.all([mkdir(outputDirectory, { recursive: true }), mkdir(reportDirectory, { recursive: true })]);
const candidatePath = join(outputDirectory, "candidate.json");
const temporaryCandidatePath = `${candidatePath}.tmp`;
await writeFile(temporaryCandidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
await rename(temporaryCandidatePath, candidatePath);
await writeFile(join(reportDirectory, "import-report.json"), `${JSON.stringify({
  schemaVersion: "1.0.0",
  batchId: candidate.batchId,
  result: "pass",
  counts: actualCounts,
  sourceManifestEntries: manifestRows.length,
  sourceManifestSha256: candidate.sourceHandoff.manifestSha256,
  unresolvedRecordIds: candidate.quarantine.unresolvedRecordIds,
  activationStatus: candidate.activationStatus,
}, null, 2)}\n`);

console.log(`Imported university admissions candidate: ${institutions.length} institutions, ${programmes.length} programmes, ${requirements.length} requirements; ${unresolved.length} unresolved quarantined.`);
