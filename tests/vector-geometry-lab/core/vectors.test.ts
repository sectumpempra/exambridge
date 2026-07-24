import { describe, expect, it } from "vitest";

import {
  addVectors,
  crossProduct,
  divideVectorByScalar,
  dotProduct,
  exactVector,
  exactVectorFromInts,
  exactVectorFromVector3,
  exactVectorsEqual,
  formatExactVector,
  isZeroExactVector,
  mapExactVector,
  negateRational,
  negateVector,
  normalizeVector,
  projectVector,
  rational,
  rejectVector,
  scalarTripleProduct,
  scaleVector,
  squaredNorm,
  subtractVectors,
  unwrapCoreResult,
  vector3FromExactVector,
  vectorNorm,
  ZERO_EXACT_VECTOR,
} from "@/features/vector-geometry-lab/core";
import { approx, sc, vec } from "./helpers.js";

describe("vector arithmetic", () => {
  const a = exactVectorFromInts(1, 2, 3);
  const b = exactVectorFromInts(4, -5, 6);

  it("adds, subtracts, negates, scales", () => {
    expect(addVectors(a, b)).toEqual(exactVectorFromInts(5, -3, 9));
    expect(subtractVectors(a, b)).toEqual(exactVectorFromInts(-3, 7, -3));
    expect(negateVector(a)).toEqual(exactVectorFromInts(-1, -2, -3));
    expect(scaleVector(a, rational(3, 2))).toEqual(
      exactVector(rational(3, 2), rational(3), rational(9, 2)),
    );
  });

  it("computes dot and cross products", () => {
    expect(dotProduct(a, b)).toEqual(rational(1 * 4 + 2 * -5 + 3 * 6));
    expect(crossProduct(a, b)).toEqual(
      exactVectorFromInts(2 * 6 - 3 * -5, 3 * 4 - 1 * 6, 1 * -5 - 2 * 4),
    );
    expect(crossProduct(a, b)).toEqual(exactVectorFromInts(27, 6, -13));
  });

  it("computes the scalar triple product", () => {
    const c = exactVectorFromInts(0, 1, -1);
    // b×c = (-1, 4, 4); a·(b×c) = -1 + 8 + 12 = 19.
    expect(scalarTripleProduct(a, b, c)).toEqual(rational(19));
    expect(scalarTripleProduct(a, b, c)).toEqual(dotProduct(a, crossProduct(b, c)));
  });

  it("computes squared norms", () => {
    expect(squaredNorm(a)).toEqual(rational(14));
    expect(squaredNorm(ZERO_EXACT_VECTOR)).toEqual(rational(0));
  });

  it("divides by a non-zero scalar", () => {
    expect(divideVectorByScalar(exactVectorFromInts(2, 4, 6), rational(2))).toEqual(
      exactVectorFromInts(1, 2, 3),
    );
  });

  it("maps components", () => {
    expect(mapExactVector(a, negateRational)).toEqual(negateVector(a));
  });

  it("compares exactly", () => {
    expect(exactVectorsEqual(a, exactVectorFromInts(1, 2, 3))).toBe(true);
    expect(exactVectorsEqual(a, b)).toBe(false);
    expect(isZeroExactVector(ZERO_EXACT_VECTOR)).toBe(true);
    expect(isZeroExactVector(a)).toBe(false);
  });

  it("formats canonically", () => {
    expect(formatExactVector(a)).toBe("(1, 2, 3)");
    expect(formatExactVector(exactVector(rational(1, 2), rational(-3), rational(0)))).toBe(
      "(1/2, -3, 0)",
    );
  });

  it("handles 30-digit components exactly", () => {
    const big = 10n ** 30n;
    const huge = exactVector(rational(big), rational(big + 1n), rational(-big));
    const unit = exactVectorFromInts(1, 0, 0);
    expect(dotProduct(huge, unit)).toEqual(rational(big));
    expect(crossProduct(unit, huge)).toEqual(
      exactVector(rational(0), rational(big), rational(big + 1n)),
    );
  });
});

describe("vectorNorm", () => {
  it("returns a rational radical when the norm is rational", () => {
    const norm = vectorNorm(exactVectorFromInts(3, 4, 0));
    expect(norm).toEqual({ coefficient: rational(5), radicand: 1n });
  });

  it("returns an exact radical for irrational norms", () => {
    expect(vectorNorm(exactVectorFromInts(1, 1, 0))).toEqual({
      coefficient: rational(1),
      radicand: 2n,
    });
    expect(vectorNorm(exactVectorFromInts(1, 1, 1))).toEqual({
      coefficient: rational(1),
      radicand: 3n,
    });
    expect(vectorNorm(exactVectorFromInts(1, 2, 2))).toEqual({
      coefficient: rational(3),
      radicand: 1n,
    });
  });

  it("normalizes zero to the canonical zero radical", () => {
    expect(vectorNorm(ZERO_EXACT_VECTOR)).toEqual({
      coefficient: rational(0),
      radicand: 1n,
    });
  });

  it("surfaces the reduction safety valve as a RangeError", () => {
    // |(1,8,0)|² = 65 = 5·13 forces more than 3 trial divisions.
    expect(() =>
      vectorNorm(exactVectorFromInts(1, 8, 0), { maxTrialDivisions: 3 }),
    ).toThrow(RangeError);
  });
});

describe("normalizeVector", () => {
  it("unitizes rational-norm vectors into rational components", () => {
    const result = unwrapCoreResult(normalizeVector(exactVectorFromInts(3, 4, 0)));
    expect(result.norm).toEqual({ coefficient: rational(5), radicand: 1n });
    expect(result.unit.x).toEqual({ coefficient: rational(3, 5), radicand: 1n });
    expect(result.unit.y).toEqual({ coefficient: rational(4, 5), radicand: 1n });
    expect(result.unit.z).toEqual({ coefficient: rational(0), radicand: 1n });
  });

  it("unitizes irrational-norm vectors into radical components", () => {
    const result = unwrapCoreResult(normalizeVector(exactVectorFromInts(1, 1, 0)));
    expect(result.norm).toEqual({ coefficient: rational(1), radicand: 2n });
    expect(result.unit.x).toEqual({ coefficient: rational(1, 2), radicand: 2n });
    expect(result.unit.z).toEqual({ coefficient: rational(0), radicand: 1n });
  });

  it("REFUSES the zero vector structurally (never NaN)", () => {
    const result = normalizeVector(ZERO_EXACT_VECTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });
});

describe("projection / rejection", () => {
  it("projects onto an axis", () => {
    const a = exactVectorFromInts(2, 2, 0);
    const onto = exactVectorFromInts(1, 0, 0);
    expect(unwrapCoreResult(projectVector(a, onto))).toEqual(exactVectorFromInts(2, 0, 0));
    expect(unwrapCoreResult(rejectVector(a, onto))).toEqual(exactVectorFromInts(0, 2, 0));
  });

  it("project + rejection reconstructs the original vector", () => {
    const a = exactVector(rational(3, 2), rational(-7, 3), rational(5));
    const onto = exactVectorFromInts(2, -1, 4);
    const projection = unwrapCoreResult(projectVector(a, onto));
    const rejection = unwrapCoreResult(rejectVector(a, onto));
    expect(addVectors(projection, rejection)).toEqual(a);
  });

  it("REFUSES projection onto the zero vector", () => {
    const result = projectVector(exactVectorFromInts(1, 2, 3), ZERO_EXACT_VECTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
    const rejection = rejectVector(exactVectorFromInts(1, 2, 3), ZERO_EXACT_VECTOR);
    expect(rejection.ok).toBe(false);
  });
});

describe("Vector3V1 interop", () => {
  it("round-trips exact vectors losslessly", () => {
    const original = vec("3", "1/2", "-2.5");
    const { vector, exact } = exactVectorFromVector3(original);
    expect(exact).toBe(true);
    const back = vector3FromExactVector(vector);
    expect(back).toEqual({
      x: sc("3"),
      y: sc("1/2"),
      z: sc("-5/2"),
    });
  });

  it("propagates approximate provenance", () => {
    const approximate = {
      x: approx("sqrt(2)", "1.414214"),
      y: sc("2"),
      z: sc("3"),
    };
    const { vector, exact } = exactVectorFromVector3(approximate);
    expect(exact).toBe(false);
    const back = vector3FromExactVector(vector, { exact: false });
    expect(back.x.exact).toBe(false);
    expect(back.y.exact).toBe(false);
    expect(back.z.exact).toBe(false);
  });

  it("is deterministic for identical input", () => {
    const v = vec("1/3", "2", "-4/5");
    expect(exactVectorFromVector3(v)).toEqual(exactVectorFromVector3(v));
  });
});
