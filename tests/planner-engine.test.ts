import { describe, it, expect } from "vitest";
import { planSchedule } from "@/domain-v2/planner/engine";
import type { PlanRequest, SittingRef, PastPaperRef } from "@/domain-v2/planner/types";

// ── Helpers ──

function makeSitting(overrides: Partial<SittingRef> & { sittingId: string; examDate: string }): SittingRef {
  return {
    qualificationId: "qual:caie:al:9709",
    paperId: "paper:caie:9709:p1",
    series: "2025-june",
    ...overrides,
  };
}

function makePaperPool(paperId: string, count: number): PastPaperRef[] {
  const papers: PastPaperRef[] = [];
  for (let i = 0; i < count; i++) {
    papers.push({
      id: `pp:${paperId}:202${i}-june`,
      paperId,
      series: `202${i}-june`,
      year: `202${i}`,
    });
  }
  return papers;
}

function makeRequest(overrides: Partial<PlanRequest> = {}): PlanRequest {
  const paperId = "paper:caie:9709:p1";
  return {
    startDate: "2025-01-01",
    timezone: "Asia/Shanghai",
    sittings: [
      makeSitting({ sittingId: "s1", examDate: "2025-05-15", paperId }),
    ],
    restWeekdays: [0, 6], // Sun, Sat
    intensity: "normal",
    maxTasksPerDay: 2,
    pastPaperPool: {
      [paperId]: makePaperPool(paperId, 5),
    },
    ...overrides,
  };
}

describe("Planner Engine v2", () => {
  // ── Basic functionality ──

  it("schedules tasks for a single sitting with enough papers", () => {
    const result = planSchedule(makeRequest());
    // Status may be SUCCESS or PARTIAL depending on target calculations
    expect(result.scheduledTaskCount).toBeGreaterThan(0);
  });

  it("assigns tasks before exam date", () => {
    const result = planSchedule(makeRequest());
    for (const day of result.days) {
      for (const _task of day.tasks) {
        void _task;
        expect(day.date < "2025-05-15").toBe(true);
      }
    }
  });

  it("does not assign tasks on rest days", () => {
    const result = planSchedule(makeRequest({ restWeekdays: [0, 6] }));
    for (const day of result.days) {
      const weekday = new Date(day.date + "T00:00:00").getDay();
      expect(weekday).not.toBe(0); // Sunday
      expect(weekday).not.toBe(6); // Saturday
    }
  });

  it("does not exceed maxTasksPerDay", () => {
    const result = planSchedule(makeRequest({ maxTasksPerDay: 2 }));
    for (const day of result.days) {
      expect(day.tasks.length).toBeLessThanOrEqual(2);
    }
  });

  it("does not exceed maxTasksPerDay=1", () => {
    const result = planSchedule(makeRequest({ maxTasksPerDay: 1 }));
    for (const day of result.days) {
      expect(day.tasks.length).toBeLessThanOrEqual(1);
    }
  });

  it("does not reuse past papers", () => {
    const paperId = "paper:caie:9709:p1";
    const result = planSchedule(makeRequest({
      pastPaperPool: { [paperId]: makePaperPool(paperId, 3) },
      maxTasksPerDay: 10,
    }));

    const usedIds = new Set<string>();
    for (const day of result.days) {
      for (const task of day.tasks) {
        expect(usedIds.has(task.pastPaperId)).toBe(false);
        usedIds.add(task.pastPaperId);
      }
    }
  });

  // ── Determinism ──

  it("produces identical output for identical input", () => {
    const req = makeRequest();
    const r1 = planSchedule(req);
    const r2 = planSchedule(req);
    expect(r1).toEqual(r2);
  });

  // ── Edge cases ──

  it("returns IMPOSSIBLE for maxTasksPerDay < 1", () => {
    const result = planSchedule(makeRequest({ maxTasksPerDay: 0 }));
    expect(result.status).toBe("IMPOSSIBLE");
  });

  it("returns IMPOSSIBLE for empty sittings", () => {
    const result = planSchedule(makeRequest({ sittings: [] }));
    expect(result.status).toBe("IMPOSSIBLE");
  });

  it("returns IMPOSSIBLE when startDate >= examDate", () => {
    const result = planSchedule(makeRequest({
      startDate: "2025-05-15",
      sittings: [makeSitting({ sittingId: "s1", examDate: "2025-05-15" })],
    }));
    expect(result.status).toBe("IMPOSSIBLE");
  });

  it("returns IMPOSSIBLE when all days are rest days", () => {
    const result = planSchedule(makeRequest({
      restWeekdays: [0, 1, 2, 3, 4, 5, 6], // All days
    }));
    expect(result.status).toBe("IMPOSSIBLE");
  });

  it("handles no past papers available", () => {
    const result = planSchedule(makeRequest({
      pastPaperPool: {},
    }));
    expect(result.unscheduled.length).toBeGreaterThan(0);
    expect(result.unscheduled[0].reason).toBe("NO_PAST_PAPER_AVAILABLE");
  });

  // ── Multi-sitting ──

  it("schedules multiple sittings for different papers", () => {
    const p1 = "paper:caie:9709:p1";
    const p3 = "paper:caie:9709:p3";
    const result = planSchedule(makeRequest({
      sittings: [
        makeSitting({ sittingId: "s1", examDate: "2025-05-15", paperId: p1, qualificationId: "qual:caie:al:9709" }),
        makeSitting({ sittingId: "s2", examDate: "2025-05-20", paperId: p3, qualificationId: "qual:caie:al:9709" }),
      ],
      pastPaperPool: {
        [p1]: makePaperPool(p1, 5),
        [p3]: makePaperPool(p3, 5),
      },
    }));

    expect(result.scheduledTaskCount).toBeGreaterThan(0);
  });

  it("round-robins across papers in same qualification", () => {
    const p1 = "paper:caie:9709:p1";
    const p3 = "paper:caie:9709:p3";
    const result = planSchedule(makeRequest({
      startDate: "2025-01-01",
      sittings: [
        makeSitting({ sittingId: "s1", examDate: "2025-06-01", paperId: p1, qualificationId: "qual:caie:al:9709" }),
        makeSitting({ sittingId: "s2", examDate: "2025-06-01", paperId: p3, qualificationId: "qual:caie:al:9709" }),
      ],
      pastPaperPool: {
        [p1]: makePaperPool(p1, 10),
        [p3]: makePaperPool(p3, 10),
      },
      maxTasksPerDay: 10,
      intensity: "high",
    }));

    // Both papers should have tasks assigned
    const p1Tasks = result.days.flatMap((d) => d.tasks.filter((t) => t.paperId === p1));
    const p3Tasks = result.days.flatMap((d) => d.tasks.filter((t) => t.paperId === p3));
    expect(p1Tasks.length).toBeGreaterThan(0);
    expect(p3Tasks.length).toBeGreaterThan(0);
  });

  it("handles two exams on the same day", () => {
    const p1 = "paper:caie:9709:p1";
    const p3 = "paper:caie:9709:p3";
    const result = planSchedule(makeRequest({
      sittings: [
        makeSitting({ sittingId: "s1", examDate: "2025-05-15", paperId: p1 }),
        makeSitting({ sittingId: "s2", examDate: "2025-05-15", paperId: p3 }),
      ],
      pastPaperPool: {
        [p1]: makePaperPool(p1, 5),
        [p3]: makePaperPool(p3, 5),
      },
    }));

    expect(result.scheduledTaskCount).toBeGreaterThan(0);
    // Both should have tasks
    const hasP1 = result.days.some((d) => d.tasks.some((t) => t.paperId === p1));
    const hasP3 = result.days.some((d) => d.tasks.some((t) => t.paperId === p3));
    expect(hasP1).toBe(true);
    expect(hasP3).toBe(true);
  });

  // ── Intensity levels ──

  it("low intensity schedules fewer tasks than high", () => {
    const paperId = "paper:caie:9709:p1";
    const low = planSchedule(makeRequest({
      intensity: "low",
      pastPaperPool: { [paperId]: makePaperPool(paperId, 20) },
      maxTasksPerDay: 10,
    }));
    const high = planSchedule(makeRequest({
      intensity: "high",
      pastPaperPool: { [paperId]: makePaperPool(paperId, 20) },
      maxTasksPerDay: 10,
    }));
    expect(high.scheduledTaskCount).toBeGreaterThan(low.scheduledTaskCount);
  });

  // ── Week structure ──

  it("groups days into weeks", () => {
    const result = planSchedule(makeRequest());
    expect(result.weeks.length).toBeGreaterThan(0);
    for (const week of result.weeks) {
      expect(week.weekNum).toBeGreaterThan(0);
      expect(week.days.length).toBeGreaterThan(0);
    }
  });

  // ── Explanation ──

  it("includes explanation sections", () => {
    const result = planSchedule(makeRequest());
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.explanation[0].section).toBe("计划概览");
  });

  // ── Cross-month scheduling ──

  it("handles scheduling across month boundary", () => {
    const result = planSchedule(makeRequest({
      startDate: "2025-03-28",
      sittings: [makeSitting({ sittingId: "s1", examDate: "2025-04-10" })],
    }));
    expect(result.status).toBe("SUCCESS");
  });

  // ── Unscheduled reporting ──

  it("reports EXAM_ALREADY_PASSED when startDate >= examDate", () => {
    const result = planSchedule(makeRequest({
      startDate: "2025-06-01",
      sittings: [makeSitting({ sittingId: "s1", examDate: "2025-05-15" })],
    }));
    expect(result.unscheduled.some((u) => u.reason === "EXAM_ALREADY_PASSED")).toBe(true);
  });

  it("has no tasks after exam date", () => {
    const result = planSchedule(makeRequest({
      sittings: [makeSitting({ sittingId: "s1", examDate: "2025-03-01" })],
    }));
    for (const day of result.days) {
      expect(day.date < "2025-03-01").toBe(true);
    }
  });
});
