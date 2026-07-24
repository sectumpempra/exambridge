import type {
  DisplayGeometryV1,
  Line3V1,
  Plane3V1,
  Point3V1,
  ScalarV1,
} from "@/features/vector-geometry-lab/schema";

import { DerivationRecorder, buildSolveOutcome } from "./derivation.js";
import type { SolveOutcome } from "./derivation.js";
import type { CoreResult } from "./errors.js";
import { coreFail, coreOk, unwrapCoreResult } from "./errors.js";
import { planeEquationFromPlane3, planeEquationsEquivalent } from "./line-plane.js";
import type { ExactRational } from "./rational.js";
import {
  ZERO_RATIONAL,
  compareRationals,
  divideRationalsUnsafe,
  formatRational,
  multiplyRationals,
  rationalToNumber,
  scalarFromRational,
  subtractRationals,
} from "./rational.js";
import { areParallel } from "./relations.js";
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
  addVectors,
  crossProduct,
  dotProduct,
  exactVectorFromVector3,
  exactVectorsEqual,
  formatExactVector,
  isZeroExactVector,
  scaleVector,
  squaredNorm,
  subtractVectors,
  vector3FromExactVector,
} from "./vectors.js";

/**
 * Intersection solvers — Stage 4 of ExamBridge Vector Geometry Lab V1
 * (spec §2.5 求交).
 *
 * - lineLineIntersection:   unique / parallel-no-intersection /
 *                           skew-no-intersection / coincident-infinite,
 * - linePlaneIntersection:  unique (with λ back-substitution) /
 *                           contained-infinite / parallel-no-intersection,
 * - planePlaneIntersection: intersecting-in-line (point + n1×n2 direction,
 *                           direction verified ⊥ both normals) /
 *                           parallel-no-intersection / coincident-infinite.
 *
 * The classification names the SOLUTION COUNT honestly: "unique" is exactly
 * one solution, "*-infinite" is infinitely many, "*-no-intersection" is
 * none. Dual-path like the rest of the core: exact provenance decides by
 * exact bigint arithmetic; approximate provenance decides against the
 * recorded tolerance. Zero directions / zero normals are refused with
 * structured "zero-vector" failures, never silently solved.
 */

export interface IntersectionOptions {
  /** Float-comparison tolerance for approximate (exact:false) inputs. */
  readonly tolerance?: Partial<Tolerance>;
}

/* --------------------------------------------------------------------------
 * Shared internals (mirrors distances.ts conventions)
 * ------------------------------------------------------------------------ */

function numericNorm(v: ExactVector3): number {
  return Math.sqrt(rationalToNumber(squaredNorm(v)));
}

function refuseZero(
  v: ExactVector3,
  role: string,
  entityId: string,
): CoreResult<never> | undefined {
  if (isZeroExactVector(v)) {
    return coreFail(
      "zero-vector",
      `cannot compute an intersection involving a zero ${role}; the intersection is undefined (refusing instead of guessing)`,
      { [role]: entityId },
    );
  }
  return undefined;
}

/** Dual-path "is this exact rational zero?" with tolerance recording. */
function scalarIsZero(
  value: ExactRational,
  exact: boolean,
  toleranceOverride?: Partial<Tolerance>,
): { readonly isZero: boolean; readonly tolerance?: Tolerance } {
  if (exact) {
    return { isZero: value.numerator === 0n };
  }
  const tolerance = resolveTolerance(toleranceOverride);
  return {
    isZero: numbersWithinTolerance(rationalToNumber(value), 0, tolerance),
    tolerance,
  };
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

function exactPoint3(
  pointId: string,
  label: string,
  position: ExactVector3,
  exact: boolean,
): Point3V1 {
  return { pointId, label, position: vector3FromExactVector(position, { exact }) };
}

function pointDisplay(
  displayId: string,
  label: string,
  point: Point3V1,
  relatedEntityIds: readonly string[],
): DisplayGeometryV1 {
  return { displayId, kind: "point", label, relatedEntityIds: [...relatedEntityIds], points: [point] };
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

/* --------------------------------------------------------------------------
 * 1. Line–line intersection
 * ------------------------------------------------------------------------ */

export type LineLineIntersectionClassification =
  | "unique"
  | "parallel-no-intersection"
  | "skew-no-intersection"
  | "coincident-infinite";

export interface LineLineIntersectionResult {
  readonly classification: LineLineIntersectionClassification;
  /** Present only for "unique". */
  readonly intersectionPoint?: Point3V1;
  /** Parameter s of the intersection on r1 = a1 + s·b1 ("unique" only). */
  readonly parameterOnLine1?: ScalarV1;
  /** Parameter t of the intersection on r2 = a2 + t·b2 ("unique" only). */
  readonly parameterOnLine2?: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

/**
 * Intersects two lines. Parallel directions split by the base-point
 * connector: connector ∥ direction ⟹ coincident-infinite (every point is a
 * solution), otherwise parallel-no-intersection. Non-parallel directions:
 * solve the exact 2×2 nearest-point system for the foot parameters s, t
 * (the common-perpendicular feet); the lines meet iff the two feet coincide
 * (verified by back-substitution into BOTH line equations), otherwise they
 * are skew.
 */
export function lineLineIntersection(
  line1: Line3V1,
  line2: Line3V1,
  options?: IntersectionOptions,
): CoreResult<SolveOutcome<LineLineIntersectionResult>> {
  const a1 = exactVectorFromVector3(line1.point.position);
  const a2 = exactVectorFromVector3(line2.point.position);
  const d1 = exactVectorFromVector3(line1.direction);
  const d2 = exactVectorFromVector3(line2.direction);
  const exact = a1.exact && a2.exact && d1.exact && d2.exact;
  const refusal1 = refuseZero(d1.vector, "line1-direction", line1.lineId);
  if (refusal1 !== undefined) {
    return refusal1;
  }
  const refusal2 = refuseZero(d2.vector, "line2-direction", line2.lineId);
  if (refusal2 !== undefined) {
    return refusal2;
  }

  const steps = new DerivationRecorder("int-ll-step");
  const checks = new ValidationRecorder("int-ll-validation");
  const targetIds = [line1.lineId, line2.lineId];

  steps.record({
    title: "Write down the known quantities",
    description: "Two lines r1 = a1 + s·b1 and r2 = a2 + t·b2. An intersection is a parameter pair (s, t) with r1(s) = r2(t).",
    substitution: `a1 = ${formatExactVector(a1.vector)}, b1 = ${formatExactVector(d1.vector)}, a2 = ${formatExactVector(a2.vector)}, b2 = ${formatExactVector(d2.vector)}`,
  });
  steps.record({
    title: "State the criteria",
    description:
      "b1 × b2 = 0 ⟹ parallel directions: the lines coincide iff the base-point connector is parallel to the direction (infinitely many solutions), otherwise they never meet. b1 × b2 ≠ 0 ⟹ solve the 2×2 system s·(b1·b1) − t·(b1·b2) = (a2−a1)·b1, s·(b1·b2) − t·(b2·b2) = (a2−a1)·b2 for the nearest-point parameters; the lines meet iff the two feet coincide, otherwise they are skew. Applicability: non-zero directions (checked).",
    formula: "Δ = (b1·b1)(b2·b2) − (b1·b2)² = |b1×b2|²;  s = (w1·b22 − b12·w2)/Δ, t = (b12·w1 − b11·w2)/Δ with w = a2−a1",
  });

  const cross = crossProduct(d1.vector, d2.vector);
  const parallel = areParallel(line1.direction, line2.direction, options?.tolerance);

  if (parallel.classification === "parallel") {
    const connector = subtractVectors(a2.vector, a1.vector);
    const connectorCross = crossProduct(connector, d1.vector);
    const coincident = exact
      ? isZeroExactVector(connector) || isZeroExactVector(connectorCross)
      : (() => {
          const tolerance = resolveTolerance(options?.tolerance);
          if (numbersWithinTolerance(numericNorm(connector), 0, tolerance)) {
            return true;
          }
          const scale = numericNorm(connector) * numericNorm(d1.vector);
          return numbersWithinTolerance(numericNorm(connectorCross), 0, {
            absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
            relative: 0,
          });
        })();
    const classification: LineLineIntersectionClassification = coincident
      ? "coincident-infinite"
      : "parallel-no-intersection";
    steps.record({
      title: "Compute the evidence",
      substitution: `b1 × b2 = ${formatExactVector(cross)}, a2−a1 = ${formatExactVector(connector)}, (a2−a1) × b1 = ${formatExactVector(connectorCross)}`,
      result: `classification: ${classification}`,
    });
    steps.record({
      title: "Classify and interpret",
      description:
        "Geometric interpretation: parallel directions admit no single intersection point. Coincident lines are the same line written twice — every point is a solution (coincident-infinite); distinct parallel lines never meet (parallel-no-intersection).",
      result: classification,
    });
    checks.record({
      rule: "directions-relation",
      passed: true,
      message: `b1 × b2 = ${formatExactVector(cross)} — directions are parallel${exact ? "" : ` (approximate path, tolerance ${formatTolerance(resolveTolerance(options?.tolerance))})`}`,
      targetIds,
    });
    checks.record({
      rule: "relation-classification",
      passed: true,
      message: `relation ${classification}: ${coincident ? "base-point connector is parallel to the direction — infinitely many solutions" : "base-point connector is not parallel to the direction — no solution"}`,
      targetIds,
    });
    return coreOk(
      buildSolveOutcome<LineLineIntersectionResult>(
        { classification, displayGeometry: [] },
        steps.steps,
        checks.records,
      ),
    );
  }

  // Non-parallel directions: exact 2×2 nearest-point solve (Cramer).
  const w = subtractVectors(a2.vector, a1.vector);
  const b11 = squaredNorm(d1.vector);
  const b22 = squaredNorm(d2.vector);
  const b12 = dotProduct(d1.vector, d2.vector);
  const w1 = dotProduct(w, d1.vector);
  const w2 = dotProduct(w, d2.vector);
  // Δ = |b1×b2|² > 0 by the Lagrange identity (directions are non-parallel).
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
  const feetCoincide = exact
    ? exactVectorsEqual(foot1, foot2)
    : numbersWithinTolerance(
        numericNorm(connector),
        0,
        resolveTolerance(options?.tolerance),
      );

  steps.record({
    title: "Solve the 2×2 nearest-point system",
    substitution: `b1·b1 = ${formatRational(b11)}, b2·b2 = ${formatRational(b22)}, b1·b2 = ${formatRational(b12)}, Δ = ${formatRational(delta)}, (a2−a1)·b1 = ${formatRational(w1)}, (a2−a1)·b2 = ${formatRational(w2)}`,
    result: `s = ${formatRational(s)}, t = ${formatRational(t)}, F1 = ${formatExactVector(foot1)}, F2 = ${formatExactVector(foot2)}`,
  });

  checks.record({
    rule: "directions-relation",
    passed: true,
    message: `b1 × b2 = ${formatExactVector(cross)} ≠ 0 — directions are not parallel, Δ = |b1×b2|² = ${formatRational(delta)} > 0`,
    targetIds,
  });

  if (feetCoincide) {
    const classification: LineLineIntersectionClassification = "unique";
    const hit = exactPoint3(
      `intersection-${line1.lineId}-${line2.lineId}`,
      `intersection of ${line1.label} and ${line2.label}`,
      foot1,
      exact,
    );
    steps.record({
      title: "Verify the shared foot",
      description:
        "The two feet coincide, so the lines meet in exactly one point; the point is back-substituted into BOTH line equations (see the validation records).",
      substitution: `F1 = ${formatExactVector(foot1)}, F2 = ${formatExactVector(foot2)}, F2 − F1 = ${formatExactVector(connector)}`,
      result: `intersection point = ${formatExactVector(foot1)} at s = ${formatRational(s)}, t = ${formatRational(t)}`,
    });
    steps.record({
      title: "Classify and interpret",
      description:
        "Geometric interpretation: two non-parallel lines in a common plane pierce each other at one point (unique).",
      result: classification,
    });
    recordResidual(
      checks,
      vectorResidualCheck(linePointResidualVector(foot1, a1.vector, d1.vector), exact, options?.tolerance),
      "intersection-on-line1",
      "back-substitution: (P − a1) × b1 = 0",
      targetIds,
    );
    recordResidual(
      checks,
      vectorResidualCheck(linePointResidualVector(foot1, a2.vector, d2.vector), exact, options?.tolerance),
      "intersection-on-line2",
      "back-substitution: (P − a2) × b2 = 0",
      targetIds,
    );
    checks.record({
      rule: "relation-classification",
      passed: true,
      message: "relation unique: the feet coincide — exactly one intersection point",
      targetIds,
    });
    return coreOk(
      buildSolveOutcome<LineLineIntersectionResult>(
        {
          classification,
          intersectionPoint: hit,
          parameterOnLine1: scalarFromRational(s, { exact }),
          parameterOnLine2: scalarFromRational(t, { exact }),
          displayGeometry: [
            pointDisplay("int-ll-intersection", "intersection point of the two lines", hit, targetIds),
          ],
        },
        steps.steps,
        checks.records,
      ),
    );
  }

  const classification: LineLineIntersectionClassification = "skew-no-intersection";
  steps.record({
    title: "Classify and interpret",
    description:
      "The nearest-point feet do NOT coincide, so the lines are skew: non-parallel, non-intersecting, no solution. The feet and the common-perpendicular segment are reported as evidence.",
    substitution: `F2 − F1 = ${formatExactVector(connector)} ≠ 0`,
    result: classification,
  });
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
  checks.record({
    rule: "relation-classification",
    passed: true,
    message: `relation skew-no-intersection: feet differ by ${formatExactVector(connector)}${exact ? "" : ` (approximate path, tolerance ${formatTolerance(resolveTolerance(options?.tolerance))})`}`,
    targetIds,
  });
  const foot1Point = exactPoint3("int-ll-foot1", "nearest point on line 1", foot1, exact);
  const foot2Point = exactPoint3("int-ll-foot2", "nearest point on line 2", foot2, exact);
  return coreOk(
    buildSolveOutcome<LineLineIntersectionResult>(
      {
        classification,
        displayGeometry: [
          segmentDisplay(
            "int-ll-common-perpendicular",
            "common perpendicular segment between the skew lines",
            foot1Point,
            foot2Point,
            targetIds,
          ),
        ],
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * 2. Line–plane intersection
 * ------------------------------------------------------------------------ */

export type LinePlaneIntersectionClassification =
  | "unique"
  | "contained-infinite"
  | "parallel-no-intersection";

export interface LinePlaneIntersectionResult {
  readonly classification: LinePlaneIntersectionClassification;
  /** Present only for "unique". */
  readonly intersectionPoint?: Point3V1;
  /** Parameter λ of the intersection on r = a + λb ("unique" only). */
  readonly parameter?: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

/**
 * Intersects a line with a plane r·n = d0. b·n ≠ 0 ⟹ unique intersection at
 * λ = (d0 − a·n)/(b·n), back-substituted into both the line and the plane
 * equation. b·n = 0 ⟹ the line is parallel to the plane: contained-infinite
 * when the base point satisfies the plane equation (every point of the line
 * is a solution), parallel-no-intersection otherwise.
 */
export function linePlaneIntersection(
  line: Line3V1,
  plane: Plane3V1,
  options?: IntersectionOptions,
): CoreResult<SolveOutcome<LinePlaneIntersectionResult>> {
  const d = exactVectorFromVector3(line.direction);
  const a = exactVectorFromVector3(line.point.position);
  const n = exactVectorFromVector3(plane.normal);
  const p = exactVectorFromVector3(plane.point.position);
  const exact = d.exact && a.exact && n.exact && p.exact;
  const refusalD = refuseZero(d.vector, "line-direction", line.lineId);
  if (refusalD !== undefined) {
    return refusalD;
  }
  const refusalN = refuseZero(n.vector, "plane-normal", plane.planeId);
  if (refusalN !== undefined) {
    return refusalN;
  }
  const equation = unwrapCoreResult(planeEquationFromPlane3(plane));

  const steps = new DerivationRecorder("int-lp-step");
  const checks = new ValidationRecorder("int-lp-validation");
  const targetIds = [line.lineId, plane.planeId];

  const dot = dotProduct(d.vector, equation.normal);
  const baseDot = dotProduct(a.vector, equation.normal);
  const residual = subtractRationals(baseDot, equation.d);
  const dotZero = scalarIsZero(dot, exact, options?.tolerance);
  const residualZero = scalarIsZero(residual, exact, options?.tolerance);

  steps.record({
    title: "Write down the known quantities",
    description: "Line r = a + λb and plane r·n = d0. Substituting the line into the plane equation gives λ·(b·n) = d0 − a·n.",
    substitution: `a = ${formatExactVector(a.vector)}, b = ${formatExactVector(d.vector)}, n = ${formatExactVector(equation.normal)}, d0 = ${formatRational(equation.d)}`,
  });
  steps.record({
    title: "State the criteria",
    description:
      "b·n ≠ 0 ⟹ exactly one solution λ = (d0 − a·n)/(b·n). b·n = 0 ⟹ the left side vanishes identically: the line is contained in the plane (infinitely many solutions) iff a·n − d0 = 0, otherwise it never meets the plane. Applicability: non-zero direction and normal (checked).",
    formula: "λ = (d0 − a·n)/(b·n) when b·n ≠ 0;  containment test a·n − d0 = 0",
  });

  if (!dotZero.isZero) {
    const lambda = divideRationalsUnsafe(subtractRationals(equation.d, baseDot), dot);
    const hitVector = addVectors(a.vector, scaleVector(d.vector, lambda));
    const classification: LinePlaneIntersectionClassification = "unique";
    steps.record({
      title: "Solve for λ and back-substitute",
      substitution: `λ = (${formatRational(equation.d)} − ${formatRational(baseDot)})/(${formatRational(dot)}) = ${formatRational(lambda)}; P = a + λb = ${formatExactVector(hitVector)}`,
      result: `intersection point = ${formatExactVector(hitVector)}`,
    });
    steps.record({
      title: "Classify and interpret",
      description:
        "Geometric interpretation: the line pierces the plane at exactly one point (unique). The point is verified against BOTH the line equation and the plane equation (validation records below).",
      result: classification,
    });
    recordResidual(
      checks,
      checkScalarResidual(
        planePointResidual(equation, hitVector),
        ZERO_RATIONAL,
        residualOptions(exact, options?.tolerance),
      ),
      "point-on-plane",
      "back-substitution: P·n − d0 = 0",
      targetIds,
    );
    recordResidual(
      checks,
      vectorResidualCheck(linePointResidualVector(hitVector, a.vector, d.vector), exact, options?.tolerance),
      "point-on-line",
      "back-substitution: (P − a) × b = 0",
      targetIds,
    );
    checks.record({
      rule: "relation-classification",
      passed: true,
      message: `relation unique: b·n = ${formatRational(dot)} ≠ 0${dotZero.tolerance ? ` (approximate path, tolerance ${formatTolerance(dotZero.tolerance)})` : ""}`,
      targetIds,
    });
    const hit = exactPoint3(
      `intersection-${line.lineId}-${plane.planeId}`,
      `intersection of ${line.label} and ${plane.label}`,
      hitVector,
      exact,
    );
    return coreOk(
      buildSolveOutcome<LinePlaneIntersectionResult>(
        {
          classification,
          intersectionPoint: hit,
          parameter: scalarFromRational(lambda, { exact }),
          displayGeometry: [
            pointDisplay("int-lp-intersection", "intersection point of the line and the plane", hit, targetIds),
          ],
        },
        steps.steps,
        checks.records,
      ),
    );
  }

  const classification: LinePlaneIntersectionClassification = residualZero.isZero
    ? "contained-infinite"
    : "parallel-no-intersection";
  steps.record({
    title: "Compute the evidence",
    substitution: `b·n = ${formatRational(dot)}, a·n − d0 = ${formatRational(residual)}`,
    result: `classification: ${classification}`,
  });
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: with b·n = 0 the line runs parallel to the plane. When the base point also satisfies the plane equation the WHOLE line lies in the plane — infinitely many solutions (contained-infinite); otherwise the line never meets the plane (parallel-no-intersection).",
    result: classification,
  });
  recordResidual(
    checks,
    checkScalarResidual(residual, ZERO_RATIONAL, residualOptions(exact, options?.tolerance)),
    "base-point-substitution",
    "base point substitution: a·n − d0",
    targetIds,
  );
  checks.record({
    rule: "relation-classification",
    passed: true,
    message: `relation ${classification}: b·n = 0 and a·n − d0 = ${formatRational(residual)}${dotZero.tolerance ? ` (approximate path, tolerance ${formatTolerance(dotZero.tolerance)})` : ""}`,
    targetIds,
  });
  return coreOk(
    buildSolveOutcome<LinePlaneIntersectionResult>(
      { classification, displayGeometry: [] },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * 3. Plane–plane intersection
 * ------------------------------------------------------------------------ */

export type PlanePlaneIntersectionClassification =
  | "intersecting-in-line"
  | "parallel-no-intersection"
  | "coincident-infinite";

export interface PlanePlaneIntersectionResult {
  readonly classification: PlanePlaneIntersectionClassification;
  /** Present only for "intersecting-in-line": point r0 + direction n1×n2. */
  readonly intersectionLine?: Line3V1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

/**
 * Intersects two planes r·n1 = d1 and r·n2 = d2. Non-parallel normals ⟹ the
 * intersection is the line through r0 = α·n1 + β·n2 with direction n1×n2,
 * where α, β solve the 2×2 system α·(n1·n1) + β·(n1·n2) = d1,
 * α·(n1·n2) + β·(n2·n2) = d2 (so r0 lies in BOTH planes and in
 * span(n1, n2)); the direction is verified perpendicular to both normals.
 * Parallel normals ⟹ coincident-infinite when the equations are scalar
 * multiples (planeEquationsEquivalent), otherwise parallel-no-intersection.
 */
export function planePlaneIntersection(
  plane1: Plane3V1,
  plane2: Plane3V1,
  options?: IntersectionOptions,
): CoreResult<SolveOutcome<PlanePlaneIntersectionResult>> {
  const n1 = exactVectorFromVector3(plane1.normal);
  const n2 = exactVectorFromVector3(plane2.normal);
  const p1 = exactVectorFromVector3(plane1.point.position);
  const p2 = exactVectorFromVector3(plane2.point.position);
  const exact = n1.exact && n2.exact && p1.exact && p2.exact;
  const refusal1 = refuseZero(n1.vector, "plane1-normal", plane1.planeId);
  if (refusal1 !== undefined) {
    return refusal1;
  }
  const refusal2 = refuseZero(n2.vector, "plane2-normal", plane2.planeId);
  if (refusal2 !== undefined) {
    return refusal2;
  }
  const equation1 = unwrapCoreResult(planeEquationFromPlane3(plane1));
  const equation2 = unwrapCoreResult(planeEquationFromPlane3(plane2));

  const steps = new DerivationRecorder("int-pp-step");
  const checks = new ValidationRecorder("int-pp-validation");
  const targetIds = [plane1.planeId, plane2.planeId];

  steps.record({
    title: "Write down the known quantities",
    description: "Two planes r·n1 = d1 and r·n2 = d2. An intersection point satisfies BOTH equations simultaneously.",
    substitution: `n1 = ${formatExactVector(n1.vector)}, d1 = ${formatRational(equation1.d)}, n2 = ${formatExactVector(n2.vector)}, d2 = ${formatRational(equation2.d)}`,
  });
  steps.record({
    title: "State the criteria",
    description:
      "n1 × n2 ≠ 0 ⟹ the intersection is a line with direction n1×n2 (perpendicular to both normals). A point on it is r0 = α·n1 + β·n2 with α, β from the 2×2 system α·(n1·n1) + β·(n1·n2) = d1, α·(n1·n2) + β·(n2·n2) = d2 — the unique point of the line lying in span(n1, n2). n1 × n2 = 0 ⟹ parallel normals: coincident (infinitely many solutions, a whole plane) iff the equations are scalar multiples, otherwise no solution. Applicability: both normals non-zero (checked).",
    formula: "direction = n1×n2;  α = (d1·(n2·n2) − d2·(n1·n2))/Δ, β = (d2·(n1·n1) − d1·(n1·n2))/Δ, Δ = |n1×n2|²",
  });

  const cross = crossProduct(n1.vector, n2.vector);
  const parallel = areParallel(plane1.normal, plane2.normal, options?.tolerance);

  if (parallel.classification === "parallel") {
    let coincident: boolean;
    let coincidentEvidence: string;
    if (exact) {
      coincident = unwrapCoreResult(planeEquationsEquivalent(equation1, equation2));
      coincidentEvidence = coincident
        ? "the normalized equations are identical, so one equation is a scalar multiple of the other"
        : "the normalized equations differ, so the planes are parallel and distinct";
    } else {
      const residual = planePointResidual(equation1, p2.vector);
      const tolerance = resolveTolerance(options?.tolerance);
      const scale = numericNorm(p2.vector) * numericNorm(equation1.normal);
      coincident = numbersWithinTolerance(rationalToNumber(residual), 0, {
        absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
        relative: 0,
      });
      coincidentEvidence = `A2·n1 − d1 = ${formatRational(residual)} (approximate path, tolerance ${formatTolerance(tolerance)})`;
    }
    const classification: PlanePlaneIntersectionClassification = coincident
      ? "coincident-infinite"
      : "parallel-no-intersection";
    steps.record({
      title: "Compute the evidence",
      substitution: `n1 × n2 = ${formatExactVector(cross)}; ${coincidentEvidence}`,
      result: `classification: ${classification}`,
    });
    steps.record({
      title: "Classify and interpret",
      description:
        "Geometric interpretation: parallel normals admit no single intersection line. Coincident planes are the same plane written twice — every point of the plane is a solution (coincident-infinite); distinct parallel planes never meet (parallel-no-intersection).",
      result: classification,
    });
    checks.record({
      rule: "normals-relation",
      passed: true,
      message: `n1 × n2 = ${formatExactVector(cross)} — normals are parallel${exact ? "" : ` (approximate path, tolerance ${formatTolerance(resolveTolerance(options?.tolerance))})`}`,
      targetIds,
    });
    checks.record({
      rule: "relation-classification",
      passed: true,
      message: `relation ${classification}: ${coincidentEvidence}`,
      targetIds,
    });
    return coreOk(
      buildSolveOutcome<PlanePlaneIntersectionResult>(
        { classification, displayGeometry: [] },
        steps.steps,
        checks.records,
      ),
    );
  }

  // Non-parallel normals: direction = n1×n2 (carried RAW, not reduced to a
  // primitive integer direction — the raw cross product is the textbook
  // answer and the reduction would only rescale it).
  const n1n1 = squaredNorm(n1.vector);
  const n2n2 = squaredNorm(n2.vector);
  const n1n2 = dotProduct(n1.vector, n2.vector);
  // Δ = (n1·n1)(n2·n2) − (n1·n2)² = |n1×n2|² > 0 (Lagrange; normals not parallel).
  const delta = subtractRationals(multiplyRationals(n1n1, n2n2), multiplyRationals(n1n2, n1n2));
  const alpha = divideRationalsUnsafe(
    subtractRationals(multiplyRationals(equation1.d, n2n2), multiplyRationals(equation2.d, n1n2)),
    delta,
  );
  const beta = divideRationalsUnsafe(
    subtractRationals(multiplyRationals(equation2.d, n1n1), multiplyRationals(equation1.d, n1n2)),
    delta,
  );
  const r0 = addVectors(scaleVector(n1.vector, alpha), scaleVector(n2.vector, beta));

  steps.record({
    title: "Solve for the line point and direction",
    substitution: `n1·n1 = ${formatRational(n1n1)}, n2·n2 = ${formatRational(n2n2)}, n1·n2 = ${formatRational(n1n2)}, Δ = ${formatRational(delta)}; α = ${formatRational(alpha)}, β = ${formatRational(beta)}`,
    result: `r0 = ${formatExactVector(r0)}, direction = n1×n2 = ${formatExactVector(cross)}`,
  });
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: two non-parallel planes share a whole line (intersecting-in-line) — infinitely many solutions parameterized as r = r0 + μ·(n1×n2). The direction is verified perpendicular to both normals and r0 is back-substituted into BOTH plane equations (validation records below).",
    result: "intersecting-in-line",
  });

  recordResidual(
    checks,
    checkScalarResidual(dotProduct(cross, n1.vector), ZERO_RATIONAL, residualOptions(exact, options?.tolerance)),
    "direction-perpendicular-to-normal1",
    "verification: (n1×n2)·n1 = 0 — the intersection direction is perpendicular to normal 1",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(dotProduct(cross, n2.vector), ZERO_RATIONAL, residualOptions(exact, options?.tolerance)),
    "direction-perpendicular-to-normal2",
    "verification: (n1×n2)·n2 = 0 — the intersection direction is perpendicular to normal 2",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      planePointResidual(equation1, r0),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "point-on-plane1",
    "back-substitution: r0·n1 − d1 = 0",
    targetIds,
  );
  recordResidual(
    checks,
    checkScalarResidual(
      planePointResidual(equation2, r0),
      ZERO_RATIONAL,
      residualOptions(exact, options?.tolerance),
    ),
    "point-on-plane2",
    "back-substitution: r0·n2 − d2 = 0",
    targetIds,
  );
  checks.record({
    rule: "relation-classification",
    passed: true,
    message: `relation intersecting-in-line: n1 × n2 = ${formatExactVector(cross)} ≠ 0`,
    targetIds,
  });

  const linePoint = exactPoint3(
    `intersection-${plane1.planeId}-${plane2.planeId}-point`,
    `a point on the intersection line of ${plane1.label} and ${plane2.label}`,
    r0,
    exact,
  );
  const intersectionLine: Line3V1 = {
    lineId: `intersection-${plane1.planeId}-${plane2.planeId}`,
    label: `intersection line of ${plane1.label} and ${plane2.label}`,
    point: linePoint,
    direction: vector3FromExactVector(cross, { exact }),
  };
  return coreOk(
    buildSolveOutcome<PlanePlaneIntersectionResult>(
      {
        classification: "intersecting-in-line",
        intersectionLine,
        displayGeometry: [
          {
            displayId: "int-pp-line",
            kind: "line",
            label: "intersection line of the two planes",
            relatedEntityIds: targetIds,
            points: [linePoint],
            direction: vector3FromExactVector(cross, { exact }),
          },
        ],
      },
      steps.steps,
      checks.records,
    ),
  );
}
