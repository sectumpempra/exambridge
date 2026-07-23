import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/features/mechanics-lab/**/*.test.ts",
      "tests/gold-cases.test.ts",
      "tests/gold-cases-parse.test.ts",
      "tests/mechanics-components.test.tsx",
    ],
    coverage: {
      reporter: ["text", "json-summary"],
      // Keep the deterministic engine on strict line/branch coverage. React/SVG
      // interaction components are exercised by SSR smoke tests plus the
      // dedicated Playwright editor suite instead of being counted as dead
      // code in the Node coverage environment.
      include: [
        "src/features/mechanics-lab/schema/**/*.ts",
        "src/features/mechanics-lab/core/**/*.ts",
        "src/features/mechanics-lab/explain/**/*.ts",
        "src/features/mechanics-lab/svg/coords.ts",
        "src/features/mechanics-lab/svg/editor-state.ts",
        "src/features/mechanics-lab/svg/export-svg.ts",
        "src/features/mechanics-lab/svg/geometry.ts",
        "src/features/mechanics-lab/svg/motion.ts",
        "src/features/mechanics-lab/svg/snap.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "src/features/mechanics-lab/**/index.ts",
      ],
      thresholds: {
        lines: 95,
        branches: 90,
        functions: 95,
        statements: 95,
        "src/features/mechanics-lab/schema/**": { lines: 95, branches: 90 },
        "src/features/mechanics-lab/core/**": { lines: 95, branches: 90 },
        "src/features/mechanics-lab/svg/**": { lines: 85, branches: 80 },
        "src/features/mechanics-lab/explain/**": { lines: 95, branches: 75 },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
