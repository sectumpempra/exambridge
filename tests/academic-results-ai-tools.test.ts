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
  sources: [],
  boundaries,
  statistics: [],
  awardRules: [],
  misconceptions,
  difficultyProfiles: [],
});

describe("academic results AI tools", () => {
  it("detects structured intents without invoking a model", () => {
    const intents = detectAcademicToolIntents(request("比较 0580 和 9709 的难度，并解释 2025 June 分数线"));
    expect(intents).toContain("lookup_grade_boundary");
    expect(intents).toContain("calculate_transition_difficulty");
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
});
