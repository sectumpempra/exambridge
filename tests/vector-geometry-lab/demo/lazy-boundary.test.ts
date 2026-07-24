import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Lazy-boundary guard (spec §10.18/19): the only module allowed to mention
 * @/features/vector-geometry-lab/three is three/loader.ts, and only through a
 * dynamic import. Everything else must stay three-free so the initial
 * bundle cannot pull in Three.js.
 *
 * Note: import.meta.url is not a file: URL under the jsdom environment, so
 * resolve from the vitest working directory (the demo package root) instead.
 */

const SRC_ROOT = join(process.cwd(), "src", "pages", "vector-geometry-lab");

function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSources(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("three.js lazy boundary", () => {
  const sources = collectSources(SRC_ROOT);

  it("only three/loader.ts references the 3d package", () => {
    const offenders = sources.filter((file) => {
      if (file.endsWith(join("three", "loader.ts"))) {
        return false;
      }
      const text = readFileSync(file, "utf8");
      // Type-only imports are erased at build time and allowed — strip whole
      // (possibly multi-line) `import type … from "…"` statements first.
      const withoutTypeImports = text.replace(
        /import\s+type\s+[\s\S]*?\sfrom\s*["'][^"']*["'];?/g,
        "",
      );
      return /@\/features\/vector-geometry-lab\/three/.test(withoutTypeImports);
    });
    expect(offenders).toEqual([]);
  });

  it("the loader itself uses a dynamic import()", () => {
    const loaderPath = join(SRC_ROOT, "three", "loader.ts");
    const text = readFileSync(loaderPath, "utf8");
    expect(text).toContain('import("@/features/vector-geometry-lab/three")');
    expect(text).not.toMatch(/^import\s+\{/m);
  });
});
