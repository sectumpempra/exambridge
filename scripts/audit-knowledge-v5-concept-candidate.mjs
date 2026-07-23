import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const activeRoot = path.join(root, "data/active/knowledge-v5");
const candidateRoot = path.join(root, "data/candidates/knowledge-v5-concept-accounting-20260723");
const mappingRoot = path.join(candidateRoot, "mappings");

const failures = [];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

const [
  activeActivation,
  activeMappingFiles,
  candidateMappingFiles,
  ontology,
  tree,
  aqaReview,
  localDispositions,
  residualReview,
  finalConceptAudit,
  pass1,
  finalReview,
  batchReport,
] = await Promise.all([
  readJson(path.join(activeRoot, "activation.json")),
  readdir(path.join(activeRoot, "mappings")),
  readdir(mappingRoot),
  readJson(path.join(candidateRoot, "ontology.json")),
  readJson(path.join(candidateRoot, "knowledge-tree.json")),
  readJson(path.join(candidateRoot, "aqa-local-review.json")),
  readJson(path.join(candidateRoot, "codex-final-dispositions.json")),
  readJson(path.join(candidateRoot, "residual-cue-review.json")),
  readJson(path.join(candidateRoot, "final-post-correction-concept-audit.json")),
  readJson(path.join(candidateRoot, "machine-review-pass-1.json")),
  readJson(path.join(candidateRoot, "final-machine-review.json")),
  readJson(path.join(candidateRoot, "candidate-batch-report.json")),
]);

const activeFiles = activeMappingFiles.filter((file) => file.endsWith(".json")).sort();
const candidateFiles = candidateMappingFiles.filter((file) => file.endsWith(".json")).sort();
if (JSON.stringify(activeFiles) !== JSON.stringify(candidateFiles)) {
  failures.push("Candidate mapping set does not exactly match the 22 active qualification files.");
}
if (candidateFiles.length !== 22) failures.push(`Expected 22 candidate mappings, found ${candidateFiles.length}.`);
if (batchReport.qualificationCount !== candidateFiles.length) {
  failures.push("Candidate report qualification count does not match the candidate mapping set.");
}
const activeSourceBatch = activeActivation.approvalBatch === batchReport.candidateBatch
  ? activeActivation.previousApprovalBatch
  : activeActivation.approvalBatch;
if (activeSourceBatch !== batchReport.sourceBatch) {
  failures.push("Candidate source batch does not match the active approval batch.");
}
if (batchReport.activationStatus !== "not-active-awaiting-owner-approval") {
  failures.push("Candidate batch is not explicitly isolated from active data.");
}
if (pass1.failureCount) failures.push("Pass 1 contains failed batches.");
if (finalReview.failureCount) {
  failures.push("Final machine review contains failed batches.");
}
if (
  localDispositions.unresolvedEntryCount !== finalReview.unresolvedCount
  || localDispositions.unresolvedAfterDisposition !== 0
) {
  failures.push("Final machine-review gaps are not fully covered by local Codex dispositions.");
}
if (aqaReview.externalSourceTransmissionCount !== 0) {
  failures.push("AQA review reports external-source transmission.");
}
if (aqaReview.reviewedAssessableStatementCount !== 591) {
  failures.push("AQA local review statement accounting is incomplete.");
}
if (
  residualReview.failureCount
  || residualReview.unresolvedCount
  || residualReview.additionCount + residualReview.rejectionCount !== residualReview.candidateCount
) {
  failures.push("Residual high-confidence cue review is incomplete.");
}
const residualKey = (item) => [
  item.qualificationVersionId,
  item.statementId,
  item.suggestedNodeId ?? item.nodeId,
  item.evidenceField,
  item.evidenceIndex,
].join("|");
const remainingHighConfidence = finalConceptAudit.issues.filter((issue) => (
  issue.matchKind === "normalized-phrase" && issue.score >= 7
));
const remainingNonAqaKeys = new Set(
  remainingHighConfidence.filter((issue) => issue.board !== "AQA").map(residualKey),
);
const rejectedResidualKeys = new Set(residualReview.rejections.map((item) => item.candidateKey));
const uncoveredResidualKeys = [...remainingNonAqaKeys].filter((key) => !rejectedResidualKeys.has(key));
const staleResidualRejections = [...rejectedResidualKeys].filter((key) => !remainingNonAqaKeys.has(key));
if (uncoveredResidualKeys.length || staleResidualRejections.length) {
  failures.push(
    `Final high-confidence residual cue coverage differs from reviewed rejections: `
    + `${uncoveredResidualKeys.length} uncovered, ${staleResidualRejections.length} stale.`,
  );
}

const treeBytes = `${JSON.stringify(tree, null, 2)}\n`;
if (sha256(treeBytes) !== ontology.treeSha256) failures.push("Candidate tree hash does not match ontology.treeSha256.");
if (ontology.treeVersion !== tree.version) failures.push("Candidate ontology and tree versions differ.");
if (tree.totalNodes !== tree.nodes.length) failures.push("Candidate tree totalNodes is incorrect.");
if (ontology.nodes.length !== tree.nodes.length) failures.push("Candidate ontology/tree node counts differ.");

const ontologyNodeIds = new Set();
for (const node of ontology.nodes) {
  if (ontologyNodeIds.has(node.nodeId)) failures.push(`Duplicate ontology node ${node.nodeId}.`);
  ontologyNodeIds.add(node.nodeId);
  if (node.reviewStatus !== "owner-approved" && node.reviewStatus !== "codex-reviewed") {
    failures.push(`${node.nodeId}: invalid candidate review status ${node.reviewStatus}.`);
  }
}
const treeNodeIds = new Set();
const treeById = new Map();
for (const node of tree.nodes) {
  if (treeNodeIds.has(node.nodeId)) failures.push(`Duplicate tree node ${node.nodeId}.`);
  treeNodeIds.add(node.nodeId);
  treeById.set(node.nodeId, node);
}
for (const nodeId of ontologyNodeIds) {
  if (!treeNodeIds.has(nodeId)) failures.push(`Ontology node ${nodeId} is absent from the candidate tree.`);
}
for (const nodeId of treeNodeIds) {
  if (!ontologyNodeIds.has(nodeId)) failures.push(`Tree node ${nodeId} has no candidate semantics.`);
}
for (const node of tree.nodes) {
  if (node.nodeId === "ROOT") continue;
  if (!node.parentNodeId || !treeById.has(node.parentNodeId)) {
    failures.push(`${node.nodeId}: missing or unknown parent.`);
    continue;
  }
  const seen = new Set([node.nodeId]);
  let cursor = node;
  while (cursor.parentNodeId) {
    if (seen.has(cursor.parentNodeId)) {
      failures.push(`${node.nodeId}: cycle detected through ${cursor.parentNodeId}.`);
      break;
    }
    seen.add(cursor.parentNodeId);
    cursor = treeById.get(cursor.parentNodeId);
    if (!cursor) break;
  }
}

let statementCount = 0;
let linkCount = 0;
let duplicateLinkCount = 0;
let unmappedAssessableStatementCount = 0;
const mappingByFile = new Map();
for (const file of candidateFiles) {
  const mapping = await readJson(path.join(mappingRoot, file));
  mappingByFile.set(file, mapping);
  for (const statement of mapping.statements) {
    statementCount += 1;
    if (statement.statementType === "assessable-content" && statement.conceptLinks.length === 0) {
      unmappedAssessableStatementCount += 1;
      failures.push(`${file}:${statement.statementId}: assessable statement is unmapped.`);
    }
    const seenLinks = new Set();
    for (const link of statement.conceptLinks) {
      linkCount += 1;
      if (!ontologyNodeIds.has(link.nodeId)) {
        failures.push(`${file}:${statement.statementId}: unknown node ${link.nodeId}.`);
      }
      if (seenLinks.has(link.nodeId)) {
        duplicateLinkCount += 1;
        failures.push(`${file}:${statement.statementId}: duplicate node link ${link.nodeId}.`);
      }
      seenLinks.add(link.nodeId);
    }
  }
}

const vectorStatement = mappingByFile.get("CAIE-0580.json")?.statements
  .find((statement) => statement.statementId === "CAIE-0580-E7.4-4");
for (const nodeId of [
  "VECT-GEOM-PROB-APPL",
  "VECT-GEOM-PROB-PARA",
  "VECT-GEOM-PROB-COLL",
  "VECT-GEOM-PROB-RATI",
]) {
  if (!vectorStatement?.conceptLinks.some((link) => link.nodeId === nodeId)) {
    failures.push(`CAIE-0580-E7.4-4 is missing ${nodeId}.`);
  }
}
const eulerStatement = mappingByFile.get("AQA-7367.json")?.statements
  .find((statement) => statement.statementId === "AQA-7367-J2");
if (!eulerStatement?.conceptLinks.some((link) => link.nodeId === "NUMM-ODE-EULR-EXPL")) {
  failures.push("AQA-7367-J2 is missing the ordinary Euler node.");
}
if (eulerStatement?.conceptLinks.some((link) => link.nodeId === "NUMM-ODE-EULR-IMPR")) {
  failures.push("AQA-7367-J2 still incorrectly links to improved Euler.");
}

const report = {
  schemaVersion: "1.0.0",
  candidateBatch: batchReport.candidateBatch,
  sourceBatch: batchReport.sourceBatch,
  status: failures.length === 0 ? "passed" : "failed",
  mappingCount: candidateFiles.length,
  statementCount,
  linkCount,
  ontologyNodeCount: ontology.nodes.length,
  ontologyAdditionCount: batchReport.ontologyAdditionCount,
  duplicateLinkCount,
  unmappedAssessableStatementCount,
  aqaExternalSourceTransmissionCount: aqaReview.externalSourceTransmissionCount,
  pass1ReviewedStatementCount: pass1.reviewedStatementCount,
  pass1OmittedStatementCount: pass1.omittedStatementCount,
  pass1UnresolvedCount: pass1.unresolvedCount,
  finalReviewedStatementCount: finalReview.reviewedStatementCount,
  finalMachineUnresolvedEntryCount: finalReview.unresolvedCount,
  localDispositionStatementCount: localDispositions.resolvedStatementCount,
  unresolvedAfterLocalDisposition: localDispositions.unresolvedAfterDisposition,
  residualCandidateCount: residualReview.candidateCount,
  residualAcceptedCount: residualReview.additionCount,
  residualRejectedCount: residualReview.rejectionCount,
  residualUnresolvedCount: residualReview.unresolvedCount,
  finalHighConfidenceResidualCount: remainingHighConfidence.length,
  finalNonAqaReviewedRejectionCount: remainingNonAqaKeys.size,
  finalAqaLocallyCoveredResidualCount: remainingHighConfidence.filter((issue) => issue.board === "AQA").length,
  finalExclusionConflictCount: finalConceptAudit.exclusionConflictCount,
  failures,
};

await writeFile(
  path.join(candidateRoot, "candidate-audit-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
