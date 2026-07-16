import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const sourceManifest = JSON.parse(await readFile(resolve(root, "public/data/v3.2-new/manifest.json"), "utf8"));
const outputDirectory = resolve(root, "dist-static/data/v3.2-new");
const approved = sourceManifest.mappings.filter((entry) => entry.verificationStatus === "verified");
const approvedPaths = new Set(approved.map((entry) => entry.path));

for (const file of await readdir(outputDirectory)) {
  if (/^mapping-.+\.json$/.test(file) && !approvedPaths.has(file)) await unlink(resolve(outputDirectory, file));
}

await writeFile(resolve(outputDirectory, "manifest.json"), `${JSON.stringify({
  ...sourceManifest,
  mappings: approved,
  failureCount: 0,
  failures: [],
  publicationPolicy: "owner-approved-only",
}, null, 2)}\n`);
console.log(`Static knowledge publication: ${approved.length} approved mappings; ${sourceManifest.mappings.length - approved.length} candidates excluded.`);

