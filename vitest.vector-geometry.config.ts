import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/vector-geometry-lab/demo/setup.ts"],
    include: ["tests/vector-geometry-lab/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/features/vector-geometry-lab/**/*.{ts,tsx}",
        "src/pages/vector-geometry-lab/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "src/features/vector-geometry-lab/**/index.ts",
      ],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85,
        "src/features/vector-geometry-lab/schema/**": {
          statements: 95,
          branches: 90,
        },
        "src/features/vector-geometry-lab/core/**": {
          statements: 95,
          branches: 90,
        },
        "src/features/vector-geometry-lab/explain/**": {
          statements: 90,
          branches: 85,
        },
        "src/features/vector-geometry-lab/three/**": {
          statements: 85,
          branches: 75,
        },
        "src/pages/vector-geometry-lab/**": {
          statements: 85,
          branches: 75,
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
