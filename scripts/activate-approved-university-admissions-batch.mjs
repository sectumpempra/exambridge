import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { assertApprovalBatchReady, sha256Json } from "./lib/verified-facts-approval.mjs";

const root = process.cwd();
const batchPath = process.argv[2];
if (!batchPath) {
  throw new Error("Usage: node scripts/activate-approved-university-admissions-batch.mjs <owner-approved-batch.json>");
}

const readJson = async relativePath => JSON.parse(await readFile(join(root, relativePath), "utf8"));
const writeJsonAtomic = async (relativePath, value) => {
  const target = join(root, relativePath);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, target);
};
const selectExact = (records, approvedIds, idField, label) => {
  const selectedIds = new Set(approvedIds);
  const selected = records.filter(record => selectedIds.has(record[idField]));
  if (selected.length !== selectedIds.size) throw new Error(`The approved ${label} set cannot be reconstructed exactly`);
  return selected;
};
const promote = record => ({ ...record, verificationStatus: "owner-approved" });

const batch = assertApprovalBatchReady(await readJson(batchPath), "university-admissions");
const candidate = await readJson(batch.sourceCandidate.path);
if (sha256Json(candidate) !== batch.sourceCandidate.sha256) {
  throw new Error("University candidate snapshot changed after owner review; rebuild and re-approve the batch");
}
if (candidate.sourceHandoff.manifestSha256 !== batch.sourceCandidate.upstreamManifestSha256) {
  throw new Error("University source handoff changed after owner review");
}

const institutions = selectExact(candidate.institutions, batch.scope.institutionIds, "institutionId", "institution");
const programmes = selectExact(candidate.programmes, batch.scope.programmeIds, "programmeId", "programme");
const requirements = selectExact(candidate.requirements, batch.scope.requirementIds, "requirementId", "requirement");
const assessments = selectExact(candidate.assessments, batch.scope.assessmentIds, "assessmentId", "assessment");
const programmeAssessmentLinks = selectExact(
  candidate.programmeAssessmentLinks,
  batch.scope.assessmentLinkIds,
  "linkId",
  "assessment-link",
);
const sources = selectExact(candidate.sources, batch.scope.sourceIds, "sourceId", "source");
const selectedCollections = [institutions, programmes, requirements, assessments, programmeAssessmentLinks, sources];
for (const records of selectedCollections) {
  for (const record of records) {
    if (record.verificationStatus !== "codex-reviewed") {
      throw new Error("University approval scope contains a record outside the Codex-reviewed ceiling");
    }
  }
}

const institutionIds = new Set(institutions.map(record => record.institutionId));
const programmeIds = new Set(programmes.map(record => record.programmeId));
const assessmentIds = new Set(assessments.map(record => record.assessmentId));
const sourceIds = new Set(sources.map(record => record.sourceId));
for (const programme of programmes) {
  if (!institutionIds.has(programme.institutionId)) throw new Error(`Unknown institution for ${programme.programmeId}`);
}
for (const requirement of requirements) {
  if (!institutionIds.has(requirement.institutionId) || !programmeIds.has(requirement.programmeId)) {
    throw new Error(`Broken requirement foreign key: ${requirement.requirementId}`);
  }
}
for (const link of programmeAssessmentLinks) {
  if (!institutionIds.has(link.institutionId)
    || !programmeIds.has(link.programmeId)
    || !assessmentIds.has(link.assessmentId)) {
    throw new Error(`Broken assessment-link foreign key: ${link.linkId}`);
  }
}
for (const records of [institutions, programmes, requirements, assessments, programmeAssessmentLinks]) {
  for (const record of records) {
    for (const sourceId of record.sourceIds ?? []) {
      if (!sourceIds.has(sourceId)) throw new Error(`Unapproved source ${sourceId}`);
    }
  }
}

const activatedAt = new Date().toISOString();
const activeManifest = {
  schemaVersion: "1.0.0",
  activationBatch: batch.batchId,
  approvedAt: batch.approvedAt,
  approvedBy: batch.approvedBy,
  activatedAt,
  sourceCandidate: batch.sourceCandidate,
  institutions: institutions.map(promote),
  programmes: programmes.map(promote),
  requirements: requirements.map(promote),
  assessments: assessments.map(promote),
  programmeAssessmentLinks: programmeAssessmentLinks.map(promote),
  sources: sources.map(promote),
};
const manifestText = `${JSON.stringify(activeManifest, null, 2)}\n`;
const manifestSha256 = createHash("sha256").update(manifestText).digest("hex");
const report = {
  schemaVersion: "1.0.0",
  batchId: batch.batchId,
  activatedAt,
  manifestSha256,
  activeCounts: {
    institutions: institutions.length,
    programmes: programmes.length,
    requirements: requirements.length,
    assessments: assessments.length,
    assessmentLinks: programmeAssessmentLinks.length,
    sources: sources.length,
  },
  exclusionsPreserved: {
    unresolvedRecordIds: batch.excluded.unresolvedRecordIds,
    rejectedRecordCount: batch.excluded.rejectedRecordCount,
  },
};
const activatedBatch = {
  ...batch,
  activationStatus: "activated",
  activatedAt,
  activeManifestSha256: manifestSha256,
};

await Promise.all([
  mkdir(join(root, "data/active/university-admissions-v1/approved-batches"), { recursive: true }),
  mkdir(join(root, "generated/verified-facts-approval/activated"), { recursive: true }),
]);
await Promise.all([
  writeJsonAtomic("data/active/university-admissions-v1/manifest.json", activeManifest),
  writeJsonAtomic("data/active/university-admissions-v1/activation.json", report),
  writeJsonAtomic(`data/active/university-admissions-v1/approved-batches/${batch.batchId}.json`, report),
  writeJsonAtomic(`generated/verified-facts-approval/activated/${batch.batchId}.json`, report),
  writeJsonAtomic(batchPath, activatedBatch),
  writeJsonAtomic(`generated/verified-facts-approval/${basename(batchPath)}`, activatedBatch),
]);

console.log(`Activated exactly ${requirements.length} university requirements from ${batch.batchId}.`);
