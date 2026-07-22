import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAcademicToolContext, detectAcademicToolIntents } from "../server/ai/academic-tools";
import { BOUNDARY_PREDICTION_DISCLAIMER_VERSION, type AcademicResultsManifestV2, type GradeBoundaryV2, type MisconceptionRecordV1 } from "@/domain-v2/academic-results";
import type { AIChatRequest } from "@/domain-v2/ai-assistant";

const request = (content: string, overrides: Partial<AIChatRequest> = {}): AIChatRequest => ({
  version: 2,
  mode: "exam_assistant",
  scopes: [],
  qualificationIds: [],
  syllabusVersions: [],
  pageContext: { pageType: "academic-results", route: "/results", selectedPaperIds: [], comparisonIds: [] },
  messages: [{ role: "user", content }],
  locale: "zh-CN",
  roleView: "consulting",
  ...overrides,
});

const boundary = (verificationStatus: GradeBoundaryV2["verificationStatus"], id: string): GradeBoundaryV2 => ({
  schemaVersion: "2.0.0",
  boundaryId: id,
  qualificationVersionId: "CAIE-9709:2026-2027",
  awardQualificationId: "award:caie:9709",
  year: 2025,
  series: "june",
  routeId: "9709-al",
  boundaryScope: "overall",
  maximumMark: 250,
  gradeOrder: ["A*", "A", "B"],
  thresholds: { "A*": 210, A: 180, B: 150 },
  publicationStatus: "final",
  sourceIds: ["source-1"],
  verificationStatus,
});

const manifest = (boundaries: GradeBoundaryV2[] = [], misconceptions: MisconceptionRecordV1[] = []): AcademicResultsManifestV2 => ({
  schemaVersion: "2.0.0",
  activationBatch: "test-owner-approved",
  qualificationIdentities: [],
  qualificationFactCards: [],
  sources: [],
  boundaries,
  statistics: [],
  awardRules: [],
  misconceptions,
  difficultyProfiles: [],
});
const activeManifest = JSON.parse(readFileSync("public/data/academic-results-v2/manifest.json", "utf8")) as AcademicResultsManifestV2;

describe("academic results AI tools", () => {
  it("detects structured intents without invoking a model", () => {
    const intents = detectAcademicToolIntents(request("比较 0580 和 9709 的难度，并解释 2025 June 分数线"));
    expect(intents).toContain("lookup_grade_boundary");
    expect(intents).toContain("calculate_transition_difficulty");
  });

  it("recognises common Chinese A-star rate wording as Grade Statistics", () => {
    expect(detectAcademicToolIntents(request("0580 的 A*率如何？"))).toContain("lookup_grade_statistics");
    expect(detectAcademicToolIntents(request("这门课的A星率和高分率是多少？"))).toContain("lookup_grade_statistics");
  });

  it("queries only owner-approved active rows and never exposes candidate rows", () => {
    const result = buildAcademicToolContext(
      request("9709 2025 June 分数线是多少？"),
      manifest([boundary("owner-approved", "approved"), boundary("candidate", "candidate")]),
      ["CAIE-9709:2026-2027"],
    );
    expect(result?.calls).toHaveLength(1);
    expect(result?.calls[0]).toMatchObject({ name: "lookup_grade_boundary", status: "ok" });
    expect(result?.calls[0].result).toEqual([expect.objectContaining({ boundaryId: "approved" })]);
  });

  it("keeps predictions disabled until exact versioned consent is supplied", () => {
    const noConsent = buildAcademicToolContext(
      request("预测 9709 2026 June 分数线", { academicQuery: { type: "lookup", awardQualificationId: "award:caie:9709", year: 2026, series: "june", routeId: "9709-al" } }),
      manifest(),
      ["CAIE-9709:2026-2027"],
    );
    expect(noConsent?.calls.find(call => call.name === "explain_boundary_prediction")).toMatchObject({ status: "consent-required" });
    const wrongVersion = buildAcademicToolContext(
      request("预测 9709 2026 June 分数线", {
        academicQuery: { type: "lookup", awardQualificationId: "award:caie:9709", year: 2026, series: "june", routeId: "9709-al" },
        featureConsent: { boundaryPrediction: { enabled: true, disclaimerVersion: `${BOUNDARY_PREDICTION_DISCLAIMER_VERSION}-wrong` } },
      }),
      manifest(),
      ["CAIE-9709:2026-2027"],
    );
    expect(wrongVersion?.calls.find(call => call.name === "explain_boundary_prediction")).toMatchObject({ status: "consent-required" });
  });

  it("answers no-course misconception queries only from owner-approved records", () => {
    const record: MisconceptionRecordV1 = {
      misconceptionId: "misconception:statistics-is-boundary",
      awardQualificationIds: ["award:ocr:h240"],
      qualificationVersionIds: ["OCR-H240:Version 3"],
      incorrectClaim: "Grade Statistics就是分数线。",
      correctedFact: "Grade Statistics是群体成绩分布，grade boundary是等级分数阈值。",
      applicabilityNotes: ["两类数据必须分开查询。"],
      sourceIds: ["source-1"],
      escalationTriggers: ["只有百分比而没有阈值。"],
      suggestedResponse: "请分别查看分数线和成绩统计。",
      reviewStatus: "owner-approved",
    };
    const result = buildAcademicToolContext(request("Grade Statistics和分数线有什么区别？"), manifest([], [record]), []);
    const misconceptionCall = result?.calls.find(call => call.name === "lookup_misconception");
    expect(misconceptionCall).toMatchObject({ status: "ok" });
    expect(result?.containsAqa).toBe(false);
    expect((misconceptionCall?.result as MisconceptionRecordV1[])[0].correctedFact).toContain("群体成绩分布");
  });

  it("marks AQA misconception evidence for deterministic local answering", () => {
    const record: MisconceptionRecordV1 = {
      misconceptionId: "misconception:linear-a-level-uses-ums",
      awardQualificationIds: ["award:aqa:7357", "award:ocr:h240"],
      qualificationVersionIds: ["AQA-7357:1.3", "OCR-H240:Version 3"],
      incorrectClaim: "当前线性A Level使用旧UMS。",
      correctedFact: "当前线性资格不套用旧模块化UMS。",
      applicabilityNotes: ["历史资格需要单独确认版本。"],
      sourceIds: ["source-1"],
      escalationTriggers: ["资格版本不明。"],
      suggestedResponse: "请先确认资格版本。",
      reviewStatus: "owner-approved",
    };
    const result = buildAcademicToolContext(request("AQA现在还使用UMS吗？"), manifest([], [record]), []);
    expect(result?.calls.find(call => call.name === "lookup_misconception")).toMatchObject({ status: "ok" });
    expect(result?.containsAqa).toBe(true);
  });

  it("returns no tool context when a question has no academic intent", () => {
    expect(buildAcademicToolContext(request("你好，请介绍一下这个网站。"), activeManifest, [])).toBeUndefined();
  });

  it("queries approved statistics, rules and comparison records without inventing deferred difficulty data", () => {
    const lookup = buildAcademicToolContext(request("2025 June 的 Grade Statistics 和分数线", {
      academicQuery: { type: "lookup", awardQualificationId: "award:ocr:h240", year: 2025, series: "june", routeId: "award:ocr:h240:linear" },
    }), activeManifest, ["OCR-H240:Version 3"]);
    expect(lookup?.calls.find(call => call.name === "lookup_grade_boundary")?.status).toBe("ok");
    expect(lookup?.calls.find(call => call.name === "lookup_grade_statistics")?.status).toBe("ok");

    const compared = buildAcademicToolContext(
      request("两个考试局规则有什么区别？课程难度怎么对比？"),
      activeManifest,
      ["AQA-7357:1.3", "OCR-H240:Version 3"],
    );
    expect(compared?.calls.find(call => call.name === "compare_qualification_rules")?.status).toBe("ok");
    expect(compared?.calls.find(call => call.name === "compare_subjects")?.status).toBe("data-unavailable");
    expect(compared?.calls.find(call => call.name === "calculate_transition_difficulty")?.status).toBe("data-unavailable");
  });

  it("requires mastery evidence for readiness and keeps missing profiles explicit", () => {
    const withoutMastery = buildAcademicToolContext(
      request("我准备好升读了吗？"),
      activeManifest,
      ["CAIE-0580:2025-2027", "CAIE-9709:2026-2027"],
    );
    expect(withoutMastery?.calls.find(call => call.name === "evaluate_student_readiness")).toMatchObject({ status: "input-required" });

    const withMastery = buildAcademicToolContext(
      request("根据掌握度判断具体缺口", { anonymousMastery: [{ nodeId: "ALG-TEST", level: "basic" }] }),
      activeManifest,
      ["CAIE-0580:2025-2027", "CAIE-9709:2026-2027"],
    );
    expect(withMastery?.calls.find(call => call.name === "evaluate_student_readiness")).toMatchObject({
      status: "input-required",
      result: expect.objectContaining({ anonymousMastery: [{ nodeId: "ALG-TEST", level: "basic" }] }),
    });
  });

  it("calculates an owner-approved award and reports unavailable or invalid inputs deterministically", () => {
    const rule = activeManifest.awardRules.find(item => item.awardQualificationId === "award:pearson:8ma0")!;
    const academicQuery = {
      type: "award-calculation" as const,
      awardQualificationId: rule.awardQualificationId,
      ruleId: rule.ruleId,
      routeId: rule.routeId,
      targetSeries: "2025-june",
      combinationId: rule.validCombinations[0].combinationId,
      componentScores: [
        { componentCode: "8MA0/01", series: "2025-june", rawMark: 80 },
        { componentCode: "8MA0/02", series: "2025-june", rawMark: 40 },
      ],
    };
    const calculated = buildAcademicToolContext(request("帮我合分并算最终等级", { academicQuery }), activeManifest, [rule.qualificationVersionId]);
    expect(calculated?.calls.find(call => call.name === "calculate_qualification_award")).toMatchObject({
      status: "ok",
      result: expect.objectContaining({ grade: "A", totalAwardMark: 120 }),
    });

    const unavailable = buildAcademicToolContext(request("帮我合分", {
      academicQuery: { ...academicQuery, ruleId: "rule:missing" },
    }), activeManifest, [rule.qualificationVersionId]);
    expect(unavailable?.calls.find(call => call.name === "calculate_qualification_award")?.status).toBe("data-unavailable");

    const invalid = buildAcademicToolContext(request("帮我合分", {
      academicQuery: { ...academicQuery, componentScores: [{ componentCode: "8MA0/01", series: "2025-june", rawMark: 999 }] },
    }), activeManifest, [rule.qualificationVersionId]);
    expect(invalid?.calls.find(call => call.name === "calculate_qualification_award")?.status).toBe("invalid-input");
  });

  it("keeps prediction input and evidence failures explicit after consent", () => {
    const consent = { boundaryPrediction: { enabled: true, disclaimerVersion: BOUNDARY_PREDICTION_DISCLAIMER_VERSION } };
    const missingInput = buildAcademicToolContext(request("预测分数线", { featureConsent: consent }), manifest(), ["CAIE-9709:2026-2027"]);
    expect(missingInput?.calls.find(call => call.name === "explain_boundary_prediction")?.status).toBe("input-required");

    const insufficient = buildAcademicToolContext(request("预测 9709 2026 June 分数线", {
      academicQuery: { type: "lookup", awardQualificationId: "award:caie:9709", year: 2026, series: "june", routeId: "9709-al" },
      featureConsent: consent,
    }), manifest([boundary("owner-approved", "only-one")]), ["CAIE-9709:2026-2027"]);
    expect(insufficient?.calls.find(call => call.name === "explain_boundary_prediction")?.status).toBe("data-unavailable");
  });

  it("parses common exam-series wording when no structured lookup is supplied", () => {
    const samples = ["January", "三月", "夏季", "October", "十一月"];
    for (const sample of samples) {
      const context = buildAcademicToolContext(request(`2025 ${sample} 分数线`), manifest(), ["CAIE-9709:2026-2027"]);
      expect(context?.calls[0]).toMatchObject({ name: "lookup_grade_boundary", status: "data-unavailable" });
    }
  });
});
