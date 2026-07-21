import { describe, expect, it } from "vitest";
import candidate from "../data/candidates/academic-results-v2/migration-candidate.json";
import report from "../generated/academic-results-v2/migration-report.json";
import {
  GradeBoundaryV2Schema,
  GradeStatisticsV2Schema,
  QualificationAwardRuleV2Schema,
  SourceEvidenceV1Schema,
} from "../src/domain-v2/academic-results";

describe("Academic Results V2 migration candidate", () => {
  it("keeps every migrated record schema-valid", () => {
    candidate.sources.forEach(row => expect(SourceEvidenceV1Schema.safeParse(row).success).toBe(true));
    candidate.boundaries.forEach(row => expect(GradeBoundaryV2Schema.safeParse(row).success).toBe(true));
    candidate.statistics.forEach(({ _migrationOrigin: _origin, ...row }) => expect(GradeStatisticsV2Schema.safeParse(row).success).toBe(true));
    candidate.awardRules.forEach(row => expect(QualificationAwardRuleV2Schema.safeParse(row).success).toBe(true));
  });

  it("does not silently select conflicting statistics rows", () => {
    expect(candidate.statisticsConflicts.length).toBe(report.statisticsConflictCount);
    for (const conflict of candidate.statisticsConflicts) {
      expect(conflict.status).toBe("manual-source-resolution-required");
      expect(conflict.variants.length).toBeGreaterThan(1);
      expect(candidate.statistics.some(row => `${row.awardQualificationId}|${row.year}|${row.series}` === conflict.canonicalKey)).toBe(false);
    }
  });

  it("keeps AQA local and pending exact row-level source verification", () => {
    const aqa = candidate.statistics.filter(row => row.awardQualificationId.startsWith("award:aqa:"));
    expect(aqa.length).toBeGreaterThan(0);
    expect(aqa.every(row => row._migrationOrigin === "official-local-aqa" && row.verificationStatus === "candidate")).toBe(true);
  });

  it("includes OCR 6993 row-level official statistics from 2021 to 2025", () => {
    const rows = candidate.statistics.filter(row => row.awardQualificationId === "award:ocr:6993");
    expect(rows.map(row => row.year)).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(rows.every(row => row.verificationStatus === "codex-reviewed" && row.sourceIds.length === 1)).toBe(true);
  });

  it("preserves raw values whenever normalization occurred", () => {
    const normalized = candidate.statistics.filter(row => row.normalization);
    for (const row of normalized) {
      expect(row.rawGradeRates).toBeDefined();
      expect(row.normalization?.reason).not.toBe("");
    }
  });

  it("migrates only the seven already evidenced award routes", () => {
    expect(candidate.awardRules).toHaveLength(7);
    expect(new Set(candidate.awardRules.map(row => row.routeId)).size).toBe(7);
  });
});
