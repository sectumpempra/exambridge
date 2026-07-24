import { describe, expect, it } from "vitest";

import {
  addVectors,
  crossProduct,
  determinant3x3,
  dotProduct,
  exactVectorFromInts,
  isZeroRational,
  matrix2x2,
  matrix3x3,
  multiplyRationals,
  normalizeLine,
  normalizePlaneEquation,
  projectVector,
  rational,
  rationalsEqual,
  rejectVector,
  scalarTripleProduct,
  solveLinearSystem2x2,
  squareRadical,
  squaredNorm,
  subtractRationals,
  unwrapCoreResult,
  vectorNorm,
  ZERO_EXACT_VECTOR,
} from "@/features/vector-geometry-lab/core";
import type { ExactVector3 } from "@/features/vector-geometry-lab/core";
import { mulberry32, randomRational, randomVector } from "./helpers.js";
import { vec } from "./helpers.js";

/**
 * Algebraic-identity property tests over random rational vectors. The PRNG
 * is seeded (mulberry32), so every run is fully reproducible; the identities
 * themselves are theorems, so any failure is a real bug.
 */

const SEED = 20260716;
const ITERATIONS = 60;

function nonZeroVector(rand: () => number): ExactVector3 {
  for (;;) {
    const candidate = randomVector(rand);
    if (!isZeroRational(squaredNorm(candidate))) {
      return candidate;
    }
  }
}

describe("algebraic identities (seeded random rationals)", () => {
  it("dot product is commutative: a·b = b·a", () => {
    const rand = mulberry32(SEED);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const a = randomVector(rand);
      const b = randomVector(rand);
      expect(rationalsEqual(dotProduct(a, b), dotProduct(b, a))).toBe(true);
    }
  });

  it("cross product is anti-commutative: a×b = −(b×a)", () => {
    const rand = mulberry32(SEED + 1);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const a = randomVector(rand);
      const b = randomVector(rand);
      const ab = crossProduct(a, b);
      const ba = crossProduct(b, a);
      expect(rationalsEqual(addVectors(ab, ba).x, rational(0))).toBe(true);
      expect(rationalsEqual(addVectors(ab, ba).y, rational(0))).toBe(true);
      expect(rationalsEqual(addVectors(ab, ba).z, rational(0))).toBe(true);
    }
  });

  it("cross product is orthogonal to both operands", () => {
    const rand = mulberry32(SEED + 2);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const a = randomVector(rand);
      const b = randomVector(rand);
      const cross = crossProduct(a, b);
      expect(isZeroRational(dotProduct(cross, a))).toBe(true);
      expect(isZeroRational(dotProduct(cross, b))).toBe(true);
    }
  });

  it("scalar triple product is cyclically invariant", () => {
    const rand = mulberry32(SEED + 3);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const a = randomVector(rand);
      const b = randomVector(rand);
      const c = randomVector(rand);
      const reference = scalarTripleProduct(a, b, c);
      expect(rationalsEqual(scalarTripleProduct(b, c, a), reference)).toBe(true);
      expect(rationalsEqual(scalarTripleProduct(c, a, b), reference)).toBe(true);
    }
  });

  it("triple product equals the 3×3 determinant of the rows", () => {
    const rand = mulberry32(SEED + 4);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const a = randomVector(rand);
      const b = randomVector(rand);
      const c = randomVector(rand);
      const det = determinant3x3(
        matrix3x3(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z),
      );
      expect(rationalsEqual(scalarTripleProduct(a, b, c), det)).toBe(true);
    }
  });

  it("projection + rejection reconstructs the original vector", () => {
    const rand = mulberry32(SEED + 5);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const a = randomVector(rand);
      const onto = nonZeroVector(rand);
      const projection = unwrapCoreResult(projectVector(a, onto));
      const rejection = unwrapCoreResult(rejectVector(a, onto));
      const recombined = addVectors(projection, rejection);
      expect(rationalsEqual(recombined.x, a.x)).toBe(true);
      expect(rationalsEqual(recombined.y, a.y)).toBe(true);
      expect(rationalsEqual(recombined.z, a.z)).toBe(true);
      // and the rejection is exactly perpendicular to `onto`
      expect(isZeroRational(dotProduct(rejection, onto))).toBe(true);
    }
  });

  it("Lagrange identity: |a×b|² = |a|²|b|² − (a·b)²  (the sin²θ form)", () => {
    const rand = mulberry32(SEED + 6);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const a = randomVector(rand);
      const b = randomVector(rand);
      const lhs = squaredNorm(crossProduct(a, b));
      const dot = dotProduct(a, b);
      const rhs = subtractRationals(
        multiplyRationals(squaredNorm(a), squaredNorm(b)),
        multiplyRationals(dot, dot),
      );
      expect(rationalsEqual(lhs, rhs)).toBe(true);
    }
  });

  it("norm is consistent with the squared norm: (norm v)² = |v|²", () => {
    const rand = mulberry32(SEED + 7);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const v = randomVector(rand);
      expect(rationalsEqual(squareRadical(vectorNorm(v)), squaredNorm(v))).toBe(true);
    }
  });

  it(" seeded sequences are reproducible run-to-run", () => {
    const first = mulberry32(SEED + 8);
    const second = mulberry32(SEED + 8);
    for (let i = 0; i < ITERATIONS; i += 1) {
      expect(randomRational(first)).toEqual(randomRational(second));
    }
  });
});

describe("determinism of higher-level solvers", () => {
  it("solveLinearSystem2x2 is deeply deterministic", () => {
    const matrix = matrix2x2(rational(3), rational(-1), rational(2), rational(5));
    const rhs: [ReturnType<typeof rational>, ReturnType<typeof rational>] = [
      rational(4),
      rational(7),
    ];
    expect(solveLinearSystem2x2(matrix, rhs)).toEqual(
      solveLinearSystem2x2(matrix, rhs),
    );
  });

  it("normalizeLine is deeply deterministic", () => {
    const line = {
      lineId: "det",
      label: "det",
      point: { pointId: "det-p", label: "P", position: vec("1", "2", "3") },
      direction: vec("2", "-4", "6"),
    };
    expect(normalizeLine(line)).toEqual(normalizeLine(line));
  });

  it("normalizePlaneEquation is invariant under random non-zero scaling", () => {
    const rand = mulberry32(SEED + 9);
    const base = {
      normal: exactVectorFromInts(2, -3, 6),
      d: rational(5),
    };
    const reference = unwrapCoreResult(normalizePlaneEquation(base));
    for (let i = 0; i < ITERATIONS; i += 1) {
      let factor = randomRational(rand);
      if (isZeroRational(factor)) {
        factor = rational(1);
      }
      const scaled = {
        normal: {
          x: rational(2n * factor.numerator, factor.denominator),
          y: rational(-3n * factor.numerator, factor.denominator),
          z: rational(6n * factor.numerator, factor.denominator),
        },
        d: rational(5n * factor.numerator, factor.denominator),
      };
      const normalized = unwrapCoreResult(normalizePlaneEquation(scaled));
      expect(normalized.normal).toEqual(reference.normal);
      expect(normalized.d).toEqual(reference.d);
    }
  });

  it("zero operands stay zero under the identities (boundary case)", () => {
    const a = ZERO_EXACT_VECTOR;
    const b = exactVectorFromInts(1, -2, 3);
    expect(isZeroRational(squaredNorm(crossProduct(a, b)))).toBe(true);
    expect(isZeroRational(dotProduct(a, b))).toBe(true);
    expect(isZeroRational(scalarTripleProduct(a, b, b))).toBe(true);
  });
});
