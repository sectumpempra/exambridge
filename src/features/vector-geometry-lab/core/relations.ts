import type { Line3V1, Point3V1, Vector3V1 } from "@/features/vector-geometry-lab/schema";

import { isZeroRational, rationalToNumber } from "./rational.js";
import type { Tolerance } from "./tolerance.js";
import { numbersWithinTolerance, resolveTolerance } from "./tolerance.js";
import type { ExactVector3 } from "./vectors.js";
import {
  crossProduct,
  dotProduct,
  exactVectorFromVector3,
  exactVectorsEqual,
  isZeroExactVector,
  squaredNorm,
  subtractVectors,
} from "./vectors.js";

/**
 * Relation primitives (spec §4: 平行、垂直、重合和退化判断).
 *
 * Every primitive returns a STRUCTURED result
 *   { classification, exact, tolerance? }
 * and follows the dual-path rule (spec §3): exact provenance → exact bigint
 * decisions with no tolerance attached; approximate provenance → float
 * decisions against the recorded tolerance.
 *
 * Degenerate inputs are CLASSIFIED, never silently repaired: a zero vector
 * is neither "parallel" nor "perpendicular" — it makes the relation
 * "degenerate".
 */

export interface RelationResult<C extends string> {
  readonly classification: C;
  readonly exact: boolean;
  readonly tolerance?: Tolerance;
}

function exactRelation<C extends string>(classification: C): RelationResult<C> {
  return { classification, exact: true };
}

function tolerantRelation<C extends string>(
  classification: C,
  tolerance: Tolerance,
): RelationResult<C> {
  return { classification, exact: false, tolerance };
}

type VectorProvenance = {
  readonly vector: ExactVector3;
  readonly exact: boolean;
};

function fromVector3(v: Vector3V1): VectorProvenance {
  return exactVectorFromVector3(v);
}

function numericNorm(v: ExactVector3): number {
  return Math.sqrt(rationalToNumber(squaredNorm(v)));
}

function numericVectorIsZero(v: ExactVector3, tolerance: Tolerance): boolean {
  // |v|² vs tolerance on |v|: compare |v| ≤ max(absolute, relative·|v|).
  return numbersWithinTolerance(numericNorm(v), 0, tolerance);
}

/* --------------------------------------------------------------------------
 * Zero / degenerate classification
 * ------------------------------------------------------------------------ */

export type ZeroClassification = "zero" | "non-zero";

/** Structured zero test (exact path: all components ≡ 0). */
export function isZeroVector(
  v: Vector3V1,
  toleranceOverride?: Partial<Tolerance>,
): RelationResult<ZeroClassification> {
  const { vector, exact } = fromVector3(v);
  if (exact) {
    return exactRelation(isZeroExactVector(vector) ? "zero" : "non-zero");
  }
  const tolerance = resolveTolerance(toleranceOverride);
  return tolerantRelation(
    numericVectorIsZero(vector, tolerance) ? "zero" : "non-zero",
    tolerance,
  );
}

export type VectorDegeneracy = "zero" | "near-zero" | "non-zero";

/**
 * Degenerate-input classifier. Exact path: "zero" | "non-zero" (exact
 * arithmetic knows zero exactly). Approximate path: a vector whose norm is
 * within tolerance of zero is reported as "near-zero" — honest about the
 * fact that approximate data cannot prove exact zeroness.
 */
export function classifyVector(
  v: Vector3V1,
  toleranceOverride?: Partial<Tolerance>,
): RelationResult<VectorDegeneracy> {
  const { vector, exact } = fromVector3(v);
  if (exact) {
    return exactRelation(isZeroExactVector(vector) ? "zero" : "non-zero");
  }
  const tolerance = resolveTolerance(toleranceOverride);
  return tolerantRelation(
    numericVectorIsZero(vector, tolerance) ? "near-zero" : "non-zero",
    tolerance,
  );
}

/* --------------------------------------------------------------------------
 * Parallel / perpendicular / direction sense
 * ------------------------------------------------------------------------ */

export type ParallelClassification = "parallel" | "not-parallel" | "degenerate";

/** a × b ≡ 0 (exact) — zero operands make the relation degenerate. */
export function areParallel(
  a: Vector3V1,
  b: Vector3V1,
  toleranceOverride?: Partial<Tolerance>,
): RelationResult<ParallelClassification> {
  const va = fromVector3(a);
  const vb = fromVector3(b);
  if (va.exact && vb.exact) {
    if (isZeroExactVector(va.vector) || isZeroExactVector(vb.vector)) {
      return exactRelation("degenerate");
    }
    return exactRelation(
      isZeroExactVector(crossProduct(va.vector, vb.vector))
        ? "parallel"
        : "not-parallel",
    );
  }
  const tolerance = resolveTolerance(toleranceOverride);
  if (
    numericVectorIsZero(va.vector, tolerance) ||
    numericVectorIsZero(vb.vector, tolerance)
  ) {
    return tolerantRelation("degenerate", tolerance);
  }
  const cross = crossProduct(va.vector, vb.vector);
  const scale = numericNorm(va.vector) * numericNorm(vb.vector);
  // |a×b| = |a||b||sinθ| ≤ max(absolute, relative·|a||b|)
  return tolerantRelation(
    numbersWithinTolerance(numericNorm(cross), 0, {
      absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
      relative: 0,
    })
      ? "parallel"
      : "not-parallel",
    tolerance,
  );
}

export type PerpendicularClassification =
  | "perpendicular"
  | "not-perpendicular"
  | "degenerate";

/** a·b = 0 (exact) — zero operands make the relation degenerate. */
export function arePerpendicular(
  a: Vector3V1,
  b: Vector3V1,
  toleranceOverride?: Partial<Tolerance>,
): RelationResult<PerpendicularClassification> {
  const va = fromVector3(a);
  const vb = fromVector3(b);
  if (va.exact && vb.exact) {
    if (isZeroExactVector(va.vector) || isZeroExactVector(vb.vector)) {
      return exactRelation("degenerate");
    }
    return exactRelation(
      isZeroRational(dotProduct(va.vector, vb.vector))
        ? "perpendicular"
        : "not-perpendicular",
    );
  }
  const tolerance = resolveTolerance(toleranceOverride);
  if (
    numericVectorIsZero(va.vector, tolerance) ||
    numericVectorIsZero(vb.vector, tolerance)
  ) {
    return tolerantRelation("degenerate", tolerance);
  }
  const dot = rationalToNumber(dotProduct(va.vector, vb.vector));
  const scale = numericNorm(va.vector) * numericNorm(vb.vector);
  return tolerantRelation(
    numbersWithinTolerance(dot, 0, {
      absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
      relative: 0,
    })
      ? "perpendicular"
      : "not-perpendicular",
    tolerance,
  );
}

export type SameDirectionClassification =
  | "same-direction"
  | "not-same-direction"
  | "degenerate";

export type OppositeDirectionClassification =
  | "opposite-direction"
  | "not-opposite-direction"
  | "degenerate";

type DirectionSense = "same" | "opposite" | "neither" | "degenerate";

/**
 * Shared engine for same/opposite direction: parallel test plus the sign of
 * a·b. In the approximate path a dot product within tolerance of zero makes
 * the sense undecidable → "degenerate" (never a guessed sign).
 */
function directionSense(
  a: Vector3V1,
  b: Vector3V1,
  toleranceOverride?: Partial<Tolerance>,
): RelationResult<DirectionSense> {
  const va = fromVector3(a);
  const vb = fromVector3(b);
  if (va.exact && vb.exact) {
    if (isZeroExactVector(va.vector) || isZeroExactVector(vb.vector)) {
      return exactRelation("degenerate");
    }
    if (!isZeroExactVector(crossProduct(va.vector, vb.vector))) {
      return exactRelation("neither");
    }
    // Parallel non-zero vectors: a·b = ±|a||b| ≠ 0, so the sign is decisive.
    const dot = dotProduct(va.vector, vb.vector);
    return exactRelation(dot.numerator > 0n ? "same" : "opposite");
  }
  const tolerance = resolveTolerance(toleranceOverride);
  if (
    numericVectorIsZero(va.vector, tolerance) ||
    numericVectorIsZero(vb.vector, tolerance)
  ) {
    return tolerantRelation("degenerate", tolerance);
  }
  const cross = crossProduct(va.vector, vb.vector);
  const scale = numericNorm(va.vector) * numericNorm(vb.vector);
  const parallelBound = {
    absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
    relative: 0,
  };
  if (!numbersWithinTolerance(numericNorm(cross), 0, parallelBound)) {
    return tolerantRelation("neither", tolerance);
  }
  const dot = rationalToNumber(dotProduct(va.vector, vb.vector));
  if (numbersWithinTolerance(dot, 0, parallelBound)) {
    return tolerantRelation("degenerate", tolerance);
  }
  return tolerantRelation(dot > 0 ? "same" : "opposite", tolerance);
}

/** Parallel AND a·b > 0. */
export function areSameDirection(
  a: Vector3V1,
  b: Vector3V1,
  toleranceOverride?: Partial<Tolerance>,
): RelationResult<SameDirectionClassification> {
  const sense = directionSense(a, b, toleranceOverride);
  const classification: SameDirectionClassification =
    sense.classification === "same"
      ? "same-direction"
      : sense.classification === "degenerate"
        ? "degenerate"
        : "not-same-direction";
  return sense.exact
    ? exactRelation(classification)
    : tolerantRelation(classification, sense.tolerance ?? resolveTolerance(toleranceOverride));
}

/** Parallel AND a·b < 0. */
export function areOppositeDirection(
  a: Vector3V1,
  b: Vector3V1,
  toleranceOverride?: Partial<Tolerance>,
): RelationResult<OppositeDirectionClassification> {
  const sense = directionSense(a, b, toleranceOverride);
  const classification: OppositeDirectionClassification =
    sense.classification === "opposite"
      ? "opposite-direction"
      : sense.classification === "degenerate"
        ? "degenerate"
        : "not-opposite-direction";
  return sense.exact
    ? exactRelation(classification)
    : tolerantRelation(classification, sense.tolerance ?? resolveTolerance(toleranceOverride));
}

/* --------------------------------------------------------------------------
 * Coincident lines / collinear points
 * ------------------------------------------------------------------------ */

export type CoincidentLinesClassification =
  | "coincident"
  | "not-coincident"
  | "degenerate";

/**
 * Two lines coincide iff their directions are parallel AND the connector of
 * their base points is parallel to the direction (or the base points are
 * identical). Zero directions are degenerate.
 */
export function areCoincidentLines(
  line1: Line3V1,
  line2: Line3V1,
  toleranceOverride?: Partial<Tolerance>,
): RelationResult<CoincidentLinesClassification> {
  const p1 = fromVector3(line1.point.position);
  const p2 = fromVector3(line2.point.position);
  const d1 = fromVector3(line1.direction);
  const d2 = fromVector3(line2.direction);
  const exact = p1.exact && p2.exact && d1.exact && d2.exact;

  if (exact) {
    if (isZeroExactVector(d1.vector) || isZeroExactVector(d2.vector)) {
      return exactRelation("degenerate");
    }
    if (!isZeroExactVector(crossProduct(d1.vector, d2.vector))) {
      return exactRelation("not-coincident");
    }
    const connector = subtractVectors(p2.vector, p1.vector);
    if (isZeroExactVector(connector)) {
      return exactRelation("coincident");
    }
    return exactRelation(
      isZeroExactVector(crossProduct(connector, d1.vector))
        ? "coincident"
        : "not-coincident",
    );
  }

  const tolerance = resolveTolerance(toleranceOverride);
  if (
    numericVectorIsZero(d1.vector, tolerance) ||
    numericVectorIsZero(d2.vector, tolerance)
  ) {
    return tolerantRelation("degenerate", tolerance);
  }
  const directionScale = numericNorm(d1.vector) * numericNorm(d2.vector);
  const directionBound = {
    absolute: Math.max(tolerance.absolute, tolerance.relative * directionScale),
    relative: 0,
  };
  if (
    !numbersWithinTolerance(
      numericNorm(crossProduct(d1.vector, d2.vector)),
      0,
      directionBound,
    )
  ) {
    return tolerantRelation("not-coincident", tolerance);
  }
  const connector = subtractVectors(p2.vector, p1.vector);
  if (numericVectorIsZero(connector, tolerance)) {
    return tolerantRelation("coincident", tolerance);
  }
  const connectorScale = numericNorm(connector) * numericNorm(d1.vector);
  const connectorBound = {
    absolute: Math.max(tolerance.absolute, tolerance.relative * connectorScale),
    relative: 0,
  };
  return tolerantRelation(
    numbersWithinTolerance(
      numericNorm(crossProduct(connector, d1.vector)),
      0,
      connectorBound,
    )
      ? "coincident"
      : "not-coincident",
    tolerance,
  );
}

export type CollinearClassification =
  | "collinear"
  | "not-collinear"
  | "degenerate";

type PointLike = Point3V1 | Vector3V1;

function positionOf(point: PointLike): Vector3V1 {
  return "position" in point ? point.position : point;
}

/**
 * Three points are collinear iff (p2−p1) × (p3−p1) ≡ 0. Duplicate points
 * are "degenerate": two coincident points do not determine a unique line
 * (spec §9 重复点 category), so the relation is reported as degenerate
 * rather than trivially collinear.
 */
export function areCollinearPoints(
  point1: PointLike,
  point2: PointLike,
  point3: PointLike,
  toleranceOverride?: Partial<Tolerance>,
): RelationResult<CollinearClassification> {
  const p1 = fromVector3(positionOf(point1));
  const p2 = fromVector3(positionOf(point2));
  const p3 = fromVector3(positionOf(point3));
  const exact = p1.exact && p2.exact && p3.exact;

  if (exact) {
    if (
      exactVectorsEqual(p1.vector, p2.vector) ||
      exactVectorsEqual(p1.vector, p3.vector) ||
      exactVectorsEqual(p2.vector, p3.vector)
    ) {
      return exactRelation("degenerate");
    }
    const cross = crossProduct(
      subtractVectors(p2.vector, p1.vector),
      subtractVectors(p3.vector, p1.vector),
    );
    return exactRelation(
      isZeroExactVector(cross) ? "collinear" : "not-collinear",
    );
  }

  const tolerance = resolveTolerance(toleranceOverride);
  const d12 = subtractVectors(p2.vector, p1.vector);
  const d13 = subtractVectors(p3.vector, p1.vector);
  const d23 = subtractVectors(p3.vector, p2.vector);
  if (
    numericVectorIsZero(d12, tolerance) ||
    numericVectorIsZero(d13, tolerance) ||
    numericVectorIsZero(d23, tolerance)
  ) {
    return tolerantRelation("degenerate", tolerance);
  }
  const scale = numericNorm(d12) * numericNorm(d13);
  const bound = {
    absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
    relative: 0,
  };
  return tolerantRelation(
    numbersWithinTolerance(numericNorm(crossProduct(d12, d13)), 0, bound)
      ? "collinear"
      : "not-collinear",
    tolerance,
  );
}
