import { approximateScalar, scalarFromLiteral } from "@/features/vector-geometry-lab/schema";
import type { ScalarV1, Vector3V1 } from "@/features/vector-geometry-lab/schema";

import { rational } from "@/features/vector-geometry-lab/core";
import type { ExactRational, ExactVector3 } from "@/features/vector-geometry-lab/core";

/** Parses an exact scalar literal; fails the test on rejection. */
export function sc(literal: string): ScalarV1 {
  const result = scalarFromLiteral(literal);
  if (!result.ok) {
    throw new Error(`test setup failed: literal ${literal} rejected`);
  }
  return result.value;
}

/** Builds an approximate (exact:false) scalar carrier. */
export function approx(input: string, approximation: string): ScalarV1 {
  const result = approximateScalar(input, approximation);
  if (!result.ok) {
    throw new Error(`test setup failed: approximation ${approximation} rejected`);
  }
  return result.value;
}

/** Vector3V1 from three exact literals. */
export function vec(x: string, y: string, z: string): Vector3V1 {
  return { x: sc(x), y: sc(y), z: sc(z) };
}

/** Vector3V1 with one approximate component (mixed provenance). */
export function approxVec(x: string, y: string, z: string): Vector3V1 {
  return { x: approx(x, x), y: approx(y, y), z: approx(z, z) };
}

/**
 * Deterministic PRNG (mulberry32) for property tests — fixed seeds make
 * every run reproducible.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random rational with small integer numerator/denominator. */
export function randomRational(rand: () => number): ExactRational {
  const numerator = Math.floor(rand() * 41) - 20;
  const denominator = Math.floor(rand() * 9) + 1;
  return rational(numerator, denominator);
}

export function randomVector(rand: () => number): ExactVector3 {
  return {
    x: randomRational(rand),
    y: randomRational(rand),
    z: randomRational(rand),
  };
}
