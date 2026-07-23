import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const batchId = "knowledge-v5-concept-accounting-20260723";
const candidateRoot = path.join(root, "data/candidates", batchId);
const mappingsRoot = path.join(candidateRoot, "mappings");
const jsonBytes = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const readJson = async filePath => JSON.parse(await readFile(filePath, "utf8"));
const atomicWrite = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, jsonBytes(value));
  await rename(temporary, filePath);
};

const ontologyAddition = {
  nodeId: "CALC-FINT-APPL-IMPR",
  parentNodeId: "CALC-FINT-APPL",
  name: "Improper Integrals",
  definition: "Evaluating a convergent integral with an infinite limit or an integrable endpoint singularity by interpreting it as a limit of proper definite integrals.",
  aliases: ["improper integral", "improper integration"],
  dimension: "not-applicable",
  objectScopes: ["infinite integration intervals", "integrable endpoint singularities"],
  inclusions: ["infinite upper or lower limits", "unbounded integrands at an endpoint", "convergence by a limiting process"],
  exclusions: ["ordinary proper definite integrals", "divergent improper integrals treated as finite"],
  semanticClass: "mathematical-knowledge",
  comparisonEligible: true,
  stageDepth: ["a_level", "further"],
  sourceHints: ["CAIE-9709"],
  reviewStatus: "codex-reviewed",
};

const corrections = [
  {
    file: "CAIE-9709.json",
    statementId: "CAIE-9709-OFFICIAL-CAIE-9709-1.8.c",
    links: [
      {
        nodeId: "CALC-INTE-CONC-DEFI",
        relation: "exact",
        assessmentDepth: "application",
        evidenceSpan: "evaluate definite integrals",
        reviewNotes: ["The official requirement directly assesses evaluation of definite integrals."],
      },
      {
        nodeId: "CALC-FINT-APPL-IMPR",
        relation: "narrower",
        assessmentDepth: "application",
        evidenceSpan: "simple cases of ‘improper’ integrals",
        reviewNotes: ["The official note explicitly includes simple improper integrals as a narrower assessed case."],
      },
    ],
  },
  {
    file: "Edexcel-1MA1.json",
    statementId: "Edexcel-1MA1-A5a",
    links: [{
      nodeId: "REAS-PROF-ARGM-FORM",
      relation: "exact",
      assessmentDepth: "application",
      evidenceSpan: "understand and use standard mathematical formulae",
      reviewNotes: ["The statement directly requires selecting, understanding and using standard mathematical formulae."],
    }],
  },
  {
    file: "Edexcel-1MA1.json",
    statementId: "Edexcel-1MA1-G20",
    links: [
      {
        nodeId: "TRIG-BASE-RATR-PYTH",
        relation: "exact",
        assessmentDepth: "application",
        evidenceSpan: "Pythagoras’ theorem",
        reviewNotes: ["The official statement explicitly requires Pythagoras' theorem."],
      },
      {
        nodeId: "TRIG-BASE-RATR-SINE",
        relation: "exact",
        assessmentDepth: "application",
        evidenceSpan: "sin θ = opposite/hypotenuse",
        reviewNotes: ["The official statement explicitly requires the right-triangle sine ratio."],
      },
      {
        nodeId: "TRIG-BASE-RATR-COSN",
        relation: "exact",
        assessmentDepth: "application",
        evidenceSpan: "cos θ = adjacent/hypotenuse",
        reviewNotes: ["The official statement explicitly requires the right-triangle cosine ratio."],
      },
      {
        nodeId: "TRIG-BASE-RATR-TANG",
        relation: "exact",
        assessmentDepth: "application",
        evidenceSpan: "tan θ = opposite/adjacent",
        reviewNotes: ["The official statement explicitly requires the right-triangle tangent ratio."],
      },
    ],
  },
  {
    file: "Edexcel-4MA1.json",
    statementId: "Edexcel-4MA1-OFFICIAL-Edexcel-4MA1-2.7-2",
    links: [
      {
        nodeId: "ALGF-EQN-QUAD-FORM",
        relation: "exact",
        assessmentDepth: "application",
        evidenceSpan: "quadratic formula",
        reviewNotes: ["The official statement explicitly names the quadratic formula."],
      },
      {
        nodeId: "ALGF-EQN-QUAD-COMP",
        relation: "exact",
        assessmentDepth: "application",
        evidenceSpan: "completing the square",
        reviewNotes: ["The official statement explicitly names completing the square."],
      },
    ],
  },
  {
    file: "OCR-J560.json",
    statementId: "OCR-J560-OFFICIAL-J560-8.01e",
    links: [{
      nodeId: "GEOM-SHAP-TERM-DIAG",
      relation: "exact",
      assessmentDepth: "application",
      evidenceSpan: "Draw diagrams from written descriptions as required by questions.",
      reviewNotes: ["The canonical practice node exactly represents drawing a geometric diagram from a written description."],
    }],
  },
  {
    file: "WJEC-C00-4968-0.json",
    statementId: "WJEC-C00-4968-0-2.1.5-2",
    links: [
      {
        nodeId: "ALGF-EXP-NOTN-SYMB",
        relation: "partial",
        assessmentDepth: "application",
        evidenceSpan: "form and simplify expressions",
        reviewNotes: ["Forming expressions partly relies on standard algebraic symbolism and notation conventions."],
      },
      {
        nodeId: "ALGF-EXP-MANI-LIKE",
        relation: "narrower",
        assessmentDepth: "application",
        evidenceSpan: "simplify expressions",
        reviewNotes: ["Combining like terms is a canonical narrower case of the broader requirement to simplify expressions."],
      },
    ],
  },
];

const [ontology, tree, report] = await Promise.all([
  readJson(path.join(candidateRoot, "ontology.json")),
  readJson(path.join(candidateRoot, "knowledge-tree.json")),
  readJson(path.join(candidateRoot, "candidate-batch-report.json")),
]);
if (report.candidateBatch !== batchId) throw new Error("Unexpected candidate batch.");

let ontologyAdded = false;
if (!ontology.nodes.some(node => node.nodeId === ontologyAddition.nodeId)) {
  const parent = tree.nodes.find(node => node.nodeId === ontologyAddition.parentNodeId);
  if (!parent) throw new Error(`Missing ontology parent ${ontologyAddition.parentNodeId}.`);
  ontology.nodes.push({
    nodeId: ontologyAddition.nodeId,
    definition: ontologyAddition.definition,
    aliases: ontologyAddition.aliases,
    dimension: ontologyAddition.dimension,
    objectScopes: ontologyAddition.objectScopes,
    inclusions: ontologyAddition.inclusions,
    exclusions: ontologyAddition.exclusions,
    semanticClass: ontologyAddition.semanticClass,
    comparisonEligible: ontologyAddition.comparisonEligible,
    reviewStatus: ontologyAddition.reviewStatus,
  });
  tree.nodes.push({
    nodeId: ontologyAddition.nodeId,
    name: ontologyAddition.name,
    level: parent.level + 1,
    domain: parent.domain,
    path: [...parent.path, ontologyAddition.name],
    stageDepth: ontologyAddition.stageDepth,
    isLeaf: true,
    sourceHints: ontologyAddition.sourceHints,
    parentNodeId: ontologyAddition.parentNodeId,
  });
  ontologyAdded = true;
}

const mappingFiles = (await readdir(mappingsRoot)).filter(file => file.endsWith(".json")).sort();
const mappings = new Map(await Promise.all(mappingFiles.map(async file => [file, await readJson(path.join(mappingsRoot, file))])));
let addedLinkCount = 0;
for (const correction of corrections) {
  const mapping = mappings.get(correction.file);
  const statement = mapping?.statements.find(item => item.statementId === correction.statementId);
  if (!statement) throw new Error(`${correction.file}: missing ${correction.statementId}.`);
  const evidence = [statement.statementText, ...statement.notesText, ...statement.examplesText];
  for (const link of correction.links) {
    if (!evidence.some(text => text.includes(link.evidenceSpan))) {
      throw new Error(`${correction.statementId}: evidence span is not an exact source substring: ${link.evidenceSpan}`);
    }
    if (statement.conceptLinks.some(item => item.nodeId === link.nodeId)) continue;
    statement.conceptLinks.push(link);
    addedLinkCount += 1;
  }
  statement.reviewStatus = "codex-reviewed";
  mapping.reviewStatus = "codex-reviewed";
  mapping.review.reviewedAt = "2026-07-23";
  delete mapping.review.approvedAt;
  delete mapping.review.approvalBatch;
  if (!mapping.review.calls.some(call => call.label === `knowledge-v5-owner-gate-${correction.statementId}`)) {
    mapping.review.calls.push({
      label: `knowledge-v5-owner-gate-${correction.statementId}`,
      provider: "local",
      requestedModel: "local",
      returnedModel: "local",
      status: "local-only",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  }
}

tree.version = "5.0.0-candidate.17-owner-gate";
tree.description = "Knowledge V5 canonical tree with concept-accounting corrections and owner-approval gate closure.";
tree.totalNodes = tree.nodes.length;
const treeBytes = jsonBytes(tree);
ontology.treeVersion = tree.version;
ontology.treeSha256 = sha256(treeBytes);
ontology.generatedAt = "2026-07-23";
ontology.reviewStatus = "codex-reviewed";
const ontologyBytes = jsonBytes(ontology);
const ontologySha256 = sha256(ontologyBytes);
for (const mapping of mappings.values()) {
  mapping.review.treeSha256 = ontology.treeSha256;
  mapping.review.ontologySha256 = ontologySha256;
}

await Promise.all([
  writeFile(path.join(candidateRoot, "knowledge-tree.json"), treeBytes),
  writeFile(path.join(candidateRoot, "ontology.json"), ontologyBytes),
  ...[...mappings].map(([file, mapping]) => atomicWrite(path.join(mappingsRoot, file), mapping)),
]);

const updatedFiles = await Promise.all([...mappings].map(async ([file, mapping]) => ({
  file,
  touched: true,
  sha256: sha256(jsonBytes(mapping)),
})));
if (!report.ownerApprovalGateCorrections) {
  report.additionCount += addedLinkCount;
  report.additionsByQualification["CAIE-9709:2026-2027"] += 2;
  report.additionsByQualification["Edexcel-1MA1:2015"] += 5;
  report.additionsByQualification["Edexcel-4MA1:Issue 2"] += 2;
  report.additionsByQualification["OCR-J560:Version 2.0"] += 1;
  report.additionsByQualification["WJEC-C00-4968-0:Version 5"] += 2;
}
if (ontologyAdded) report.ontologyAdditions.push(ontologyAddition);
else report.ontologyAdditions = report.ontologyAdditions.filter(node => node.nodeId !== ontologyAddition.nodeId);
report.ontologyAdditions = [...new Map(report.ontologyAdditions.map(node => [node.nodeId, node])).values()];
report.ontologyAdditionCount = report.ontologyAdditions.length;
report.ownerApprovalGateCorrections = {
  unmappedStatementCount: corrections.length,
  addedLinkCount: corrections.reduce((total, correction) => total + correction.links.length, 0),
  ontologyAdditionCount: ontologyAdded ? 1 : 0,
  reviewedLocally: true,
};
report.files = updatedFiles;
await atomicWrite(path.join(candidateRoot, "candidate-batch-report.json"), report);

console.log(JSON.stringify({
  batchId,
  repairedUnmappedStatementCount: corrections.length,
  addedLinkCount,
  ontologyAdditionCount: ontologyAdded ? 1 : 0,
  candidateTreeVersion: tree.version,
  candidateOntologyNodeCount: ontology.nodes.length,
}, null, 2));
