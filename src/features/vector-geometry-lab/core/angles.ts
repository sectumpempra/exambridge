import type {
  DisplayGeometryV1,
  Line3V1,
  Plane3V1,
  Point3V1,
  ScalarV1,
  Vector3V1,
} from "@/features/vector-geometry-lab/schema";

import { DerivationRecorder, buildSolveOutcome } from "./derivation.js";
import type { SolveOutcome } from "./derivation.js";
import { toDecimal } from "./decimal.js";
import type { CoreResult } from "./errors.js";
import { coreFail, coreOk, unwrapCoreResult } from "./errors.js";
import { primitiveIntegerDirection } from "./line-plane.js";
import type { ExactRadical } from "./radical.js";
import {
  divideRationalByRadical,
  formatRadical,
  radicalFromRationalSquare,
  radicalToNumber,
  squareRadical,
} from "./radical.js";
import type { ExactRational } from "./rational.js";
import {
  absRational,
  compareRationals,
  formatRational,
  multiplyRationals,
  ONE_RATIONAL,
  rationalSign,
  rationalToNumber,
  scalarFromRational,
  subtractRationals,
  ZERO_RATIONAL,
} from "./rational.js";
import {
  areOppositeDirection,
  areParallel,
  arePerpendicular,
  areSameDirection,
} from "./relations.js";
import type { Tolerance } from "./tolerance.js";
import { formatTolerance, resolveTolerance } from "./tolerance.js";
import { checkScalarResidual } from "./validation.js";
import type { ResidualCheck, ResidualCheckOptions } from "./validation.js";
import { ValidationRecorder } from "./validation.js";
import type { ExactVector3 } from "./vectors.js";
import {
  crossProduct,
  dotProduct,
  exactVectorFromVector3,
  formatExactVector,
  isZeroExactVector,
  squaredNorm,
  vector3FromExactVector,
} from "./vectors.js";

/**
 * Angle solvers — Stage 3 of ExamBridge Vector Geometry Lab V1
 * (spec §2.2 and §4). Four angle situations:
 *
 * 1. two vectors, 0°–180°        → vectorAngle
 * 2. two lines (acute), 0°–90°   → lineLineAngle
 * 3. line–plane, 0°–90°          → linePlaneAngle   (sin θ = |d·n|/(|d||n|))
 * 4. two planes (acute dihedral) → planePlaneAngle  (via the two normals)
 *
 * Conventions (recorded as assumptions, spec §12):
 * - The cosine (or, for line–plane, the sine) is reported EXACTLY as an
 *   ExactRadical — a rational or a rational/radical quotient such as √6/3.
 * - The angle itself has no exact closed form in general, so it is reported
 *   numerically: acos/asin of the exact ratio, in radians and degrees.
 * - Vector angles use the signed dot product (0°–180°); line and plane
 *   angles use |dot| so the result is the acute angle (0°–90°).
 * - A zero vector / zero direction / zero normal is REFUSED with a
 *   structured "zero-vector" failure — never NaN, never a fabricated angle
 *   (spec §2.2). Approximate inputs whose norm is within tolerance of zero
 *   are refused the same way, because an angle for them is undecidable.
 * - Perpendicular / parallel / same-direction / opposite-direction
 *   classification reuses the Stage 2 relation primitives.
 */

export interface AngleOptions {
  /** Float-comparison tolerance for approximate (exact:false) inputs. */
  readonly tolerance?: Partial<Tolerance>;
  /** Fractional digits of the cosine/sine decimal rendering (default 6). */
  readonly decimalDigits?: number;
}

/** Cosine-based angle: exact radical cosine + numeric acos, or float + tolerance. */
export type AngleMeasurement =
  | {
      readonly kind: "exact";
      readonly cosine: ExactRadical;
      readonly cosineDecimalApproximation: string;
      readonly angleRadians: number;
      readonly angleDegrees: number;
    }
  | {
      readonly kind: "approximate";
      readonly cosine: number;
      readonly angleRadians: number;
      readonly angleDegrees: number;
      readonly tolerance: Tolerance;
    };

/** Sine-based angle for the line–plane situation (θ via sin θ = |d·n|/(|d||n|)). */
export type LinePlaneAngleMeasurement =
  | {
      readonly kind: "exact";
      readonly sine: ExactRadical;
      readonly sineDecimalApproximation: string;
      readonly angleRadians: number;
      readonly angleDegrees: number;
    }
  | {
      readonly kind: "approximate";
      readonly sine: number;
      readonly angleRadians: number;
      readonly angleDegrees: number;
      readonly tolerance: Tolerance;
    };

export type VectorAngleClassification =
  | "same-direction"
  | "opposite-direction"
  | "perpendicular"
  | "acute"
  | "obtuse";

export type LineAngleClassification = "parallel-lines" | "perpendicular" | "acute";

export type LinePlaneAngleClassification =
  | "line-parallel-to-plane"
  | "line-perpendicular-to-plane"
  | "oblique";

export type PlanePlaneAngleClassification =
  | "parallel-planes"
  | "perpendicular"
  | "acute";

export interface VectorAngleResult {
  readonly angle: AngleMeasurement;
  readonly classification: VectorAngleClassification;
  /** The dot product v1·v2 used throughout the derivation. */
  readonly dotProduct: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

export interface LineAngleResult {
  readonly angle: AngleMeasurement;
  readonly classification: LineAngleClassification;
  /** Signed dot product of the two directions (the cosine uses |d1·d2|). */
  readonly dotProduct: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

export interface LinePlaneAngleResult {
  readonly angle: LinePlaneAngleMeasurement;
  readonly classification: LinePlaneAngleClassification;
  /** Signed dot product d·n (the sine uses |d·n|). */
  readonly dotProductNormal: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

export interface PlanePlaneAngleResult {
  readonly angle: AngleMeasurement;
  readonly classification: PlanePlaneAngleClassification;
  /** Signed dot product of the two normals (the cosine uses |n1·n2|). */
  readonly dotProduct: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

const RADIANS_TO_DEGREES = 180 / Math.PI;

/* --------------------------------------------------------------------------
 * Shared internals
 * ------------------------------------------------------------------------ */

/**
 * Clamps a float ratio into [-1, 1] before acos/asin. Exact arithmetic
 * guarantees |ratio| ≤ 1, but the float view can overshoot by a few ulps
 * (e.g. 1 + 2⁻⁵³); this guard ONLY absorbs that representation noise and is
 * documented here so it is never mistaken for a silent repair of math data.
 */
function clampRatio(value: number): number {
  if (value > 1) {
    return 1;
  }
  if (value < -1) {
    return -1;
  }
  return value;
}

interface PreparedAngle {
  readonly measurement: AngleMeasurement;
  /** Exact radical cosine; exact path only. */
  readonly cosineRadical?: ExactRadical;
}

function prepareCosineAngle(
  dot: ExactRational,
  normProductSquared: ExactRational,
  exact: boolean,
  options?: AngleOptions,
): PreparedAngle {
  if (exact) {
    const normProduct = unwrapCoreResult(radicalFromRationalSquare(normProductSquared));
    const cosine = divideRationalByRadical(dot, normProduct);
    const ratio = clampRatio(radicalToNumber(cosine));
    const angleRadians = Math.acos(ratio);
    return {
      measurement: {
        kind: "exact",
        cosine,
        cosineDecimalApproximation: toDecimal(cosine, options?.decimalDigits),
        angleRadians,
        angleDegrees: angleRadians * RADIANS_TO_DEGREES,
      },
      cosineRadical: cosine,
    };
  }
  const tolerance = resolveTolerance(options?.tolerance);
  const cosine =
    rationalToNumber(dot) / Math.sqrt(rationalToNumber(normProductSquared));
  const angleRadians = Math.acos(clampRatio(cosine));
  return {
    measurement: {
      kind: "approximate",
      cosine,
      angleRadians,
      angleDegrees: angleRadians * RADIANS_TO_DEGREES,
      tolerance,
    },
  };
}

interface PreparedSineAngle {
  readonly measurement: LinePlaneAngleMeasurement;
  readonly sineRadical?: ExactRadical;
}

function prepareSineAngle(
  dot: ExactRational,
  normProductSquared: ExactRational,
  exact: boolean,
  options?: AngleOptions,
): PreparedSineAngle {
  if (exact) {
    const normProduct = unwrapCoreResult(radicalFromRationalSquare(normProductSquared));
    const sine = divideRationalByRadical(absRational(dot), normProduct);
    const ratio = clampRatio(radicalToNumber(sine));
    const angleRadians = Math.asin(ratio);
    return {
      measurement: {
        kind: "exact",
        sine,
        sineDecimalApproximation: toDecimal(sine, options?.decimalDigits),
        angleRadians,
        angleDegrees: angleRadians * RADIANS_TO_DEGREES,
      },
      sineRadical: sine,
    };
  }
  const tolerance = resolveTolerance(options?.tolerance);
  const sine =
    Math.abs(rationalToNumber(dot)) / Math.sqrt(rationalToNumber(normProductSquared));
  const angleRadians = Math.asin(clampRatio(sine));
  return {
    measurement: {
      kind: "approximate",
      sine,
      angleRadians,
      angleDegrees: angleRadians * RADIANS_TO_DEGREES,
      tolerance,
    },
  };
}

function numericNorm(v: ExactVector3): number {
  return Math.sqrt(rationalToNumber(squaredNorm(v)));
}

/**
 * Structured zero / near-zero refusal shared by all four angle solvers.
 * Exact path: refuse iff the vector is exactly zero. Approximate path:
 * refuse when the norm is within tolerance of zero (angle undecidable).
 */
function refuseZeroOperand(
  v: ExactVector3,
  exact: boolean,
  role: string,
  entityId: string,
  toleranceOverride?: Partial<Tolerance>,
): CoreResult<never> | undefined {
  if (exact) {
    if (isZeroExactVector(v)) {
      return coreFail(
        "zero-vector",
        `cannot compute an angle involving a zero ${role}: a direction is undefined, so no angle exists (refusing instead of returning NaN or a fabricated angle)`,
        { [role]: entityId },
      );
    }
    return undefined;
  }
  const tolerance = resolveTolerance(toleranceOverride);
  const norm = numericNorm(v);
  const scale = Math.max(tolerance.absolute, tolerance.relative * norm);
  if (norm <= scale) {
    return coreFail(
      "zero-vector",
      `cannot compute an angle involving a ${role} whose norm is within tolerance of zero: the angle is undecidable for approximate data (refusing instead of fabricating one)`,
      { [role]: entityId, norm: String(norm), tolerance: formatTolerance(tolerance) },
    );
  }
  return undefined;
}

function recordCosineValidations(
  recorder: ValidationRecorder,
  prepared: PreparedAngle,
  maxDegrees: 90 | 180,
  classification: string,
  targetIds: readonly string[],
): void {
  if (prepared.measurement.kind === "exact" && prepared.cosineRadical !== undefined) {
    const gap = subtractRationals(ONE_RATIONAL, squareRadical(prepared.cosineRadical));
    recorder.record({
      rule: "cosine-within-bounds",
      passed: compareRationals(gap, ZERO_RATIONAL) >= 0,
      message: `cos θ = ${formatRadical(prepared.cosineRadical)} satisfies |cos θ| ≤ 1 (1 − cos²θ = ${formatRational(gap)} ≥ 0)`,
      targetIds,
      residual: scalarFromRational(gap, { exact: true }),
    });
  } else if (prepared.measurement.kind === "approximate") {
    recorder.record({
      rule: "cosine-within-bounds",
      passed: Math.abs(prepared.measurement.cosine) <= 1 + prepared.measurement.tolerance.absolute,
      message: `cos θ ≈ ${prepared.measurement.cosine} within [-1, 1] (float view of the carried rationals)`,
      targetIds,
      tolerance: formatTolerance(prepared.measurement.tolerance),
    });
  }
  recorder.record({
    rule: "angle-range",
    passed:
      prepared.measurement.angleDegrees >= -1e-9 &&
      prepared.measurement.angleDegrees <= maxDegrees + 1e-9,
    message: `angle ${prepared.measurement.angleDegrees}° lies in the required range [0°, ${maxDegrees}°]`,
    targetIds,
  });
  recorder.record({
    rule: "angle-classification",
    passed: true,
    message: `classified as ${classification}`,
    targetIds,
  });
}

function recordSineValidations(
  recorder: ValidationRecorder,
  prepared: PreparedSineAngle,
  classification: string,
  targetIds: readonly string[],
): void {
  if (prepared.measurement.kind === "exact" && prepared.sineRadical !== undefined) {
    const gap = subtractRationals(ONE_RATIONAL, squareRadical(prepared.sineRadical));
    recorder.record({
      rule: "sine-within-bounds",
      passed: compareRationals(gap, ZERO_RATIONAL) >= 0,
      message: `sin θ = ${formatRadical(prepared.sineRadical)} satisfies 0 ≤ sin θ ≤ 1 (1 − sin²θ = ${formatRational(gap)} ≥ 0)`,
      targetIds,
      residual: scalarFromRational(gap, { exact: true }),
    });
  } else if (prepared.measurement.kind === "approximate") {
    recorder.record({
      rule: "sine-within-bounds",
      passed:
        prepared.measurement.sine >= -prepared.measurement.tolerance.absolute &&
        prepared.measurement.sine <= 1 + prepared.measurement.tolerance.absolute,
      message: `sin θ ≈ ${prepared.measurement.sine} within [0, 1] (float view of the carried rationals)`,
      targetIds,
      tolerance: formatTolerance(prepared.measurement.tolerance),
    });
  }
  recorder.record({
    rule: "angle-range",
    passed:
      prepared.measurement.angleDegrees >= -1e-9 &&
      prepared.measurement.angleDegrees <= 90 + 1e-9,
    message: `angle ${prepared.measurement.angleDegrees}° lies in the required range [0°, 90°]`,
    targetIds,
  });
  recorder.record({
    rule: "angle-classification",
    passed: true,
    message: `classified as ${classification}`,
    targetIds,
  });
}

/** Records the residual proof behind a perpendicular / parallel classification. */
function recordClassificationResidual(
  recorder: ValidationRecorder,
  rule: "perpendicular-dot-zero" | "parallel-cross-zero",
  residual: ExactRational | ExactVector3,
  exact: boolean,
  message: string,
  targetIds: readonly string[],
  options?: AngleOptions,
): void {
  const residualOptions: ResidualCheckOptions = exact
    ? { exact: true }
    : options?.tolerance === undefined
      ? { exact: false }
      : { exact: false, tolerance: options.tolerance };
  if (typeof residual === "object" && "x" in residual) {
    const checks: [ResidualCheck, ResidualCheck, ResidualCheck] = [
      checkScalarResidual(residual.x, ZERO_RATIONAL, residualOptions),
      checkScalarResidual(residual.y, ZERO_RATIONAL, residualOptions),
      checkScalarResidual(residual.z, ZERO_RATIONAL, residualOptions),
    ];
    let worst = checks[0];
    for (const check of checks) {
      if (compareRationals(check.residual, worst.residual) > 0) {
        worst = check;
      }
    }
    const passed = checks.every((check) => check.passed);
    const base = {
      rule,
      passed,
      message,
      targetIds,
      residual: scalarFromRational(worst.residual, { exact: worst.exact }),
    };
    if (worst.exact || worst.tolerance === undefined) {
      recorder.record(base);
    } else {
      recorder.record({ ...base, tolerance: formatTolerance(worst.tolerance) });
    }
    return;
  }
  const check = checkScalarResidual(residual, ZERO_RATIONAL, residualOptions);
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

/* --------------------------------------------------------------------------
 * Angle-arc display payloads
 * ------------------------------------------------------------------------ */

function displayPoint(pointId: string, label: string, position: ExactVector3, exact: boolean): Point3V1 {
  return { pointId, label, position: vector3FromExactVector(position, { exact }) };
}

function directionHint(v: ExactVector3, exact: boolean): Vector3V1 {
  if (exact) {
    // Primitive integer direction: a stable, rational direction hint (NOT
    // necessarily unit length — the label says so).
    return vector3FromExactVector(primitiveIntegerDirection(v).direction, { exact: true });
  }
  return vector3FromExactVector(v, { exact: false });
}

/**
 * Angle-arc payload (spec §2.2 夹角圆弧; consumed by the Stage 5 renderer):
 * - points[0]  arc centre (vertex),
 * - direction  start direction of the arc (primitive rational hint),
 * - normal     normal of the plane containing the arc = b1×b2 direction
 *              (omitted when the two directions are parallel, because the
 *              arc is then degenerate: 0° or 180° / 90° line-plane),
 * - label      human-readable description including the suggested radius.
 */
function angleArcDisplay(
  displayId: string,
  vertex: ExactVector3,
  startDirection: ExactVector3,
  arcNormal: ExactVector3 | undefined,
  sweepDescription: string,
  relatedEntityIds: readonly string[],
  exact: boolean,
): DisplayGeometryV1 {
  const hasNormal = arcNormal !== undefined && !isZeroExactVector(arcNormal);
  const base = {
    displayId,
    kind: "angle-arc" as const,
    label: `angle arc (suggested radius 1 unit): ${sweepDescription}`,
    relatedEntityIds: [...relatedEntityIds],
    points: [displayPoint(`${displayId}-vertex`, "angle vertex", vertex, exact)],
    direction: directionHint(startDirection, exact),
  };
  if (!hasNormal) {
    return base;
  }
  return { ...base, normal: directionHint(arcNormal, exact) };
}

/* --------------------------------------------------------------------------
 * 1. Angle between two vectors (0°–180°)
 * ------------------------------------------------------------------------ */

/** Free vectors have no carried vertex; the arc is drawn at the origin. */
const ZERO_VERTEX: ExactVector3 = {
  x: ZERO_RATIONAL,
  y: ZERO_RATIONAL,
  z: ZERO_RATIONAL,
};

/**
 * Angle between two vectors via cos θ = (v1·v2)/(|v1||v2|), θ ∈ [0°, 180°].
 * A zero operand is refused with a structured "zero-vector" failure.
 */
export function vectorAngle(
  vector1: Vector3V1,
  vector2: Vector3V1,
  options?: AngleOptions,
): CoreResult<SolveOutcome<VectorAngleResult>> {
  const v1 = exactVectorFromVector3(vector1);
  const v2 = exactVectorFromVector3(vector2);
  const exact = v1.exact && v2.exact;
  const refusal1 = refuseZeroOperand(v1.vector, exact, "vector1", "vector1", options?.tolerance);
  if (refusal1 !== undefined) {
    return refusal1;
  }
  const refusal2 = refuseZeroOperand(v2.vector, exact, "vector2", "vector2", options?.tolerance);
  if (refusal2 !== undefined) {
    return refusal2;
  }

  const steps = new DerivationRecorder("angle-vv-step");
  const checks = new ValidationRecorder("angle-vv-validation");
  const targetIds = ["vector1", "vector2"];

  const dot = dotProduct(v1.vector, v2.vector);
  const sq1 = squaredNorm(v1.vector);
  const sq2 = squaredNorm(v2.vector);
  const normProductSquared = multiplyRationals(sq1, sq2);
  const prepared = prepareCosineAngle(dot, normProductSquared, exact, options);

  const perpendicular = arePerpendicular(vector1, vector2, options?.tolerance);
  const same = areSameDirection(vector1, vector2, options?.tolerance);
  const opposite = areOppositeDirection(vector1, vector2, options?.tolerance);
  let classification: VectorAngleClassification;
  if (perpendicular.classification === "perpendicular") {
    classification = "perpendicular";
  } else if (same.classification === "same-direction") {
    classification = "same-direction";
  } else if (opposite.classification === "opposite-direction") {
    classification = "opposite-direction";
  } else {
    const sign = exact ? rationalSign(dot) : rationalToNumber(dot) >= 0 ? 1 : -1;
    classification = sign >= 0 ? "acute" : "obtuse";
  }

  steps.record({
    title: "Write down the known quantities",
    description: "Two free vectors; the angle between them lies in [0°, 180°]. Unit: degree (angle, dimensionless ratio underneath).",
    substitution: `v1 = ${formatExactVector(v1.vector)}, v2 = ${formatExactVector(v2.vector)}`,
  });
  steps.record({
    title: "State the formula",
    description: "Dot-product definition of the angle. Applicability: both vectors non-zero (checked; zero vectors are refused).",
    formula: "cos θ = (v1·v2) / (|v1|·|v2|), θ ∈ [0°, 180°]",
  });
  steps.record({
    title: "Compute the dot product and the norms",
    substitution: `v1·v2 = ${formatRational(dot)}, |v1|² = ${formatRational(sq1)}, |v2|² = ${formatRational(sq2)}`,
    result:
      prepared.measurement.kind === "exact"
        ? `cos θ = ${formatRadical(prepared.measurement.cosine)} (≈ ${prepared.measurement.cosineDecimalApproximation})`
        : `cos θ ≈ ${prepared.measurement.cosine}`,
  });
  steps.record({
    title: "Evaluate the angle and classify",
    description:
      "The cosine is exact; the angle itself has no exact closed form in general, so it is reported numerically via acos. Classification reuses the parallel/perpendicular/direction-sense relation primitives.",
    result: `θ = ${prepared.measurement.angleDegrees}° (${prepared.measurement.angleRadians} rad) — ${classification}`,
  });

  recordCosineValidations(checks, prepared, 180, classification, targetIds);
  if (classification === "perpendicular") {
    recordClassificationResidual(
      checks,
      "perpendicular-dot-zero",
      dot,
      exact,
      "back-substitution: v1·v2 = 0 confirms the perpendicular classification",
      targetIds,
      options,
    );
  }
  if (classification === "same-direction" || classification === "opposite-direction") {
    recordClassificationResidual(
      checks,
      "parallel-cross-zero",
      crossProduct(v1.vector, v2.vector),
      exact,
      `back-substitution: v1 × v2 = 0 confirms the ${classification} classification`,
      targetIds,
      options,
    );
  }

  const cross = crossProduct(v1.vector, v2.vector);
  const displayGeometry = [
    angleArcDisplay(
      "angle-vv-arc",
      ZERO_VERTEX,
      v1.vector,
      isZeroExactVector(cross) ? undefined : cross,
      `from v1 towards v2, sweep ${prepared.measurement.angleDegrees}°`,
      targetIds,
      exact,
    ),
  ];

  return coreOk(
    buildSolveOutcome<VectorAngleResult>(
      {
        angle: prepared.measurement,
        classification,
        dotProduct: scalarFromRational(dot, { exact }),
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * 2. Acute angle between two lines (0°–90°)
 * ------------------------------------------------------------------------ */

/**
 * Acute angle between two lines via their direction vectors:
 * cos θ = |d1·d2|/(|d1||d2|), θ ∈ [0°, 90°]. (Unlike the vector angle, the
 * line angle ignores orientation — spec §2.2 注意.) Zero directions are
 * refused with a structured "zero-vector" failure.
 */
export function lineLineAngle(
  line1: Line3V1,
  line2: Line3V1,
  options?: AngleOptions,
): CoreResult<SolveOutcome<LineAngleResult>> {
  const d1 = exactVectorFromVector3(line1.direction);
  const d2 = exactVectorFromVector3(line2.direction);
  const p1 = exactVectorFromVector3(line1.point.position);
  const exact = d1.exact && d2.exact && p1.exact;
  const refusal1 = refuseZeroOperand(d1.vector, exact, "line1-direction", line1.lineId, options?.tolerance);
  if (refusal1 !== undefined) {
    return refusal1;
  }
  const refusal2 = refuseZeroOperand(d2.vector, exact, "line2-direction", line2.lineId, options?.tolerance);
  if (refusal2 !== undefined) {
    return refusal2;
  }

  const steps = new DerivationRecorder("angle-ll-step");
  const checks = new ValidationRecorder("angle-ll-validation");
  const targetIds = [line1.lineId, line2.lineId];

  const signedDot = dotProduct(d1.vector, d2.vector);
  const dot = absRational(signedDot);
  const sq1 = squaredNorm(d1.vector);
  const sq2 = squaredNorm(d2.vector);
  const normProductSquared = multiplyRationals(sq1, sq2);
  const prepared = prepareCosineAngle(dot, normProductSquared, exact, options);

  const perpendicular = arePerpendicular(line1.direction, line2.direction, options?.tolerance);
  const parallel = areParallel(line1.direction, line2.direction, options?.tolerance);
  const classification: LineAngleClassification =
    perpendicular.classification === "perpendicular"
      ? "perpendicular"
      : parallel.classification === "parallel"
        ? "parallel-lines"
        : "acute";

  steps.record({
    title: "Write down the known quantities",
    description: "Two lines through their direction vectors; the angle between two LINES is the acute angle, in [0°, 90°]. Unit: degree.",
    substitution: `d1 = ${formatExactVector(d1.vector)}, d2 = ${formatExactVector(d2.vector)}`,
  });
  steps.record({
    title: "State the formula",
    description:
      "Directions are unoriented for lines, so the absolute value of the dot product is taken (a line makes the same angle with its reverse). Applicability: both directions non-zero (checked).",
    formula: "cos θ = |d1·d2| / (|d1|·|d2|), θ ∈ [0°, 90°]",
  });
  steps.record({
    title: "Compute the dot product and the norms",
    substitution: `d1·d2 = ${formatRational(signedDot)}, |d1·d2| = ${formatRational(dot)}, |d1|² = ${formatRational(sq1)}, |d2|² = ${formatRational(sq2)}`,
    result:
      prepared.measurement.kind === "exact"
        ? `cos θ = ${formatRadical(prepared.measurement.cosine)} (≈ ${prepared.measurement.cosineDecimalApproximation})`
        : `cos θ ≈ ${prepared.measurement.cosine}`,
  });
  steps.record({
    title: "Evaluate the angle and classify",
    description:
      "The cosine is exact; the angle is numeric acos. Parallel lines give 0°, perpendicular lines 90°, anything else is reported as the acute angle.",
    result: `θ = ${prepared.measurement.angleDegrees}° (${prepared.measurement.angleRadians} rad) — ${classification}`,
  });

  recordCosineValidations(checks, prepared, 90, classification, targetIds);
  if (classification === "perpendicular") {
    recordClassificationResidual(
      checks,
      "perpendicular-dot-zero",
      signedDot,
      exact,
      "back-substitution: d1·d2 = 0 confirms the perpendicular classification",
      targetIds,
      options,
    );
  }
  if (classification === "parallel-lines") {
    recordClassificationResidual(
      checks,
      "parallel-cross-zero",
      crossProduct(d1.vector, d2.vector),
      exact,
      "back-substitution: d1 × d2 = 0 confirms the parallel classification",
      targetIds,
      options,
    );
  }

  const cross = crossProduct(d1.vector, d2.vector);
  const displayGeometry = [
    angleArcDisplay(
      "angle-ll-arc",
      p1.vector,
      d1.vector,
      isZeroExactVector(cross) ? undefined : cross,
      `from d1 towards d2, sweep ${prepared.measurement.angleDegrees}° (vertex at the base point of line 1)`,
      targetIds,
      exact,
    ),
  ];

  return coreOk(
    buildSolveOutcome<LineAngleResult>(
      {
        angle: prepared.measurement,
        classification,
        dotProduct: scalarFromRational(signedDot, { exact }),
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * 3. Angle between a line and a plane (0°–90°)
 * ------------------------------------------------------------------------ */

/**
 * Angle between a line and a plane via the direction d and the normal n:
 * sin θ = |d·n|/(|d||n|), θ ∈ [0°, 90°] (the complement of the angle
 * between d and n). Classification: θ = 0° ⟺ d ⊥ n (line parallel to the
 * plane), θ = 90° ⟺ d ∥ n (line perpendicular to the plane), else oblique.
 * Zero direction / zero normal are refused with structured failures.
 */
export function linePlaneAngle(
  line: Line3V1,
  plane: Plane3V1,
  options?: AngleOptions,
): CoreResult<SolveOutcome<LinePlaneAngleResult>> {
  const d = exactVectorFromVector3(line.direction);
  const n = exactVectorFromVector3(plane.normal);
  const p = exactVectorFromVector3(line.point.position);
  const exact = d.exact && n.exact && p.exact;
  const refusalD = refuseZeroOperand(d.vector, exact, "line-direction", line.lineId, options?.tolerance);
  if (refusalD !== undefined) {
    return refusalD;
  }
  const refusalN = refuseZeroOperand(n.vector, exact, "plane-normal", plane.planeId, options?.tolerance);
  if (refusalN !== undefined) {
    return refusalN;
  }

  const steps = new DerivationRecorder("angle-lp-step");
  const checks = new ValidationRecorder("angle-lp-validation");
  const targetIds = [line.lineId, plane.planeId];

  const signedDot = dotProduct(d.vector, n.vector);
  const sqD = squaredNorm(d.vector);
  const sqN = squaredNorm(n.vector);
  const normProductSquared = multiplyRationals(sqD, sqN);
  const prepared = prepareSineAngle(signedDot, normProductSquared, exact, options);

  const perpendicular = arePerpendicular(line.direction, plane.normal, options?.tolerance);
  const parallel = areParallel(line.direction, plane.normal, options?.tolerance);
  const classification: LinePlaneAngleClassification =
    perpendicular.classification === "perpendicular"
      ? "line-parallel-to-plane"
      : parallel.classification === "parallel"
        ? "line-perpendicular-to-plane"
        : "oblique";

  steps.record({
    title: "Write down the known quantities",
    description: "Line direction d and plane normal n; the line–plane angle is measured between the line and its projection on the plane, in [0°, 90°]. Unit: degree.",
    substitution: `d = ${formatExactVector(d.vector)}, n = ${formatExactVector(n.vector)}`,
  });
  steps.record({
    title: "State the formula",
    description:
      "If φ is the angle between d and n, the line–plane angle is θ = 90° − φ, so sin θ = cos φ = |d·n|/(|d|·|n|). Applicability: non-zero direction and normal (checked).",
    formula: "sin θ = |d·n| / (|d|·|n|), θ ∈ [0°, 90°]",
  });
  steps.record({
    title: "Compute the dot product and the norms",
    substitution: `d·n = ${formatRational(signedDot)}, |d|² = ${formatRational(sqD)}, |n|² = ${formatRational(sqN)}`,
    result:
      prepared.measurement.kind === "exact"
        ? `sin θ = ${formatRadical(prepared.measurement.sine)} (≈ ${prepared.measurement.sineDecimalApproximation})`
        : `sin θ ≈ ${prepared.measurement.sine}`,
  });
  steps.record({
    title: "Evaluate the angle and classify",
    description:
      "The sine is exact; the angle is numeric asin. θ = 0° means the line is parallel to the plane (d ⊥ n); θ = 90° means the line is perpendicular to the plane (d ∥ n); otherwise the line meets the plane obliquely.",
    result: `θ = ${prepared.measurement.angleDegrees}° (${prepared.measurement.angleRadians} rad) — ${classification}`,
  });

  recordSineValidations(checks, prepared, classification, targetIds);
  if (classification === "line-parallel-to-plane") {
    recordClassificationResidual(
      checks,
      "perpendicular-dot-zero",
      signedDot,
      exact,
      "back-substitution: d·n = 0 confirms the line is parallel to the plane",
      targetIds,
      options,
    );
  }
  if (classification === "line-perpendicular-to-plane") {
    recordClassificationResidual(
      checks,
      "parallel-cross-zero",
      crossProduct(d.vector, n.vector),
      exact,
      "back-substitution: d × n = 0 confirms the line is perpendicular to the plane",
      targetIds,
      options,
    );
  }

  const cross = crossProduct(d.vector, n.vector);
  const displayGeometry = [
    angleArcDisplay(
      "angle-lp-arc",
      p.vector,
      d.vector,
      isZeroExactVector(cross) ? undefined : cross,
      `from the line direction d down to its projection on the plane, sweep ${prepared.measurement.angleDegrees}° (vertex at the base point of the line)`,
      targetIds,
      exact,
    ),
  ];

  return coreOk(
    buildSolveOutcome<LinePlaneAngleResult>(
      {
        angle: prepared.measurement,
        classification,
        dotProductNormal: scalarFromRational(signedDot, { exact }),
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * 4. Acute dihedral angle between two planes (0°–90°)
 * ------------------------------------------------------------------------ */

/**
 * Acute (dihedral) angle between two planes via their normals:
 * cos θ = |n1·n2|/(|n1||n2|), θ ∈ [0°, 90°] — the angle between two planes
 * equals the acute angle between their normals. Zero normals are refused
 * with structured "zero-vector" failures.
 */
export function planePlaneAngle(
  plane1: Plane3V1,
  plane2: Plane3V1,
  options?: AngleOptions,
): CoreResult<SolveOutcome<PlanePlaneAngleResult>> {
  const n1 = exactVectorFromVector3(plane1.normal);
  const n2 = exactVectorFromVector3(plane2.normal);
  const p1 = exactVectorFromVector3(plane1.point.position);
  const exact = n1.exact && n2.exact && p1.exact;
  const refusal1 = refuseZeroOperand(n1.vector, exact, "plane1-normal", plane1.planeId, options?.tolerance);
  if (refusal1 !== undefined) {
    return refusal1;
  }
  const refusal2 = refuseZeroOperand(n2.vector, exact, "plane2-normal", plane2.planeId, options?.tolerance);
  if (refusal2 !== undefined) {
    return refusal2;
  }

  const steps = new DerivationRecorder("angle-pp-step");
  const checks = new ValidationRecorder("angle-pp-validation");
  const targetIds = [plane1.planeId, plane2.planeId];

  const signedDot = dotProduct(n1.vector, n2.vector);
  const dot = absRational(signedDot);
  const sq1 = squaredNorm(n1.vector);
  const sq2 = squaredNorm(n2.vector);
  const normProductSquared = multiplyRationals(sq1, sq2);
  const prepared = prepareCosineAngle(dot, normProductSquared, exact, options);

  const perpendicular = arePerpendicular(plane1.normal, plane2.normal, options?.tolerance);
  const parallel = areParallel(plane1.normal, plane2.normal, options?.tolerance);
  const classification: PlanePlaneAngleClassification =
    perpendicular.classification === "perpendicular"
      ? "perpendicular"
      : parallel.classification === "parallel"
        ? "parallel-planes"
        : "acute";

  steps.record({
    title: "Write down the known quantities",
    description: "Two planes through their normal vectors; the dihedral angle is the acute angle, in [0°, 90°]. Unit: degree.",
    substitution: `n1 = ${formatExactVector(n1.vector)}, n2 = ${formatExactVector(n2.vector)}`,
  });
  steps.record({
    title: "State the formula",
    description:
      "The angle between two planes equals the acute angle between their normals. Applicability: both normals non-zero (checked).",
    formula: "cos θ = |n1·n2| / (|n1|·|n2|), θ ∈ [0°, 90°]",
  });
  steps.record({
    title: "Compute the dot product and the norms",
    substitution: `n1·n2 = ${formatRational(signedDot)}, |n1·n2| = ${formatRational(dot)}, |n1|² = ${formatRational(sq1)}, |n2|² = ${formatRational(sq2)}`,
    result:
      prepared.measurement.kind === "exact"
        ? `cos θ = ${formatRadical(prepared.measurement.cosine)} (≈ ${prepared.measurement.cosineDecimalApproximation})`
        : `cos θ ≈ ${prepared.measurement.cosine}`,
  });
  steps.record({
    title: "Evaluate the angle and classify",
    description:
      "The cosine is exact; the angle is numeric acos. Parallel normals give 0° (parallel planes), perpendicular normals give 90°, anything else is the acute dihedral angle.",
    result: `θ = ${prepared.measurement.angleDegrees}° (${prepared.measurement.angleRadians} rad) — ${classification}`,
  });

  recordCosineValidations(checks, prepared, 90, classification, targetIds);
  if (classification === "perpendicular") {
    recordClassificationResidual(
      checks,
      "perpendicular-dot-zero",
      signedDot,
      exact,
      "back-substitution: n1·n2 = 0 confirms the perpendicular classification",
      targetIds,
      options,
    );
  }
  if (classification === "parallel-planes") {
    recordClassificationResidual(
      checks,
      "parallel-cross-zero",
      crossProduct(n1.vector, n2.vector),
      exact,
      "back-substitution: n1 × n2 = 0 confirms the parallel classification",
      targetIds,
      options,
    );
  }

  const cross = crossProduct(n1.vector, n2.vector);
  const displayGeometry = [
    angleArcDisplay(
      "angle-pp-arc",
      p1.vector,
      n1.vector,
      isZeroExactVector(cross) ? undefined : cross,
      `from n1 towards n2, sweep ${prepared.measurement.angleDegrees}° (vertex at the base point of plane 1)`,
      targetIds,
      exact,
    ),
  ];

  return coreOk(
    buildSolveOutcome<PlanePlaneAngleResult>(
      {
        angle: prepared.measurement,
        classification,
        dotProduct: scalarFromRational(signedDot, { exact }),
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}
