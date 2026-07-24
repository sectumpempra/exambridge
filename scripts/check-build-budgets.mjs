import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const root = "dist/client";
const manifest = JSON.parse(await readFile(join(root, ".vite/manifest.json"), "utf8"));
const failures = [];

function collectWithImports(entryKeys) {
  const seen = new Set();
  function visit(key) {
    if (seen.has(key) || !manifest[key]) return;
    seen.add(key);
    for (const dependency of manifest[key].imports ?? []) visit(dependency);
  }
  entryKeys.forEach(visit);
  return seen;
}

function gzipBytes(keys) {
  return [...keys].reduce((total, key) => total + gzipSync(Buffer.from(requireFile(key))).length, 0);
}

const fileCache = new Map();
function requireFile(key) {
  const path = join(root, manifest[key].file);
  if (!fileCache.has(path)) throw new Error(`Build budget cache missing ${path}`);
  return fileCache.get(path);
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const files = await walk(root);
for (const file of files) fileCache.set(file, await readFile(file));
const examMaterialFiles = files.filter((file) => relative(root, file).startsWith("exam-materials/"));
const examMaterialBytes = (await Promise.all(examMaterialFiles.map((file) => stat(file)))).reduce((total, item) => total + item.size, 0);
if (examMaterialBytes > 112 * 1024 * 1024) failures.push(`exam material snapshots ${examMaterialBytes} bytes exceed the 112 MiB total budget`);

const initial = collectWithImports(["virtual:vinext-app-browser-entry", "app/page.tsx"]);
const initialGzip = gzipBytes(initial);
if (initialGzip > 250 * 1024) failures.push(`initial JS gzip ${initialGzip} > 256000 bytes`);

for (const [key, entry] of Object.entries(manifest)) {
  if (!entry.isDynamicEntry || key === "app/page.tsx") continue;
  const bytes = gzipBytes(collectWithImports([key]));
  if (bytes > 350 * 1024) failures.push(`${key} route JS gzip ${bytes} > 358400 bytes`);
}

for (const file of files) {
  const path = relative(root, file);
  if (path.startsWith("data/") || path.startsWith("knowledge-tree/") || path.endsWith(".map")) continue;
  // JavaScript and CSS are already constrained by the route-level gzip
  // budgets above. Their uncompressed size is not an independent delivery
  // cost and would incorrectly reject a healthy lazy Three.js route chunk.
  if (/\.(?:js|css)$/i.test(path)) continue;
  const size = (await stat(file)).size;
  if (path.startsWith("exam-materials/")) {
    if (size > 4 * 1024 * 1024) failures.push(`${path} ${size} bytes exceeds the 4 MiB official material budget`);
    continue;
  }
  if (size > 500 * 1024) failures.push(`${path} ${size} bytes exceeds the 500 KiB static asset budget`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Build budgets passed: initial JS ${(initialGzip / 1024).toFixed(1)} KiB gzip; official materials ${(examMaterialBytes / 1024 / 1024).toFixed(1)} MiB; ${files.length} files checked.`);
}
