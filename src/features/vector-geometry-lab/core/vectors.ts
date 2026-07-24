import type { Vector3V1 } from "@/features/vector-geometry-lab/schema";

import type { CoreResult } from "./errors.js";
import { coreFail, coreOk } from "./errors.js";
import type { ExactRadical, RadicalReductionOptions } from "./radical.js";
import {
  divideRationalByRadical,
  radicalFromRationalSquare,
} from "./radical.js";
import type { ExactRational } from "./rational.js";
import {
  addRationals,
  divideRationalsUnsafe,
  formatRational,
  isZeroRational,
  multiplyRationals,
  rational,
  rationalFromScalar,
  rationalsEqual,
  scalarFromRational,
  subtractRationals,
} from "./rational.js";

/**
 * Exact 3D vector arithmetic over ExactRational components (spec §4).
 * Every operation is pure bigint rational arithmetic: same input → same
 * output, forever. Nothing in this file knows about rendering, the DOM, or
 * floating point (except the explicitly documented tolerance helpers in
 * tolerance.ts / relations.ts).
 */

export interface ExactVector3 {
  readonly x: ExactRational;
  readonly y: ExactRational;
  readonly z: ExactRational;
}

/** Vector whose components are exact radicals (unit vectors, distances). */
export interface RadicalVector3 {
  readonly x: ExactRadical;
  readonly y: ExactRadical;
  readonly z: ExactRadical;
}

export function exactVector(
  x: ExactRational,
  y: ExactRational,
  z: ExactRational,
): ExactVector3 {
  return { x, y, z };
}

export function exactVectorFromInts(
  x: bigint | number,
  y: bigint | number,
  z: bigint | number,
): ExactVector3 {
  return { x: rational(x), y: rational(y), z: rational(z) };
}

export const ZERO_EXACT_VECTOR: ExactVector3 = Object.freeze(
  exactVectorFromInts(0, 0, 0),
);

/* --------------------------------------------------------------------------
 * Vector3V1 interop
 * ------------------------------------------------------------------------ */

/**
 * Converts a schema vector to exact form. `exact` in the result reports the
 * provenance: false when ANY component was an approximate (exact:false)
 * carrier — the arithmetic is still performed on the carried rationals, but
 * downstream comparisons must take the tolerance path.
 */
export function exactVectorFromVector3(vector: Vector3V1): {
  readonly vector: ExactVector3;
  readonly exact: boolean;
} {
  return {
    vector: {
      x: rationalFromScalar(vector.x),
      y: rationalFromScalar(vector.y),
      z: rationalFromScalar(vector.z),
    },
    exact: vector.x.exact && vector.y.exact && vector.z.exact,
  };
}

/**
 * Converts back to a schema vector with regenerated canonical literals.
 * `exact` defaults to true; pass false to propagate approximate provenance.
 */
export function vector3FromExactVector(
  vector: ExactVector3,
  options?: { readonly exact?: boolean },
): Vector3V1 {
  const exact = options?.exact ?? true;
  return {
    x: scalarFromRational(vector.x, { exact }),
    y: scalarFromRational(vector.y, { exact }),
    z: scalarFromRational(vector.z, { exact }),
  };
}

/* --------------------------------------------------------------------------
 * Arithmetic
 * ------------------------------------------------------------------------ */

export function addVectors(a: ExactVector3, b: ExactVector3): ExactVector3 {
  return {
    x: addRationals(a.x, b.x),
    y: addRationals(a.y, b.y),
    z: addRationals(a.z, b.z),
  };
}

export function subtractVectors(a: ExactVector3, b: ExactVector3): ExactVector3 {
  return {
    x: subtractRationals(a.x, b.x),
    y: subtractRationals(a.y, b.y),
    z: subtractRationals(a.z, b.z),
  };
}

export function negateVector(v: ExactVector3): ExactVector3 {
  return {
    x: rational(-v.x.numerator, v.x.denominator),
    y: rational(-v.y.numerator, v.y.denominator),
    z: rational(-v.z.numerator, v.z.denominator),
  };
}

export function scaleVector(v: ExactVector3, scalar: ExactRational): ExactVector3 {
  return {
    x: multiplyRationals(v.x, scalar),
    y: multiplyRationals(v.y, scalar),
    z: multiplyRationals(v.z, scalar),
  };
}

export function dotProduct(a: ExactVector3, b: ExactVector3): ExactRational {
  return addRationals(
    addRationals(multiplyRationals(a.x, b.x), multiplyRationals(a.y, b.y)),
    multiplyRationals(a.z, b.z),
  );
}

export function crossProduct(a: ExactVector3, b: ExactVector3): ExactVector3 {
  return {
    x: subtractRationals(multiplyRationals(a.y, b.z), multiplyRationals(a.z, b.y)),
    y: subtractRationals(multiplyRationals(a.z, b.x), multiplyRationals(a.x, b.z)),
    z: subtractRationals(multiplyRationals(a.x, b.y), multiplyRationals(a.y, b.x)),
  };
}

export function scalarTripleProduct(
  a: ExactVector3,
  b: ExactVector3,
  c: ExactVector3,
): ExactRational {
  return dotProduct(a, crossProduct(b, c));
}

export function squaredNorm(v: ExactVector3): ExactRational {
  return dotProduct(v, v);
}

export function isZeroExactVector(v: ExactVector3): boolean {
  return isZeroRational(v.x) && isZeroRational(v.y) && isZeroRational(v.z);
}

export function exactVectorsEqual(a: ExactVector3, b: ExactVector3): boolean {
  return (
    rationalsEqual(a.x, b.x) &&
    rationalsEqual(a.y, b.y) &&
    rationalsEqual(a.z, b.z)
  );
}

/**
 * Exact norm √(x² + y² + z²) as an ExactRadical (radicand 1 = rational).
 * The radicand is a sum of squares, so it can never be negative; the only
 * conceivable failure is the square-factor safety valve on astronomically
 * large inputs, which surfaces as a RangeError (documented internal guard).
 */
export function vectorNorm(
  v: ExactVector3,
  options?: RadicalReductionOptions,
): ExactRadical {
  const radical = radicalFromRationalSquare(squaredNorm(v), options);
  if (!radical.ok) {
    throw new RangeError(radical.error.message);
  }
  return radical.value;
}

export interface NormalizedVector {
  /** Exact unit vector; components may be radical (e.g. (1/2)√2). */
  readonly unit: RadicalVector3;
  readonly norm: ExactRadical;
}

/**
 * Unit vector. The zero vector is explicitly REFUSED with a structured
 * "zero-vector" failure — never NaN, never a fake direction (spec §2/§4).
 */
export function normalizeVector(
  v: ExactVector3,
  options?: RadicalReductionOptions,
): CoreResult<NormalizedVector> {
  if (isZeroExactVector(v)) {
    return coreFail(
      "zero-vector",
      "cannot normalize the zero vector: direction is undefined",
      { vector: formatExactVector(v) },
    );
  }
  const norm = vectorNorm(v, options);
  return coreOk({
    unit: {
      x: divideRationalByRadical(v.x, norm),
      y: divideRationalByRadical(v.y, norm),
      z: divideRationalByRadical(v.z, norm),
    },
    norm,
  });
}

/**
 * Projection of `a` onto `onto`: proj = (a·onto / onto·onto)·onto.
 * Projecting onto the zero vector is undefined → structured failure.
 */
export function projectVector(
  a: ExactVector3,
  onto: ExactVector3,
): CoreResult<ExactVector3> {
  const denominator = squaredNorm(onto);
  if (isZeroRational(denominator)) {
    return coreFail(
      "zero-vector",
      "cannot project onto the zero vector",
      { onto: formatExactVector(onto) },
    );
  }
  return coreOk(
    scaleVector(onto, divideRationalsUnsafe(dotProduct(a, onto), denominator)),
  );
}

/** Rejection: the component of `a` perpendicular to `onto` (a − proj). */
export function rejectVector(
  a: ExactVector3,
  onto: ExactVector3,
): CoreResult<ExactVector3> {
  const projection = projectVector(a, onto);
  if (!projection.ok) {
    return projection;
  }
  return coreOk(subtractVectors(a, projection.value));
}

/** Re-exported so angle code (Stage 3) never divides silently. */
export function divideVectorByScalar(
  v: ExactVector3,
  scalar: ExactRational,
): ExactVector3 {
  return scaleVector(v, divideRationalsUnsafe(rational(1n), scalar));
}

/** "(x, y, z)" with canonical rational components — for derivation text. */
export function formatExactVector(v: ExactVector3): string {
  return `(${formatRational(v.x)}, ${formatRational(v.y)}, ${formatRational(v.z)})`;
}

/** Internal helper used by plane/line modules; kept tiny and total. */
export function mapExactVector(
  v: ExactVector3,
  fn: (component: ExactRational) => ExactRational,
): ExactVector3 {
  return { x: fn(v.x), y: fn(v.y), z: fn(v.z) };
}
