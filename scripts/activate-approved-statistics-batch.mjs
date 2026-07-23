import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createServer } from "vite";
import { assertApprovalBatchReady, sha256Json } from "./lib/verified-facts-approval.mjs";

const root = process.cwd();
const batchPath = process.argv[2];
if (!batchPath) {
  throw new Error("Usage: node scripts/activate-approved-statistics-batch.mjs <owner-approved-batch.json>");
}
const readJson = async relativePath => JSON.parse(await readFile(join(root, relativePath), "utf8"));
const writeJsonAtomic = async (relativePath, value) => {
  const target = join(root, relativePath);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, target);
};
const batch = assertApprovalBatchReady(await readJson(batchPath), "academic-results-statistics");
const [candidate, active, activeMetadata] = await Promise.all([
  readJson(batch.sourceCandidate.path),
  readJson("public/data/academic-results-v2/manifest.json"),
  readJson("data/active/academic-results-v2/activation.json"),
]);
if (sha256Json(candidate) !== batch.sourceCandidate.sha256) {
  throw new Error("Candidate snapshot changed after owner review; rebuild and re-approve the batch");
}

const selectedStatisticsIds = new Set(batch.scope.includedStatisticsIds);
const selectedSourceIds = new Set(batch.scope.includedSourceIds);
const selectedStatistics = candidate.statistics.filter(record => selectedStatisticsIds.has(record.statisticsId));
const selectedSources = candidate.sources.filter(record => selectedSourceIds.has(record.sourceId));
if (selectedStatistics.length !== selectedStatisticsIds.size || selectedSources.length !== selectedSourceIds.size) {
  throw new Error("The approved ID set cannot be reconstructed exactly");
}
for (const record of selectedStatistics) {
  if (record.verificationStatus !== "codex-reviewed") throw new Error(`${record.statisticsId} is no longer Codex-reviewed`);
  if (record.sourceIds.some(sourceId => !selectedSourceIds.has(sourceId))) throw new Error(`${record.statisticsId} references an unapproved source`);
}
for (const source of selectedSources) {
  if (source.verificationStatus !== "codex-reviewed" || !/^[a-f0-9]{64}$/.test(source.sourceDocumentHash ?? "")) {
    throw new Error(`${source.sourceId} is not eligible for activation`);
  }
}

const promote = record => ({ ...record, verificationStatus: "owner-approved" });
const mergeById = (current, additions, idField) => {
  const additionIds = new Set(additions.map(record => record[idField]));
  return [...current.filter(record => !additionIds.has(record[idField])), ...additions].sort((left, right) =>
    String(left[idField]).localeCompare(String(right[idField])));
};
const nextManifest = {
  ...active,
  sources: mergeById(active.sources, selectedSources.map(promote), "sourceId"),
  statistics: mergeById(active.statistics, selectedStatistics.map(promote), "statisticsId"),
};
const server = await createServer({ root, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "silent" });
try {
  const { AcademicResultsManifestV2Schema } = await server.ssrLoadModule("/src/domain-v2/academic-results/schema.ts");
  AcademicResultsManifestV2Schema.parse(nextManifest);
} finally {
  await server.close();
}

const manifestText = `${JSON.stringify(nextManifest, null, 2)}\n`;
const activatedAt = new Date().toISOString();
const manifestSha256 = createHash("sha256").update(manifestText).digest("hex");
const report = {
  schemaVersion: "1.0.0",
  batchId: batch.batchId,
  baseActivationBatch: active.activationBatch,
  activatedAt,
  manifestSha256,
  statisticsAdded: selectedStatistics.length,
  sourcesAdded: selectedSources.length,
};
const nextActiveMetadata = {
  ...activeMetadata,
  manifestSha256,
  activeCounts: {
    ...activeMetadata.activeCounts,
    sources: nextManifest.sources.length,
    statistics: nextManifest.statistics.length,
  },
  latestApprovedBatch: batch.batchId,
  incrementalActivations: [
    ...(activeMetadata.incrementalActivations ?? []).filter(entry => entry.batchId !== batch.batchId),
    {
      batchId: batch.batchId,
      domain: batch.domain,
      approvedAt: batch.approvedAt,
      activatedAt,
      statisticsAdded: selectedStatistics.length,
      sourcesAdded: selectedSources.length,
    },
  ],
};
await Promise.all([
  mkdir(join(root, "data/active/academic-results-v2/approved-batches"), { recursive: true }),
  mkdir(join(root, "generated/verified-facts-approval/activated"), { recursive: true }),
]);
const manifestTarget = join(root, "public/data/academic-results-v2/manifest.json");
const manifestTemporary = `${manifestTarget}.${process.pid}.tmp`;
await writeFile(manifestTemporary, manifestText);
await rename(manifestTemporary, manifestTarget);
const activatedBatch = {
  ...batch,
  activationStatus: "activated",
  activatedAt,
  activeManifestSha256: manifestSha256,
};
const generatedBatchPath = `generated/verified-facts-approval/${basename(batchPath)}`;
await Promise.all([
  writeFile(join(root, `data/active/academic-results-v2/approved-batches/${batch.batchId}.json`), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(join(root, `generated/verified-facts-approval/activated/${batch.batchId}.json`), `${JSON.stringify(report, null, 2)}\n`),
  writeJsonAtomic("data/active/academic-results-v2/activation.json", nextActiveMetadata),
  writeJsonAtomic(batchPath, activatedBatch),
  writeJsonAtomic(generatedBatchPath, activatedBatch),
]);
console.log(`Activated exactly ${selectedStatistics.length} statistics rows from ${batch.batchId}.`);
