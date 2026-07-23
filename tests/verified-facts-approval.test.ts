import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import statisticsPack from "../data/candidates/approval-batches/caie-0580-statistics-20260723.json";
import universityPack from "../data/candidates/approval-batches/university-admissions-2027-20260723.json";
import activeAcademic from "../public/data/academic-results-v2/manifest.json";
import activeUniversity from "../data/active/university-admissions-v1/manifest.json";

const academicCandidate = JSON.parse(readFileSync("data/candidates/academic-results-v2/migration-candidate.json", "utf8"));

describe("Verified-facts approval packs", () => {
  it("records owner approval and activates only the 16 hash-backed 0580 rows", () => {
    expect(statisticsPack).toMatchObject({
      domain: "academic-results-statistics",
      approvalStatus: "owner-approved",
      activationStatus: "activated",
      approvedBy: "owner",
      integrity: {
        result: "pass",
        checks: {
          selectedStatistics: 16,
          selectedSources: 16,
          excludedStatistics: 1,
          unexpectedActiveCollisions: 0,
        },
      },
    });
    expect(statisticsPack.scope.includedStatisticsIds).toHaveLength(16);
    expect(statisticsPack.excluded).toEqual([
      expect.objectContaining({ statisticsId: "statistics:award-caie-0580:2019:june:all-candidates" }),
    ]);
    const selected = academicCandidate.statistics.filter((record: { statisticsId: string }) =>
      statisticsPack.scope.includedStatisticsIds.includes(record.statisticsId));
    expect(selected.every((record: { verificationStatus: string }) => record.verificationStatus === "codex-reviewed")).toBe(true);
    const activeSelected = activeAcademic.statistics.filter(record =>
      statisticsPack.scope.includedStatisticsIds.includes(record.statisticsId));
    expect(activeSelected).toHaveLength(16);
    expect(activeSelected.every(record => record.verificationStatus === "owner-approved")).toBe(true);
  });

  it("requires the approved-not-activated transition before an activation script may run", async () => {
    const { assertApprovalBatchReady } = await import("../scripts/lib/verified-facts-approval.mjs");
    expect(assertApprovalBatchReady({
      ...statisticsPack,
      activationStatus: "approved-not-activated",
    }, "academic-results-statistics").batchId).toBe(statisticsPack.batchId);
    expect(() => assertApprovalBatchReady(statisticsPack, "academic-results-statistics"))
      .toThrow(/not ready for activation/);
  });

  it("excludes all unresolved university records from the exact approval scope", () => {
    expect(universityPack).toMatchObject({
      domain: "university-admissions",
      approvalStatus: "owner-approved",
      activationStatus: "activated",
      approvedBy: "owner",
      integrity: {
        result: "pass",
        checks: {
          verifiedRequirements: 20,
          unresolvedExcluded: 3,
          rejectedExcluded: 7,
        },
      },
    });
    for (const unresolvedId of universityPack.excluded.unresolvedRecordIds) {
      expect(universityPack.scope.requirementIds).not.toContain(unresolvedId);
      expect(universityPack.scope.programmeIds).not.toContain(unresolvedId);
      expect(JSON.stringify(activeUniversity)).not.toContain(unresolvedId);
    }
    expect(activeUniversity.requirements).toHaveLength(20);
    expect(activeUniversity.requirements.every(record => record.verificationStatus === "owner-approved")).toBe(true);
  });
});
