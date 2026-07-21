import { describe, expect, it } from "vitest";
import candidate from "../data/candidates/academic-results-v2/migration-candidate.json";
import report from "../generated/academic-results-v2/migration-report.json";
import {
  GradeBoundaryV2Schema,
  GradeStatisticsV2Schema,
  QualificationAwardRuleV2Schema,
  SourceEvidenceV1Schema,
} from "../src/domain-v2/academic-results";

const statisticsProvenance = candidate.statisticsProvenance as Record<string, { migrationOrigin: string }>;

describe("Academic Results V2 migration candidate", () => {
  it("keeps every migrated record schema-valid", () => {
    candidate.sources.forEach(row => expect(SourceEvidenceV1Schema.safeParse(row).success).toBe(true));
    candidate.boundaries.forEach(row => expect(GradeBoundaryV2Schema.safeParse(row).success).toBe(true));
    candidate.statistics.forEach(row => {
      expect(statisticsProvenance[row.statisticsId]?.migrationOrigin).toBeTruthy();
      expect(GradeStatisticsV2Schema.safeParse(row).success).toBe(true);
    });
    candidate.awardRules.forEach(row => expect(QualificationAwardRuleV2Schema.safeParse(row).success).toBe(true));
  });

  it("has no unresolved in-scope statistics conflicts and never selects an unresolved variant", () => {
    expect(candidate.statisticsConflicts.length).toBe(report.statisticsConflictCount);
    expect(candidate.statisticsConflicts).toHaveLength(0);
  });

  it("keeps AQA local and pending exact row-level source verification", () => {
    const aqa = candidate.statistics.filter(row => row.awardQualificationId.startsWith("award:aqa:"));
    expect(aqa.length).toBeGreaterThan(0);
    expect(aqa.every(row => statisticsProvenance[row.statisticsId]?.migrationOrigin === "official-local-aqa" && row.verificationStatus === "candidate")).toBe(true);
  });

  it("includes OCR 6993 row-level official statistics from 2021 to 2025", () => {
    const rows = candidate.statistics.filter(row => row.awardQualificationId === "award:ocr:6993");
    expect(rows.map(row => row.year)).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(rows.every(row => row.verificationStatus === "codex-reviewed" && row.sourceIds.length === 1)).toBe(true);
  });

  it("resolves the four Pearson IAL conflicts against exact official rows", () => {
    const rows = candidate.statistics.filter(row =>
      ["award:pearson:ial-mathematics", "award:pearson:ial-further-mathematics"].includes(row.awardQualificationId)
      && ((row.year === 2025 && row.series === "june") || (row.year === 2026 && row.series === "january")),
    );
    expect(rows).toHaveLength(4);
    expect(rows.every(row => row.verificationStatus === "codex-reviewed" && row.sourceIds.length === 1)).toBe(true);
    expect(rows.find(row => row.awardQualificationId.endsWith("ial-mathematics") && row.year === 2025)?.gradeRates).toEqual({
      "A*": 32.7, A: 53.2, B: 71.1, C: 82.7, D: 90.3, E: 94.9,
    });
    expect(rows.find(row => row.awardQualificationId.endsWith("ial-further-mathematics") && row.year === 2026)?.gradeRates).toEqual({
      "A*": 47.7, A: 69.2, B: 81.3, C: 88.2, D: 92.9, E: 96.1,
    });
  });

  it("preserves raw values whenever normalization occurred", () => {
    const normalized = candidate.statistics.filter(row => row.normalization);
    for (const row of normalized) {
      expect(row.rawGradeRates).toBeDefined();
      expect(row.normalization?.reason).not.toBe("");
    }
  });

  it("covers all 13 approved qualifications without activating any candidate rule", () => {
    expect(candidate.awardRules).toHaveLength(26);
    expect(new Set(candidate.awardRules.map(row => row.awardQualificationId)).size).toBe(13);
    expect(candidate.awardRules.every(row => row.verificationStatus !== "owner-approved")).toBe(true);
  });
});
