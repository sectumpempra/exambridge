import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const dataDir = join(root, "public", "data", "v3.2-new");
const treePath = join(root, "src", "data", "knowledge-tree", "knowledge-tree.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const mappingFiles = (await readdir(dataDir)).filter((file) => /^mapping-.+\.json$/.test(file)).sort();
const treeBytes = await readFile(treePath);
const tree = JSON.parse(treeBytes.toString("utf8"));
const entries = [];
const failures = [];
const verifiedFingerprints = new Map();

for (const file of mappingFiles) {
  const bytes = await readFile(join(dataDir, file));
  const mapping = JSON.parse(bytes.toString("utf8"));
  const papers = new Set(mapping.paperStructure?.papers ?? []);
  const subtopics = mapping.mappings.flatMap((topic) => topic.subtopicMappings ?? []);
  const referenced = subtopics.filter((subtopic) => Array.isArray(subtopic.paperReference) && subtopic.paperReference.length > 0);
  const invalidReferences = [...new Set(referenced.flatMap((subtopic) => subtopic.paperReference).filter((paper) => !papers.has(paper)))];
  const coverage = subtopics.length ? referenced.length / subtopics.length : 0;
  const verificationStatus = mapping.verificationStatus ?? "candidate";
  const fingerprint = sha256(Buffer.from(JSON.stringify(subtopics.map((subtopic) => ({
    paperReference: subtopic.paperReference,
    mappedNodes: subtopic.mappedNodes.map((node) => node.nodeId),
  })))));

  if (verificationStatus === "verified") {
    if (papers.size && coverage !== 1) failures.push(`${file}: verified Paper mapping coverage is ${(coverage * 100).toFixed(1)}%`);
    if (invalidReferences.length) failures.push(`${file}: unknown Paper references ${invalidReferences.join(", ")}`);
    const duplicate = verifiedFingerprints.get(fingerprint);
    if (duplicate) failures.push(`${file}: verified mapping duplicates ${duplicate}`);
    verifiedFingerprints.set(fingerprint, file);
  }

  entries.push({
    id: `${mapping.board}-${mapping.subjectCode}`,
    path: file,
    version: mapping.version,
    syllabusVersion: mapping.syllabusVersion ?? null,
    sourceUrl: mapping.sourceUrl ?? null,
    verificationStatus,
    sha256: sha256(bytes),
    topicCount: mapping.mappings.length,
    subtopicCount: subtopics.length,
    paperMappingCoverage: coverage,
    invalidReferences,
    fingerprint,
  });
}

const manifest = {
  schemaVersion: "3.2.1",
  generatedAt: new Date().toISOString(),
  tree: {
    version: tree.version,
    sha256: sha256(treeBytes),
    nodeCount: tree.nodes.length,
  },
  mappings: entries,
  failureCount: failures.length,
  failures,
};

await writeFile(join(dataDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Knowledge manifest built: ${tree.nodes.length} nodes, ${entries.length} mappings.`);
}
