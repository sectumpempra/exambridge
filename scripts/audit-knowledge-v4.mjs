import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const candidateDirectory = resolve(root, "data/candidates/knowledge-v4");
const activeDirectory = resolve(root, "data/active/knowledge-v4");
const reportPath = resolve(root, "generated/knowledge-v4-audit-report.json");
const treePath = resolve(root, "src/data/knowledge-tree/knowledge-tree.json");
const tree = JSON.parse(await readFile(treePath, "utf8"));
const nodeIds = new Set(tree.nodes.map((node) => node.nodeId));
const failures = [];
const warnings = [];

const byId = new Map();
for (const node of tree.nodes) {
  if (byId.has(node.nodeId)) failures.push(`duplicate nodeId ${node.nodeId}`);
  byId.set(node.nodeId, node);
  if (node.parentNodeId && !nodeIds.has(node.parentNodeId)) failures.push(`${node.nodeId}: missing parent ${node.parentNodeId}`);
}
for (const node of tree.nodes) {
  const seen = new Set([node.nodeId]);
  let current = node;
  while (current?.parentNodeId) {
    if (seen.has(current.parentNodeId)) {
      failures.push(`${node.nodeId}: cycle through ${current.parentNodeId}`);
      break;
    }
    seen.add(current.parentNodeId);
    current = byId.get(current.parentNodeId);
  }
}

let files = [];
let recordDirectory = candidateDirectory;
let recordSet = "candidate";
try {
  files = (await readdir(activeDirectory)).filter((file) => file.endsWith(".json")).sort();
  recordDirectory = activeDirectory;
  recordSet = "active";
} catch {
  try {
    files = (await readdir(candidateDirectory)).filter((file) => file.endsWith(".json")).sort();
  } catch {
    warnings.push("neither active nor candidate mapping directory exists");
  }
}

const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  resolve: { alias: { "@": resolve(root, "src") } },
});

const summaries = [];
const fingerprints = new Map();
try {
  const { KnowledgeMappingV4Schema } = await server.ssrLoadModule("/src/domain-v2/knowledge-tree/v4-schema.ts");
  for (const file of files) {
    const raw = await readFile(resolve(recordDirectory, file));
    const parsed = KnowledgeMappingV4Schema.safeParse(JSON.parse(raw.toString("utf8")));
    if (!parsed.success) {
      failures.push(`${file}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
      continue;
    }
    const mapping = parsed.data;
    if (recordSet === "active" && mapping.reviewStatus !== "owner-approved") failures.push(`${file}: active mapping is not owner-approved`);
    if (recordSet === "candidate" && mapping.reviewStatus === "owner-approved") failures.push(`${file}: owner-approved mapping must be stored in data/active`);
    const pointIds = new Set();
    const unknownNodes = new Set();
    const invalidPapers = new Set();
    for (const point of mapping.syllabusPoints) {
      if (pointIds.has(point.syllabusPointId)) failures.push(`${file}: duplicate syllabusPointId ${point.syllabusPointId}`);
      pointIds.add(point.syllabusPointId);
      point.canonicalNodeIds.filter((id) => !nodeIds.has(id)).forEach((id) => unknownNodes.add(id));
      if (point.paperApplicability.kind !== "not-specified") {
        point.paperApplicability.papers.filter((paper) => !mapping.declaredPapers.includes(paper)).forEach((paper) => invalidPapers.add(paper));
      }
    }
    if (unknownNodes.size) failures.push(`${file}: unknown nodes ${[...unknownNodes].join(", ")}`);
    if (invalidPapers.size) failures.push(`${file}: unknown papers ${[...invalidPapers].join(", ")}`);
    const fingerprint = createHash("sha256").update(JSON.stringify(mapping.syllabusPoints.map((point) => ({
      nodes: point.canonicalNodeIds,
      paper: point.paperApplicability,
    })))).digest("hex");
    if (mapping.reviewStatus === "owner-approved") {
      const duplicate = fingerprints.get(fingerprint);
      if (duplicate) failures.push(`${file}: owner-approved mapping duplicates ${duplicate}`);
      fingerprints.set(fingerprint, file);
    }
    summaries.push({
      file,
      qualificationVersionId: mapping.qualificationVersionId,
      reviewStatus: mapping.reviewStatus,
      syllabusPoints: mapping.syllabusPoints.length,
      mappedPoints: mapping.syllabusPoints.filter((point) => point.canonicalNodeIds.length > 0).length,
      sources: mapping.sources.length,
      sha256: createHash("sha256").update(raw).digest("hex"),
      fingerprint,
    });
  }
} finally {
  await server.close();
}

const expectedIds = new Set([
  "AQA-7357", "AQA-7367", "AQA-8300", "AQA-8365",
  "CAIE-0580", "CAIE-0606", "CAIE-9231", "CAIE-9709",
  "Edexcel-1MA1", "Edexcel-4MA1", "Edexcel-4PM1", "Edexcel-8MA0", "Edexcel-9FM0", "Edexcel-9MA0", "Edexcel-IAL",
  "OCR-6993", "OCR-H240", "OCR-H245", "OCR-H640", "OCR-J560", "WJEC-3300",
]);
const actualIds = new Set(summaries.map((entry) => entry.qualificationVersionId.split(":")[0]));
for (const id of expectedIds) if (![...actualIds].some((actual) => actual.toLowerCase() === id.toLowerCase())) warnings.push(`missing ${recordSet} mapping ${id}`);

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  tree: { version: tree.version, nodeCount: tree.nodes.length },
  recordSet,
  recordCount: summaries.length,
  candidateCount: summaries.filter((entry) => entry.reviewStatus === "candidate").length,
  ownerApprovedCount: summaries.filter((entry) => entry.reviewStatus === "owner-approved").length,
  summaries,
  failureCount: failures.length,
  failures,
  warningCount: warnings.length,
  warnings,
};
await mkdir(resolve(root, "generated"), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Knowledge V4 audit passed: ${tree.nodes.length} nodes, ${summaries.length} ${recordSet} mappings, ${warnings.length} warnings.`);
}
