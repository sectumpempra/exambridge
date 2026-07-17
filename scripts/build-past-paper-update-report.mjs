import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const candidateDirectory = resolve(root, "data/candidates/past-papers");
const activeDirectory = resolve(root, "public/data/past-papers");
const reportPath = resolve(root, "generated/past-paper-update-report.json");
const candidateFiles = (await readdir(candidateDirectory)).filter((name) => name.endsWith(".json")).sort();
const activeIndex = JSON.parse(await readFile(resolve(activeDirectory, "index.json"), "utf8"));
if (candidateFiles.length === 0) {
  await mkdir(resolve(root, "generated"), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify({
    status: "no-candidate",
    generatedAt: activeIndex.generatedAt,
    activeCatalogs: activeIndex.catalogs.map((entry) => entry.key),
    publicationBlocked: false,
  }, null, 2)}\n`, "utf8");
  console.log("Past-paper update report: no-candidate.");
  process.exit(0);
}
const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  resolve: { alias: { "@": resolve(root, "src") } },
});

try {
  const { PastPaperCatalogCandidateSchema } = await server.ssrLoadModule("/src/domain-v2/past-papers/schema.ts");
  const expectedModelId = process.env.KIMI_EXPECTED_MODEL_ID;
  if (candidateFiles.length > 0 && !expectedModelId) {
    throw new Error("KIMI_EXPECTED_MODEL_ID is required before validating any Kimi candidate.");
  }
  const activeFiles = new Map(activeIndex.catalogs.map((entry) => [entry.key, entry.file]));
  const diffs = [];

  for (const file of candidateFiles) {
    const candidate = PastPaperCatalogCandidateSchema.parse(JSON.parse(await readFile(resolve(candidateDirectory, file), "utf8")));
    if (candidate.release.requestedModelId !== expectedModelId || candidate.release.responseModelId !== expectedModelId) {
      throw new Error(`${file} model mismatch: requested=${candidate.release.requestedModelId}, response=${candidate.release.responseModelId}, expected=${expectedModelId}`);
    }
    const activeFile = activeFiles.get(candidate.key);
    const active = activeFile ? JSON.parse(await readFile(resolve(activeDirectory, activeFile), "utf8")) : undefined;
    const activeById = new Map((active?.assets ?? []).map((asset) => [asset.id, asset]));
    const candidateById = new Map(candidate.assets.map((asset) => [asset.id, asset]));
    const added = [...candidateById.keys()].filter((id) => !activeById.has(id));
    const removed = [...activeById.keys()].filter((id) => !candidateById.has(id));
    const changed = [...candidateById.keys()].filter((id) => activeById.has(id) && JSON.stringify(candidateById.get(id)) !== JSON.stringify(activeById.get(id)));
    diffs.push({
      key: candidate.key,
      file,
      generatedAt: candidate.release.generatedAt,
      sourceRun: candidate.release.sourceRun,
      requestedModelId: candidate.release.requestedModelId,
      responseModelId: candidate.release.responseModelId,
      promptVersion: candidate.release.promptVersion,
      added,
      removed,
      changed,
      requiresApproval: true,
    });
  }

  const latestVerifiedAt = activeIndex.generatedAt;
  const report = candidateFiles.length > 0 ? {
    status: "candidate-awaiting-approval",
    generatedAt: diffs.map((diff) => diff.generatedAt).sort().at(-1),
    candidates: diffs,
    publicationBlocked: true,
    note: "Candidate records never update the approved public catalog automatically.",
  } : {
    status: "no-candidate",
    generatedAt: latestVerifiedAt,
    activeCatalogs: [...activeFiles.keys()],
    publicationBlocked: false,
  };
  await mkdir(resolve(root, "generated"), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Past-paper update report: ${report.status}.`);
} finally {
  await server.close();
}
