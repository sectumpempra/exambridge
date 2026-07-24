import type { Line3V1, Plane3V1 } from "@/features/vector-geometry-lab/schema";

import { bigintAbs, bigintGcdAll, bigintLcmAll } from "./bigint-utils.js";
import type { CoreResult } from "./errors.js";
import { coreFail, coreOk, unwrapCoreResult } from "./errors.js";
import type { ExactRadical } from "./radical.js";
import type { ExactRational } from "./rational.js";
import {
  divideRationalsUnsafe,
  formatRational,
  rational,
  rationalsEqual,
  rationalToNumber,
} from "./rational.js";
import type { Tolerance } from "./tolerance.js";
import { resolveTolerance } from "./tolerance.js";
import type { ExactVector3, RadicalVector3 } from "./vectors.js";
import {
  dotProduct,
  exactVectorFromVector3,
  formatExactVector,
  isZeroExactVector,
  normalizeVector,
  scaleVector,
  squaredNorm,
  vectorNorm,
} from "./vectors.js";

/**
 * Line / plane normalization primitives (spec §4: 直线和平面的标准化).
 *
 * Canonical forms are chosen so that mathematically equivalent objects have
 * structurally identical normalizations:
 * - Line: parameter base point + direction. The exact path tries exact
 *   rational unitization; when the norm is irrational the direction CANNOT
 *   be rational-unitized, so the primitive integer direction is kept and
 *   the fact is recorded (`directionUnitized: false` + note). The exact
 *   unit direction (radical components) is still provided.
 * - Plane: r·n = d with the whole equation gcd-reduced to primitive
 *   integers and the first non-zero normal component forced positive.
 *   Invariant (spec §9): scaling a plane equation by any non-zero factor
 *   yields the SAME normalized equation.
 */

/* --------------------------------------------------------------------------
 * Primitive integer direction
 * ------------------------------------------------------------------------ */

/**
 * Scales a rational vector to a primitive integer direction: denominators
 * cleared via lcm, components divided by their gcd, and the first non-zero
 * component forced positive. Returns the integer direction plus the signed
 * scale s with v = s·direction.
 */
export function primitiveIntegerDirection(v: ExactVector3): {
  readonly direction: ExactVector3;
  readonly scale: ExactRational;
} {
  if (isZeroExactVector(v)) {
    return { direction: v, scale: rational(1n) };
  }
  const components = [v.x, v.y, v.z];
  const denominatorLcm = bigintLcmAll(components.map((c) => c.denominator));
  const integers = components.map(
    (c) => (c.numerator * denominatorLcm) / c.denominator,
  );
  const divisor = bigintGcdAll(integers.map(bigintAbs));
  const reduced = integers.map((value) => value / divisor);
  const firstNonZero = reduced.find((value) => value !== 0n) ?? 0n;
  const sign = firstNonZero < 0n ? -1n : 1n;
  const direction: ExactVector3 = {
    x: rational(sign * (reduced[0] ?? 0n)),
    y: rational(sign * (reduced[1] ?? 0n)),
    z: rational(sign * (reduced[2] ?? 0n)),
  };
  // v = (sign·divisor / lcm)·direction
  const scale = rational(sign * divisor, denominatorLcm);
  return { direction, scale };
}

/* --------------------------------------------------------------------------
 * Line normalization
 * ------------------------------------------------------------------------ */

export interface NormalizedLine {
  /** Parameter base point a of r = a + λb. */
  readonly point: ExactVector3;
  /**
   * Carried direction: the exact rational unit direction when the input
   * direction has a rational norm; otherwise the primitive integer
   * direction (exact path) or the carried input direction (approximate
   * path).
   */
  readonly direction: ExactVector3;
  /** True iff `direction` is an exact rational unit vector. */
  readonly directionUnitized: boolean;
  /** Exact unit direction (radical components allowed); exact path only. */
  readonly unitDirection?: RadicalVector3;
  /** Norm of the ORIGINAL input direction as an exact radical; exact path only. */
  readonly directionNorm?: ExactRadical;
  /**
   * Float norm of the input direction; approximate path only. The exact
   * radical is intentionally not computed on approximate carriers: their
   * squared norms routinely exceed the square-free reduction envelope, and
   * the tolerance path only needs a float scale.
   */
  readonly directionNormApprox?: number;
  /** False when any input component was an approximate (exact:false) scalar. */
  readonly exact: boolean;
  /** Human-readable record of the normalization decision. */
  readonly note: string;
  /** Present iff `exact` is false: tolerance reserved for downstream comparisons. */
  readonly tolerance?: Tolerance;
}

/**
 * Normalizes a line entity. A zero direction is REFUSED with a structured
 * "zero-vector" failure (the schema also rejects it; the core never
 * silently repairs it either).
 */
export function normalizeLine(
  line: Line3V1,
  toleranceOverride?: Partial<Tolerance>,
): CoreResult<NormalizedLine> {
  const { vector: point, exact: pointExact } = exactVectorFromVector3(
    line.point.position,
  );
  const { vector: direction, exact: directionExact } = exactVectorFromVector3(
    line.direction,
  );
  if (isZeroExactVector(direction)) {
    return coreFail(
      "zero-vector",
      "a line cannot be defined by a zero direction vector",
      { lineId: line.lineId },
    );
  }

  if (!(pointExact && directionExact)) {
    const tolerance = resolveTolerance(toleranceOverride);
    return coreOk({
      point,
      direction,
      directionUnitized: false,
      directionNormApprox: Math.sqrt(rationalToNumber(squaredNorm(direction))),
      exact: false,
      note: "approximate input: direction carried without integer reduction; use the recorded tolerance for downstream comparisons",
      tolerance,
    });
  }

  const directionNorm = vectorNorm(direction);
  // Direction is provably non-zero here, so normalization cannot fail.
  const unit = unwrapCoreResult(normalizeVector(direction));
  if (unit.norm.radicand === 1n) {
    return coreOk({
      point,
      direction: scaleVector(
        direction,
        divideRationalsUnsafe(rational(1n), unit.norm.coefficient),
      ),
      directionUnitized: true,
      unitDirection: unit.unit,
      directionNorm,
      exact: true,
      note: "direction has a rational norm and was unitized exactly",
    });
  }
  const { direction: integerDirection } = primitiveIntegerDirection(direction);
  return coreOk({
    point,
    direction: integerDirection,
    directionUnitized: false,
    unitDirection: unit.unit,
    directionNorm,
    exact: true,
    note: `direction norm ${formatRational(
      unit.norm.coefficient,
    )}√${unit.norm.radicand.toString()} is irrational; kept the primitive integer direction ${formatExactVector(integerDirection)} and recorded it`,
  });
}

/* --------------------------------------------------------------------------
 * Plane equations
 * ------------------------------------------------------------------------ */

/** Implicit plane equation r·n = d with exact rational coefficients. */
export interface PlaneEquation {
  readonly normal: ExactVector3;
  readonly d: ExactRational;
}

/** r·n = d from a point and a normal; a zero normal is refused. */
export function planeEquationFromPointNormal(
  point: ExactVector3,
  normal: ExactVector3,
): CoreResult<PlaneEquation> {
  if (isZeroExactVector(normal)) {
    return coreFail(
      "zero-vector",
      "a plane cannot be defined by a zero normal vector",
      { normal: formatExactVector(normal) },
    );
  }
  return coreOk({ normal, d: dotProduct(point, normal) });
}

/** r·n = d directly from a schema plane entity. */
export function planeEquationFromPlane3(
  plane: Plane3V1,
): CoreResult<PlaneEquation> {
  const { vector: point } = exactVectorFromVector3(plane.point.position);
  const { vector: normal } = exactVectorFromVector3(plane.normal);
  const equation = planeEquationFromPointNormal(point, normal);
  if (!equation.ok) {
    return coreFail(equation.error.code, equation.error.message, {
      planeId: plane.planeId,
    });
  }
  return equation;
}

export interface NormalizedPlaneEquation {
  /** Primitive integer normal; first non-zero component is positive. */
  readonly normal: ExactVector3;
  /** Constant term scaled consistently with the normal. */
  readonly d: ExactRational;
  /** Signed factor with normalized = scale · original (as a 4-tuple). */
  readonly scale: ExactRational;
}

/**
 * Canonical form of r·n = d under whole-equation scaling: clear all four
 * denominators via lcm, divide by the gcd of (nx, ny, nz, d), force the
 * first non-zero normal component positive. A zero normal is refused.
 */
export function normalizePlaneEquation(
  equation: PlaneEquation,
): CoreResult<NormalizedPlaneEquation> {
  if (isZeroExactVector(equation.normal)) {
    return coreFail(
      "zero-vector",
      "cannot normalize a plane equation with a zero normal",
    );
  }
  const coefficients = [
    equation.normal.x,
    equation.normal.y,
    equation.normal.z,
    equation.d,
  ];
  const denominatorLcm = bigintLcmAll(coefficients.map((c) => c.denominator));
  const integers = coefficients.map(
    (c) => (c.numerator * denominatorLcm) / c.denominator,
  );
  const divisor = bigintGcdAll(integers.map(bigintAbs));
  const reduced = integers.map((value) => value / divisor);
  const normalIntegers = reduced.slice(0, 3);
  const firstNonZero = normalIntegers.find((value) => value !== 0n) ?? 0n;
  const sign = firstNonZero < 0n ? -1n : 1n;
  const normal: ExactVector3 = {
    x: rational(sign * (normalIntegers[0] ?? 0n)),
    y: rational(sign * (normalIntegers[1] ?? 0n)),
    z: rational(sign * (normalIntegers[2] ?? 0n)),
  };
  const d = rational(sign * (reduced[3] ?? 0n));
  return coreOk({
    normal,
    d,
    scale: rational(sign * divisor, denominatorLcm),
  });
}

/**
 * Spec §9 invariant helper: two plane equations describe the same plane iff
 * their normalized forms are identical (i.e. one is a non-zero scalar
 * multiple of the other). Zero normals are refused, not silently compared.
 */
export function planeEquationsEquivalent(
  a: PlaneEquation,
  b: PlaneEquation,
): CoreResult<boolean> {
  const normalizedA = normalizePlaneEquation(a);
  if (!normalizedA.ok) {
    return normalizedA;
  }
  const normalizedB = normalizePlaneEquation(b);
  if (!normalizedB.ok) {
    return normalizedB;
  }
  const normalsMatch =
    rationalsEqual(normalizedA.value.normal.x, normalizedB.value.normal.x) &&
    rationalsEqual(normalizedA.value.normal.y, normalizedB.value.normal.y) &&
    rationalsEqual(normalizedA.value.normal.z, normalizedB.value.normal.z);
  return coreOk(
    normalsMatch && rationalsEqual(normalizedA.value.d, normalizedB.value.d),
  );
}

/* --------------------------------------------------------------------------
 * Line conversion helper
 * ------------------------------------------------------------------------ */

/** Extracts the exact parametric form (point a, direction b) of a line. */
export function exactLineFromLine3(line: Line3V1): {
  readonly point: ExactVector3;
  readonly direction: ExactVector3;
  readonly exact: boolean;
} {
  const point = exactVectorFromVector3(line.point.position);
  const direction = exactVectorFromVector3(line.direction);
  return {
    point: point.vector,
    direction: direction.vector,
    exact: point.exact && direction.exact,
  };
}
