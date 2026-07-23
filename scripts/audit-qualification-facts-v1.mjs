import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const batch = JSON.parse(await readFile(join(root, "data/candidates/qualification-facts-v1/caie-advanced-sciences-20260723.json"), "utf8"));
const fail = message => {
  throw new Error(`Qualification Facts V1 audit failed: ${message}`);
};
const unique = (values, label) => {
  if (new Set(values).size !== values.length) fail(`${label} must be unique`);
};

if (batch.schemaVersion !== "1.0.0" || batch.activationStatus !== "candidate-only") fail("batch must remain candidate-only");
if (JSON.stringify(batch).includes("owner-approved")) fail("candidate batch cannot contain owner-approved state");
if (batch.reviewStatus !== "codex-reviewed") fail("batch must be Codex-reviewed");
if (batch.qualifications.length !== 3) fail("expected exactly three science qualifications");
if (batch.sources.length !== 4) fail("expected exactly four official sources");
unique(batch.sources.map(source => source.sourceId), "source IDs");
unique(batch.qualifications.map(record => record.qualificationVersionId), "qualification version IDs");

const sourceIds = new Set(batch.sources.map(source => source.sourceId));
for (const source of batch.sources) {
  if (source.verificationStatus !== "codex-reviewed") fail(`${source.sourceId} is not Codex-reviewed`);
  if (!/^https:\/\/(www\.)?cambridgeinternational\.org\//.test(source.officialUrl)) fail(`${source.sourceId} is not an official Cambridge URL`);
  if (!/^[a-f0-9]{64}$/.test(source.sourceDocumentHash)) fail(`${source.sourceId} has no verified SHA-256`);
  if (!Number.isInteger(source.pageCount) || source.pageCount < 1) fail(`${source.sourceId} has an invalid page count`);
}
for (const qualification of batch.qualifications) {
  if (qualification.components.length !== 5) fail(`${qualification.qualificationVersionId} must have five Paper definitions`);
  unique(qualification.components.map(component => component.paperId), `${qualification.qualificationVersionId} paper IDs`);
  if (qualification.sourceIds.some(sourceId => !sourceIds.has(sourceId))) fail(`${qualification.qualificationVersionId} references an unknown source`);
  const asWeight = qualification.components.reduce((sum, component) => sum + (component.asWeightPercent ?? 0), 0);
  const aLevelWeight = qualification.components.reduce((sum, component) => sum + (component.aLevelWeightPercent ?? 0), 0);
  if (asWeight !== 100 || aLevelWeight !== 100) fail(`${qualification.qualificationVersionId} weights must total 100`);
}
if (batch.sharedRules.routes.length !== 3) fail("expected AS, staged A Level and linear A Level routes");
if (batch.sharedRules.carryForward.maximumAgeMonths !== 13
  || batch.sharedRules.carryForward.maximumUsesForAsLevel !== 2
  || batch.sharedRules.carryForward.marchToJuneAllowed !== false) {
  fail("carry-forward constraints do not match the official supplement");
}
if (batch.unresolved.some(gap => gap.severity === "P0")) fail("P0 gaps are not permitted");
if (batch.review.externalModelReview.acceptedResult !== false
  || batch.review.externalModelReview.status !== "attempted-no-accepted-result") {
  fail("an incomplete external review must not be represented as accepted");
}
if (batch.review.candidateConflicts !== 0) fail("candidate conflicts must be zero");

console.log(`Qualification Facts V1 audit passed: ${batch.qualifications.length} qualifications, ${batch.sources.length} hash-backed official sources, ${batch.unresolved.length} explicit gaps.`);
