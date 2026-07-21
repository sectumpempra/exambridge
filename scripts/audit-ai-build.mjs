import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const aiRoot = path.join(root, "dist-ai");
const files = (await readdir(aiRoot, { withFileTypes: true })).map((entry) => entry.name).sort();
const expected = ["README.txt", "artifact-manifest.json", "server.mjs"];
if (JSON.stringify(files) !== JSON.stringify(expected)) {
  throw new Error(`AI artifact must contain only ${expected.join(", ")}; found ${files.join(", ")}`);
}

const server = await readFile(path.join(aiRoot, "server.mjs"), "utf8");
const serverBytes = await readFile(path.join(aiRoot, "server.mjs"));
const knowledgeManifest = await readFile(path.join(root, "public/data/knowledge-v5/manifest.json"));
const academicResultsManifest = await readFile(path.join(root, "public/data/academic-results-v2/manifest.json"));
const artifactManifest = JSON.parse(await readFile(path.join(aiRoot, "artifact-manifest.json"), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
if (artifactManifest.schemaVersion !== 1) throw new Error("AI artifact manifest schema is invalid");
if (!/^[0-9a-f]{40}$/.test(artifactManifest.sourceCommit)) throw new Error("AI artifact source commit is invalid");
if (artifactManifest.serverBundleSha256 !== sha256(serverBytes)) throw new Error("AI server bundle hash does not match its manifest");
if (artifactManifest.knowledgeManifestSha256 !== sha256(knowledgeManifest)) throw new Error("AI knowledge manifest hash does not match the active data");
if (artifactManifest.academicResultsManifestSha256 !== sha256(academicResultsManifest)) throw new Error("AI academic results manifest hash does not match the active data");
if (artifactManifest.trackedPdfCount !== 0) throw new Error("AI artifact provenance reports tracked PDFs");
if (/sk-[A-Za-z0-9_-]{20,}/.test(server)) throw new Error("AI artifact contains a credential-like token");
if (/DEEPSEEK_API_KEY\s*=\s*["'][^"']+["']/.test(server)) throw new Error("AI artifact contains an embedded DeepSeek key");
if (/OPENAI_API_KEY\s*=\s*["'][^"']+["']/.test(server)) throw new Error("AI artifact contains an embedded OpenAI key");

const aqa = JSON.parse(await readFile(path.join(root, "public/data/knowledge-v5/mappings/AQA-8300.json"), "utf8"));
const sampleOriginal = aqa.statements.find((statement) => statement.statementText?.length > 40)?.statementText;
if (sampleOriginal && server.includes(sampleOriginal)) throw new Error("AI artifact embeds AQA original statement text");

console.log(`AI build audit passed: ${files.length} files, verified provenance, no embedded credential or AQA statement text.`);
