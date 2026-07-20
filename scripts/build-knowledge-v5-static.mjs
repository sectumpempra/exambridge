import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const activeRoot = path.join(root, "data/active/knowledge-v5");
const publicRoot = path.join(root, "public/data/knowledge-v5");
const stagingRoot = path.join(root, "public/data", `.knowledge-v5-stage-${process.pid}`);
const previousRoot = path.join(root, "public/data", `.knowledge-v5-previous-${process.pid}`);
let activation;
try {
  activation = JSON.parse(await readFile(path.join(activeRoot, "activation.json"), "utf8"));
} catch (error) {
  throw new Error("Knowledge V5 activation is required for every production build.", { cause: error });
}
const mappingFiles = (await readdir(path.join(activeRoot, "mappings"))).filter((file) => file.endsWith(".json")).sort();
if (mappingFiles.length !== 22) throw new Error(`Active Knowledge V5 requires 22 mappings; found ${mappingFiles.length}.`);
const ontology = JSON.parse(await readFile(path.join(activeRoot, "ontology.json"), "utf8"));
const paperCatalog = JSON.parse(await readFile(path.join(activeRoot, "paper-catalog.json"), "utf8"));
if (paperCatalog.reviewStatus !== "owner-approved"
  || paperCatalog.qualifications.some((qualification) => qualification.reviewStatus !== "owner-approved"
    || qualification.papers.some((paper) => paper.reviewStatus !== "owner-approved")
    || qualification.routes.some((route) => route.reviewStatus !== "owner-approved"))) {
  throw new Error("Active Knowledge V5 Paper catalog is not completely owner-approved.");
}
const paperCatalogByQualification = new Map(paperCatalog.qualifications.map((qualification) => [qualification.qualificationVersionId, qualification]));
const treeBytes = await readFile(path.join(activeRoot, "knowledge-tree.json"));
const tree = JSON.parse(treeBytes.toString("utf8"));
if (ontology.reviewStatus !== "owner-approved" || ontology.nodes.some((node) => node.reviewStatus !== "owner-approved")) {
  throw new Error("Active Knowledge V5 ontology is not completely owner-approved.");
}
if (activation.mappingCount !== mappingFiles.length || activation.ontologyNodeCount !== ontology.nodes.length) {
  throw new Error("Active Knowledge V5 activation counts do not match its data files.");
}
if (tree.version !== ontology.treeVersion
  || tree.nodes?.length !== ontology.nodes.length
  || createHash("sha256").update(treeBytes).digest("hex") !== ontology.treeSha256) {
  throw new Error("Active Knowledge V5 tree and ontology do not match.");
}
const entries = [];
const validatedMappings = [];
for (const file of mappingFiles) {
  const mapping = JSON.parse(await readFile(path.join(activeRoot, "mappings", file), "utf8"));
  if (mapping.reviewStatus !== "owner-approved") throw new Error(`${file}: active mapping is not owner-approved.`);
  if (mapping.review?.approvalBatch !== activation.approvalBatch || mapping.review?.approvedAt !== activation.approvedAt) {
    throw new Error(`${file}: approval provenance does not match activation.json.`);
  }
  validatedMappings.push([file, mapping]);
  const paperQualification = paperCatalogByQualification.get(mapping.qualificationVersionId);
  if (!paperQualification) throw new Error(`${file}: active Paper catalog entry is missing.`);
  const catalogPaperIds = paperQualification.papers.map((paper) => paper.paperId);
  if (catalogPaperIds.length !== mapping.declaredPapers.length
    || catalogPaperIds.some((paperId) => !mapping.declaredPapers.includes(paperId))) {
    throw new Error(`${file}: active mapping Papers differ from the approved Paper catalog.`);
  }
  const assessable = mapping.statements.filter((statement) => statement.statementType === "assessable-content");
  const paperMapped = assessable.filter((statement) => statement.paperApplicability.kind !== "not-specified");
  const paperMappingCoverage = assessable.length ? paperMapped.length / assessable.length : 0;
  const paperComparisonReady = mapping.declaredPapers.length > 0
    && paperMappingCoverage === 1
    && paperMapped.every((statement) => statement.paperApplicability.papers.every((paper) => mapping.declaredPapers.includes(paper)));
  entries.push({
    code: mapping.qualificationVersionId.split(":")[0],
    qualificationVersionId: mapping.qualificationVersionId,
    board: mapping.board,
    subjectCode: mapping.subjectCode,
    subjectName: mapping.subjectName,
    level: mapping.level,
    papers: mapping.declaredPapers,
    paperDefinitions: paperQualification.papers.map((paper) => ({
      paperId: paper.paperId,
      code: paper.code,
      name: paper.name,
      tiers: paper.tiers,
    })),
    paperMappingCoverage,
    paperComparisonReady,
    mappingUrl: `/data/knowledge-v5/mappings/${file}`,
  });
}

await rm(stagingRoot, { recursive: true, force: true });
await mkdir(path.join(stagingRoot, "mappings"), { recursive: true });
await cp(path.join(activeRoot, "ontology.json"), path.join(stagingRoot, "ontology.json"));
await cp(path.join(activeRoot, "knowledge-tree.json"), path.join(stagingRoot, "knowledge-tree.json"));
for (const [file] of validatedMappings) await cp(path.join(activeRoot, "mappings", file), path.join(stagingRoot, "mappings", file));
await writeFile(path.join(stagingRoot, "manifest.json"), `${JSON.stringify({
  schemaVersion: "5.0.0",
  activeBatch: activation.approvalBatch,
  ontologyUrl: "/data/knowledge-v5/ontology.json",
  treeUrl: "/data/knowledge-v5/knowledge-tree.json",
  ontologyNodeCount: ontology.nodes.length,
  treeVersion: ontology.treeVersion,
  mappings: entries,
}, null, 2)}\n`);

let previousMoved = false;
try {
  await rm(previousRoot, { recursive: true, force: true });
  try {
    await rename(publicRoot, previousRoot);
    previousMoved = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await rename(stagingRoot, publicRoot);
  await rm(previousRoot, { recursive: true, force: true });
} catch (error) {
  await rm(stagingRoot, { recursive: true, force: true });
  if (previousMoved) {
    await rm(publicRoot, { recursive: true, force: true });
    await rename(previousRoot, publicRoot);
  }
  throw error;
}
console.log(`Built Knowledge V5 static manifest for ${entries.length} qualification versions.`);
