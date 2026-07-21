import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AcademicResultsManifestV2Schema } from "@/domain-v2/academic-results";

const active = AcademicResultsManifestV2Schema.parse(JSON.parse(
  readFileSync("public/data/academic-results-v2/manifest.json", "utf8"),
));
const activation = JSON.parse(readFileSync("data/active/academic-results-v2/activation.json", "utf8"));

describe("Academic Results V2 launch activation", () => {
  it("activates the complete source-backed rule and misconception set", () => {
    expect(active.activationBatch).toBe("academic-results-v2-launch-20260722");
    expect(active.qualificationIdentities).toHaveLength(13);
    expect(active.qualificationFactCards).toHaveLength(13);
    expect(active.awardRules).toHaveLength(40);
    expect(active.misconceptions).toHaveLength(12);
    expect(active.awardRules.every(rule => rule.verificationStatus === "owner-approved"
      && rule.clauseEvidence.every(evidence => evidence.reviewStatus === "owner-approved"))).toBe(true);
    expect(active.sources.every(source => source.verificationStatus === "owner-approved"
      && /^[a-f0-9]{64}$/.test(source.sourceDocumentHash ?? ""))).toBe(true);
  });

  it("enables calculation only where every current route has an exact overall boundary", () => {
    const enabled = active.qualificationFactCards
      .filter(card => card.maturity.calculatorAvailable)
      .map(card => card.awardQualificationId)
      .sort();
    const explainOnly = active.qualificationFactCards
      .filter(card => !card.maturity.calculatorAvailable)
      .map(card => card.awardQualificationId)
      .sort();
    expect(enabled).toEqual([...activation.launchSafety.calculatorEnabled].sort());
    expect(explainOnly).toEqual([...activation.launchSafety.calculatorExplainOnly].sort());
    expect(explainOnly).toEqual([
      "award:caie:9231",
      "award:caie:9709",
      "award:pearson:4ma1",
      "award:pearson:ial-further-mathematics",
      "award:pearson:ial-mathematics",
    ]);
  });

  it("keeps deferred difficulty, prediction and external-search features inactive", () => {
    expect(active.difficultyProfiles).toHaveLength(0);
    expect(activation.launchSafety).toMatchObject({
      p0GapCount: 0,
      gradeStatisticsBlocksRules: false,
      predictionsActivated: false,
      externalSearchActivated: false,
    });
  });
});
