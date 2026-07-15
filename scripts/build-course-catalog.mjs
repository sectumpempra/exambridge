import { createServer } from "vite";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  resolve: { alias: { "@": resolve(root, "src") } },
});

try {
  const { COURSE_CATALOG } = await server.ssrLoadModule("/src/course-context/catalog-source.ts");
  const { auditCourseCatalog } = await server.ssrLoadModule("/src/course-context/audit.ts");
  const featureCodes = { boundaries: "b", statistics: "s", papers: "p", syllabus: "y", calculator: "c", planner: "l", graph: "g", examOverview: "e" };
  const errors = [...auditCourseCatalog(COURSE_CATALOG).errors];
  if (errors.length) throw new Error(`Course catalog audit failed:\n${errors.join("\n")}`);
  const entries = COURSE_CATALOG.map((entry) => [
    entry.boardName,
    entry.level,
    entry.subjectCode,
    entry.subjectName,
    entry.subjectCategory,
    entry.lifecycleStatus,
    entry.lifecycleEvidence,
    entry.lastObservedYear ?? 0,
    entry.specificationLabel,
    Object.entries(featureCodes).filter(([feature]) => entry.capabilities[feature].status !== "unavailable").map(([, code]) => code).join(""),
    entry.knowledgeTreeCode ?? "",
    entry.calculatorBoardKey ?? "",
    entry.plannerLevel ?? "",
    entry.plannerBoard ?? "",
    entry.gradeCalculation,
  ]);
  const payload = { version: 3, accessedAt: "2026-07-15", entries };
  await writeFile(resolve(root, "src/course-context/courseCatalog.generated.json"), `${JSON.stringify(payload)}\n`, "utf8");
  console.log(`Course catalog: ${entries.length} entries generated.`);
} finally {
  await server.close();
}
