import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const candidateDirectory = resolve(root, "data/candidates/knowledge-v4");
const reviewDirectory = resolve(root, "data/candidates/knowledge-v4-reviews");
const reportPath = resolve(root, "generated/knowledge-point-review-report.json");
const expectedIds = [
  "AQA-7357", "AQA-7367", "AQA-8300", "AQA-8365",
  "CAIE-0580", "CAIE-0606", "CAIE-9231", "CAIE-9709",
  "Edexcel-1MA1", "Edexcel-4MA1", "Edexcel-4PM1", "Edexcel-8MA0", "Edexcel-9FM0", "Edexcel-9MA0", "Edexcel-IAL",
  "OCR-6993", "OCR-H240", "OCR-H245", "OCR-H640", "OCR-J560", "WJEC-3300",
];
const failures = [];
const summaries = [];
const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  resolve: { alias: { "@": resolve(root, "src") } },
});

try {
  const { KnowledgeMappingV4Schema } = await server.ssrLoadModule("/src/domain-v2/knowledge-tree/v4-schema.ts");
  const candidateFiles = new Set(await readdir(candidateDirectory).catch(() => []));
  const reviewFiles = new Set(await readdir(reviewDirectory).catch(() => []));
  for (const id of expectedIds) {
    const file = `${id}.json`;
    if (!candidateFiles.has(file)) { failures.push(`${id}: missing mapping candidate`); continue; }
    if (!reviewFiles.has(file)) { failures.push(`${id}: missing point-review file`); continue; }
    const candidateParse = KnowledgeMappingV4Schema.safeParse(JSON.parse(await readFile(resolve(candidateDirectory, file), "utf8")));
    if (!candidateParse.success) {
      failures.push(`${id}: invalid mapping candidate: ${candidateParse.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
      continue;
    }
    const candidate = candidateParse.data;
    const review = JSON.parse(await readFile(resolve(reviewDirectory, file), "utf8"));
    if (review.qualificationVersionId !== candidate.qualificationVersionId) failures.push(`${id}: review qualificationVersionId mismatch`);
    const isAqa = id.startsWith("AQA-");
    if (isAqa && review.reviewMethod !== "local-only-policy-review") failures.push(`${id}: AQA must use local-only review`);
    if (!isAqa && (review.requestedModelId !== "kimi-k2.7-code-highspeed" || review.responseModelId !== "kimi-k2.7-code-highspeed")) failures.push(`${id}: review model mismatch`);
    const pointIds = new Set(candidate.syllabusPoints.map((point) => point.syllabusPointId));
    const reviewRows = review.pointReviews ?? [];
    const reviewedIds = new Set();
    for (const row of reviewRows) {
      if (!pointIds.has(row.syllabusPointId)) failures.push(`${id}: review references unknown point ${row.syllabusPointId}`);
      if (reviewedIds.has(row.syllabusPointId)) failures.push(`${id}: duplicate review row ${row.syllabusPointId}`);
      reviewedIds.add(row.syllabusPointId);
    }
    for (const pointId of pointIds) if (!reviewedIds.has(pointId)) failures.push(`${id}: point not independently reviewed ${pointId}`);
    const failCount = reviewRows.filter((row) => ["fail", "manual-review-required"].includes(row.status)).length;
    const warningCount = reviewRows.filter((row) => row.status === "warning").length;
    const missingOfficialPoints = review.missingOfficialPoints ?? [];
    const highIssues = (review.overallIssues ?? []).filter((issue) => issue.severity === "high");
    const duplicatePointIds = review.duplicatePointIds ?? [];
    const sourceReferences = candidate.syllabusPoints.filter((point) => /(?:page\s+|p{1,2}\.\s*)\d+/i.test(point.sourceReference)).length;
    const sourcePageReferenceRate = candidate.syllabusPoints.length ? sourceReferences / candidate.syllabusPoints.length : 0;
    summaries.push({
      id,
      reviewMethod: review.reviewMethod,
      candidatePoints: candidate.syllabusPoints.length,
      reviewedPoints: reviewedIds.size,
      mappedPoints: candidate.syllabusPoints.filter((point) => point.canonicalNodeIds.length).length,
      sourcePageReferenceRate,
      failCount,
      warningCount,
      missingOfficialPointCount: missingOfficialPoints.length,
      highIssueCount: highIssues.length,
      duplicatePointCount: duplicatePointIds.length,
      approvalEligible: failCount === 0 && missingOfficialPoints.length === 0 && highIssues.length === 0 && duplicatePointIds.length === 0 && reviewedIds.size === pointIds.size && sourcePageReferenceRate === 1,
    });
  }
} finally {
  await server.close();
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  expectedCourseCount: expectedIds.length,
  reviewedCourseCount: summaries.length,
  totalCandidatePoints: summaries.reduce((sum, entry) => sum + entry.candidatePoints, 0),
  totalReviewedPoints: summaries.reduce((sum, entry) => sum + entry.reviewedPoints, 0),
  approvalEligibleCourseCount: summaries.filter((entry) => entry.approvalEligible).length,
  summaries,
  failureCount: failures.length,
  failures,
};
await mkdir(resolve(root, "generated"), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Knowledge point-review audit passed: ${summaries.length} courses, ${report.totalReviewedPoints} points, ${report.approvalEligibleCourseCount} approval-eligible.`);
}
