import { describe, expect, it } from "vitest";
import {
  AwardCalculationInputSchema,
  EstimatedAwardBoundarySchema,
  OfficialAwardBoundarySchema,
  OfficialAwardRouteSchema,
} from "@/domain-v2/awards/schema";

const source = {
  sourceUrl: "https://www.aqa.org.uk/exams-administration/results-days/grade-boundaries",
  publishedAt: "2025-08-14",
  accessedAt: "2026-07-13",
  sourceDocumentHash: "a".repeat(64),
};

const validOfficialRoute = {
  id: "award:aqa:7357:linear",
  board: "AQA",
  qualificationCode: "7357",
  level: "A-Level",
  specificationVersion: "7357-2017",
  routeType: "linear",
  routeKey: "7357-linear",
  components: ["7357/1", "7357/2", "7357/3"].map(code => ({
    code, inputKind: "raw", maxRawMark: 100, weightingFactor: 1,
  })),
  maximumMarkAfterWeighting: 300,
  roundingRule: "none",
  grades: ["A*", "A", "B", "C", "D", "E"],
  sourceUrl: "https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-7357-SP-2017.PDF",
  publishedAt: "2017-02-01",
  accessedAt: "2026-07-13",
  sourceRowId: "AQA-7357-SP-2017",
  sourceDocumentHash: "b".repeat(64),
  verificationStatus: "verified",
};

describe("Award domain schemas", () => {
  it("accepts a verified AQA linear route", () => {
    const parsed = OfficialAwardRouteSchema.parse(validOfficialRoute);
    expect(parsed.components).toHaveLength(3);
  });

  it.each(["publishedAt", "sourceRowId", "sourceDocumentHash"] as const)(
    "rejects an official route missing mandatory provenance field %s",
    field => {
      const routeWithoutField = Object.fromEntries(
        Object.entries(validOfficialRoute).filter(([key]) => key !== field),
      );

      expect(() => OfficialAwardRouteSchema.parse(routeWithoutField)).toThrow();
    },
  );

  it("requires every supporting route source to satisfy the strict official-source contract", () => {
    expect(() => OfficialAwardRouteSchema.parse({
      ...validOfficialRoute,
      supportingSources: [{
        sourceUrl: "https://example.com/support.pdf",
        publishedAt: "2025-08-12",
        accessedAt: "2026-07-13",
        sourceRowId: "SUPPORT-ROW-1",
      }],
    })).toThrow(/sourceDocumentHash/);
  });

  it("rejects an unsupported board and qualification pairing", () => {
    expect(() => OfficialAwardRouteSchema.parse({
      ...validOfficialRoute,
      board: "AQA",
      qualificationCode: "H240",
    })).toThrow();
  });

  it("rejects a non-monotonic official boundary", () => {
    expect(() => OfficialAwardBoundarySchema.parse({
      source: "official",
      routeId: "award:aqa:7357:linear",
      series: "2025-june",
      componentVariants: ["7357/1", "7357/2", "7357/3"],
      maximumMarkAfterWeighting: 300,
      thresholds: { "A*": 260, A: 221, B: 230, C: 145, D: 108, E: 71 },
      ...source,
      sourceRowId: "AQA-2025-JUNE-7357-OVERALL",
      verificationStatus: "verified",
    })).toThrow();
  });

  it("rejects estimated records with fewer than three samples", () => {
    expect(() => EstimatedAwardBoundarySchema.parse({
      source: "estimated",
      methodVersion: "historical-weighted-median-v1",
      routeId: "award:aqa:7357:linear",
      targetSeries: "2026-june",
      componentVariants: ["7357/1", "7357/2", "7357/3"],
      maximumMarkAfterWeighting: 300,
      sampleSeries: ["2025-june", "2024-june"],
      sampleSize: 2,
      thresholds: { A: { centre: 221, lower: 220, upper: 223 } },
      confidence: "medium",
      dataAsOf: "2025-08-14",
      inputManifestHash: "a".repeat(64),
      contentHash: "b".repeat(64),
      isOfficial: false,
    })).toThrow();
  });

  it.each([NaN, Infinity, -1])("rejects unsafe raw score %s", rawScore => {
    expect(() => AwardCalculationInputSchema.parse({
      routeId: "award:aqa:7357:linear",
      series: "2025-june",
      scores: [{ componentCode: "7357/1", series: "2025-june", rawScore }],
      estimateConsent: false,
    })).toThrow();
  });
});
