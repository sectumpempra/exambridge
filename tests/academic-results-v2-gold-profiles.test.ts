import { describe, expect, it } from "vitest";
import candidate from "../data/candidates/academic-results-v2/difficulty-profiles.json";
import report from "../generated/academic-results-v2/difficulty-gold-report.json";
import { DifficultyProfileV1Schema } from "@/domain-v2/academic-results";

describe("directional difficulty gold candidates", () => {
  it("contains the seven locked directional routes and keeps every profile schema-valid", () => {
    expect(candidate.profiles).toHaveLength(7);
    expect(report.profileCount).toBe(7);
    for (const profile of candidate.profiles) {
      const {
        label: _label,
        sourceCode: _sourceCode,
        targetCode: _targetCode,
        sourcePaperIds: _sourcePaperIds,
        targetPaperIds: _targetPaperIds,
        processingPolicy: _processingPolicy,
        note: _note,
        ...schemaRecord
      } = profile;
      void [_label, _sourceCode, _targetCode, _sourcePaperIds, _targetPaperIds, _processingPolicy, _note];
      expect(DifficultyProfileV1Schema.safeParse(schemaRecord).success, profile.profileId).toBe(true);
      expect(profile.verificationStatus).toBe("candidate");
      expect(profile.interval[0]).toBeLessThanOrEqual(profile.score);
      expect(profile.interval[1]).toBeGreaterThanOrEqual(profile.score);
    }
  });

  it("keeps the two currently unsupported evidence dimensions missing instead of redistributing weight", () => {
    for (const profile of candidate.profiles) {
      expect(profile.dimensions.questionComplexity.score).toBeNull();
      expect(profile.dimensions.empiricalDemand.score).toBeNull();
      expect(profile.evidenceCoverage).toBeLessThanOrEqual(0.75);
    }
  });

  it("labels H640 as Mathematics B and does not misrepresent it as Further Mathematics", () => {
    const h640 = candidate.profiles.find(profile => profile.targetCode === "OCR-H640");
    expect(h640?.label).toContain("Mathematics B");
    expect(h640?.note).toContain("not Further Mathematics B");
  });
});
