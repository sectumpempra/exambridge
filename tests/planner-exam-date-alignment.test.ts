import { describe, expect, it } from "vitest";
import {
  canonicalExamComponentCode,
  resolvePlannerGroupExamDate,
} from "../src/data/plannerExamDates";

describe("planner exam dates align with approved exam overviews", () => {
  it("normalizes planner and official component labels to the same key", () => {
    expect(canonicalExamComponentCode("9709/13")).toBe("9709/13");
    expect(canonicalExamComponentCode("4MA1/Mathematics Paper 01H")).toBe("4MA1/1H");
    expect(canonicalExamComponentCode("4MA1 1H")).toBe("4MA1/1H");
    expect(canonicalExamComponentCode("WMA11/Pure Mathematics 1")).toBe("WMA11");
    expect(canonicalExamComponentCode("WMA11 01")).toBe("WMA11");
  });

  it("uses Cambridge Zone 5 overview dates instead of stale variant dates", () => {
    const result = resolvePlannerGroupExamDate("A-Level", "CAIE", [
      { code: "9709/11" },
      { code: "9709/12" },
      { code: "9709/13" },
    ], "2026-07-15");

    expect(result).toMatchObject({
      date: "2026-10-13",
      source: "exam-overview",
      componentCode: "9709/13",
      overviewId: "cambridge-9709",
    });
  });

  it("aligns IGCSE and Pearson unit dates with their overview rows", () => {
    expect(resolvePlannerGroupExamDate("IGCSE", "CAIE", [
      { code: "0580/11" }, { code: "0580/12" }, { code: "0580/13" },
    ], "2026-07-15")).toMatchObject({ date: "2026-10-08", source: "exam-overview" });

    expect(resolvePlannerGroupExamDate("A-Level", "Edexcel", [
      { code: "WMA11/Pure Mathematics 1" },
    ], "2026-07-15")).toMatchObject({ date: "2026-10-09", source: "exam-overview" });
  });

  it("marks uncovered courses as legacy estimates instead of official overview data", () => {
    expect(resolvePlannerGroupExamDate("GCSE", "AQA", [
      { code: "8461/Biology Paper 1" },
    ], "2026-07-15")).toMatchObject({ source: "legacy-timetable" });
  });
});

