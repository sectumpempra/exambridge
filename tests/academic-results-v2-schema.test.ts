import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DifficultyProfileV1Schema,
  ExternalEvidenceV1Schema,
  GradeBoundaryV2Schema,
  GradeStatisticsV2Schema,
  QualificationAwardRuleV2Schema,
  SourceEvidenceV1Schema,
  StudentMasteryProfileV1Schema,
} from "@/domain-v2/academic-results";

const approvedSource = {
  schemaVersion: "1.0.0",
  sourceId: "source:ocr:h240:2025-boundaries",
  board: "OCR",
  officialUrl: "https://www.ocr.org.uk/administration/grade-boundaries/",
  documentTitle: "June 2025 grade boundaries",
  publishedAt: "2025-08-14",
  accessedAt: "2026-07-21",
  sourceRowId: "H240-OVERALL",
  sourceDocumentHash: "a".repeat(64),
  effectiveFrom: "2025-06-01",
  verificationStatus: "owner-approved",
} as const;

const finalBoundary = {
  schemaVersion: "2.0.0",
  boundaryId: "boundary:ocr:h240:2025-june:overall",
  qualificationVersionId: "OCR-H240:Version 3",
  awardQualificationId: "award:ocr:h240",
  year: 2025,
  series: "june",
  routeId: "award:ocr:h240:linear",
  boundaryScope: "overall",
  maximumMark: 300,
  gradeOrder: ["A*", "A", "B", "C", "D", "E"],
  thresholds: { "A*": 242, A: 200, B: 160, C: 120, D: 90, E: 60 },
  publicationStatus: "final",
  sourceIds: [approvedSource.sourceId],
  verificationStatus: "owner-approved",
} as const;

describe("Academic Results V2 contracts", () => {
  it("requires an owner-approved source to have a document hash", () => {
    expect(SourceEvidenceV1Schema.parse(approvedSource).sourceId).toBe(approvedSource.sourceId);
    expect(() => SourceEvidenceV1Schema.parse({ ...approvedSource, sourceDocumentHash: undefined })).toThrow(/hash/i);
  });

  it("accepts a sourced monotonic overall boundary", () => {
    expect(GradeBoundaryV2Schema.parse(finalBoundary).maximumMark).toBe(300);
  });

  it("rejects component/overall identity leakage and non-monotonic thresholds", () => {
    expect(() => GradeBoundaryV2Schema.parse({ ...finalBoundary, componentCode: "H240/01" })).toThrow(/overall/i);
    expect(() => GradeBoundaryV2Schema.parse({
      ...finalBoundary,
      thresholds: { "A*": 242, A: 200, B: 210, C: 120, D: 90, E: 60 },
    })).toThrow(/monotonic/i);
  });

  it("requires explicit missing status instead of zero-filled unpublished thresholds", () => {
    expect(GradeBoundaryV2Schema.parse({
      ...finalBoundary,
      boundaryId: "boundary:ocr:h240:2020-june:overall",
      year: 2020,
      maximumMark: null,
      thresholds: { "A*": null, A: null, B: null, C: null, D: null, E: null },
      publicationStatus: "not-held",
    }).publicationStatus).toBe("not-held");
    expect(() => GradeBoundaryV2Schema.parse({ ...finalBoundary, publicationStatus: "not-held" })).toThrow(/non-published/i);
  });

  it("distinguishes cumulative and exclusive grade statistics", () => {
    const base = {
      schemaVersion: "2.0.0",
      statisticsId: "stats:ocr:h240:2025-june:uk",
      qualificationVersionId: "OCR-H240:Version 3",
      awardQualificationId: "award:ocr:h240",
      year: 2025,
      series: "june",
      regionScope: "UK",
      candidateCount: 10000,
      rateKind: "cumulative",
      gradeOrder: ["A*", "A", "B", "C", "D", "E"],
      gradeRates: { "A*": 18, A: 42, B: 65, C: 82, D: 93, E: 98 },
      publicationStatus: "final",
      sourceIds: [approvedSource.sourceId],
      verificationStatus: "owner-approved",
    } as const;
    expect(GradeStatisticsV2Schema.parse(base).rateKind).toBe("cumulative");
    expect(() => GradeStatisticsV2Schema.parse({ ...base, gradeRates: { "A*": 18, A: 12, B: 65, C: 82, D: 93, E: 98 } })).toThrow(/non-decreasing/i);
    expect(() => GradeStatisticsV2Schema.parse({ ...base, rateKind: "exclusive", gradeRates: { "A*": 30, A: 30, B: 30, C: 30, D: 0, E: 0 } })).toThrow(/100/i);
  });

  it("rejects award combinations that reference unknown components", () => {
    const rule = {
      schemaVersion: "2.0.0",
      ruleId: "rule:ocr:h240:v3",
      qualificationVersionId: "OCR-H240:Version 3",
      awardQualificationId: "award:ocr:h240",
      board: "OCR",
      subjectCode: "H240",
      routeId: "award:ocr:h240:linear",
      routeType: "linear",
      scoringSystem: "raw",
      components: ["H240/01", "H240/02", "H240/03"].map(code => ({
        code, inputKind: "raw", maximumRawMark: 100, maximumAwardMark: 100, weightingFactor: 1, optional: false,
      })),
      validCombinations: [{ combinationId: "all", componentCodes: ["H240/01", "H240/02", "H240/03"], awardLevel: "A-Level" }],
      totalMaximumAwardMark: 300,
      gradeScale: ["A*", "A", "B", "C", "D", "E"],
      roundingRule: "none",
      resitRule: { allowed: true, selectionMethod: "same-series-all-components", notes: [] },
      effectiveFrom: "2017-09-01",
      sourceIds: [approvedSource.sourceId],
      verificationStatus: "owner-approved",
    } as const;
    expect(QualificationAwardRuleV2Schema.parse(rule).routeType).toBe("linear");
    expect(() => QualificationAwardRuleV2Schema.parse({
      ...rule,
      validCombinations: [{ combinationId: "broken", componentCodes: ["H240/99"], awardLevel: "A-Level" }],
    })).toThrow(/unknown component/i);
  });

  it("validates the fixed five-dimensional score contract", () => {
    const dimension = { score: 50, evidenceCoverage: 1, sourceIds: [approvedSource.sourceId], explanation: "Verified evidence" };
    const profile = {
      schemaVersion: "1.0.0",
      profileId: "difficulty:0580-extended:9709-as",
      sourceQualificationVersionId: "CAIE-0580:2025-2027",
      sourceRouteId: "0580-extended",
      targetQualificationVersionId: "CAIE-9709:2026-2027",
      targetRouteId: "9709-as-statistics",
      direction: "source-to-target",
      weights: { contentGap: 0.30, depthUplift: 0.25, assessmentDemand: 0.20, questionComplexity: 0.15, empiricalDemand: 0.10 },
      dimensions: { contentGap: dimension, depthUplift: dimension, assessmentDemand: dimension, questionComplexity: dimension, empiricalDemand: dimension },
      score: 50,
      interval: [50, 50],
      evidenceCoverage: 1,
      confidence: "high",
      methodVersion: "exambridge-transition-difficulty-v1",
      verificationStatus: "candidate",
    } as const;
    expect(DifficultyProfileV1Schema.parse(profile).score).toBe(50);
    expect(() => DifficultyProfileV1Schema.parse({ ...profile, score: 80 })).toThrow(/interval/i);
  });

  it("keeps local mastery node IDs unique", () => {
    const profile = {
      schemaVersion: "1.0.0",
      profileVersion: 1,
      knowledgeBatchId: "knowledge-v5-20260719",
      sourceQualificationVersionId: "CAIE-0580:2025-2027",
      sourceRouteId: "0580-extended",
      targetQualificationVersionId: "CAIE-9709:2026-2027",
      targetRouteId: "9709-as-statistics",
      mastery: [{ nodeId: "ALG-TEST", level: "basic" }],
      updatedAt: "2026-07-21T12:00:00Z",
    } as const;
    expect(StudentMasteryProfileV1Schema.parse(profile).mastery).toHaveLength(1);
    expect(() => StudentMasteryProfileV1Schema.parse({ ...profile, mastery: [...profile.mastery, ...profile.mastery] })).toThrow(/unique/i);
  });

  it("allows a live-search answer only with exact validated evidence", () => {
    const evidence = {
      schemaVersion: "1.0.0",
      evidenceId: "external:ocr:h240:2026",
      provider: "openai-web-search",
      requestedModel: "gpt-5",
      returnedModel: "gpt-5",
      query: "OCR H240 June 2026 grade boundaries",
      board: "OCR",
      qualificationCode: "H240",
      year: 2026,
      series: "june",
      officialUrl: "https://www.ocr.org.uk/administration/grade-boundaries/",
      documentTitle: "OCR grade boundaries",
      locator: "H240 overall row",
      retrievedAt: "2026-07-21T12:00:00Z",
      allowedDomain: true,
      exactIdentityMatch: true,
      numericValidationPassed: true,
      conflictsWithActive: false,
      directAnswerEligible: true,
      verificationStatus: "candidate",
    } as const;
    expect(ExternalEvidenceV1Schema.parse(evidence).directAnswerEligible).toBe(true);
    expect(() => ExternalEvidenceV1Schema.parse({ ...evidence, locator: undefined })).toThrow(/direct answers/i);
  });

  it("runs the real release audit and writes the 13-qualification baseline", () => {
    execFileSync(process.execPath, ["scripts/audit-academic-results-v2.mjs"], { cwd: process.cwd(), stdio: "pipe" });
    const report = JSON.parse(readFileSync(join(process.cwd(), "generated/academic-results-v2/baseline-audit.json"), "utf8"));
    expect(report).toMatchObject({ targetQualificationCount: 13, coverageCellCount: 104, trackedPdfCount: 0, failureCount: 0 });
  });
});
