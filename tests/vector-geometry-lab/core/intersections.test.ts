import type { Line3V1, Plane3V1, Vector3V1 } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  lineLineIntersection,
  linePlaneIntersection,
  planePlaneIntersection,
  unwrapCoreResult,
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

describe("lineLineIntersection", () => {
  it("finds the unique intersection of two non-parallel lines", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("0", "1", "1"), vec("0", "1", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("unique");
    expect(outcome.result.intersectionPoint?.position.x.numerator).toBe("0");
    expect(outcome.result.intersectionPoint?.position.y.numerator).toBe("0");
    expect(outcome.result.intersectionPoint?.position.z.numerator).toBe("0");
    expect(outcome.result.parameterOnLine1?.numerator).toBe("0");
    expect(outcome.result.parameterOnLine2?.numerator).toBe("-1");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("intersection-on-line1");
    expect(rules).toContain("intersection-on-line2");
    expect(rules).toContain("relation-classification");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
    expect(outcome.result.displayGeometry[0]?.kind).toBe("point");
    expect(outcome.derivations.length).toBeGreaterThanOrEqual(4);
  });

  it("finds a unique intersection with non-trivial parameters", () => {
    // l1: r = (0,0,0) + s(1,1,0); l2: r = (3,2,1) + t(0,1,-1).
    // x: s = 3; y: s = 2 + t; z: 0 = 1 - t → t = 1, s = 3 ✓ consistent.
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", vec("0", "0", "0"), vec("1", "1", "0")),
        makeLine("l2", vec("3", "2", "1"), vec("0", "1", "-1")),
      ),
    );
    expect(outcome.result.classification).toBe("unique");
    expect(outcome.result.intersectionPoint?.position.x.numerator).toBe("3");
    expect(outcome.result.intersectionPoint?.position.y.numerator).toBe("3");
    expect(outcome.result.intersectionPoint?.position.z.numerator).toBe("0");
    expect(outcome.result.parameterOnLine1?.numerator).toBe("3");
    expect(outcome.result.parameterOnLine2?.numerator).toBe("1");
  });

  it("classifies distinct parallel lines as parallel-no-intersection", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("0", "1", "0"), vec("1", "0", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-no-intersection");
    expect(outcome.result.intersectionPoint).toBeUndefined();
    expect(outcome.result.displayGeometry).toHaveLength(0);
  });

  it("classifies coincident lines as coincident-infinite", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("2", "0", "0"), vec("2", "0", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("coincident-infinite");
    expect(outcome.result.intersectionPoint).toBeUndefined();
  });

  it("classifies skew lines as skew-no-intersection with the perpendicular segment", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("0", "0", "3"), vec("0", "1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("skew-no-intersection");
    expect(outcome.result.intersectionPoint).toBeUndefined();
    expect(outcome.result.displayGeometry[0]?.kind).toBe("segment");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("foot-on-line1");
    expect(rules).toContain("foot-on-line2");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("refuses a zero direction with a structured failure", () => {
    const result = lineLineIntersection(
      makeLine("l1", vec("0", "0", "0"), vec("0", "0", "0")),
      makeLine("l2", vec("0", "0", "0"), vec("1", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("takes the tolerance path for approximate coincident feet", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makeLine("l2", approxVec("0", "1", "1"), approxVec("0", "1", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("unique");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });
});

describe("linePlaneIntersection", () => {
  it("finds the unique intersection with λ back-substitution", () => {
    const outcome = unwrapCoreResult(
      linePlaneIntersection(
        makeLine("l", vec("0", "0", "0"), vec("1", "1", "1")),
        makePlane("pl", vec("1", "2", "3"), vec("1", "1", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("unique");
    expect(outcome.result.parameter?.numerator).toBe("2");
    expect(outcome.result.intersectionPoint?.position.x.numerator).toBe("2");
    expect(outcome.result.intersectionPoint?.position.y.numerator).toBe("2");
    expect(outcome.result.intersectionPoint?.position.z.numerator).toBe("2");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("point-on-plane");
    expect(rules).toContain("point-on-line");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
    expect(outcome.result.displayGeometry[0]?.kind).toBe("point");
  });

  it("finds a perpendicular piercing as a unique intersection", () => {
    const outcome = unwrapCoreResult(
      linePlaneIntersection(
        makeLine("l", vec("1", "2", "3"), vec("0", "0", "7")),
        makePlane("pl", vec("0", "0", "0"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("unique");
    expect(outcome.result.parameter?.numerator).toBe("-3");
    expect(outcome.result.parameter?.denominator).toBe("7");
    expect(outcome.result.intersectionPoint?.position.z.numerator).toBe("0");
  });

  it("classifies a line in the plane as contained-infinite", () => {
    const outcome = unwrapCoreResult(
      linePlaneIntersection(
        makeLine("l", vec("1", "1", "2"), vec("1", "1", "0")),
        makePlane("pl", vec("0", "0", "2"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("contained-infinite");
    expect(outcome.result.intersectionPoint).toBeUndefined();
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("base-point-substitution");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("classifies a parallel line outside the plane as parallel-no-intersection", () => {
    const outcome = unwrapCoreResult(
      linePlaneIntersection(
        makeLine("l", vec("1", "1", "3"), vec("1", "1", "0")),
        makePlane("pl", vec("0", "0", "2"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-no-intersection");
    expect(outcome.result.intersectionPoint).toBeUndefined();
  });

  it("refuses a zero plane normal with a structured failure", () => {
    const result = linePlaneIntersection(
      makeLine("l", vec("0", "0", "0"), vec("1", "0", "0")),
      makePlane("pl", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });
});

describe("planePlaneIntersection", () => {
  it("finds the intersection line with direction n1×n2 and a verified point", () => {
    const outcome = unwrapCoreResult(
      planePlaneIntersection(
        makePlane("pl1", vec("0", "0", "3"), vec("0", "0", "1")),
        makePlane("pl2", vec("0", "2", "0"), vec("0", "1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("intersecting-in-line");
    const line = outcome.result.intersectionLine;
    expect(line?.lineId).toBe("intersection-pl1-pl2");
    expect(line?.direction.x.numerator).toBe("-1");
    expect(line?.direction.y.numerator).toBe("0");
    expect(line?.direction.z.numerator).toBe("0");
    expect(line?.point.position.x.numerator).toBe("0");
    expect(line?.point.position.y.numerator).toBe("2");
    expect(line?.point.position.z.numerator).toBe("3");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("direction-perpendicular-to-normal1");
    expect(rules).toContain("direction-perpendicular-to-normal2");
    expect(rules).toContain("point-on-plane1");
    expect(rules).toContain("point-on-plane2");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
    expect(outcome.result.displayGeometry[0]?.kind).toBe("line");
  });

  it("finds the intersection line of two planes in general position", () => {
    // x + y + z = 6 and x - y = 0. Direction: (1,1,1)×(1,-1,0) = (1,1,-2).
    // Δ = |n1×n2|² = 6; α = (6·2 - 0·0)/6 = 2, β = (0·3 - 6·0)/6 = 0;
    // r0 = 2·(1,1,1) = (2,2,2). Check: 2+2+2 = 6 ✓, 2-2 = 0 ✓.
    const outcome = unwrapCoreResult(
      planePlaneIntersection(
        makePlane("pl1", vec("6", "0", "0"), vec("1", "1", "1")),
        makePlane("pl2", vec("1", "1", "0"), vec("1", "-1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("intersecting-in-line");
    const line = outcome.result.intersectionLine;
    expect(line?.direction.x.numerator).toBe("1");
    expect(line?.direction.y.numerator).toBe("1");
    expect(line?.direction.z.numerator).toBe("-2");
    expect(line?.point.position.x.numerator).toBe("2");
    expect(line?.point.position.y.numerator).toBe("2");
    expect(line?.point.position.z.numerator).toBe("2");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("classifies distinct parallel planes as parallel-no-intersection", () => {
    const outcome = unwrapCoreResult(
      planePlaneIntersection(
        makePlane("pl1", vec("0", "0", "0"), vec("0", "0", "1")),
        makePlane("pl2", vec("0", "0", "5"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-no-intersection");
    expect(outcome.result.intersectionLine).toBeUndefined();
  });

  it("classifies coincident planes as coincident-infinite", () => {
    const outcome = unwrapCoreResult(
      planePlaneIntersection(
        makePlane("pl1", vec("1", "2", "3"), vec("1", "1", "1")),
        makePlane("pl2", vec("0", "0", "6"), vec("2", "2", "2")),
      ),
    );
    expect(outcome.result.classification).toBe("coincident-infinite");
    expect(outcome.result.intersectionLine).toBeUndefined();
  });

  it("refuses a zero normal with a structured failure", () => {
    const result = planePlaneIntersection(
      makePlane("pl1", vec("0", "0", "0"), vec("0", "0", "0")),
      makePlane("pl2", vec("0", "0", "0"), vec("1", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });
});

describe("intersections approximate paths and remaining refusals", () => {
  it("lineLineIntersection refuses a zero direction on line 2", () => {
    const result = lineLineIntersection(
      makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
      makeLine("l2", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("linePlaneIntersection refuses a zero line direction", () => {
    const result = linePlaneIntersection(
      makeLine("l", vec("0", "0", "0"), vec("0", "0", "0")),
      makePlane("pl", vec("0", "0", "0"), vec("0", "0", "1")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("planePlaneIntersection refuses a zero second normal", () => {
    const result = planePlaneIntersection(
      makePlane("pl1", vec("0", "0", "0"), vec("1", "0", "0")),
      makePlane("pl2", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("lineLineIntersection classifies approximate coincident lines", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makeLine("l2", approxVec("2", "0", "0"), approxVec("2", "0", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("coincident-infinite");
  });

  it("lineLineIntersection classifies approximate parallel distinct lines", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makeLine("l2", approxVec("0", "1", "0"), approxVec("1", "0", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-no-intersection");
    const directions = outcome.validation.find((record) => record.rule === "directions-relation");
    expect(directions?.message).toContain("approximate path");
  });

  it("lineLineIntersection classifies approximate skew lines", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makeLine("l2", approxVec("0", "0", "3"), approxVec("0", "1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("skew-no-intersection");
    expect(outcome.result.displayGeometry[0]?.kind).toBe("segment");
    const classification = outcome.validation.find(
      (record) => record.rule === "relation-classification",
    );
    expect(classification?.message).toContain("approximate path");
  });

  it("linePlaneIntersection solves an approximate unique intersection", () => {
    const outcome = unwrapCoreResult(
      linePlaneIntersection(
        makeLine("l", approxVec("0", "0", "0"), approxVec("1", "1", "1")),
        makePlane("pl", vec("1", "2", "3"), vec("1", "1", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("unique");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
    const classification = outcome.validation.find(
      (record) => record.rule === "relation-classification",
    );
    expect(classification?.message).toContain("approximate path");
  });

  it("linePlaneIntersection classifies an approximate contained line", () => {
    const outcome = unwrapCoreResult(
      linePlaneIntersection(
        makeLine("l", approxVec("1", "1", "2"), approxVec("1", "1", "0")),
        makePlane("pl", vec("0", "0", "2"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("contained-infinite");
  });

  it("planePlaneIntersection solves an approximate intersection line", () => {
    const outcome = unwrapCoreResult(
      planePlaneIntersection(
        makePlane("pl1", approxVec("0", "0", "3"), approxVec("0", "0", "1")),
        makePlane("pl2", approxVec("0", "2", "0"), approxVec("0", "1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("intersecting-in-line");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("planePlaneIntersection classifies approximate coincident planes", () => {
    const outcome = unwrapCoreResult(
      planePlaneIntersection(
        makePlane("pl1", approxVec("0", "0", "0"), approxVec("0", "0", "1")),
        makePlane("pl2", approxVec("0", "0", "0.0000000001"), approxVec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("coincident-infinite");
  });

  it("planePlaneIntersection classifies approximate parallel distinct planes", () => {
    const outcome = unwrapCoreResult(
      planePlaneIntersection(
        makePlane("pl1", approxVec("0", "0", "0"), approxVec("0", "0", "1")),
        makePlane("pl2", approxVec("0", "0", "0.5"), approxVec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-no-intersection");
  });

  it("honours an explicit tolerance override", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", vec("0", "0", "0"), vec("1", "0", "0")),
        makeLine("l2", vec("0", "1", "1"), vec("0", "1", "1")),
        { tolerance: { absolute: 0.001, relative: 0.001 } },
      ),
    );
    expect(outcome.result.classification).toBe("unique");
  });
});

describe("intersections approximate paths with tolerance overrides", () => {
  const OVERRIDE = { tolerance: { absolute: 0.001, relative: 0.001 } } as const;

  it("lineLineIntersection solves with the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makeLine("l2", approxVec("0", "1", "1"), approxVec("0", "1", "1")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("unique");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("lineLineIntersection classifies approximate parallel lines with the override", () => {
    const outcome = unwrapCoreResult(
      lineLineIntersection(
        makeLine("l1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makeLine("l2", approxVec("0", "1", "0"), approxVec("1", "0", "0")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("parallel-no-intersection");
  });

  it("linePlaneIntersection solves with the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      linePlaneIntersection(
        makeLine("l", approxVec("0", "0", "0"), approxVec("1", "1", "1")),
        makePlane("pl", vec("1", "2", "3"), vec("1", "1", "1")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("unique");
  });

  it("linePlaneIntersection classifies a contained line with the override", () => {
    const outcome = unwrapCoreResult(
      linePlaneIntersection(
        makeLine("l", approxVec("1", "1", "2"), approxVec("1", "1", "0")),
        makePlane("pl", vec("0", "0", "2"), vec("0", "0", "1")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("contained-infinite");
  });

  it("planePlaneIntersection solves with the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      planePlaneIntersection(
        makePlane("pl1", approxVec("0", "0", "3"), approxVec("0", "0", "1")),
        makePlane("pl2", approxVec("0", "2", "0"), approxVec("0", "1", "0")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("intersecting-in-line");
  });

  it("planePlaneIntersection classifies coincident planes with the override", () => {
    const outcome = unwrapCoreResult(
      planePlaneIntersection(
        makePlane("pl1", approxVec("0", "0", "0"), approxVec("0", "0", "1")),
        makePlane("pl2", approxVec("0", "0", "0.0000000001"), approxVec("0", "0", "1")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("coincident-infinite");
  });
});
