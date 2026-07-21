import { describe, expect, it } from "vitest";
import { buildAcademicToolContext, detectAcademicToolIntents } from "../server/ai/academic-tools";
import { BOUNDARY_PREDICTION_DISCLAIMER_VERSION, type AcademicResultsManifestV2, type GradeBoundaryV2 } from "@/domain-v2/academic-results";
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

const manifest = (boundaries: GradeBoundaryV2[] = []): AcademicResultsManifestV2 => ({
  schemaVersion: "2.0.0",
  activationBatch: "test-owner-approved",
  sources: [],
  boundaries,
  statistics: [],
  awardRules: [],
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
});
