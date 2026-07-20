import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distRoot = path.join(root, "dist-static");
const reportPath = path.join(root, "generated/knowledge-v5-only-release-audit.json");
const failures = [];

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? walk(path.join(directory, entry.name))
    : [path.join(directory, entry.name)]))).flat();
}

for (const legacy of ["v3.2", "v3.2-new"]) {
  if (await exists(path.join(root, "public/data", legacy))) failures.push(`legacy public data remains: public/data/${legacy}`);
  if (await exists(path.join(distRoot, "data", legacy))) failures.push(`legacy release data remains: dist-static/data/${legacy}`);
}

const releaseDataEntries = await readdir(path.join(distRoot, "data"), { withFileTypes: true });
const allowedDataDirectories = new Set(["knowledge-v5", "past-papers"]);
for (const entry of releaseDataEntries) {
  if (entry.isDirectory() && !allowedDataDirectories.has(entry.name)) failures.push(`unexpected release data directory: dist-static/data/${entry.name}`);
}

const manifestPath = path.join(distRoot, "data/knowledge-v5/manifest.json");
if (!(await exists(manifestPath))) {
  failures.push("Knowledge V5 release manifest is missing");
} else {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== "5.0.0") failures.push("Knowledge V5 release manifest has the wrong schema version");
  if (!/^knowledge-v5-\d{8}$/.test(manifest.activeBatch ?? "")) failures.push("Knowledge V5 release manifest has no approved batch");
  if (manifest.mappings?.length !== 22) failures.push(`Knowledge V5 release requires 22 mappings; found ${manifest.mappings?.length ?? 0}`);
}

if (await exists(distRoot)) {
  const runtimeFiles = (await walk(distRoot)).filter((file) => /\.(?:js|html)$/i.test(file) || file.endsWith(`${path.sep}sw.js`));
  for (const file of runtimeFiles) {
    const contents = await readFile(file, "utf8");
    if (/\/?data\/v3\.2(?:-new)?(?:\/|\b)/.test(contents)) failures.push(`legacy knowledge runtime reference remains: ${path.relative(root, file)}`);
  }
}

const report = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  publicationPolicy: "knowledge-v5-only",
  expectedQualificationCount: 22,
  legacyPublicPaths: [],
  failureCount: failures.length,
  failures,
};
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Knowledge V5-only release audit passed: 22 mappings and no V3.2/V4 runtime data.");
}
