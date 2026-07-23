import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const activeRoot = path.join(root, "data/active/knowledge-v5");
const activationPath = path.join(activeRoot, "activation.json");
const reportPath = path.join(root, "generated/active-knowledge-v5-audit-report.json");

let activation;
try {
  activation = JSON.parse(await readFile(activationPath, "utf8"));
} catch (error) {
  if (error?.code === "ENOENT") {
    console.log("Knowledge V5 is not active; active-data audit skipped.");
    process.exit(0);
  }
  throw error;
}

const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  resolve: { alias: { "@": path.join(root, "src") } },
});
let KnowledgeMappingV5Schema;
let KnowledgeOntologyV5Schema;
try {
  ({ KnowledgeMappingV5Schema, KnowledgeOntologyV5Schema } = await server.ssrLoadModule("/src/domain-v2/knowledge-tree/v5-schema.ts"));
} finally {
  await server.close();
}

const failures = [];
if (activation.schemaVersion !== "5.0.0") failures.push("activation.json must use schemaVersion 5.0.0");
if (!/^knowledge-v5-(?:concept-accounting-)?\d{8}$/.test(activation.approvalBatch ?? "")) {
  failures.push("activation.json has an invalid approval batch");
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(activation.approvedAt ?? "")) failures.push("activation.json has an invalid approval date");
if (activation.approvedBy !== "owner") failures.push("activation.json must record owner approval");
if (activation.rollbackStrategy !== "previous-verified-release") failures.push("activation.json must use whole-release rollback");

const ontologyResult = KnowledgeOntologyV5Schema.safeParse(JSON.parse(await readFile(path.join(activeRoot, "ontology.json"), "utf8")));
if (!ontologyResult.success) failures.push(`ontology schema: ${ontologyResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
const ontology = ontologyResult.success ? ontologyResult.data : null;
if (ontology && (ontology.reviewStatus !== "owner-approved" || ontology.nodes.some((node) => node.reviewStatus !== "owner-approved"))) {
  failures.push("active ontology and every semantic node must be owner-approved");
}
const semanticById = new Map((ontology?.nodes ?? []).map((node) => [node.nodeId, node]));
const activeTreeBytes = await readFile(path.join(activeRoot, "knowledge-tree.json")).catch(() => null);
const activeTree = activeTreeBytes ? JSON.parse(activeTreeBytes.toString("utf8")) : null;
if (!activeTree || activeTree.version !== ontology?.treeVersion
  || activeTree.nodes?.length !== ontology?.nodes.length
  || createHash("sha256").update(activeTreeBytes).digest("hex") !== ontology?.treeSha256) {
  failures.push("active knowledge tree is missing or does not match the approved ontology");
}
const leafNodeIds = new Set((activeTree?.nodes ?? []).filter((node) => node.isLeaf).map((node) => node.nodeId));

const mappingFiles = (await readdir(path.join(activeRoot, "mappings"))).filter((file) => file.endsWith(".json")).sort();
if (mappingFiles.length !== 22) failures.push(`active Knowledge V5 must contain 22 mappings; found ${mappingFiles.length}`);
const mappings = [];
for (const file of mappingFiles) {
  const result = KnowledgeMappingV5Schema.safeParse(JSON.parse(await readFile(path.join(activeRoot, "mappings", file), "utf8")));
  if (!result.success) {
    failures.push(`${file}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    continue;
  }
  const mapping = result.data;
  mappings.push(mapping);
  if (mapping.reviewStatus !== "owner-approved" || mapping.statements.some((statement) => statement.reviewStatus !== "owner-approved")) {
    failures.push(`${file}: mapping and every statement must be owner-approved`);
  }
  if (mapping.review.approvalBatch !== activation.approvalBatch || mapping.review.approvedAt !== activation.approvedAt) {
    failures.push(`${file}: approval provenance does not match activation.json`);
  }
  if (mapping.board === "AQA" && mapping.review.calls.some((call) => call.provider !== "local")) {
    failures.push(`${file}: AQA source content must retain local-only provenance`);
  }
  for (const statement of mapping.statements) {
    if (statement.statementType === "assessable-content" && statement.conceptLinks.length === 0) {
      failures.push(`${file}:${statement.statementId}: unresolved assessable statement is active`);
    }
    for (const link of statement.conceptLinks) {
      const semantic = semanticById.get(link.nodeId);
      if (!semantic) failures.push(`${file}:${statement.statementId}: unknown ontology node ${link.nodeId}`);
      else if (!leafNodeIds.has(link.nodeId)) failures.push(`${file}:${statement.statementId}: taxonomy-container node ${link.nodeId} is active`);
      else if (semantic.comparisonEligible && semantic.semanticClass !== "mathematical-knowledge") {
        failures.push(`${file}:${statement.statementId}: comparison-eligible node ${link.nodeId} is not mathematical knowledge`);
      }
    }
  }
}
if (activation.mappingCount !== mappings.length) failures.push("activation mapping count does not match active mappings");
if (ontology && activation.ontologyNodeCount !== ontology.nodes.length) failures.push("activation ontology count does not match active ontology");
if (new Set(mappings.map((mapping) => mapping.qualificationVersionId)).size !== mappings.length) failures.push("active qualificationVersionId values must be unique");

function statementBySection(qualificationPrefix, sectionId) {
  return mappings.find((mapping) => mapping.qualificationVersionId.startsWith(`${qualificationPrefix}:`))?.statements.find((statement) => statement.sectionId === sectionId);
}
function nodeIds(statement) {
  return new Set(statement?.conceptLinks.map((link) => link.nodeId) ?? []);
}
const caieLine = statementBySection("CAIE-0580", "E4.5.1");
const caieThreeDimensional = statementBySection("CAIE-0580", "E4.5.2");
const edexcelLine = statementBySection("Edexcel-4MA1", "4.3A");
for (const [label, statement] of [["CAIE-0580 E4.5.1", caieLine], ["CAIE-0580 E4.5.2", caieThreeDimensional], ["Edexcel-4MA1 4.3A", edexcelLine]]) {
  if (!statement) failures.push(`${label}: required atomic statement is missing`);
}
for (const [label, ids] of [["CAIE-0580 E4.5.1", nodeIds(caieLine)], ["Edexcel-4MA1 4.3A", nodeIds(edexcelLine)]]) {
  for (const expected of ["GEOM-SHAP-SYMM-LINE", "GEOM-SHAP-SYMM-ROTA"]) if (!ids.has(expected)) failures.push(`${label}: missing ${expected}`);
}
const threeDimensionalIds = nodeIds(caieThreeDimensional);
for (const expected of ["GEOM-SHAP-SYMM-PLANE", "GEOM-SHAP-SYMM-AXIS"]) if (!threeDimensionalIds.has(expected)) failures.push(`CAIE-0580 E4.5.2: missing ${expected}`);
if (threeDimensionalIds.has("GEOM-SHAP-SYMM-LINE")) failures.push("CAIE-0580 E4.5.2 must not be mapped to two-dimensional line symmetry");

const report = {
  schemaVersion: "5.0.0",
  generatedAt: new Date().toISOString(),
  activationBatch: activation.approvalBatch,
  mappingCount: mappings.length,
  ontologyNodeCount: ontology?.nodes.length ?? 0,
  failureCount: failures.length,
  failures,
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Active Knowledge V5 audit passed: ${mappings.length} mappings, ${ontology.nodes.length} ontology nodes.`);
}
