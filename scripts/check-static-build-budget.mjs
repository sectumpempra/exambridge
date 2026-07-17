import { lstat, readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const root = "dist-static";
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const failures = [];
try {
  await lstat(join(root, "exam-materials"));
  failures.push("release artifact must not contain an exam-materials path");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const files = await walk(root);
for (const file of files) {
  const path = relative(root, file);
  const size = (await stat(file)).size;
  if (/\.(?:js|css)$/i.test(path)) {
    const gzip = gzipSync(await readFile(file)).length;
    if (gzip > 350 * 1024) failures.push(`${path} ${gzip} gzip bytes exceeds the 350 KiB route-chunk budget`);
  } else if (!path.startsWith("data/") && !path.startsWith("knowledge-tree/") && size > 500 * 1024) {
    failures.push(`${path} ${size} bytes exceeds the 500 KiB static asset budget`);
  }
}
const scripts = files.filter((file) => /\/assets\/.*\.js$/i.test(file));
if (scripts.length < 2) failures.push("expected route-level JavaScript chunks were not generated");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Static build budgets passed: ${scripts.length} JavaScript chunks, ${files.length} files checked.`);
}
