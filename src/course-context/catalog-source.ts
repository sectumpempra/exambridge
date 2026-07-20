import plannerData from "@/data/plannerData.json";
import { ALL_PAPERS } from "@/data/papers/paperMetadata";
import { ALL_SUBJECT_STATS } from "@/data/resultStatistics";
import type {
  CourseContextEntry,
  FeatureAvailability,
} from "./types";
import { toCalculatorFeature } from "./types";
export { toCalculatorFeature } from "./types";
import { classifySubject, normalizeCourseSubjectName } from "./subjectCategory";
import { getGradeCalculationAvailability } from "@/domain-v2/awards/catalog";
import type { GradeCalculationAvailability } from "@/domain-v2/awards/schema";
import ocrOfficialStatistics from "@/data/official/ocr-results-statistics.json";

const ACCESSED_AT = "2026-07-15";
const AWARD_QUALIFICATION_KEYS = new Set(["AQA|7357", "OCR|H240", "OCR|6993", "CAIE|9709", "Edexcel UK|8MA0"]);
// Cambridge's live subject directories were checked on 2026-07-15. These
// codes supplement the recent-results rule for active subjects whose local
// statistics import is intentionally incomplete.
const CURRENT_CAMBRIDGE_CODES = new Set([
  "9706", "8679", "9680", "8680", "9479", "9484", "9700", "9609", "9701", "9868", "8238", "9274", "9618",
  "9705", "9481", "9482", "9708", "8695", "9695", "8021", "9093", "8291", "9981", "9898", "8028", "9696",
  "8027", "9897", "9239", "9487", "9489", "9626", "9982", "9488", "9084", "9693", "9709", "9231", "9607",
  "9483", "9702", "8684", "9718", "9990", "9699", "9844", "8022", "8386", "9689", "8689", "9694", "9395",
  "8686", "9686", "9866", "8101", "8102",
  "0452", "0985", "0548", "0600", "0508", "7184", "0544", "7180", "0400", "0989", "0538", "0610", "0970",
  "0264", "0774", "0450", "0986", "0620", "0971", "0509", "0523", "0547", "0715", "0478", "0984", "0445",
  "0979", "0411", "0994", "0455", "0987", "0500", "0990", "0524", "0475", "0992", "0472", "0772", "0465",
  "0511", "0991", "0510", "0993", "0454", "0680", "0648", "0501", "0520", "7156", "0460", "0976", "0505",
  "0525", "7159", "0457", "0549", "0470", "0409", "0977", "0417", "0983", "0531", "0493", "0580", "0606",
  "0607", "0625", "0654",
]);
const EXAM_OVERVIEW_SPECIFICATIONS = new Map([
  ["CAIE|A-Level|9709", "2026-2027 · Version 4"],
  ["CAIE|GCSE|0580", "2025-2027 · Version 3"],
  ["CAIE|IGCSE|0580", "2025-2027 · Version 3"],
  ["CAIE|GCSE|0606", "2025-2027"],
  ["CAIE|IGCSE|0606", "2025-2027"],
  ["CAIE|IGCSE|0607", "2025-2027"],
  ["CAIE|A-Level|9231", "2026-2027"],
  ["CAIE|GCSE|0610", "2026-2028 · Version 2"],
  ["CAIE|IGCSE|0610", "2026-2028 · Version 2"],
  ["CAIE|GCSE|0620", "2026-2028 · Version 1"],
  ["CAIE|IGCSE|0620", "2026-2028 · Version 1"],
  ["CAIE|GCSE|0625", "2026-2028 · Version 2"],
  ["CAIE|IGCSE|0625", "2026-2028 · Version 2"],
  ["CAIE|GCSE|0478", "2026-2028 · Version 5"],
  ["CAIE|IGCSE|0478", "2026-2028 · Version 5"],
  ["CAIE|A-Level|9700", "2025-2027 · Version 1"],
  ["CAIE|A-Level|9701", "2025-2027 · Version 1"],
  ["CAIE|A-Level|9702", "2025-2027 · Version 1"],
  ["CAIE|A-Level|9618", "2026 · Version 2"],
  ["CAIE|GCSE|0455", "2026 · Version 2"],
  ["CAIE|IGCSE|0455", "2026 · Version 2"],
  ["CAIE|GCSE|0450", "2026 · Version 2"],
  ["CAIE|IGCSE|0450", "2026 · Version 2"],
  ["CAIE|GCSE|0452", "2026 · Version 2"],
  ["CAIE|IGCSE|0452", "2026 · Version 2"],
  ["CAIE|A-Level|9708", "2026-2028 · Version 2"],
  ["CAIE|A-Level|9609", "2026-2028 · Version 2"],
  ["CAIE|A-Level|9706", "2026-2028 · Version 2"],
  ["Edexcel|GCSE|4MA1", "Issue 2"],
  ["Edexcel|IGCSE|4MA1", "Issue 2"],
  ["Edexcel|GCSE|4PM1", "Issue 1"],
  ["Edexcel|IGCSE|4PM1", "Issue 1"],
  ["Edexcel|IGCSE|4MB1", "Issue 1"],
  ["Edexcel|IGCSE|4BI1", "Issue 3 · September 2024"],
  ["Edexcel|IGCSE|4CH1", "Issue 3 · September 2024"],
  ["Edexcel|IGCSE|4PH1", "Issue 4 · September 2024"],
  ["Edexcel|IGCSE|4CP0", "Current specification"],
  ["Edexcel|GCSE|4EC1", "Issue 3 · February 2026"],
  ["Edexcel|IGCSE|4EC1", "Issue 3 · February 2026"],
  ["Edexcel|GCSE|4BS1", "Issue 2 · February 2026"],
  ["Edexcel|IGCSE|4BS1", "Issue 2 · February 2026"],
  ["Edexcel|GCSE|4AC1", "Issue 1 · October 2016"],
  ["Edexcel|IGCSE|4AC1", "Issue 1 · October 2016"],
  ["Edexcel|A-Level|WMA", "IAL Mathematics · Issue 3"],
  ["Edexcel|A-Level|YFM01", "IAL Further Mathematics · Issue 3"],
  ["Edexcel|A-Level|YPM01", "IAL Pure Mathematics · Issue 3"],
  ["Edexcel|A-Level|YBI11", "IAL Biology · current specification"],
  ["Edexcel|A-Level|YCH11", "IAL Chemistry · current specification"],
  ["Edexcel|A-Level|YPH11", "IAL Physics · Issue 3"],
  ["Edexcel|A-Level|YEC11", "IAL Economics · Issue 2"],
  ["Edexcel|A-Level|YBS11", "IAL Business · Issue 1"],
  ["Edexcel|A-Level|YAC11", "IAL Accounting · Issue 2"],
  ["AQA|GCSE|8300", "Version 1.0"],
  ["AQA|Level 2 Certificate|8365", "Version 1.4"],
  ["Edexcel|GCSE|1MA1", "Issue 2"],
  ["Edexcel UK|GCSE|1MA1", "Issue 2"],
  ["Edexcel UK|Level 2 Certificate|7M20", "Issue 2 · September 2025"],
  ["Edexcel UK|A-Level|8MA0", "Issue 3 · October 2025"],
  ["Edexcel UK|A-Level|9MA0", "Issue 4"],
  ["Edexcel UK|A-Level|9FM0", "Issue 4"],
  ["OCR|GCSE|J560", "Version 2.0 · May 2026"],
  ["OCR|Level 3 FSMQ|6993", "Version 2.0 · June 2026"],
  ["OCR|A-Level|H240", "Version 3 · October 2025"],
  ["OCR|A-Level|H245", "Version 2 · October 2025"],
]);

const BOARD_SOURCES: Record<string, string> = {
  CAIE: "https://www.cambridgeinternational.org/programmes-and-qualifications/",
  Edexcel: "https://qualifications.pearson.com/",
  "Edexcel UK": "https://qualifications.pearson.com/",
  AQA: "https://www.aqa.org.uk/subjects",
  OCR: "https://www.ocr.org.uk/qualifications/",
  "WJEC/Eduqas": "https://www.wjec.co.uk/qualifications/",
};

const KNOWLEDGE_CODES = new Set([
  "CAIE-0580", "CAIE-0606", "CAIE-9709", "CAIE-9231",
  "Edexcel-4MA1", "Edexcel-4PM1", "Edexcel-1MA1", "Edexcel-8MA0",
  "Edexcel-9MA0", "Edexcel-9FM0", "Edexcel-IAL", "AQA-8300",
  "AQA-8365", "AQA-7357", "AQA-7367", "OCR-J560", "OCR-H240",
  "OCR-H640", "OCR-H245", "OCR-6993", "WJEC-3300",
]);
const PAST_PAPER_READY_CODES = new Set([
  "CAIE|0580", "CAIE|0606", "CAIE|9231", "CAIE|9709",
  "Edexcel|1MA1", "Edexcel UK|1MA1", "Edexcel UK|9MA0", "Edexcel UK|9FM0", "OCR|H240",
]);
const OCR_OFFICIAL_SUBJECT_NAMES = new Map(
  [...ocrOfficialStatistics.gcse, ...ocrOfficialStatistics.aLevel].map((row) => [row.code, row.name]),
);

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeLevel(level: string): string {
  if (level === "A_LEVEL") return "A-Level";
  if (level === "IAL") return "A-Level";
  return level;
}

function capability(
  status: FeatureAvailability["status"],
  verificationStatus: FeatureAvailability["verificationStatus"],
  href?: string,
  reason?: string,
): FeatureAvailability {
  return { status, verificationStatus, href, reason };
}

function boundariesHref(board: string, level: string): string | undefined {
  const boardSlug = board.startsWith("Edexcel") ? "edexcel" : slug(board.split("/")[0]);
  if (!["caie", "edexcel", "aqa", "ocr"].includes(boardSlug)) return undefined;
  if (boardSlug === "ocr" && /fsmq/i.test(level)) return "/fsmq/ocr";
  const levelSlug = normalizeLevel(level) === "A-Level" ? "alevel" : "gcse";
  return `/${levelSlug}/${boardSlug}`;
}

function knowledgeCode(board: string, code: string, level: string): string | undefined {
  const normalizedBoard = board.startsWith("Edexcel") ? "Edexcel" : board.split("/")[0];
  const candidates = [`${normalizedBoard}-${code}`];
  if (normalizedBoard === "Edexcel" && normalizeLevel(level) === "A-Level" && /^W(MA|ME|ST|DM)/.test(code)) {
    candidates.unshift("Edexcel-IAL");
  }
  return candidates.find((candidate) => KNOWLEDGE_CODES.has(candidate));
}

type MutableCourse = {
  board: string;
  level: string;
  code: string;
  name: string;
  planner: boolean;
  statistics: boolean;
  papers: boolean;
  syllabusVersion?: string;
};

function buildCatalog(): CourseContextEntry[] {
  const courses = new Map<string, MutableCourse>();
  const keyOf = (board: string, level: string, code: string) => `${board}|${normalizeLevel(level)}|${code}`;
  const latestStatisticsYear = new Map<string, number>();
  for (const stat of ALL_SUBJECT_STATS) {
    const latest = stat.years.reduce((max, year) => Math.max(max, Number(year.year) || 0), 0);
    const key = keyOf(stat.board, stat.level, stat.code);
    latestStatisticsYear.set(key, Math.max(latestStatisticsYear.get(key) ?? 0, latest));
  }

  const planner = plannerData as Record<string, Record<string, Record<string, { name: string }>>>;
  for (const [level, boards] of Object.entries(planner)) {
    for (const [board, subjects] of Object.entries(boards)) {
      for (const [code, subject] of Object.entries(subjects)) {
        const subjectName = normalizeCourseSubjectName(board, code, subject.name);
        courses.set(keyOf(board, level, code), {
          board, level: normalizeLevel(level), code, name: subjectName,
          planner: true, statistics: false, papers: false,
        });
      }
    }
  }

  for (const stat of ALL_SUBJECT_STATS) {
    const key = keyOf(stat.board, stat.level, stat.code);
    const current = courses.get(key);
    courses.set(key, {
      board: stat.board, level: normalizeLevel(stat.level), code: stat.code,
      name: current?.name || stat.name, planner: current?.planner ?? false,
      statistics: true, papers: current?.papers ?? false,
      syllabusVersion: current?.syllabusVersion,
    });
  }

  for (const paper of ALL_PAPERS) {
    const key = keyOf(paper.board, paper.qualification, paper.subjectCode);
    const current = courses.get(key);
    courses.set(key, {
      board: paper.board, level: normalizeLevel(paper.qualification), code: paper.subjectCode,
      name: current?.name || paper.subjectName, planner: current?.planner ?? false,
      statistics: current?.statistics ?? false, papers: true,
      syllabusVersion: paper.syllabusVersion,
    });
  }

  // A course with audited Question Paper assets is Paper-capable even when a
  // standalone PaperMetadata detail page has not yet been authored.
  for (const course of courses.values()) {
    if (PAST_PAPER_READY_CODES.has(`${course.board}|${course.code}`)) course.papers = true;
  }

  // Preserve the official subject identity for the qualifications supported by
  // the Award engine. Some legacy boundary imports use the qualification code
  // itself as the subject name, which would misclassify OCR H240 as "other".
  for (const [board, code, name] of [
    ["AQA", "7357", "Mathematics"],
    ["OCR", "H240", "Mathematics A"],
    ["CAIE", "9709", "Mathematics"],
  ] as const) {
    const key = keyOf(board, "A-Level", code);
    const current = courses.get(key);
    courses.set(key, {
      board, level: "A-Level", code, name,
      planner: current?.planner ?? false,
      statistics: current?.statistics ?? false,
      papers: current?.papers ?? false,
      syllabusVersion: current?.syllabusVersion,
    });
  }

  // UK mathematics qualifications need stable, human-readable identities in
  // the global selector. Some legacy imports use the code as the title or put
  // standalone Level 2/3 qualifications under GCSE for storage convenience.
  for (const [board, level, code, name] of [
    ["AQA", "GCSE", "8300", "Mathematics"],
    ["Edexcel", "GCSE", "1MA1", "Mathematics"],
    ["Edexcel UK", "GCSE", "1MA1", "Mathematics"],
    ["Edexcel UK", "A-Level", "8MA0", "AS Mathematics"],
    ["Edexcel UK", "A-Level", "9MA0", "Mathematics"],
    ["Edexcel UK", "A-Level", "9FM0", "Further Mathematics"],
    ["OCR", "GCSE", "J560", "Mathematics"],
    ["OCR", "A-Level", "H240", "Mathematics A"],
    ["OCR", "A-Level", "H245", "Further Mathematics A"],
  ] as const) {
    const key = keyOf(board, level, code);
    const current = courses.get(key);
    courses.set(key, {
      board, level, code, name,
      planner: current?.planner ?? false,
      statistics: current?.statistics ?? false,
      papers: current?.papers ?? false,
      syllabusVersion: current?.syllabusVersion,
    });
  }

  for (const [board, legacyLevel, level, code, name] of [
    ["AQA", "GCSE", "Level 2 Certificate", "8365", "Further Mathematics"],
    ["OCR", "GCSE", "Level 3 FSMQ", "6993", "Additional Mathematics"],
  ] as const) {
    const legacyKey = keyOf(board, legacyLevel, code);
    const current = courses.get(legacyKey);
    courses.delete(legacyKey);
    courses.set(keyOf(board, level, code), {
      board, level, code, name,
      planner: current?.planner ?? false,
      statistics: code === "6993" ? true : current?.statistics ?? false,
      papers: current?.papers ?? false,
      syllabusVersion: current?.syllabusVersion,
    });
  }

  const extendedMathsKey = keyOf("Edexcel UK", "Level 2 Certificate", "7M20");
  courses.set(extendedMathsKey, {
    board: "Edexcel UK", level: "Level 2 Certificate", code: "7M20",
    name: "Extended Mathematics", planner: false, statistics: true, papers: false,
    syllabusVersion: "Issue 2 · September 2025",
  });

  // The calculator exposes a verified Pearson IAL Mathematics award, represented as WMA.
  const ialKey = keyOf("Edexcel", "A-Level", "WMA");
  const ial = courses.get(ialKey);
  courses.set(ialKey, {
    board: "Edexcel", level: "A-Level", code: "WMA", name: "International A-Level Mathematics",
    planner: ial?.planner ?? true, statistics: true,
    papers: ial?.papers ?? false, syllabusVersion: ial?.syllabusVersion ?? "IAL current specification",
  });

  // Cambridge 0607 is not present in the legacy planner/statistics imports, but
  // it is an active qualification and needs a first-class course selector entry.
  const internationalMathsKey = keyOf("CAIE", "IGCSE", "0607");
  const internationalMaths = courses.get(internationalMathsKey);
  courses.set(internationalMathsKey, {
    board: "CAIE", level: "IGCSE", code: "0607", name: "International Mathematics",
    planner: internationalMaths?.planner ?? false,
    statistics: true,
    papers: internationalMaths?.papers ?? false,
    syllabusVersion: internationalMaths?.syllabusVersion,
  });

  // Pearson represents these sciences with unit paper codes in timetables, but
  // the overview selector needs one stable entry per IAS/IAL qualification group.
  for (const [code, name] of [
    ["YBI11", "International A-Level Biology"],
    ["YCH11", "International A-Level Chemistry"],
    ["YPH11", "International A-Level Physics"],
    ["YEC11", "International A-Level Economics"],
    ["YBS11", "International A-Level Business"],
    ["YAC11", "International A-Level Accounting"],
  ] as const) {
    const key = keyOf("Edexcel", "A-Level", code);
    const current = courses.get(key);
    courses.set(key, {
      board: "Edexcel", level: "A-Level", code, name,
      planner: current?.planner ?? false,
      statistics: true,
      papers: current?.papers ?? false,
      syllabusVersion: current?.syllabusVersion,
    });
  }

  // Economics, business and accounting overviews also need stable selector
  // entries even when the legacy planner/statistics imports do not contain them.
  for (const [board, level, code, name] of [
    ["CAIE", "IGCSE", "0455", "Economics"],
    ["CAIE", "IGCSE", "0450", "Business Studies"],
    ["CAIE", "IGCSE", "0452", "Accounting"],
    ["CAIE", "A-Level", "9708", "Economics"],
    ["CAIE", "A-Level", "9609", "Business"],
    ["CAIE", "A-Level", "9706", "Accounting"],
    ["Edexcel", "IGCSE", "4EC1", "Economics"],
    ["Edexcel", "IGCSE", "4BS1", "Business"],
    ["Edexcel", "IGCSE", "4AC1", "Accounting"],
  ] as const) {
    const key = keyOf(board, level, code);
    const current = courses.get(key);
    courses.set(key, {
      board, level, code, name,
      planner: current?.planner ?? false,
      statistics: current?.statistics ?? false,
      papers: current?.papers ?? false,
      syllabusVersion: current?.syllabusVersion,
    });
  }

  return [...courses.values()].map((course) => {
    const boardId = `board:${slug(course.board)}`;
    const level = normalizeLevel(course.level);
    const qualificationId = `qual:${slug(course.board)}:${slug(level)}:${slug(course.code)}`;
    const specificationLabel = EXAM_OVERVIEW_SPECIFICATIONS.get(`${course.board}|${level}|${course.code}`)
      ?? course.syllabusVersion
      ?? "当前数据版本";
    const specificationId = `spec:${slug(course.board)}:${slug(level)}:${slug(course.code)}:${slug(specificationLabel)}`;
    const knowledgeTreeCode = knowledgeCode(course.board, course.code, level);
    const boundaryHref = boundariesHref(course.board, level);
    const isWjec = course.board === "WJEC/Eduqas";
    const isMath = /math|mathematics/i.test(course.name) || ["9709", "0580", "0606", "0607", "9231", "WMA", "YFM01", "YPM01", "8300", "8365", "1MA1", "7M20", "8MA0", "9MA0", "9FM0", "J560", "6993", "H240", "H245"].includes(course.code);
    const isLegacyWma = course.board === "Edexcel" && level === "A-Level" && course.code === "WMA";
    const hasExamOverview = (course.board === "CAIE" && ["9709", "0580", "0606", "0607", "9231", "0610", "0620", "0625", "0478", "9700", "9701", "9702", "9618", "0455", "0450", "0452", "9708", "9609", "9706"].includes(course.code))
      || (course.board === "Edexcel" && ["4MA1", "4PM1", "4MB1", "4BI1", "4CH1", "4PH1", "4CP0", "4EC1", "4BS1", "4AC1", "WMA", "YFM01", "YPM01", "YBI11", "YCH11", "YPH11", "YEC11", "YBS11", "YAC11", "1MA1", "7M20", "9MA0", "9FM0"].includes(course.code))
      || (course.board === "Edexcel UK" && ["1MA1", "7M20", "8MA0", "9MA0", "9FM0"].includes(course.code))
      || (course.board === "AQA" && ["8300", "8365", "7357", "7367"].includes(course.code))
      || (course.board === "OCR" && ["J560", "6993", "H240", "H245"].includes(course.code));
    const latestYear = latestStatisticsYear.get(`${course.board}|${level}|${course.code}`);
    const listedByCambridge = course.board === "CAIE" && CURRENT_CAMBRIDGE_CODES.has(course.code);
    const lifecycleStatus = hasExamOverview || listedByCambridge || (latestYear ?? 0) >= 2024 ? "current" : "historical";
    const lifecycleEvidence = hasExamOverview
      ? "考试概览已人工核验"
      : listedByCambridge
        ? "Cambridge 官方现行科目目录（2026-07-15）"
        : (latestYear ?? 0) >= 2024
          ? `官方成绩统计最近记录：${latestYear}`
          : latestYear
            ? `仅有历史成绩记录，最近为 ${latestYear}`
            : "仅见于历史工具或组件数据，尚无近期资格记录";
    const cleanedName = course.board === "AQA" && lifecycleStatus === "current"
      ? course.name.replace(/\s+Adv(?=\s|\(|$)/gi, "").replace(/^D&t:/i, "Design & Technology:")
      : course.name;
    const sourcedName = course.board === "OCR" && cleanedName === course.code
      ? OCR_OFFICIAL_SUBJECT_NAMES.get(course.code) ?? cleanedName
      : cleanedName;
    const normalizedName = normalizeCourseSubjectName(course.board, course.code, sourcedName);
    const gradeCalculation: GradeCalculationAvailability = isLegacyWma
      ? { status: "official", routeIds: ["legacy:edexcel:ial:wma"] }
      : AWARD_QUALIFICATION_KEYS.has(`${course.board}|${course.code}`)
        ? getGradeCalculationAvailability(course.code)
        : { status: "unavailable", reason: isWjec ? "当前仅提供成绩统计" : "没有完整且已核验的整体资格路线与边界" };

    const capabilities: CourseContextEntry["capabilities"] = {
      boundaries: boundaryHref && !isWjec
        ? capability("partial", "mixed", boundaryHref, "历史数据包含已核验与待核验记录")
        : capability("unavailable", "unverified", undefined, isWjec ? "当前仅提供成绩统计" : "尚无分数线页面"),
      statistics: course.statistics
        ? capability("available", "mixed", "/statistics")
        : capability("unavailable", "unverified", undefined, "尚无该课程成绩统计"),
      papers: course.papers && !isWjec
        ? capability("available", "verified", "/papers")
        : capability("unavailable", "unverified", undefined, "Paper 详情库尚未覆盖"),
      syllabus: knowledgeTreeCode && !isWjec
        ? capability("partial", "mixed", "/knowledge-tree", "课程映射处于候选复核阶段；精确相似度暂不可用")
        : capability("unavailable", "unverified", undefined, "知识树尚未覆盖"),
      calculator: toCalculatorFeature(gradeCalculation),
      planner: course.planner && !isWjec
        ? capability("available", "mixed", "/planner")
        : capability("unavailable", "unverified", undefined, "刷题计划目录尚未覆盖"),
      graph: isMath && !isWjec
        ? capability("available", "verified", "/graph")
        : capability("unavailable", "verified", undefined, "函数画图仅适用于数学课程"),
      examOverview: hasExamOverview
        ? capability("available", "verified", "/exam-overview")
        : capability("unavailable", "verified", undefined, "考试概览尚未覆盖该课程"),
    };

    return {
      qualificationId, specificationId, specificationLabel,
      boardId, boardName: course.board, level, subjectCode: course.code,
      subjectName: normalizedName, subjectCategory: classifySubject(normalizedName, course.code),
      lifecycleStatus, lifecycleEvidence, lastObservedYear: latestYear || undefined,
      label: `${course.board} ${level} ${normalizedName}`,
      sourceUrl: BOARD_SOURCES[course.board] ?? "https://www.gov.uk/government/organisations/ofqual",
      accessedAt: ACCESSED_AT, knowledgeTreeCode,
      calculatorBoardKey: isLegacyWma ? "Edexcel-AL" : undefined,
      plannerLevel: course.planner ? level : undefined,
      plannerBoard: course.planner ? course.board : undefined,
      gradeCalculation,
      capabilities,
    } satisfies CourseContextEntry;
  }).sort((a, b) => a.label.localeCompare(b.label, "en-GB", { numeric: true }));
}

export const COURSE_CATALOG = buildCatalog();
