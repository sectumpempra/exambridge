import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html", "json-summary"],
      include: ["src/domain-v2/**/*.ts", "src/adapters-v2/**/*.ts"],
      exclude: ["**/*.d.ts", "**/index.ts"],
      thresholds: {
        lines: 90,
        branches: 80,
        "src/domain-v2/awards/**": { lines: 95, branches: 90 },
        "src/domain-v2/calculator/**": { lines: 95, branches: 90 },
        "src/adapters-v2/legacy-data/**": { lines: 95, branches: 90 },
        "src/domain-v2/past-papers/**": { lines: 80, branches: 70 },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
