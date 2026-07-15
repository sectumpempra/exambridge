import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const candidatePath = resolve(root, "data/candidates/exam-overview/candidate.json");
const reportPath = resolve(root, "generated/exam-overview-update-report.json");
const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  resolve: { alias: { "@": resolve(root, "src") } },
});

try {
  const { EXAM_OVERVIEW_CATALOG, ExamOverviewCandidateSchema, diffExamOverview } = await server.ssrLoadModule("/src/domain-v2/exam-overview/index.ts");
  let report;
  try {
    await access(candidatePath, constants.R_OK);
    const payload = JSON.parse(await readFile(candidatePath, "utf8"));
    const candidates = payload.courses.map((item) => ExamOverviewCandidateSchema.parse(item));
    const activeById = new Map(EXAM_OVERVIEW_CATALOG.map((item) => [item.id, item]));
    const diffs = candidates.map((candidate) => {
      const active = activeById.get(candidate.id);
      if (!active) return { courseId: candidate.id, changedSections: ["new-course"], requiresApproval: true };
      return diffExamOverview(active, candidate);
    });
    report = {
      status: "candidate-awaiting-approval",
      generatedAt: payload.generatedAt ?? candidates[0]?.release.generatedAt,
      sourceRun: payload.sourceRun,
      candidatePath: "data/candidates/exam-overview/candidate.json",
      diffs,
      publicationBlocked: true,
    };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    report = {
      status: "no-candidate",
      generatedAt: EXAM_OVERVIEW_CATALOG[0]?.release.verifiedAt,
      activeCourseGroups: EXAM_OVERVIEW_CATALOG.map((item) => item.id),
      publicationBlocked: false,
      note: "Scheduled research may create a candidate file; only a reviewed approval may update the active catalog.",
    };
  }
  await mkdir(resolve(root, "generated"), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Exam overview update report: ${report.status}.`);
} finally {
  await server.close();
}
