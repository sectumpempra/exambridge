import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const batchId = "knowledge-v5-concept-accounting-20260723";
const approvedAt = "2026-07-23";
const candidateRoot = path.join(root, "data/candidates", batchId);
const activeRoot = path.join(root, "data/active/knowledge-v5");
const stagingRoot = path.join(root, "data/active", `.knowledge-v5-activation-${process.pid}-${randomUUID()}`);
const previousRoot = path.join(root, "data/active", `.knowledge-v5-previous-${process.pid}-${randomUUID()}`);
const activationReportPath = path.join(root, "generated", `${batchId}-activation.json`);

const jsonBytes = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const readJson = async filePath => JSON.parse(await readFile(filePath, "utf8"));
const writeJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, jsonBytes(value));
};

const [candidateAudit, candidateReport, previousActivation] = await Promise.all([
  readJson(path.join(candidateRoot, "candidate-audit-report.json")),
  readJson(path.join(candidateRoot, "candidate-batch-report.json")),
  readJson(path.join(activeRoot, "activation.json")),
]);

if (candidateAudit.candidateBatch !== batchId
  || candidateAudit.status !== "passed"
  || candidateAudit.failures?.length
  || candidateAudit.unresolvedAfterLocalDisposition !== 0
  || candidateAudit.residualUnresolvedCount !== 0) {
  throw new Error("The concept-accounting candidate did not pass its final integrity audit.");
}
if (candidateReport.candidateBatch !== batchId
  || candidateReport.reviewStatus !== "codex-reviewed"
  || candidateReport.activationStatus !== "not-active-awaiting-owner-approval"
  || candidateReport.qualificationCount !== 22) {
  throw new Error("The concept-accounting candidate is not in the approved pre-activation state.");
}
if (previousActivation.approvalBatch === batchId) {
  console.log(`${batchId} is already active.`);
  process.exit(0);
}

const mappingFiles = (await readdir(path.join(candidateRoot, "mappings")))
  .filter(file => file.endsWith(".json"))
  .sort();
if (mappingFiles.length !== 22) throw new Error(`Expected 22 candidate mappings; found ${mappingFiles.length}.`);
const expectedMappingHashes = new Map(candidateReport.files.map(entry => [entry.file, entry.sha256]));
for (const file of mappingFiles) {
  const bytes = await readFile(path.join(candidateRoot, "mappings", file));
  if (sha256(bytes) !== expectedMappingHashes.get(file)) {
    throw new Error(`${file}: candidate mapping changed after owner review.`);
  }
}

const candidateTreeBytes = await readFile(path.join(candidateRoot, "knowledge-tree.json"));
const candidateTree = JSON.parse(candidateTreeBytes.toString("utf8"));
const candidateOntology = await readJson(path.join(candidateRoot, "ontology.json"));
if (candidateTree.version !== candidateOntology.treeVersion
  || candidateTree.nodes?.length !== candidateOntology.nodes?.length
  || sha256(candidateTreeBytes) !== candidateOntology.treeSha256) {
  throw new Error("Candidate tree and ontology do not match.");
}

const promotedOntology = {
  ...candidateOntology,
  reviewStatus: "owner-approved",
  nodes: candidateOntology.nodes.map(node => ({ ...node, reviewStatus: "owner-approved" })),
};
const promotedOntologyBytes = jsonBytes(promotedOntology);
const promotedOntologySha256 = sha256(promotedOntologyBytes);
const promotedMappings = [];
for (const file of mappingFiles) {
  const mapping = await readJson(path.join(candidateRoot, "mappings", file));
  promotedMappings.push([file, {
    ...mapping,
    statements: mapping.statements.map(statement => ({ ...statement, reviewStatus: "owner-approved" })),
    reviewStatus: "owner-approved",
    review: {
      ...mapping.review,
      treeSha256: candidateOntology.treeSha256,
      ontologySha256: promotedOntologySha256,
      reviewedAt: mapping.review.reviewedAt ?? approvedAt,
      approvedAt,
      approvalBatch: batchId,
    },
  }]);
}

const newActivation = {
  schemaVersion: "5.0.0",
  approvalBatch: batchId,
  approvedAt,
  approvedBy: "owner",
  mappingCount: promotedMappings.length,
  ontologyNodeCount: promotedOntology.nodes.length,
  rollbackStrategy: "previous-verified-release",
  previousApprovalBatch: previousActivation.approvalBatch === batchId
    ? previousActivation.previousApprovalBatch
    : previousActivation.approvalBatch,
  sourceCandidateBatch: batchId,
};
const activationReport = {
  schemaVersion: "1.0.0",
  batchId,
  approvedAt,
  approvedBy: "owner",
  rollbackApprovalBatch: newActivation.previousApprovalBatch,
  previousActivation,
  activatedMappingCount: promotedMappings.length,
  activatedStatementCount: promotedMappings.reduce((total, [, mapping]) => total + mapping.statements.length, 0),
  activatedLinkCount: promotedMappings.reduce(
    (total, [, mapping]) => total + mapping.statements.reduce((sum, statement) => sum + statement.conceptLinks.length, 0),
    0,
  ),
  ontologyNodeCount: promotedOntology.nodes.length,
  treeSha256: candidateOntology.treeSha256,
  ontologySha256: promotedOntologySha256,
  candidateAuditSha256: sha256(jsonBytes(candidateAudit)),
  candidateReportSha256: sha256(jsonBytes(candidateReport)),
  rollbackStrategy: `restore the previous verified release ${newActivation.previousApprovalBatch} from a versioned deployment artifact`,
  publicationStatus: "local-only-not-pushed-not-deployed",
};

let previousMoved = false;
try {
  await cp(activeRoot, stagingRoot, { recursive: true });
  await writeJson(path.join(stagingRoot, "activation.json"), newActivation);
  await writeFile(path.join(stagingRoot, "knowledge-tree.json"), candidateTreeBytes);
  await writeFile(path.join(stagingRoot, "ontology.json"), promotedOntologyBytes);
  for (const [file, mapping] of promotedMappings) {
    await writeJson(path.join(stagingRoot, "mappings", file), mapping);
  }
  await rename(activeRoot, previousRoot);
  previousMoved = true;
  await rename(stagingRoot, activeRoot);
  await writeJson(activationReportPath, activationReport);
  await rm(previousRoot, { recursive: true, force: true });
  previousMoved = false;
} catch (error) {
  await rm(stagingRoot, { recursive: true, force: true });
  if (previousMoved) {
    await rm(activeRoot, { recursive: true, force: true });
    await rename(previousRoot, activeRoot);
  }
  throw error;
}

console.log(JSON.stringify({
  batchId,
  previousApprovalBatch: newActivation.previousApprovalBatch,
  mappingCount: promotedMappings.length,
  statementCount: activationReport.activatedStatementCount,
  linkCount: activationReport.activatedLinkCount,
  ontologyNodeCount: promotedOntology.nodes.length,
  publicationStatus: activationReport.publicationStatus,
}, null, 2));
