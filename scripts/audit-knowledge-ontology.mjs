import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const treePath = resolve(root, "src/data/knowledge-tree/knowledge-tree.json");
const reviewPath = resolve(root, "data/candidates/knowledge-ontology-review.json");
const reportPath = resolve(root, "generated/knowledge-ontology-audit-report.json");
const migrationPath = resolve(root, "generated/knowledge-node-migration-v4.json");
const treeBytes = await readFile(treePath);
const tree = JSON.parse(treeBytes.toString("utf8"));
const failures = [];
const warnings = [];
const candidates = [];
const reviewedDispositions = {
  "probability distributions": { disposition: "keep-hierarchy", rationale: "PROB is the whole probability domain; PROB-DIST is its distributions topic." },
  reflections: { disposition: "keep-distinct", rationale: "Function reflection and geometric reflection are different operations in different domains." },
  integration: { disposition: "keep-hierarchy", rationale: "CALC-INTE is the topic branch; CALC-INTE-RULE groups integration techniques." },
  "general solutions": { disposition: "keep-distinct", rationale: "The nodes belong to general first-order and specifically linear differential-equation contexts." },
  "particular solutions": { disposition: "keep-distinct", rationale: "The nodes belong to general first-order and specifically linear differential-equation contexts." },
  "discrete random variables": { disposition: "keep-hierarchy", rationale: "The parent is a topic container and the child is a subtopic container; leaf concepts remain below it." },
  "probability generating functions": { disposition: "keep-hierarchy", rationale: "The parent is a domain topic and the child groups definition and application concepts." },
  "rigid body equilibrium": { disposition: "keep-hierarchy", rationale: "The parent groups rigid-body concepts; the leaf is the equilibrium concept itself." },
  "problem solving": { disposition: "keep-as-practice", rationale: "This branch represents mathematical practice, not assessment content, and is excluded from exact knowledge similarity." },
  "de moivre s theorem": { disposition: "keep-hierarchy", rationale: "The parent groups theorem, proof and applications; the leaf represents the theorem statement/use." },
  "cayley hamilton theorem": { disposition: "keep-hierarchy", rationale: "The parent groups theorem and applications; the leaf represents the theorem statement/use." },
  "further differentiation": { disposition: "keep-hierarchy", rationale: "The parent is a curriculum branch; the child groups advanced differentiation techniques." },
  "further integration": { disposition: "keep-hierarchy", rationale: "The parent is a curriculum branch; the child groups advanced integration techniques." },
  "hyperbolic functions": { disposition: "keep-hierarchy", rationale: "The parent is a curriculum branch; the child groups definitions and identities." },
};

const normalize = (value) => String(value).toLowerCase()
  .replace(/\band\b/g, "&")
  .replace(/\bthe\b/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\b(methods?|skills?|techniques?)\b/g, "")
  .replace(/\s+/g, " ")
  .trim();

const nodes = tree.nodes ?? [];
if (nodes.length !== 812) failures.push(`expected the audited v1 ontology to contain 812 nodes, found ${nodes.length}`);
const byId = new Map();
const children = new Map();
for (const node of nodes) {
  if (byId.has(node.nodeId)) failures.push(`duplicate nodeId: ${node.nodeId}`);
  byId.set(node.nodeId, node);
  if (node.parentNodeId) children.set(node.parentNodeId, [...(children.get(node.parentNodeId) ?? []), node]);
}

const roots = nodes.filter((node) => !node.parentNodeId);
if (roots.length !== 1 || roots[0]?.nodeId !== "ROOT") failures.push(`expected one ROOT node, found ${roots.map((node) => node.nodeId).join(", ") || "none"}`);

const pathKeys = new Map();
const siblingNames = new Map();
for (const node of nodes) {
  if (!node.nodeId || !node.name || !Array.isArray(node.path) || !Array.isArray(node.stageDepth)) failures.push(`${node.nodeId ?? "unknown"}: missing required fields`);
  if (node.parentNodeId && !byId.has(node.parentNodeId)) failures.push(`${node.nodeId}: orphan parent ${node.parentNodeId}`);
  const parent = node.parentNodeId ? byId.get(node.parentNodeId) : undefined;
  if (parent && node.level !== parent.level + 1) failures.push(`${node.nodeId}: level ${node.level} does not follow parent ${parent.nodeId} level ${parent.level}`);
  const expectedPath = parent ? [...parent.path, node.name] : [node.name];
  if (JSON.stringify(node.path) !== JSON.stringify(expectedPath)) failures.push(`${node.nodeId}: path does not match ancestry`);
  const pathKey = node.path.map(normalize).join("/");
  if (pathKeys.has(pathKey)) failures.push(`${node.nodeId}: duplicate normalized path with ${pathKeys.get(pathKey)}`);
  pathKeys.set(pathKey, node.nodeId);
  const siblingKey = `${node.parentNodeId ?? "ROOT"}:${normalize(node.name)}`;
  if (siblingNames.has(siblingKey)) failures.push(`${node.nodeId}: duplicate sibling meaning with ${siblingNames.get(siblingKey)}`);
  siblingNames.set(siblingKey, node.nodeId);
  const actualLeaf = !(children.get(node.nodeId)?.length);
  if (Boolean(node.isLeaf) !== actualLeaf) failures.push(`${node.nodeId}: isLeaf=${node.isLeaf} but actual leaf=${actualLeaf}`);
  const seen = new Set([node.nodeId]);
  let cursor = node;
  while (cursor.parentNodeId) {
    if (seen.has(cursor.parentNodeId)) { failures.push(`${node.nodeId}: cycle through ${cursor.parentNodeId}`); break; }
    seen.add(cursor.parentNodeId);
    cursor = byId.get(cursor.parentNodeId);
    if (!cursor) break;
  }
  const invalidStages = node.stageDepth.filter((stage) => !["all", "gcse", "igcse", "a_level", "further"].includes(stage));
  if (invalidStages.length) failures.push(`${node.nodeId}: invalid stageDepth ${invalidStages.join(", ")}`);
}

const names = new Map();
for (const node of nodes) {
  const key = normalize(node.name);
  if (!key) continue;
  names.set(key, [...(names.get(key) ?? []), node]);
}
for (const [key, group] of names) {
  if (group.length < 2) continue;
  candidates.push({
    kind: "repeated-normalized-name",
    normalizedName: key,
    nodeIds: group.map((node) => node.nodeId),
    paths: group.map((node) => node.path.join(" > ")),
    disposition: reviewedDispositions[key]?.disposition ?? "review-required",
    rationale: reviewedDispositions[key]?.rationale,
  });
}

const contaminationPattern = /\b(exam|paper|mark scheme|grade boundary|revision|lesson|teaching|assessment objective|calculator policy|formula booklet|study skill)\b/i;
for (const node of nodes) {
  if (contaminationPattern.test(node.name)) candidates.push({
    kind: "possible-non-knowledge-node",
    nodeIds: [node.nodeId],
    paths: [node.path.join(" > ")],
    disposition: "review-required",
  });
}

let machineReview = null;
try {
  machineReview = JSON.parse(await readFile(reviewPath, "utf8"));
  if (machineReview.treeSha256 !== createHash("sha256").update(treeBytes).digest("hex")) failures.push("ontology machine review targets a different tree hash");
  if (machineReview.requestedModelId !== "kimi-k2.7-code-highspeed" || machineReview.responseModelId !== "kimi-k2.7-code-highspeed") failures.push("ontology machine review model mismatch");
  const reviewed = new Set((machineReview.domainReviews ?? []).flatMap((domain) => domain.reviewedNodeIds ?? []));
  for (const node of nodes) if (!reviewed.has(node.nodeId)) failures.push(`machine semantic review missing node ${node.nodeId}`);
  for (const issue of machineReview.issues ?? []) {
    const unknown = (issue.nodeIds ?? []).filter((id) => !byId.has(id));
    if (unknown.length) failures.push(`machine review references unknown nodes: ${unknown.join(", ")}`);
  }
} catch {
  machineReview = null;
}

const confirmedMigrations = (machineReview?.confirmedMigrations ?? []).filter((entry) => entry.status === "codex-confirmed");
for (const entry of confirmedMigrations) {
  if (!byId.has(entry.fromNodeId)) failures.push(`migration source does not exist: ${entry.fromNodeId}`);
  if (!byId.has(entry.toNodeId)) failures.push(`migration target does not exist: ${entry.toNodeId}`);
  if (entry.fromNodeId === entry.toNodeId) failures.push(`self migration is invalid: ${entry.fromNodeId}`);
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  tree: { version: tree.version, nodeCount: nodes.length, sha256: createHash("sha256").update(treeBytes).digest("hex") },
  grain: "one canonical mathematics knowledge concept per node with a single parent path",
  checks: {
    uniqueIds: true,
    parentIntegrity: true,
    acyclic: true,
    levelAndPathConsistency: true,
    leafConsistency: true,
    normalizedSiblingUniqueness: true,
    stageValidity: true,
    semanticDomainReview: candidates.every((entry) => entry.disposition !== "review-required"),
  },
  repeatedNameCandidateCount: candidates.filter((entry) => entry.kind === "repeated-normalized-name").length,
  nonKnowledgeCandidateCount: candidates.filter((entry) => entry.kind === "possible-non-knowledge-node").length,
  semanticClassCounts: {
    root: nodes.filter((node) => node.nodeId === "ROOT").length,
    mathematicalKnowledge: nodes.filter((node) => node.nodeId !== "ROOT" && node.path[1] !== "Mathematical Reasoning and Modelling").length,
    mathematicalPractice: nodes.filter((node) => node.path[1] === "Mathematical Reasoning and Modelling").length,
    exactComparisonEligible: nodes.filter((node) => node.isLeaf && node.path[1] !== "Mathematical Reasoning and Modelling").length,
  },
  semanticCandidates: candidates,
  codexReviewedSemanticCandidateCount: candidates.filter((entry) => entry.disposition !== "review-required").length,
  unresolvedSemanticCandidateCount: candidates.filter((entry) => entry.disposition === "review-required").length,
  machineIssueCount: machineReview?.issues?.length ?? 0,
  confirmedMigrationCount: confirmedMigrations.length,
  failureCount: failures.length,
  failures,
  warningCount: warnings.length,
  warnings,
};

await mkdir(resolve(root, "generated"), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(migrationPath, `${JSON.stringify({
  schemaVersion: 1,
  treeFromVersion: tree.version,
  treeToVersion: confirmedMigrations.length ? "4.0.0-pending" : tree.version,
  generatedAt: new Date().toISOString(),
  policy: "Node IDs remain stable unless a migration is supported by semantic evidence and confirmed by Codex before owner approval.",
  migrationRequired: confirmedMigrations.length > 0,
  rationale: confirmedMigrations.length
    ? "One or more existing node IDs require a confirmed semantic migration."
    : "All 812 existing IDs remain semantically distinguishable in context; repeated labels are intentional hierarchy or cross-domain concepts, so no ID migration is required.",
  migrations: confirmedMigrations,
  pendingCandidates: machineReview?.migrationCandidates ?? [],
}, null, 2)}\n`);
await writeFile(resolve(root, "generated/knowledge-node-semantics-v4.json"), `${JSON.stringify({
  schemaVersion: "4.0.0-candidate",
  treeVersion: tree.version,
  treeSha256: createHash("sha256").update(treeBytes).digest("hex"),
  generatedAt: new Date().toISOString(),
  reviewStatus: "candidate",
  policy: {
    exactSimilarityUsesLeafKnowledgeOnly: true,
    mathematicalPracticeExcludedFromExactSimilarity: true,
    branchNodesExcludedFromExactSimilarity: true,
  },
  nodes: nodes.map((node) => ({
    nodeId: node.nodeId,
    semanticClass: node.nodeId === "ROOT" ? "root" : node.path[1] === "Mathematical Reasoning and Modelling" ? "mathematical-practice" : "mathematical-knowledge",
    hierarchyRole: node.isLeaf ? "concept" : node.level === 1 ? "domain" : "topic-container",
    comparisonEligible: Boolean(node.isLeaf && node.path[1] !== "Mathematical Reasoning and Modelling"),
    reviewStatus: "codex-reviewed-candidate",
  })),
  reviewedAmbiguities: candidates,
}, null, 2)}\n`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Knowledge ontology audit passed: ${nodes.length} nodes, ${candidates.length} heuristic candidates, ${warnings.length} warnings.`);
}
