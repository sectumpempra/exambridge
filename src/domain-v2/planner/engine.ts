/**
 * Planner Engine v2 — Deterministic Scheduling
 *
 * Pure function. No React, no random, no side effects.
 *
 * Algorithm:
 * 1. Sort sittings by examDate, qualificationId, paperId
 * 2. For each sitting, generate target task count from intensity
 * 3. Enumerate valid days (startDate <= day < examDate, not rest day)
 * 4. Assign tasks using deadline-aware round-robin:
 *    - Pick sitting with earliest exam date + lowest completion ratio
 *    - Assign to lowest-load valid day
 * 5. Round-robin across papers within same qualification
 * 6. Never exceed maxTasksPerDay or rest days
 * 7. Report unscheduled with reasons
 */

import type {
  PlanRequest,
  PlanResult,
  PlannedDay,
  PlannedWeek,
  PlannedTask,
  SittingRef,
  PastPaperRef,
  UnscheduledRequirement,
  PlanExplanation,
} from "./types";

// ── Intensity config ──
const INTENSITY_WEEKLY_TARGET: Record<string, number> = {
  low: 1,
  normal: 2,
  high: 3,
};

/**
 * Main entry point: create a study schedule.
 */
export function planSchedule(request: PlanRequest): PlanResult {
  const warnings: Array<{ code: string; message: string }> = [];
  const unscheduled: UnscheduledRequirement[] = [];

  // ── Step 1: Validate ──
  if (request.maxTasksPerDay < 1) {
    return impossibleResult("INVALID_CONFIGURATION",
      `maxTasksPerDay (${request.maxTasksPerDay}) must be >= 1`);
  }

  if (request.sittings.length === 0) {
    return impossibleResult("INVALID_CONFIGURATION",
      "No sittings provided");
  }

  // ── Step 2: Sort sittings ──
  const sortedSittings = [...request.sittings].sort((a, b) => {
    // Primary: examDate ascending
    if (a.examDate !== b.examDate) return a.examDate.localeCompare(b.examDate);
    // Secondary: qualificationId
    if (a.qualificationId !== b.qualificationId) {
      return a.qualificationId.localeCompare(b.qualificationId);
    }
    // Tertiary: paperId
    if (a.paperId !== b.paperId) return a.paperId.localeCompare(b.paperId);
    // Quaternary: sittingId
    return a.sittingId.localeCompare(b.sittingId);
  });

  // ── Step 3: Compute target tasks per sitting ──
  const weeklyTarget = INTENSITY_WEEKLY_TARGET[request.intensity] ?? 2;

  // Group sittings by qualification
  const qualSittings = new Map<string, SittingRef[]>();
  for (const s of sortedSittings) {
    const arr = qualSittings.get(s.qualificationId) ?? [];
    arr.push(s);
    qualSittings.set(s.qualificationId, arr);
  }

  // Target per sitting = weekly target (distributed across papers)
  const sittingTargets = new Map<string, number>();
  for (const [, sits] of qualSittings) {
    const targetPerSitting = weeklyTarget; // per sitting per week
    for (const s of sits) {
      // Compute available weeks between startDate and examDate
      const weeks = countWeeks(request.startDate, s.examDate);
      const totalTarget = Math.max(1, targetPerSitting * Math.max(1, weeks));
      sittingTargets.set(s.sittingId, totalTarget);
    }
  }

  // ── Step 4: Enumerate valid days for each sitting ──
  const restDaySet = new Set(request.restWeekdays);
  const allDays = generateDayRange(
    request.startDate,
    sortedSittings[sortedSittings.length - 1].examDate
  );

  // Per-sitting valid days
  const sittingValidDays = new Map<string, string[]>();
  for (const s of sortedSittings) {
    const validDays = allDays.filter((day) => {
      // Must be before exam date
      if (day >= s.examDate) return false;
      // Must be on or after start date
      if (day < request.startDate) return false;
      // Not a rest day
      const weekday = getWeekday(day);
      if (restDaySet.has(weekday)) return false;
      // Not exam day (unless allowed)
      if (!request.allowTasksOnExamDay && day === s.examDate) return false;
      return true;
    });
    sittingValidDays.set(s.sittingId, validDays);
  }

  // ── Step 5: Assign tasks ──
  const dayTasks = new Map<string, PlannedTask[]>(); // day -> tasks
  const sittingAssigned = new Map<string, number>(); // sittingId -> count
  const usedPastPapers = new Set<string>(); // dedup
  const paperRRIndex = new Map<string, number>(); // qualification -> round-robin index

  // Initialize
  for (const s of sortedSittings) {
    sittingAssigned.set(s.sittingId, 0);
  }

  // Global day load tracker
  const dayLoad = new Map<string, number>();
  for (const day of allDays) {
    dayLoad.set(day, 0);
  }

  // Build paper pool with overrides
  const paperPool: Record<string, PastPaperRef[]> = {};
  for (const [paperId, papers] of Object.entries(request.pastPaperPool)) {
    const overridePapers = request.overrides?.[paperId];
    paperPool[paperId] = overridePapers ?? papers;
  }

  // Main assignment loop
  let totalIterations = 0;
  const MAX_ITERATIONS = 10000;

  while (totalIterations < MAX_ITERATIONS) {
    totalIterations++;

    // Find sitting with earliest exam date and lowest completion ratio
    let bestSitting: SittingRef | null = null;
    let bestRatio = Infinity;

    for (const s of sortedSittings) {
      const target = sittingTargets.get(s.sittingId) ?? 1;
      const assigned = sittingAssigned.get(s.sittingId) ?? 0;
      if (assigned >= target) continue; // Already met target

      const validDays = sittingValidDays.get(s.sittingId) ?? [];
      if (validDays.length === 0) continue; // No valid days

      // Check if any valid day has capacity
      const hasCapacity = validDays.some((d) => {
        const load = dayLoad.get(d) ?? 0;
        return load < request.maxTasksPerDay;
      });
      if (!hasCapacity) continue;

      const ratio = assigned / target;
      // Tie-break: exam date earlier, then sittingId
      if (ratio < bestRatio || (ratio === bestRatio && bestSitting && s.examDate < bestSitting.examDate)) {
        bestRatio = ratio;
        bestSitting = s;
      }
    }

    if (!bestSitting) break; // All sittings met target or no capacity

    // Get available past papers for this sitting
    const availablePapers = (paperPool[bestSitting.paperId] ?? []).filter(
      (pp) => !usedPastPapers.has(pp.id)
    );

    if (availablePapers.length === 0) {
      // No past papers available — mark as unscheduled and skip
      unscheduled.push({
        reason: "NO_PAST_PAPER_AVAILABLE",
        sittingId: bestSitting.sittingId,
        paperId: bestSitting.paperId,
        qualificationId: bestSitting.qualificationId,
        detail: `No unused past papers for ${bestSitting.paperId}`,
      });
      // Mark as "done" to avoid infinite loop
      sittingTargets.set(bestSitting.sittingId, 0);
      continue;
    }

    // Round-robin: pick next paper for this qualification
    const qualId = bestSitting.qualificationId;
    const rrIdx = paperRRIndex.get(qualId) ?? 0;
    const selectedPaper = availablePapers[rrIdx % availablePapers.length];
    paperRRIndex.set(qualId, rrIdx + 1);

    // Find the lowest-load valid day
    const validDays = sittingValidDays.get(bestSitting.sittingId) ?? [];
    let bestDay: string | null = null;
    let bestLoad = Infinity;

    for (const day of validDays) {
      const load = dayLoad.get(day) ?? 0;
      if (load >= request.maxTasksPerDay) continue;
      if (load < bestLoad) {
        bestLoad = load;
        bestDay = day;
      }
      // Tie-break: earlier day
      if (load === bestLoad && bestDay && day < bestDay) {
        bestDay = day;
      }
    }

    if (!bestDay) {
      // No valid day with capacity
      unscheduled.push({
        reason: "DAILY_CAPACITY_EXHAUSTED",
        sittingId: bestSitting.sittingId,
        paperId: bestSitting.paperId,
        qualificationId: bestSitting.qualificationId,
        detail: `All valid days at capacity for ${bestSitting.paperId}`,
      });
      sittingTargets.set(bestSitting.sittingId, 0);
      continue;
    }

    // Assign task
    const task: PlannedTask = {
      paperId: bestSitting.paperId,
      sittingId: bestSitting.sittingId,
      pastPaperId: selectedPaper.id,
      date: bestDay,
    };

    const dayTaskList = dayTasks.get(bestDay) ?? [];
    dayTaskList.push(task);
    dayTasks.set(bestDay, dayTaskList);

    dayLoad.set(bestDay, (dayLoad.get(bestDay) ?? 0) + 1);
    usedPastPapers.add(selectedPaper.id);
    sittingAssigned.set(bestSitting.sittingId, (sittingAssigned.get(bestSitting.sittingId) ?? 0) + 1);
  }

  // ── Step 6: Check for unmet targets ──
  for (const s of sortedSittings) {
    // Check if startDate >= examDate
    if (request.startDate >= s.examDate) {
      unscheduled.push({
        reason: "EXAM_ALREADY_PASSED",
        sittingId: s.sittingId,
        paperId: s.paperId,
        qualificationId: s.qualificationId,
        detail: `Start date ${request.startDate} is on or after exam date ${s.examDate}`,
      });
      continue;
    }

    const validDays = sittingValidDays.get(s.sittingId) ?? [];
    if (validDays.length === 0 && request.startDate < s.examDate) {
      unscheduled.push({
        reason: "NO_AVAILABLE_DAY",
        sittingId: s.sittingId,
        paperId: s.paperId,
        qualificationId: s.qualificationId,
        detail: `No valid days between ${request.startDate} and ${s.examDate} (rest days cover all)`,
      });
    }
  }

  // ── Step 7: Build output ──
  // Build days (only days with tasks)
  const taskDays = Array.from(dayTasks.keys()).sort();
  const days: PlannedDay[] = taskDays.map((date) => ({
    date,
    tasks: dayTasks.get(date) ?? [],
  }));

  // Build weeks (Monday start)
  const weeks = buildWeeks(days, request.startDate);

  const scheduledTaskCount = days.reduce((sum, d) => sum + d.tasks.length, 0);

  // Determine status
  let status: PlanResult["status"] = "SUCCESS";
  if (unscheduled.length > 0) {
    status = scheduledTaskCount > 0 ? "PARTIAL" : "IMPOSSIBLE";
  }

  // Build explanation
  const explanation = buildExplanation(
    sortedSittings,
    qualSittings,
    sittingAssigned,
    weeklyTarget,
    scheduledTaskCount,
    unscheduled.length,
    request
  );

  return {
    status,
    days,
    weeks,
    scheduledTaskCount,
    unscheduled,
    warnings,
    explanation,
  };
}

// ── Date utilities (string-based, no UTC) ──

/** Count full weeks between two dates (inclusive start, exclusive end). */
function countWeeks(startDate: string, endDate: string): number {
  const days = dayDiff(startDate, endDate);
  return Math.max(1, Math.floor(days / 7));
}

/** Day difference (end - start) in days. */
function dayDiff(start: string, end: string): number {
  const s = parseDateParts(start);
  const e = parseDateParts(end);
  const sDays = s.year * 365 + s.month * 31 + s.day;
  const eDays = e.year * 365 + e.month * 31 + e.day;
  return eDays - sDays;
}

function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split("-");
  return {
    year: parseInt(parts[0]),
    month: parseInt(parts[1]),
    day: parseInt(parts[2]),
  };
}

/** Generate all days in range [start, end] inclusive. */
function generateDayRange(start: string, end: string): string[] {
  const days: string[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addOneDay(current);
  }
  return days;
}

/** Add one day to a YYYY-MM-DD string. */
function addOneDay(dateStr: string): string {
  const { year, month, day } = parseDateParts(dateStr);
  const d = new Date(year, month - 1, day + 1);
  return formatDate(d);
}

/** Format Date to YYYY-MM-DD. */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Get weekday (0=Sunday, 1=Monday, ...) for a YYYY-MM-DD string. */
function getWeekday(dateStr: string): number {
  const { year, month, day } = parseDateParts(dateStr);
  return new Date(year, month - 1, day).getDay();
}

// ── Week builder ──

function buildWeeks(days: PlannedDay[], startDate: string): PlannedWeek[] {
  if (days.length === 0) return [];

  const weeks: PlannedWeek[] = [];
  let currentWeek: PlannedDay[] = [];
  let weekNum = 1;

  // Find the Monday of the week containing startDate
  const { year, month, day } = parseDateParts(startDate);
  const startD = new Date(year, month - 1, day);
  const startWeekday = startD.getDay(); // 0=Sun, 1=Mon
  const mondayOffset = startWeekday === 0 ? -6 : 1 - startWeekday;
  const firstMonday = new Date(year, month - 1, day + mondayOffset);

  // Group days into weeks
  for (const day of days) {
    const dp = parseDateParts(day.date);
    const d = new Date(dp.year, dp.month - 1, dp.day);

    // Compute week number relative to first Monday
    const daysSinceMonday = Math.floor((d.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000));
    const currentWeekNum = Math.floor(daysSinceMonday / 7) + 1;

    if (currentWeekNum !== weekNum && currentWeek.length > 0) {
      weeks.push({
        weekNum,
        weekLabel: formatWeekLabel(firstMonday, weekNum),
        days: currentWeek,
      });
      currentWeek = [];
      weekNum = currentWeekNum;
    }
    currentWeek.push(day);
  }

  if (currentWeek.length > 0) {
    weeks.push({
      weekNum,
      weekLabel: formatWeekLabel(firstMonday, weekNum),
      days: currentWeek,
    });
  }

  return weeks;
}

function formatWeekLabel(firstMonday: Date, weekNum: number): string {
  const weekStart = new Date(firstMonday.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  return `Week ${weekNum} (${fmt(weekStart)}–${fmt(weekEnd)})`;
}

// ── Explanation builder ──

function buildExplanation(
  sittings: SittingRef[],
  qualSittings: Map<string, SittingRef[]>,
  sittingAssigned: Map<string, number>,
  weeklyTarget: number,
  scheduledCount: number,
  unscheduledCount: number,
  request: PlanRequest
): PlanExplanation[] {
  const sections: PlanExplanation[] = [];

  sections.push({
    section: "计划概览",
    details: [
      `开始日期: ${request.startDate}`,
      `强度: ${request.intensity} (每周每科目 ${weeklyTarget} 套)`,
      `每日上限: ${request.maxTasksPerDay} 套`,
      `休息日: ${request.restWeekdays.length > 0 ? request.restWeekdays.map((d) => ["日", "一", "二", "三", "四", "五", "六"][d]).join(", ") : "无"}`,
      `目标 sitting: ${sittings.length} 个`,
    ],
  });

  for (const [qualId, sits] of qualSittings) {
    const totalAssigned = sits.reduce((sum, s) => sum + (sittingAssigned.get(s.sittingId) ?? 0), 0);
    const totalTarget = sits.length * weeklyTarget;
    sections.push({
      section: `科目: ${qualId}`,
      details: [
        `Papers: ${sits.length} 个`,
        `已安排: ${totalAssigned} 套 (目标 ${totalTarget} 套)`,
        `最早考试: ${sits[0]?.examDate ?? "N/A"}`,
      ],
    });
  }

  sections.push({
    section: "统计",
    details: [
      `已安排: ${scheduledCount} 套`,
      `未安排: ${unscheduledCount} 项`,
      `状态: ${unscheduledCount === 0 ? "全部完成" : unscheduledCount > 0 && scheduledCount > 0 ? "部分完成" : "无法安排"}`,
    ],
  });

  return sections;
}

// ── Error helpers ──

function impossibleResult(code: string, message: string): PlanResult {
  return {
    status: "IMPOSSIBLE",
    days: [],
    weeks: [],
    scheduledTaskCount: 0,
    unscheduled: [{
      reason: "INVALID_CONFIGURATION",
      sittingId: "",
      paperId: "",
      qualificationId: "",
      detail: `[${code}] ${message}`,
    }],
    warnings: [],
    explanation: [{
      section: "错误",
      details: [`[${code}] ${message}`],
    }],
  };
}
