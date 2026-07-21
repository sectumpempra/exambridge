import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { buildOfficialAwardRuleCandidates } from "./lib/official-award-rule-candidates.mjs";

const root = process.cwd();
const candidateDirectory = join(root, "data", "candidates", "academic-results-v2");
const generatedDirectory = join(root, "generated", "academic-results-v2");
const scope = JSON.parse(await readFile(join(candidateDirectory, "scope.json"), "utf8"));
const qualifications = new Map(scope.qualifications.map(item => [item.awardQualificationId, item]));

const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const readJson = async path => JSON.parse(await readFile(join(root, path), "utf8"));
const sourceRecords = new Map();

function addSource({ sourceId, board, officialUrl, documentTitle, documentVersion, publishedAt, accessedAt, printedPage, pdfPage, tableName, sourceRowId, sourceDocumentHash, effectiveFrom, effectiveTo, verificationStatus }) {
  if (!sourceRecords.has(sourceId)) {
    sourceRecords.set(sourceId, {
      schemaVersion: "1.0.0",
      sourceId,
      board,
      officialUrl,
      documentTitle,
      ...(documentVersion ? { documentVersion } : {}),
      ...(publishedAt ? { publishedAt } : {}),
      accessedAt,
      ...(printedPage ? { printedPage } : {}),
      ...(pdfPage ? { pdfPage } : {}),
      ...(tableName ? { tableName } : {}),
      ...(sourceRowId ? { sourceRowId } : {}),
      ...(sourceDocumentHash ? { sourceDocumentHash } : {}),
      effectiveFrom: effectiveFrom ?? publishedAt ?? `${scope.startYear}-01-01`,
      ...(effectiveTo ? { effectiveTo } : {}),
      verificationStatus,
    });
  }
  return sourceId;
}

function parseSeries(value) {
  const normalized = String(value).trim().toLowerCase().replace("autumn", "november").replace("summer", "june");
  const match = normalized.match(/(20\d{2})[- ](jan(?:uary)?|mar(?:ch)?|jun(?:e)?|oct(?:ober)?|nov(?:ember)?)/)
    ?? normalized.match(/(jan(?:uary)?|mar(?:ch)?|jun(?:e)?|oct(?:ober)?|nov(?:ember)?)[- ](20\d{2})/);
  if (!match) throw new Error(`Unsupported series: ${value}`);
  const year = Number(match[1].startsWith("20") ? match[1] : match[2]);
  const token = match[1].startsWith("20") ? match[2] : match[1];
  const series = token.startsWith("jan") ? "january" : token.startsWith("mar") ? "march" : token.startsWith("jun") ? "june" : token.startsWith("oct") ? "october" : "november";
  return { year, series };
}

function boundaryAwardId(routeId) {
  for (const awardId of qualifications.keys()) {
    if (routeId.startsWith(`${awardId}:`)) return awardId;
  }
  throw new Error(`Boundary route is outside approved scope: ${routeId}`);
}

async function loadLegacyStatistics() {
  const server = await createServer({
    root,
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
    logLevel: "silent",
  });
  try {
    const resultStatisticsModule = await server.ssrLoadModule("/src/data/resultStatistics.ts");
    return resultStatisticsModule.ALL_SUBJECT_STATS;
  } finally {
    await server.close();
  }
}

const officialBoundaryFiles = [
  "src/data/official/awards/aqa-7357.json",
  "src/data/official/awards/caie-9709.json",
  "src/data/official/awards/ocr-6993.json",
  "src/data/official/awards/ocr-h240.json",
  "src/data/official/awards/ocr-h245.json",
  "src/data/official/awards/ocr-h640.json",
  "src/data/official/awards/pearson-8ma0.json",
];
const boundaries = [];
for (const file of officialBoundaryFiles) {
  for (const row of (await readJson(file)).boundaries) {
    const awardQualificationId = boundaryAwardId(row.routeId);
    const qualification = qualifications.get(awardQualificationId);
    const { year, series } = parseSeries(row.series);
    const sourceId = addSource({
      sourceId: `source:${slug(row.sourceRowId)}`,
      board: qualification.board,
      officialUrl: row.sourceUrl,
      documentTitle: `${qualification.label} ${row.series} official grade boundary`,
      publishedAt: row.publishedAt,
      accessedAt: row.accessedAt,
      printedPage: row.printedPage,
      pdfPage: row.pdfPage,
      sourceRowId: row.sourceRowId,
      sourceDocumentHash: row.sourceDocumentHash,
      verificationStatus: qualification.board === "AQA" ? "codex-reviewed" : "candidate",
    });
    boundaries.push({
      schemaVersion: "2.0.0",
      boundaryId: `boundary:${slug(row.sourceRowId)}`,
      qualificationVersionId: qualification.currentKnowledgeQualificationVersionId,
      awardQualificationId,
      year,
      series,
      routeId: row.routeId,
      ...(row.optionCode ? { optionCode: row.optionCode } : {}),
      boundaryScope: "overall",
      maximumMark: row.maximumMarkAfterWeighting,
      gradeOrder: Object.keys(row.thresholds),
      thresholds: row.thresholds,
      publicationStatus: "final",
      sourceIds: [sourceId],
      verificationStatus: qualification.board === "AQA" ? "codex-reviewed" : "candidate",
    });
  }
}

// AQA content is deliberately processed locally. The existing row extract contains
// all three 7367 overall options; the already-verified 7357 file supplies the exact
// document URL, publication date and hash for the same series-level source PDF.
const aqaFurtherRows = (await readJson("src/data/official/aqa-a-level-math-grade-boundaries.json"))
  .filter(row => row.code === "7367" && row.unit.toLowerCase().includes("overall"));
const aqaSeriesEvidence = new Map((await readJson("src/data/official/awards/aqa-7357.json")).boundaries.map(row => [row.series, row]));
const aqaFurtherQualification = qualifications.get("award:aqa:7367");
for (const row of aqaFurtherRows) {
  const seriesKey = `${row.year}-${row.session.toLowerCase()}`;
  const source = aqaSeriesEvidence.get(seriesKey);
  if (!source) throw new Error(`AQA 7367 ${seriesKey} has no verified series-level source evidence`);
  const optionCode = row.unit.match(/7367(DS|MD|SM)/)?.[1];
  if (!optionCode) throw new Error(`AQA 7367 row has no supported option code: ${row.unit}`);
  const sourceRowId = `AQA-${row.year}-${row.session.toUpperCase()}-7367-${optionCode}-OVERALL`;
  const sourceId = addSource({
    sourceId: `source:${slug(sourceRowId)}`,
    board: "AQA",
    officialUrl: source.sourceUrl,
    documentTitle: `AQA A-level Further Mathematics 7367 ${row.session} ${row.year} official grade boundaries`,
    publishedAt: source.publishedAt,
    accessedAt: source.accessedAt,
    sourceRowId,
    sourceDocumentHash: source.sourceDocumentHash,
    verificationStatus: "codex-reviewed",
  });
  boundaries.push({
    schemaVersion: "2.0.0",
    boundaryId: `boundary:${slug(sourceRowId)}`,
    qualificationVersionId: aqaFurtherQualification.currentKnowledgeQualificationVersionId,
    awardQualificationId: "award:aqa:7367",
    year: Number(row.year),
    series: row.session.toLowerCase(),
    routeId: "award:aqa:7367:linear",
    optionCode,
    boundaryScope: "overall",
    maximumMark: row.max_mark,
    gradeOrder: ["A*", "A", "B", "C", "D", "E"],
    thresholds: { "A*": row.a_star, A: row.a, B: row.b, C: row.c, D: row.d, E: row.e },
    publicationStatus: "final",
    sourceIds: [sourceId],
    verificationStatus: "codex-reviewed",
  });
}

const legacyRoutes = (await readJson("src/data/official/awards/routes.json")).routes;
const routeQualificationVersionId = route => {
  if (route.board === "CAIE") return `CAIE-${route.qualificationCode}:${route.specificationVersion.replace(`${route.qualificationCode}-`, "")}`;
  const awardId = route.board === "Edexcel UK" ? `award:pearson:${route.qualificationCode.toLowerCase()}` : `award:${route.board.toLowerCase()}:${route.qualificationCode.toLowerCase()}`;
  return qualifications.get(awardId)?.currentKnowledgeQualificationVersionId ?? route.specificationVersion;
};
const routeAwardId = route => route.board === "Edexcel UK"
  ? `award:pearson:${route.qualificationCode.toLowerCase()}`
  : `award:${route.board.toLowerCase()}:${route.qualificationCode.toLowerCase()}`;
const routeEffectiveFrom = route => route.board === "CAIE"
  ? `${route.specificationVersion.match(/20\d{2}/)?.[0] ?? "2023"}-01-01`
  : route.qualificationCode === "6993" ? "2018-09-01" : "2017-09-01";
const completeDate = value => /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
const awardRules = legacyRoutes.map(route => {
  const awardQualificationId = routeAwardId(route);
  const qualification = qualifications.get(awardQualificationId);
  if (!qualification) throw new Error(`Route ${route.id} is outside approved scope`);
  const sourceId = addSource({
    sourceId: `source:${slug(route.sourceRowId)}`,
    board: qualification.board,
    officialUrl: route.sourceUrl,
    documentTitle: `${qualification.label} official specification and award route`,
    publishedAt: completeDate(route.publishedAt),
    accessedAt: route.accessedAt,
    sourceRowId: route.sourceRowId,
    sourceDocumentHash: route.sourceDocumentHash,
    verificationStatus: qualification.board === "AQA" ? "codex-reviewed" : "candidate",
  });
  return {
    schemaVersion: "2.0.0",
    ruleId: `rule:${slug(route.id)}:${slug(route.specificationVersion)}`,
    qualificationVersionId: routeQualificationVersionId(route),
    awardQualificationId,
    board: qualification.board,
    subjectCode: route.qualificationCode,
    routeId: route.id,
    routeType: route.routeType,
    scoringSystem: route.board === "CAIE" ? "weighted-raw" : "raw",
    components: route.components.map(component => ({
      code: component.code,
      inputKind: component.inputKind,
      maximumRawMark: component.maxRawMark,
      maximumAwardMark: component.maxRawMark * component.weightingFactor,
      weightingFactor: component.weightingFactor,
      optional: false,
    })),
    validCombinations: [{
      combinationId: route.routeKey,
      componentCodes: route.components.map(component => component.code),
      ...(route.optionCode ? { optionCode: route.optionCode } : {}),
      awardLevel: route.level,
    }],
    totalMaximumAwardMark: route.maximumMarkAfterWeighting,
    gradeScale: route.grades,
    roundingRule: route.roundingRule,
    resitRule: {
      allowed: true,
      selectionMethod: route.routeType === "linear" ? "complete-award-entry" : route.routeType === "staged" ? "whole-as-carry-forward" : "same-series-route",
      notes: ["Candidate migration of the existing verified route; board-specific resit details require separate rule evidence."],
    },
    ...(route.routeType === "staged" ? {
      carryForwardRule: { allowed: true, maximumMonths: 13, unit: "whole-as", notes: ["Only the complete official AS carry-forward mark is accepted."] },
    } : {}),
    aStarRule: {
      available: route.grades.includes("A*"),
      ruleKind: route.grades.includes("A*") ? "boundary-only" : "not-available",
      notes: [route.grades.includes("A*") ? "A* is determined by the official overall boundary for this route." : "This award route does not publish A*."],
    },
    effectiveFrom: routeEffectiveFrom(route),
    ...(route.board === "CAIE" && route.specificationVersion.endsWith("2023-2025") ? { effectiveTo: "2025-12-31" } : {}),
    sourceIds: [sourceId],
    verificationStatus: qualification.board === "AQA" ? "codex-reviewed" : "candidate",
  };
});
awardRules.push(...buildOfficialAwardRuleCandidates(addSource));

const directOfficialStatistics = [];
const aqaStats = await readJson("src/data/official/aqa-math-results-statistics.json");
const aqaArchiveUrl = "https://www.aqa.org.uk/exams-administration/results-days/results-statistics/results-statistics-archive";
for (const subject of aqaStats.filter(item => ["7357", "7367"].includes(item.code))) {
  const awardQualificationId = `award:aqa:${subject.code}`;
  const qualification = qualifications.get(awardQualificationId);
  for (const year of subject.years.filter(item => item.year >= scope.startYear && item.year <= scope.latestYear)) {
    const sourceId = addSource({
      sourceId: `source:aqa-results-statistics-${subject.code}-${year.year}-${year.series}`,
      board: "AQA",
      officialUrl: aqaArchiveUrl,
      documentTitle: `AQA ${subject.name} results statistics ${year.year}`,
      publishedAt: `${year.year}-08-01`,
      accessedAt: "2026-07-21",
      sourceRowId: `AQA-${year.year}-${year.series.toUpperCase()}-${subject.code}`,
      verificationStatus: "candidate",
    });
    directOfficialStatistics.push({ qualification, awardQualificationId, subject, year, sourceIds: [sourceId], verificationStatus: "candidate", publicationStatus: "final" });
  }
}

const ocrStatsText = await readFile(join(root, "src/data/official/ocr-results-statistics.json"), "utf8");
const ocrStats = JSON.parse(ocrStatsText);
const ocrPdfMetadata = {
  2025: { hash: "ac952b2de8f1622d2c916628018c9bf5952adfca7463a9fbea258c059fd4d1f0", publishedAt: "2025-08-14", status: "provisional", fsmqPage: 6 },
  2024: { hash: "fd594bd4054ff6a1c953ccc2a7430b0d45bdf5315a55f25634375e8f6e791b59", publishedAt: "2024-08-15", status: "provisional", fsmqPage: 5 },
  2023: { hash: "9f2b9a95fee947e86e8a41b55c302eff8fb44ed716f8a9881f688b5d96dc8ec9", publishedAt: "2023-08-17", status: "provisional", fsmqPage: 5 },
  2022: { hash: "4f47d50795a91c682503299f72b8bea3aa26d5be19679665cd99ad926fbbb002", publishedAt: "2022-08-18", status: "provisional", fsmqPage: 5 },
  2021: { hash: "bebae88b3d5c938276240d2c665fdc8b9e76d455c0fa3b1cf583de1974222b26", publishedAt: "2022-05-31", status: "final", fsmqPage: 4 },
};
for (const row of [...ocrStats.aLevel, ...(ocrStats.fsmq ?? [])].filter(item => ["H240", "H245", "H640", "6993"].includes(item.code))) {
  const awardQualificationId = `award:ocr:${row.code.toLowerCase()}`;
  const qualification = qualifications.get(awardQualificationId);
  const metadata = ocrPdfMetadata[row.year];
  const sourceUrl = ocrStats.sources[String(row.year)]?.aLevel;
  if (!sourceUrl) throw new Error(`OCR ${row.code}/${row.year} has no row-level source URL`);
  const sourceId = addSource({
    sourceId: `source:ocr-results-statistics-${row.code.toLowerCase()}-${row.year}-june`,
    board: "OCR",
    officialUrl: sourceUrl,
    documentTitle: `OCR AS, A Level and FSMQ results statistics June ${row.year}`,
    publishedAt: metadata.publishedAt,
    accessedAt: "2026-07-21",
    printedPage: row.code === "6993" ? metadata.fsmqPage : 1,
    pdfPage: row.code === "6993" ? metadata.fsmqPage : 1,
    tableName: row.code === "6993" ? `Advanced FSMQ Results June ${row.year}` : `Advanced GCE Results June ${row.year}`,
    sourceRowId: `OCR-${row.year}-JUNE-${row.code}`,
    sourceDocumentHash: metadata.hash,
    verificationStatus: "codex-reviewed",
  });
  directOfficialStatistics.push({
    qualification,
    awardQualificationId,
    subject: { code: row.code },
    year: {
      year: row.year,
      series: "june",
      ...(row.code === "6993"
        ? { aRate: row.rates[0], bRate: row.rates[1], cRate: row.rates[2], dRate: row.rates[3], eRate: row.rates[4], entries: row.entries }
        : { aStarRate: row.rates[0], aRate: row.rates[1], bRate: row.rates[2], cRate: row.rates[3], dRate: row.rates[4], eRate: row.rates[5], entries: row.entries }),
    },
    sourceIds: [sourceId],
    verificationStatus: "codex-reviewed",
    publicationStatus: metadata.status,
  });
}

const pearsonIalOfficialStatistics = [
  {
    year: 2025,
    series: "june",
    publicationStatus: "final",
    publishedAt: "2026-06-23",
    officialUrl: "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-statistics/International-A-level/grade-statistics-june-2025-final-edexcel-international-advanced-level.pdf",
    documentTitle: "Grade Statistics - June 2025 (Final) Edexcel International Advanced Level",
    sourceDocumentHash: "e480f4508f0acb78a867d8825a85e77ccf3e412b324af190dcffd7eda02c0b3c",
    rows: [
      { code: "YFM01", awardQualificationId: "award:pearson:ial-further-mathematics", rates: [36.6, 58.0, 78.7, 88.8, 94.5, 97.1] },
      { code: "YMA01", awardQualificationId: "award:pearson:ial-mathematics", rates: [32.7, 53.2, 71.1, 82.7, 90.3, 94.9] },
    ],
  },
  {
    year: 2026,
    series: "january",
    publicationStatus: "provisional",
    publishedAt: "2026-03-05",
    officialUrl: "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-statistics/International-A-level/grade-statistics-january-2026-provisional-international-advanced-level.pdf",
    documentTitle: "Grade Statistics - January 2026 (Provisional) Edexcel International Advanced Level",
    sourceDocumentHash: "3bff11f8340aafda8e02c85b264fffa83ab79b4131ccd8e77649fdd7115ce84b",
    rows: [
      { code: "YFM01", awardQualificationId: "award:pearson:ial-further-mathematics", rates: [47.7, 69.2, 81.3, 88.2, 92.9, 96.1] },
      { code: "YMA01", awardQualificationId: "award:pearson:ial-mathematics", rates: [29.7, 45.6, 60.4, 73.2, 83.9, 91.0] },
    ],
  },
];
for (const document of pearsonIalOfficialStatistics) {
  for (const row of document.rows) {
    const qualification = qualifications.get(row.awardQualificationId);
    const sourceId = addSource({
      sourceId: `source:pearson-ial-grade-statistics-${row.code.toLowerCase()}-${document.year}-${document.series}`,
      board: "Pearson",
      officialUrl: document.officialUrl,
      documentTitle: document.documentTitle,
      publishedAt: document.publishedAt,
      accessedAt: "2026-07-21",
      printedPage: 2,
      pdfPage: 2,
      tableName: "Cumulative percentages at specified grades",
      sourceRowId: `PEARSON-IAL-${document.year}-${document.series.toUpperCase()}-${row.code}`,
      sourceDocumentHash: document.sourceDocumentHash,
      verificationStatus: "codex-reviewed",
    });
    directOfficialStatistics.push({
      qualification,
      awardQualificationId: row.awardQualificationId,
      subject: { code: row.code },
      year: {
        year: document.year,
        series: document.series,
        aStarRate: row.rates[0],
        aRate: row.rates[1],
        bRate: row.rates[2],
        cRate: row.rates[3],
        dRate: row.rates[4],
        eRate: row.rates[5],
      },
      sourceIds: [sourceId],
      verificationStatus: "codex-reviewed",
      publicationStatus: document.publicationStatus,
    });
  }
}

const gradeFields = [
  ["A*", "aStarRate"], ["A", "aRate"], ["B", "bRate"], ["C", "cRate"], ["D", "dRate"], ["E", "eRate"],
  ["9", "grade9Rate"], ["8", "grade8Rate"], ["7", "grade7Rate"], ["6", "grade6Rate"], ["5", "grade5Rate"], ["4", "grade4Rate"], ["3", "grade3Rate"], ["2", "grade2Rate"], ["1", "grade1Rate"],
];

function toStatistics({ qualification, awardQualificationId, year, sourceIds, verificationStatus, publicationStatus }) {
  const preferred = year.grade9Rate === undefined ? gradeFields.slice(0, 6) : gradeFields.slice(6);
  const gradeOrder = preferred.filter(([, field]) => year[field] !== undefined).map(([grade]) => grade);
  const gradeRates = Object.fromEntries(preferred.filter(([, field]) => year[field] !== undefined).map(([grade, field]) => [grade, year[field]]));
  const rawGradeRates = year.rawGradeRates
    ? Object.fromEntries(preferred.filter(([, field]) => year.rawGradeRates[field] !== undefined).map(([grade, field]) => [grade, year.rawGradeRates[field]]))
    : undefined;
  return {
    schemaVersion: "2.0.0",
    statisticsId: `statistics:${slug(awardQualificationId)}:${year.year}:${year.series}:all-candidates`,
    qualificationVersionId: qualification.currentKnowledgeQualificationVersionId,
    awardQualificationId,
    year: year.year,
    series: year.series === "summer" ? "june" : year.series === "autumn" ? "november" : year.series,
    regionScope: "all-published-candidates",
    candidateCount: year.entries ?? null,
    rateKind: "cumulative",
    gradeOrder,
    gradeRates,
    ...(rawGradeRates ? {
      rawGradeRates,
      normalization: {
        originalKind: "legacy-cumulative-row",
        normalizedKind: "cumulative",
        reason: (year.normalizationIssues ?? []).join("; "),
      },
    } : {}),
    publicationStatus,
    sourceIds,
    verificationStatus,
  };
}

const statistics = directOfficialStatistics.map(item => toStatistics(item));
const coveredOfficialKeys = new Set(statistics.map(row => `${row.awardQualificationId}|${row.year}|${row.series}`));
const legacySubjects = await loadLegacyStatistics();
const codeToAwardId = new Map(scope.qualifications.map(item => [`${item.board}|${item.subjectCode}`.toLowerCase(), item.awardQualificationId]));
const legacyGroups = new Map();
for (const subject of legacySubjects) {
  const board = subject.board === "Edexcel UK" ? "Pearson" : subject.board === "Edexcel" ? "Pearson" : subject.board;
  const awardQualificationId = codeToAwardId.get(`${board}|${subject.code}`.toLowerCase());
  if (!awardQualificationId || awardQualificationId.startsWith("award:aqa:") || ["award:ocr:h240", "award:ocr:h245", "award:ocr:h640"].includes(awardQualificationId)) continue;
  const qualification = qualifications.get(awardQualificationId);
  for (const year of subject.years.filter(item => item.year >= scope.startYear && item.year <= scope.latestYear)) {
    const normalizedSeries = year.series === "summer"
      ? "june"
      : year.series === "autumn"
        ? "november"
        : ["award:pearson:ial-mathematics", "award:pearson:ial-further-mathematics"].includes(awardQualificationId) && year.series === "november"
          ? "october"
          : year.series;
    const key = `${awardQualificationId}|${year.year}|${normalizedSeries}`;
    if (coveredOfficialKeys.has(key)) continue;
    const candidate = toStatistics({
      qualification,
      awardQualificationId,
      subject,
      year: { ...year, series: normalizedSeries },
      sourceIds: [],
      verificationStatus: "candidate",
      publicationStatus: "source-unavailable",
    });
    const fingerprint = JSON.stringify({ candidateCount: candidate.candidateCount, gradeRates: candidate.gradeRates, rawGradeRates: candidate.rawGradeRates });
    const group = legacyGroups.get(key) ?? new Map();
    group.set(fingerprint, candidate);
    legacyGroups.set(key, group);
  }
}

const statisticsConflicts = [];
for (const [key, variants] of legacyGroups) {
  if (variants.size === 1) {
    statistics.push([...variants.values()][0]);
  } else {
    statisticsConflicts.push({
      conflictId: `statistics-conflict:${slug(key)}`,
      canonicalKey: key,
      status: "manual-source-resolution-required",
      variants: [...variants.values()],
    });
  }
}

const candidate = {
  schemaVersion: "2.0.0",
  generatedAt: "2026-07-21T00:00:00+08:00",
  baselineCommit: scope.baselineCommit,
  activationPolicy: scope.activationPolicy,
  sources: [...sourceRecords.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
  boundaries: boundaries.sort((a, b) => a.boundaryId.localeCompare(b.boundaryId)),
  statistics: statistics.sort((a, b) => a.statisticsId.localeCompare(b.statisticsId)),
  statisticsProvenance: Object.fromEntries(statistics.map(row => [row.statisticsId, {
    migrationOrigin: row.awardQualificationId.startsWith("award:aqa:")
      ? "official-local-aqa"
      : row.sourceIds.length > 0
        ? `official-${sourceRecords.get(row.sourceIds[0])?.board.toLowerCase() ?? "unknown"}`
        : "legacy-results-statistics",
  }])),
  awardRules: awardRules.sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
  statisticsConflicts: statisticsConflicts.sort((a, b) => a.conflictId.localeCompare(b.conflictId)),
};

const perQualification = Object.fromEntries(scope.qualifications.map(item => {
  const rows = candidate.statistics.filter(row => row.awardQualificationId === item.awardQualificationId);
  return [item.awardQualificationId, {
    boundaryCount: candidate.boundaries.filter(row => row.awardQualificationId === item.awardQualificationId).length,
    statisticsCount: rows.length,
    sourcedStatisticsCount: rows.filter(row => row.sourceIds.length > 0).length,
    normalizationCount: rows.filter(row => row.normalization).length,
    awardRuleCount: candidate.awardRules.filter(row => row.awardQualificationId === item.awardQualificationId).length,
    conflictCount: candidate.statisticsConflicts.filter(row => row.canonicalKey.startsWith(`${item.awardQualificationId}|`)).length,
    years: [...new Set(rows.map(row => row.year))].sort(),
  }];
}));

const report = {
  schemaVersion: "1.0.0",
  generatedAt: candidate.generatedAt,
  sourceCount: candidate.sources.length,
  boundaryCount: candidate.boundaries.length,
  statisticsCount: candidate.statistics.length,
  awardRuleCount: candidate.awardRules.length,
  statisticsConflictCount: candidate.statisticsConflicts.length,
  perQualification,
  limitations: [
    "Legacy statistics without an exact row-level official locator remain source-unavailable candidates.",
    "Conflicting same-series legacy values are retained as variants and no value is selected by array order.",
    "AQA records were processed locally and were not sent to an external model.",
  ],
};

await mkdir(candidateDirectory, { recursive: true });
await mkdir(generatedDirectory, { recursive: true });
await writeFile(join(candidateDirectory, "migration-candidate.json"), `${JSON.stringify(candidate, null, 2)}\n`);
await writeFile(join(generatedDirectory, "migration-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Built Academic Results V2 candidate: ${candidate.boundaries.length} boundaries, ${candidate.statistics.length} statistics rows, ${candidate.awardRules.length} award rules, ${candidate.statisticsConflicts.length} conflicts.`);
