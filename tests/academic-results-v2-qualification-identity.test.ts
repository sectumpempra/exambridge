import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QualificationIdentityCatalogV2Schema } from "@/domain-v2/academic-results";

const catalog = QualificationIdentityCatalogV2Schema.parse(JSON.parse(
  readFileSync("data/candidates/academic-results-v2/qualification-identities.json", "utf8"),
));

describe("Academic Results V2 qualification identity bridge", () => {
  it("maps exactly the 13 approved awards without the withdrawn 8M1 typo", () => {
    expect(catalog.identities).toHaveLength(13);
    expect(new Set(catalog.identities.map(identity => identity.awardQualificationId)).size).toBe(13);
    expect(JSON.stringify(catalog)).not.toContain("8M1");
  });

  it("uses awardQualificationId to keep Pearson IAL Mathematics and Further Mathematics distinct", () => {
    const mathematics = catalog.identities.find(identity => identity.awardQualificationId === "award:pearson:ial-mathematics");
    const further = catalog.identities.find(identity => identity.awardQualificationId === "award:pearson:ial-further-mathematics");
    expect(mathematics?.qualificationVersions[0].qualificationVersionId).toBe("Edexcel-IAL:2018");
    expect(further?.qualificationVersions[0].qualificationVersionId).toBe("Edexcel-IAL:2018");
    expect(mathematics?.subjectCode).toBe("YMA01");
    expect(further?.subjectCode).toBe("YFM01");
    expect(mathematics?.awardQualificationId).not.toBe(further?.awardQualificationId);
    expect(mathematics?.catalogQualificationIds).not.toEqual(further?.catalogQualificationIds);
  });

  it("keeps AQA local-only while every identity has one current version and evidence", () => {
    for (const identity of catalog.identities) {
      expect(identity.qualificationVersions.filter(version => version.isCurrent)).toHaveLength(1);
      expect(identity.sourceIds.length).toBeGreaterThan(0);
      expect(identity.processingPolicy).toBe(identity.board === "AQA" ? "local-only" : "deepseek-candidate");
    }
  });

  it("contains reviewable Chinese and English aliases without making candidates active", () => {
    for (const identity of catalog.identities) {
      expect(identity.aliases.some(alias => /[\u3400-\u9fff]/.test(alias)), identity.awardQualificationId).toBe(true);
      expect(identity.aliases.some(alias => /[A-Za-z]/.test(alias)), identity.awardQualificationId).toBe(true);
      expect(identity.reviewStatus).toBe("codex-reviewed");
    }
  });
});
