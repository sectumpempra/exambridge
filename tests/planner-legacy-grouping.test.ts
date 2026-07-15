import { describe, expect, it } from "vitest";
import { buildExamEvents } from "../src/hooks/usePlanner";

describe("legacy planner qualification grouping", () => {
  it("groups Edexcel IAL Mathematics units under one qualification", () => {
    const groups = ["WMA11", "WMA12", "WMA13", "WMA14"].map((subjectCode) => ({
      subjectCode,
      paperLabel: subjectCode,
      board: "Edexcel",
      level: "A-Level",
      variants: [{ code: subjectCode, component: "01" }],
    }));

    const events = buildExamEvents(groups, () => "2027-06-01");
    expect(new Set(events.map((event) => event.qualificationId))).toEqual(new Set(["Edexcel-IAL-YMA01"]));
  });

  it("keeps unrelated qualifications separate", () => {
    const groups = [
      { subjectCode: "9709", paperLabel: "P1", board: "CAIE", level: "A-Level", variants: [{ code: "9709/12", component: "12" }] },
      { subjectCode: "9231", paperLabel: "P1", board: "CAIE", level: "A-Level", variants: [{ code: "9231/12", component: "12" }] },
    ];
    const events = buildExamEvents(groups, () => "2027-06-01");
    expect(new Set(events.map((event) => event.qualificationId)).size).toBe(2);
  });
});
