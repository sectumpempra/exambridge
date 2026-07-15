import { describe, expect, it } from "vitest";
import { auditCourseCatalog } from "../src/course-context/audit";
import { COURSE_CATALOG, createCourseContext, getCourseEntry, getDisplayCourseCatalog, withCourseContext } from "../src/course-context/catalog";
import { buildStoredContext, parseContextFromSearch, readStoredContext } from "../src/course-context/storage";

describe("course catalog", () => {
  it("is schema-valid, unique and capability-consistent", () => {
    const result = auditCourseCatalog(COURSE_CATALOG);
    expect(result.entries).toBeGreaterThan(50);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("keeps WJEC/Eduqas boundaries unavailable", () => {
    const wjec = COURSE_CATALOG.filter((entry) => entry.boardName === "WJEC/Eduqas");
    expect(wjec.length).toBeGreaterThan(0);
    expect(wjec.every((entry) => Object.entries(entry.capabilities).every(([feature, availability]) => feature === "statistics" || availability.status === "unavailable"))).toBe(true);
  });

  it("only exposes verified official calculator awards", () => {
    const available = COURSE_CATALOG.filter((entry) => entry.capabilities.calculator.status === "available");
    expect(available).toHaveLength(4);
    expect(available.map(entry => `${entry.boardName}:${entry.subjectCode}`)).toEqual([
      "AQA:7357", "CAIE:9709", "Edexcel:WMA", "OCR:H240",
    ]);
    expect(available.every(entry => entry.capabilities.calculator.verificationStatus === "verified")).toBe(true);
  });

  it("normalizes internal AQA prefixes into readable subject names", () => {
    const accounting = COURSE_CATALOG.find((entry) => entry.boardName === "AQA" && entry.level === "A-Level" && entry.subjectCode === "AC");
    expect(accounting).toMatchObject({ subjectName: "Accounting", subjectCategory: "accounting" });
    expect(COURSE_CATALOG.find((entry) => entry.boardName === "AQA" && entry.subjectCode === "MA")).toMatchObject({ subjectName: "Mathematics", subjectCategory: "mathematics" });
    expect(COURSE_CATALOG.find((entry) => entry.boardName === "AQA" && entry.subjectCode === "PH")).toMatchObject({ subjectName: "Physics", subjectCategory: "physics" });
    expect(COURSE_CATALOG.find((entry) => entry.boardName === "AQA" && entry.subjectCode === "CH")).toMatchObject({ subjectName: "Chemistry", subjectCategory: "chemistry" });
  });

  it("keeps current qualifications ahead of archived aliases and old codes", () => {
    expect(COURSE_CATALOG.find((entry) => entry.boardName === "AQA" && entry.subjectCode === "7127")).toMatchObject({ lifecycleStatus: "current", subjectName: "Accounting" });
    expect(COURSE_CATALOG.find((entry) => entry.boardName === "AQA" && entry.subjectCode === "2121")?.lifecycleStatus).toBe("historical");
    expect(COURSE_CATALOG.find((entry) => entry.boardName === "AQA" && entry.subjectCode === "AC")?.lifecycleStatus).toBe("historical");
    expect(getDisplayCourseCatalog("current").length).toBeGreaterThan(400);
    expect(getDisplayCourseCatalog("historical").length).toBeGreaterThan(200);
  });

  it("assigns every course to an audited subject category", () => {
    const categories = new Set(COURSE_CATALOG.map((entry) => entry.subjectCategory));
    expect(categories).toEqual(new Set(["mathematics", "physics", "chemistry", "biology", "computer-science", "economics", "accounting", "humanities", "languages", "creative", "other"]));
  });

  it("does not classify physical education as physics from its subject code", () => {
    const physicalEducation = COURSE_CATALOG.filter((entry) => /physical education/i.test(entry.subjectName));
    expect(physicalEducation.length).toBeGreaterThan(0);
    expect(physicalEducation.every((entry) => entry.subjectCategory === "other")).toBe(true);
  });
});

describe("course context URL and storage", () => {
  const course = COURSE_CATALOG[0];
  const context = createCourseContext(course);

  it("round-trips a valid share URL", () => {
    const href = withCourseContext("/papers?series=june", context);
    const search = href.slice(href.indexOf("?"));
    expect(parseContextFromSearch(search)).toEqual(context);
    expect(href).toContain("series=june");
  });

  it("rejects unknown and mismatched identifiers without guessing", () => {
    expect(parseContextFromSearch("?course=qual%3Aunknown")).toBeNull();
    expect(getCourseEntry({ ...context, specificationId: "spec:wrong" })).toBeUndefined();
  });

  it("keeps only five deduplicated recent courses", () => {
    let stored = buildStoredContext(context, null);
    for (const entry of COURSE_CATALOG.slice(1, 8)) stored = buildStoredContext(createCourseContext(entry), stored);
    expect(stored.recent).toHaveLength(5);
    expect(new Set(stored.recent.map((item) => item.qualificationId)).size).toBe(5);
  });

  it("ignores corrupt values and migrates the private v0 shape", () => {
    expect(readStoredContext({ getItem: () => "not-json" })).toBeNull();
    expect(readStoredContext({ getItem: () => JSON.stringify({ version: 0, current: context }) })).toEqual({ version: 1, current: context, recent: [context] });
  });
});
