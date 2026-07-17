import { useMemo } from "react";
import { format, addDays, differenceInDays } from "date-fns";
import { INTENSITY_CONFIG } from "../data/examData";
import type { Intensity } from "../data/examData";

/** Parse a date-only string as local time (avoid UTC offset issues). */
export function parseLocalDate(dateStr: string): Date {
  if (dateStr.length === 10) {
    return new Date(dateStr + "T00:00:00");
  }
  return new Date(dateStr);
}

/** A logical exam event: one subject + one paper label + its exam date + selected variants.
 *  This is the scheduling unit (not individual variant codes). */
export interface ExamEvent {
  paperGroupId: string;
  board: string;
  level: string;
  subjectCode: string;
  qualificationId: string;
  paperLabel: string;
  paperName: string; // e.g. "CAIE-9709 P1"
  examDate: string;
  variants: { code: string; component: string }[];
}

export interface DailyTask {
  date: string;
  dateLabel: string;
  isRestDay: boolean;
  isExamDay: boolean;
  isWeekend: boolean;
  papers: TaskPaper[];
}

export interface TaskPaper {
  paperCode: string;
  paperName: string;
  subjectCode: string;
  pastPaper: string;
  pastPaperAssetId?: string;
  questionPaperUrl?: string;
  markSchemeUrl?: string;
  sourcePageUrl?: string;
  accessStatus?: "public" | "account-required" | "not-published" | "removed" | "unknown";
  completed: boolean;
  dayOffset: number;
  mode?: "timed" | "untimed" | "review";
  durationMinutes?: number;
  reviewMinutes?: number;
}

export interface PracticePaperOption {
  id: string;
  title: string;
  questionPaperUrl?: string;
  markSchemeUrl?: string;
  sourcePageUrl?: string;
  accessStatus: "public" | "account-required" | "not-published" | "removed" | "unknown";
  series?: string;
  variant?: string;
}

export interface WeekGroup {
  weekNum: number;
  weekLabel: string;
  days: DailyTask[];
}

export interface PaperPlanConfig {
  paperGroupId: string;
  enabled: boolean;
  targetSetsPerWeek: number;
  priority: "low" | "normal" | "high";
  mode: "timed" | "untimed" | "review";
  durationMinutes?: number;
  reviewMinutes?: number;
  allowedSeries?: string[];
  allowedVariants?: string[];
}

export interface PlannerConfigV2 {
  version: 2;
  startDate: string;
  events: ExamEvent[];
  restDays: number[];
  maxTasksPerDay: number;
  paperPlans: PaperPlanConfig[];
}

export interface LegacyPlannerConfig {
  version?: 1;
  startDate: string;
  events: ExamEvent[];
  restDays: number[];
  intensity: Intensity;
  paperOverrides: Record<string, string>;
  maxTasksPerDay?: number;
}

export type PlannerConfig = PlannerConfigV2 | LegacyPlannerConfig;

export interface PlannerResult {
  weeks: WeekGroup[];
  totalTasks: number;
  totalDays: number;
}

/** Group selected papers into ExamEvents by subjectCode + paperLabel.
 *  Each event has one exam date (nearest across all its variants). */
export function buildExamEvents(
  selectedGroups: Array<{
    subjectCode: string;
    paperLabel: string;
    board: string;
    level: string;
    variants: { code: string; component: string }[];
  }>,
  getGroupNearestExamDate: (level: string, board: string, variants: { code: string }[]) => string | null
): ExamEvent[] {
  return selectedGroups
    .map(g => {
      const examDate = getGroupNearestExamDate(g.level, g.board, g.variants);
      if (!examDate) return null;
      return {
        paperGroupId: `${g.board}|${g.level}|${g.subjectCode}|${g.paperLabel}`,
        board: g.board,
        level: g.level,
        subjectCode: g.subjectCode,
        qualificationId: getQualificationId(g.board, g.level, g.subjectCode),
        paperLabel: g.paperLabel,
        paperName: `${g.subjectCode} ${g.paperLabel}`,
        examDate,
        variants: g.variants,
      };
    })
    .filter((e): e is ExamEvent => e !== null);
}

/** Keep modular qualifications together so one qualification gets one weekly quota. */
function getQualificationId(board: string, level: string, subjectCode: string): string {
  const code = subjectCode.toUpperCase();
  if (board === "Edexcel" && level === "A-Level") {
    if (/^(WMA|YMA)/.test(code)) return "Edexcel-IAL-YMA01";
    if (/^(WFM|YFM)/.test(code)) return "Edexcel-IAL-YFM01";
    if (/^WPH/.test(code)) return "Edexcel-IAL-Physics";
    if (/^WCH/.test(code)) return "Edexcel-IAL-Chemistry";
    if (/^WBI/.test(code)) return "Edexcel-IAL-Biology";
  }
  return `${board}-${level}-${code}`;
}

export function buildPlannerResult(config: PlannerConfig, pastPapersMap: Record<string, Array<string | PracticePaperOption>>): PlannerResult {
    const { startDate, events, restDays } = config;
    const maxTasksPerDay = Math.max(1, config.maxTasksPerDay ?? 3);
    if (events.length === 0) return { weeks: [], totalTasks: 0, totalDays: 0 };

    const start = parseLocalDate(startDate);
    const paperPlans: Map<string, PaperPlanConfig> = config.version === 2
      ? new Map(config.paperPlans.map((plan) => [plan.paperGroupId, plan]))
      : new Map(events.map((event): [string, PaperPlanConfig] => [event.paperGroupId, {
        paperGroupId: event.paperGroupId,
        enabled: true,
        targetSetsPerWeek: INTENSITY_CONFIG[config.intensity].papersPerWeek,
        priority: "normal" as const,
        mode: "timed" as const,
      }]));

    // Find end date (latest exam + 1 day)
    let endDate = start;
    for (const ev of events) {
      const d = parseLocalDate(ev.examDate);
      if (d > endDate) endDate = d;
    }
    endDate = addDays(endDate, 1);
    const totalDays = differenceInDays(endDate, start) + 1;

    // Track paper index and weekly count independently for each selected Paper.
    const paperIndex = new Map<string, number>();
    events.forEach(ev => { paperIndex.set(ev.paperName, 0); });
    const priorityRank = { high: 0, normal: 1, low: 2 } as const;
    const schedulableEvents = events
      .filter((event) => paperPlans.get(event.paperGroupId)?.enabled !== false)
      .sort((a, b) => priorityRank[paperPlans.get(a.paperGroupId)?.priority ?? "normal"] - priorityRank[paperPlans.get(b.paperGroupId)?.priority ?? "normal"]);

    // Build day-by-day
    const weeks: WeekGroup[] = [];
    let currentWeek: DailyTask[] = [];
    let weeklyCounts = new Map<string, number>();
    schedulableEvents.forEach((event) => { weeklyCounts.set(event.paperGroupId, 0); });

    for (let d = 0; d < totalDays; d++) {
      const date = addDays(start, d);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isRest = restDays.includes(dayOfWeek);

      // Check exam day
      const isExam = events.some(ev => ev.examDate === dateStr);

      // Reset weekly counts on Monday
      if (dayOfWeek === 1 && d > 0 && currentWeek.length > 0) {
        weeks.push({ weekNum: weeks.length + 1, weekLabel: `第 ${weeks.length + 1} 周`, days: currentWeek });
        currentWeek = [];
        weeklyCounts = new Map<string, number>();
        schedulableEvents.forEach((event) => { weeklyCounts.set(event.paperGroupId, 0); });
      }

      const tasks: TaskPaper[] = [];

      // P1-3: Rest day = no practice tasks assigned (simple global rest semantics)
      if (isRest) {
        // Rest day: skip all practice paper allocation
      } else {
      // Per-Paper weekly quota, priority ordered with a daily rotation for fairness.
      const rotatedEvents = schedulableEvents.length
        ? [...schedulableEvents.slice(d % schedulableEvents.length), ...schedulableEvents.slice(0, d % schedulableEvents.length)]
        : [];
      for (const ev of rotatedEvents) {
        if (tasks.length >= maxTasksPerDay) break;
        const plan = paperPlans.get(ev.paperGroupId);
        const weeklyCount = weeklyCounts.get(ev.paperGroupId) ?? 0;
        if (!plan || weeklyCount >= Math.max(0, Math.min(7, plan.targetSetsPerWeek))) continue;
        if (differenceInDays(parseLocalDate(ev.examDate), date) <= 0) continue;
        const pastPapers = pastPapersMap[ev.paperName] ?? [];
        const pIdx = paperIndex.get(ev.paperName) ?? 0;
        if (pIdx >= pastPapers.length) continue;
        const selectedPastPaper = pastPapers[pIdx];
        const pastPaper = typeof selectedPastPaper === "string" ? selectedPastPaper : selectedPastPaper.title;
        tasks.push({
          paperCode: ev.variants[0]?.code ?? ev.paperName,
          paperName: ev.paperName,
          subjectCode: ev.subjectCode,
          pastPaper,
          pastPaperAssetId: typeof selectedPastPaper === "string" ? undefined : selectedPastPaper.id,
          questionPaperUrl: typeof selectedPastPaper === "string" ? undefined : selectedPastPaper.questionPaperUrl,
          markSchemeUrl: typeof selectedPastPaper === "string" ? undefined : selectedPastPaper.markSchemeUrl,
          sourcePageUrl: typeof selectedPastPaper === "string" ? undefined : selectedPastPaper.sourcePageUrl,
          accessStatus: typeof selectedPastPaper === "string" ? undefined : selectedPastPaper.accessStatus,
          completed: false,
          dayOffset: d,
          mode: plan.mode,
          durationMinutes: plan.durationMinutes,
          reviewMinutes: plan.reviewMinutes,
        });
        paperIndex.set(ev.paperName, pIdx + 1);
        weeklyCounts.set(ev.paperGroupId, weeklyCount + 1);
      }
      } // end if (!isRest)

      currentWeek.push({
        date: dateStr,
        dateLabel: format(date, "MM-dd EEE"),
        isRestDay: isRest && tasks.length === 0,
        isExamDay: isExam,
        isWeekend,
        papers: tasks,
      });
    }

    if (currentWeek.length > 0) {
      weeks.push({ weekNum: weeks.length + 1, weekLabel: `第 ${weeks.length + 1} 周`, days: currentWeek });
    }

    const totalTasks = weeks.reduce((sum, w) => sum + w.days.reduce((s, d) => s + d.papers.length, 0), 0);

    return { weeks, totalTasks, totalDays };
}

export function usePlanner(config: PlannerConfig, pastPapersMap: Record<string, Array<string | PracticePaperOption>>): PlannerResult {
  return useMemo(() => buildPlannerResult(config, pastPapersMap), [config, pastPapersMap]);
}
