import { describe, expect, it } from "vitest";
import candidate from "../data/candidates/university-admissions-v1/candidate.json";
import report from "../generated/university-admissions-v1/import-report.json";

describe("University Admissions V1 candidate import", () => {
  it("matches the validated handoff counts without activating records", () => {
    expect(report).toMatchObject({
      result: "pass",
      activationStatus: "candidate-only",
      counts: {
        institutions: 20,
        programmes: 23,
        requirements: 22,
        assessments: 4,
        assessmentLinks: 18,
        sources: 28,
        unresolved: 3,
        rejectedRecords: 7,
        resolvedConflicts: 1,
        verifiedRequirements: 20,
        notPublishedRequirements: 2,
      },
    });
    expect(candidate.reviewStatus).toBe("codex-reviewed");
    expect(candidate.activationStatus).toBe("candidate-only");
    expect(candidate.sourceHandoff.deepseekCompletedCalls).toBe(0);
  });

  it("keeps every imported record at or below the codex-reviewed ceiling", () => {
    const records = [
      ...candidate.institutions,
      ...candidate.programmes,
      ...candidate.requirements,
      ...candidate.assessments,
      ...candidate.programmeAssessmentLinks,
      ...candidate.sources,
    ];
    expect(records.every(record => record.verificationStatus === "codex-reviewed")).toBe(true);
    expect(JSON.stringify(candidate)).not.toContain("owner-approved");
  });

  it("quarantines all three unresolved 2027 records", () => {
    expect(candidate.quarantine.unresolvedRecordIds).toEqual([
      "prog-durham-university-mathematics-bsc-hons",
      "req-king-s-college-london-quantitative-mathematics-bsc-uk-a-level-2027",
      "req-university-of-birmingham-mathematics-bsc-uk-a-level-2027",
    ]);
    expect(candidate.quarantine.unresolved).toHaveLength(3);
  });

  it("preserves source and relationship integrity", () => {
    const sourceIds = new Set(candidate.sources.map(source => source.sourceId));
    const programmeIds = new Set(candidate.programmes.map(programme => programme.programmeId));
    const assessmentIds = new Set(candidate.assessments.map(assessment => assessment.assessmentId));
    for (const requirement of candidate.requirements) {
      expect(programmeIds.has(requirement.programmeId)).toBe(true);
      expect(requirement.sourceIds.every(sourceId => sourceIds.has(sourceId))).toBe(true);
    }
    for (const link of candidate.programmeAssessmentLinks) {
      expect(programmeIds.has(link.programmeId)).toBe(true);
      expect(assessmentIds.has(link.assessmentId)).toBe(true);
      expect(link.sourceIds.every(sourceId => sourceIds.has(sourceId))).toBe(true);
    }
  });
});
