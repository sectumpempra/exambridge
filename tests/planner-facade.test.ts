import { describe, it, expect } from "vitest";
import { planSchedule } from "@/adapters-v2/ui/planner-facade";

describe("Planner Facade v2 (Phase 0 stub)", () => {
  it("returns IMPOSSIBLE status", () => {
    const result = planSchedule({
      startDate: "2026-01-01",
      timezone: "Asia/Shanghai",
      selectedSittingIds: [],
      restWeekdays: [0, 6], // Sun, Sat
      intensity: "normal",
      maxTasksPerDay: 2,
    });
    expect(result.status).toBe("IMPOSSIBLE");
  });

  it("returns empty days", () => {
    const result = planSchedule({
      startDate: "2026-01-01",
      timezone: "Asia/Shanghai",
      selectedSittingIds: [],
      restWeekdays: [],
      intensity: "normal",
      maxTasksPerDay: 2,
    });
    expect(result.days).toEqual([]);
  });

  it("returns unscheduled with NOT_YET_IMPLEMENTED reason", () => {
    const result = planSchedule({
      startDate: "2026-01-01",
      timezone: "Asia/Shanghai",
      selectedSittingIds: [],
      restWeekdays: [],
      intensity: "normal",
      maxTasksPerDay: 2,
    });
    expect(result.unscheduled.length).toBeGreaterThan(0);
    expect(result.unscheduled[0].reason).toContain("NOT_YET_IMPLEMENTED");
  });
});
