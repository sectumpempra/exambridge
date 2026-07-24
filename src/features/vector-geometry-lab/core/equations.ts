import type {
  Line3V1,
  Plane3V1,
  Point3V1,
  ScalarV1,
  Vector3V1,
} from "@/features/vector-geometry-lab/schema";

import { DerivationRecorder, buildSolveOutcome } from "./derivation.js";
import type { SolveOutcome } from "./derivation.js";
import type { CoreResult } from "./errors.js";
import { coreFail, coreOk, unwrapCoreResult } from "./errors.js";
import {
  planeEquationFromPlane3,
  primitiveIntegerDirection,
} from "./line-plane.js";
import type { PlaneEquation } from "./line-plane.js";
import type { ExactRational } from "./rational.js";
import {
  ZERO_RATIONAL,
  absRational,
  compareRationals,
  divideRationalsUnsafe,
  formatRational,
  isZeroRational,
  negateRational,
  rational,
  rationalToNumber,
  rationalsEqual,
  scalarFromRational,
} from "./rational.js";
import type { Tolerance } from "./tolerance.js";
import { formatTolerance, numbersWithinTolerance, resolveTolerance } from "./tolerance.js";
import type { ResidualCheck, ResidualCheckOptions } from "./validation.js";
import {
  ValidationRecorder,
  checkScalarResidual,
  linePointResidualVector,
  planePointResidual,
} from "./validation.js";
import type { ExactVector3 } from "./vectors.js";
import {
  crossProduct,
  dotProduct,
  exactVectorFromVector3,
  formatExactVector,
  isZeroExactVector,
  squaredNorm,
  subtractVectors,
  vector3FromExactVector,
} from "./vectors.js";

/**
 * Vector-equation module — Stage 4 of ExamBridge Vector Geometry Lab V1
 * (spec §2.5 向量方程).
 *
 * Lines: vector form r = a + λb, parametric form, symmetric form (with an
 * explicit not-applicable reason when a direction component is 0), from
 * point+direction (zero direction refused), from two points (duplicate
 * points refused) and from a Line3V1 entity.
 *
 * Planes: normal form r·n = d, point-normal form, Cartesian form and
 * parametric form r = A + λu + μv, from point+normal (zero normal refused),
 * from point+two directions (parallel directions refused), from three
 * points (collinear points refused — the failure states plainly that NO
 * unique plane was generated) and from a Plane3V1 entity.
 *
 * Inter-conversion is lossless by construction: every form is a view of the
 * same carried (point, direction) / (point, normal) pair, and the sets
 * carry the structured data (plus the exact PlaneEquation) so round-trips
 * can rebuild entities and compare planes with planeEquationsEquivalent.
 *
 * Membership predicates isPointOnLine / isPointInPlane follow the dual-path
 * rule: exact provenance decides by exact bigint arithmetic; approximate
 * provenance decides against the recorded tolerance.
 */

export interface EquationOptions {
  /** Float-comparison tolerance for approximate (exact:false) inputs. */
  readonly tolerance?: Partial<Tolerance>;
}

type PointLike = Point3V1 | Vector3V1;

function positionOf(point: PointLike): Vector3V1 {
  return "position" in point ? point.position : point;
}

/* --------------------------------------------------------------------------
 * Shared internals
 * ------------------------------------------------------------------------ */

function numericNorm(v: ExactVector3): number {
  return Math.sqrt(rationalToNumber(squaredNorm(v)));
}

/** Coefficient rendering: exact path → "3" / "-5/4"; approximate → decimal. */
function formatCoeff(value: ExactRational, exact: boolean): string {
  return exact ? formatRational(value) : String(rationalToNumber(value));
}

function formatVectorText(v: ExactVector3, exact: boolean): string {
  return `(${formatCoeff(v.x, exact)}, ${formatCoeff(v.y, exact)}, ${formatCoeff(v.z, exact)})`;
}

const ONE = rational(1n);

/** Cartesian term like "2x" / "(3/2)y" / "z" with the sign folded in. */
function formatCartesianTerm(
  coeff: ExactRational,
  variable: string,
  exact: boolean,
  isFirst: boolean,
): string {
  const abs = absRational(coeff);
  const coeffText = formatCoeff(abs, exact);
  const body = rationalsEqual(abs, ONE)
    ? variable
    : coeffText.includes("/")
      ? `(${coeffText})${variable}`
      : `${coeffText}${variable}`;
  if (isFirst) {
    return coeff.numerator < 0n ? `-${body}` : body;
  }
  return coeff.numerator < 0n ? ` - ${body}` : ` + ${body}`;
}

/** "ax + by + cz = d" with zero terms dropped (the normal is non-zero). */
function formatCartesian(
  normal: ExactVector3,
  d: ExactRational,
  exact: boolean,
): string {
  const terms: string[] = [];
  const candidates: Array<[ExactRational, string]> = [
    [normal.x, "x"],
    [normal.y, "y"],
    [normal.z, "z"],
  ];
  for (const [coeff, variable] of candidates) {
    if (!isZeroRational(coeff)) {
      terms.push(formatCartesianTerm(coeff, variable, exact, terms.length === 0));
    }
  }
  return `${terms.join("")} = ${formatCoeff(d, exact)}`;
}

/** One line-parametric component like "x = 1 + 4λ", "y = 2", "z = -λ". */
function formatLineParametricComponent(
  variable: string,
  base: ExactRational,
  coeff: ExactRational,
  exact: boolean,
): string {
  if (isZeroRational(coeff)) {
    return `${variable} = ${formatCoeff(base, exact)}`;
  }
  const abs = absRational(coeff);
  const term = rationalsEqual(abs, ONE) ? "λ" : `${formatCoeff(abs, exact)}λ`;
  if (isZeroRational(base)) {
    return coeff.numerator < 0n
      ? `${variable} = -${term}`
      : `${variable} = ${term}`;
  }
  const sign = coeff.numerator < 0n ? " - " : " + ";
  return `${variable} = ${formatCoeff(base, exact)}${sign}${term}`;
}

/** One symmetric component like "(x - 1)/4" or "z/(-2)". */
function formatSymmetricComponent(
  variable: string,
  base: ExactRational,
  coeff: ExactRational,
  exact: boolean,
): string {
  const numerator = isZeroRational(base)
    ? variable
    : base.numerator < 0n
      ? `(${variable} + ${formatCoeff(negateRational(base), exact)})`
      : `(${variable} - ${formatCoeff(base, exact)})`;
  const denominator = formatCoeff(coeff, exact);
  return coeff.numerator < 0n
    ? `${numerator}/(${denominator})`
    : `${numerator}/${denominator}`;
}

/**
 * Deterministic spanning pair for a plane with normal n: u = n × e_k with
 * e_k the axis of the SMALLEST |n_k| (guarantees u ≠ 0), v = n × u. Exact
 * path: both reduced to primitive integer directions; approximate path:
 * carried raw (float-derived integers would be meaningless).
 */
function planeSpanningDirections(
  n: ExactVector3,
  exact: boolean,
): { readonly u: ExactVector3; readonly v: ExactVector3 } {
  const ax = absRational(n.x);
  const ay = absRational(n.y);
  const az = absRational(n.z);
  const axis: ExactVector3 =
    compareRationals(ax, ay) <= 0 && compareRationals(ax, az) <= 0
      ? { x: ONE, y: ZERO_RATIONAL, z: ZERO_RATIONAL }
      : compareRationals(ay, az) <= 0
        ? { x: ZERO_RATIONAL, y: ONE, z: ZERO_RATIONAL }
        : { x: ZERO_RATIONAL, y: ZERO_RATIONAL, z: ONE };
  const uRaw = crossProduct(n, axis);
  const vRaw = crossProduct(n, uRaw);
  if (!exact) {
    return { u: uRaw, v: vRaw };
  }
  return {
    u: primitiveIntegerDirection(uRaw).direction,
    v: primitiveIntegerDirection(vRaw).direction,
  };
}

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

/* --------------------------------------------------------------------------
 * Line equations
 * ------------------------------------------------------------------------ */

export type SymmetricForm =
  | { readonly applicable: true; readonly equation: string }
  | { readonly applicable: false; readonly reason: string };

/**
 * All three textbook forms of a line, all views of the SAME carried
 * (point, direction) pair — inter-conversion between them is lossless.
 */
export interface LineEquationSet {
  /** Base point a of r = a + λb. */
  readonly point: Vector3V1;
  /** Direction b. */
  readonly direction: Vector3V1;
  readonly exact: boolean;
  readonly tolerance?: Tolerance;
  /** Vector form, e.g. "r = (1, 2, 3) + λ(4, 5, 6)". */
  readonly vector: string;
  /** Parametric form, e.g. "x = 1 + 4λ, y = 2 + 5λ, z = 3 + 6λ". */
  readonly parametric: string;
  /** Symmetric form, or an explicit not-applicable reason. */
  readonly symmetric: SymmetricForm;
}

function buildLineEquationSet(
  point: ExactVector3,
  direction: ExactVector3,
  exact: boolean,
  toleranceOverride?: Partial<Tolerance>,
): LineEquationSet {
  const zeroComponents: string[] = [];
  if (isZeroRational(direction.x)) {
    zeroComponents.push("b_x");
  }
  if (isZeroRational(direction.y)) {
    zeroComponents.push("b_y");
  }
  if (isZeroRational(direction.z)) {
    zeroComponents.push("b_z");
  }
  const symmetric: SymmetricForm =
    zeroComponents.length === 0
      ? {
          applicable: true,
          equation: [
            formatSymmetricComponent("x", point.x, direction.x, exact),
            formatSymmetricComponent("y", point.y, direction.y, exact),
            formatSymmetricComponent("z", point.z, direction.z, exact),
          ].join(" = "),
        }
      : {
          applicable: false,
          reason: `symmetric form is not applicable: direction component(s) ${zeroComponents.join(", ")} are zero, so the corresponding ratios would divide by zero; use the vector or parametric form instead`,
        };
  const base = {
    point: vector3FromExactVector(point, { exact }),
    direction: vector3FromExactVector(direction, { exact }),
    vector: `r = ${formatVectorText(point, exact)} + λ${formatVectorText(direction, exact)}`,
    parametric: [
      formatLineParametricComponent("x", point.x, direction.x, exact),
      formatLineParametricComponent("y", point.y, direction.y, exact),
      formatLineParametricComponent("z", point.z, direction.z, exact),
    ].join(", "),
    symmetric,
  };
  if (exact) {
    return { ...base, exact: true };
  }
  return { ...base, exact: false, tolerance: resolveTolerance(toleranceOverride) };
}

function recordLineForms(
  steps: DerivationRecorder,
  set: LineEquationSet,
): void {
  steps.record({
    title: "Assemble the three forms",
    description:
      "All three forms are views of the same (a, b) pair, so converting between them is lossless. The symmetric form divides by the direction components and is therefore not applicable when any component is zero.",
    substitution: `vector: ${set.vector}; parametric: ${set.parametric}`,
    result: set.symmetric.applicable
      ? `symmetric: ${set.symmetric.equation}`
      : set.symmetric.reason,
  });
}

/**
 * Line equations from a point and a direction. A zero direction is refused
 * with "zero-vector" (a line cannot be defined without a direction).
 */
export function lineEquationsFromPointDirection(
  point: PointLike,
  direction: Vector3V1,
  options?: EquationOptions,
): CoreResult<SolveOutcome<LineEquationSet>> {
  const a = exactVectorFromVector3(positionOf(point));
  const b = exactVectorFromVector3(direction);
  const exact = a.exact && b.exact;
  if (isZeroExactVector(b.vector)) {
    return coreFail(
      "zero-vector",
      "a line cannot be defined by a zero direction vector; no equation set was generated",
      {},
    );
  }
  const steps = new DerivationRecorder("eq-line-step");
  const checks = new ValidationRecorder("eq-line-validation");
  steps.record({
    title: "Write down the known quantities",
    description: "A line through the point a with direction vector b.",
    substitution: `a = ${formatExactVector(a.vector)}, b = ${formatExactVector(b.vector)}`,
  });
  steps.record({
    title: "State the construction",
    description:
      "Vector form r = a + λb; the parametric form reads off the components; the symmetric form solves each component for λ and equates. Applicability: b ≠ 0 (checked).",
    formula: "r = a + λb;  x = a_x + λb_x, …;  (x − a_x)/b_x = (y − a_y)/b_y = (z − a_z)/b_z",
  });
  const set = buildLineEquationSet(a.vector, b.vector, exact, options?.tolerance);
  recordLineForms(steps, set);
  checks.record({
    rule: "direction-non-zero",
    passed: true,
    message: `direction b = ${formatExactVector(b.vector)} is non-zero, so the line is well defined`,
    targetIds: [],
  });
  return coreOk(buildSolveOutcome(set, steps.steps, checks.records));
}

/**
 * Line equations from two points: direction b = P2 − P1. DUPLICATE points
 * are refused with "degenerate-input": two coincident points do not
 * determine a unique line, so no equation set is claimed either.
 */
export function lineEquationsFromTwoPoints(
  point1: PointLike,
  point2: PointLike,
  options?: EquationOptions,
): CoreResult<SolveOutcome<LineEquationSet>> {
  const p1 = exactVectorFromVector3(positionOf(point1));
  const p2 = exactVectorFromVector3(positionOf(point2));
  const exact = p1.exact && p2.exact;
  const direction = subtractVectors(p2.vector, p1.vector);
  const duplicate = exact
    ? isZeroExactVector(direction)
    : numbersWithinTolerance(
        numericNorm(direction),
        0,
        resolveTolerance(options?.tolerance),
      );
  if (duplicate) {
    return coreFail(
      "degenerate-input",
      "the two points coincide, so they do not determine a unique line; refusing instead of claiming a unique line was generated",
      {},
    );
  }
  const steps = new DerivationRecorder("eq-line-step");
  const checks = new ValidationRecorder("eq-line-validation");
  steps.record({
    title: "Write down the known quantities",
    description: "A line through two distinct points P1 and P2.",
    substitution: `P1 = ${formatExactVector(p1.vector)}, P2 = ${formatExactVector(p2.vector)}`,
  });
  steps.record({
    title: "State the construction",
    description:
      "The direction is the connector b = P2 − P1 and P1 serves as the base point; then the three forms follow as usual. Applicability: P1 ≠ P2 (checked — duplicate points are refused).",
    formula: "b = P2 − P1, r = P1 + λb",
  });
  steps.record({
    title: "Compute the direction",
    substitution: `b = P2 − P1 = ${formatExactVector(direction)}`,
  });
  const set = buildLineEquationSet(p1.vector, direction, exact, options?.tolerance);
  recordLineForms(steps, set);
  recordResidual(
    checks,
    vectorResidualCheck(linePointResidualVector(p1.vector, p1.vector, direction), exact, options?.tolerance),
    "point1-on-line",
    "back-substitution: (P1 − a) × b = 0",
    [],
  );
  recordResidual(
    checks,
    vectorResidualCheck(linePointResidualVector(p2.vector, p1.vector, direction), exact, options?.tolerance),
    "point2-on-line",
    "back-substitution: (P2 − a) × b = 0",
    [],
  );
  return coreOk(buildSolveOutcome(set, steps.steps, checks.records));
}

/** Line equations from a schema Line3V1 entity. */
export function lineEquationsFromLine3(
  line: Line3V1,
  options?: EquationOptions,
): CoreResult<SolveOutcome<LineEquationSet>> {
  const outcome = lineEquationsFromPointDirection(line.point, line.direction, options);
  if (!outcome.ok) {
    return coreFail(outcome.error.code, outcome.error.message, {
      lineId: line.lineId,
    });
  }
  return outcome;
}

/**
 * Rebuilds a Line3V1 entity from an equation set — the other direction of
 * the lossless inter-conversion (round-trip: entity → forms → entity).
 */
export function line3FromEquationSet(
  set: LineEquationSet,
  lineId: string,
  label: string,
): Line3V1 {
  return {
    lineId,
    label,
    point: {
      pointId: `${lineId}-point`,
      label: `base point of ${label}`,
      position: set.point,
    },
    direction: set.direction,
  };
}

/* --------------------------------------------------------------------------
 * Plane equations
 * ------------------------------------------------------------------------ */

/**
 * All four textbook forms of a plane, all views of the SAME carried
 * (point, normal) pair plus the exact implicit equation for equivalence
 * round-trips (planeEquationsEquivalent).
 */
export interface PlaneEquationSet {
  /** Base point A. */
  readonly point: Vector3V1;
  /** Normal n (carried as given / as computed by the generator). */
  readonly normal: Vector3V1;
  /** The two parametric directions u, v spanning the plane. */
  readonly parametricDirections: readonly [Vector3V1, Vector3V1];
  readonly exact: boolean;
  readonly tolerance?: Tolerance;
  /** Normal form, e.g. "r·(1, 2, 2) = 3". */
  readonly normalForm: string;
  /** Point-normal form, e.g. "(r - (1, 0, 1))·(1, 2, 2) = 0". */
  readonly pointNormalForm: string;
  /** Cartesian form, e.g. "x + 2y + 2z = 3". */
  readonly cartesianForm: string;
  /** Parametric form, e.g. "r = (1, 0, 1) + λ(0, 1, -1) + μ(4, -1, -1)". */
  readonly parametricForm: string;
  /** Exact implicit equation r·n = d for equivalence checks. */
  readonly equation: PlaneEquation;
}

function buildPlaneEquationSet(
  point: ExactVector3,
  normal: ExactVector3,
  u: ExactVector3,
  v: ExactVector3,
  exact: boolean,
  toleranceOverride?: Partial<Tolerance>,
): PlaneEquationSet {
  const d = dotProduct(point, normal);
  const base = {
    point: vector3FromExactVector(point, { exact }),
    normal: vector3FromExactVector(normal, { exact }),
    parametricDirections: [
      vector3FromExactVector(u, { exact }),
      vector3FromExactVector(v, { exact }),
    ] as const,
    normalForm: `r·${formatVectorText(normal, exact)} = ${formatCoeff(d, exact)}`,
    pointNormalForm: `(r - ${formatVectorText(point, exact)})·${formatVectorText(normal, exact)} = 0`,
    cartesianForm: formatCartesian(normal, d, exact),
    parametricForm: `r = ${formatVectorText(point, exact)} + λ${formatVectorText(u, exact)} + μ${formatVectorText(v, exact)}`,
    equation: { normal, d },
  };
  if (exact) {
    return { ...base, exact: true };
  }
  return { ...base, exact: false, tolerance: resolveTolerance(toleranceOverride) };
}

function recordPlaneForms(
  steps: DerivationRecorder,
  set: PlaneEquationSet,
): void {
  steps.record({
    title: "Assemble the four forms",
    description:
      "All four forms are views of the same (A, n) pair, so converting between them is lossless. The parametric directions u, v are chosen perpendicular to n (u = n × e_k on the smallest-|n_k| axis, v = n × u) unless the generator supplied them.",
    substitution: `normal: ${set.normalForm}; point-normal: ${set.pointNormalForm}`,
    result: `cartesian: ${set.cartesianForm}; parametric: ${set.parametricForm}`,
  });
}

/**
 * Plane equations from a point and a normal. A zero normal is refused with
 * "zero-vector".
 */
export function planeEquationsFromPointNormal(
  point: PointLike,
  normal: Vector3V1,
  options?: EquationOptions,
): CoreResult<SolveOutcome<PlaneEquationSet>> {
  const a = exactVectorFromVector3(positionOf(point));
  const n = exactVectorFromVector3(normal);
  const exact = a.exact && n.exact;
  if (isZeroExactVector(n.vector)) {
    return coreFail(
      "zero-vector",
      "a plane cannot be defined by a zero normal vector; no equation set was generated",
      {},
    );
  }
  const steps = new DerivationRecorder("eq-plane-step");
  const checks = new ValidationRecorder("eq-plane-validation");
  steps.record({
    title: "Write down the known quantities",
    description: "A plane through the point A with normal vector n.",
    substitution: `A = ${formatExactVector(a.vector)}, n = ${formatExactVector(n.vector)}`,
  });
  steps.record({
    title: "State the construction",
    description:
      "Point-normal form (r − A)·n = 0; expanding gives the normal form r·n = d with d = A·n and the Cartesian form; the parametric form spans the plane with two directions perpendicular to n. Applicability: n ≠ 0 (checked).",
    formula: "(r − A)·n = 0;  d = A·n",
  });
  const { u, v } = planeSpanningDirections(n.vector, exact);
  const set = buildPlaneEquationSet(a.vector, n.vector, u, v, exact, options?.tolerance);
  recordPlaneForms(steps, set);
  recordResidual(
    checks,
    checkScalarResidual(
      planePointResidual(set.equation, a.vector),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "point-on-plane",
    "back-substitution: A·n − d = 0",
    [],
  );
  return coreOk(buildSolveOutcome(set, steps.steps, checks.records));
}

/**
 * Plane equations from a point and two spanning directions: n = u × v.
 * PARALLEL (or zero) directions are refused with "degenerate-input": they
 * do not span a plane, so no unique plane can be claimed.
 */
export function planeEquationsFromPointDirections(
  point: PointLike,
  direction1: Vector3V1,
  direction2: Vector3V1,
  options?: EquationOptions,
): CoreResult<SolveOutcome<PlaneEquationSet>> {
  const a = exactVectorFromVector3(positionOf(point));
  const u = exactVectorFromVector3(direction1);
  const v = exactVectorFromVector3(direction2);
  const exact = a.exact && u.exact && v.exact;
  const normal = crossProduct(u.vector, v.vector);
  const spanning = exact
    ? !isZeroExactVector(normal)
    : (() => {
        const tolerance = resolveTolerance(options?.tolerance);
        const scale = numericNorm(u.vector) * numericNorm(v.vector);
        return !numbersWithinTolerance(numericNorm(normal), 0, {
          absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
          relative: 0,
        });
      })();
  if (!spanning) {
    return coreFail(
      "degenerate-input",
      "the two directions are parallel (or zero), so they do not span a plane; refusing instead of claiming a unique plane was generated",
      {},
    );
  }
  const steps = new DerivationRecorder("eq-plane-step");
  const checks = new ValidationRecorder("eq-plane-validation");
  steps.record({
    title: "Write down the known quantities",
    description: "A plane through the point A spanned by two non-parallel directions u and v.",
    substitution: `A = ${formatExactVector(a.vector)}, u = ${formatExactVector(u.vector)}, v = ${formatExactVector(v.vector)}`,
  });
  steps.record({
    title: "State the construction",
    description:
      "The normal is the cross product n = u × v; then the four forms follow as usual, and the parametric form uses the GIVEN u, v. Applicability: u × v ≠ 0 (checked — parallel directions are refused).",
    formula: "n = u × v;  r = A + λu + μv",
  });
  steps.record({
    title: "Compute the normal",
    substitution: `n = u × v = ${formatExactVector(normal)}`,
  });
  const set = buildPlaneEquationSet(a.vector, normal, u.vector, v.vector, exact, options?.tolerance);
  recordPlaneForms(steps, set);
  recordResidual(
    checks,
    checkScalarResidual(
      dotProduct(normal, u.vector),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "normal-perpendicular-to-direction1",
    "verification: (u × v)·u = 0",
    [],
  );
  recordResidual(
    checks,
    checkScalarResidual(
      dotProduct(normal, v.vector),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "normal-perpendicular-to-direction2",
    "verification: (u × v)·v = 0",
    [],
  );
  return coreOk(buildSolveOutcome(set, steps.steps, checks.records));
}

/**
 * Plane equations from three points: u = P2 − P1, v = P3 − P1, n = u × v.
 * COLLINEAR (or duplicate) points are refused with "degenerate-input" —
 * the failure states plainly that NO unique plane was generated: infinitely
 * many planes pass through a line, so claiming one would be dishonest.
 */
export function planeEquationsFromThreePoints(
  point1: PointLike,
  point2: PointLike,
  point3: PointLike,
  options?: EquationOptions,
): CoreResult<SolveOutcome<PlaneEquationSet>> {
  const p1 = exactVectorFromVector3(positionOf(point1));
  const p2 = exactVectorFromVector3(positionOf(point2));
  const p3 = exactVectorFromVector3(positionOf(point3));
  const exact = p1.exact && p2.exact && p3.exact;
  const u = subtractVectors(p2.vector, p1.vector);
  const v = subtractVectors(p3.vector, p1.vector);
  const normal = crossProduct(u, v);
  const spanning = exact
    ? !isZeroExactVector(normal)
    : (() => {
        const tolerance = resolveTolerance(options?.tolerance);
        const scale = numericNorm(u) * numericNorm(v);
        return !numbersWithinTolerance(numericNorm(normal), 0, {
          absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
          relative: 0,
        });
      })();
  if (!spanning) {
    return coreFail(
      "degenerate-input",
      "the three points are collinear (or coincident), so they do not determine a unique plane — infinitely many planes pass through a line; refusing instead of claiming a unique plane was generated",
      {},
    );
  }
  const steps = new DerivationRecorder("eq-plane-step");
  const checks = new ValidationRecorder("eq-plane-validation");
  steps.record({
    title: "Write down the known quantities",
    description: "A plane through three non-collinear points P1, P2, P3.",
    substitution: `P1 = ${formatExactVector(p1.vector)}, P2 = ${formatExactVector(p2.vector)}, P3 = ${formatExactVector(p3.vector)}`,
  });
  steps.record({
    title: "State the construction",
    description:
      "The connectors u = P2 − P1 and v = P3 − P1 span the plane; the normal is n = u × v; then the four forms follow as usual. Applicability: u × v ≠ 0 (checked — collinear points are refused and NO unique plane is claimed).",
    formula: "u = P2 − P1, v = P3 − P1, n = u × v",
  });
  steps.record({
    title: "Compute the normal",
    substitution: `u = ${formatExactVector(u)}, v = ${formatExactVector(v)}, n = u × v = ${formatExactVector(normal)}`,
  });
  const set = buildPlaneEquationSet(p1.vector, normal, u, v, exact, options?.tolerance);
  recordPlaneForms(steps, set);
  const d = set.equation.d;
  steps.record({
    title: "Verify the plane passes through all three points",
    description:
      "Back-substitution: each Pi must satisfy Pi·n = d. See the validation records — a plane through three points that misses one of them would be worthless.",
    substitution: `P1·n = ${formatRational(dotProduct(p1.vector, normal))}, P2·n = ${formatRational(dotProduct(p2.vector, normal))}, P3·n = ${formatRational(dotProduct(p3.vector, normal))}, d = ${formatRational(d)}`,
    result: "all three residuals are recorded below",
  });
  recordResidual(
    checks,
    checkScalarResidual(planePointResidual(set.equation, p1.vector), ZERO_RATIONAL, residualOptions(exact, options?.tolerance)),
    "point1-on-plane",
    "back-substitution: P1·n − d = 0",
    [],
  );
  recordResidual(
    checks,
    checkScalarResidual(planePointResidual(set.equation, p2.vector), ZERO_RATIONAL, residualOptions(exact, options?.tolerance)),
    "point2-on-plane",
    "back-substitution: P2·n − d = 0",
    [],
  );
  recordResidual(
    checks,
    checkScalarResidual(planePointResidual(set.equation, p3.vector), ZERO_RATIONAL, residualOptions(exact, options?.tolerance)),
    "point3-on-plane",
    "back-substitution: P3·n − d = 0",
    [],
  );
  return coreOk(buildSolveOutcome(set, steps.steps, checks.records));
}

/** Plane equations from a schema Plane3V1 entity. */
export function planeEquationsFromPlane3(
  plane: Plane3V1,
  options?: EquationOptions,
): CoreResult<SolveOutcome<PlaneEquationSet>> {
  const outcome = planeEquationsFromPointNormal(plane.point, plane.normal, options);
  if (!outcome.ok) {
    return coreFail(outcome.error.code, outcome.error.message, {
      planeId: plane.planeId,
    });
  }
  return outcome;
}

/**
 * Rebuilds a Plane3V1 entity from an equation set — the other direction of
 * the lossless inter-conversion (round-trip: entity → forms → entity).
 */
export function plane3FromEquationSet(
  set: PlaneEquationSet,
  planeId: string,
  label: string,
): Plane3V1 {
  return {
    planeId,
    label,
    point: {
      pointId: `${planeId}-point`,
      label: `base point of ${label}`,
      position: set.point,
    },
    normal: set.normal,
  };
}

/* --------------------------------------------------------------------------
 * Membership predicates (dual-path)
 * ------------------------------------------------------------------------ */

export type PointOnLineClassification = "on-line" | "not-on-line";

export interface PointOnLineResult {
  readonly classification: PointOnLineClassification;
  readonly onLine: boolean;
  /** λ implied by the largest-|b_i| component: λ = (p_i − a_i)/b_i. */
  readonly parameter: ScalarV1;
  readonly exact: boolean;
  readonly tolerance?: Tolerance;
}

/**
 * Decides whether a point lies on the line r = a + λb via the cross-product
 * residual (p − a) × b = 0, and recovers λ from the largest-magnitude
 * direction component (the numerically safest divisor). Dual-path: exact
 * provenance decides by exact bigint arithmetic; approximate provenance
 * decides against the recorded tolerance.
 */
export function isPointOnLine(
  point: PointLike,
  line: Line3V1,
  options?: EquationOptions,
): CoreResult<SolveOutcome<PointOnLineResult>> {
  const p = exactVectorFromVector3(positionOf(point));
  const a = exactVectorFromVector3(line.point.position);
  const b = exactVectorFromVector3(line.direction);
  const exact = p.exact && a.exact && b.exact;
  if (isZeroExactVector(b.vector)) {
    return coreFail(
      "zero-vector",
      "a line cannot be defined by a zero direction vector; the membership test is undefined",
      { lineId: line.lineId },
    );
  }
  const steps = new DerivationRecorder("eq-on-line-step");
  const checks = new ValidationRecorder("eq-on-line-validation");
  const targetIds = [line.lineId];

  const connector = subtractVectors(p.vector, a.vector);
  const residual = crossProduct(connector, b.vector);
  const onLine = exact
    ? isZeroExactVector(residual)
    : (() => {
        const tolerance = resolveTolerance(options?.tolerance);
        const scale = numericNorm(connector) * numericNorm(b.vector);
        return numbersWithinTolerance(numericNorm(residual), 0, {
          absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
          relative: 0,
        });
      })();

  // λ from the largest-|b_i| component (non-zero because b ≠ 0).
  const pairs: Array<[ExactRational, ExactRational]> = [
    [b.vector.x, connector.x],
    [b.vector.y, connector.y],
    [b.vector.z, connector.z],
  ];
  let best: [ExactRational, ExactRational] = pairs[0] ?? [ONE, ZERO_RATIONAL];
  for (const pair of pairs) {
    if (compareRationals(absRational(pair[0]), absRational(best[0])) > 0) {
      best = pair;
    }
  }
  const lambda = divideRationalsUnsafe(best[1], best[0]);

  const classification: PointOnLineClassification = onLine ? "on-line" : "not-on-line";
  steps.record({
    title: "Write down the known quantities",
    description: "A candidate point P and a line r = a + λb. P is on the line iff (P − a) × b = 0; then λ = (P_i − a_i)/b_i for any component with b_i ≠ 0.",
    substitution: `P = ${formatExactVector(p.vector)}, a = ${formatExactVector(a.vector)}, b = ${formatExactVector(b.vector)}`,
  });
  steps.record({
    title: "Compute the evidence",
    description:
      "The cross-product residual is the exact on-line test; λ is recovered from the largest-magnitude direction component (the safest divisor). Dual-path: exact inputs decide by exact arithmetic, approximate inputs decide against the recorded tolerance.",
    substitution: `(P − a) × b = ${formatExactVector(residual)}; λ = ${formatRational(lambda)} from the largest |b_i| component`,
    result: `classification: ${classification}`,
  });
  recordResidual(
    checks,
    vectorResidualCheck(residual, exact, options?.tolerance),
    "point-on-line-residual",
    "membership test: (P − a) × b = 0",
    targetIds,
  );
  checks.record({
    rule: "relation-classification",
    passed: true,
    message: `relation ${classification}${exact ? "" : ` (approximate path, tolerance ${formatTolerance(resolveTolerance(options?.tolerance))})`}`,
    targetIds,
  });
  const base = {
    classification,
    onLine,
    parameter: scalarFromRational(lambda, { exact }),
  };
  return coreOk(
    buildSolveOutcome<PointOnLineResult>(
      exact
        ? { ...base, exact: true }
        : { ...base, exact: false, tolerance: resolveTolerance(options?.tolerance) },
      steps.steps,
      checks.records,
    ),
  );
}

export type PointInPlaneClassification = "in-plane" | "not-in-plane";

export interface PointInPlaneResult {
  readonly classification: PointInPlaneClassification;
  readonly inPlane: boolean;
  /** Signed substitution value r·n − d. */
  readonly signedValue: ScalarV1;
  readonly exact: boolean;
  readonly tolerance?: Tolerance;
}

/**
 * Decides whether a point lies in the plane r·n = d via the substitution
 * residual P·n − d = 0. Dual-path: exact provenance decides by exact bigint
 * arithmetic; approximate provenance decides against the recorded
 * (scale-aware) tolerance.
 */
export function isPointInPlane(
  point: PointLike,
  plane: Plane3V1,
  options?: EquationOptions,
): CoreResult<SolveOutcome<PointInPlaneResult>> {
  const p = exactVectorFromVector3(positionOf(point));
  const n = exactVectorFromVector3(plane.normal);
  const a = exactVectorFromVector3(plane.point.position);
  const exact = p.exact && n.exact && a.exact;
  if (isZeroExactVector(n.vector)) {
    return coreFail(
      "zero-vector",
      "a plane cannot be defined by a zero normal vector; the membership test is undefined",
      { planeId: plane.planeId },
    );
  }
  const equation = unwrapCoreResult(planeEquationFromPlane3(plane));
  const steps = new DerivationRecorder("eq-in-plane-step");
  const checks = new ValidationRecorder("eq-in-plane-validation");
  const targetIds = [plane.planeId];

  const residual = planePointResidual(equation, p.vector);
  const inPlane = exact
    ? isZeroRational(residual)
    : (() => {
        const tolerance = resolveTolerance(options?.tolerance);
        const scale = numericNorm(p.vector) * numericNorm(equation.normal);
        return numbersWithinTolerance(rationalToNumber(residual), 0, {
          absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
          relative: 0,
        });
      })();

  const classification: PointInPlaneClassification = inPlane ? "in-plane" : "not-in-plane";
  steps.record({
    title: "Write down the known quantities",
    description: "A candidate point P and a plane r·n = d. P is in the plane iff P·n − d = 0.",
    substitution: `P = ${formatExactVector(p.vector)}, n = ${formatExactVector(equation.normal)}, d = ${formatRational(equation.d)}`,
  });
  steps.record({
    title: "Compute the evidence",
    description:
      "Direct substitution into the plane equation. Dual-path: exact inputs decide by exact arithmetic, approximate inputs decide against the recorded (scale-aware) tolerance.",
    substitution: `P·n − d = ${formatRational(residual)}`,
    result: `classification: ${classification}`,
  });
  recordResidual(
    checks,
    checkScalarResidual(residual, ZERO_RATIONAL, residualOptions(exact, options?.tolerance)),
    "point-in-plane-residual",
    "membership test: P·n − d = 0",
    targetIds,
  );
  checks.record({
    rule: "relation-classification",
    passed: true,
    message: `relation ${classification}${exact ? "" : ` (approximate path, tolerance ${formatTolerance(resolveTolerance(options?.tolerance))})`}`,
    targetIds,
  });
  const base = {
    classification,
    inPlane,
    signedValue: scalarFromRational(residual, { exact }),
  };
  return coreOk(
    buildSolveOutcome<PointInPlaneResult>(
      exact
        ? { ...base, exact: true }
        : { ...base, exact: false, tolerance: resolveTolerance(options?.tolerance) },
      steps.steps,
      checks.records,
    ),
  );
}
