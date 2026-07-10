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
  subjectCode: string;
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
  completed: boolean;
  dayOffset: number;
}

export interface WeekGroup {
  weekNum: number;
  weekLabel: string;
  days: DailyTask[];
}

export interface PlannerConfig {
  startDate: string;
  events: ExamEvent[];
  restDays: number[];
  intensity: Intensity;
  paperOverrides: Record<string, string>;
}

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
        subjectCode: g.subjectCode,
        paperLabel: g.paperLabel,
        paperName: `${g.subjectCode} ${g.paperLabel}`,
        examDate,
        variants: g.variants,
      };
    })
    .filter((e): e is ExamEvent => e !== null);
}

export function usePlanner(config: PlannerConfig, pastPapersMap: Record<string, string[]>): PlannerResult {
  return useMemo(() => {
    const { startDate, events, restDays, intensity, paperOverrides } = config;
    if (events.length === 0) return { weeks: [], totalTasks: 0, totalDays: 0 };

    const start = parseLocalDate(startDate);
    const papersPerWeek = INTENSITY_CONFIG[intensity].papersPerWeek;

    // Find end date (latest exam + 1 day)
    let endDate = start;
    for (const ev of events) {
      const d = parseLocalDate(ev.examDate);
      if (d > endDate) endDate = d;
    }
    endDate = addDays(endDate, 1);
    const totalDays = differenceInDays(endDate, start) + 1;

    // P1-3: weekly quota key is subjectCode ("每周每科"), not paperName
    // Collect events per subject for round-robin allocation
    const subjectEvents = new Map<string, ExamEvent[]>();
    for (const ev of events) {
      const list = subjectEvents.get(ev.subjectCode) ?? [];
      list.push(ev);
      subjectEvents.set(ev.subjectCode, list);
    }

    // Track paper index per paperName and weekly counts per subjectCode
    const paperIndex = new Map<string, number>();
    events.forEach(ev => { paperIndex.set(ev.paperName, 0); });

    // Round-robin pointer per subject
    const subjectRrIndex = new Map<string, number>();
    subjectEvents.forEach((_, sc) => { subjectRrIndex.set(sc, 0); });

    // Build day-by-day
    const weeks: WeekGroup[] = [];
    let currentWeek: DailyTask[] = [];
    let weeklyCounts = new Map<string, number>();
    subjectEvents.forEach((_, sc) => { weeklyCounts.set(sc, 0); });

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
        subjectEvents.forEach((_, sc) => { weeklyCounts.set(sc, 0); });
      }

      const tasks: TaskPaper[] = [];

      // P1-3: Rest day = no practice tasks assigned (simple global rest semantics)
      if (isRest) {
        // Rest day: skip all practice paper allocation
      } else {
      // P1-3: weekly quota per subjectCode, round-robin within subject
      for (const [subjectCode, sEvents] of subjectEvents) {
        const scCount = weeklyCounts.get(subjectCode) ?? 0;
        if (scCount >= papersPerWeek) continue;

        // Round-robin pick one paper from this subject's events
        const rrIdx = subjectRrIndex.get(subjectCode) ?? 0;
        let allocated = false;
        for (let attempt = 0; attempt < sEvents.length; attempt++) {
          const ev = sEvents[(rrIdx + attempt) % sEvents.length];
          const daysUntilExam = differenceInDays(parseLocalDate(ev.examDate), date);
          if (daysUntilExam <= 0) continue;

          const pastPapers = pastPapersMap[ev.paperName] ?? [];
          const pIdx = paperIndex.get(ev.paperName) ?? 0;
          if (pIdx >= pastPapers.length) continue;

          const pastPaper = paperOverrides[ev.paperName] || pastPapers[pIdx];
          const variantCode = ev.variants[0]?.code ?? ev.paperName;
          tasks.push({
            paperCode: variantCode,
            paperName: ev.paperName,
            subjectCode: ev.subjectCode,
            pastPaper,
            completed: false,
            dayOffset: d,
          });
          paperIndex.set(ev.paperName, pIdx + 1);
          subjectRrIndex.set(subjectCode, (rrIdx + attempt + 1) % sEvents.length);
          weeklyCounts.set(subjectCode, scCount + 1);
          allocated = true;
          break;
        }
        if (!allocated) {
          subjectRrIndex.set(subjectCode, 0); // reset if none available
        }
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
  }, [config, pastPapersMap]);
}
