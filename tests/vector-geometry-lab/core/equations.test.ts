import type { Line3V1, Plane3V1, Vector3V1 } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  isPointInPlane,
  isPointOnLine,
  line3FromEquationSet,
  lineEquationsFromLine3,
  lineEquationsFromPointDirection,
  lineEquationsFromTwoPoints,
  plane3FromEquationSet,
  planeEquationsFromPlane3,
  planeEquationsFromPointDirections,
  planeEquationsFromPointNormal,
  planeEquationsFromThreePoints,
  planeEquationsEquivalent,
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

describe("lineEquationsFromPointDirection", () => {
  it("assembles vector, parametric and symmetric forms", () => {
    const outcome = unwrapCoreResult(
      lineEquationsFromPointDirection(vec("1", "2", "3"), vec("4", "5", "6")),
    );
    const set = outcome.result;
    expect(set.vector).toBe("r = (1, 2, 3) + λ(4, 5, 6)");
    expect(set.parametric).toBe("x = 1 + 4λ, y = 2 + 5λ, z = 3 + 6λ");
    expect(set.symmetric).toEqual({
      applicable: true,
      equation: "(x - 1)/4 = (y - 2)/5 = (z - 3)/6",
    });
    expect(set.exact).toBe(true);
    expect(outcome.derivations.length).toBeGreaterThanOrEqual(3);
  });

  it("marks the symmetric form not applicable with a named reason when b_y = 0", () => {
    const outcome = unwrapCoreResult(
      lineEquationsFromPointDirection(vec("1", "2", "3"), vec("1", "0", "2")),
    );
    const set = outcome.result;
    expect(set.parametric).toBe("x = 1 + λ, y = 2, z = 3 + 2λ");
    expect(set.symmetric.applicable).toBe(false);
    if (!set.symmetric.applicable) {
      expect(set.symmetric.reason).toContain("b_y");
      expect(set.symmetric.reason).toContain("divide by zero");
    }
  });

  it("refuses a zero direction with a structured failure", () => {
    const result = lineEquationsFromPointDirection(vec("1", "2", "3"), vec("0", "0", "0"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });
});

describe("lineEquationsFromTwoPoints", () => {
  it("builds the direction from the connector", () => {
    const outcome = unwrapCoreResult(
      lineEquationsFromTwoPoints(vec("1", "0", "2"), vec("3", "1", "6")),
    );
    const set = outcome.result;
    expect(set.vector).toBe("r = (1, 0, 2) + λ(2, 1, 4)");
    expect(set.parametric).toBe("x = 1 + 2λ, y = λ, z = 2 + 4λ");
    expect(set.symmetric).toEqual({
      applicable: true,
      equation: "(x - 1)/2 = y/1 = (z - 2)/4",
    });
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("point1-on-line");
    expect(rules).toContain("point2-on-line");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("refuses duplicate points and claims no unique line", () => {
    const result = lineEquationsFromTwoPoints(vec("1", "1", "1"), vec("1", "1", "1"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("degenerate-input");
      expect(result.error.message).toContain("do not determine a unique line");
    }
  });
});

describe("line entity round-trip", () => {
  it("entity → forms → entity → forms is stable", () => {
    const line = makeLine("l", vec("1", "0", "2"), vec("2", "1", "4"));
    const set1 = unwrapCoreResult(lineEquationsFromLine3(line)).result;
    const rebuilt = line3FromEquationSet(set1, "l2", "rebuilt");
    const set2 = unwrapCoreResult(lineEquationsFromLine3(rebuilt)).result;
    expect(set2.vector).toBe(set1.vector);
    expect(set2.parametric).toBe(set1.parametric);
    expect(set2.symmetric).toEqual(set1.symmetric);
  });
});

describe("planeEquationsFromPointNormal", () => {
  it("assembles the four forms with d = A·n", () => {
    const outcome = unwrapCoreResult(
      planeEquationsFromPointNormal(vec("1", "0", "1"), vec("1", "2", "2")),
    );
    const set = outcome.result;
    expect(set.normalForm).toBe("r·(1, 2, 2) = 3");
    expect(set.pointNormalForm).toBe("(r - (1, 0, 1))·(1, 2, 2) = 0");
    expect(set.cartesianForm).toBe("x + 2y + 2z = 3");
    expect(set.parametricForm).toBe("r = (1, 0, 1) + λ(0, 1, -1) + μ(4, -1, -1)");
    expect(set.equation.d.numerator).toBe(3n);
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("point-on-plane");
  });

  it("chooses deterministic spanning directions on the smallest-normal-component axis", () => {
    // n = (0,0,1): smallest component on x (tie broken to x): u = n×e_x = (0,1,0),
    // v = n×u = (-1,0,0) → primitive (1,0,0).
    const outcome = unwrapCoreResult(
      planeEquationsFromPointNormal(vec("0", "0", "2"), vec("0", "0", "1")),
    );
    const set = outcome.result;
    expect(set.parametricForm).toBe("r = (0, 0, 2) + λ(0, 1, 0) + μ(1, 0, 0)");
  });

  it("refuses a zero normal with a structured failure", () => {
    const result = planeEquationsFromPointNormal(vec("1", "0", "1"), vec("0", "0", "0"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });
});

describe("planeEquationsFromPointDirections", () => {
  it("computes the normal as u × v and keeps the given directions", () => {
    const outcome = unwrapCoreResult(
      planeEquationsFromPointDirections(vec("0", "0", "0"), vec("1", "0", "0"), vec("0", "1", "0")),
    );
    const set = outcome.result;
    expect(set.normalForm).toBe("r·(0, 0, 1) = 0");
    expect(set.cartesianForm).toBe("z = 0");
    expect(set.parametricForm).toBe("r = (0, 0, 0) + λ(1, 0, 0) + μ(0, 1, 0)");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("normal-perpendicular-to-direction1");
    expect(rules).toContain("normal-perpendicular-to-direction2");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("refuses parallel directions and claims no unique plane", () => {
    const result = planeEquationsFromPointDirections(
      vec("0", "0", "0"),
      vec("1", "1", "1"),
      vec("2", "2", "2"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("degenerate-input");
      expect(result.error.message).toContain("do not span a plane");
    }
  });
});

describe("planeEquationsFromThreePoints", () => {
  it("builds the plane through three points and verifies all three", () => {
    const outcome = unwrapCoreResult(
      planeEquationsFromThreePoints(vec("1", "0", "0"), vec("0", "1", "0"), vec("0", "0", "1")),
    );
    const set = outcome.result;
    expect(set.cartesianForm).toBe("x + y + z = 1");
    expect(set.normalForm).toBe("r·(1, 1, 1) = 1");
    expect(set.parametricForm).toBe("r = (1, 0, 0) + λ(-1, 1, 0) + μ(-1, 0, 1)");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("point1-on-plane");
    expect(rules).toContain("point2-on-plane");
    expect(rules).toContain("point3-on-plane");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("refuses collinear points and explicitly claims NO unique plane", () => {
    const result = planeEquationsFromThreePoints(
      vec("0", "0", "0"),
      vec("1", "1", "1"),
      vec("2", "2", "2"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("degenerate-input");
      expect(result.error.message).toContain("do not determine a unique plane");
      expect(result.error.message).toContain("refusing instead of claiming a unique plane was generated");
    }
  });

  it("refuses duplicate points the same way", () => {
    const result = planeEquationsFromThreePoints(
      vec("0", "0", "0"),
      vec("0", "0", "0"),
      vec("0", "0", "1"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("degenerate-input");
    }
  });
});

describe("plane entity round-trip", () => {
  it("entity → forms → entity → forms keeps equivalent equations", () => {
    const plane = makePlane("pl", vec("1", "0", "1"), vec("1", "2", "2"));
    const set1 = unwrapCoreResult(planeEquationsFromPlane3(plane)).result;
    const rebuilt = plane3FromEquationSet(set1, "pl2", "rebuilt");
    const set2 = unwrapCoreResult(planeEquationsFromPlane3(rebuilt)).result;
    expect(unwrapCoreResult(planeEquationsEquivalent(set1.equation, set2.equation))).toBe(true);
    expect(set2.cartesianForm).toBe(set1.cartesianForm);
    expect(set2.normalForm).toBe(set1.normalForm);
  });

  it("parametric → normal reconstruction via u × v is equivalent", () => {
    const fromDirections = unwrapCoreResult(
      planeEquationsFromPointDirections(vec("1", "1", "0"), vec("1", "-1", "0"), vec("0", "1", "2")),
    ).result;
    const normal = {
      x: fromDirections.normal.x,
      y: fromDirections.normal.y,
      z: fromDirections.normal.z,
    };
    const fromNormal = unwrapCoreResult(
      planeEquationsFromPointNormal(vec("1", "1", "0"), normal),
    ).result;
    expect(
      unwrapCoreResult(planeEquationsEquivalent(fromDirections.equation, fromNormal.equation)),
    ).toBe(true);
  });
});

describe("isPointOnLine", () => {
  const line = makeLine("l", vec("0", "0", "0"), vec("1", "2", "3"));

  it("accepts a point on the line and recovers λ from the largest component", () => {
    const outcome = unwrapCoreResult(isPointOnLine(vec("2", "4", "6"), line));
    expect(outcome.result.classification).toBe("on-line");
    expect(outcome.result.onLine).toBe(true);
    expect(outcome.result.parameter.numerator).toBe("2");
    expect(outcome.result.exact).toBe(true);
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("point-on-line-residual");
  });

  it("rejects a point off the line", () => {
    const outcome = unwrapCoreResult(isPointOnLine(vec("2", "4", "7"), line));
    expect(outcome.result.classification).toBe("not-on-line");
    expect(outcome.result.onLine).toBe(false);
    expect(outcome.result.parameter.numerator).toBe("7");
    expect(outcome.result.parameter.denominator).toBe("3");
  });

  it("takes the tolerance path for an approximately on-line point", () => {
    const outcome = unwrapCoreResult(
      isPointOnLine(approxVec("2", "4", "6.0000000001"), makeLine("l2", approxVec("0", "0", "0"), vec("1", "2", "3"))),
    );
    expect(outcome.result.classification).toBe("on-line");
    expect(outcome.result.exact).toBe(false);
    expect(outcome.result.tolerance).toBeDefined();
  });

  it("refuses a zero direction with a structured failure", () => {
    const result = isPointOnLine(
      vec("1", "1", "1"),
      makeLine("lz", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });
});

describe("isPointInPlane", () => {
  const plane = makePlane("pl", vec("1", "0", "1"), vec("1", "2", "2"));

  it("accepts a point in the plane with residual 0", () => {
    const outcome = unwrapCoreResult(isPointInPlane(vec("3", "0", "0"), plane));
    expect(outcome.result.classification).toBe("in-plane");
    expect(outcome.result.inPlane).toBe(true);
    expect(outcome.result.signedValue.numerator).toBe("0");
    expect(outcome.result.exact).toBe(true);
  });

  it("rejects a point outside the plane with the signed residual", () => {
    const outcome = unwrapCoreResult(isPointInPlane(vec("0", "0", "0"), plane));
    expect(outcome.result.classification).toBe("not-in-plane");
    expect(outcome.result.inPlane).toBe(false);
    expect(outcome.result.signedValue.numerator).toBe("-3");
  });

  it("takes the tolerance path for an approximately in-plane point", () => {
    const outcome = unwrapCoreResult(
      isPointInPlane(approxVec("3.0000000001", "0", "0"), plane),
    );
    expect(outcome.result.classification).toBe("in-plane");
    expect(outcome.result.exact).toBe(false);
    expect(outcome.result.tolerance).toBeDefined();
  });

  it("refuses a zero normal with a structured failure", () => {
    const result = isPointInPlane(
      vec("1", "1", "1"),
      makePlane("plz", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });
});

describe("equations approximate paths, formatting corners and propagation", () => {
  it("names b_x and b_z when several symmetric components are not applicable", () => {
    const outcome = unwrapCoreResult(
      lineEquationsFromPointDirection(vec("1", "2", "3"), vec("0", "1", "0")),
    );
    const set = outcome.result;
    expect(set.parametric).toBe("x = 1, y = 2 + λ, z = 3");
    expect(set.symmetric.applicable).toBe(false);
    if (!set.symmetric.applicable) {
      expect(set.symmetric.reason).toContain("b_x");
      expect(set.symmetric.reason).toContain("b_z");
    }
  });

  it("renders a negative direction coefficient with a zero base as y = -λ", () => {
    const outcome = unwrapCoreResult(
      lineEquationsFromPointDirection(vec("1", "0", "3"), vec("2", "-1", "4")),
    );
    expect(outcome.result.parametric).toBe("x = 1 + 2λ, y = -λ, z = 3 + 4λ");
  });

  it("builds an approximate line equation set with a recorded tolerance", () => {
    const outcome = unwrapCoreResult(
      lineEquationsFromPointDirection(approxVec("1", "2", "3"), vec("1", "0", "2")),
    );
    const set = outcome.result;
    expect(set.exact).toBe(false);
    expect(set.tolerance).toBeDefined();
    expect(set.vector).toBe("r = (1, 2, 3) + λ(1, 0, 2)");
    expect(set.symmetric.applicable).toBe(false);
  });

  it("refuses approximately duplicate points via the tolerance path", () => {
    const result = lineEquationsFromTwoPoints(
      approxVec("1", "1", "1"),
      approxVec("1.0000000001", "1", "1"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("degenerate-input");
    }
  });

  it("builds an approximate two-points set with a recorded tolerance", () => {
    const outcome = unwrapCoreResult(
      lineEquationsFromTwoPoints(approxVec("0", "0", "0"), approxVec("1", "2", "3")),
    );
    expect(outcome.result.exact).toBe(false);
    expect(outcome.result.tolerance).toBeDefined();
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("propagates the failure when a Line3V1 has a zero direction", () => {
    const result = lineEquationsFromLine3(
      makeLine("lz", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("builds an approximate plane set with raw (non-reduced) spanning directions", () => {
    const outcome = unwrapCoreResult(
      planeEquationsFromPointNormal(approxVec("1", "0", "1"), approxVec("1", "2", "2")),
    );
    const set = outcome.result;
    expect(set.exact).toBe(false);
    expect(set.tolerance).toBeDefined();
    // Approximate path: u, v carried raw — u = n×e_x = (0,2,-2), v = n×u = (-8,2,2).
    expect(set.parametricForm).toBe("r = (1, 0, 1) + λ(0, 2, -2) + μ(-8, 2, 2)");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("refuses approximately parallel spanning directions via the tolerance path", () => {
    const result = planeEquationsFromPointDirections(
      vec("0", "0", "0"),
      approxVec("1", "1", "1"),
      approxVec("2", "2", "2"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("degenerate-input");
    }
  });

  it("refuses approximately collinear points via the tolerance path", () => {
    const result = planeEquationsFromThreePoints(
      approxVec("0", "0", "0"),
      approxVec("1", "1", "1"),
      approxVec("2", "2", "2"),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("degenerate-input");
    }
  });

  it("builds an approximate three-points set with a recorded tolerance", () => {
    const outcome = unwrapCoreResult(
      planeEquationsFromThreePoints(
        approxVec("1", "0", "0"),
        approxVec("0", "1", "0"),
        approxVec("0", "0", "1"),
      ),
    );
    expect(outcome.result.exact).toBe(false);
    expect(outcome.result.tolerance).toBeDefined();
    expect(outcome.result.cartesianForm).toBe("x + y + z = 1");
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("propagates the failure when a Plane3V1 has a zero normal", () => {
    const result = planeEquationsFromPlane3(
      makePlane("plz", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("keeps the worst residual component honest in isPointOnLine", () => {
    const outcome = unwrapCoreResult(
      isPointOnLine(
        approxVec("2.0000000001", "4", "6"),
        makeLine("l2", approxVec("0", "0", "0"), vec("1", "2", "3")),
      ),
    );
    expect(outcome.result.classification).toBe("on-line");
    expect(outcome.result.exact).toBe(false);
  });

  it("honours an explicit tolerance override in membership tests", () => {
    const outcome = unwrapCoreResult(
      isPointInPlane(vec("3", "0", "0"), makePlane("pl", vec("1", "0", "1"), vec("1", "2", "2")), {
        tolerance: { absolute: 0.001, relative: 0.001 },
      }),
    );
    expect(outcome.result.classification).toBe("in-plane");
  });
});

describe("equations approximate paths with tolerance overrides", () => {
  const OVERRIDE = { tolerance: { absolute: 0.001, relative: 0.001 } } as const;

  it("lineEquationsFromPointDirection records the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      lineEquationsFromPointDirection(approxVec("1", "2", "3"), vec("1", "0", "2"), OVERRIDE),
    );
    expect(outcome.result.exact).toBe(false);
    expect(outcome.result.tolerance).toEqual({ absolute: 0.001, relative: 0.001 });
  });

  it("lineEquationsFromTwoPoints validates with the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      lineEquationsFromTwoPoints(approxVec("0", "0", "0"), approxVec("1", "2", "3"), OVERRIDE),
    );
    expect(outcome.result.exact).toBe(false);
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("planeEquationsFromPointNormal validates with the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      planeEquationsFromPointNormal(approxVec("1", "0", "1"), approxVec("1", "2", "2"), OVERRIDE),
    );
    expect(outcome.result.exact).toBe(false);
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("planeEquationsFromPointDirections validates with the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      planeEquationsFromPointDirections(
        approxVec("0", "0", "0"),
        approxVec("1", "0", "0"),
        approxVec("0", "1", "0"),
        OVERRIDE,
      ),
    );
    expect(outcome.result.exact).toBe(false);
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("planeEquationsFromThreePoints validates with the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      planeEquationsFromThreePoints(
        approxVec("1", "0", "0"),
        approxVec("0", "1", "0"),
        approxVec("0", "0", "1"),
        OVERRIDE,
      ),
    );
    expect(outcome.result.exact).toBe(false);
    expect(outcome.validation.every((record) => record.passed)).toBe(true);
  });

  it("isPointOnLine records the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      isPointOnLine(
        approxVec("2", "4", "6.0000000001"),
        makeLine("l2", approxVec("0", "0", "0"), vec("1", "2", "3")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("on-line");
    expect(outcome.result.exact).toBe(false);
    expect(outcome.result.tolerance).toEqual({ absolute: 0.001, relative: 0.001 });
  });

  it("isPointInPlane records the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      isPointInPlane(
        approxVec("3.0000000001", "0", "0"),
        makePlane("pl", vec("1", "0", "1"), vec("1", "2", "2")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("in-plane");
    expect(outcome.result.tolerance).toEqual({ absolute: 0.001, relative: 0.001 });
  });
});
