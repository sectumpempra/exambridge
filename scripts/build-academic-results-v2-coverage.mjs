import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildAcademicResultsCoverageMatrix, loadAcademicResultsCoverageInputs } from "./lib/academic-results-v2-coverage.mjs";

const root = process.cwd();
const { scope, candidate } = await loadAcademicResultsCoverageInputs(root);
const matrix = await buildAcademicResultsCoverageMatrix(scope, candidate);
const output = join(root, "generated/academic-results-v2/coverage-matrix.json");
await mkdir(join(root, "generated/academic-results-v2"), { recursive: true });
await writeFile(output, `${JSON.stringify(matrix, null, 2)}\n`);
console.log(`Academic Results V2 coverage matrix: ${matrix.expectedCellCount} expected route-series cells, ${matrix.unresolvedCellCount} unresolved.`);
