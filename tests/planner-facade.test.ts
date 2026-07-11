import { describe, it, expect } from "vitest";
import { planSchedule } from "@/adapters-v2/ui/planner-facade";

describe("Planner Facade v2", () => {
  it("legacy mode: returns null result", () => {
    const output = planSchedule({
      startDate: "2026-01-01",
      timezone: "Asia/Shanghai",
      events: [],
      restWeekdays: [0, 6],
      intensity: "normal",
      maxTasksPerDay: 2,
    });
    expect(output.result).toBeNull();
  });

  it("legacy mode: returns null v2Result", () => {
    const output = planSchedule({
      startDate: "2026-01-01",
      timezone: "Asia/Shanghai",
      events: [],
      restWeekdays: [],
      intensity: "normal",
      maxTasksPerDay: 2,
    });
    expect(output.v2Result).toBeNull();
  });

  it("v2 mode would return PlanResult when flag enabled", () => {
    // Note: actual v2 mode requires VITE_PLANNER_ENGINE=v2 env var
    // In default legacy mode, result is null
    const output = planSchedule({
      startDate: "2026-01-01",
      timezone: "Asia/Shanghai",
      events: [{
        subjectCode: "CAIE-9709",
        paperLabel: "P1",
        paperName: "CAIE-9709 P1",
        examDate: "2026-05-15",
        variants: [{ code: "12", component: "P1" }],
      }],
      restWeekdays: [0, 6],
      intensity: "normal",
      maxTasksPerDay: 2,
    });
    // Legacy mode returns null
    expect(output.result).toBeNull();
  });
});
