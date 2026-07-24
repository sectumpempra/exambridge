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
import type { CoreResult } from "./errors.js";
import { coreFail, coreOk, unwrapCoreResult } from "./errors.js";
import { planeEquationFromPlane3 } from "./line-plane.js";
import { planeEquationsEquivalent } from "./line-plane.js";
import type { ExactRational } from "./rational.js";
import {
  divideRationalsUnsafe,
  formatRational,
  rationalToNumber,
  scalarFromRational,
  subtractRationals,
} from "./rational.js";
import { areParallel, arePerpendicular } from "./relations.js";
import type { Tolerance } from "./tolerance.js";
import { formatTolerance, numbersWithinTolerance, resolveTolerance } from "./tolerance.js";
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
  vector3FromExactVector,
} from "./vectors.js";

/**
 * Line/plane relation solvers — Stage 4 of ExamBridge Vector Geometry Lab V1
 * (spec §2.3 and §2.4).
 *
 * - vectorPlaneRelation: vector ∥ plane / vector ⊥ plane / oblique,
 * - linePlaneRelation:   contained-in-plane / parallel-not-in-plane /
 *                        intersecting-at-point / perpendicular-to-plane,
 * - planePlaneRelation:  coincident / parallel-not-coincident /
 *                        intersecting-in-line / perpendicular.
 *
 * Every classification shows its evidence (spec §2.3): the direction·normal
 * dot product, the base-point substitution into the plane equation, and —
 * for intersecting lines — the parameter λ and the intersection point.
 * Dual-path like the rest of the core: exact provenance decides by exact
 * bigint arithmetic; approximate provenance decides against the recorded
 * tolerance. Zero directions / zero normals are refused with structured
 * "zero-vector" failures, never silently classified.
 */

export interface RelationOptions {
  /** Float-comparison tolerance for approximate (exact:false) inputs. */
  readonly tolerance?: Partial<Tolerance>;
}

/* --------------------------------------------------------------------------
 * Shared internals
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
      `cannot classify a relation involving a zero ${role}; the relation is undefined (refusing instead of guessing)`,
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

function normalArrowDisplay(
  displayId: string,
  plane: Plane3V1,
  exact: boolean,
): DisplayGeometryV1 {
  const basePoint = exactVectorFromVector3(plane.point.position);
  const normal = exactVectorFromVector3(plane.normal);
  return {
    displayId,
    kind: "normal-arrow",
    label: `normal vector of ${plane.label}`,
    relatedEntityIds: [plane.planeId],
    points: [
      {
        pointId: `${displayId}-base`,
        label: `base of the normal of ${plane.label}`,
        position: vector3FromExactVector(basePoint.vector, { exact: exact && basePoint.exact && normal.exact }),
      },
    ],
    direction: vector3FromExactVector(normal.vector, { exact: exact && basePoint.exact && normal.exact }),
  };
}

/* --------------------------------------------------------------------------
 * Vector–plane relation
 * ------------------------------------------------------------------------ */

export type VectorPlaneRelationClassification =
  | "parallel-to-plane"
  | "perpendicular-to-plane"
  | "oblique";

export interface VectorPlaneRelationResult {
  readonly classification: VectorPlaneRelationClassification;
  /** The dot product v·n the classification is based on. */
  readonly dotProduct: ScalarV1;
  readonly exact: boolean;
  readonly tolerance?: Tolerance;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

/**
 * Classifies a vector against a plane: v·n = 0 ⟺ v parallel to the plane;
 * v ∥ n ⟺ v perpendicular to the plane; anything else is oblique.
 */
export function vectorPlaneRelation(
  vector: Vector3V1,
  plane: Plane3V1,
  options?: RelationOptions,
): CoreResult<SolveOutcome<VectorPlaneRelationResult>> {
  const v = exactVectorFromVector3(vector);
  const n = exactVectorFromVector3(plane.normal);
  const p = exactVectorFromVector3(plane.point.position);
  const exact = v.exact && n.exact && p.exact;
  const refusalV = refuseZero(v.vector, "vector", "vector");
  if (refusalV !== undefined) {
    return refusalV;
  }
  const refusalN = refuseZero(n.vector, "plane-normal", plane.planeId);
  if (refusalN !== undefined) {
    return refusalN;
  }

  const steps = new DerivationRecorder("rel-vp-step");
  const checks = new ValidationRecorder("rel-vp-validation");
  const targetIds = ["vector", plane.planeId];

  const dot = dotProduct(v.vector, n.vector);
  const perpendicular = arePerpendicular(vector, plane.normal, options?.tolerance);
  const parallel = areParallel(vector, plane.normal, options?.tolerance);
  const classification: VectorPlaneRelationClassification =
    perpendicular.classification === "perpendicular"
      ? "parallel-to-plane"
      : parallel.classification === "parallel"
        ? "perpendicular-to-plane"
        : "oblique";

  steps.record({
    title: "Write down the known quantities",
    description: "A free vector v and a plane with normal n. The relation is decided entirely by v·n and v × n.",
    substitution: `v = ${formatExactVector(v.vector)}, n = ${formatExactVector(n.vector)}`,
  });
  steps.record({
    title: "State the criteria",
    description:
      "v·n = 0 ⟺ v is parallel to the plane (perpendicular to its normal); v × n = 0 ⟺ v is parallel to the normal, i.e. perpendicular to the plane; otherwise the vector is oblique to the plane. Applicability: non-zero vector and normal (checked).",
    formula: "parallel-to-plane ⟺ v·n = 0;  perpendicular-to-plane ⟺ v × n = 0",
  });
  steps.record({
    title: "Compute the evidence",
    substitution: `v·n = ${formatRational(dot)}, v × n = ${formatExactVector(crossProduct(v.vector, n.vector))}`,
    result: `classification: ${classification}`,
  });
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: a vector parallel to the plane can be slid into the plane; a vector perpendicular to the plane is a normal direction; an oblique vector has components both in and out of the plane. Degenerate cases (zero vector / zero normal) are refused, not classified.",
    result: classification,
  });

  checks.record({
    rule: "dot-product-evidence",
    passed: true,
    message: `v·n = ${formatRational(dot)} is the primary evidence${perpendicular.exact && parallel.exact ? "" : ` (approximate path, tolerance ${formatTolerance(resolveTolerance(options?.tolerance))})`}`,
    targetIds,
  });
  checks.record({
    rule: "relation-classification",
    passed: true,
    message: `relation ${classification}: decided by v·n and v × n`,
    targetIds,
  });

  return coreOk(
    buildSolveOutcome<VectorPlaneRelationResult>(
      {
        classification,
        dotProduct: scalarFromRational(dot, { exact }),
        ...(exact
          ? { exact: true }
          : { exact: false, tolerance: resolveTolerance(options?.tolerance) }),
        displayGeometry: [normalArrowDisplay("rel-vp-normal", plane, exact)],
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * Line–plane relation
 * ------------------------------------------------------------------------ */

export type LinePlaneRelationClassification =
  | "contained-in-plane"
  | "parallel-not-in-plane"
  | "intersecting-at-point"
  | "perpendicular-to-plane";

export interface LinePlaneRelationResult {
  readonly classification: LinePlaneRelationClassification;
  /** The dot product d·n the classification is based on. */
  readonly dotProduct: ScalarV1;
  /** Substitution of the base point into the plane equation: a·n − d0. */
  readonly basePointResidual: ScalarV1;
  /** Present when the line meets the plane (intersecting / perpendicular). */
  readonly intersectionPoint?: Point3V1;
  /** Parameter λ of the intersection point on r = a + λb. */
  readonly parameter?: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

/**
 * Classifies a line against a plane and, when they meet, computes the
 * intersection point with λ = (d0 − a·n)/(d·n). A direction parallel to the
 * normal means the line is perpendicular to the plane (its own category per
 * spec §2.3); d·n ≠ 0 otherwise means a single intersection point; d·n = 0
 * with the base point in the plane means containment, otherwise parallel
 * and not in the plane.
 */
export function linePlaneRelation(
  line: Line3V1,
  plane: Plane3V1,
  options?: RelationOptions,
): CoreResult<SolveOutcome<LinePlaneRelationResult>> {
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

  const steps = new DerivationRecorder("rel-lp-step");
  const checks = new ValidationRecorder("rel-lp-validation");
  const targetIds = [line.lineId, plane.planeId];

  const dot = dotProduct(d.vector, equation.normal);
  const residual = subtractRationals(dotProduct(a.vector, equation.normal), equation.d);
  const dotZero = scalarIsZero(dot, exact, options?.tolerance);
  const residualZero = scalarIsZero(residual, exact, options?.tolerance);
  const parallel = areParallel(line.direction, plane.normal, options?.tolerance);

  let classification: LinePlaneRelationClassification;
  if (parallel.classification === "parallel") {
    classification = "perpendicular-to-plane";
  } else if (!dotZero.isZero) {
    classification = "intersecting-at-point";
  } else if (residualZero.isZero) {
    classification = "contained-in-plane";
  } else {
    classification = "parallel-not-in-plane";
  }

  steps.record({
    title: "Write down the known quantities",
    description: "Line r = a + λb and plane r·n = d0. The direction·normal dot product and the base-point substitution decide the relation.",
    substitution: `a = ${formatExactVector(a.vector)}, b = ${formatExactVector(d.vector)}, n = ${formatExactVector(equation.normal)}, d0 = ${formatRational(equation.d)}`,
  });
  steps.record({
    title: "State the criteria",
    description:
      "b ∥ n ⟺ line perpendicular to the plane. Otherwise b·n ≠ 0 ⟹ the line meets the plane in exactly one point at λ = (d0 − a·n)/(b·n). b·n = 0: the line is parallel to the plane; it is contained iff the base point satisfies the plane equation (a·n − d0 = 0), otherwise parallel-not-in-plane. Applicability: non-zero direction and normal (checked).",
    formula: "λ = (d0 − a·n)/(b·n) when b·n ≠ 0;  containment test a·n − d0 = 0",
  });
  steps.record({
    title: "Compute the evidence",
    substitution: `b·n = ${formatRational(dot)}, a·n − d0 = ${formatRational(residual)}`,
    result: `classification: ${classification}`,
  });

  let intersectionPoint: Point3V1 | undefined;
  let parameter: ScalarV1 | undefined;
  if (classification === "intersecting-at-point" || classification === "perpendicular-to-plane") {
    const lambda = divideRationalsUnsafe(
      subtractRationals(equation.d, dotProduct(a.vector, equation.normal)),
      dot,
    );
    const hit = addVectors(a.vector, scaleVector(d.vector, lambda));
    intersectionPoint = {
      pointId: `intersection-${line.lineId}-${plane.planeId}`,
      label: `intersection of ${line.label} and ${plane.label}`,
      position: vector3FromExactVector(hit, { exact }),
    };
    parameter = scalarFromRational(lambda, { exact });
    steps.record({
      title: "Compute the intersection point",
      substitution: `λ = (${formatRational(equation.d)} − ${formatRational(dotProduct(a.vector, equation.normal))})/(${formatRational(dot)}) = ${formatRational(lambda)}`,
      result: `intersection point = ${formatExactVector(hit)}`,
    });
  }
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: contained lines lie flat in the plane; parallel-not-in-plane lines never meet it; intersecting lines pierce it at one point (shown with λ); perpendicular lines pierce it along the normal direction. Degenerate inputs are refused, not classified.",
    result: classification,
  });

  checks.record({
    rule: "dot-product-evidence",
    passed: true,
    message: `b·n = ${formatRational(dot)}${dotZero.tolerance ? ` (approximate path, tolerance ${formatTolerance(dotZero.tolerance)})` : ""}`,
    targetIds,
  });
  checks.record({
    rule: "base-point-substitution",
    passed: true,
    message: `a·n − d0 = ${formatRational(residual)}${residualZero.tolerance ? ` (approximate path, tolerance ${formatTolerance(residualZero.tolerance)})` : ""}`,
    targetIds,
    residual: scalarFromRational(residual, { exact }),
  });
  checks.record({
    rule: "relation-classification",
    passed: true,
    message: `relation ${classification}`,
    targetIds,
  });

  const displayGeometry: DisplayGeometryV1[] = [
    normalArrowDisplay("rel-lp-normal", plane, exact),
  ];
  if (intersectionPoint !== undefined) {
    displayGeometry.push({
      displayId: "rel-lp-intersection",
      kind: "point",
      label: "intersection point of the line and the plane",
      relatedEntityIds: targetIds,
      points: [intersectionPoint],
    });
  }

  return coreOk(
    buildSolveOutcome<LinePlaneRelationResult>(
      {
        classification,
        dotProduct: scalarFromRational(dot, { exact }),
        basePointResidual: scalarFromRational(residual, { exact }),
        ...(intersectionPoint === undefined ? {} : { intersectionPoint }),
        ...(parameter === undefined ? {} : { parameter }),
        displayGeometry,
      },
      steps.steps,
      checks.records,
    ),
  );
}

/* --------------------------------------------------------------------------
 * Plane–plane relation
 * ------------------------------------------------------------------------ */

export type PlanePlaneRelationClassification =
  | "coincident"
  | "parallel-not-coincident"
  | "intersecting-in-line"
  | "perpendicular";

export type NormalsRelation = "parallel" | "perpendicular" | "general";

export interface PlanePlaneRelationResult {
  readonly classification: PlanePlaneRelationClassification;
  /** Relation between the two normals (spec §2.4: 显示两个法向量及其关系). */
  readonly normalsRelation: NormalsRelation;
  /** The dot product n1·n2. */
  readonly normalsDotProduct: ScalarV1;
  readonly displayGeometry: readonly DisplayGeometryV1[];
}

/**
 * Classifies two planes: normals not parallel ⟹ the planes intersect in a
 * line (perpendicular when additionally n1·n2 = 0); normals parallel ⟹ the
 * planes are coincident when their equations are scalar multiples
 * (planeEquationsEquivalent), otherwise parallel-not-coincident.
 */
export function planePlaneRelation(
  plane1: Plane3V1,
  plane2: Plane3V1,
  options?: RelationOptions,
): CoreResult<SolveOutcome<PlanePlaneRelationResult>> {
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

  const steps = new DerivationRecorder("rel-pp-step");
  const checks = new ValidationRecorder("rel-pp-validation");
  const targetIds = [plane1.planeId, plane2.planeId];

  const dot = dotProduct(n1.vector, n2.vector);
  const cross = crossProduct(n1.vector, n2.vector);
  const parallel = areParallel(plane1.normal, plane2.normal, options?.tolerance);
  const perpendicular = arePerpendicular(plane1.normal, plane2.normal, options?.tolerance);

  let classification: PlanePlaneRelationClassification;
  let coincidentEvidence = "";
  if (parallel.classification !== "parallel") {
    classification =
      perpendicular.classification === "perpendicular"
        ? "perpendicular"
        : "intersecting-in-line";
  } else if (exact) {
    const equivalent = unwrapCoreResult(planeEquationsEquivalent(equation1, equation2));
    classification = equivalent ? "coincident" : "parallel-not-coincident";
    coincidentEvidence = equivalent
      ? "the normalized equations are identical, so one equation is a scalar multiple of the other"
      : "the normalized equations differ, so the planes are parallel and distinct";
  } else {
    // Approximate path: parallel normals + plane 2's base point substitution
    // into plane 1's equation within tolerance ⟹ coincident.
    const residual = subtractRationals(
      dotProduct(p2.vector, equation1.normal),
      equation1.d,
    );
    const tolerance = resolveTolerance(options?.tolerance);
    const scale = numericNorm(p2.vector) * numericNorm(equation1.normal);
    const coincident = numbersWithinTolerance(rationalToNumber(residual), 0, {
      absolute: Math.max(tolerance.absolute, tolerance.relative * scale),
      relative: 0,
    });
    classification = coincident ? "coincident" : "parallel-not-coincident";
    coincidentEvidence = `A2·n1 − d1 = ${formatRational(residual)} (approximate path, tolerance ${formatTolerance(tolerance)})`;
  }

  const normalsRelation: NormalsRelation =
    parallel.classification === "parallel"
      ? "parallel"
      : perpendicular.classification === "perpendicular"
        ? "perpendicular"
        : "general";

  steps.record({
    title: "Write down the known quantities",
    description: "Two planes through their normals; the relation is decided by n1 × n2, n1·n2, and (for parallel normals) equation equivalence.",
    substitution: `n1 = ${formatExactVector(n1.vector)}, n2 = ${formatExactVector(n2.vector)}`,
  });
  steps.record({
    title: "State the criteria",
    description:
      "n1 × n2 ≠ 0 ⟹ the planes intersect in a line (perpendicular when n1·n2 = 0). n1 × n2 = 0 ⟹ parallel normals: coincident iff the equations are scalar multiples, otherwise parallel-not-coincident. Applicability: both normals non-zero (checked).",
    formula: "intersecting ⟺ n1 × n2 ≠ 0;  perpendicular ⟺ n1·n2 = 0;  coincident ⟺ (n1, d1) ∝ (n2, d2)",
  });
  steps.record({
    title: "Compute the evidence",
    substitution: `n1·n2 = ${formatRational(dot)}, n1 × n2 = ${formatExactVector(cross)}${coincidentEvidence === "" ? "" : `; ${coincidentEvidence}`}`,
    result: `classification: ${classification}; normals are ${normalsRelation}`,
  });
  steps.record({
    title: "Classify and interpret",
    description:
      "Geometric interpretation: coincident planes are the same plane written twice; parallel-not-coincident planes never meet; intersecting planes share a whole line; perpendicular planes meet at a right dihedral angle. Degenerate inputs (zero normals) are refused, not classified.",
    result: classification,
  });

  checks.record({
    rule: "normals-relation",
    passed: true,
    message: `normals are ${normalsRelation} (n1·n2 = ${formatRational(dot)}, n1 × n2 = ${formatExactVector(cross)})`,
    targetIds,
  });
  checks.record({
    rule: "relation-classification",
    passed: true,
    message: `relation ${classification}${coincidentEvidence === "" ? "" : `: ${coincidentEvidence}`}`,
    targetIds,
  });

  return coreOk(
    buildSolveOutcome<PlanePlaneRelationResult>(
      {
        classification,
        normalsRelation,
        normalsDotProduct: scalarFromRational(dot, { exact }),
        displayGeometry: [
          normalArrowDisplay("rel-pp-normal1", plane1, exact),
          normalArrowDisplay("rel-pp-normal2", plane2, exact),
        ],
      },
      steps.steps,
      checks.records,
    ),
  );
}
