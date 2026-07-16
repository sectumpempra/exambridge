import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const dataDirectory = resolve(root, "public/data/past-papers");
const reportPath = resolve(root, "generated/past-paper-audit-report.json");
const allowedHosts = {
  "Cambridge International": ["www.cambridgeinternational.org", "cambridgeinternational.org", "schoolsupporthub.cambridgeinternational.org"],
  "Pearson Edexcel": ["qualifications.pearson.com"],
  "OCR": ["www.ocr.org.uk", "ocr.org.uk"],
};

const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  resolve: { alias: { "@": resolve(root, "src") } },
});

try {
  const { PastPaperCatalogSchema } = await server.ssrLoadModule("/src/domain-v2/past-papers/schema.ts");
  const index = JSON.parse(await readFile(resolve(dataDirectory, "index.json"), "utf8"));
  const failures = [];
  const catalogKeys = new Set();
  const assetIds = new Set();
  const summaries = [];

  if (index.schemaVersion !== "1.1.0" || !Array.isArray(index.catalogs)) failures.push("past-paper index has an invalid schemaVersion or catalogs list");
  const files = new Set((await readdir(dataDirectory)).filter((name) => name.endsWith(".json") && name !== "index.json"));

  for (const entry of index.catalogs ?? []) {
    if (catalogKeys.has(entry.key)) failures.push(`duplicate catalog key in index: ${entry.key}`);
    catalogKeys.add(entry.key);
    if (!files.has(entry.file)) failures.push(`missing catalog file: ${entry.file}`);
    const catalog = PastPaperCatalogSchema.parse(JSON.parse(await readFile(resolve(dataDirectory, entry.file), "utf8")));
    if (catalog.key !== entry.key) failures.push(`${entry.file} key does not match index`);
    const hosts = allowedHosts[catalog.board] ?? [];
    const sourceHost = new URL(catalog.sourcePageUrl).hostname;
    if (!hosts.includes(sourceHost)) failures.push(`${entry.file} uses an unapproved source host: ${sourceHost}`);

    let questionPapers = 0;
    for (const asset of catalog.assets) {
      if (assetIds.has(asset.id)) failures.push(`duplicate past-paper asset id: ${asset.id}`);
      assetIds.add(asset.id);
      if (asset.materialType === "question-paper") questionPapers += 1;
      if (asset.accessStatus === "public" && !asset.officialFileUrl && !asset.hostedPath) failures.push(`${asset.id} is public but has no file target`);
      if (asset.distributionStatus === "link-only" && asset.rights.basis !== "official-link-only") failures.push(`${asset.id} link-only rights basis is inconsistent`);
      for (const url of [asset.sourcePageUrl, asset.officialFileUrl].filter(Boolean)) {
        const host = new URL(url).hostname;
        if (!hosts.includes(host)) failures.push(`${asset.id} uses an unapproved host: ${host}`);
      }
    }
    for (const year of [2021, 2022, 2023, 2024, 2025]) {
      const coverage = catalog.coverage.find((entry) => entry.year === year);
      if (!coverage) failures.push(`${entry.file} does not account for ${year}`);
      if (coverage?.status === "complete") {
        const questions = catalog.assets.filter((asset) => asset.year === year && asset.materialType === "question-paper" && asset.accessStatus === "public");
        const unpaired = questions.filter((question) => !catalog.assets.some((asset) => asset.paperSetId === question.paperSetId && asset.materialType === "mark-scheme" && asset.accessStatus === "public"));
        if (questions.length === 0 || unpaired.length > 0) failures.push(`${entry.file} marks ${year} complete without fully paired public QP/MS records`);
      }
    }
    summaries.push({
      key: catalog.key,
      assets: catalog.assets.length,
      questionPapers,
      coverage: Object.fromEntries(catalog.coverage.map((entry) => [entry.year, entry.status])),
      verifiedAt: catalog.release.verifiedAt,
    });
    files.delete(entry.file);
  }

  for (const unlisted of files) failures.push(`unlisted past-paper catalog: ${unlisted}`);
  const report = {
    schemaVersion: 1,
    generatedFrom: "public/data/past-papers/index.json",
    catalogCount: summaries.length,
    assetCount: assetIds.size,
    catalogs: summaries,
    failureCount: failures.length,
    failures,
  };
  await mkdir(resolve(root, "generated"), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Past-paper audit passed: ${summaries.length} catalogs, ${assetIds.size} assets.`);
  }
} finally {
  await server.close();
}
