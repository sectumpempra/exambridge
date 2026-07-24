import type { Line3V1, Plane3V1, Point3V1, Vector3V1 } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOLERANCE,
  parallelLinesDistance,
  parallelPlanesDistance,
  pointLineDistance,
  pointPlaneDistance,
  pointPointDistance,
  skewLinesDistance,
  unwrapCoreResult,
} from "@/features/vector-geometry-lab/core";
import type { DistanceMeasurement } from "@/features/vector-geometry-lab/core";
import { approxVec, vec } from "./helpers.js";

function makePoint(pointId: string, position: Vector3V1): Point3V1 {
  return { pointId, label: pointId, position };
}

function makeLine(lineId: string, point: Vector3V1, direction: Vector3V1): Line3V1 {
  return {
    lineId,
    label: lineId,
    point: { pointId: `${lineId}-p`, label: "P", position: point },
    direction,
  };
}

function makePlane(planeId: string, point: Vector3V1, normal: Vector3V1): Plane3V1 {
  return {
    planeId,
    label: planeId,
    point: { pointId: `${planeId}-p`, label: "P", position: point },
    normal,
  };
}

function exactParts(measurement: DistanceMeasurement): {
  numerator: bigint;
  denominator: bigint;
  radicand: bigint;
} {
  if (measurement.kind !== "exact") {
    throw new Error("expected an exact measurement");
  }
  return {
    numerator: measurement.radical.coefficient.numerator,
    denominator: measurement.radical.coefficient.denominator,
    radicand: measurement.radical.radicand,
  };
}

describe("pointPointDistance", () => {
  it("computes an integer distance exactly (3-4-12 → 13)", () => {
    const outcome = pointPointDistance(
      makePoint("A", vec("0", "0", "0")),
      makePoint("B", vec("3", "4", "12")),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 13n,
      denominator: 1n,
      radicand: 1n,
    });
    if (outcome.result.distance.kind === "exact") {
      expect(outcome.result.distance.decimalApproximation).toBe("13.000000");
    }
    expect(outcome.result.relation).toBe("distinct-points");
    expect(outcome.result.displayGeometry[0]?.kind).toBe("segment");
    expect(outcome.result.displayGeometry[0]?.points).toHaveLength(2);
    expect(outcome.derivations.length).toBeGreaterThanOrEqual(4);
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
    expect(outcome.validation.map((record) => record.rule)).toContain("distance-non-negative");
  });

  it("keeps an irrational distance as an exact radical", () => {
    const outcome = pointPointDistance(
      makePoint("A", vec("1", "2", "3")),
      makePoint("B", vec("4", "6", "1")),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 1n,
      denominator: 1n,
      radicand: 29n,
    });
  });

  it("classifies duplicate points as same-point with a point display", () => {
    const outcome = pointPointDistance(
      makePoint("A", vec("2", "-1", "5")),
      makePoint("B", vec("2", "-1", "5")),
    );
    expect(exactParts(outcome.result.distance).numerator).toBe(0n);
    expect(outcome.result.relation).toBe("same-point");
    expect(outcome.result.displayGeometry[0]?.kind).toBe("point");
    const classification = outcome.validation.find(
      (record) => record.rule === "relation-classification",
    );
    expect(classification?.message).toContain("same-point");
  });

  it("honours the configurable decimal digits", () => {
    const outcome = pointPointDistance(
      makePoint("A", vec("0", "0", "0")),
      makePoint("B", vec("1", "1", "0")),
      { decimalDigits: 3 },
    );
    if (outcome.result.distance.kind === "exact") {
      expect(outcome.result.distance.decimalApproximation).toBe("1.414");
    }
  });

  it("takes the tolerance path for approximate inputs and records the tolerance", () => {
    const outcome = pointPointDistance(
      makePoint("A", approxVec("0", "0", "0")),
      makePoint("B", approxVec("1", "2", "2")),
    );
    expect(outcome.result.distance.kind).toBe("approximate");
    if (outcome.result.distance.kind === "approximate") {
      expect(outcome.result.distance.value).toBeCloseTo(3, 9);
      expect(outcome.result.distance.tolerance).toEqual(DEFAULT_TOLERANCE);
    }
    expect(outcome.result.relation).toBe("distinct-points");
  });

  it("classifies approximate points within tolerance of each other as same-point", () => {
    const outcome = pointPointDistance(
      makePoint("A", approxVec("0", "0", "0")),
      makePoint("B", approxVec("0.0000000005", "0", "0")),
    );
    expect(outcome.result.relation).toBe("same-point");
  });
});

describe("pointLineDistance", () => {
  it("refuses a zero direction with a structured zero-vector failure", () => {
    const result = pointLineDistance(
      makePoint("P", vec("1", "0", "0")),
      makeLine("l", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("computes 3√2/2 with the perpendicular foot and parameter", () => {
    const outcome = unwrapCoreResult(
      pointLineDistance(
        makePoint("P", vec("2", "1", "2")),
        makeLine("l", vec("0", "0", "0"), vec("1", "1", "0")),
      ),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 3n,
      denominator: 2n,
      radicand: 2n,
    });
    expect(outcome.result.foot.position.x.numerator).toBe("3");
    expect(outcome.result.foot.position.x.denominator).toBe("2");
    expect(outcome.result.foot.position.z.numerator).toBe("0");
    expect(outcome.result.parameter.numerator).toBe("3");
    expect(outcome.result.parameter.denominator).toBe("2");
    expect(outcome.result.relation).toBe("point-off-line");
    expect(outcome.result.displayGeometry[0]?.kind).toBe("segment");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("foot-on-line");
    expect(rules).toContain("connector-perpendicular-to-direction");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("returns an integer distance with a scaled direction", () => {
    const outcome = unwrapCoreResult(
      pointLineDistance(
        makePoint("P", vec("3", "4", "7")),
        makeLine("l", vec("0", "0", "1"), vec("0", "0", "5")),
      ),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 5n,
      denominator: 1n,
      radicand: 1n,
    });
  });

  it("classifies a point on the line as point-on-line with distance 0", () => {
    const outcome = unwrapCoreResult(
      pointLineDistance(
        makePoint("P", vec("2", "4", "6")),
        makeLine("l", vec("1", "2", "3"), vec("1", "2", "3")),
      ),
    );
    expect(outcome.result.relation).toBe("point-on-line");
    expect(exactParts(outcome.result.distance).numerator).toBe(0n);
    expect(outcome.result.displayGeometry[0]?.kind).toBe("point");
    const classification = outcome.validation.find(
      (record) => record.rule === "relation-classification",
    );
    expect(classification?.message).toContain("point-on-line");
  });

  it("handles approximate inputs on the tolerance path", () => {
    const outcome = unwrapCoreResult(
      pointLineDistance(
        makePoint("P", approxVec("3", "4", "7")),
        makeLine("l", approxVec("0", "0", "1"), approxVec("0", "0", "5")),
      ),
    );
    expect(outcome.result.distance.kind).toBe("approximate");
    if (outcome.result.distance.kind === "approximate") {
      expect(outcome.result.distance.value).toBeCloseTo(5, 9);
    }
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });
});

describe("pointPlaneDistance", () => {
  it("refuses a zero normal with a structured zero-vector failure", () => {
    const result = pointPlaneDistance(
      makePoint("P", vec("1", "0", "0")),
      makePlane("pl", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("computes a rational distance 5/3 with foot and signed value", () => {
    const outcome = unwrapCoreResult(
      pointPlaneDistance(
        makePoint("P", vec("1", "1", "1")),
        makePlane("pl", vec("0", "0", "0"), vec("1", "2", "2")),
      ),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 5n,
      denominator: 3n,
      radicand: 1n,
    });
    expect(outcome.result.signedValue.numerator).toBe("5");
    expect(outcome.result.foot.position.x.numerator).toBe("4");
    expect(outcome.result.foot.position.x.denominator).toBe("9");
    expect(outcome.result.relation).toBe("point-outside-plane");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("foot-in-plane");
    expect(rules).toContain("connector-parallel-to-normal");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("computes an irrational distance √2", () => {
    const outcome = unwrapCoreResult(
      pointPlaneDistance(
        makePoint("P", vec("0", "0", "3")),
        makePlane("pl", vec("1", "1", "1"), vec("1", "1", "0")),
      ),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 1n,
      denominator: 1n,
      radicand: 2n,
    });
  });

  it("classifies a point in the plane as point-in-plane with distance 0", () => {
    const outcome = unwrapCoreResult(
      pointPlaneDistance(
        makePoint("P", vec("1", "-1", "2")),
        makePlane("pl", vec("2", "0", "1"), vec("3", "-1", "2")),
      ),
    );
    expect(outcome.result.relation).toBe("point-in-plane");
    expect(exactParts(outcome.result.distance).numerator).toBe(0n);
    expect(outcome.result.displayGeometry[0]?.kind).toBe("point");
  });

  it("handles approximate inputs on the tolerance path", () => {
    const outcome = unwrapCoreResult(
      pointPlaneDistance(
        makePoint("P", approxVec("1", "1", "1")),
        makePlane("pl", approxVec("0", "0", "0"), approxVec("1", "2", "2")),
      ),
    );
    expect(outcome.result.distance.kind).toBe("approximate");
    if (outcome.result.distance.kind === "approximate") {
      expect(outcome.result.distance.value).toBeCloseTo(5 / 3, 9);
    }
  });
});

describe("parallelLinesDistance", () => {
  it("refuses a zero direction", () => {
    const result = parallelLinesDistance(
      makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
      makeLine("l2", vec("0", "1", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
      expect(result.error.details?.["lineId"]).toBe("l2");
    }
  });

  it("rejects non-parallel lines with a structured not-parallel failure", () => {
    const result = parallelLinesDistance(
      makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
      makeLine("l2", vec("0", "0", "0"), vec("0", "1", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not-parallel");
      expect(result.error.details?.["line1Id"]).toBe("l1");
    }
  });

  it("computes the distance between parallel lines with scaled direction", () => {
    const outcome = unwrapCoreResult(
      parallelLinesDistance(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("0", "3", "4"), vec("2", "0", "0")),
      ),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 5n,
      denominator: 1n,
      radicand: 1n,
    });
    expect(outcome.result.relation).toBe("parallel-distinct");
    expect(outcome.result.segmentEnd1.position.y.numerator).toBe("0");
    expect(outcome.result.segmentEnd2.position.y.numerator).toBe("3");
    expect(outcome.result.displayGeometry[0]?.kind).toBe("segment");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("connector-perpendicular-to-line1");
    expect(rules).toContain("connector-perpendicular-to-line2");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("classifies coincident lines with distance 0", () => {
    const outcome = unwrapCoreResult(
      parallelLinesDistance(
        makeLine("l1", vec("1", "1", "1"), vec("1", "-1", "2")),
        makeLine("l2", vec("2", "0", "3"), vec("-2", "2", "-4")),
      ),
    );
    expect(outcome.result.relation).toBe("lines-coincident");
    expect(exactParts(outcome.result.distance).numerator).toBe(0n);
    expect(outcome.result.displayGeometry[0]?.kind).toBe("point");
  });

  it("accepts approximately parallel directions within tolerance", () => {
    const outcome = unwrapCoreResult(
      parallelLinesDistance(
        makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makeLine("l2", approxVec("0", "2", "0"), approxVec("1", "0.0000000005", "0")),
      ),
    );
    expect(outcome.result.distance.kind).toBe("approximate");
    if (outcome.result.distance.kind === "approximate") {
      expect(outcome.result.distance.value).toBeCloseTo(2, 6);
    }
    expect(outcome.result.relation).toBe("parallel-distinct");
  });

  it("rejects approximate directions beyond tolerance", () => {
    const result = parallelLinesDistance(
      makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
      makeLine("l2", approxVec("0", "2", "0"), approxVec("1", "0.000001", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not-parallel");
      expect(result.error.details?.["tolerance"]).toContain("absolute=");
    }
  });
});

describe("skewLinesDistance", () => {
  it("refuses a zero direction", () => {
    const result = skewLinesDistance(
      makeLine("l1", vec("0", "0", "0"), vec("0", "0", "0")),
      makeLine("l2", vec("0", "0", "1"), vec("0", "1", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("rejects parallel directions with a structured not-skew failure", () => {
    const result = skewLinesDistance(
      makeLine("l1", vec("0", "0", "0"), vec("1", "2", "3")),
      makeLine("l2", vec("5", "5", "5"), vec("2", "4", "6")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not-skew");
    }
  });

  it("computes the classic perpendicular skew distance 3 with both feet", () => {
    const outcome = unwrapCoreResult(
      skewLinesDistance(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("0", "0", "3"), vec("0", "1", "0")),
      ),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 3n,
      denominator: 1n,
      radicand: 1n,
    });
    expect(outcome.result.relation).toBe("skew");
    expect(outcome.result.foot1.position.z.numerator).toBe("0");
    expect(outcome.result.foot2.position.z.numerator).toBe("3");
    expect(outcome.result.parameter1.numerator).toBe("0");
    expect(outcome.result.parameter2.numerator).toBe("0");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("foot-on-line1");
    expect(rules).toContain("foot-on-line2");
    expect(rules).toContain("connector-perpendicular-to-line1");
    expect(rules).toContain("connector-perpendicular-to-line2");
    expect(rules).toContain("triple-product-consistency");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("computes the irrational distance √2/2 with fractional feet", () => {
    const outcome = unwrapCoreResult(
      skewLinesDistance(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("0", "1", "2"), vec("0", "1", "1")),
      ),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 1n,
      denominator: 2n,
      radicand: 2n,
    });
    expect(outcome.result.parameter2.numerator).toBe("-3");
    expect(outcome.result.parameter2.denominator).toBe("2");
    expect(outcome.result.foot2.position.y.numerator).toBe("-1");
    expect(outcome.result.foot2.position.y.denominator).toBe("2");
  });

  it("classifies intersecting (non-parallel) lines with distance 0", () => {
    const outcome = unwrapCoreResult(
      skewLinesDistance(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("0", "1", "1"), vec("0", "1", "1")),
      ),
    );
    expect(outcome.result.relation).toBe("lines-intersect");
    expect(exactParts(outcome.result.distance).numerator).toBe(0n);
    expect(outcome.result.displayGeometry[0]?.kind).toBe("point");
    const classification = outcome.validation.find(
      (record) => record.rule === "relation-classification",
    );
    expect(classification?.message).toContain("lines-intersect");
  });

  it("handles approximate inputs on the tolerance path", () => {
    const outcome = unwrapCoreResult(
      skewLinesDistance(
        makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makeLine("l2", approxVec("0", "0", "3"), approxVec("0", "1", "0")),
      ),
    );
    expect(outcome.result.distance.kind).toBe("approximate");
    if (outcome.result.distance.kind === "approximate") {
      expect(outcome.result.distance.value).toBeCloseTo(3, 9);
    }
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("rejects approximately parallel directions as not-skew", () => {
    const result = skewLinesDistance(
      makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
      makeLine("l2", approxVec("0", "1", "0"), approxVec("1", "0.0000000005", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not-skew");
      expect(result.error.details?.["tolerance"]).toContain("absolute=");
    }
  });
});

describe("parallelPlanesDistance", () => {
  it("refuses a zero normal", () => {
    const result = parallelPlanesDistance(
      makePlane("p1", vec("0", "0", "0"), vec("0", "0", "0")),
      makePlane("p2", vec("0", "0", "1"), vec("0", "0", "1")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
      expect(result.error.details?.["planeId"]).toBe("p1");
    }
  });

  it("rejects non-parallel planes with a structured not-parallel failure", () => {
    const result = parallelPlanesDistance(
      makePlane("p1", vec("0", "0", "0"), vec("1", "0", "0")),
      makePlane("p2", vec("0", "0", "0"), vec("0", "1", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not-parallel");
    }
  });

  it("computes the distance between parallel planes with a scaled normal", () => {
    const outcome = unwrapCoreResult(
      parallelPlanesDistance(
        makePlane("p1", vec("0", "0", "0"), vec("0", "0", "1")),
        makePlane("p2", vec("0", "0", "7"), vec("0", "0", "2")),
      ),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 7n,
      denominator: 1n,
      radicand: 1n,
    });
    expect(outcome.result.relation).toBe("parallel-distinct");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("foot-in-plane1");
    expect(rules).toContain("endpoint-in-plane2");
    expect(rules).toContain("connector-parallel-to-normal");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("computes the irrational distance 3√2/2", () => {
    const outcome = unwrapCoreResult(
      parallelPlanesDistance(
        makePlane("p1", vec("0", "0", "0"), vec("1", "1", "0")),
        makePlane("p2", vec("3", "0", "0"), vec("2", "2", "0")),
      ),
    );
    expect(exactParts(outcome.result.distance)).toEqual({
      numerator: 3n,
      denominator: 2n,
      radicand: 2n,
    });
    expect(outcome.result.segmentEnd1.position.x.numerator).toBe("3");
    expect(outcome.result.segmentEnd1.position.x.denominator).toBe("2");
    expect(outcome.result.segmentEnd1.position.y.numerator).toBe("-3");
  });

  it("classifies coincident planes with distance 0", () => {
    const outcome = unwrapCoreResult(
      parallelPlanesDistance(
        makePlane("p1", vec("1", "2", "3"), vec("1", "1", "1")),
        makePlane("p2", vec("0", "0", "6"), vec("2", "2", "2")),
      ),
    );
    expect(outcome.result.relation).toBe("planes-coincident");
    expect(exactParts(outcome.result.distance).numerator).toBe(0n);
    expect(outcome.result.displayGeometry[0]?.kind).toBe("point");
  });

  it("handles approximate inputs on the tolerance path", () => {
    const outcome = unwrapCoreResult(
      parallelPlanesDistance(
        makePlane("p1", approxVec("0", "0", "0"), approxVec("0", "0", "1")),
        makePlane("p2", approxVec("0", "0", "7"), approxVec("0", "0", "2")),
      ),
    );
    expect(outcome.result.distance.kind).toBe("approximate");
    if (outcome.result.distance.kind === "approximate") {
      expect(outcome.result.distance.value).toBeCloseTo(7, 9);
    }
  });
});
