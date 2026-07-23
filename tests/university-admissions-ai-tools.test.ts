import { describe, expect, it } from "vitest";
import type { AIChatRequest } from "@/domain-v2/ai-assistant";
import {
  buildUniversityAdmissionsToolContext,
  detectUniversityAdmissionsIntent,
} from "../server/ai/university-admissions-tools";

const request = (content: string): AIChatRequest => ({
  version: 2,
  mode: "exam_assistant",
  scopes: [],
  qualificationIds: [],
  syllabusVersions: [],
  pageContext: {
    pageType: "assistant-home",
    route: "/ai",
    selectedPaperIds: [],
    comparisonIds: [],
  },
  messages: [{ role: "user", content }],
  locale: "zh-CN",
});

describe("University Admissions V1 AI tools", () => {
  it("does not run for ordinary exam questions", () => {
    expect(detectUniversityAdmissionsIntent(request("9709 Paper 1 多长时间？"))).toBe(false);
    expect(buildUniversityAdmissionsToolContext(request("9709 Paper 1 多长时间？"))).toBeUndefined();
  });

  it("resolves a Chinese university alias and subject to one owner-approved requirement", () => {
    const context = buildUniversityAdmissionsToolContext(request("牛津大学 2027 数学本科的 A Level 录取要求是什么？"));
    const call = context?.calls.find(item => item.name === "lookup_university_admissions_requirement");
    expect(context).toMatchObject({
      activeBatch: "verified-facts-university-admissions-2027-20260723",
      intakeYear: 2027,
    });
    expect(call?.status).toBe("ok");
    const records = call?.result as Array<{
      institution: { name: string; verificationStatus: string };
      programme: { subjectArea: string; verificationStatus: string };
      requirement: { intakeYear: number; verificationStatus: string };
    }>;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      institution: { name: "University of Oxford", verificationStatus: "owner-approved" },
      programme: { subjectArea: "Mathematics", verificationStatus: "owner-approved" },
      requirement: { intakeYear: 2027, verificationStatus: "owner-approved" },
    });
    expect(call?.sourceIds.length).toBeGreaterThan(0);
    expect(call?.sourceIds).not.toContain("src-university-of-oxford-computer-science-2027");
    expect(JSON.stringify(call?.result)).not.toContain("reviewedByModel");
    expect(JSON.stringify(call?.result)).not.toContain("conflictIds");
    expect(JSON.stringify(call?.result)).not.toContain("collegeScope");
  });

  it("builds a like-for-like two-university comparison without ranking admission likelihood", () => {
    const context = buildUniversityAdmissionsToolContext(request("比较剑桥和牛津 2027 数学本科录取要求的区别"));
    const call = context?.calls.find(item => item.name === "compare_university_admissions");
    expect(call?.status).toBe("ok");
    const records = call?.result as Array<{ institution: { institutionId: string } }>;
    expect(records.map(record => record.institution.institutionId).sort()).toEqual([
      "inst-university-of-cambridge",
      "inst-university-of-oxford",
    ]);
    expect(context?.responseTemplate.comparisonPolicy).toContain("Do not rank admission likelihood");
    expect(context?.responseTemplate.missingFieldPolicy).toContain("Do not infer a campus");
    expect(context?.responseTemplate.missingFieldPolicy).toContain("do not describe a verified minimum offer as non-typical");
    expect(context?.responseTemplate.negativeEvidencePolicy).toContain("is not negative evidence");
    expect(context?.responseTemplate.conclusionStatusPolicy).toContain("Do not discuss ingestion mechanics");
  });

  it("returns the approved TMUA record and only active programme links", () => {
    const context = buildUniversityAdmissionsToolContext(request("TMUA 是什么，哪些已核验专业需要它？"));
    const call = context?.calls.find(item => item.name === "lookup_admissions_assessment");
    expect(call?.status).toBe("ok");
    const result = call?.result as {
      assessments: Array<{ assessmentId: string; verificationStatus: string }>;
      programmeLinks: Array<{ verificationStatus: string }>;
    };
    expect(result.assessments).toEqual([
      expect.objectContaining({ assessmentId: "asm-tmua", verificationStatus: "owner-approved" }),
    ]);
    expect(result.programmeLinks.every(link => link.verificationStatus === "owner-approved")).toBe(true);
  });

  it("asks for a focused scope when no approved institution can be resolved", () => {
    const broad = buildUniversityAdmissionsToolContext(request("英国大学的录取要求是什么？"));
    expect(broad?.calls).toEqual([
      expect.objectContaining({
        name: "lookup_university_admissions_requirement",
        status: "input-required",
        result: null,
        requiredInputs: ["institution", "programme-or-subject", "intake-year-if-not-2027"],
      }),
    ]);

    const quarantined = buildUniversityAdmissionsToolContext(request("Durham 2027 数学录取要求是什么？"));
    expect(quarantined?.calls[0]).toMatchObject({ status: "input-required", result: null, sourceIds: [] });
    expect(JSON.stringify(quarantined?.calls[0].result)).not.toContain("overallOffer");
  });

  it("does not leak 2027 requirements into a request for a different intake year", () => {
    const context = buildUniversityAdmissionsToolContext(request("牛津大学 2026 数学本科的录取要求是什么？"));
    expect(context?.intakeYear).toBe(2026);
    expect(context?.calls).toEqual([
      expect.objectContaining({
        name: "lookup_university_admissions_requirement",
        status: "data-unavailable",
        result: [],
        sourceIds: [],
      }),
    ]);
    expect(JSON.stringify(context?.calls[0].result)).not.toContain("overallOffer");
  });

  it("rejects a manifest containing any non-owner-approved active record", () => {
    expect(() => buildUniversityAdmissionsToolContext(
      request("牛津大学数学录取要求"),
      {
        schemaVersion: "1.0.0",
        activationBatch: "test",
        approvedAt: "2026-07-23",
        approvedBy: "owner",
        activatedAt: "2026-07-23",
        institutions: [{ institutionId: "x", name: "Oxford", country: "UK", sourceIds: [], verificationStatus: "candidate" }],
        programmes: [],
        requirements: [],
        assessments: [],
        programmeAssessmentLinks: [],
        sources: [],
      },
    )).toThrow(/non-owner-approved/);
  });
});
