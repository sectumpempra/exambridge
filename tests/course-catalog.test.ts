import { describe, expect, it } from "vitest";
import { COURSE_CATALOG as GENERATED_CATALOG } from "@/course-context/catalog";
import { COURSE_CATALOG as SOURCE_CATALOG, toCalculatorFeature } from "@/course-context/catalog-source";
import { auditCourseCatalog } from "@/course-context/audit";

describe("course grade calculation capability", () => {
  it("separates official Award routes from unavailable courses", () => {
    for (const [boardName, subjectCode] of [["AQA", "7357"], ["OCR", "H240"], ["CAIE", "9709"]] as const) {
      const entry = SOURCE_CATALOG.find(course => course.boardName === boardName && course.subjectCode === subjectCode);
      expect(entry, `${boardName} ${subjectCode}`).toBeDefined();
      expect(entry?.gradeCalculation.status).toBe("official");
      expect(entry?.capabilities.calculator).toMatchObject({
        status: "available",
        verificationStatus: "verified",
        href: "/calculator",
      });
    }
  });

  it("labels OCR H240 as Mathematics A in the mathematics category", () => {
    const entry = SOURCE_CATALOG.find(course => course.boardName === "OCR" && course.subjectCode === "H240");
    expect(entry).toMatchObject({
      subjectName: "Mathematics A",
      subjectCategory: "mathematics",
      capabilities: { graph: { status: "available", verificationStatus: "verified", href: "/graph" } },
    });
  });

  it("preserves the documented legacy Edexcel WMA award", () => {
    const entry = SOURCE_CATALOG.find(course => course.boardName === "Edexcel" && course.subjectCode === "WMA");
    expect(entry?.gradeCalculation).toEqual({
      status: "official",
      routeIds: ["legacy:edexcel:ial:wma"],
    });
    expect(entry?.calculatorBoardKey).toBe("Edexcel-AL");
  });

  it("does not promote estimated-only capability to verified coverage", () => {
    expect(toCalculatorFeature({
      status: "estimated",
      routeIds: ["award:test"],
      disclaimerRequired: true,
    })).toEqual({
      status: "partial",
      verificationStatus: "unverified",
      href: "/calculator",
      reason: "仅提供明确标注的非官方预估",
    });
  });

  it("persists full grade calculation provenance in the generated catalog", () => {
    const generatedById = new Map(GENERATED_CATALOG.map(entry => [entry.qualificationId, entry]));
    for (const source of SOURCE_CATALOG) {
      const generated = generatedById.get(source.qualificationId);
      expect(generated?.gradeCalculation, source.qualificationId).toEqual(source.gradeCalculation);
      expect(generated?.capabilities.calculator, source.qualificationId).toEqual(source.capabilities.calculator);
      expect(generated?.calculatorBoardKey, source.qualificationId).toBe(source.calculatorBoardKey);
      expect(generated?.lifecycleStatus, source.qualificationId).toBe(source.lifecycleStatus);
      expect(generated?.lifecycleEvidence, source.qualificationId).toBe(source.lifecycleEvidence);
      expect(generated?.lastObservedYear, source.qualificationId).toBe(source.lastObservedYear);
    }
    expect(GENERATED_CATALOG.filter(entry => entry.capabilities.calculator.status === "available"))
      .toHaveLength(5);
  });

  it("rejects unknown official route IDs and verified estimated capabilities", () => {
    const base = structuredClone(SOURCE_CATALOG.find(course => course.boardName === "AQA" && course.subjectCode === "7357")!);
    base.gradeCalculation = { status: "official", routeIds: ["award:missing"] };
    expect(auditCourseCatalog([base]).errors).toContain(`${base.qualificationId}: unknown official Award route award:missing`);

    base.gradeCalculation = { status: "estimated", routeIds: ["award:aqa:7357:linear"], disclaimerRequired: true };
    base.capabilities.calculator = { status: "available", verificationStatus: "verified", href: "/calculator" };
    expect(auditCourseCatalog([base]).errors).toContain(`${base.qualificationId}: estimated calculator must remain partial and unverified`);
  });

  it("reports malformed entries and exact capability drift without throwing", () => {
    const base = structuredClone(SOURCE_CATALOG.find(course => course.boardName === "AQA" && course.subjectCode === "7357")!);
    const malformed = structuredClone(base) as Partial<typeof base>;
    delete malformed.gradeCalculation;
    expect(() => auditCourseCatalog([malformed as typeof base])).not.toThrow();
    expect(auditCourseCatalog([malformed as typeof base]).errors[0]).toMatch(/^entry 0:/);

    base.capabilities.calculator.reason = "漂移的说明";
    expect(auditCourseCatalog([base]).errors).toContain(`${base.qualificationId}: calculator capability does not match grade calculation`);

    const wjec = structuredClone(SOURCE_CATALOG.find(course => course.boardName === "WJEC/Eduqas")!);
    wjec.capabilities.graph = { status: "available", verificationStatus: "verified", href: "/graph" };
    expect(auditCourseCatalog([wjec]).errors).toContain(`${wjec.qualificationId}: WJEC/Eduqas may only expose statistics`);
  });
});
