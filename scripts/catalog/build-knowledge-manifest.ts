/**
 * Build Knowledge Manifest
 *
 * Scans the mapping directory and generates manifest.json.
 * Run at build time: `npx tsx scripts/catalog/build-knowledge-manifest.ts`
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface ManifestEntry {
  id: string;
  subjectId: string;
  boardId: string;
  qualificationId?: string;
  path: string;
  version: string;
  sha256: string;
  topicCount: number;
}

interface TreeEntry {
  path: string;
  version: string;
  sha256: string;
  nodeCount: number;
}

function sha256File(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

function buildManifest(mappingDir: string, outputPath: string): void {
  // Read tree
  const treePath = path.join(mappingDir, "knowledge-tree-v3.2.json");
  if (!fs.existsSync(treePath)) {
    throw new Error(`Knowledge tree not found: ${treePath}`);
  }

  const treeData = JSON.parse(fs.readFileSync(treePath, "utf8"));
  const treeEntry: TreeEntry = {
    path: "knowledge-tree-v3.2.json",
    version: treeData.version ?? "unknown",
    sha256: sha256File(treePath),
    nodeCount: treeData.metadata?.totalNodes ?? treeData.nodes?.length ?? 0,
  };

  // Scan mapping files
  const entries: ManifestEntry[] = [];
  const files = fs
    .readdirSync(mappingDir)
    .filter((f) => f.startsWith("mapping-v3.2-") && f.endsWith(".json"))
    .sort(); // Stable order

  for (const file of files) {
    const filePath = path.join(mappingDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Derive IDs from content
    const board = data.board ?? "UNKNOWN";
    const subjectCode = data.subjectCode ?? "UNKNOWN";
    const subjectId = `${board}-${subjectCode}`;

    // Derive qualificationId if possible
    const level = (data.level ?? "").toLowerCase();
    let qualificationId: string | undefined;
    if (level.includes("a-level") || level.includes("ial")) {
      qualificationId = `qual:${board.toLowerCase()}:al:${subjectCode.toLowerCase()}`;
    } else if (level.includes("gcse") || level.includes("igcse")) {
      qualificationId = `qual:${board.toLowerCase()}:gcse:${subjectCode.toLowerCase()}`;
    }

    entries.push({
      id: subjectId,
      subjectId,
      boardId: board.toLowerCase(),
      qualificationId,
      path: file,
      version: data.version ?? "unknown",
      sha256: sha256File(filePath),
      topicCount: data.totalTopics ?? 0,
    });
  }

  const manifest = {
    schemaVersion: "2.0.0",
    generatedAt: new Date().toISOString(),
    tree: treeEntry,
    mappings: entries,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

  console.log(`Generated manifest: ${entries.length} mappings`);
  console.log(`Tree: ${treeEntry.nodeCount} nodes`);
  console.log(`Output: ${outputPath}`);
}

// Run
const mappingDir = process.argv[2] ?? "public/data/v3.2";
const outputPath = process.argv[3] ?? "public/data/v3.2/manifest.json";

buildManifest(mappingDir, outputPath);
