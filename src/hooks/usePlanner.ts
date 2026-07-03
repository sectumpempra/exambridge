import { useMemo } from "react";
import { format, addDays, differenceInDays } from "date-fns";
import { INTENSITY_CONFIG } from "../data/examData";
import type { Intensity } from "../data/examData";

/** Parse a date-only string as local time (avoid UTC offset issues) */
function parseLocalDate(dateStr: string): Date {
  if (dateStr.length === 10) {
    // "YYYY-MM-DD" → append "T00:00:00" for local-time parsing
    return new Date(dateStr + "T00:00:00");
  }
  return new Date(dateStr);
}

export interface DailyTask {
  date: string;
  dateLabel: string;
  isRestDay: boolean;
  isExamDay: boolean;
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

export interface SelectedPaperGroup {
  subjectCode: string;
  paperNum: string;
  paperLabel: string;
  board: string;
  level: string;
  variants: { code: string; component: string }[];
}

export interface PlannerConfig {
  startDate: string;
  selectedPapers: {
    code: string;
    name: string;
    subjectCode: string;
    component: string;
    examDate: string;
  }[];
  restDays: number[];
  intensity: Intensity;
  paperOverrides: Record<string, string>;
  selectedGroups?: SelectedPaperGroup[];
  level?: string;
  board?: string;
}

export interface PlannerResult {
  weeks: WeekGroup[];
  totalTasks: number;
  totalDays: number;
}

export function usePlanner(config: PlannerConfig, pastPapersMap: Record<string, string[]>): PlannerResult {
  return useMemo(() => {
    const { startDate, selectedPapers, restDays, intensity, paperOverrides } = config;
    if (selectedPapers.length === 0) return { weeks: [], totalTasks: 0, totalDays: 0 };

    const start = parseLocalDate(startDate);
    const papersPerWeek = INTENSITY_CONFIG[intensity].papersPerWeek;

    // Build exam date map
    const examDateMap = new Map<string, string>();
    selectedPapers.forEach(p => { examDateMap.set(p.code, p.examDate); });

    // Find end date (latest exam + 1 day)
    let endDate = start;
    examDateMap.forEach(dateStr => {
      const d = parseLocalDate(dateStr);
      if (d > endDate) endDate = d;
    });
    endDate = addDays(endDate, 1);
    const totalDays = differenceInDays(endDate, start) + 1;

    // Track paper index for each selected paper
    const paperIndex = new Map<string, number>();
    selectedPapers.forEach(p => paperIndex.set(p.code, 0));

    // Build day-by-day
    const weeks: WeekGroup[] = [];
    let currentWeek: DailyTask[] = [];
    let weeklyCounts = new Map<string, number>();
    selectedPapers.forEach(p => weeklyCounts.set(p.code, 0));

    for (let d = 0; d < totalDays; d++) {
      const date = addDays(start, d);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayOfWeek = date.getDay();
      const isRest = restDays.includes(dayOfWeek);

      // Check exam day
      const isExam = Array.from(examDateMap.values()).some(ed => ed === dateStr);

      // Reset weekly counts on Monday
      if (dayOfWeek === 1 && d > 0 && currentWeek.length > 0) {
        weeks.push({ weekNum: weeks.length + 1, weekLabel: `第 ${weeks.length + 1} 周`, days: currentWeek });
        currentWeek = [];
        weeklyCounts = new Map<string, number>();
        selectedPapers.forEach(p => weeklyCounts.set(p.code, 0));
      }

      const tasks: TaskPaper[] = [];

      if (!isRest) {
        for (const paper of selectedPapers) {
          const examDate = examDateMap.get(paper.code);
          if (!examDate) continue;
          const daysUntilExam = differenceInDays(parseLocalDate(examDate), date);
          if (daysUntilExam <= 0) continue;

          const count = weeklyCounts.get(paper.code) ?? 0;
          if (count < papersPerWeek) {
            const pastPapers = pastPapersMap[paper.code] ?? [];
            const idx = paperIndex.get(paper.code) ?? 0;

            if (idx < pastPapers.length) {
              const pastPaper = paperOverrides[paper.code] || pastPapers[idx];
              tasks.push({
                paperCode: paper.code,
                paperName: paper.name,
                subjectCode: paper.subjectCode,
                pastPaper,
                completed: false,
                dayOffset: d,
              });
              paperIndex.set(paper.code, idx + 1);
              weeklyCounts.set(paper.code, count + 1);
            }
          }
        }
      }

      currentWeek.push({
        date: dateStr,
        dateLabel: format(date, "MM-dd EEE"),
        isRestDay: isRest,
        isExamDay: isExam,
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
