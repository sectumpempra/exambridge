/**
 * Planner Facade v2 — 空壳 (Phase 0)
 *
 * 在 Phase 3 中实现。
 * 当前仅提供类型定义，不改变现有 Planner 行为。
 */

export interface PlannerFacadeInput {
  startDate: string;
  timezone: string;
  selectedSittingIds: string[];
  restWeekdays: number[];
  intensity: "low" | "normal" | "high";
  maxTasksPerDay: number;
}

export interface PlannerFacadeOutput {
  status: "SUCCESS" | "PARTIAL" | "IMPOSSIBLE";
  days: PlannedDay[];
  unscheduled: Array<{ reason: string; count: number }>;
}

export interface PlannedDay {
  date: string;
  tasks: PlannedTask[];
}

export interface PlannedTask {
  paperId: string;
  sittingId: string;
  series: string;
}

/**
 * Phase 0 空壳: 返回 IMPOSSIBLE，提醒调用者尚未实现。
 */
export function planSchedule(_input: PlannerFacadeInput): PlannerFacadeOutput {
  void _input; // will be used in Phase 3
  return {
    status: "IMPOSSIBLE",
    days: [],
    unscheduled: [{ reason: "V2_PLANNER_NOT_YET_IMPLEMENTED", count: 0 }],
  };
}
