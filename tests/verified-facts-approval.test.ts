import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import statisticsPack from "../data/candidates/approval-batches/caie-0580-statistics-20260723.json";
import universityPack from "../data/candidates/approval-batches/university-admissions-2027-20260723.json";

const academicCandidate = JSON.parse(readFileSync("data/candidates/academic-results-v2/migration-candidate.json", "utf8"));

describe("Verified-facts approval packs", () => {
  it("keeps the 0580 batch pending and selects only 16 hash-backed rows", () => {
    expect(statisticsPack).toMatchObject({
      domain: "academic-results-statistics",
      approvalStatus: "pending-owner",
      activationStatus: "candidate-only",
      integrity: {
        result: "pass",
        checks: {
          selectedStatistics: 16,
          selectedSources: 16,
          excludedStatistics: 1,
          activeCollisions: 0,
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
  });

  it("cannot be activated until the owner explicitly changes both approval states", async () => {
    const { assertApprovalBatchReady } = await import("../scripts/lib/verified-facts-approval.mjs");
    expect(() => assertApprovalBatchReady(statisticsPack, "academic-results-statistics"))
      .toThrow(/explicit owner approval/);
    expect(assertApprovalBatchReady({
      ...statisticsPack,
      approvalStatus: "owner-approved",
      activationStatus: "approved-not-activated",
    }, "academic-results-statistics").batchId).toBe(statisticsPack.batchId);
  });

  it("excludes all unresolved university records from the exact approval scope", () => {
    expect(universityPack).toMatchObject({
      domain: "university-admissions",
      approvalStatus: "pending-owner",
      activationStatus: "candidate-only",
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
    }
  });
});
