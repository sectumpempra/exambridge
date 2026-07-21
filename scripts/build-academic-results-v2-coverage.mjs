import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildAcademicResultsCoverageMatrix, loadAcademicResultsCoverageInputs } from "./lib/academic-results-v2-coverage.mjs";
import {
  buildCoverageExpectationPolicies,
  buildCoverageMigrationReport,
  buildSparseCoverageMatrices,
} from "./lib/academic-results-v3-coverage.mjs";

const root = process.cwd();
const { scope, candidate } = await loadAcademicResultsCoverageInputs(root);
const identityCatalog = JSON.parse(await readFile(join(root, "data/candidates/academic-results-v2/qualification-identities.json"), "utf8"));
const legacyMatrix = await buildAcademicResultsCoverageMatrix(scope, candidate);
const policyCatalog = buildCoverageExpectationPolicies(scope, candidate, identityCatalog);
const matrices = buildSparseCoverageMatrices(scope, candidate, policyCatalog);
const migrationReport = buildCoverageMigrationReport(legacyMatrix, matrices);
const outputDirectory = join(root, "generated/academic-results-v2");
await mkdir(join(root, "generated/academic-results-v2"), { recursive: true });
await Promise.all([
  writeFile(join(outputDirectory, "coverage-matrix.json"), `${JSON.stringify(legacyMatrix, null, 2)}\n`),
  writeFile(join(outputDirectory, "legacy-combined-coverage.json"), `${JSON.stringify(legacyMatrix, null, 2)}\n`),
  writeFile(join(outputDirectory, "coverage-expectation-policies.json"), `${JSON.stringify(policyCatalog, null, 2)}\n`),
  writeFile(join(outputDirectory, "boundary-coverage-matrix.json"), `${JSON.stringify(matrices.boundaries, null, 2)}\n`),
  writeFile(join(outputDirectory, "statistics-coverage-matrix.json"), `${JSON.stringify(matrices.statistics, null, 2)}\n`),
  writeFile(join(outputDirectory, "rule-coverage-matrix.json"), `${JSON.stringify(matrices.rules, null, 2)}\n`),
  writeFile(join(outputDirectory, "coverage-migration-report.json"), `${JSON.stringify(migrationReport, null, 2)}\n`),
]);
console.log(`Academic Results sparse coverage: boundaries ${matrices.boundaries.expectedCellCount}/${matrices.boundaries.pendingCellCount} pending, statistics ${matrices.statistics.expectedCellCount}/${matrices.statistics.pendingCellCount} pending, rules ${matrices.rules.expectedCellCount}/${matrices.rules.pendingCellCount} pending. Legacy unresolved: ${legacyMatrix.unresolvedCellCount}.`);
