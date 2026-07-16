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
const knowledgeMappingFiles = {
  "caie-0580": "CAIE-0580.json",
  "caie-0606": "CAIE-0606.json",
  "caie-9231": "CAIE-9231.json",
  "caie-9709": "CAIE-9709.json",
  "pearson-1ma1": "Edexcel-1MA1.json",
  "pearson-4ma1": "Edexcel-4MA1.json",
  "pearson-9ma0": "Edexcel-9MA0.json",
  "pearson-9fm0": "Edexcel-9FM0.json",
  "pearson-yma01": "Edexcel-IAL.json",
  "ocr-h240": "OCR-H240.json",
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

  if (index.schemaVersion !== "1.2.0" || !Array.isArray(index.catalogs)) failures.push("past-paper index has an invalid schemaVersion or catalogs list");
  const files = new Set((await readdir(dataDirectory)).filter((name) => name.endsWith(".json") && name !== "index.json"));

  for (const entry of index.catalogs ?? []) {
    if (catalogKeys.has(entry.key)) failures.push(`duplicate catalog key in index: ${entry.key}`);
    catalogKeys.add(entry.key);
    if (!files.has(entry.file)) failures.push(`missing catalog file: ${entry.file}`);
    const catalog = PastPaperCatalogSchema.parse(JSON.parse(await readFile(resolve(dataDirectory, entry.file), "utf8")));
    if (catalog.key !== entry.key) failures.push(`${entry.file} key does not match index`);
    const hosts = allowedHosts[catalog.board] ?? [];
    const evidenceHosts = [...hosts, "www.gov.uk"];
    const sourceHost = new URL(catalog.sourcePageUrl).hostname;
    if (!hosts.includes(sourceHost)) failures.push(`${entry.file} uses an unapproved source host: ${sourceHost}`);
    const specificationHost = new URL(catalog.qualificationVersion.source.url).hostname;
    if (!hosts.includes(specificationHost)) failures.push(`${entry.file} uses an unapproved specification host: ${specificationHost}`);
    for (const evidence of [...catalog.coverage, ...catalog.sittings]) {
      const evidenceHost = new URL(evidence.sourcePageUrl).hostname;
      if (!evidenceHosts.includes(evidenceHost)) failures.push(`${entry.file} uses an unapproved coverage evidence host: ${evidenceHost}`);
    }
    const mappingFile = knowledgeMappingFiles[catalog.key];
    if (!mappingFile) failures.push(`${entry.file} has no owner-approved knowledge mapping link`);
    else {
      const mapping = JSON.parse(await readFile(resolve(root, "data/active/knowledge-v4", mappingFile), "utf8"));
      if (mapping.reviewStatus !== "owner-approved") failures.push(`${entry.file} references a knowledge mapping that is not owner-approved`);
      if (catalog.qualificationVersion.id !== mapping.qualificationVersionId) failures.push(`${entry.file} qualification version does not match the owner-approved mapping`);
      if (catalog.qualificationVersion.source.sha256 !== mapping.sources?.[0]?.sha256) failures.push(`${entry.file} specification hash does not match the owner-approved mapping`);
    }

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
      if (!catalog.sittings.some((sitting) => sitting.year === year && sitting.expected)) failures.push(`${entry.file} has no expected sitting status for ${year}`);
      if (coverage?.status === "complete") {
        const questions = catalog.assets.filter((asset) => asset.year === year && asset.materialType === "question-paper" && asset.accessStatus === "public");
        const unpaired = questions.filter((question) => !catalog.assets.some((asset) => asset.paperSetId === question.paperSetId && asset.materialType === "mark-scheme" && asset.accessStatus === "public"));
        if (questions.length === 0 || unpaired.length > 0) failures.push(`${entry.file} marks ${year} complete without fully paired public QP/MS records`);
      }
    }
    for (const sitting of catalog.sittings) {
      if (sitting.status !== "complete") continue;
      const questions = catalog.assets.filter((asset) => asset.year === sitting.year && asset.series === sitting.series && asset.materialType === "question-paper" && asset.accessStatus === "public");
      const unpaired = questions.filter((question) => !catalog.assets.some((asset) => asset.paperSetId === question.paperSetId && asset.materialType === "mark-scheme" && asset.accessStatus === "public"));
      if (questions.length === 0 || unpaired.length > 0) failures.push(`${entry.file} marks ${sitting.year} ${sitting.series} complete without fully paired public QP/MS records`);
    }
    summaries.push({
      key: catalog.key,
      assets: catalog.assets.length,
      questionPapers,
      coverage: Object.fromEntries(catalog.coverage.map((entry) => [entry.year, entry.status])),
      sittings: catalog.sittings.map(({ year, series, expected, status }) => ({ year, series, expected, status })),
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
