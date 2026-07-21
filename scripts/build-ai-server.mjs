import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { rm, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "vite";

const root = process.cwd();
const outDir = path.join(root, "dist-ai");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await build({
  configFile: false,
  publicDir: false,
  resolve: { alias: { "@": path.join(root, "src") } },
  ssr: { noExternal: true },
  build: {
    ssr: path.join(root, "server/ai/index.ts"),
    outDir,
    emptyOutDir: false,
    target: "node22",
    sourcemap: false,
    minify: false,
    rollupOptions: {
      output: { entryFileNames: "server.mjs" },
    },
  },
});

await writeFile(path.join(outDir, "README.txt"), [
  "ExamBridge AI server bundle",
  "Required environment: DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL",
  "Optional official web search environment: OPENAI_API_KEY, OPENAI_SEARCH_MODEL (default gpt-5), OPENAI_RESPONSES_URL, OPENAI_SEARCH_TIMEOUT_MS, OPENAI_SEARCH_CANDIDATE_DIR",
  "Other optional environment: AI_HOST, AI_PORT, AI_ALLOWED_ORIGINS, AI_PROVIDER_TIMEOUT_MS, AI_PROVIDER_MAX_OUTPUT_TOKENS_LOW, AI_PROVIDER_MAX_OUTPUT_TOKENS_MAX, AI_DAILY_REQUEST_LIMIT, AI_DAILY_TOKEN_LIMIT, AI_PROVIDER_FAILURE_THRESHOLD, AI_PROVIDER_COOLDOWN_MS, EXAMBRIDGE_DATA_ROOT",
  "Do not place the environment file in the web root or Git repository.",
  "",
].join("\n"));

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const serverBundle = await readFile(path.join(outDir, "server.mjs"));
const knowledgeManifest = await readFile(path.join(root, "public/data/knowledge-v5/manifest.json"));
const academicResultsManifest = await readFile(path.join(root, "public/data/academic-results-v2/manifest.json"));
const trackedPdfs = execFileSync("git", ["ls-files", "--", "*.pdf", "*.PDF"], {
  cwd: root,
  encoding: "utf8",
}).trim().split("\n").filter(Boolean);
if (trackedPdfs.length > 0) throw new Error(`Tracked PDF files are forbidden: ${trackedPdfs.join(", ")}`);
await writeFile(path.join(outDir, "artifact-manifest.json"), `${JSON.stringify({
  schemaVersion: 1,
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  generatedAt: new Date().toISOString(),
  serverBundleSha256: sha256(serverBundle),
  knowledgeManifestSha256: sha256(knowledgeManifest),
  academicResultsManifestSha256: sha256(academicResultsManifest),
  trackedPdfCount: 0,
}, null, 2)}\n`);

console.log("ExamBridge AI server bundle built in dist-ai/.");
