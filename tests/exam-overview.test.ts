import { describe, expect, it } from "vitest";
import { COURSE_CATALOG } from "../src/course-context/catalog";
import {
  EXAM_OVERVIEW_CATALOG,
  ExamOverviewSchema,
  diffExamOverview,
  examOverviewIdForCourse,
  type ExamOverviewCandidate,
} from "../src/domain-v2/exam-overview";
import { explainCalculatorRestriction, isCalculatorRuleNote, mentionsCasRule } from "../src/domain-v2/exam-overview/calculator-language";

describe("exam overview catalog", () => {
  it("contains fifty schema-valid, human-approved course groups", () => {
    expect(EXAM_OVERVIEW_CATALOG).toHaveLength(50);
    for (const overview of EXAM_OVERVIEW_CATALOG) {
      expect(ExamOverviewSchema.safeParse(overview).success).toBe(true);
      expect(overview.release.status).toBe("approved");
      expect(overview.materials.some((item) => item.type === "syllabus")).toBe(true);
      if (overview.formula.supplied) {
        expect(overview.materials.some((item) => ["formula", "data-booklet", "periodic-table", "reference-document"].includes(item.type))).toBe(true);
      }
      expect(overview.upcomingExams[0].date).toBe(overview.nextExam.date);
      for (const material of overview.materials) {
        expect(material.previewUrl).toMatch(/^\/exam-materials\/.+\.pdf(?:#page=\d+)?$/);
        expect(material.officialUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it("maps the supported catalog aliases to fifty overview groups", () => {
    const available = COURSE_CATALOG.filter((entry) => entry.capabilities.examOverview.status === "available");
    expect(new Set(available.map(examOverviewIdForCourse))).toEqual(new Set([
      "cambridge-9709", "cambridge-0580", "cambridge-0606", "cambridge-0607", "cambridge-9231",
      "cambridge-0610", "cambridge-0620", "cambridge-0625", "cambridge-0478",
      "cambridge-9700", "cambridge-9701", "cambridge-9702", "cambridge-9618",
      "cambridge-0455", "cambridge-0450", "cambridge-0452", "cambridge-9708", "cambridge-9609", "cambridge-9706",
      "pearson-4ma1", "pearson-4pm1", "pearson-4mb1", "pearson-ial-mathematics",
      "pearson-ial-further-mathematics", "pearson-ial-pure-mathematics",
      "pearson-igcse-4bi1", "pearson-igcse-4ch1", "pearson-igcse-4ph1", "pearson-igcse-4cp0",
      "pearson-ial-biology", "pearson-ial-chemistry", "pearson-ial-physics",
      "pearson-igcse-4ec1", "pearson-igcse-4bs1", "pearson-igcse-4ac1",
      "pearson-ial-economics", "pearson-ial-business", "pearson-ial-accounting",
      "aqa-8300", "aqa-8365", "aqa-7357", "aqa-7367",
      "pearson-uk-1ma1", "pearson-uk-7m20", "pearson-uk-9ma0", "pearson-uk-9fm0",
      "ocr-j560", "ocr-6993", "ocr-h240", "ocr-h245",
    ]));
    expect(available.every((entry) => entry.capabilities.examOverview.href === "/exam-overview")).toBe(true);
  });

  it("has resolved boundary and highest-grade chart coverage for all 50 approved overview groups", () => {
    const coverage = EXAM_OVERVIEW_CATALOG.map((overview) => {
      const aliases = COURSE_CATALOG.filter((entry) => examOverviewIdForCourse(entry) === overview.id);
      return {
        id: overview.id,
        available: aliases.some((entry) => entry.capabilities.statistics.status !== "unavailable"),
        boundaries: aliases.some((entry) => entry.capabilities.boundaries.status !== "unavailable"),
      };
    });
    expect(coverage.filter((item) => !item.available).map((item) => item.id)).toEqual([]);
    expect(coverage.filter((item) => !item.boundaries).map((item) => item.id)).toEqual([]);
    expect(coverage.filter((item) => item.available)).toHaveLength(50);
  });

  it("explains CAS restrictions in candidate-facing language", () => {
    expect(explainCalculatorRestriction("代数计算器")).toContain("CAS（计算机代数系统）");
    expect(explainCalculatorRestriction("图形计算器")).toContain("绘制函数图像");
    expect(mentionsCasRule(["符号代数、微分或积分"])).toBe(true);
    expect(isCalculatorRuleNote("以当届题面及 Pearson 通用考试规则为准")).toBe(true);
  });

  it("keeps Pearson sessions as official labels without invented clock times", () => {
    const pearson = EXAM_OVERVIEW_CATALOG.filter((item) => item.board === "Pearson Edexcel");
    expect(pearson.flatMap((item) => item.upcomingExams).every((exam) => ["Morning", "Afternoon"].includes(exam.session) || exam.session.startsWith("Window"))).toBe(true);
    expect(pearson.flatMap((item) => item.upcomingExams).every((exam) => !/\d{1,2}:\d{2}/.test(exam.session))).toBe(true);
  });

  it("keeps UK mathematics routes and year-specific formula windows explicit", () => {
    const pearsonFurther = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-uk-9fm0");
    expect(pearsonFurther?.routes).toHaveLength(10);
    expect(pearsonFurther?.paperCount).toContain("4");

    const pearsonMathematics = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-uk-9ma0");
    expect(pearsonMathematics?.components.find((item) => item.code === "9MA0/03")?.note).toContain("Large Data Set");
    expect(pearsonMathematics?.materials.some((item) => item.id === "9ma0-large-data-set" && item.type === "data-booklet")).toBe(true);

    const ocrFurther = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "ocr-h245");
    expect(ocrFurther?.routes).toHaveLength(6);
    expect(ocrFurther?.nextExam.code).toBe("Y540");

    const ocrGcse = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "ocr-j560");
    expect(ocrGcse?.formula.summary).toContain("2027");
    expect(ocrGcse?.formula.summary).toContain("尚未发布");

    const aqaFurther = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "aqa-8365");
    expect(aqaFurther?.timetableStatus).toContain("冲突");
  });

  it("preserves the exceptional calculator and formula rules in expanded groups", () => {
    const cambridgeMathematics = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "cambridge-9709");
    expect(cambridgeMathematics?.calculator.status).toBe("all");
    expect(cambridgeMathematics?.components.every((component) => component.calculator === "allowed")).toBe(true);

    const mathematicsB = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-4mb1");
    expect(mathematicsB?.formula).toMatchObject({
      supplied: false,
      summary: expect.stringContaining("不提供独立公式表"),
    });
    expect(mathematicsB?.components.map((component) => component.calculator)).toEqual([
      "required",
      "required",
    ]);

    const additionalMaths = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "cambridge-0606");
    expect(additionalMaths?.calculator.status).toBe("mixed");
    expect(additionalMaths?.components.map((component) => component.calculator)).toEqual([
      "not-allowed",
      "required",
    ]);
    expect(additionalMaths?.formula.summary).toContain("微积分公式不在列表内");

    const chemistry = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-igcse-4ch1");
    expect(chemistry?.formula.status).toBe("unknown");
    const computerScience = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-igcse-4cp0");
    expect(computerScience?.calculator.status).toBe("unknown");
  });

  it("preserves business-course successor, formula and source-material caveats", () => {
    const cambridgeBusiness = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "cambridge-0450");
    expect(cambridgeBusiness?.materials.some((item) => item.id === "0264-successor" && item.status === "future")).toBe(true);

    const pearsonBusiness = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-igcse-4bs1");
    expect(pearsonBusiness?.formula).toMatchObject({ supplied: true, status: "provided" });
    expect(pearsonBusiness?.formula.summary).toContain("试卷内");

    const pearsonAccounting = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-igcse-4ac1");
    expect(pearsonAccounting?.examSeries.find((series) => series.name === "November")?.note).toContain("information manual");
    expect(pearsonAccounting?.calculator.summary).toContain("未来考季");

    const ialAccounting = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-ial-accounting");
    expect(ialAccounting?.formula).toMatchObject({ supplied: false, status: "not-provided" });
    expect(ialAccounting?.formula.summary).toContain("resource booklet");
  });

  it("keeps IAL qualification routes and the first compulsory Further Pure date explicit", () => {
    const further = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-ial-further-mathematics");
    expect(further?.nextExam.title).toContain("可选应用单元");
    expect(further?.upcomingExams.find((exam) => exam.group === "FP1")?.date).toBe("2027-01-14");
    expect(further?.qualificationViews?.map((view) => view.key)).toEqual(["ial", "ias"]);

    const pure = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-ial-pure-mathematics");
    expect(pure?.qualificationViews?.find((view) => view.key === "ias")?.componentGroups).toEqual([
      "P1",
      "P2",
      "FP1",
    ]);

    const chemistry = EXAM_OVERVIEW_CATALOG.find((item) => item.id === "pearson-ial-chemistry");
    expect(chemistry?.components.map((component) => component.code)).toEqual([
      "WCH11/01", "WCH12/01", "WCH13/01", "WCH14/01", "WCH15/01", "WCH16/01",
    ]);
    expect(chemistry?.components.map((component) => component.group)).toEqual([
      "Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5", "Unit 6",
    ]);
  });

  it("accepts science practical routes and supplied reference-material labels", () => {
    const base = EXAM_OVERVIEW_CATALOG[0];
    const scienceShape = {
      ...base,
      id: "schema-science-example",
      components: base.components.map((component, index) => ({
        ...component,
        assessmentMode: index === 0 ? "practical" as const : "written" as const,
      })),
      formula: { ...base.formula, label: "公式、数据与周期表" },
      practical: {
        status: "route-dependent" as const,
        summary: "考生按考点资格选择实验卷或实验替代卷。",
        options: [
          { label: "实验路线", papers: ["Paper 1", "Paper 3"] },
          { label: "实验替代路线", papers: ["Paper 1", "Paper 4"] },
        ],
      },
    };
    expect(ExamOverviewSchema.safeParse(scienceShape).success).toBe(true);
  });

  it("generates an approval-gated diff and never promotes a candidate implicitly", () => {
    const active = EXAM_OVERVIEW_CATALOG[0];
    const candidate: ExamOverviewCandidate = {
      ...active,
      nextExam: { ...active.nextExam, date: "2027-05-01" },
      release: { status: "candidate", generatedAt: "2026-07-16", sourceRun: "scheduled-check" },
    };
    expect(diffExamOverview(active, candidate)).toEqual({
      courseId: active.id,
      changedSections: ["nextExam"],
      requiresApproval: true,
    });
    expect(active.nextExam.date).not.toBe(candidate.nextExam.date);
  });
});
