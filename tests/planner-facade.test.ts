import { afterEach, describe, it, expect, vi } from "vitest";
import { planSchedule } from "@/adapters-v2/ui/planner-facade";

describe("Planner Facade v2", () => {
  afterEach(() => vi.unstubAllEnvs());
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

  it("v2 mode does not synthesize historical papers when no audited pool is supplied", () => {
    vi.stubEnv("VITE_PLANNER_ENGINE", "v2");
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
    expect(output.result).not.toBeNull();
    expect(output.v2Result).toBe(output.result);
    expect(output.result?.scheduledTaskCount).toBe(0);
    expect(output.result?.unscheduled.some((item) => item.reason === "NO_PAST_PAPER_AVAILABLE")).toBe(true);
  });

  it("uses a supplied past-paper pool without synthesizing replacements", () => {
    vi.stubEnv("VITE_PLANNER_ENGINE", "v2");
    const paperId = "paper:caie:9709:p1";
    const output = planSchedule({
      startDate: "2026-01-01", timezone: "Asia/Shanghai",
      events: [{ subjectCode: "CAIE-9709", paperLabel: "P1", paperName: "P1", examDate: "2026-05-15", variants: [] }],
      restWeekdays: [], intensity: "low", maxTasksPerDay: 1,
      pastPaperPool: { [paperId]: [{ id: "official-paper", paperId, series: "2025-june", year: "2025" }] },
    });
    expect(output.result?.scheduledTaskCount).toBe(1);
    expect(output.result?.days.flatMap((day) => day.tasks).map((task) => task.pastPaperId)).toEqual(["official-paper"]);
  });
});
