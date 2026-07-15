import { EXAM_OVERVIEW_CATALOG } from "@/domain-v2/exam-overview/catalog";
import { EXAM_DATES } from "./examDates";

export type PlannerExamDateSource = "exam-overview" | "legacy-timetable";

export interface PlannerExamDateResolution {
  date: string;
  source: PlannerExamDateSource;
  componentCode: string;
  overviewId?: string;
  series?: string;
  timetableStatus?: string;
}

type ApprovedScheduleRecord = Required<Pick<PlannerExamDateResolution, "date" | "componentCode" | "overviewId">>
  & Pick<PlannerExamDateResolution, "series" | "timetableStatus">;

/**
 * Convert the different component labels used by the planner and exam overview
 * into one comparable key.
 */
export function canonicalExamComponentCode(rawCode: string): string {
  const value = rawCode.toUpperCase().replace(/\\/g, "/").replace(/\s+/g, " ").trim();
  if (!value) return "";

  // Pearson IAL planner rows contain a unit code plus a descriptive component,
  // while the official timetable uses e.g. "WMA11 01". The unit code is unique.
  const ialUnit = value.match(/^(W[A-Z]{2}\d{2})(?:[ /].*)?$/);
  if (ialUnit) return ialUnit[1];

  // Descriptive planner components such as "4MA1/Mathematics Paper 1H".
  const describedPaper = value.match(/^([A-Z0-9]+)[ /].*?PAPER\s*0*(\d+[A-Z]*)\b/);
  if (describedPaper) return `${describedPaper[1]}/${describedPaper[2]}`;

  // Standard timetable forms: 9709/13, 4MA1 1H, J560/01, 7357/1.
  const directComponent = value.match(/^([A-Z0-9]+)[ /]0*(\d+[A-Z]*)$/);
  if (directComponent) return `${directComponent[1]}/${directComponent[2]}`;

  return value.replace(/\s+/g, "");
}

function buildApprovedScheduleIndex() {
  const index = new Map<string, ApprovedScheduleRecord[]>();

  for (const overview of EXAM_OVERVIEW_CATALOG) {
    for (const exam of overview.upcomingExams) {
      // Combined next-exam labels are split defensively, although approved
      // upcomingExams normally stores one component per row.
      for (const rawCode of exam.code.split(/\s*[·,]\s*/)) {
        const key = canonicalExamComponentCode(rawCode);
        if (!key) continue;
        const records = index.get(key) ?? [];
        records.push({
          date: exam.date,
          componentCode: rawCode.trim(),
          overviewId: overview.id,
          series: overview.upcomingSeries,
          timetableStatus: overview.timetableStatus,
        });
        index.set(key, records);
      }
    }
  }

  return index;
}

const APPROVED_SCHEDULE_INDEX = buildApprovedScheduleIndex();

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function chooseNearest(records: PlannerExamDateResolution[], today: string): PlannerExamDateResolution | null {
  if (records.length === 0) return null;
  const unique = Array.from(new Map(records.map((record) => [
    `${record.date}|${record.componentCode}|${record.overviewId ?? "legacy"}`,
    record,
  ])).values());
  const future = unique.filter((record) => record.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (future.length > 0) return future[0];
  return unique.sort((a, b) => b.date.localeCompare(a.date))[0];
}

function plannerBoardKey(level: string, board: string): string {
  if (board === "Edexcel" && level === "A-Level") return "Edexcel-IAL";
  if (board === "Edexcel" && level !== "A-Level") return "Edexcel-GCSE";
  return `${board}-${level === "A-Level" ? "AL" : "GCSE"}`;
}

/** Legacy fallback for qualifications that do not yet have an exam overview. */
export function lookupLegacyPlannerExamDate(level: string, board: string, paperCode: string): string | null {
  const dates = EXAM_DATES[plannerBoardKey(level, board)];
  if (!dates) return null;
  if (dates[paperCode]) return dates[paperCode];

  const slashIndex = paperCode.indexOf("/");
  if (slashIndex > 0) {
    const subject = paperCode.slice(0, slashIndex);
    const paper = paperCode.slice(slashIndex + 1);

    if ((board === "Edexcel" || board === "AQA") && level === "A-Level") {
      if (dates[subject]) return dates[subject];
    } else {
      const cleanedPaper = paper.replace(/^[A-Za-z\s]+Paper\s+/i, "").trim();
      if (dates[`${subject}/${cleanedPaper}`]) return dates[`${subject}/${cleanedPaper}`];
      if (dates[subject]) return dates[subject];
    }
  }

  const baseCode = paperCode.split(/[/\s]/)[0];
  return dates[baseCode] ?? null;
}

/**
 * Resolve one logical Paper group. Approved exam-overview dates always win;
 * the old planner table is only used where no approved overview row exists.
 */
export function resolvePlannerGroupExamDate(
  level: string,
  board: string,
  variants: { code: string }[],
  today = localDateKey(),
): PlannerExamDateResolution | null {
  const approved = variants.flatMap((variant) => {
    const key = canonicalExamComponentCode(variant.code);
    return (APPROVED_SCHEDULE_INDEX.get(key) ?? []).map((record) => ({
      ...record,
      source: "exam-overview" as const,
    }));
  });
  const approvedResult = chooseNearest(approved, today);
  if (approvedResult) return approvedResult;

  const legacy = variants.flatMap((variant) => {
    const date = lookupLegacyPlannerExamDate(level, board, variant.code);
    return date ? [{
      date,
      source: "legacy-timetable" as const,
      componentCode: variant.code,
    }] : [];
  });
  return chooseNearest(legacy, today);
}
