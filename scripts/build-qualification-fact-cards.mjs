import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { buildQualificationFactCards } from "./lib/qualification-fact-cards.mjs";

const root = process.cwd();
const readJson = path => readFile(join(root, path), "utf8").then(JSON.parse);
const [scope, candidate, identityCatalog, boundaries, statistics, rules] = await Promise.all([
  readJson("data/candidates/academic-results-v2/scope.json"),
  readJson("data/candidates/academic-results-v2/migration-candidate.json"),
  readJson("data/candidates/academic-results-v2/qualification-identities.json"),
  readJson("generated/academic-results-v2/boundary-coverage-matrix.json"),
  readJson("generated/academic-results-v2/statistics-coverage-matrix.json"),
  readJson("generated/academic-results-v2/rule-coverage-matrix.json"),
]);

const server = await createServer({
  root,
  configFile: false,
  appType: "custom",
  resolve: { alias: { "@": join(root, "src") } },
  server: { middlewareMode: true },
  logLevel: "silent",
});
let courseCatalog;
let getExamOverviewForCourse;
try {
  ({ COURSE_CATALOG: courseCatalog } = await server.ssrLoadModule("/src/course-context/catalog.ts"));
  ({ getExamOverviewForCourse } = await server.ssrLoadModule("/src/domain-v2/exam-overview/catalog.ts"));
} finally {
  await server.close();
}

const result = buildQualificationFactCards({
  scope,
  candidate,
  identityCatalog,
  matrices: { boundaries, statistics, rules },
  courseCatalog,
  getExamOverviewForCourse,
});
const outputDirectory = join(root, "generated/academic-results-v2");
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(join(outputDirectory, "qualification-fact-cards.json"), `${JSON.stringify(result.catalog, null, 2)}\n`),
  writeFile(join(outputDirectory, "real-gap-report.json"), `${JSON.stringify(result.gapReport, null, 2)}\n`),
]);
console.log(`Qualification fact cards: ${result.catalog.cards.length}; gaps P0/P1/P2/P3 ${result.gapReport.counts.P0}/${result.gapReport.counts.P1}/${result.gapReport.counts.P2}/${result.gapReport.counts.P3}.`);
