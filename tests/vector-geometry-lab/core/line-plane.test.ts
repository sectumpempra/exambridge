import type { Line3V1, Plane3V1 } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  exactLineFromLine3,
  exactVectorFromInts,
  normalizeLine,
  normalizePlaneEquation,
  planeEquationFromPlane3,
  planeEquationFromPointNormal,
  planeEquationsEquivalent,
  primitiveIntegerDirection,
  rational,
  unwrapCoreResult,
} from "@/features/vector-geometry-lab/core";
import type { PlaneEquation } from "@/features/vector-geometry-lab/core";
import { approxVec, vec } from "./helpers.js";

function makeLine(
  lineId: string,
  point: ReturnType<typeof vec>,
  direction: ReturnType<typeof vec>,
): Line3V1 {
  return {
    lineId,
    label: lineId,
    point: { pointId: `${lineId}-p`, label: "P", position: point },
    direction,
  };
}

describe("primitiveIntegerDirection", () => {
  it("reduces integer vectors", () => {
    const { direction, scale } = primitiveIntegerDirection(exactVectorFromInts(2, 4, 6));
    expect(direction).toEqual(exactVectorFromInts(1, 2, 3));
    expect(scale).toEqual(rational(2));
  });

  it("forces the first non-zero component positive", () => {
    const { direction, scale } = primitiveIntegerDirection(
      exactVectorFromInts(-2, -4, -6),
    );
    expect(direction).toEqual(exactVectorFromInts(1, 2, 3));
    expect(scale).toEqual(rational(-2));
    const second = primitiveIntegerDirection(exactVectorFromInts(0, -3, 0));
    expect(second.direction).toEqual(exactVectorFromInts(0, 1, 0));
    expect(second.scale).toEqual(rational(-3));
  });

  it("clears fractional denominators via lcm", () => {
    const { direction, scale } = primitiveIntegerDirection({
      x: rational(1, 2),
      y: rational(1, 3),
      z: rational(0),
    });
    expect(direction).toEqual(exactVectorFromInts(3, 2, 0));
    expect(scale).toEqual(rational(1, 6));
  });

  it("passes the zero vector through with unit scale", () => {
    const { direction, scale } = primitiveIntegerDirection(exactVectorFromInts(0, 0, 0));
    expect(direction).toEqual(exactVectorFromInts(0, 0, 0));
    expect(scale).toEqual(rational(1));
  });
});

describe("normalizeLine", () => {
  it("unitizes a rational-norm direction exactly", () => {
    const line = makeLine("L1", vec("1", "0", "0"), vec("3", "4", "0"));
    const result = unwrapCoreResult(normalizeLine(line));
    expect(result.directionUnitized).toBe(true);
    expect(result.direction).toEqual({
      x: rational(3, 5),
      y: rational(4, 5),
      z: rational(0),
    });
    expect(result.directionNorm).toEqual({ coefficient: rational(5), radicand: 1n });
    expect(result.unitDirection?.x).toEqual({ coefficient: rational(3, 5), radicand: 1n });
    expect(result.exact).toBe(true);
    expect(result.note).toContain("rational norm");
  });

  it("keeps the primitive integer direction when the norm is irrational", () => {
    const line = makeLine("L2", vec("0", "0", "0"), vec("2", "4", "0"));
    const result = unwrapCoreResult(normalizeLine(line));
    expect(result.directionUnitized).toBe(false);
    expect(result.direction).toEqual(exactVectorFromInts(1, 2, 0));
    expect(result.directionNorm).toEqual({ coefficient: rational(2), radicand: 5n });
    expect(result.unitDirection?.x).toEqual({ coefficient: rational(1, 5), radicand: 5n });
    expect(result.note).toContain("irrational");
    expect(result.note).toContain("(1, 2, 0)");
  });

  it("keeps the base point as the parameter anchor", () => {
    const line = makeLine("L3", vec("1/2", "-3", "2.5"), vec("1", "1", "0"));
    const result = unwrapCoreResult(normalizeLine(line));
    expect(result.point).toEqual({
      x: rational(1, 2),
      y: rational(-3),
      z: rational(5, 2),
    });
  });

  it("REFUSES a zero direction structurally (no silent repair)", () => {
    const line = makeLine("L4", vec("0", "0", "0"), vec("0", "0", "0"));
    const result = normalizeLine(line);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
      expect(result.error.details?.["lineId"]).toBe("L4");
    }
  });

  it("carries approximate directions with a recorded tolerance", () => {
    const line = makeLine("L5", vec("0", "0", "0"), approxVec("1.414214", "0", "0"));
    const result = unwrapCoreResult(normalizeLine(line));
    expect(result.exact).toBe(false);
    expect(result.directionUnitized).toBe(false);
    expect(result.tolerance).toBeDefined();
    expect(result.directionNorm).toBeUndefined();
    expect(result.directionNormApprox).toBeCloseTo(1.414214, 9);
    expect(result.note).toContain("approximate");
  });

  it("is deterministic", () => {
    const line = makeLine("L6", vec("1", "2", "3"), vec("2", "4", "0"));
    expect(normalizeLine(line)).toEqual(normalizeLine(line));
  });
});

describe("plane equations", () => {
  it("builds r·n = d from point and normal", () => {
    const equation = unwrapCoreResult(
      planeEquationFromPointNormal(
        exactVectorFromInts(1, 2, 3),
        exactVectorFromInts(4, 5, 6),
      ),
    );
    expect(equation.d).toEqual(rational(32));
    expect(equation.normal).toEqual(exactVectorFromInts(4, 5, 6));
  });

  it("REFUSES a zero normal", () => {
    const result = planeEquationFromPointNormal(
      exactVectorFromInts(1, 2, 3),
      exactVectorFromInts(0, 0, 0),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("builds from a schema plane entity", () => {
    const plane: Plane3V1 = {
      planeId: "P1",
      label: "P1",
      point: { pointId: "P1-p", label: "A", position: vec("1", "1", "1") },
      normal: vec("2", "0", "0"),
    };
    const equation = unwrapCoreResult(planeEquationFromPlane3(plane));
    expect(equation.d).toEqual(rational(2));
  });

  it("surfaces the plane id when its normal is zero", () => {
    const plane: Plane3V1 = {
      planeId: "P2",
      label: "P2",
      point: { pointId: "P2-p", label: "A", position: vec("0", "0", "0") },
      normal: vec("0", "0", "0"),
    };
    const result = planeEquationFromPlane3(plane);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.["planeId"]).toBe("P2");
    }
  });
});

describe("normalizePlaneEquation", () => {
  it("reduces to primitive integers", () => {
    const normalized = unwrapCoreResult(
      normalizePlaneEquation({
        normal: exactVectorFromInts(2, 4, 6),
        d: rational(8),
      }),
    );
    expect(normalized.normal).toEqual(exactVectorFromInts(1, 2, 3));
    expect(normalized.d).toEqual(rational(4));
    expect(normalized.scale).toEqual(rational(2));
  });

  it("forces the first non-zero normal component positive", () => {
    const normalized = unwrapCoreResult(
      normalizePlaneEquation({
        normal: exactVectorFromInts(-1, -2, -3),
        d: rational(-4),
      }),
    );
    expect(normalized.normal).toEqual(exactVectorFromInts(1, 2, 3));
    expect(normalized.d).toEqual(rational(4));
    expect(normalized.scale).toEqual(rational(-1));
  });

  it("clears fractions", () => {
    // (1/2)x + (1/4)y = 1/8 → ×8 → 4x + 2y = 1 (gcd of (4,2,0,1) is 1).
    const normalized = unwrapCoreResult(
      normalizePlaneEquation({
        normal: { x: rational(1, 2), y: rational(1, 4), z: rational(0) },
        d: rational(1, 8),
      }),
    );
    expect(normalized.normal).toEqual(exactVectorFromInts(4, 2, 0));
    expect(normalized.d).toEqual(rational(1));
  });

  it("REFUSES a zero normal", () => {
    expect(
      normalizePlaneEquation({ normal: exactVectorFromInts(0, 0, 0), d: rational(1) }).ok,
    ).toBe(false);
  });

  it("is invariant under whole-equation scaling (spec §9)", () => {
    const base: PlaneEquation = {
      normal: exactVectorFromInts(1, -2, 3),
      d: rational(4),
    };
    const reference = unwrapCoreResult(normalizePlaneEquation(base));
    for (const factor of [rational(7), rational(-3), rational(2, 5), rational(-1, 9)]) {
      const scaled: PlaneEquation = {
        normal: {
          x: times(factor, 1),
          y: times(factor, -2),
          z: times(factor, 3),
        },
        d: times(factor, 4),
      };
      const normalized = unwrapCoreResult(normalizePlaneEquation(scaled));
      expect(normalized.normal).toEqual(reference.normal);
      expect(normalized.d).toEqual(reference.d);
    }
  });
});

function times(factor: ReturnType<typeof rational>, value: number): ReturnType<typeof rational> {
  return rational(factor.numerator * BigInt(value), factor.denominator);
}

describe("planeEquationsEquivalent", () => {
  const base: PlaneEquation = {
    normal: exactVectorFromInts(1, -2, 3),
    d: rational(4),
  };

  it("treats non-zero multiples as the same plane", () => {
    const scaled: PlaneEquation = {
      normal: exactVectorFromInts(-3, 6, -9),
      d: rational(-12),
    };
    expect(unwrapCoreResult(planeEquationsEquivalent(base, scaled))).toBe(true);
  });

  it("distinguishes different constants and different normals", () => {
    expect(
      unwrapCoreResult(
        planeEquationsEquivalent(base, { normal: base.normal, d: rational(5) }),
      ),
    ).toBe(false);
    expect(
      unwrapCoreResult(
        planeEquationsEquivalent(base, {
          normal: exactVectorFromInts(1, -2, 4),
          d: rational(4),
        }),
      ),
    ).toBe(false);
  });

  it("refuses zero normals on either side", () => {
    const zero: PlaneEquation = {
      normal: exactVectorFromInts(0, 0, 0),
      d: rational(0),
    };
    expect(planeEquationsEquivalent(zero, base).ok).toBe(false);
    expect(planeEquationsEquivalent(base, zero).ok).toBe(false);
  });
});

describe("exactLineFromLine3", () => {
  it("extracts exact provenance", () => {
    const line = makeLine("L7", vec("1", "2", "3"), vec("1", "0", "0"));
    const extracted = exactLineFromLine3(line);
    expect(extracted.exact).toBe(true);
    expect(extracted.point).toEqual(exactVectorFromInts(1, 2, 3));
  });

  it("flags approximate provenance", () => {
    const line = makeLine("L8", approxVec("0", "0", "0"), vec("1", "0", "0"));
    expect(exactLineFromLine3(line).exact).toBe(false);
  });
});
