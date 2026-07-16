import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const hashFile = async (path) => createHash("sha256").update(await readFile(resolve(root, path))).digest("hex");
const trackedPdfs = execFileSync("git", ["ls-files", "--", "*.pdf", "*.PDF"], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
if (trackedPdfs.length) throw new Error(`Tracked PDF files are forbidden: ${trackedPdfs.join(", ")}`);

const evidenceFiles = [
  "public/data/v3.2-new/manifest.json",
  "generated/data-quality-report.json",
  "generated/past-paper-audit-report.json",
  "generated/knowledge-v4-audit-report.json",
  "generated/knowledge-point-review-report.json",
  "generated/knowledge-ontology-audit-report.json",
  "generated/knowledge-node-migration-v4.json",
  "generated/knowledge-node-semantics-v4.json",
  "src/course-context/courseCatalog.generated.json",
  "dist-static/data/v3.2-new/manifest.json",
];
const evidence = {};
for (const file of evidenceFiles) evidence[file] = await hashFile(file);

const payload = {
  schemaVersion: 1,
  commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  generatedAt: new Date().toISOString(),
  trackedPdfCount: 0,
  evidence,
};
await mkdir(resolve(root, "generated"), { recursive: true });
await writeFile(resolve(root, "generated/release-provenance.json"), `${JSON.stringify(payload, null, 2)}\n`);
await writeFile(resolve(root, "dist-static/release-provenance.json"), `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Release provenance generated for ${payload.commit.slice(0, 12)}.`);
