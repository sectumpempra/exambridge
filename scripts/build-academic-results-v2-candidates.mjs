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

addSource({
    sourceId: "source:uk-written-exams-cancelled-2020",
    board: "UK government",
    officialUrl: "https://www.gov.uk/government/publications/coronavirus-covid-19-cancellation-of-gcses-as-and-a-levels-in-2020",
    documentTitle: "Cancellation of GCSEs, AS and A levels in 2020",
    publishedAt: "2020-03-20",
    accessedAt: "2026-07-22",
    effectiveFrom: "2020-03-20",
    effectiveTo: "2020-12-31",
    verificationStatus: "codex-reviewed",
});
addSource({
    sourceId: "source:uk-written-exams-cancelled-2021",
    board: "UK government",
    officialUrl: "https://www.gov.uk/government/publications/gcse-as-and-a-level-summer-report-2021/gcse-as-and-a-level-summer-report-2021",
    documentTitle: "GCSE, AS and A level summer report 2021",
    publishedAt: "2021-12-02",
    accessedAt: "2026-07-22",
    effectiveFrom: "2021-01-01",
    effectiveTo: "2021-12-31",
    verificationStatus: "codex-reviewed",
});

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

function canonicalBoundaryRouteId(row) {
  if (row.routeId.startsWith("award:caie:9709:2023-2025:as:")) return "award:caie:9709:2023-2025:as";
  if (row.routeId.startsWith("award:caie:9709:2023-2025:al:same-series:")) return "award:caie:9709:2023-2025:al:same-series";
  if (row.routeId.startsWith("award:caie:9709:2023-2025:al:staged:")) return "award:caie:9709:2023-2025:al:staged";
  return row.routeId;
}

function boundaryQualificationVersionId(awardQualificationId, year, fallback) {
  if (awardQualificationId === "award:caie:0580") {
    if (year === 2019) return "CAIE-0580:2019";
    if (year <= 2022) return "CAIE-0580:2020-2022";
    if (year <= 2024) return "CAIE-0580:2023-2024";
    return "CAIE-0580:2025-2027";
  }
  if (awardQualificationId !== "award:caie:9709") return fallback;
  if (year === 2019) return "CAIE-9709:2019";
  if (year <= 2022) return "CAIE-9709:2020-2022";
  if (year <= 2025) return "CAIE-9709:2023-2025";
  return "CAIE-9709:2026-2027";
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
  "src/data/official/awards/caie-0580.json",
  "src/data/official/academic-results-v2/caie-9709-2025.json",
  "src/data/official/awards/ocr-6993.json",
  "src/data/official/awards/ocr-h240.json",
  "src/data/official/awards/ocr-h245.json",
  "src/data/official/awards/ocr-h640.json",
  "src/data/official/awards/pearson-8ma0.json",
];
const boundaryAdjudication = await readJson("data/candidates/academic-results-v2/boundary-codex-adjudication.json");
const codexReviewedBoundaryFiles = new Map(boundaryAdjudication.approvedFiles.map(item => [item.path, item]));
const boundaries = [];
for (const file of officialBoundaryFiles) {
  const fileRows = (await readJson(file)).boundaries;
  const adjudication = codexReviewedBoundaryFiles.get(file);
  if (adjudication && adjudication.rowCount !== fileRows.length) {
    throw new Error(`${file} row count changed after Codex adjudication`);
  }
  for (const row of fileRows) {
    const awardQualificationId = boundaryAwardId(row.routeId);
    const qualification = qualifications.get(awardQualificationId);
    const { year, series } = parseSeries(row.series);
    const verificationStatus = qualification.board === "AQA" || (adjudication && row.verificationStatus === "verified")
      ? "codex-reviewed"
      : "candidate";
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
      verificationStatus,
    });
    boundaries.push({
      schemaVersion: "2.0.0",
      boundaryId: `boundary:${slug(row.sourceRowId)}`,
      qualificationVersionId: boundaryQualificationVersionId(awardQualificationId, year, qualification.currentKnowledgeQualificationVersionId),
      awardQualificationId,
      year,
      series,
      routeId: canonicalBoundaryRouteId(row),
      ...(row.optionCode ? { optionCode: row.optionCode } : {}),
      ...(row.componentVariants ? { componentVariants: row.componentVariants } : {}),
      boundaryScope: "overall",
      maximumMark: row.maximumMarkAfterWeighting,
      gradeOrder: Object.keys(row.thresholds),
      thresholds: row.thresholds,
      publicationStatus: "final",
      sourceIds: [sourceId],
      verificationStatus,
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
const administrativeRuleSources = {
  "award:aqa:7357": addSource({
    sourceId: "source:aqa-7357-v1-3-resits",
    board: "AQA",
    officialUrl: "https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-7357-SP-2017.PDF",
    documentTitle: "AQA A-level Mathematics 7357 specification",
    documentVersion: "1.3",
    publishedAt: "2018-01-31",
    accessedAt: "2026-07-22",
    printedPage: 31,
    pdfPage: 31,
    tableName: "General administration - re-sits and shelf life",
    sourceRowId: "AQA-7357-V1.3-P31-RESITS",
    sourceDocumentHash: "6bb4bb826ad2363804a95248a4993b2e147e1a5c4673194e2088dab8754fc6ed",
    verificationStatus: "codex-reviewed",
  }),
  "award:ocr:h240": addSource({
    sourceId: "source:ocr-general-qualification-entry-resit-rules",
    board: "OCR",
    officialUrl: "https://www.ocr.org.uk/administration/general-qualifications/entries-and-registrations/entry-rules/",
    documentTitle: "OCR general qualification entry rules",
    documentVersion: "accessed 2026-07-22",
    publishedAt: "2026-01-01",
    accessedAt: "2026-07-22",
    tableName: "Rules for retaking",
    sourceRowId: "OCR-GENERAL-ENTRY-RULES-LINEAR-RETAKE-ALL-COMPONENTS",
    sourceDocumentHash: "6bbe600850de6073b266c78c949cba4d955884ea37cf7da7e987163ee5c51006",
    verificationStatus: "codex-reviewed",
  }),
  "award:ocr:6993": "source:ocr-general-qualification-entry-resit-rules",
  "award:pearson:8ma0": addSource({
    sourceId: "source:pearson-linear-as-a-level-results-resit-rules",
    board: "Pearson",
    officialUrl: "https://qualifications.pearson.com/en/support/support-topics/results-certification/understanding-marks-and-grades/understanding-your-results-information-for-students/edexcel-a-level-results-explained.html/EO",
    documentTitle: "Pearson Edexcel linear AS and A level results explained",
    documentVersion: "accessed 2026-07-22",
    publishedAt: "2026-01-01",
    accessedAt: "2026-07-22",
    tableName: "Linear AS level and A level qualifications",
    sourceRowId: "PEARSON-LINEAR-AS-A-LEVEL-RESIT-ALL-PAPERS",
    sourceDocumentHash: "a332eef94db916d89911ffd90e3d6eedb8f52eadff75abdac9bb308ccecc1bd3",
    verificationStatus: "codex-reviewed",
  }),
};
const awardRules = legacyRoutes.filter(route => route.qualificationCode !== "9709").map(route => {
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
  const ruleSourceIds = [sourceId, administrativeRuleSources[awardQualificationId]].filter(Boolean);
  const resitNotes = qualification.board === "AQA"
    ? ["The qualification may be re-sat within its shelf life; because it is linear, all assessments are completed in the same series."]
    : qualification.board === "OCR"
      ? ["OCR permits unlimited retakes of this linear qualification; all components must be taken in the retake series."]
      : awardQualificationId === "award:pearson:8ma0"
        ? ["To improve the AS grade, the candidate must retake both linear 8MA0 papers in the same series; AS is a stand-alone qualification."]
        : ["A retake must use a complete valid route under the applicable board rules."];
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
      notes: resitNotes,
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
    sourceIds: ruleSourceIds,
    verificationStatus: qualification.board === "AQA" ? "codex-reviewed" : "candidate",
  };
});
awardRules.push(...buildOfficialAwardRuleCandidates(addSource));

const ruleClauseAdjudication = await readJson("data/candidates/academic-results-v2/award-rule-clause-adjudication.json");
const ruleClauseReviews = new Map(ruleClauseAdjudication.rules.map(item => [item.ruleId, item]));
const ruleClauses = rule => {
  const clauses = ["qualification-version", "paper-structure", "valid-combination", "scoring-scale", "rounding", "resit", "a-star"];
  if (rule.carryForwardRule) clauses.push("carry-forward");
  if (rule.cashInRule) clauses.push("cash-in");
  if (rule.unitLockingRule) clauses.push("unit-locking");
  if (rule.boundarySelectionRule) clauses.push("boundary-selection");
  return clauses;
};
for (const rule of awardRules) {
  const adjudication = ruleClauseReviews.get(rule.ruleId);
  if (adjudication) {
    if (JSON.stringify(adjudication.sourceIds) !== JSON.stringify(rule.sourceIds)) {
      throw new Error(`${rule.ruleId} sources changed after clause adjudication`);
    }
    const accounted = new Set([...adjudication.approvedClauses, ...adjudication.unresolvedClauses]);
    const expected = ruleClauses(rule);
    if (accounted.size !== expected.length || expected.some(clause => !accounted.has(clause))) {
      throw new Error(`${rule.ruleId} clause adjudication does not account for every rule clause`);
    }
  } else if (rule.verificationStatus === "candidate") {
    throw new Error(`${rule.ruleId} remains candidate without clause-level adjudication`);
  }
  rule.clauseEvidence = ruleClauses(rule).map(clause => ({
    clause,
    sourceIds: rule.sourceIds,
    reviewStatus: adjudication
      ? adjudication.approvedClauses.includes(clause) ? "codex-reviewed" : "candidate"
      : rule.verificationStatus,
    notes: [adjudication?.reason ?? "This clause inherits the Codex review status of the source-backed award rule."],
  }));
  if (adjudication && adjudication.unresolvedClauses.length === 0) {
    rule.verificationStatus = "codex-reviewed";
    for (const sourceId of rule.sourceIds) {
      const source = sourceRecords.get(sourceId);
      if (source) source.verificationStatus = "codex-reviewed";
    }
  }
}

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
  2019: {
    hash: "b8f14756986d623357e238ac3f0ca2ef9d27f00464a33f2dee4820182e77a691",
    publishedAt: "2020-01-31",
    status: "final",
    aLevelPrintedPage: 1,
    aLevelPdfPage: 2,
    fsmqPrintedPage: 4,
    fsmqPdfPage: 5,
  },
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
    printedPage: row.code === "6993" ? metadata.fsmqPrintedPage ?? metadata.fsmqPage : metadata.aLevelPrintedPage ?? 1,
    pdfPage: row.code === "6993" ? metadata.fsmqPdfPage ?? metadata.fsmqPage : metadata.aLevelPdfPage ?? 1,
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

const caie0580OfficialStatistics = [
  {
    year: 2019, series: "june", rates: [18.4, 36.0, 53.6, 73.5, 83.1, 90.1, 92.1, 93.5],
    officialUrl: "https://www.cambridgeinternational.org/Images/553492-cambridge-igcse-results-statistics-june-2019.pdf",
    documentTitle: "Cambridge IGCSE candidate grades June 2019",
    pdfPage: 2,
  },
  {
    year: 2021, series: "march", rates: [34.7, 51.9, 64.7, 84.7, 90.8, 95.5, 97.3, 98.2],
    officialUrl: "https://www.cambridgeinternational.org/Images/619296-cambridge-igcse-results-statistics-march-2021.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - March 2021", sourceDocumentHash: "2ab594ce85778e10a4c3847f7373a50b3ea576d070437e66ed57fb92373d1e20", pdfPage: 1,
  },
  {
    year: 2021, series: "june", rates: [27.8, 44.3, 58.5, 80.0, 88.1, 94.0, 95.8, 97.0],
    officialUrl: "https://www.cambridgeinternational.org/Images/647608-cambridge-igcse-results-statistics-june-2021.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - June 2021", sourceDocumentHash: "3963fadbf7ae25bdf0b54f006aafa0277e69a6318afe10a498f24044d23d4cc5", pdfPage: 2,
  },
  {
    year: 2021, series: "november", rates: [17.5, 29.1, 41.2, 69.4, 80.2, 88.6, 91.7, 93.5],
    officialUrl: "https://www.cambridgeinternational.org/Images/638167-cambridge-igcse-results-statistics-november-2021.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - November 2021", sourceDocumentHash: "0640c648f1fb84ad34d51150d1f6676ce115f95d2f4d19e3e6c4da44c2a970bc", pdfPage: 2,
  },
  {
    year: 2022, series: "march", rates: [30.3, 52.1, 64.4, 84.6, 90.6, 94.8, 96.4, 97.4],
    officialUrl: "https://www.cambridgeinternational.org/Images/655037-cambridge-igcse-results-statistics-march-2022.pdf",
    documentTitle: "Cambridge IGCSE results statistics - March 2022", sourceDocumentHash: "df53273c2f3d82b4e4195da79cef131f58995eed3033802a252e23ab44f16e34", pdfPage: 1,
  },
  {
    year: 2022, series: "june", rates: [24.3, 40.4, 54.7, 76.1, 84.9, 91.8, 93.9, 95.4],
    officialUrl: "https://www.cambridgeinternational.org/Images/664323-cambridge-igcse-results-statistics-june-2022.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - June 2022", sourceDocumentHash: "77d70174f85594a9ea83d7cf521216146bb476c536991eba68f6dbaf4985e8ba", pdfPage: 2,
  },
  {
    year: 2022, series: "november", rates: [12.3, 25.5, 38.7, 65.6, 77.1, 86.4, 89.7, 91.9],
    officialUrl: "https://www.cambridgeinternational.org/Images/674918-cambridge-igcse-results-statistics-november-2022.pdf",
    documentTitle: "Cambridge IGCSE results statistics November 2022", sourceDocumentHash: "68b2fb0708634eab44301dd0a1783b453badea2511379f3f2cbf1db5c689614c", pdfPage: 2,
  },
  {
    year: 2023, series: "march", rates: [24.7, 44.3, 61.2, 81.9, 90.3, 95.2, 97.1, 98.1],
    officialUrl: "https://www.cambridgeinternational.org/Images/687396-cambridge-igcse-results-statistics-march-2023.pdf",
    documentTitle: "Cambridge IGCSE results statistics - March 2023", sourceDocumentHash: "ddaf409826950a2406c42126b6ee77b98b81c9afbc8477eebfdf4ca3c701eba7", pdfPage: 1,
  },
  {
    year: 2023, series: "june", rates: [18.3, 34.7, 50.8, 72.5, 81.7, 89.4, 91.7, 93.2],
    officialUrl: "https://www.cambridgeinternational.org/Images/693416-cambridge-igcse-results-statistics-june-2023.pdf",
    documentTitle: "Cambridge IGCSE results statistics - June 2023", sourceDocumentHash: "f82f3242755c80b6c5a60e7dc97a73ad98ed3e890f23fabe165d4baae7faa394", pdfPage: 2,
  },
  {
    year: 2023, series: "november", rates: [10.1, 22.9, 37.0, 63.4, 75.2, 84.9, 88.7, 91.1],
    officialUrl: "https://www.cambridgeinternational.org/Images/707851-cambridge-igcse-results-statistics-november-2023.pdf",
    documentTitle: "Cambridge IGCSE results statistics - November 2023", sourceDocumentHash: "7ff0d0d222cdd40d3deb789c3ca5200870f3b7e41acb8a7454edd27fd5c0aa05", pdfPage: 2,
  },
  {
    year: 2024, series: "march", rates: [22.4, 39.8, 60.5, 81.1, 89.2, 94.2, 95.8, 96.8],
    officialUrl: "https://www.cambridgeinternational.org/Images/712427-cambridge-igcse-results-statistics-march-2024.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - March 2024", sourceDocumentHash: "29b8222cefa77fd96e67e25f1c9ababdd177224feb31ec5b1216ce94037b2d12", pdfPage: 1,
  },
  {
    year: 2024, series: "june", rates: [17.1, 33.9, 50.8, 71.0, 80.4, 88.1, 90.5, 92.3],
    officialUrl: "https://www.cambridgeinternational.org/Images/717825-cambridge-igcse-results-statistics-june-2024.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - June 2024", sourceDocumentHash: "7bdcc7f2dd0934813b530e768b85b6abc21ee8d1df27306785dc72aac5d29614", pdfPage: 2,
  },
  {
    year: 2024, series: "november", rates: [10.8, 22.5, 36.0, 62.3, 75.0, 84.7, 88.6, 91.1],
    officialUrl: "https://www.cambridgeinternational.org/Images/729300-cambridge-igcse-results-statistics-november-2024.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - November 2024", sourceDocumentHash: "f609abd9b8b4f98c6a2f425a25b1041e659c20579953d0a414b7755c2ae45295", pdfPage: 2,
  },
  {
    year: 2025, series: "march", rates: [20.0, 37.5, 58.1, 79.1, 87.6, 93.4, 95.5, 96.6],
    officialUrl: "https://www.cambridgeinternational.org/Images/736213-cambridge-igcse-results-statistics-march-2025.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - March 2025", sourceDocumentHash: "ad7befe147663e1ac597dc65963588747f330da74717bca0c9ed5f03ad177287", pdfPage: 1,
  },
  {
    year: 2025, series: "june", rates: [19.8, 34.1, 50.0, 70.9, 80.3, 87.8, 90.3, 92.1],
    officialUrl: "https://www.cambridgeinternational.org/Images/743255-cambridge-igcse-june-2025-results-statistics.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - June 2025", sourceDocumentHash: "711bcfba416ccbe7e66e12ced8227f77388fb4f32e578ef58bdbfc9e3cefed08", pdfPage: 2,
  },
  {
    year: 2025, series: "november", rates: [10.3, 21.9, 34.3, 61.3, 73.5, 84.1, 88.3, 91.3],
    officialUrl: "https://www.cambridgeinternational.org/Images/754771-cambridge-igcse-november-2025-results-statistics.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - November 2025", sourceDocumentHash: "f203291c7f19d2b64984882e66d2834f4cdd3658a7d0a9bed1813847eef94b16", pdfPage: 2,
  },
  {
    year: 2026, series: "march", rates: [19.8, 43.4, 62.3, 83.9, 90.6, 95.1, 97.0, 97.9],
    officialUrl: "https://www.cambridgeinternational.org/Images/758800-cambridge-igcse-results-statistics-march-2026.pdf",
    documentTitle: "Cambridge IGCSE Results Statistics - March 2026", sourceDocumentHash: "5c35ff801461f4f621f6e86dc12a467ada3c9b7d9c71c5167d6804c97fd589cc", pdfPage: 1,
  },
];
for (const document of caie0580OfficialStatistics) {
  const awardQualificationId = "award:caie:0580";
  const qualification = qualifications.get(awardQualificationId);
  const verificationStatus = document.sourceDocumentHash ? "codex-reviewed" : "candidate";
  const sourceId = addSource({
    sourceId: `source:caie-0580-grade-statistics-${document.year}-${document.series}`,
    board: "CAIE",
    officialUrl: document.officialUrl,
    documentTitle: document.documentTitle,
    accessedAt: "2026-07-23",
    printedPage: document.pdfPage,
    pdfPage: document.pdfPage,
    tableName: "Cumulative world totals grades A* - G",
    sourceRowId: `CAIE-0580-${document.year}-${document.series.toUpperCase()}-MATHEMATICS`,
    sourceDocumentHash: document.sourceDocumentHash,
    effectiveFrom: `${document.year}-${document.series === "march" ? "03" : document.series === "june" ? "06" : "11"}-01`,
    verificationStatus,
  });
  directOfficialStatistics.push({
    qualification,
    awardQualificationId,
    subject: { code: "0580" },
    year: {
      year: document.year,
      series: document.series,
      aStarRate: document.rates[0],
      aRate: document.rates[1],
      bRate: document.rates[2],
      cRate: document.rates[3],
      dRate: document.rates[4],
      eRate: document.rates[5],
      fRate: document.rates[6],
      gRate: document.rates[7],
    },
    sourceIds: [sourceId],
    verificationStatus,
    publicationStatus: "final",
  });
}

const pearson8ma0OfficialStatistics = [
  {
    year: 2019,
    candidateCount: 9878,
    rates: [24.7, 37.2, 51.2, 65.9, 79.3],
    officialUrl: "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-statistics/A-level/grade-statistics-june-2019-final-a-level-advanced-subsidiary.PDF",
    documentTitle: "Grade Statistics - June 2019 (Final) - Advanced Subsidiary Level",
    sourceDocumentHash: "0e5912386dd4733fe85377745db99ca9884a200978ec660f6fc32c3d99b22d45",
    pdfPage: 30,
  },
  {
    year: 2022,
    candidateCount: 5538,
    rates: [29.6, 42.8, 57.5, 72.3, 83.9],
    officialUrl: "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-statistics/A-level/grade-statistics-june-2022-final-advanced-subsidiary-level.pdf",
    documentTitle: "Grade Statistics - June 2022 (Final) Advanced Subsidiary Level",
    sourceDocumentHash: "58120aaa7257f90e70fe1d62aed083b198a7eee7047c9b84e54f3cafbc6a6220",
    pdfPage: 13,
  },
  {
    year: 2023,
    candidateCount: 5509,
    rates: [26.9, 38.7, 52.2, 65.4, 76.8],
    officialUrl: "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-statistics/A-level/grade-statistics-june-2023-final-advanced-subsidiary-level.pdf",
    documentTitle: "Grade Statistics - June 2023 (Final) Advanced Subsidiary Level",
    sourceDocumentHash: "c01ee7310574e05668abe39aad83e4e760bf4b40d6f33abfe93857fd31b968c8",
    pdfPage: 13,
  },
  {
    year: 2024,
    candidateCount: 5685,
    rates: [27.0, 38.8, 52.3, 64.2, 76.2],
    officialUrl: "https://qualifications.pearson.com/content/dam/pdf/Support/Grade-statistics/A-level/grade-statistics-june-2024-final-advanced-subsidiary-level.pdf",
    documentTitle: "Grade Statistics - June 2024 (Final) Advanced Subsidiary Level",
    sourceDocumentHash: "d30d4ad5a5ec95d1a586090993ddd3b9f21b0fc82c17c73c0e2dad58042b2a58",
    pdfPage: 13,
  },
];
for (const document of pearson8ma0OfficialStatistics) {
  const awardQualificationId = "award:pearson:8ma0";
  const qualification = qualifications.get(awardQualificationId);
  const sourceId = addSource({
    sourceId: `source:pearson-8ma0-grade-statistics-${document.year}-june`,
    board: "Pearson",
    officialUrl: document.officialUrl,
    documentTitle: document.documentTitle,
    accessedAt: "2026-07-21",
    printedPage: document.pdfPage,
    pdfPage: document.pdfPage,
    tableName: "Cumulative number of candidates at specified grades and percentages",
    sourceRowId: `PEARSON-${document.year}-JUNE-8MA0-ALL-CANDIDATES`,
    sourceDocumentHash: document.sourceDocumentHash,
    effectiveFrom: `${document.year}-06-01`,
    verificationStatus: "codex-reviewed",
  });
  directOfficialStatistics.push({
    qualification,
    awardQualificationId,
    subject: { code: "8MA0" },
    year: {
      year: document.year,
      series: "june",
      entries: document.candidateCount,
      aRate: document.rates[0],
      bRate: document.rates[1],
      cRate: document.rates[2],
      dRate: document.rates[3],
      eRate: document.rates[4],
    },
    sourceIds: [sourceId],
    verificationStatus: "codex-reviewed",
    publicationStatus: "final",
  });
}

const gradeFields = [
  ["A*", "aStarRate"], ["A", "aRate"], ["B", "bRate"], ["C", "cRate"], ["D", "dRate"], ["E", "eRate"],
  ["F", "fRate"], ["G", "gRate"],
  ["9", "grade9Rate"], ["8", "grade8Rate"], ["7", "grade7Rate"], ["6", "grade6Rate"], ["5", "grade5Rate"], ["4", "grade4Rate"], ["3", "grade3Rate"], ["2", "grade2Rate"], ["1", "grade1Rate"],
];

function toStatistics({ qualification, awardQualificationId, subject, year, sourceIds, verificationStatus, publicationStatus }) {
  const preferred = year.grade9Rate !== undefined
    ? gradeFields.slice(8)
    : subject.code === "8MA0"
      ? gradeFields.slice(1, 6)
      : gradeFields.slice(0, 8);
  const gradeOrder = preferred.filter(([, field]) => year[field] !== undefined).map(([grade]) => grade);
  const gradeRates = Object.fromEntries(preferred.filter(([, field]) => year[field] !== undefined).map(([grade, field]) => [grade, year[field]]));
  const rawGradeRates = year.rawGradeRates
    ? Object.fromEntries(preferred.filter(([, field]) => year.rawGradeRates[field] !== undefined).map(([grade, field]) => [grade, year.rawGradeRates[field]]))
    : undefined;
  return {
    schemaVersion: "2.0.0",
    statisticsId: `statistics:${slug(awardQualificationId)}:${year.year}:${year.series}:all-candidates`,
    qualificationVersionId: boundaryQualificationVersionId(awardQualificationId, year.year, qualification.currentKnowledgeQualificationVersionId),
    awardQualificationId,
    year: year.year,
    series: year.series === "summer" ? "june" : year.series === "autumn" ? "november" : year.series,
    regionScope: "all-published-candidates",
    populationScope: "all-candidates",
    statisticsScope: "overall",
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
