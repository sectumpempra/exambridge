import { readFile } from "node:fs/promises";
import { join } from "node:path";

const CAMBRIDGE_MARCH = "https://www.cambridgeinternational.org/exam-administration/march-series/";
const CAMBRIDGE_RESULTS = "https://www.cambridgeinternational.org/exam-administration/results/";
const PEARSON_IGCSE = "https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses.a-z.html";
const PEARSON_IGCSE_MANUAL = "https://qualifications.pearson.com/content/dam/pdf/Support/Information-manual/6-international-gcse-2025-2026.pdf";
const PEARSON_IAL_MANUAL = "https://qualifications.pearson.com/content/dam/pdf/Support/Information-manual/4-ial-2025-2026.pdf";
const UK_CANCELLED_2020 = "https://www.gov.uk/government/publications/coronavirus-covid-19-cancellation-of-gcses-as-and-a-levels-in-2020";
const UK_CANCELLED_2021 = "https://www.gov.uk/government/publications/gcse-as-and-a-level-summer-report-2021/gcse-as-and-a-level-summer-report-2021";
const OCR_RESULTS = "https://www.ocr.org.uk/administration/results/results-statistics/";
const AQA_RESULTS = "https://www.aqa.org.uk/exams-administration/results-days/results-statistics/results-statistics-archive";

const PEARSON_IGCSE_SERIES_CHANGE = "https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/about-international-gcses/international-igcse-november-series-from-2023.html";
const CAMBRIDGE_9231 = "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-mathematics-further-9231/";
const CAMBRIDGE_9231_2019 = "https://www.cambridgeinternational.org/images/329490-2019-syllabus.pdf";
const CAMBRIDGE_9231_2020_2022 = "https://www.cambridgeinternational.org/Images/414957-2020-2022-syllabus.pdf";

const window = (effectiveFrom, effectiveTo, series, routes, notes = []) => ({ effectiveFrom, effectiveTo, series, routes, notes });
const recurring = (series, routes) => [window("2019-01-01", undefined, series, routes)];

// A policy window is intentionally versioned. Exam series and valid routes change over
// time, so a current handbook must never be projected backwards over the whole archive.
export const legacyCombinedCoveragePolicies = {
  "award:caie:0580": {
    windows: recurring(["march", "june", "november"], ["award:caie:0580:core", "award:caie:0580:extended"]),
    sourceUrls: [CAMBRIDGE_MARCH, CAMBRIDGE_RESULTS],
  },
  "award:caie:9709": {
    windows: [
      window("2019-01-01", "2019-12-31", ["march", "june", "november"], ["award:caie:9709:2019:as", "award:caie:9709:2019:al:same-series", "award:caie:9709:2019:al:staged"], ["The 2019 same-series component structure differs from the revised syllabus; staged carry-forward remains explicitly unresolved until official route evidence is complete."]),
      window("2020-01-01", "2022-12-31", ["march", "june", "november"], ["award:caie:9709:2020-2022:as", "award:caie:9709:2020-2022:al:same-series", "award:caie:9709:2020-2022:al:staged"]),
      window("2023-01-01", "2025-12-31", ["march", "june", "november"], ["award:caie:9709:2023-2025:as", "award:caie:9709:2023-2025:al:same-series", "award:caie:9709:2023-2025:al:staged"]),
      window("2026-01-01", undefined, ["march", "june", "november"], ["award:caie:9709:2026-2027:as", "award:caie:9709:2026-2027:al:same-series", "award:caie:9709:2026-2027:al:staged"]),
    ],
    sourceUrls: [CAMBRIDGE_MARCH, CAMBRIDGE_RESULTS],
  },
  "award:caie:9231": {
    windows: [
      window("2019-01-01", "2019-12-31", ["june", "november"], ["award:caie:9231:legacy-al"], ["The 2019 syllabus was A Level only and required both legacy papers."]),
      window("2020-01-01", undefined, ["june", "november"], ["award:caie:9231:as", "award:caie:9231:al:same-series", "award:caie:9231:al:staged"], ["The revised syllabus introduced AS, staged A Level and same-series A Level routes from 2020."]),
    ],
    sourceUrls: [CAMBRIDGE_9231, CAMBRIDGE_9231_2019, CAMBRIDGE_9231_2020_2022, CAMBRIDGE_RESULTS],
  },
  "award:pearson:4ma1": {
    windows: [
      window("2019-01-01", "2019-12-31", ["january", "june"], ["award:pearson:4ma1:foundation", "award:pearson:4ma1:higher"]),
      window("2020-01-01", "2021-12-31", ["january", "june", "november"], ["award:pearson:4ma1:foundation", "award:pearson:4ma1:higher"], ["November was an exceptional pandemic-era International GCSE series."]),
      window("2022-01-01", "2022-12-31", ["january", "june"], ["award:pearson:4ma1:foundation", "award:pearson:4ma1:higher"], ["Pearson explicitly did not run a November 2022 International GCSE series."]),
      window("2023-01-01", "2023-12-31", ["january", "june", "november"], ["award:pearson:4ma1:foundation", "award:pearson:4ma1:higher"], ["January 2023 was the final January series; November became the recurring replacement."]),
      window("2024-01-01", undefined, ["june", "november"], ["award:pearson:4ma1:foundation", "award:pearson:4ma1:higher"]),
    ],
    sourceUrls: [PEARSON_IGCSE, PEARSON_IGCSE_MANUAL, PEARSON_IGCSE_SERIES_CHANGE],
  },
  "award:pearson:ial-mathematics": { windows: recurring(["january", "june", "october"], ["award:pearson:ial-mathematics:YMA01"]), sourceUrls: [PEARSON_IAL_MANUAL] },
  "award:pearson:ial-further-mathematics": { windows: recurring(["january", "june", "october"], ["award:pearson:ial-further-mathematics:YFM01"]), sourceUrls: [PEARSON_IAL_MANUAL] },
  "award:aqa:7357": { windows: recurring(["june"], ["award:aqa:7357:linear"]), sourceUrls: [AQA_RESULTS, UK_CANCELLED_2020, UK_CANCELLED_2021] },
  "award:aqa:7367": { windows: recurring(["june"], ["award:aqa:7367:linear"]), sourceUrls: [AQA_RESULTS, UK_CANCELLED_2020, UK_CANCELLED_2021] },
  "award:ocr:h240": { windows: recurring(["june"], ["award:ocr:h240:linear"]), sourceUrls: [OCR_RESULTS, UK_CANCELLED_2020, UK_CANCELLED_2021] },
  "award:ocr:h245": { windows: recurring(["june"], ["award:ocr:h245:linear"]), sourceUrls: [OCR_RESULTS, UK_CANCELLED_2020, UK_CANCELLED_2021] },
  "award:ocr:h640": { windows: recurring(["june"], ["award:ocr:h640:linear"]), sourceUrls: [OCR_RESULTS, UK_CANCELLED_2020, UK_CANCELLED_2021] },
  "award:ocr:6993": { windows: recurring(["june"], ["award:ocr:6993:linear"]), sourceUrls: [OCR_RESULTS, UK_CANCELLED_2020, UK_CANCELLED_2021] },
  "award:pearson:8ma0": { windows: recurring(["june"], ["award:pearson:8ma0:linear"]), sourceUrls: [UK_CANCELLED_2020, UK_CANCELLED_2021] },
};

const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const reviewed = status => status === "codex-reviewed" || status === "owner-approved";
const recordStatus = records => {
  if (records.some(record => reviewed(record.verificationStatus) && record.sourceIds.length > 0)) return "verified-record";
  if (records.some(record => record.sourceIds.length > 0)) return "candidate-record";
  return records[0]?.publicationStatus ?? "source-unavailable";
};

const seriesDate = (year, series) => `${year}-${({ january: "01", march: "03", june: "06", october: "10", november: "11" })[series]}-01`;
const appliesAt = (policyWindow, date) => policyWindow.effectiveFrom <= date && (!policyWindow.effectiveTo || policyWindow.effectiveTo >= date);

function administrationStatus({ qualification, year, series, records }) {
  const ukQualification = qualification.board === "AQA" || qualification.board === "OCR" || qualification.awardQualificationId === "award:pearson:8ma0";
  if (ukQualification && series === "june" && (year === 2020 || year === 2021)) return "cancelled";
  if (qualification.board === "CAIE" && year === 2020 && series === "june") return "cancelled";
  if (series === "march" && qualification.board === "CAIE" && records.length === 0) return "restricted";
  if (records.some(record => record.sourceIds.length > 0)) return "held";
  if (year === 2026 && ["june", "october", "november"].includes(series)) return "not-published";
  return "source-unavailable";
}

const statusWithoutRecord = administration => ["cancelled", "not-held", "not-published", "restricted"].includes(administration)
  ? administration
  : "source-unavailable";

export async function buildAcademicResultsCoverageMatrix(scope, candidate) {
  const cells = [];
  for (const qualification of scope.qualifications) {
    const policy = legacyCombinedCoveragePolicies[qualification.awardQualificationId];
    if (!policy) throw new Error(`Missing series policy for ${qualification.awardQualificationId}`);
    for (let year = scope.startYear; year <= scope.latestYear; year += 1) {
      const observedPairs = [
        ...candidate.boundaries.filter(row => row.awardQualificationId === qualification.awardQualificationId && row.year === year).map(row => ({ series: row.series, routeId: row.routeId })),
        ...candidate.statistics.filter(row => row.awardQualificationId === qualification.awardQualificationId && row.year === year && row.routeId).map(row => ({ series: row.series, routeId: row.routeId })),
      ];
      const expectedPairs = policy.windows.flatMap(policyWindow => policyWindow.series.flatMap(series => {
        const date = seriesDate(year, series);
        return appliesAt(policyWindow, date) ? policyWindow.routes.map(routeId => ({ series, routeId, policyWindow })) : [];
      }));
      const pairKeys = new Set([...expectedPairs, ...observedPairs].map(pair => `${pair.series}|${pair.routeId}`));
      for (const pairKey of pairKeys) {
          const [series, routeId] = pairKey.split("|");
          const expectedPair = expectedPairs.find(pair => pair.series === series && pair.routeId === routeId);
          const boundaries = candidate.boundaries.filter(row => row.awardQualificationId === qualification.awardQualificationId && row.year === year && row.series === series && row.routeId === routeId);
          const statistics = candidate.statistics.filter(row => row.awardQualificationId === qualification.awardQualificationId && row.year === year && row.series === series && (!row.routeId || row.routeId === routeId));
          const conflict = candidate.statisticsConflicts.some(item => item.canonicalKey === `${qualification.awardQualificationId}|${year}|${series}`);
          const records = [...boundaries, ...statistics];
          const administration = administrationStatus({ qualification, year, series, records });
          const applicableRule = candidate.awardRules.find(rule => rule.awardQualificationId === qualification.awardQualificationId
            && rule.routeId === routeId
            && rule.effectiveFrom <= seriesDate(year, series)
            && (!rule.effectiveTo || rule.effectiveTo >= seriesDate(year, series)));
          const notes = [];
          if (!expectedPair) notes.push("Observed record outside the versioned route-series policy; retain it for audit but do not count it as expected coverage.");
          else notes.push(...expectedPair.policyWindow.notes);
          if (series === "march" && qualification.board === "CAIE") notes.push("March series is geographically restricted; it must not be treated as globally available.");
          if (administration === "cancelled") notes.push("Written examinations were cancelled; any awarded outcomes are not comparable with an examined series.");
          if (administration === "not-published") notes.push("The expected series has no eligible published outcome at the candidate data cutoff.");
          if (records.length === 0 && notes.length === 0) notes.push("No row-level official record has passed the evidence gate for this expected cell.");
          cells.push({
            cellId: `coverage:${slug(qualification.awardQualificationId)}:${year}:${series}:${slug(routeId)}`,
            awardQualificationId: qualification.awardQualificationId,
            qualificationVersionId: qualification.currentKnowledgeQualificationVersionId,
            year,
            series,
            routeId,
            ...(series === "march" && qualification.board === "CAIE" ? { region: "restricted-march-series-centres" } : {}),
            expectedByPolicy: Boolean(expectedPair),
            administrationStatus: administration,
            boundaryStatus: boundaries.length ? recordStatus(boundaries) : statusWithoutRecord(administration),
            statisticsStatus: conflict ? "conflict" : statistics.length ? recordStatus(statistics) : statusWithoutRecord(administration),
            awardRuleStatus: applicableRule ? reviewed(applicableRule.verificationStatus) ? "verified-record" : "candidate-record" : "source-unavailable",
            sourceUrls: policy.sourceUrls,
            notes,
          });
      }
    }
  }
  const unresolvedCellCount = cells.filter(cell => cell.expectedByPolicy
    && [cell.boundaryStatus, cell.statisticsStatus, cell.awardRuleStatus].some(status => status === "source-unavailable" || status === "conflict")).length;
  return {
    schemaVersion: "2.0.0",
    generatedAt: candidate.generatedAt,
    baselineCommit: scope.baselineCommit,
    startYear: scope.startYear,
    latestYear: scope.latestYear,
    qualificationCount: scope.qualifications.length,
    expectedCellCount: cells.filter(cell => cell.expectedByPolicy).length,
    unresolvedCellCount,
    cells,
  };
}

export async function loadAcademicResultsCoverageInputs(root) {
  const [scope, candidate] = await Promise.all([
    readFile(join(root, "data/candidates/academic-results-v2/scope.json"), "utf8").then(JSON.parse),
    readFile(join(root, "data/candidates/academic-results-v2/migration-candidate.json"), "utf8").then(JSON.parse),
  ]);
  return { scope, candidate };
}
