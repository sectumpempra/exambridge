import batch from "../data/candidates/qualification-facts-v1/caie-advanced-sciences-20260723.json";
import { describe, expect, it } from "vitest";

describe("CAIE advanced science qualification-facts candidate", () => {
  it("keeps three current qualification versions candidate-only", () => {
    expect(batch.activationStatus).toBe("candidate-only");
    expect(batch.reviewStatus).toBe("codex-reviewed");
    expect(batch.qualifications.map(record => record.subjectCode)).toEqual(["9700", "9701", "9702"]);
    expect(JSON.stringify(batch)).not.toContain("owner-approved");
    expect(batch.review.externalModelReview).toMatchObject({
      status: "attempted-no-accepted-result",
      completed: false,
      acceptedResult: false,
      usageRecordAvailable: false,
    });
  });

  it("records five Papers and three official routes for every subject", () => {
    expect(batch.qualifications.every(record => record.components.length === 5)).toBe(true);
    expect(batch.sharedRules.routes.map(route => route.routeId)).toEqual([
      "as-same-series",
      "a-level-staged",
      "a-level-linear",
    ]);
    for (const qualification of batch.qualifications) {
      expect(qualification.components.reduce((sum, component) => sum + (component.asWeightPercent ?? 0), 0)).toBe(100);
      expect(qualification.components.reduce((sum, component) => sum + (component.aLevelWeightPercent ?? 0), 0)).toBe(100);
    }
  });

  it("captures the verified resit and carry-forward boundaries without inventing option codes", () => {
    expect(batch.sharedRules.resit.attemptLimitMeaning).toBe("unlimited");
    expect(batch.sharedRules.carryForward).toMatchObject({
      maximumAgeMonths: 13,
      maximumUsesForAsLevel: 2,
      marchToJuneAllowed: false,
      requiresCompleteSameSeriesAs: true,
      a2MarksCarryForwardAllowed: false,
      entryOptionDependsOnSeriesZoneAndPracticalVariant: true,
    });
    expect(batch.unresolved.map(gap => gap.gapId)).toContain("caie-sciences-current-entry-option-codes");
  });

  it("requires a valid SHA-256 and official URL for every source", () => {
    expect(batch.sources.every(source =>
      /^[a-f0-9]{64}$/.test(source.sourceDocumentHash)
      && source.officialUrl.startsWith("https://www.cambridgeinternational.org/"))).toBe(true);
  });
});
