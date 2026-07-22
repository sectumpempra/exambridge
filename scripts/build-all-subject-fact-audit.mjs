import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const active = JSON.parse(await readFile(join(root, "public/data/academic-results-v2/manifest.json"), "utf8"));
const candidate = JSON.parse(await readFile(join(root, "data/candidates/academic-results-v2/migration-candidate.json"), "utf8"));
const university = JSON.parse(await readFile(join(root, "data/candidates/university-admissions-v1/candidate.json"), "utf8"));
const server = await createServer({
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  resolve: { alias: { "@": resolve(root, "src") } },
});

const boardKeyForCourse = course => {
  if (course.boardName === "CAIE") return course.level === "A-Level" ? "caie_al" : "caie";
  if (course.boardName.startsWith("Edexcel")) return course.level === "A-Level" ? "edexcel_al" : "edexcel";
  if (course.boardName === "AQA") return course.level === "A-Level" ? "aqa_al" : "aqa";
  if (course.boardName === "OCR") return course.level === "A-Level" ? "ocr_al" : "ocr";
  return undefined;
};
const canonicalBoardMatches = (course, identity) => {
  if (course.boardName.startsWith("Edexcel")) return identity.board === "Pearson";
  return course.boardName === identity.board;
};
const countBoundaryRows = subjectIndex => Object.values(subjectIndex ?? {}).reduce((total, seriesMap) =>
  total + Object.values(seriesMap).reduce((sum, variants) => sum + variants.length, 0), 0);

try {
  const { COURSE_CATALOG, getDisplayCourseCatalog } = await server.ssrLoadModule("/src/course-context/catalog.ts");
  const { ALL_SUBJECT_STATS, RESULT_STATISTICS_NORMALIZATION_CANDIDATES, getSubjectStats } = await server.ssrLoadModule("/src/data/resultStatistics.ts");
  const { DATA_INDEX } = await server.ssrLoadModule("/src/data/calculatorIndex.ts");
  const currentCourses = getDisplayCourseCatalog("current");
  const historicalCourses = getDisplayCourseCatalog("historical");
  const activeRuleAwardIds = new Set(active.awardRules.filter(row => row.verificationStatus === "owner-approved").map(row => row.awardQualificationId));
  const candidateRuleAwardIds = new Set(candidate.awardRules.map(row => row.awardQualificationId));
  const priorityCodes = new Set([
    "0580", "9709", "9231", "4MA1", "WMA", "YMA01", "YFM01", "7357", "7367", "H240", "H245", "H640", "6993", "8MA0",
    "9700", "9701", "9702", "9618", "9708", "9609", "YBI11", "YCH11", "YPH11", "YEC11", "YBS11", "7402", "7405", "7408", "7136", "7132", "7517", "H420", "H432", "H556", "H443",
  ]);

  const courseRows = currentCourses.map(course => {
    const boardKey = boardKeyForCourse(course);
    const stats = getSubjectStats(course.subjectCode, course.boardName, course.level);
    const statsRows = stats?.years ?? [];
    const identity = active.qualificationIdentities.find(row => canonicalBoardMatches(course, row)
      && [row.subjectCode, ...(row.aliases ?? [])].some(code => String(code).toUpperCase() === course.subjectCode.toUpperCase()));
    const awardId = identity?.awardQualificationId;
    const boundaryRows = boardKey ? countBoundaryRows(DATA_INDEX[boardKey]?.[course.subjectCode]) : 0;
    const canonicalBoundaries = awardId ? active.boundaries.filter(row => row.awardQualificationId === awardId).length : 0;
    const canonicalStatistics = awardId ? active.statistics.filter(row => row.awardQualificationId === awardId).length : 0;
    const normalizedRows = RESULT_STATISTICS_NORMALIZATION_CANDIDATES.filter(row => row.board === course.boardName
      && row.level === course.level && row.subjectCode === course.subjectCode).length;
    const sentinelRows = statsRows.filter(row => Object.values(row).some(value => value === 99.9)).length;
    return {
      qualificationId: course.qualificationId,
      board: course.boardName,
      level: course.level,
      subjectCode: course.subjectCode,
      subjectName: course.subjectName,
      subjectCategory: course.subjectCategory,
      awardQualificationId: awardId ?? null,
      ruleCoverage: awardId && activeRuleAwardIds.has(awardId) ? "owner-approved" : awardId && candidateRuleAwardIds.has(awardId) ? "candidate" : "not-catalogued",
      legacyBoundaryRows: boundaryRows,
      activeCanonicalBoundaryRows: canonicalBoundaries,
      legacyStatisticsRows: statsRows.length,
      activeCanonicalStatisticsRows: canonicalStatistics,
      normalizationCandidateRows: normalizedRows,
      sentinel99_9Rows: sentinelRows,
      processingPolicy: course.boardName === "AQA" ? "local-only" : "deepseek-candidate-eligible",
      priorityWave: awardId ? 1 : priorityCodes.has(course.subjectCode) ? 2 : 3,
    };
  });

  const oldGroups = new Map();
  for (const course of COURSE_CATALOG.filter(row => row.lifecycleStatus === "current")) {
    const board = course.boardName.startsWith("Edexcel") ? "pearson" : course.boardName;
    const key = `${board}|${course.subjectCode}`;
    const levels = oldGroups.get(key) ?? new Set();
    levels.add(course.level);
    oldGroups.set(key, levels);
  }
  const crossLevelCollisions = [...oldGroups.entries()]
    .filter(([, levels]) => levels.size > 1)
    .map(([legacyIdentity, levels]) => ({ legacyIdentity, levels: [...levels].sort() }));
  const boardSummary = [...new Set(courseRows.map(row => row.board))].sort().map(board => {
    const rows = courseRows.filter(row => row.board === board);
    return {
      board,
      currentQualifications: rows.length,
      withLegacyBoundaries: rows.filter(row => row.legacyBoundaryRows > 0).length,
      withLegacyStatistics: rows.filter(row => row.legacyStatisticsRows > 0).length,
      withOwnerApprovedRules: rows.filter(row => row.ruleCoverage === "owner-approved").length,
      localOnlyQualifications: rows.filter(row => row.processingPolicy === "local-only").length,
    };
  });
  const subjectCategorySummary = [...new Set(courseRows.map(row => row.subjectCategory))].sort().map(subjectCategory => {
    const rows = courseRows.filter(row => row.subjectCategory === subjectCategory);
    return {
      subjectCategory,
      currentQualifications: rows.length,
      withLegacyBoundaries: rows.filter(row => row.legacyBoundaryRows > 0).length,
      withLegacyStatistics: rows.filter(row => row.legacyStatisticsRows > 0).length,
      withOwnerApprovedRules: rows.filter(row => row.ruleCoverage === "owner-approved").length,
    };
  });
  const report = {
    schemaVersion: "1.0.0",
    generatedAt: "2026-07-23",
    identityContract: "normalized-board + qualification-level + subject-code + qualification-version",
    totals: {
      rawCatalogRecords: COURSE_CATALOG.length,
      currentDisplayQualifications: currentCourses.length,
      historicalDisplayQualifications: historicalCourses.length,
      legacyStatisticsSubjectRecords: ALL_SUBJECT_STATS.length,
      legacyStatisticsYearRows: ALL_SUBJECT_STATS.reduce((sum, subject) => sum + subject.years.length, 0),
      legacyStatisticsNormalizationCandidates: RESULT_STATISTICS_NORMALIZATION_CANDIDATES.length,
      currentQualificationsWithLegacyBoundaries: courseRows.filter(row => row.legacyBoundaryRows > 0).length,
      currentQualificationsWithLegacyStatistics: courseRows.filter(row => row.legacyStatisticsRows > 0).length,
      currentQualificationsWithOwnerApprovedRules: courseRows.filter(row => row.ruleCoverage === "owner-approved").length,
      uniqueAwardQualificationsWithOwnerApprovedRules: new Set(courseRows
        .filter(row => row.ruleCoverage === "owner-approved")
        .map(row => row.awardQualificationId)).size,
      activeCanonicalBoundaries: active.boundaries.length,
      activeCanonicalStatistics: active.statistics.length,
      activeCanonicalAwardRules: active.awardRules.length,
      candidateCanonicalBoundaries: candidate.boundaries.length,
      candidateCanonicalStatistics: candidate.statistics.length,
      candidateCanonicalAwardRules: candidate.awardRules.length,
      crossLevelCollisionsPrevented: crossLevelCollisions.length,
      universityInstitutionsCandidate: university.institutions.length,
      universityProgrammesCandidate: university.programmes.length,
      universityUnresolvedQuarantined: university.quarantine.unresolved.length,
    },
    interpretation: {
      legacyBoundaryRows: "Queryable legacy rows, not proof of qualification-level, versioned or source-backed coverage.",
      legacyStatisticsRows: "Legacy display rows, not active canonical evidence; 99.9 sentinel and normalization candidates require adjudication.",
      ruleCoverage: "Only owner-approved canonical rules may power deterministic award or resit answers.",
      gradeStatisticsBlockingPolicy: "Grade Statistics remains auxiliary and does not block rule explanation or calculator readiness.",
    },
    boardSummary,
    subjectCategorySummary,
    crossLevelCollisions,
    priorityWaves: [
      { wave: 0, scope: "2027 university admissions candidate", status: "imported-candidate", records: university.programmes.length },
      { wave: 1, scope: "13 core mathematics qualifications and qualification rules", status: "canonical-active-with-known-gaps", records: courseRows.filter(row => row.priorityWave === 1).length },
      { wave: 2, scope: "high-demand science, economics, business and computer science qualifications", status: "audit-first", records: courseRows.filter(row => row.priorityWave === 2).length },
      { wave: 3, scope: "remaining current qualifications", status: "catalogue-and-gap-matrix", records: courseRows.filter(row => row.priorityWave === 3).length },
    ],
    courses: courseRows,
  };
  const outputDirectory = join(root, "generated/all-subject-facts-v1");
  await mkdir(outputDirectory, { recursive: true });
  const matrixIdentity = row => ({
    qualificationId: row.qualificationId,
    board: row.board,
    level: row.level,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    awardQualificationId: row.awardQualificationId,
    priorityWave: row.priorityWave,
  });
  const boundaryMatrix = courseRows.map(row => ({
    ...matrixIdentity(row),
    status: row.activeCanonicalBoundaryRows > 0 ? "owner-approved" : row.legacyBoundaryRows > 0 ? "legacy-candidate" : "missing",
    activeCanonicalRows: row.activeCanonicalBoundaryRows,
    legacyInventoryRows: row.legacyBoundaryRows,
  }));
  const statisticsMatrix = courseRows.map(row => ({
    ...matrixIdentity(row),
    status: row.activeCanonicalStatisticsRows > 0 ? "owner-approved" : row.legacyStatisticsRows > 0 ? "legacy-candidate" : "missing",
    activeCanonicalRows: row.activeCanonicalStatisticsRows,
    legacyInventoryRows: row.legacyStatisticsRows,
    normalizationCandidateRows: row.normalizationCandidateRows,
    sentinel99_9Rows: row.sentinel99_9Rows,
  }));
  const ruleMatrix = courseRows.map(row => ({
    ...matrixIdentity(row),
    status: row.ruleCoverage,
    processingPolicy: row.processingPolicy,
  }));
  await Promise.all([
    writeFile(join(outputDirectory, "audit.json"), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(join(outputDirectory, "boundary-coverage.json"), `${JSON.stringify({ schemaVersion: "1.0.0", generatedAt: report.generatedAt, records: boundaryMatrix }, null, 2)}\n`),
    writeFile(join(outputDirectory, "statistics-coverage.json"), `${JSON.stringify({ schemaVersion: "1.0.0", generatedAt: report.generatedAt, blockingPolicy: "auxiliary", records: statisticsMatrix }, null, 2)}\n`),
    writeFile(join(outputDirectory, "resit-rule-coverage.json"), `${JSON.stringify({ schemaVersion: "1.0.0", generatedAt: report.generatedAt, records: ruleMatrix }, null, 2)}\n`),
  ]);
  console.log(`All-subject facts audit: ${currentCourses.length} current display qualifications; ${report.totals.uniqueAwardQualificationsWithOwnerApprovedRules} unique owner-approved rule qualifications; legacy boundary/statistics ${report.totals.currentQualificationsWithLegacyBoundaries}/${report.totals.currentQualificationsWithLegacyStatistics}; ${crossLevelCollisions.length} cross-level collisions prevented.`);
} finally {
  await server.close();
}
