import { describe, expect, it } from "vitest";
import audit from "../generated/all-subject-facts-v1/audit.json";
import boundaryCoverage from "../generated/all-subject-facts-v1/boundary-coverage.json";
import statisticsCoverage from "../generated/all-subject-facts-v1/statistics-coverage.json";
import ruleCoverage from "../generated/all-subject-facts-v1/resit-rule-coverage.json";

describe("all-subject examination facts audit", () => {
  it("uses a qualification identity that includes level", () => {
    expect(audit.identityContract).toContain("qualification-level");
    expect(audit.totals.crossLevelCollisionsPrevented).toBeGreaterThan(0);
    expect(audit.crossLevelCollisions.some(row => row.legacyIdentity === "WJEC/Eduqas|BUSI"
      && row.levels.join(",") === "A-Level,GCSE"
      && row.disposition === "prevented-distinct-qualification-collapse")).toBe(true);
    expect(audit.crossLevelCollisions.some(row => row.legacyIdentity === "CAIE|0580"
      && row.disposition === "approved-level-alias-collapse")).toBe(true);
  });

  it("separates legacy evidence from canonical active data", () => {
    expect(audit.totals.legacyStatisticsYearRows).toBeGreaterThan(audit.totals.activeCanonicalStatistics);
    expect(audit.totals.candidateCanonicalStatistics).toBeGreaterThan(audit.totals.activeCanonicalStatistics);
    expect(audit.interpretation.legacyStatisticsRows).toContain("not active canonical evidence");
  });

  it("reports the 13 owner-approved rule qualifications independently from display aliases", () => {
    expect(audit.totals.uniqueAwardQualificationsWithOwnerApprovedRules).toBe(13);
    expect(audit.totals.currentQualificationsWithOwnerApprovedRules).toBeGreaterThanOrEqual(13);
  });

  it("keeps Grade Statistics auxiliary to rule readiness", () => {
    expect(audit.interpretation.gradeStatisticsBlockingPolicy).toContain("does not block");
    expect(audit.priorityWaves.map(row => row.wave)).toEqual([0, 1, 2, 3]);
  });

  it("keeps AQA local-only and the university batch candidate-only", () => {
    expect(audit.courses.filter(row => row.board === "AQA").every(row => row.processingPolicy === "local-only")).toBe(true);
    expect(audit.priorityWaves[0]).toMatchObject({ status: "imported-candidate", records: 23 });
    expect(audit.totals.universityUnresolvedQuarantined).toBe(3);
  });

  it("publishes separate boundary, statistics and resit-rule coverage matrices", () => {
    expect(boundaryCoverage.records).toHaveLength(audit.totals.currentDisplayQualifications);
    expect(statisticsCoverage.records).toHaveLength(audit.totals.currentDisplayQualifications);
    expect(ruleCoverage.records).toHaveLength(audit.totals.currentDisplayQualifications);
    expect(statisticsCoverage.blockingPolicy).toBe("auxiliary");
    expect(boundaryCoverage.records.some(row => row.status === "legacy-candidate")).toBe(true);
    expect(ruleCoverage.records.some(row => row.status === "not-catalogued")).toBe(true);
  });
});
