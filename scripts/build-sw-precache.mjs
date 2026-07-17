import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const dist = join(root, "dist-static");
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
const files = await walk(dist);
const cacheable = files.filter((file) => /\.(?:html|js|css|json|webmanifest|png|svg|ico|woff2?)$/i.test(file) && !file.endsWith(`${sep}sw.js`));
const urls = [...new Set(["/", ...cacheable.map((file) => `/${relative(dist, file).split(sep).join("/")}`)])].sort();
const digest = createHash("sha256");
for (const file of cacheable) digest.update(await readFile(file));
const version = `exambridge-${digest.digest("hex").slice(0, 16)}`;
const swPath = join(dist, "sw.js");
let sw = await readFile(swPath, "utf8");
sw = sw.replace(/^const VERSION = .*;$/m, `const VERSION = ${JSON.stringify(version)};`);
sw = sw.replace(/^const CORE = .*;$/m, `const CORE = ${JSON.stringify(urls)};`);
await writeFile(swPath, sw);
console.log(`Service worker precache built: ${urls.length} files, ${version}.`);
