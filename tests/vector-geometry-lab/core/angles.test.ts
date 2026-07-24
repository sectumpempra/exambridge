import type { Line3V1, Plane3V1, Vector3V1 } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOLERANCE,
  lineLineAngle,
  linePlaneAngle,
  planePlaneAngle,
  unwrapCoreResult,
  vectorAngle,
} from "@/features/vector-geometry-lab/core";
import { approxVec, vec } from "./helpers.js";

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

describe("vectorAngle", () => {
  it("refuses a zero vector on either side (never NaN)", () => {
    const zeroFirst = vectorAngle(vec("0", "0", "0"), vec("1", "2", "3"));
    expect(zeroFirst.ok).toBe(false);
    if (!zeroFirst.ok) {
      expect(zeroFirst.error.code).toBe("zero-vector");
    }
    const zeroSecond = vectorAngle(vec("1", "2", "3"), vec("0", "0", "0"));
    expect(zeroSecond.ok).toBe(false);
  });

  it("refuses a near-zero approximate vector", () => {
    const result = vectorAngle(
      approxVec("0.0000000005", "0", "0"),
      vec("1", "0", "0"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
      expect(result.error.details?.["tolerance"]).toContain("absolute=");
    }
  });

  it("computes 90° for perpendicular vectors with an exact zero cosine", () => {
    const outcome = unwrapCoreResult(vectorAngle(vec("1", "2", "3"), vec("-2", "1", "0")));
    expect(outcome.result.classification).toBe("perpendicular");
    expect(outcome.result.angle.kind).toBe("exact");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.numerator).toBe(0n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(90, 9);
    }
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("perpendicular-dot-zero");
    expect(rules).toContain("cosine-within-bounds");
    expect(rules).toContain("angle-range");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("computes 45° with exact cosine √2/2 (acute)", () => {
    const outcome = unwrapCoreResult(vectorAngle(vec("1", "0", "0"), vec("1", "1", "0")));
    expect(outcome.result.classification).toBe("acute");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.numerator).toBe(1n);
      expect(outcome.result.angle.cosine.coefficient.denominator).toBe(2n);
      expect(outcome.result.angle.cosine.radicand).toBe(2n);
      expect(outcome.result.angle.cosineDecimalApproximation).toBe("0.707107");
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(45, 9);
    }
    expect(outcome.result.dotProduct.numerator).toBe("1");
  });

  it("computes 135° with exact cosine −√2/2 (obtuse)", () => {
    const outcome = unwrapCoreResult(vectorAngle(vec("1", "0", "0"), vec("-1", "1", "0")));
    expect(outcome.result.classification).toBe("obtuse");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.numerator).toBe(-1n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(135, 9);
    }
  });

  it("computes 0° for same-direction vectors and validates the cross residual", () => {
    const outcome = unwrapCoreResult(vectorAngle(vec("1", "2", "2"), vec("2", "4", "4")));
    expect(outcome.result.classification).toBe("same-direction");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.numerator).toBe(1n);
      expect(outcome.result.angle.cosine.radicand).toBe(1n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(0, 9);
    }
    expect(outcome.validation.map((record) => record.rule)).toContain("parallel-cross-zero");
    // degenerate arc (0°): no arc-plane normal is attached
    expect(outcome.result.displayGeometry[0]?.normal).toBeUndefined();
  });

  it("computes 180° for opposite-direction vectors", () => {
    const outcome = unwrapCoreResult(vectorAngle(vec("1", "0", "-2"), vec("-2", "0", "4")));
    expect(outcome.result.classification).toBe("opposite-direction");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.numerator).toBe(-1n);
      expect(outcome.result.angle.cosine.radicand).toBe(1n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(180, 9);
    }
  });

  it("computes cos θ = √6/3 (rational-over-radical quotient)", () => {
    const outcome = unwrapCoreResult(vectorAngle(vec("1", "1", "1"), vec("1", "1", "0")));
    expect(outcome.result.classification).toBe("acute");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.numerator).toBe(1n);
      expect(outcome.result.angle.cosine.coefficient.denominator).toBe(3n);
      expect(outcome.result.angle.cosine.radicand).toBe(6n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(35.264389682754654, 9);
    }
    // non-parallel: the arc carries an arc-plane normal
    expect(outcome.result.displayGeometry[0]?.normal).toBeDefined();
    expect(outcome.result.displayGeometry[0]?.kind).toBe("angle-arc");
  });

  it("honours configurable decimal digits for the cosine rendering", () => {
    const outcome = unwrapCoreResult(
      vectorAngle(vec("1", "0", "0"), vec("1", "1", "0"), { decimalDigits: 4 }),
    );
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosineDecimalApproximation).toBe("0.7071");
    }
  });

  it("takes the tolerance path for approximate vectors", () => {
    const outcome = unwrapCoreResult(
      vectorAngle(approxVec("1", "0", "0"), approxVec("1", "0.0000000005", "0")),
    );
    expect(outcome.result.angle.kind).toBe("approximate");
    if (outcome.result.angle.kind === "approximate") {
      expect(outcome.result.angle.cosine).toBeCloseTo(1, 6);
      expect(outcome.result.angle.tolerance).toEqual(DEFAULT_TOLERANCE);
    }
    expect(outcome.result.classification).toBe("same-direction");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("classifies an approximate obtuse angle", () => {
    const outcome = unwrapCoreResult(
      vectorAngle(approxVec("1", "0", "0"), approxVec("-1", "1", "0")),
    );
    expect(outcome.result.classification).toBe("obtuse");
    if (outcome.result.angle.kind === "approximate") {
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(135, 6);
    }
  });
});

describe("lineLineAngle", () => {
  it("refuses a zero direction", () => {
    const result = lineLineAngle(
      makeLine("l1", vec("0", "0", "0"), vec("0", "0", "0")),
      makeLine("l2", vec("0", "0", "0"), vec("1", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("takes the absolute dot product: directions (1,0,0) and (−1,−1,0) give 45°", () => {
    const outcome = unwrapCoreResult(
      lineLineAngle(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("5", "5", "5"), vec("-1", "-1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("acute");
    expect(outcome.result.dotProduct.numerator).toBe("-1");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.numerator).toBe(1n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(45, 9);
    }
  });

  it("computes 90° for perpendicular lines", () => {
    const outcome = unwrapCoreResult(
      lineLineAngle(
        makeLine("l1", vec("0", "0", "0"), vec("1", "2", "3")),
        makeLine("l2", vec("1", "1", "1"), vec("-2", "1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("perpendicular");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(90, 9);
    }
    expect(outcome.validation.map((record) => record.rule)).toContain("perpendicular-dot-zero");
  });

  it("computes 0° for parallel lines (scaled and reversed directions)", () => {
    const outcome = unwrapCoreResult(
      lineLineAngle(
        makeLine("l1", vec("0", "0", "0"), vec("1", "-1", "2")),
        makeLine("l2", vec("3", "0", "-1"), vec("-2", "2", "-4")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-lines");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.numerator).toBe(1n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(0, 9);
    }
    expect(outcome.validation.map((record) => record.rule)).toContain("parallel-cross-zero");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("handles approximate directions on the tolerance path", () => {
    const outcome = unwrapCoreResult(
      lineLineAngle(
        makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makeLine("l2", approxVec("0", "0", "0"), approxVec("1", "1", "0")),
      ),
    );
    expect(outcome.result.angle.kind).toBe("approximate");
    if (outcome.result.angle.kind === "approximate") {
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(45, 6);
    }
  });
});

describe("linePlaneAngle", () => {
  it("refuses a zero direction or a zero normal", () => {
    const zeroDirection = linePlaneAngle(
      makeLine("l", vec("0", "0", "0"), vec("0", "0", "0")),
      makePlane("pl", vec("0", "0", "0"), vec("0", "0", "1")),
    );
    expect(zeroDirection.ok).toBe(false);
    const zeroNormal = linePlaneAngle(
      makeLine("l", vec("0", "0", "0"), vec("1", "0", "0")),
      makePlane("pl", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(zeroNormal.ok).toBe(false);
    if (!zeroNormal.ok) {
      expect(zeroNormal.error.code).toBe("zero-vector");
    }
  });

  it("computes 0° when the line is parallel to the plane (d ⊥ n)", () => {
    const outcome = unwrapCoreResult(
      linePlaneAngle(
        makeLine("l", vec("0", "0", "5"), vec("1", "0", "0")),
        makePlane("pl", vec("0", "0", "0"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("line-parallel-to-plane");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.sine.coefficient.numerator).toBe(0n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(0, 9);
    }
    expect(outcome.validation.map((record) => record.rule)).toContain("perpendicular-dot-zero");
  });

  it("computes 90° when the line is perpendicular to the plane (d ∥ n)", () => {
    const outcome = unwrapCoreResult(
      linePlaneAngle(
        makeLine("l", vec("0", "0", "0"), vec("0", "0", "5")),
        makePlane("pl", vec("1", "2", "3"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("line-perpendicular-to-plane");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.sine.coefficient.numerator).toBe(1n);
      expect(outcome.result.angle.sine.radicand).toBe(1n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(90, 9);
    }
    expect(outcome.validation.map((record) => record.rule)).toContain("parallel-cross-zero");
    // degenerate arc (d ∥ n): no arc-plane normal
    expect(outcome.result.displayGeometry[0]?.normal).toBeUndefined();
  });

  it("computes sin θ = 2/3 exactly (oblique, ≈ 41.810315°)", () => {
    const outcome = unwrapCoreResult(
      linePlaneAngle(
        makeLine("l", vec("0", "0", "0"), vec("1", "2", "2")),
        makePlane("pl", vec("0", "0", "0"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("oblique");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.sine.coefficient.numerator).toBe(2n);
      expect(outcome.result.angle.sine.coefficient.denominator).toBe(3n);
      expect(outcome.result.angle.sine.radicand).toBe(1n);
      expect(outcome.result.angle.sineDecimalApproximation).toBe("0.666667");
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(41.810314895778596, 9);
    }
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("sine-within-bounds");
    expect(rules).toContain("angle-range");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
    expect(outcome.result.displayGeometry[0]?.normal).toBeDefined();
  });

  it("computes 45° for direction (1,0,1) against normal (0,0,1)", () => {
    const outcome = unwrapCoreResult(
      linePlaneAngle(
        makeLine("l", vec("0", "0", "0"), vec("1", "0", "1")),
        makePlane("pl", vec("0", "0", "0"), vec("0", "0", "1")),
      ),
    );
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.sine.radicand).toBe(2n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(45, 9);
    }
  });

  it("handles approximate inputs on the tolerance path", () => {
    const outcome = unwrapCoreResult(
      linePlaneAngle(
        makeLine("l", approxVec("0", "0", "0"), approxVec("1", "2", "2")),
        makePlane("pl", approxVec("0", "0", "0"), approxVec("0", "0", "1")),
      ),
    );
    expect(outcome.result.angle.kind).toBe("approximate");
    if (outcome.result.angle.kind === "approximate") {
      expect(outcome.result.angle.sine).toBeCloseTo(2 / 3, 9);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(41.810314895778596, 6);
    }
  });
});

describe("planePlaneAngle", () => {
  it("refuses a zero normal on either plane", () => {
    const result = planePlaneAngle(
      makePlane("p1", vec("0", "0", "0"), vec("0", "0", "0")),
      makePlane("p2", vec("0", "0", "0"), vec("1", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("computes 45° between planes with normals (0,0,1) and (0,1,1)", () => {
    const outcome = unwrapCoreResult(
      planePlaneAngle(
        makePlane("p1", vec("0", "0", "0"), vec("0", "0", "1")),
        makePlane("p2", vec("1", "1", "1"), vec("0", "1", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("acute");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.radicand).toBe(2n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(45, 9);
    }
  });

  it("computes 90° for perpendicular planes", () => {
    const outcome = unwrapCoreResult(
      planePlaneAngle(
        makePlane("p1", vec("0", "0", "0"), vec("1", "0", "0")),
        makePlane("p2", vec("0", "0", "0"), vec("0", "1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("perpendicular");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(90, 9);
    }
    expect(outcome.validation.map((record) => record.rule)).toContain("perpendicular-dot-zero");
  });

  it("computes 0° for parallel planes (scaled normals)", () => {
    const outcome = unwrapCoreResult(
      planePlaneAngle(
        makePlane("p1", vec("0", "0", "0"), vec("1", "2", "3")),
        makePlane("p2", vec("5", "5", "5"), vec("2", "4", "6")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-planes");
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.numerator).toBe(1n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(0, 9);
    }
    expect(outcome.validation.map((record) => record.rule)).toContain("parallel-cross-zero");
    expect(outcome.result.displayGeometry[0]?.normal).toBeUndefined();
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("computes cos θ = √6/3 for normals (1,1,1) and (1,1,0)", () => {
    const outcome = unwrapCoreResult(
      planePlaneAngle(
        makePlane("p1", vec("0", "0", "0"), vec("1", "1", "1")),
        makePlane("p2", vec("0", "0", "0"), vec("1", "1", "0")),
      ),
    );
    if (outcome.result.angle.kind === "exact") {
      expect(outcome.result.angle.cosine.coefficient.denominator).toBe(3n);
      expect(outcome.result.angle.cosine.radicand).toBe(6n);
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(35.264389682754654, 9);
    }
  });

  it("handles approximate normals on the tolerance path", () => {
    const outcome = unwrapCoreResult(
      planePlaneAngle(
        makePlane("p1", approxVec("0", "0", "0"), approxVec("0", "0", "1")),
        makePlane("p2", approxVec("0", "0", "0"), approxVec("0", "1", "1")),
      ),
    );
    expect(outcome.result.angle.kind).toBe("approximate");
    if (outcome.result.angle.kind === "approximate") {
      expect(outcome.result.angle.angleDegrees).toBeCloseTo(45, 6);
    }
  });
});
