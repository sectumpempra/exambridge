import { describe, expect, it } from "vitest";
import { buildPlannerResult, type ExamEvent, type PlannerConfigV2, type PracticePaperOption } from "@/hooks/usePlanner";
import { parsePlannerConfig } from "@/utils/shareCode";

const event = (id: string, paperName: string): ExamEvent => ({
  paperGroupId: id, board: "CAIE", level: "A-Level", subjectCode: "9709", qualificationId: "CAIE-A-Level-9709",
  paperLabel: paperName, paperName, examDate: "2026-08-20", variants: [{ code: paperName, component: paperName }],
});
const materials = (prefix: string): PracticePaperOption[] => Array.from({ length: 10 }, (_, index) => ({
  id: `${prefix}-${index}`, title: `${prefix} set ${index + 1}`, accessStatus: "public",
}));

describe("planner v2 per-Paper scheduling", () => {
  it("honours independent weekly quotas and rest days", () => {
    const config: PlannerConfigV2 = {
      version: 2, startDate: "2026-07-20", restDays: [0], maxTasksPerDay: 3,
      events: [event("p1", "9709 P1"), event("p3", "9709 P3")],
      paperPlans: [
        { paperGroupId: "p1", enabled: true, targetSetsPerWeek: 1, priority: "low", mode: "untimed" },
        { paperGroupId: "p3", enabled: true, targetSetsPerWeek: 3, priority: "high", mode: "timed", durationMinutes: 110, reviewMinutes: 20 },
      ],
    };
    const result = buildPlannerResult(config, { "9709 P1": materials("p1"), "9709 P3": materials("p3") });
    const firstWeek = result.weeks[0].days.flatMap((day) => day.papers);
    expect(firstWeek.filter((task) => task.paperName === "9709 P1")).toHaveLength(1);
    expect(firstWeek.filter((task) => task.paperName === "9709 P3")).toHaveLength(3);
    expect(result.weeks[0].days.find((day) => day.date === "2026-07-26")?.papers).toHaveLength(0);
    expect(firstWeek.find((task) => task.paperName === "9709 P3")).toMatchObject({ mode: "timed", durationMinutes: 110, reviewMinutes: 20 });
  });

  it("does not create virtual tasks when verified materials are absent", () => {
    const config: PlannerConfigV2 = {
      version: 2, startDate: "2026-07-20", restDays: [], maxTasksPerDay: 3,
      events: [event("p1", "9709 P1")],
      paperPlans: [{ paperGroupId: "p1", enabled: true, targetSetsPerWeek: 7, priority: "high", mode: "timed" }],
    };
    expect(buildPlannerResult(config, { "9709 P1": [] }).totalTasks).toBe(0);
  });

  it("rejects invalid, oversized or internally inconsistent shared configs", () => {
    const valid = {
      version: 2, startDate: "2026-07-20", restDays: [0], maxTasksPerDay: 3,
      events: [event("p1", "9709 P1")],
      paperPlans: [{ paperGroupId: "p1", enabled: true, targetSetsPerWeek: 2, priority: "normal", mode: "timed" }],
    };
    expect(parsePlannerConfig(valid)?.version).toBe(2);
    expect(parsePlannerConfig({ ...valid, restDays: [9] })).toBeNull();
    expect(parsePlannerConfig({ ...valid, paperPlans: [{ ...valid.paperPlans[0], targetSetsPerWeek: 99 }] })).toBeNull();
    expect(parsePlannerConfig({ ...valid, paperPlans: [{ ...valid.paperPlans[0], paperGroupId: "missing" }] })).toBeNull();
    expect(parsePlannerConfig({ ...valid, events: Array.from({ length: 101 }, () => valid.events[0]) })).toBeNull();
  });
});
