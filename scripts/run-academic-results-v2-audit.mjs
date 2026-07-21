import { execFileSync } from "node:child_process";

for (const script of [
  "scripts/build-academic-results-v2-candidates.mjs",
  "scripts/build-academic-results-v2-coverage.mjs",
  "scripts/build-qualification-fact-cards.mjs",
  "scripts/build-misconception-library.mjs",
  "scripts/audit-academic-results-v2.mjs",
]) {
  execFileSync(process.execPath, [script], { cwd: process.cwd(), stdio: "inherit" });
}
