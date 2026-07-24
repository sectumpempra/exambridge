import type {
  DisplayGeometryV1,
  Line3V1,
  Plane3V1,
  Point3V1,
  ScalarV1,
} from "@/features/vector-geometry-lab/schema";

import { DerivationRecorder, buildSolveOutcome } from "./derivation.js";
import type { SolveOutcome } from "./derivation.js";
import { toDecimal } from "./decimal.js";
import type { CoreResult } from "./errors.js";
import { coreFail, coreOk, unwrapCoreResult } from "./errors.js";
import { planeEquationFromPlane3 } from "./line-plane.js";
import type { ExactRadical } from "./radical.js";
import { formatRadical, radicalFromRationalSquare, radicalSign } from "./radical.js";
import type { ExactRational } from "./rational.js";
import {
  compareRationals,
  divideRationalsUnsafe,
  formatRational,
  multiplyRationals,
  rationalToNumber,
  scalarFromRational,
  subtractRationals,
  ZERO_RATIONAL,
} from "./rational.js";
import type { Tolerance } from "./tolerance.js";
import { formatTolerance, numbersWithinTolerance, resolveTolerance } from "./tolerance.js";
import type { ResidualCheck, ResidualCheckOptions } from "./validation.js";
import { checkScalarResidual, linePointResidualVector, planePointResidual } from "./validation.js";
import { ValidationRecorder } from "./validation.js";
import type { ExactVector3 } from "./vectors.js";
import {
  addVectors,
  crossProduct,
  dotProduct,
  exactVectorFromVector3,
  formatExactVector,
  isZeroExactVector,
  scaleVector,
  squaredNorm,
  subtractVectors,
  vector3FromExactVector,
} from "./vectors.js";

/**
 * Distance solvers — Stage 3 of ExamBridge Vector Geometry Lab V1
 * (spec §2.1 and §4). Seven distance situations:
 *
 * 1. point–point              → pointPointDistance
 * 2. point–line (+foot)       → pointLineDistance
 * 3. point–plane (+foot)      → pointPlaneDistance
 * 4. parallel lines (+segment)→ parallelLinesDistance
 * 5. skew lines (+both feet)  → skewLinesDistance
 * 6. parallel planes          → parallelPlanesDistance
 * 7. every zero distance is CLASSIFIED with the geometric reason
 *    (same-point / point-on-line / point-in-plane / lines-coincident /
 *    lines-intersect / planes-coincident) — never a bare unexplained 0.
 *
 * Dual-path like the rest of the core: exact provenance yields an
 * ExactRadical distance (e.g. 3√2/2) plus a configurable decimal
 * approximation; approximate provenance yields a float distance and records
 * the tolerance used for the zero classification. Callers that require
 * parallel / skew configurations get STRUCTURED failures
 * ("not-parallel" / "not-skew") when the precondition does not hold —
 * never a silently repurposed answer.
 */

export interface DistanceOptions {
  /** Float-comparison tolerance for approximate (exact:false) inputs. */
  readonly tolerance?: Partial<Tolerance>;
  /** Fractional digits of the decimal approximation (default 6, max 100). */
  readonly decimalDigits?: number;
}

/** Exact radical distance + decimal rendering, or float + recorded tolerance. */
export type DistanceMeasurement =
  | {
      readonly kind: "exact";
      readonly radical: ExactRadical;
      readonly squaredDistance: ExactRational;
      readonly decimalApproximation: string;
    }
  | {
      readonly kind: "approximate";
      readonly value: number;
      readonly tolerance: Tolerance;
    };

/** Reasons a distance can be exactly (or within tolerance) zero. */
export type ZeroDistanceClassification =
  | "same-point"
  | "point-on-line"
  | "point-in-plane"
  | "lines-coincident"
  | "lines-intersect"
  | "planes-coincident";

export interface PointPointDistanceResult {
  readonly distance: DistanceMeasurement;
  readonly relation: "same-point" | "distinct-points";
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

export interface PointLineDistanceResult {
  readonly distance: DistanceMeasurement;
  readonly relation: "point-on-line" | "point-off-line";
  /** Foot of the perpendicular from the point onto the line. */
  readonly foot: Point3V1;
  /** Parameter λ of the foot on r = a + λb. */
  readonly parameter: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

export interface PointPlaneDistanceResult {
  readonly distance: DistanceMeasurement;
  readonly relation: "point-in-plane" | "point-outside-plane";
  /** Foot of the perpendicular from the point onto the plane. */
  readonly foot: Point3V1;
  /** Signed value r·n − d of the point (exact rational numerator of the distance). */
  readonly signedValue: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

export interface ParallelLinesDistanceResult {
  readonly distance: DistanceMeasurement;
  readonly relation: "lines-coincident" | "parallel-distinct";
  /** End of the perpendicular segment on line 1 (foot of line 2's base point). */
  readonly segmentEnd1: Point3V1;
  /** End of the perpendicular segment on line 2 (its base point). */
  readonly segmentEnd2: Point3V1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

export interface SkewLinesDistanceResult {
  readonly distance: DistanceMeasurement;
  readonly relation: "skew" | "lines-intersect";
  /** Nearest point on line 1. */
  readonly foot1: Point3V1;
  /** Nearest point on line 2. */
  readonly foot2: Point3V1;
  /** Parameter s of foot1 on r = a1 + s·b1. */
  readonly parameter1: ScalarV1;
  /** Parameter t of foot2 on r = a2 + t·b2. */
  readonly parameter2: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

export interface ParallelPlanesDistanceResult {
  readonly distance: DistanceMeasurement;
  readonly relation: "planes-coincident" | "parallel-distinct";
  /** End of the perpendicular segment in plane 1 (foot of plane 2's base point). */
  readonly segmentEnd1: Point3V1;
  /** End of the perpendicular segment in plane 2 (its base point). */
  readonly segmentEnd2: Point3V1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

/* --------------------------------------------------------------------------
 * Shared internals
 * ------------------------------------------------------------------------ */

interface PreparedMeasurement {
  readonly measurement: DistanceMeasurement;
  /** Exact path: distance ≡ 0. Approximate path: within recorded tolerance of 0. */
  readonly isZero: boolean;
}

function prepareMeasurement(
  squared: ExactRational,
  exact: boolean,
  options?: DistanceOptions,
): PreparedMeasurement {
  if (exact) {
    // squared ≥ 0 by construction (sum of squares); the only conceivable
    // failure is the square-factor safety valve, which throws like vectorNorm.
    const radical = unwrapCoreResult(radicalFromRationalSquare(squared));
    return {
      measurement: {
        kind: "exact",
        radical,
        squaredDistance: squared,
        decimalApproximation: toDecimal(radical, options?.decimalDigits),
      },
      isZero: radicalSign(radical) === 0,
    };
  }
  const tolerance = resolveTolerance(options?.tolerance);
  const value = Math.sqrt(rationalToNumber(squared));
  return {
    measurement: { kind: "approximate", value, tolerance },
    isZero: numbersWithinTolerance(value, 0, tolerance),
  };
}

function formatMeasurement(measurement: DistanceMeasurement): string {
  if (measurement.kind === "exact") {
    return `${formatRadical(measurement.radical)} (≈ ${measurement.decimalApproximation})`;
  }
  return `≈ ${measurement.value} (approximate input; tolerance ${formatTolerance(measurement.tolerance)})`;
}

function exactPoint3(
  pointId: string,
  label: string,
  position: ExactVector3,
  exact: boolean,
): Point3V1 {
  return { pointId, label, position: vector3FromExactVector(position, { exact }) };
}

function segmentDisplay(
  displayId: string,
  label: string,
  from: Point3V1,
  to: Point3V1,
  relatedEntityIds: readonly string[],
): DisplayGeometryV1 {
  return { displayId, kind: "segment", label, relatedEntityIds: [...relatedEntityIds], points: [from, to] };
}

function pointDisplay(
  displayId: string,
  label: string,
  point: Point3V1,
  relatedEntityIds: readonly string[],
): DisplayGeometryV1 {
  return { displayId, kind: "point", label, relatedEntityIds: [...relatedEntityIds], points: [point] };
}

/** Perpendicular segment payload, or a single point when the distance is 0. */
function connectorDisplay(
  displayId: string,
  segmentLabel: string,
  pointLabel: string,
  from: Point3V1,
  to: Point3V1,
  relatedEntityIds: readonly string[],
  isZero: boolean,
): DisplayGeometryV1 {
  return isZero
    ? pointDisplay(displayId, pointLabel, from, relatedEntityIds)
    : segmentDisplay(displayId, segmentLabel, from, to, relatedEntityIds);
}

/**
 * Builds ResidualCheckOptions without ever assigning an explicit `undefined`
 * (exactOptionalPropertyTypes): exact path → { exact: true }; approximate
 * path → tolerance only attached when an override was given.
 */
function residualOptions(
  exact: boolean,
  toleranceOverride?: Partial<Tolerance>,
): ResidualCheckOptions {
  if (exact) {
    return { exact: true };
  }
  return toleranceOverride === undefined
    ? { exact: false }
    : { exact: false, tolerance: toleranceOverride };
}

/**
 * Combined residual check for an exact vector that should be the zero vector:
 * the carried residual is the largest |component|; the check passes iff every
 * component passes (exactly zero on the exact path, within tolerance otherwise).
 */
function vectorResidualCheck(
  v: ExactVector3,
  exact: boolean,
  toleranceOverride?: Partial<Tolerance>,
): ResidualCheck {
  const options = residualOptions(exact, toleranceOverride);
  const checks: [ResidualCheck, ResidualCheck, ResidualCheck] = [
    checkScalarResidual(v.x, ZERO_RATIONAL, options),
    checkScalarResidual(v.y, ZERO_RATIONAL, options),
    checkScalarResidual(v.z, ZERO_RATIONAL, options),
  ];
  let worst = checks[0];
  for (const check of checks) {
    if (compareRationals(check.residual, worst.residual) > 0) {
      worst = check;
    }
  }
  const passed = checks.every((check) => check.passed);
  if (exact) {
    return { residual: worst.residual, passed, exact: true };
  }
  return {
    residual: worst.residual,
    passed,
    exact: false,
    tolerance: resolveTolerance(toleranceOverride),
  };
}

function recordResidual(
  recorder: ValidationRecorder,
  check: ResidualCheck,
  rule: string,
  message: string,
  targetIds: readonly string[],
): void {
  const base = {
    rule,
    passed: check.passed,
    message,
    targetIds,
    residual: scalarFromRational(check.residual, { exact: check.exact }),
  };
  if (check.exact || check.tolerance === undefined) {
    recorder.record(base);
  } else {
    recorder.record({ ...base, tolerance: formatTolerance(check.tolerance) });
  }
}

function recordNonNegative(
  recorder: ValidationRecorder,
  measurement: DistanceMeasurement,
  targetIds: readonly string[],
): void {
  recorder.record({
    rule: "distance-non-negative",
    passed: true,
    message: `distance ${formatMeasurement(measurement)} is a norm, hence non-negative`,
    targetIds,
  });
}

function recordRelation(
  recorder: ValidationRecorder,
  relation: string,
  isZero: boolean,
  zeroReason: string,
  nonZeroReason: string,
  targetIds: readonly string[],
): void {
  recorder.record({
    rule: "relation-classification",
    passed: true,
    message: `relation ${relation}: ${isZero ? `distance is 0 — ${zeroReason}` : `distance > 0 — ${nonZeroReason}`}`,
    targetIds,
  });
}

/* --------------------------------------------------------------------------
 * 1. Point–point distance
 * ------------------------------------------------------------------------ */

/**
 * d(P1, P2) = |P1P2|. Never fails: any two points have a distance; identical
 * points are classified "same-point" with distance 0 (spec §2.1 重复点).
 */
export function pointPointDistance(
  point1: Point3V1,
  point2: Point3V1,
  options?: DistanceOptions,
): SolveOutcome<PointPointDistanceResult> {
  const p1 = exactVectorFromVector3(point1.position);
  const p2 = exactVectorFromVector3(point2.position);
  const exact = p1.exact && p2.exact;

  const steps = new DerivationRecorder("dist-pp-step");
  const checks = new ValidationRecorder("dist-pp-validation");
  const targetIds = [point1.pointId, point2.pointId];

  steps.record({
    title: "Write down the known quantities",
    description: "Two points in space; the distance is the norm of the connector vector. Unit: abstract length unit.",
    substitution: `P1 = ${formatExactVector(p1.vector)}, P2 = ${formatExactVector(p2.vector)}`,
  });
  const difference = subtractVectors(p1.vector, p2.vector);
  const squared = squaredNorm(difference);
  const prepared = prepareMeasurement(squared, exact, options);
  steps.record({
    title: "State the formula",
    description: "Euclidean norm of the difference vector. Applicable to any pair of points without preconditions.",
    formula: "d = |P1P2| = √((x1−x2)² + (y1−y2)² + (z1−z2)²)",
  });
  steps.record({
    title: "Substitute and compute",
    substitution: `P1P2 = ${formatExactVector(difference)}; d² = ${formatRational(squared)}`,
    result: `d = ${formatMeasurement(prepared.measurement)}`,
  });
  const relation = prepared.isZero ? "same-point" : "distinct-points";
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: length of the straight segment P1P2. Degenerate case: distance 0 iff the two points coincide (same-point); a bare 0 is never returned without this classification.",
    result:
      relation === "same-point"
        ? "distance 0 — the points coincide (same-point)"
        : `distance ${formatMeasurement(prepared.measurement)} between two distinct points`,
  });

  recordNonNegative(checks, prepared.measurement, targetIds);
  recordRelation(
    checks,
    relation,
    prepared.isZero,
    "the points coincide (same-point)",
    "two distinct points",
    targetIds,
  );

  const displayGeometry = [
    connectorDisplay(
      "dist-pp-segment",
      "segment P1P2 whose length is the distance",
      "the two points coincide at this position",
      point1,
      point2,
      targetIds,
      prepared.isZero,
    ),
  ];

  return buildSolveOutcome<PointPointDistanceResult>(
    { distance: prepared.measurement, relation, displayGeometry },
    steps.steps,
    checks.records,
  );
}

/* --------------------------------------------------------------------------
 * 2. Point–line shortest distance
 * ------------------------------------------------------------------------ */

/**
 * Shortest distance from P to r = a + λb via the perpendicular foot
 * F = a + ((p−a)·b / b·b)·b. A zero direction is refused with a structured
 * "zero-vector" failure; distance 0 is classified "point-on-line".
 */
export function pointLineDistance(
  point: Point3V1,
  line: Line3V1,
  options?: DistanceOptions,
): CoreResult<SolveOutcome<PointLineDistanceResult>> {
  const p = exactVectorFromVector3(point.position);
  const a = exactVectorFromVector3(line.point.position);
  const b = exactVectorFromVector3(line.direction);
  const exact = p.exact && a.exact && b.exact;
  if (isZeroExactVector(b.vector)) {
    return coreFail(
      "zero-vector",
      "a line cannot be defined by a zero direction vector; the point-line distance is undefined",
      { lineId: line.lineId },
    );
  }

  const steps = new DerivationRecorder("dist-pl-step");
  const checks = new ValidationRecorder("dist-pl-validation");
  const targetIds = [point.pointId, line.lineId];

  steps.record({
    title: "Write down the known quantities",
    description: "Point P and line r = a + λb with b ≠ 0. Unit: abstract length unit.",
    substitution: `P = ${formatExactVector(p.vector)}, a = ${formatExactVector(a.vector)}, b = ${formatExactVector(b.vector)}`,
  });
  steps.record({
    title: "State the formula",
    description:
      "The shortest distance is achieved at the perpendicular foot: the connector P−F must be perpendicular to b. Applicability: any point and any line with non-zero direction.",
    formula: "F = a + λ·b with λ = (P−a)·b / (b·b);  d = |P − F|",
  });
  const w = subtractVectors(p.vector, a.vector);
  const wb = dotProduct(w, b.vector);
  const bb = squaredNorm(b.vector);
  const lambda = divideRationalsUnsafe(wb, bb);
  const foot = addVectors(a.vector, scaleVector(b.vector, lambda));
  const connector = subtractVectors(p.vector, foot);
  const squared = squaredNorm(connector);
  const prepared = prepareMeasurement(squared, exact, options);
  steps.record({
    title: "Substitute and compute",
    substitution: `(P−a)·b = ${formatRational(wb)}, b·b = ${formatRational(bb)}, λ = ${formatRational(lambda)}`,
    result: `F = ${formatExactVector(foot)}, P−F = ${formatExactVector(connector)}, d² = ${formatRational(squared)}, d = ${formatMeasurement(prepared.measurement)}`,
  });
  const relation = prepared.isZero ? "point-on-line" : "point-off-line";
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: length of the perpendicular segment from P to the line; PF ⊥ b by construction. Degenerate case: distance 0 iff P lies on the line (point-on-line).",
    result:
      relation === "point-on-line"
        ? "distance 0 — the point lies on the line (point-on-line)"
        : `distance ${formatMeasurement(prepared.measurement)} — the point is off the line`,
  });

  recordNonNegative(checks, prepared.measurement, targetIds);
  recordRelation(
    checks,
    relation,
    prepared.isZero,
    "the point lies on the line (point-on-line)",
    "the point is off the line",
    targetIds,
  );
  recordResidual(
    checks,
    vectorResidualCheck(linePointResidualVector(foot, a.vector, b.vector), exact, options?.tolerance),
    "foot-on-line",
    "back-substitution: (F − a) × b = 0, so the computed foot lies on the line",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      dotProduct(connector, b.vector),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "connector-perpendicular-to-direction",
    "back-substitution: (P − F)·b = 0, so the segment PF is perpendicular to the line",
    targetIds,
  );

  const footPoint = exactPoint3(
    `foot-${point.pointId}-on-${line.lineId}`,
    `foot of perpendicular from ${point.label} to ${line.label}`,
    foot,
    exact,
  );
  const displayGeometry = [
    connectorDisplay(
      "dist-pl-perpendicular",
      "shortest-distance segment from the point to its perpendicular foot on the line",
      "the point lies on the line at this position",
      point,
      footPoint,
      targetIds,
      prepared.isZero,
    ),
  ];

  return coreOk(
    buildSolveOutcome<PointLineDistanceResult>(
      {
        distance: prepared.measurement,
        relation,
        foot: footPoint,
        parameter: scalarFromRational(lambda, { exact }),
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * 3. Point–plane shortest distance
 * ------------------------------------------------------------------------ */

/**
 * Shortest distance from P to the plane r·n = d: d = |p·n − d| / |n|, with
 * foot F = p − ((p·n − d)/(n·n))·n. A zero normal is refused with a
 * structured "zero-vector" failure; distance 0 is classified
 * "point-in-plane".
 */
export function pointPlaneDistance(
  point: Point3V1,
  plane: Plane3V1,
  options?: DistanceOptions,
): CoreResult<SolveOutcome<PointPlaneDistanceResult>> {
  const p = exactVectorFromVector3(point.position);
  const n = exactVectorFromVector3(plane.normal);
  const a = exactVectorFromVector3(plane.point.position);
  const exact = p.exact && n.exact && a.exact;
  if (isZeroExactVector(n.vector)) {
    return coreFail(
      "zero-vector",
      "a plane cannot be defined by a zero normal vector; the point-plane distance is undefined",
      { planeId: plane.planeId },
    );
  }
  const equation = unwrapCoreResult(planeEquationFromPlane3(plane));

  const steps = new DerivationRecorder("dist-ppl-step");
  const checks = new ValidationRecorder("dist-ppl-validation");
  const targetIds = [point.pointId, plane.planeId];

  steps.record({
    title: "Write down the known quantities",
    description: "Point P and plane with normal n through point A, i.e. r·n = A·n. Unit: abstract length unit.",
    substitution: `P = ${formatExactVector(p.vector)}, n = ${formatExactVector(n.vector)}, plane r·n = ${formatRational(equation.d)}`,
  });
  steps.record({
    title: "State the formula",
    description:
      "Project the connector onto the normal direction. Applicability: any point and any plane with non-zero normal.",
    formula: "d = |P·n − d0| / |n|, with foot F = P − ((P·n − d0)/(n·n))·n, where d0 = A·n",
  });
  const signed = subtractRationals(dotProduct(p.vector, equation.normal), equation.d);
  const nn = squaredNorm(equation.normal);
  const squared = divideRationalsUnsafe(multiplyRationals(signed, signed), nn);
  const prepared = prepareMeasurement(squared, exact, options);
  const foot = subtractVectors(
    p.vector,
    scaleVector(equation.normal, divideRationalsUnsafe(signed, nn)),
  );
  steps.record({
    title: "Substitute and compute",
    substitution: `P·n − d0 = ${formatRational(signed)}, n·n = ${formatRational(nn)}, d² = ${formatRational(squared)}`,
    result: `F = ${formatExactVector(foot)}, d = ${formatMeasurement(prepared.measurement)}`,
  });
  const relation = prepared.isZero ? "point-in-plane" : "point-outside-plane";
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: length of the perpendicular dropped from P to the plane; the connector P−F is parallel to n. Degenerate case: distance 0 iff P lies in the plane (point-in-plane).",
    result:
      relation === "point-in-plane"
        ? "distance 0 — the point lies in the plane (point-in-plane)"
        : `distance ${formatMeasurement(prepared.measurement)} — the point is outside the plane`,
  });

  recordNonNegative(checks, prepared.measurement, targetIds);
  recordRelation(
    checks,
    relation,
    prepared.isZero,
    "the point lies in the plane (point-in-plane)",
    "the point is outside the plane",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      planePointResidual(equation, foot),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "foot-in-plane",
    "back-substitution: F·n − d0 = 0, so the computed foot lies in the plane",
    targetIds,
  );
  recordResidual(
    checks,
    vectorResidualCheck(
      crossProduct(subtractVectors(p.vector, foot), equation.normal),
      exact,
      options?.tolerance,
    ),
    "connector-parallel-to-normal",
    "back-substitution: (P − F) × n = 0, so the segment PF is parallel to the normal (perpendicular to the plane)",
    targetIds,
  );

  const footPoint = exactPoint3(
    `foot-${point.pointId}-in-${plane.planeId}`,
    `foot of perpendicular from ${point.label} to ${plane.label}`,
    foot,
    exact,
  );
  const displayGeometry = [
    connectorDisplay(
      "dist-ppl-perpendicular",
      "shortest-distance segment from the point to its perpendicular foot in the plane",
      "the point lies in the plane at this position",
      point,
      footPoint,
      targetIds,
      prepared.isZero,
    ),
  ];

  return coreOk(
    buildSolveOutcome<PointPlaneDistanceResult>(
      {
        distance: prepared.measurement,
        relation,
        foot: footPoint,
        signedValue: scalarFromRational(signed, { exact }),
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * Shared line / plane parallel precondition checks
 * ------------------------------------------------------------------------ */

/**
 * Dual-path parallel test on two exact vectors. Exact path: cross ≡ 0.
 * Approximate path: |a×b| ≤ max(absolute, relative·|a||b|) with the resolved
 * tolerance (mirrors the areParallel primitive in relations.ts).
 */
function parallelPrecondition(
  d1: ExactVector3,
  d2: ExactVector3,
  exact: boolean,
  toleranceOverride?: Partial<Tolerance>,
): { readonly parallel: boolean; readonly crossNorm: number; readonly tolerance?: Tolerance } {
  const cross = crossProduct(d1, d2);
  if (exact) {
    return {
      parallel: isZeroExactVector(cross),
      crossNorm: Math.sqrt(rationalToNumber(squaredNorm(cross))),
    };
  }
  const tolerance = resolveTolerance(toleranceOverride);
  const scale =
    Math.sqrt(rationalToNumber(squaredNorm(d1))) *
    Math.sqrt(rationalToNumber(squaredNorm(d2)));
  const crossNorm = Math.sqrt(rationalToNumber(squaredNorm(cross)));
  const parallel = numbersWithinTolerance(crossNorm, 0, {
    absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
    relative: 0,
  });
  return { parallel, crossNorm, tolerance };
}

/* --------------------------------------------------------------------------
 * 4. Distance between two parallel lines
 * ------------------------------------------------------------------------ */

/**
 * Distance between two PARALLEL lines, measured as the point-line distance
 * from line 2's base point to line 1. Non-parallel input is a structured
 * "not-parallel" failure (the caller should use skewLinesDistance or an
 * intersection solver instead). Coincident lines give distance 0 classified
 * "lines-coincident"; the perpendicular segment endpoints are (foot on line
 * 1, base point of line 2).
 */
export function parallelLinesDistance(
  line1: Line3V1,
  line2: Line3V1,
  options?: DistanceOptions,
): CoreResult<SolveOutcome<ParallelLinesDistanceResult>> {
  const a1 = exactVectorFromVector3(line1.point.position);
  const a2 = exactVectorFromVector3(line2.point.position);
  const d1 = exactVectorFromVector3(line1.direction);
  const d2 = exactVectorFromVector3(line2.direction);
  const exact = a1.exact && a2.exact && d1.exact && d2.exact;
  if (isZeroExactVector(d1.vector) || isZeroExactVector(d2.vector)) {
    return coreFail(
      "zero-vector",
      "a line cannot be defined by a zero direction vector; the parallel-lines distance is undefined",
      { lineId: isZeroExactVector(d1.vector) ? line1.lineId : line2.lineId },
    );
  }
  const precondition = parallelPrecondition(d1.vector, d2.vector, exact, options?.tolerance);
  if (!precondition.parallel) {
    return coreFail(
      "not-parallel",
      "the two lines are not parallel; use skewLinesDistance (skew) or a line-intersection solver (intersecting) instead",
      {
        line1Id: line1.lineId,
        line2Id: line2.lineId,
        crossNorm: String(precondition.crossNorm),
        ...(precondition.tolerance === undefined
          ? {}
          : { tolerance: formatTolerance(precondition.tolerance) }),
      },
    );
  }

  const steps = new DerivationRecorder("dist-pll-step");
  const checks = new ValidationRecorder("dist-pll-validation");
  const targetIds = [line1.lineId, line2.lineId];

  steps.record({
    title: "Write down the known quantities",
    description: "Two parallel lines r1 = a1 + λ·b1 and r2 = a2 + μ·b2 with b1 ∥ b2. Unit: abstract length unit.",
    substitution: `a1 = ${formatExactVector(a1.vector)}, b1 = ${formatExactVector(d1.vector)}, a2 = ${formatExactVector(a2.vector)}, b2 = ${formatExactVector(d2.vector)}`,
  });
  steps.record({
    title: "State the formula",
    description:
      "For parallel lines the distance is constant, so take any point of line 2 (its base point a2) and drop a perpendicular to line 1. Applicability: both directions non-zero and parallel (checked).",
    formula: "F = a1 + ((a2 − a1)·b1/(b1·b1))·b1;  d = |a2 − F|",
  });
  const w = subtractVectors(a2.vector, a1.vector);
  const wb = dotProduct(w, d1.vector);
  const bb = squaredNorm(d1.vector);
  const lambda = divideRationalsUnsafe(wb, bb);
  const foot = addVectors(a1.vector, scaleVector(d1.vector, lambda));
  const connector = subtractVectors(a2.vector, foot);
  const squared = squaredNorm(connector);
  const prepared = prepareMeasurement(squared, exact, options);
  steps.record({
    title: "Substitute and compute",
    substitution: `(a2−a1)·b1 = ${formatRational(wb)}, b1·b1 = ${formatRational(bb)}, λ = ${formatRational(lambda)}`,
    result: `F = ${formatExactVector(foot)}, d² = ${formatRational(squared)}, d = ${formatMeasurement(prepared.measurement)}`,
  });
  const relation = prepared.isZero ? "lines-coincident" : "parallel-distinct";
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: constant gap between two parallel lines; the segment F–a2 is perpendicular to both directions. Degenerate case: distance 0 iff the lines coincide (lines-coincident).",
    result:
      relation === "lines-coincident"
        ? "distance 0 — the lines are coincident (lines-coincident)"
        : `distance ${formatMeasurement(prepared.measurement)} — parallel and distinct`,
  });

  recordNonNegative(checks, prepared.measurement, targetIds);
  recordRelation(
    checks,
    relation,
    prepared.isZero,
    "the parallel lines coincide (lines-coincident)",
    "parallel and distinct lines",
    targetIds,
  );
  recordResidual(
    checks,
    vectorResidualCheck(linePointResidualVector(foot, a1.vector, d1.vector), exact, options?.tolerance),
    "foot-on-line1",
    "back-substitution: (F − a1) × b1 = 0, so the segment end lies on line 1",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      dotProduct(connector, d1.vector),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "connector-perpendicular-to-line1",
    "back-substitution: (a2 − F)·b1 = 0",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      dotProduct(connector, d2.vector),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "connector-perpendicular-to-line2",
    "back-substitution: (a2 − F)·b2 = 0, so the segment is perpendicular to both parallel directions",
    targetIds,
  );

  const end1 = exactPoint3(
    `foot-${line2.lineId}-on-${line1.lineId}`,
    `perpendicular foot on ${line1.label}`,
    foot,
    exact,
  );
  const end2 = line2.point;
  const displayGeometry = [
    connectorDisplay(
      "dist-pll-perpendicular",
      "shortest-distance segment between the two parallel lines",
      "the two lines coincide; the shared point is shown",
      end1,
      end2,
      targetIds,
      prepared.isZero,
    ),
  ];

  return coreOk(
    buildSolveOutcome<ParallelLinesDistanceResult>(
      {
        distance: prepared.measurement,
        relation,
        segmentEnd1: end1,
        segmentEnd2: end2,
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * 5. Shortest distance between two skew lines
 * ------------------------------------------------------------------------ */

/**
 * Shortest distance between two SKEW lines. The feet are found by solving
 * the exact 2×2 system for the parameters s, t of the two nearest points
 * (the connector must be perpendicular to both directions); equivalently
 * d = |(a2−a1)·(b1×b2)| / |b1×b2|, which is cross-checked as the
 * "triple-product-consistency" validation. Parallel directions are a
 * structured "not-skew" failure (use parallelLinesDistance); a zero
 * distance is classified "lines-intersect".
 */
export function skewLinesDistance(
  line1: Line3V1,
  line2: Line3V1,
  options?: DistanceOptions,
): CoreResult<SolveOutcome<SkewLinesDistanceResult>> {
  const a1 = exactVectorFromVector3(line1.point.position);
  const a2 = exactVectorFromVector3(line2.point.position);
  const d1 = exactVectorFromVector3(line1.direction);
  const d2 = exactVectorFromVector3(line2.direction);
  const exact = a1.exact && a2.exact && d1.exact && d2.exact;
  if (isZeroExactVector(d1.vector) || isZeroExactVector(d2.vector)) {
    return coreFail(
      "zero-vector",
      "a line cannot be defined by a zero direction vector; the skew-lines distance is undefined",
      { lineId: isZeroExactVector(d1.vector) ? line1.lineId : line2.lineId },
    );
  }
  const precondition = parallelPrecondition(d1.vector, d2.vector, exact, options?.tolerance);
  if (precondition.parallel) {
    return coreFail(
      "not-skew",
      "the two lines have parallel directions, so they are not skew; use parallelLinesDistance instead",
      {
        line1Id: line1.lineId,
        line2Id: line2.lineId,
        ...(precondition.tolerance === undefined
          ? {}
          : { tolerance: formatTolerance(precondition.tolerance) }),
      },
    );
  }

  const steps = new DerivationRecorder("dist-skew-step");
  const checks = new ValidationRecorder("dist-skew-validation");
  const targetIds = [line1.lineId, line2.lineId];

  const w = subtractVectors(a2.vector, a1.vector);
  const cross = crossProduct(d1.vector, d2.vector);
  const b11 = squaredNorm(d1.vector);
  const b22 = squaredNorm(d2.vector);
  const b12 = dotProduct(d1.vector, d2.vector);
  const w1 = dotProduct(w, d1.vector);
  const w2 = dotProduct(w, d2.vector);
  // Δ = (b1·b1)(b2·b2) − (b1·b2)² = |b1×b2|² > 0 (Lagrange identity; the
  // directions are non-parallel, so the denominator is provably non-zero).
  const delta = subtractRationals(multiplyRationals(b11, b22), multiplyRationals(b12, b12));
  const s = divideRationalsUnsafe(
    subtractRationals(multiplyRationals(w1, b22), multiplyRationals(b12, w2)),
    delta,
  );
  const t = divideRationalsUnsafe(
    subtractRationals(multiplyRationals(b12, w1), multiplyRationals(b11, w2)),
    delta,
  );
  const foot1 = addVectors(a1.vector, scaleVector(d1.vector, s));
  const foot2 = addVectors(a2.vector, scaleVector(d2.vector, t));
  const connector = subtractVectors(foot2, foot1);
  const squared = squaredNorm(connector);
  const prepared = prepareMeasurement(squared, exact, options);
  const triple = dotProduct(w, cross);

  steps.record({
    title: "Write down the known quantities",
    description: "Two non-parallel lines r1 = a1 + s·b1 and r2 = a2 + t·b2. Unit: abstract length unit.",
    substitution: `a1 = ${formatExactVector(a1.vector)}, b1 = ${formatExactVector(d1.vector)}, a2 = ${formatExactVector(a2.vector)}, b2 = ${formatExactVector(d2.vector)}`,
  });
  steps.record({
    title: "State the formula",
    description:
      "The shortest connector is perpendicular to both directions. Solve the 2×2 system s·(b1·b1) − t·(b1·b2) = (a2−a1)·b1, s·(b1·b2) − t·(b2·b2) = (a2−a1)·b2; cross-check with the scalar triple product formula. Applicability: non-parallel directions (checked).",
    formula: "d = |(a2−a1)·(b1×b2)| / |b1×b2|",
  });
  steps.record({
    title: "Substitute and compute",
    substitution: `b1·b1 = ${formatRational(b11)}, b2·b2 = ${formatRational(b22)}, b1·b2 = ${formatRational(b12)}, Δ = ${formatRational(delta)}, (a2−a1)·b1 = ${formatRational(w1)}, (a2−a1)·b2 = ${formatRational(w2)}`,
    result: `s = ${formatRational(s)}, t = ${formatRational(t)}, F1 = ${formatExactVector(foot1)}, F2 = ${formatExactVector(foot2)}, d² = ${formatRational(squared)}, d = ${formatMeasurement(prepared.measurement)}`,
  });
  steps.record({
    title: "Cross-check with the scalar triple product",
    formula: "d²·|b1×b2|² = ((a2−a1)·(b1×b2))²",
    substitution: `(a2−a1)·(b1×b2) = ${formatRational(triple)}, |b1×b2|² = ${formatRational(delta)}`,
    result: "verified by the triple-product-consistency validation record below",
  });
  const relation = prepared.isZero ? "lines-intersect" : "skew";
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: length of the unique common perpendicular segment F1F2. Degenerate case: non-parallel lines with distance 0 meet in a single point (lines-intersect), and then F1 = F2 is the intersection.",
    result:
      relation === "lines-intersect"
        ? "distance 0 — the lines intersect at the shared foot (lines-intersect)"
        : `distance ${formatMeasurement(prepared.measurement)} — genuinely skew lines`,
  });

  recordNonNegative(checks, prepared.measurement, targetIds);
  recordRelation(
    checks,
    relation,
    prepared.isZero,
    "the lines intersect (lines-intersect)",
    "genuinely skew lines",
    targetIds,
  );
  recordResidual(
    checks,
    vectorResidualCheck(linePointResidualVector(foot1, a1.vector, d1.vector), exact, options?.tolerance),
    "foot-on-line1",
    "back-substitution: (F1 − a1) × b1 = 0",
    targetIds,
  );
  recordResidual(
    checks,
    vectorResidualCheck(linePointResidualVector(foot2, a2.vector, d2.vector), exact, options?.tolerance),
    "foot-on-line2",
    "back-substitution: (F2 − a2) × b2 = 0",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      dotProduct(connector, d1.vector),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "connector-perpendicular-to-line1",
    "back-substitution: (F2 − F1)·b1 = 0",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      dotProduct(connector, d2.vector),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "connector-perpendicular-to-line2",
    "back-substitution: (F2 − F1)·b2 = 0",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      subtractRationals(multiplyRationals(squared, delta), multiplyRationals(triple, triple)),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "triple-product-consistency",
    "cross-check: d²·|b1×b2|² = ((a2−a1)·(b1×b2))² (Lagrange identity)",
    targetIds,
  );

  const footPoint1 = exactPoint3(
    `foot-on-${line1.lineId}`,
    `nearest point on ${line1.label}`,
    foot1,
    exact,
  );
  const footPoint2 = exactPoint3(
    `foot-on-${line2.lineId}`,
    `nearest point on ${line2.label}`,
    foot2,
    exact,
  );
  const displayGeometry = [
    connectorDisplay(
      "dist-skew-common-perpendicular",
      "common perpendicular segment between the skew lines",
      "the lines intersect at this shared point",
      footPoint1,
      footPoint2,
      targetIds,
      prepared.isZero,
    ),
  ];

  return coreOk(
    buildSolveOutcome<SkewLinesDistanceResult>(
      {
        distance: prepared.measurement,
        relation,
        foot1: footPoint1,
        foot2: footPoint2,
        parameter1: scalarFromRational(s, { exact }),
        parameter2: scalarFromRational(t, { exact }),
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * 6. Distance between two parallel planes
 * ------------------------------------------------------------------------ */

/**
 * Distance between two PARALLEL planes, measured as the point-plane distance
 * from plane 2's base point to plane 1. Non-parallel normals are a
 * structured "not-parallel" failure; coincident planes give distance 0
 * classified "planes-coincident". The perpendicular segment endpoints are
 * (foot in plane 1, base point of plane 2).
 */
export function parallelPlanesDistance(
  plane1: Plane3V1,
  plane2: Plane3V1,
  options?: DistanceOptions,
): CoreResult<SolveOutcome<ParallelPlanesDistanceResult>> {
  const n1 = exactVectorFromVector3(plane1.normal);
  const n2 = exactVectorFromVector3(plane2.normal);
  const p1 = exactVectorFromVector3(plane1.point.position);
  const p2 = exactVectorFromVector3(plane2.point.position);
  const exact = n1.exact && n2.exact && p1.exact && p2.exact;
  if (isZeroExactVector(n1.vector) || isZeroExactVector(n2.vector)) {
    return coreFail(
      "zero-vector",
      "a plane cannot be defined by a zero normal vector; the parallel-planes distance is undefined",
      { planeId: isZeroExactVector(n1.vector) ? plane1.planeId : plane2.planeId },
    );
  }
  const precondition = parallelPrecondition(n1.vector, n2.vector, exact, options?.tolerance);
  if (!precondition.parallel) {
    return coreFail(
      "not-parallel",
      "the two planes are not parallel; they intersect in a line, so their distance is 0 in the usual sense but this solver requires parallel planes",
      {
        plane1Id: plane1.planeId,
        plane2Id: plane2.planeId,
        crossNorm: String(precondition.crossNorm),
        ...(precondition.tolerance === undefined
          ? {}
          : { tolerance: formatTolerance(precondition.tolerance) }),
      },
    );
  }
  const equation1 = unwrapCoreResult(planeEquationFromPlane3(plane1));
  const equation2 = unwrapCoreResult(planeEquationFromPlane3(plane2));

  const steps = new DerivationRecorder("dist-ppl2-step");
  const checks = new ValidationRecorder("dist-ppl2-validation");
  const targetIds = [plane1.planeId, plane2.planeId];

  steps.record({
    title: "Write down the known quantities",
    description: "Two parallel planes r·n1 = d1 and r·n2 = d2 with n1 ∥ n2. Unit: abstract length unit.",
    substitution: `n1 = ${formatExactVector(equation1.normal)}, d1 = ${formatRational(equation1.d)}, n2 = ${formatExactVector(equation2.normal)}, d2 = ${formatRational(equation2.d)}`,
  });
  steps.record({
    title: "State the formula",
    description:
      "For parallel planes the distance is constant, so take any point of plane 2 (its base point A2) and drop a perpendicular onto plane 1. Applicability: both normals non-zero and parallel (checked).",
    formula: "d = |A2·n1 − d1| / |n1|, with foot F = A2 − ((A2·n1 − d1)/(n1·n1))·n1",
  });
  const signed = subtractRationals(dotProduct(p2.vector, equation1.normal), equation1.d);
  const nn = squaredNorm(equation1.normal);
  const squared = divideRationalsUnsafe(multiplyRationals(signed, signed), nn);
  const prepared = prepareMeasurement(squared, exact, options);
  const foot = subtractVectors(
    p2.vector,
    scaleVector(equation1.normal, divideRationalsUnsafe(signed, nn)),
  );
  steps.record({
    title: "Substitute and compute",
    substitution: `A2·n1 − d1 = ${formatRational(signed)}, n1·n1 = ${formatRational(nn)}, d² = ${formatRational(squared)}`,
    result: `F = ${formatExactVector(foot)}, d = ${formatMeasurement(prepared.measurement)}`,
  });
  const relation = prepared.isZero ? "planes-coincident" : "parallel-distinct";
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: constant gap between two parallel planes; the segment F–A2 is parallel to the common normal. Degenerate case: distance 0 iff the planes coincide (planes-coincident), i.e. their equations are scalar multiples.",
    result:
      relation === "planes-coincident"
        ? "distance 0 — the planes coincide (planes-coincident)"
        : `distance ${formatMeasurement(prepared.measurement)} — parallel and distinct`,
  });

  recordNonNegative(checks, prepared.measurement, targetIds);
  recordRelation(
    checks,
    relation,
    prepared.isZero,
    "the planes coincide (planes-coincident)",
    "parallel and distinct planes",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      planePointResidual(equation1, foot),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "foot-in-plane1",
    "back-substitution: F·n1 − d1 = 0, so the segment end lies in plane 1",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      planePointResidual(equation2, p2.vector),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "endpoint-in-plane2",
    "back-substitution: A2·n2 − d2 = 0, so the other segment end lies in plane 2",
    targetIds,
  );
  recordResidual(
    checks,
    vectorResidualCheck(
      crossProduct(subtractVectors(p2.vector, foot), equation1.normal),
      exact,
      options?.tolerance,
    ),
    "connector-parallel-to-normal",
    "back-substitution: (A2 − F) × n1 = 0, so the segment is parallel to the common normal",
    targetIds,
  );

  const end1 = exactPoint3(
    `foot-${plane2.planeId}-in-${plane1.planeId}`,
    `perpendicular foot in ${plane1.label}`,
    foot,
    exact,
  );
  const end2 = plane2.point;
  const displayGeometry = [
    connectorDisplay(
      "dist-ppl2-perpendicular",
      "shortest-distance segment between the two parallel planes",
      "the two planes coincide; the shared point is shown",
      end1,
      end2,
      targetIds,
      prepared.isZero,
    ),
  ];

  return coreOk(
    buildSolveOutcome<ParallelPlanesDistanceResult>(
      {
        distance: prepared.measurement,
        relation,
        segmentEnd1: end1,
        segmentEnd2: end2,
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * 7. Zero-distance classification note
 * ------------------------------------------------------------------------ */

/**
 * Zero-distance classification is implemented per solver above (spec §2.1,
 * item 7): every distance result whose measurement is zero carries an
 * explicit ZeroDistanceClassification in its `relation` field plus a
 * "relation-classification" validation record explaining the geometric
 * reason — never a bare unexplained 0.
 */
