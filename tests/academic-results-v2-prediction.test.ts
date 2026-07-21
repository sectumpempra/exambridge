import { describe, expect, it } from "vitest";
import {
  BOUNDARY_PREDICTION_DISCLAIMER_VERSION,
  predictGradeBoundaryV1,
  type GradeBoundaryV2,
} from "@/domain-v2/academic-results";

const boundary = (year: number, series: GradeBoundaryV2["series"], threshold: number, overrides: Partial<GradeBoundaryV2> = {}): GradeBoundaryV2 => ({
  schemaVersion: "2.0.0",
  boundaryId: `b-${year}-${series}`,
  qualificationVersionId: "Q:1",
  awardQualificationId: "award:q",
  year,
  series,
  routeId: "route-1",
  boundaryScope: "overall",
  maximumMark: 100,
  gradeOrder: ["A", "B"],
  thresholds: { A: threshold, B: threshold - 10 },
  publicationStatus: "final",
  sourceIds: [`source-${year}-${series}`],
  verificationStatus: "owner-approved",
  ...overrides,
});

const request = {
  qualificationVersionId: "Q:1",
  awardQualificationId: "award:q",
  routeId: "route-1",
  targetYear: 2026,
  targetSeries: "june" as const,
  dataCutoff: "2026-05-01",
  disclaimerAccepted: true,
  disclaimerVersion: BOUNDARY_PREDICTION_DISCLAIMER_VERSION,
};

describe("BoundaryPredictionV1", () => {
  it("requires explicit versioned consent", () => {
    expect(() => predictGradeBoundaryV1({ ...request, disclaimerAccepted: false }, [])).toThrowError(
      expect.objectContaining({ code: "CONSENT_REQUIRED" }),
    );
  });

  it("uses only the latest three to five exact compatible owner-approved official series", () => {
    const result = predictGradeBoundaryV1(request, [
      boundary(2019, "june", 55),
      boundary(2021, "june", 60),
      boundary(2022, "june", 61),
      boundary(2023, "june", 62),
      boundary(2024, "june", 64),
      boundary(2025, "june", 65),
      boundary(2025, "november", 99, { publicationStatus: "estimated", verificationStatus: "candidate" }),
      boundary(2025, "march", 90, { routeId: "different-route" }),
    ]);
    expect(result.sampleSeries).toEqual(["2025-june", "2024-june", "2023-june", "2022-june", "2021-june"]);
    expect(result.sampleBoundaryIds).not.toContain("b-2019-june");
    expect(result.predictedThresholds.A).toBe(64);
    expect(result.intervals.A?.[0]).toBeLessThanOrEqual(64);
    expect(result.intervals.A?.[1]).toBeGreaterThanOrEqual(64);
    expect(result.confidence).toBe("high");
    expect(result.verificationStatus).toBe("candidate");
  });

  it("rejects fewer than three trustworthy exact samples", () => {
    expect(() => predictGradeBoundaryV1(request, [
      boundary(2024, "june", 64),
      boundary(2025, "june", 65),
    ])).toThrowError(expect.objectContaining({ code: "INSUFFICIENT_SAMPLES" }));
  });
});
