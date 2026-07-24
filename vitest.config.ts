import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/**/*.test.{ts,tsx}",
      "src/features/mechanics-lab/**/*.test.ts",
    ],
    // Vector Geometry has browser-facing component and WebGL-degradation tests
    // that require jsdom plus a canvas shim. Its dedicated config is executed
    // separately by `test:vector-geometry` and by the release `check` gate.
    exclude: [
      "tests/vector-geometry-lab/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
    ],
    coverage: {
      reporter: ["text", "html", "json-summary"],
      include: [
        "src/domain-v2/**/*.ts",
        "src/adapters-v2/**/*.ts",
        "server/ai/**/*.ts",
      ],
      exclude: ["**/*.d.ts", "src/**/index.ts", "server/ai/provider-smoke.ts"],
      thresholds: {
        lines: 90,
        branches: 80,
        "src/domain-v2/awards/**": { lines: 95, branches: 90 },
        "src/domain-v2/calculator/**": { lines: 95, branches: 90 },
        "src/adapters-v2/legacy-data/**": { lines: 95, branches: 90 },
        "src/domain-v2/past-papers/**": { lines: 80, branches: 70 },
        "server/ai/**": { lines: 85, branches: 75 },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
