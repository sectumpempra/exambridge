import compactCatalog from "./courseCatalog.generated.json";
import { toCalculatorFeature, type CourseContext, type CourseContextEntry, type CourseFeature, type CourseLifecycleStatus, type FeatureAvailability, type SubjectCategory } from "./types";
import type { GradeCalculationAvailability } from "@/domain-v2/awards/schema";
export { SUBJECT_CATEGORY_LABELS } from "./subjectCategory";

const BOARD_SOURCES: Record<string, string> = {
  CAIE: "https://www.cambridgeinternational.org/programmes-and-qualifications/",
  Edexcel: "https://qualifications.pearson.com/",
  "Edexcel UK": "https://qualifications.pearson.com/",
  AQA: "https://www.aqa.org.uk/subjects",
  OCR: "https://www.ocr.org.uk/qualifications/",
  "WJEC/Eduqas": "https://www.wjec.co.uk/qualifications/",
};

export const FEATURE_LABELS: Record<CourseFeature, string> = {
  boundaries: "分数线", statistics: "成绩统计", papers: "Paper 查询",
  syllabus: "考纲对比", calculator: "等级预测", planner: "刷题规划", graph: "函数画图",
  examOverview: "考试概览",
};

type CompactCourse = [string, string, string, string, SubjectCategory, CourseLifecycleStatus, string, number, string, string, string, string, string, string, GradeCalculationAvailability];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function capability(status: FeatureAvailability["status"], verificationStatus: FeatureAvailability["verificationStatus"], href?: string, reason?: string): FeatureAvailability {
  return { status, verificationStatus, href, reason };
}

function boundariesHref(board: string, level: string): string | undefined {
  const boardSlug = board.startsWith("Edexcel") ? "edexcel" : slug(board.split("/")[0]);
  if (!["caie", "edexcel", "aqa", "ocr"].includes(boardSlug)) return undefined;
  if (boardSlug === "ocr" && /fsmq/i.test(level)) return "/fsmq/ocr";
  return `/${level === "A-Level" ? "alevel" : "gcse"}/${boardSlug}`;
}

function expandCourse(row: CompactCourse): CourseContextEntry {
  const [boardName, level, subjectCode, subjectName, subjectCategory, lifecycleStatus, lifecycleEvidence, lastObservedYear, specificationLabel, flags, knowledgeTreeCode, calculatorBoardKey, plannerLevel, plannerBoard, gradeCalculation] = row;
  const has = (code: string) => flags.includes(code);
  const isWjec = boardName === "WJEC/Eduqas";
  const boundaryHref = boundariesHref(boardName, level);
  const qualificationId = `qual:${slug(boardName)}:${slug(level)}:${slug(subjectCode)}`;
  const specificationId = `spec:${slug(boardName)}:${slug(level)}:${slug(subjectCode)}:${slug(specificationLabel)}`;
  return {
    qualificationId,
    specificationId,
    specificationLabel,
    boardId: `board:${slug(boardName)}`,
    boardName,
    level,
    subjectCode,
    subjectName,
    subjectCategory,
    lifecycleStatus,
    lifecycleEvidence,
    lastObservedYear: lastObservedYear || undefined,
    label: `${boardName} ${level} ${subjectName}`,
    sourceUrl: BOARD_SOURCES[boardName] ?? "https://www.gov.uk/government/organisations/ofqual",
    accessedAt: compactCatalog.accessedAt,
    knowledgeTreeCode: knowledgeTreeCode || undefined,
    calculatorBoardKey: calculatorBoardKey || undefined,
    plannerLevel: plannerLevel || undefined,
    plannerBoard: plannerBoard || undefined,
    capabilities: {
      boundaries: has("b") && boundaryHref ? capability("partial", "mixed", boundaryHref, "历史数据包含已核验与待核验记录") : capability("unavailable", "unverified", undefined, isWjec ? "当前仅提供成绩统计" : "尚无分数线页面"),
      statistics: has("s") ? capability("available", "mixed", "/statistics") : capability("unavailable", "unverified", undefined, "尚无该课程成绩统计"),
      papers: has("p") ? capability("available", "verified", "/papers") : capability("unavailable", "unverified", undefined, isWjec ? "当前仅提供成绩统计" : "Paper 详情库尚未覆盖"),
      syllabus: has("y") ? capability("available", "mixed", "/knowledge-tree") : capability("unavailable", "unverified", undefined, isWjec ? "当前仅提供成绩统计" : "知识树尚未覆盖"),
      calculator: toCalculatorFeature(gradeCalculation),
      planner: has("l") ? capability("available", "mixed", "/planner") : capability("unavailable", "unverified", undefined, isWjec ? "当前仅提供成绩统计" : "刷题计划目录尚未覆盖"),
      graph: has("g") ? capability("available", "verified", "/graph") : capability("unavailable", "verified", undefined, isWjec ? "当前仅提供成绩统计" : "函数画图仅适用于数学课程"),
      examOverview: has("e") ? capability("available", "verified", "/exam-overview") : capability("unavailable", "verified", undefined, "考试概览尚未覆盖该课程"),
    },
    gradeCalculation,
  };
}

if (compactCatalog.version !== 3) throw new Error("Unsupported course catalog version");
export const COURSE_CATALOG = (compactCatalog.entries as CompactCourse[]).map(expandCourse);

function displayPreference(entry: CourseContextEntry): number {
  if (entry.boardName === "Edexcel UK") return 5;
  if (entry.boardName === "Edexcel" && entry.level === "IGCSE") return 4;
  if (entry.boardName === "CAIE" && entry.level === "IGCSE") return 4;
  if (entry.level === "A-Level") return 3;
  return 1;
}

/** One user-facing card per board, level and qualification code while retaining every raw entry in COURSE_CATALOG. */
export function getDisplayCourseCatalog(status: CourseLifecycleStatus): CourseContextEntry[] {
  const grouped = new Map<string, CourseContextEntry[]>();
  for (const entry of COURSE_CATALOG) {
    if (entry.lifecycleStatus !== status) continue;
    const board = entry.boardName.startsWith("Edexcel") ? "pearson" : entry.boardName;
    const key = `${board}|${entry.level}|${entry.subjectCode}`;
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }
  const statusRank = { unavailable: 0, partial: 1, available: 2 } as const;
  const verificationRank = { unverified: 0, mixed: 1, verified: 2 } as const;
  const selected = [...grouped.values()].map((aliases) => {
    const representative = [...aliases].sort((a, b) => displayPreference(b) - displayPreference(a))[0];
    const capabilities = Object.fromEntries((Object.keys(representative.capabilities) as CourseFeature[]).map((feature) => {
      const strongest = [...aliases]
        .map((entry) => entry.capabilities[feature])
        .sort((a, b) => statusRank[b.status] - statusRank[a.status] || verificationRank[b.verificationStatus] - verificationRank[a.verificationStatus])[0];
      return [feature, strongest];
    })) as CourseContextEntry["capabilities"];
    const calculatorSource = [...aliases].sort((a, b) => statusRank[b.capabilities.calculator.status] - statusRank[a.capabilities.calculator.status])[0];
    return {
      ...representative,
      capabilities,
      plannerLevel: representative.plannerLevel ?? aliases.find((entry) => entry.plannerLevel)?.plannerLevel,
      plannerBoard: representative.plannerBoard ?? aliases.find((entry) => entry.plannerBoard)?.plannerBoard,
      knowledgeTreeCode: representative.knowledgeTreeCode ?? aliases.find((entry) => entry.knowledgeTreeCode)?.knowledgeTreeCode,
      calculatorBoardKey: representative.calculatorBoardKey ?? aliases.find((entry) => entry.calculatorBoardKey)?.calculatorBoardKey,
      gradeCalculation: calculatorSource.gradeCalculation,
    } satisfies CourseContextEntry;
  });
  return selected.sort((a, b) => a.label.localeCompare(b.label, "en-GB", { numeric: true }));
}
const BY_QUALIFICATION = new Map(COURSE_CATALOG.map((entry) => [entry.qualificationId, entry]));

export function getCourseEntry(context: CourseContext | null | undefined): CourseContextEntry | undefined {
  if (!context) return undefined;
  const entry = BY_QUALIFICATION.get(context.qualificationId);
  if (!entry || (context.specificationId && entry.specificationId !== context.specificationId)) return undefined;
  return entry;
}

export function createCourseContext(entry: CourseContextEntry): CourseContext {
  return { qualificationId: entry.qualificationId, specificationId: entry.specificationId };
}

export function withCourseContext(href: string, context: CourseContext | null): string {
  if (!context) return href;
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("course", context.qualificationId);
  if (context.specificationId) params.set("spec", context.specificationId);
  return `${path}?${params.toString()}`;
}

export function courseMatchesRoute(entry: CourseContextEntry, pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (lower.startsWith("/fsmq")) return /fsmq/i.test(entry.level) && entry.boardName === "OCR";
  if (lower.startsWith("/alevel") && entry.level !== "A-Level") return false;
  if (lower.startsWith("/gcse") && !["GCSE", "IGCSE"].includes(entry.level)) return false;
  const boardSegment = lower.split("/")[2];
  if (!boardSegment) return true;
  const expected = entry.boardName.startsWith("Edexcel") ? "edexcel" : slug(entry.boardName.split("/")[0]);
  return boardSegment === expected;
}
