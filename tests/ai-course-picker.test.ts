import { describe, expect, it } from "vitest";
import { getDisplayCourseCatalog } from "@/course-context/catalog";
import {
  countCoursesBySubject,
  filterCoursePickerCourses,
  getCoursePickerBoardLabel,
  groupCoursePickerCourses,
} from "@/components/ai/coursePickerModel";

const courses = getDisplayCourseCatalog("current");

describe("AI course picker model", () => {
  it("offers every current course instead of truncating the alphabetically first board", () => {
    const visible = filterCoursePickerCourses(courses, { search: "", subjectCategory: "all", board: "", level: "" });
    expect(visible).toHaveLength(courses.length);
    expect(new Set(visible.map((course) => course.boardName))).toEqual(new Set(["AQA", "CAIE", "Edexcel", "Edexcel UK", "OCR", "WJEC/Eduqas"]));
  });

  it("starts from subject categories and can then group one subject by board", () => {
    const categories = countCoursesBySubject(courses);
    expect(categories.slice(0, 5).map((category) => category.id)).toEqual(["mathematics", "physics", "chemistry", "biology", "computer-science"]);
    expect(categories.find((category) => category.id === "mathematics")?.count).toBeGreaterThan(0);
    expect(categories.find((category) => category.id === "biology")?.count).toBeGreaterThan(0);

    const mathematics = filterCoursePickerCourses(courses, { search: "", subjectCategory: "mathematics", board: "", level: "" });
    const groups = groupCoursePickerCourses(mathematics, { subjectCategory: "mathematics", board: "" });
    expect(groups.some((group) => group.label.includes("CAIE"))).toBe(true);
    expect(groups.some((group) => group.label.includes("Pearson"))).toBe(true);
    expect(groups.some((group) => group.label === "AQA")).toBe(true);
  });

  it("combines subject, board and free-text filters without hiding valid later results", () => {
    const result = filterCoursePickerCourses(courses, { search: "9709", subjectCategory: "mathematics", board: "CAIE", level: "A-Level" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ subjectCode: "9709", boardName: "CAIE" });
    expect(getCoursePickerBoardLabel(result[0].boardName)).toContain("Cambridge International");
  });
});
