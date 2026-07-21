const specifications = {
  caie0580: { sourceId: "source:caie-0580-2025-2027-assessment-overview", board: "CAIE", officialUrl: "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf", documentTitle: "Cambridge IGCSE Mathematics 0580 syllabus 2025-2027", documentVersion: "2025-2027", printedPage: 9, pdfPage: 11, tableName: "Assessment overview", sourceRowId: "CAIE-0580-2025-2027-P9", sourceDocumentHash: "627f8e5dab21605f95b9aceec4a2dcdddf91dce5767d6938d647b38041c6d363", publishedAt: "2024-05-14" },
  caie9231: { sourceId: "source:caie-9231-2026-2027-assessment-routes", board: "CAIE", officialUrl: "https://www.cambridgeinternational.org/Images/697357-2026-2027-syllabus.pdf", documentTitle: "Cambridge International AS & A Level Further Mathematics 9231 syllabus", documentVersion: "2026-2027", printedPage: 10, pdfPage: 12, tableName: "Structure and assessment routes", sourceRowId: "CAIE-9231-2026-2027-P10-P12", sourceDocumentHash: "fdfe5e60db05caf6c45619e19b368a542b2e6b82c14387f03fe964fa90418800", publishedAt: "2025-07-31" },
  caie9231Legacy: { sourceId: "source:caie-9231-2019-assessment-at-a-glance", board: "CAIE", officialUrl: "https://www.cambridgeinternational.org/images/329490-2019-syllabus.pdf", documentTitle: "Cambridge International A Level Further Mathematics 9231 syllabus", documentVersion: "2019", printedPage: 7, pdfPage: 9, tableName: "Assessment at a glance", sourceRowId: "CAIE-9231-2019-P7-P8", publishedAt: "2018-01-01", effectiveFrom: "2019-01-01", effectiveTo: "2019-12-31" },
  caie9231_2020_2022: { sourceId: "source:caie-9231-2020-2022-assessment-routes", board: "CAIE", officialUrl: "https://www.cambridgeinternational.org/Images/414957-2020-2022-syllabus.pdf", documentTitle: "Cambridge International AS & A Level Further Mathematics 9231 syllabus", documentVersion: "2020-2022 Version 2", printedPage: 8, pdfPage: 10, tableName: "Structure, assessment overview and three routes", sourceRowId: "CAIE-9231-2020-2022-P8-P10", publishedAt: "2020-04-01", effectiveFrom: "2020-01-01", effectiveTo: "2022-12-31" },
  caie9231_2023_2025: { sourceId: "source:caie-9231-2023-2025-assessment-routes", board: "CAIE", officialUrl: "https://www.cambridgeinternational.org/Images/597381-2023-2025-syllabus.pdf", documentTitle: "Cambridge International AS & A Level Further Mathematics 9231 syllabus", documentVersion: "2023-2025", printedPage: 9, pdfPage: 11, tableName: "Structure and assessment routes", sourceRowId: "CAIE-9231-2023-2025-P9-P11", publishedAt: "2022-01-01", effectiveFrom: "2023-01-01", effectiveTo: "2025-12-31" },
  pearson4ma1: { sourceId: "source:pearson-4ma1-issue2-qualification-at-a-glance", board: "Pearson", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Mathematics%20A/2016/Specification%20and%20sample%20assessments/international-gcse-in-mathematics-spec-a.pdf", documentTitle: "Pearson Edexcel International GCSE Mathematics A specification", documentVersion: "Issue 2", printedPage: 5, pdfPage: 7, tableName: "Qualification at a glance", sourceRowId: "PEARSON-4MA1-ISSUE2-P5-P6", sourceDocumentHash: "d58830e570d58aeccd7146f5465b3c117378c42d08d663f18478f2793c7e737b", publishedAt: "2017-11-01" },
  pearsonIal: { sourceId: "source:pearson-ial-mathematics-issue3-rules", board: "Pearson", officialUrl: "https://qualifications.pearson.com/en/qualifications/edexcel-international-advanced-levels/mathematics-2018.html", documentTitle: "Pearson Edexcel International Advanced Level Mathematics, Further Mathematics and Pure Mathematics specification", documentVersion: "Issue 3", printedPage: 7, pdfPage: 9, tableName: "Qualification overview, unit combinations and qualification results", sourceRowId: "PEARSON-IAL-MATHS-ISSUE3-P7-P10-P70-P74", sourceDocumentHash: "71351e66d8434cc8976fa41801b65d77bdcad56f902e45807bc635bca317b408", publishedAt: "2019-04-01" },
  aqa7367: { sourceId: "source:aqa-7367-v1-1-scheme-of-assessment", board: "AQA", officialUrl: "https://www.aqa.org.uk/subjects/mathematics/a-level/mathematics-7367/specification/scheme-of-assessment", documentTitle: "AQA A-level Further Mathematics 7367 specification", documentVersion: "1.1", printedPage: 7, pdfPage: 9, tableName: "Assessments and assessment weightings", sourceRowId: "AQA-7367-V1.1-P7-P10-P35", sourceDocumentHash: "c3a54ab81186c86409c100182ae6c456b0f76da1f891adbe2222181b422f3313", publishedAt: "2017-10-19" },
  ocrH245: { sourceId: "source:ocr-h245-v2-assessment-overview", board: "OCR", officialUrl: "https://www.ocr.org.uk/Images/308752-specification-accredited-a-level-gce-further-mathematics-a-h245.pdf", documentTitle: "OCR A Level Further Mathematics A H245 specification", documentVersion: "Version 2", printedPage: 6, pdfPage: 8, tableName: "Assessment overview and calculating qualification results", sourceRowId: "OCR-H245-V2-P6-P93", sourceDocumentHash: "61fb7eddcbf337a3094fb2312e073fcede1fc6fcd8925bc0be562c5007538459", publishedAt: "2025-10-21" },
  ocrH640: { sourceId: "source:ocr-h640-v3-assessment-overview", board: "OCR", officialUrl: "https://www.ocr.org.uk/Images/308740-specification-accredited-a-level-gce-mathematics-b-mei-h640.pdf", documentTitle: "OCR A Level Mathematics B (MEI) H640 specification", documentVersion: "Version 3", printedPage: 6, pdfPage: 8, tableName: "Assessment overview", sourceRowId: "OCR-H640-V3-P6-P69", sourceDocumentHash: "798af9a155827d9c7b33a50e5eded038f17f00d676c80467e44f03d8650bd6da", publishedAt: "2025-01-01" },
};

const component = (code, maximumRawMark, maximumAwardMark = maximumRawMark, inputKind = "raw", optional = false) => ({ code, inputKind, maximumRawMark, maximumAwardMark, weightingFactor: 1, optional });
const combination = (combinationId, componentCodes, awardLevel, optionCode) => ({ combinationId, componentCodes, ...(optionCode ? { optionCode } : {}), awardLevel });
const choose = (values, count) => count === 0 ? [[]] : values.flatMap((value, index) => choose(values.slice(index + 1), count - 1).map(rest => [value, ...rest]));

function evidence(addSource, key) {
  return addSource({ ...specifications[key], accessedAt: "2026-07-21", verificationStatus: "codex-reviewed" });
}

function base({ ruleId, qualificationVersionId, awardQualificationId, board, subjectCode, routeId, routeType, scoringSystem, components, validCombinations, totalMaximumAwardMark, gradeScale, effectiveFrom, effectiveTo, sourceId }) {
  return {
    schemaVersion: "2.0.0",
    ruleId,
    qualificationVersionId,
    awardQualificationId,
    board,
    subjectCode,
    routeId,
    routeType,
    scoringSystem,
    components,
    validCombinations,
    totalMaximumAwardMark,
    gradeScale,
    roundingRule: "none",
    resitRule: { allowed: true, selectionMethod: routeType === "modular" ? "best-available-unit-result" : "complete-valid-route", notes: [routeType === "modular" ? "A resat unit uses the best available unit result when the qualification is cashed in." : "A retake must use a complete valid route under the specification."] },
    effectiveFrom,
    ...(effectiveTo ? { effectiveTo } : {}),
    sourceIds: [sourceId],
    verificationStatus: "codex-reviewed",
  };
}

export function buildOfficialAwardRuleCandidates(addSource) {
  const source0580 = evidence(addSource, "caie0580");
  const source9231 = evidence(addSource, "caie9231");
  const source9231Legacy = evidence(addSource, "caie9231Legacy");
  const source9231_2020_2022 = evidence(addSource, "caie9231_2020_2022");
  const source9231_2023_2025 = evidence(addSource, "caie9231_2023_2025");
  const source4ma1 = evidence(addSource, "pearson4ma1");
  const sourceIal = evidence(addSource, "pearsonIal");
  const source7367 = evidence(addSource, "aqa7367");
  const sourceH245 = evidence(addSource, "ocrH245");
  const sourceH640 = evidence(addSource, "ocrH640");

  const rules = [
    { ...base({ ruleId: "rule:caie-9231:2019:legacy-al", qualificationVersionId: "CAIE-9231:2019", awardQualificationId: "award:caie:9231", board: "CAIE", subjectCode: "9231", routeId: "award:caie:9231:legacy-al", routeType: "same-series", scoringSystem: "raw", components: [component("P1", 100), component("P2", 100)], validCombinations: [combination("9231-legacy-al-p1-p2", ["P1", "P2"], "A Level")], totalMaximumAwardMark: 200, gradeScale: ["A*", "A", "B", "C", "D", "E"], effectiveFrom: "2019-01-01", effectiveTo: "2019-12-31", sourceId: source9231Legacy }), aStarRule: { available: true, ruleKind: "boundary-only", notes: ["A* is determined from the official overall boundary for the legacy two-paper route."] } },
    { ...base({ ruleId: "rule:caie-0580:2025-2027:core", qualificationVersionId: "CAIE-0580:2025-2027", awardQualificationId: "award:caie:0580", board: "CAIE", subjectCode: "0580", routeId: "award:caie:0580:core", routeType: "same-series", scoringSystem: "raw", components: [component("P1", 80), component("P3", 80)], validCombinations: [combination("0580-core-p1-p3", ["P1", "P3"], "IGCSE Core")], totalMaximumAwardMark: 160, gradeScale: ["C", "D", "E", "F", "G"], effectiveFrom: "2025-01-01", sourceId: source0580 }), aStarRule: { available: false, ruleKind: "not-available", notes: ["Core candidates are eligible for grades C to G."] } },
    { ...base({ ruleId: "rule:caie-0580:2025-2027:extended", qualificationVersionId: "CAIE-0580:2025-2027", awardQualificationId: "award:caie:0580", board: "CAIE", subjectCode: "0580", routeId: "award:caie:0580:extended", routeType: "same-series", scoringSystem: "raw", components: [component("P2", 100), component("P4", 100)], validCombinations: [combination("0580-extended-p2-p4", ["P2", "P4"], "IGCSE Extended")], totalMaximumAwardMark: 200, gradeScale: ["A*", "A", "B", "C", "D", "E"], effectiveFrom: "2025-01-01", sourceId: source0580 }), aStarRule: { available: true, ruleKind: "boundary-only", notes: ["A* is determined from the official Extended route boundary."] } },
    { ...base({ ruleId: "rule:caie-9231:2026-2027:as", qualificationVersionId: "CAIE-9231:2026-2027", awardQualificationId: "award:caie:9231", board: "CAIE", subjectCode: "9231", routeId: "award:caie:9231:as", routeType: "same-series", scoringSystem: "raw", components: [component("P1", 75), component("P3", 50, 50, "raw", true), component("P4", 50, 50, "raw", true)], validCombinations: [combination("9231-as-p1-p3", ["P1", "P3"], "AS Level"), combination("9231-as-p1-p4", ["P1", "P4"], "AS Level")], totalMaximumAwardMark: 125, gradeScale: ["a", "b", "c", "d", "e"], effectiveFrom: "2026-01-01", sourceId: source9231 }), aStarRule: { available: false, ruleKind: "not-available", notes: ["AS Level is graded a to e."] } },
    { ...base({ ruleId: "rule:caie-9231:2026-2027:al:same-series", qualificationVersionId: "CAIE-9231:2026-2027", awardQualificationId: "award:caie:9231", board: "CAIE", subjectCode: "9231", routeId: "award:caie:9231:al:same-series", routeType: "same-series", scoringSystem: "raw", components: [component("P1", 75), component("P2", 75), component("P3", 50), component("P4", 50)], validCombinations: [combination("9231-al-all-papers", ["P1", "P2", "P3", "P4"], "A Level")], totalMaximumAwardMark: 250, gradeScale: ["A*", "A", "B", "C", "D", "E"], effectiveFrom: "2026-01-01", sourceId: source9231 }), aStarRule: { available: true, ruleKind: "boundary-only", notes: ["A* is determined from the official route boundary."] } },
    { ...base({ ruleId: "rule:caie-9231:2026-2027:al:staged", qualificationVersionId: "CAIE-9231:2026-2027", awardQualificationId: "award:caie:9231", board: "CAIE", subjectCode: "9231", routeId: "award:caie:9231:al:staged", routeType: "staged", scoringSystem: "raw", components: [component("AS-P1-P3-CF", null, 125, "carried-forward", true), component("AS-P1-P4-CF", null, 125, "carried-forward", true), component("P2", 75), component("P3", 50, 50, "raw", true), component("P4", 50, 50, "raw", true)], validCombinations: [combination("9231-staged-from-p1-p3", ["AS-P1-P3-CF", "P2", "P4"], "A Level"), combination("9231-staged-from-p1-p4", ["AS-P1-P4-CF", "P2", "P3"], "A Level")], totalMaximumAwardMark: 250, gradeScale: ["A*", "A", "B", "C", "D", "E"], effectiveFrom: "2026-01-01", sourceId: source9231 }), carryForwardRule: { allowed: true, maximumMonths: 13, unit: "whole-as", notes: ["Carry forward the complete AS result, subject to Cambridge Handbook time limits; individual papers are not mixed."] }, aStarRule: { available: true, ruleKind: "boundary-only", notes: ["A* is determined from the official staged route boundary."] } },
  ];

  const current9231Rules = rules.filter(rule => rule.awardQualificationId === "award:caie:9231" && rule.effectiveFrom === "2026-01-01");
  for (const historical of [
    { version: "2020-2022", qualificationVersionId: "CAIE-9231:2020-2022", effectiveFrom: "2020-01-01", effectiveTo: "2022-12-31", sourceId: source9231_2020_2022 },
    { version: "2023-2025", qualificationVersionId: "CAIE-9231:2023-2025", effectiveFrom: "2023-01-01", effectiveTo: "2025-12-31", sourceId: source9231_2023_2025 },
  ]) {
    for (const current of current9231Rules) {
      rules.push({
        ...current,
        ruleId: current.ruleId.replace("2026-2027", historical.version),
        qualificationVersionId: historical.qualificationVersionId,
        effectiveFrom: historical.effectiveFrom,
        effectiveTo: historical.effectiveTo,
        sourceIds: [historical.sourceId],
      });
    }
  }

  for (const tier of ["foundation", "higher"]) {
    const suffix = tier === "foundation" ? "F" : "H";
    rules.push({ ...base({ ruleId: `rule:pearson-4ma1:issue2:${tier}`, qualificationVersionId: "Edexcel-4MA1:Issue 2", awardQualificationId: "award:pearson:4ma1", board: "Pearson", subjectCode: "4MA1", routeId: `award:pearson:4ma1:${tier}`, routeType: "same-series", scoringSystem: "raw", components: [component(`4MA1/1${suffix}`, 100), component(`4MA1/2${suffix}`, 100)], validCombinations: [combination(`4ma1-${tier}`, [`4MA1/1${suffix}`, `4MA1/2${suffix}`], `International GCSE ${tier}`)], totalMaximumAwardMark: 200, gradeScale: tier === "foundation" ? ["5", "4", "3", "2", "1"] : ["9", "8", "7", "6", "5", "4"], effectiveFrom: "2018-06-01", sourceId: source4ma1 }), aStarRule: { available: false, ruleKind: "not-available", notes: ["This qualification uses the 9-1 grade scale."] } });
  }

  const ialUnits = ["P1", "P2", "P3", "P4", "FP1", "FP2", "FP3", "M1", "M2", "M3", "S1", "S2", "S3", "D1"];
  const ialComponents = mandatoryCodes => ialUnits.map(code => component(code, null, 100, "ums", !mandatoryCodes.has(code)));
  const mathematicsCombinations = [["P1", "P2", "P3", "P4", "M1", "S1"], ["P1", "P2", "P3", "P4", "M1", "D1"], ["P1", "P2", "P3", "P4", "M1", "M2"], ["P1", "P2", "P3", "P4", "S1", "D1"], ["P1", "P2", "P3", "P4", "S1", "S2"]];
  const advancedFurtherUnits = new Set(["FP2", "FP3", "M2", "M3", "S2", "S3"]);
  const furtherCombinations = choose(ialUnits.filter(code => code !== "FP1"), 5)
    .map(units => ["FP1", ...units])
    .filter(units => (units.includes("FP2") || units.includes("FP3")) && units.filter(unit => advancedFurtherUnits.has(unit)).length >= 3);
  rules.push({ ...base({ ruleId: "rule:pearson-ial-mathematics:issue3", qualificationVersionId: "Edexcel-IAL:2018", awardQualificationId: "award:pearson:ial-mathematics", board: "Pearson", subjectCode: "YMA01", routeId: "award:pearson:ial-mathematics:YMA01", routeType: "modular", scoringSystem: "UMS", components: ialComponents(new Set(["P1", "P2", "P3", "P4"])), validCombinations: mathematicsCombinations.map((units, index) => combination(`yma01-${index + 1}`, units, "International A Level")), totalMaximumAwardMark: 600, gradeScale: ["A*", "A", "B", "C", "D", "E"], effectiveFrom: "2019-01-01", sourceId: sourceIal }), cashInRule: { required: true, entryCode: "YMA01", notes: ["The cash-in entry aggregates six eligible unit results."] }, unitLockingRule: { lockedAfterCashIn: true, unlockAllowed: true, notes: ["Unit results used for one qualification cannot be reused for another without the board's permitted unlock/re-cash-in process."] }, aStarRule: { available: true, ruleKind: "overall-plus-advanced-units", overallMinimumAwardMark: 480, advancedUnitCodes: ["P3", "P4"], advancedUnitMinimumAwardMark: 180, notes: ["A* requires at least 480/600 overall and at least 180/200 across P3 and P4."] } });
  rules.push({ ...base({ ruleId: "rule:pearson-ial-further-mathematics:issue3", qualificationVersionId: "Edexcel-IAL:2018", awardQualificationId: "award:pearson:ial-further-mathematics", board: "Pearson", subjectCode: "YFM01", routeId: "award:pearson:ial-further-mathematics:YFM01", routeType: "modular", scoringSystem: "UMS", components: ialComponents(new Set(["FP1"])), validCombinations: furtherCombinations.map((units, index) => combination(`yfm01-${index + 1}`, units, "International A Level")), totalMaximumAwardMark: 600, gradeScale: ["A*", "A", "B", "C", "D", "E"], effectiveFrom: "2019-01-01", sourceId: sourceIal }), cashInRule: { required: true, entryCode: "YFM01", notes: ["The cash-in entry aggregates six eligible, non-reused unit results."] }, unitLockingRule: { lockedAfterCashIn: true, unlockAllowed: true, notes: ["A unit result cannot be reused across Mathematics and Further Mathematics awards while locked."] }, aStarRule: { available: true, ruleKind: "overall-plus-best-advanced-units", overallMinimumAwardMark: 480, advancedUnitCodes: [...advancedFurtherUnits], advancedUnitCount: 3, advancedUnitMinimumAwardMark: 270, notes: ["A* requires at least 480/600 overall and at least 270/300 across the best three IA2 units."] } });

  const aqaOptions = [["P1", "P2", "P3-DS", "discrete-statistics"], ["P1", "P2", "P3-SM", "statistics-mechanics"], ["P1", "P2", "P3-MD", "mechanics-discrete"]];
  rules.push({ ...base({ ruleId: "rule:aqa-7367:v1-1:linear", qualificationVersionId: "AQA-7367:1.1", awardQualificationId: "award:aqa:7367", board: "AQA", subjectCode: "7367", routeId: "award:aqa:7367:linear", routeType: "linear", scoringSystem: "raw", components: [component("P1", 100), component("P2", 100), component("P3-DS", 100, 100, "raw", true), component("P3-SM", 100, 100, "raw", true), component("P3-MD", 100, 100, "raw", true)], validCombinations: aqaOptions.map(([p1, p2, p3, option]) => combination(`7367-${option}`, [p1, p2, p3], "A Level", option)), totalMaximumAwardMark: 300, gradeScale: ["A*", "A", "B", "C", "D", "E"], effectiveFrom: "2019-06-01", sourceId: source7367 }), aStarRule: { available: true, ruleKind: "boundary-only", notes: ["The official overall boundary is route-specific to the two Paper 3 options."] } });

  const h245Options = ["Y542", "Y543", "Y544", "Y545"];
  rules.push({ ...base({ ruleId: "rule:ocr-h245:v2:linear", qualificationVersionId: "OCR-H245:Version 2", awardQualificationId: "award:ocr:h245", board: "OCR", subjectCode: "H245", routeId: "award:ocr:h245:linear", routeType: "linear", scoringSystem: "raw", components: [component("Y540", 75), component("Y541", 75), ...h245Options.map(code => component(code, 75, 75, "raw", true))], validCombinations: choose(h245Options, 2).map(options => combination(`h245-${options.join("-").toLowerCase()}`, ["Y540", "Y541", ...options], "A Level", options.join("+"))), totalMaximumAwardMark: 300, gradeScale: ["A*", "A", "B", "C", "D", "E"], effectiveFrom: "2019-06-01", sourceId: sourceH245 }), combinationSelectionRule: { selectionMethod: "best-official-grade", allowExtraComponentScores: true, tieBreak: "highest-award-mark", notes: ["When more than two optional papers are supplied, evaluate every valid two-option route against its own official boundary and retain the best grade; use award mark only to break a same-grade tie."] }, aStarRule: { available: true, ruleKind: "boundary-only", notes: ["If more than two optional papers are taken, the valid combination giving the best grade is used; this may not be the highest raw total."] } });
  rules.push({ ...base({ ruleId: "rule:ocr-h640:v3:linear", qualificationVersionId: "OCR-H640:Version 3", awardQualificationId: "award:ocr:h640", board: "OCR", subjectCode: "H640", routeId: "award:ocr:h640:linear", routeType: "linear", scoringSystem: "raw", components: [component("H640/01", 100), component("H640/02", 100), component("H640/03", 75)], validCombinations: [combination("h640-all-components", ["H640/01", "H640/02", "H640/03"], "A Level")], totalMaximumAwardMark: 275, gradeScale: ["A*", "A", "B", "C", "D", "E"], effectiveFrom: "2018-06-01", sourceId: sourceH640 }), aStarRule: { available: true, ruleKind: "boundary-only", notes: ["All three components are taken in the same series and compared with the overall qualification boundary."] } });

  return rules;
}
