import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const root = process.cwd();
const outDir = await mkdtemp(path.join(os.tmpdir(), "exambridge-ai-smoke-"));

try {
  await build({
    configFile: false,
    publicDir: false,
    logLevel: "silent",
    resolve: { alias: { "@": path.join(root, "src") } },
    ssr: { noExternal: true },
    build: {
      ssr: path.join(root, "server/ai/provider-smoke.ts"),
      outDir,
      emptyOutDir: true,
      target: "node22",
      sourcemap: false,
      minify: false,
      rollupOptions: { output: { entryFileNames: "provider-smoke.mjs" } },
    },
  });
  await import(`${pathToFileURL(path.join(outDir, "provider-smoke.mjs")).href}?t=${Date.now()}`);
} finally {
  await rm(outDir, { recursive: true, force: true });
}
