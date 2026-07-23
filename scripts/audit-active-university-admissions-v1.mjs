import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256Json } from "./lib/verified-facts-approval.mjs";

const root = process.cwd();
const readJson = async relativePath => JSON.parse(await readFile(join(root, relativePath), "utf8"));
const [active, activation, batch, candidate] = await Promise.all([
  readJson("data/active/university-admissions-v1/manifest.json"),
  readJson("data/active/university-admissions-v1/activation.json"),
  readJson("data/candidates/approval-batches/university-admissions-2027-20260723.json"),
  readJson("data/candidates/university-admissions-v1/candidate.json"),
]);

const failures = [];
if (batch.approvalStatus !== "owner-approved" || batch.activationStatus !== "activated") {
  failures.push("university approval batch is not owner-approved and activated");
}
if (active.activationBatch !== batch.batchId || activation.batchId !== batch.batchId) {
  failures.push("active university data does not identify the approved batch");
}
if (sha256Json(candidate) !== batch.sourceCandidate.sha256) {
  failures.push("university candidate changed after owner approval");
}
if (sha256Json(active) !== batch.activeManifestSha256 || activation.manifestSha256 !== batch.activeManifestSha256) {
  failures.push("active university manifest hash does not match the activated batch");
}

const collections = [
  [active.institutions, batch.scope.institutionIds, "institutionId", "institutions"],
  [active.programmes, batch.scope.programmeIds, "programmeId", "programmes"],
  [active.requirements, batch.scope.requirementIds, "requirementId", "requirements"],
  [active.assessments, batch.scope.assessmentIds, "assessmentId", "assessments"],
  [active.programmeAssessmentLinks, batch.scope.assessmentLinkIds, "linkId", "assessment links"],
  [active.sources, batch.scope.sourceIds, "sourceId", "sources"],
];
for (const [records, expectedIds, idField, label] of collections) {
  const actualIds = records.map(record => record[idField]).sort();
  if (JSON.stringify(actualIds) !== JSON.stringify([...expectedIds].sort())) {
    failures.push(`active ${label} differ from the exact approved scope`);
  }
  if (records.some(record => record.verificationStatus !== "owner-approved")) {
    failures.push(`active ${label} contain a non-owner-approved record`);
  }
}

const activeIds = new Set(collections.flatMap(([records, , idField]) => records.map(record => record[idField])));
for (const unresolvedId of batch.excluded.unresolvedRecordIds) {
  if (activeIds.has(unresolvedId)) failures.push(`quarantined record entered active data: ${unresolvedId}`);
}

const institutionIds = new Set(active.institutions.map(record => record.institutionId));
const programmeIds = new Set(active.programmes.map(record => record.programmeId));
const assessmentIds = new Set(active.assessments.map(record => record.assessmentId));
const sourceIds = new Set(active.sources.map(record => record.sourceId));
for (const programme of active.programmes) {
  if (!institutionIds.has(programme.institutionId)) failures.push(`unknown institution for ${programme.programmeId}`);
}
for (const requirement of active.requirements) {
  if (!institutionIds.has(requirement.institutionId) || !programmeIds.has(requirement.programmeId)) {
    failures.push(`broken requirement foreign key: ${requirement.requirementId}`);
  }
}
for (const link of active.programmeAssessmentLinks) {
  if (!institutionIds.has(link.institutionId)
    || !programmeIds.has(link.programmeId)
    || !assessmentIds.has(link.assessmentId)) {
    failures.push(`broken assessment-link foreign key: ${link.linkId}`);
  }
}
for (const records of [
  active.institutions,
  active.programmes,
  active.requirements,
  active.assessments,
  active.programmeAssessmentLinks,
]) {
  for (const record of records) {
    for (const sourceId of record.sourceIds ?? []) {
      if (!sourceIds.has(sourceId)) failures.push(`unknown active source ${sourceId}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Active University Admissions V1 audit passed: ${active.requirements.length} requirements from ${batch.batchId}.`);
