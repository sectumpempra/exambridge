import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const activeRoot = path.join(root, "data/active/knowledge-v5");
const candidateRoot = path.join(root, "data/candidates/knowledge-v5-concept-accounting-20260723");
const candidateMappingsRoot = path.join(candidateRoot, "mappings");
const pass1Path = path.join(candidateRoot, "machine-review-pass-1.json");
const finalReviewPath = path.join(candidateRoot, "final-machine-review.json");
const aqaReviewPath = path.join(candidateRoot, "aqa-local-review.json");
const localDispositionPath = path.join(candidateRoot, "codex-final-dispositions.json");
const residualReviewPath = path.join(candidateRoot, "residual-cue-review.json");
const reportPath = path.join(candidateRoot, "candidate-batch-report.json");
const candidateOntologyPath = path.join(candidateRoot, "ontology.json");
const candidateTreePath = path.join(candidateRoot, "knowledge-tree.json");

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(tempPath, filePath);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const mandatoryCorrections = {
  additions: [
    {
      qualificationVersionId: "CAIE-0580:2025-2027",
      statementId: "CAIE-0580-E7.4-4",
      nodeId: "VECT-GEOM-PROB-PARA",
      relation: "exact",
      assessmentDepth: "reasoning",
      evidenceSpan: "• show that vectors are parallel",
      reviewNotes: [
        "The official example explicitly assesses proving vector parallelism.",
        "Regression correction for the reported collinearity concept-accounting defect.",
      ],
    },
    {
      qualificationVersionId: "CAIE-0580:2025-2027",
      statementId: "CAIE-0580-E7.4-4",
      nodeId: "VECT-GEOM-PROB-COLL",
      relation: "exact",
      assessmentDepth: "reasoning",
      evidenceSpan: "• show that 3 points are collinear",
      reviewNotes: [
        "The official example explicitly assesses proving collinearity.",
        "Regression correction for the reported collinearity concept-accounting defect.",
      ],
    },
    {
      qualificationVersionId: "CAIE-0580:2025-2027",
      statementId: "CAIE-0580-E7.4-4",
      nodeId: "VECT-GEOM-PROB-RATI",
      relation: "partial",
      assessmentDepth: "reasoning",
      evidenceSpan: "• solve vector problems involving ratio and similarity.",
      reviewNotes: [
        "The official example explicitly assesses ratio within vector geometry.",
        "The partial relation avoids claiming that every vector-ratio problem is a line-section problem.",
      ],
    },
  ],
  removals: [],
};

const [pass1, finalReview, aqaReview, localDispositions, residualReview] = await Promise.all(
  [pass1Path, finalReviewPath, aqaReviewPath, localDispositionPath, residualReviewPath]
    .map(async (file) => JSON.parse(await readFile(file, "utf8"))),
);
if (pass1.failureCount) throw new Error(`Pass 1 has ${pass1.failureCount} failed batches.`);
if (finalReview.failureCount) throw new Error(`Final review has ${finalReview.failureCount} failed batches.`);
if (
  localDispositions.unresolvedEntryCount !== finalReview.unresolvedCount
  || localDispositions.unresolvedAfterDisposition !== 0
) {
  throw new Error("Final-review unresolved statements are not fully covered by Codex local dispositions.");
}
if (aqaReview.unresolved?.length) throw new Error(`AQA local review has ${aqaReview.unresolved.length} unresolved statements.`);
if (aqaReview.externalSourceTransmissionCount !== 0) throw new Error("AQA review reports external source transmission.");
if (residualReview.failureCount || residualReview.unresolvedCount) {
  throw new Error("Residual high-confidence cue review is incomplete.");
}

const activeOntology = JSON.parse(await readFile(path.join(activeRoot, "ontology.json"), "utf8"));
const activeTree = JSON.parse(await readFile(path.join(activeRoot, "knowledge-tree.json"), "utf8"));
const candidateOntology = structuredClone(activeOntology);
const candidateTree = structuredClone(activeTree);
const ontologyNodeIds = new Set(candidateOntology.nodes.map((node) => node.nodeId));
const treeNodeIds = new Set(candidateTree.nodes.map((node) => node.nodeId));
const proposedOntologyAdditions = [
  ...(aqaReview.ontologyAdditions ?? []),
  ...(localDispositions.ontologyAdditions ?? []),
];
for (const addition of proposedOntologyAdditions) {
  if (ontologyNodeIds.has(addition.nodeId) || treeNodeIds.has(addition.nodeId)) {
    throw new Error(`Candidate ontology node already exists: ${addition.nodeId}`);
  }
  if (!treeNodeIds.has(addition.parentNodeId)) {
    throw new Error(`Candidate ontology parent does not exist: ${addition.parentNodeId}`);
  }
  candidateOntology.nodes.push({
    nodeId: addition.nodeId,
    definition: addition.definition,
    aliases: addition.aliases,
    dimension: addition.dimension,
    objectScopes: addition.objectScopes,
    inclusions: addition.inclusions,
    exclusions: addition.exclusions,
    semanticClass: addition.semanticClass,
    comparisonEligible: addition.comparisonEligible,
    reviewStatus: addition.reviewStatus,
  });
  const parent = candidateTree.nodes.find((node) => node.nodeId === addition.parentNodeId);
  candidateTree.nodes.push({
    nodeId: addition.nodeId,
    name: addition.name,
    level: parent.level + 1,
    domain: parent.domain,
    path: [...parent.path, addition.name],
    stageDepth: addition.stageDepth,
    isLeaf: true,
    sourceHints: addition.sourceHints,
    parentNodeId: addition.parentNodeId,
  });
  ontologyNodeIds.add(addition.nodeId);
  treeNodeIds.add(addition.nodeId);
}
candidateTree.version = "5.0.0-candidate.16-concept-accounting";
candidateTree.description =
  "Knowledge V5 canonical tree with concept-accounting corrections awaiting owner approval.";
candidateTree.totalNodes = candidateTree.nodes.length;
const candidateTreeBytes = `${JSON.stringify(candidateTree, null, 2)}\n`;
candidateOntology.treeVersion = candidateTree.version;
candidateOntology.treeSha256 = sha256(candidateTreeBytes);
candidateOntology.generatedAt = "2026-07-23";
candidateOntology.reviewStatus = "codex-reviewed";

const mappingFiles = (await readdir(path.join(activeRoot, "mappings"))).filter((file) => file.endsWith(".json")).sort();
const activeMappings = await Promise.all(
  mappingFiles.map(async (file) => ({
    file,
    mapping: JSON.parse(await readFile(path.join(activeRoot, "mappings", file), "utf8")),
  })),
);
const statementIndex = new Map();
for (const { mapping } of activeMappings) {
  for (const statement of mapping.statements) {
    if (statementIndex.has(statement.statementId)) throw new Error(`Duplicate global statementId ${statement.statementId}`);
    statementIndex.set(statement.statementId, { qualificationVersionId: mapping.qualificationVersionId, statement });
  }
}

function withQualification(change) {
  const indexed = statementIndex.get(change.statementId);
  if (!indexed) throw new Error(`Unknown correction statement ${change.statementId}`);
  if (change.qualificationVersionId && change.qualificationVersionId !== indexed.qualificationVersionId) {
    throw new Error(`${change.statementId}: qualification mismatch`);
  }
  return { ...change, qualificationVersionId: indexed.qualificationVersionId };
}

const proposedAdditions = [
  ...mandatoryCorrections.additions,
  ...(finalReview.additions ?? []),
  ...(aqaReview.additions ?? []),
  ...(localDispositions.additions ?? []),
  ...(residualReview.additions ?? []),
].map(withQualification);
const proposedRemovals = [
  ...mandatoryCorrections.removals,
  ...(finalReview.removals ?? []),
  ...(aqaReview.removals ?? []),
].map(withQualification);

const additionByKey = new Map();
for (const addition of proposedAdditions) {
  const key = `${addition.statementId}|${addition.nodeId}`;
  const current = additionByKey.get(key);
  if (!current || (addition.reviewPass ?? 0) >= (current.reviewPass ?? 0)) additionByKey.set(key, addition);
}
const removalByKey = new Map();
for (const removal of proposedRemovals) {
  const key = `${removal.statementId}|${removal.nodeId}`;
  removalByKey.set(key, removal);
}
for (const [key, addition] of additionByKey) {
  const removal = removalByKey.get(key);
  if (!removal) continue;
  const additionPass = addition.reviewPass ?? 0;
  const removalPass = removal.reviewPass ?? 0;
  if (additionPass > removalPass) {
    removalByKey.delete(key);
    continue;
  }
  if (removalPass > additionPass) {
    additionByKey.delete(key);
    continue;
  }
  throw new Error(`Conflicting add/remove correction at equal review pass ${key}`);
}

const appliedAdditions = [];
const appliedRemovals = [];
const unchangedProposals = [];
const correctedMappings = [];
for (const { file, mapping: activeMapping } of activeMappings) {
  const mapping = structuredClone(activeMapping);
  let touched = false;
  for (const statement of mapping.statements) {
    const removeNodeIds = new Set(
      [...removalByKey.values()]
        .filter((change) => change.statementId === statement.statementId)
        .map((change) => change.nodeId),
    );
    const beforeLinks = statement.conceptLinks;
    statement.conceptLinks = beforeLinks.filter((link) => !removeNodeIds.has(link.nodeId));
    for (const link of beforeLinks) {
      if (removeNodeIds.has(link.nodeId)) {
        appliedRemovals.push(removalByKey.get(`${statement.statementId}|${link.nodeId}`));
        touched = true;
      }
    }

    const additionsForStatement = [...additionByKey.values()].filter(
      (change) => change.statementId === statement.statementId,
    );
    for (const addition of additionsForStatement) {
      if (statement.conceptLinks.some((link) => link.nodeId === addition.nodeId)) {
        unchangedProposals.push(addition);
        continue;
      }
      const evidenceSources = [statement.statementText, ...statement.notesText, ...statement.examplesText];
      if (!evidenceSources.some((source) => source.includes(addition.evidenceSpan))) {
        throw new Error(`${statement.statementId}: addition evidence is not an exact official-source substring`);
      }
      statement.conceptLinks.push({
        nodeId: addition.nodeId,
        relation: addition.relation,
        assessmentDepth: addition.assessmentDepth,
        evidenceSpan: addition.evidenceSpan,
        reviewNotes: Array.isArray(addition.reviewNotes) && addition.reviewNotes.length
          ? addition.reviewNotes
          : typeof addition.reviewNotes === "string" && addition.reviewNotes
            ? [addition.reviewNotes]
          : ["Confirmed by the two-pass concept-accounting review and Codex final verification."],
      });
      appliedAdditions.push(addition);
      touched = true;
    }
    if (touched && (additionsForStatement.length || removeNodeIds.size)) statement.reviewStatus = "codex-reviewed";
  }
  if (touched) {
    mapping.reviewStatus = "codex-reviewed";
    mapping.review = {
      ...mapping.review,
      generatedAt: "2026-07-23",
      promptVersion: "knowledge-v5-concept-accounting-1",
      batchId: `knowledge-v5-concept-accounting-20260723-${file.replace(/\.json$/, "")}`,
      reviewedAt: "2026-07-23",
      calls: [
        ...mapping.review.calls,
        {
          label: `knowledge-v5-concept-accounting-final-${file.replace(/\.json$/, "")}`,
          provider: "local",
          requestedModel: "local",
          returnedModel: "local",
          status: "local-only",
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      ],
    };
    delete mapping.review.approvedAt;
    delete mapping.review.approvalBatch;
  }
  correctedMappings.push({ file, mapping, touched });
}

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
  resolve: { alias: { "@": path.join(root, "src") } },
});
let KnowledgeMappingV5Schema;
let KnowledgeOntologyV5Schema;
try {
  ({ KnowledgeMappingV5Schema, KnowledgeOntologyV5Schema } = await vite.ssrLoadModule("/src/domain-v2/knowledge-tree/v5-schema.ts"));
} finally {
  await vite.close();
}
const parsedOntology = KnowledgeOntologyV5Schema.safeParse(candidateOntology);
if (!parsedOntology.success) {
  throw new Error(`Candidate ontology schema validation failed\n${JSON.stringify(parsedOntology.error.issues, null, 2)}`);
}
for (const { file, mapping } of correctedMappings) {
  const parsed = KnowledgeMappingV5Schema.safeParse(mapping);
  if (!parsed.success) {
    throw new Error(`${file}: candidate schema validation failed\n${JSON.stringify(parsed.error.issues, null, 2)}`);
  }
  for (const statement of mapping.statements) {
    for (const link of statement.conceptLinks) {
      if (!ontologyNodeIds.has(link.nodeId)) {
        throw new Error(`${file}:${statement.statementId}: unknown candidate ontology node ${link.nodeId}`);
      }
    }
  }
  await atomicWrite(path.join(candidateMappingsRoot, file), mapping);
}
await atomicWrite(candidateTreePath, candidateTree);
await atomicWrite(candidateOntologyPath, candidateOntology);

const caie0580 = correctedMappings.find(({ file }) => file === "CAIE-0580.json")?.mapping;
const vectorStatement = caie0580?.statements.find((statement) => statement.statementId === "CAIE-0580-E7.4-4");
const requiredVectorNodes = ["VECT-GEOM-PROB-APPL", "VECT-GEOM-PROB-PARA", "VECT-GEOM-PROB-COLL", "VECT-GEOM-PROB-RATI"];
for (const nodeId of requiredVectorNodes) {
  if (!vectorStatement?.conceptLinks.some((link) => link.nodeId === nodeId)) {
    throw new Error(`CAIE-0580-E7.4-4 is still missing ${nodeId}`);
  }
}

const report = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  candidateBatch: "knowledge-v5-concept-accounting-20260723",
  sourceBatch: pass1.sourceBatch,
  reviewStatus: "codex-reviewed",
  activationStatus: "not-active-awaiting-owner-approval",
  qualificationCount: correctedMappings.length,
  changedQualificationCount: correctedMappings.filter(({ touched }) => touched).length,
  additionCount: appliedAdditions.length,
  removalCount: appliedRemovals.length,
  ontologyAdditionCount: proposedOntologyAdditions.length,
  ontologyAdditions: proposedOntologyAdditions,
  machineUnresolvedEntryCount: finalReview.unresolvedCount,
  localDispositionCount: localDispositions.resolvedStatementCount,
  unresolvedAfterLocalDisposition: localDispositions.unresolvedAfterDisposition,
  residualCandidateCount: residualReview.candidateCount,
  residualAcceptedCount: residualReview.additionCount,
  residualRejectedCount: residualReview.rejectionCount,
  residualUnresolvedCount: residualReview.unresolvedCount,
  unchangedProposalCount: unchangedProposals.length,
  additionsByQualification: Object.fromEntries(
    correctedMappings.map(({ mapping }) => [
      mapping.qualificationVersionId,
      appliedAdditions.filter((item) => item.qualificationVersionId === mapping.qualificationVersionId).length,
    ]),
  ),
  removalsByQualification: Object.fromEntries(
    correctedMappings.map(({ mapping }) => [
      mapping.qualificationVersionId,
      appliedRemovals.filter((item) => item.qualificationVersionId === mapping.qualificationVersionId).length,
    ]),
  ),
  caie0580VectorRegression: {
    statementId: vectorStatement.statementId,
    requiredNodeIds: requiredVectorNodes,
    actualNodeIds: vectorStatement.conceptLinks.map((link) => link.nodeId),
    passed: true,
  },
  files: await Promise.all(
    correctedMappings.map(async ({ file, mapping, touched }) => {
      const bytes = `${JSON.stringify(mapping, null, 2)}\n`;
      return { file, touched, sha256: sha256(bytes) };
    }),
  ),
};
await atomicWrite(reportPath, report);
console.log(JSON.stringify({
  changedQualificationCount: report.changedQualificationCount,
  additionCount: report.additionCount,
  removalCount: report.removalCount,
  caie0580VectorRegression: report.caie0580VectorRegression.passed,
  reportPath,
}));
