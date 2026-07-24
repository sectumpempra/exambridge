/**
 * ONE-WAY display conversions: ScalarV1 → float64, Vector3V1/Point3V1 →
 * THREE.Vector3. These exist ONLY to place pixels. The results are never
 * fed back into any mathematical computation (spec §5: 渲染层与数学层严格
 * 分离). Very large integer strings may exceed float64 precision — that is
 * accepted for display and documented here; the math layer keeps the exact
 * rationals.
 */

import * as THREE from "three";
import type { Point3V1, ScalarV1, Vector3V1 } from "@/features/vector-geometry-lab/schema";

/** Display-only float conversion of an exact rational scalar. */
export function scalarToDisplayNumber(scalar: ScalarV1): number {
  const numerator = Number(scalar.numerator);
  const denominator = Number(scalar.denominator);
  return numerator / denominator;
}

/** Display-only conversion of a Vector3V1 into a THREE.Vector3. */
export function vector3ToDisplay(vector: Vector3V1): THREE.Vector3 {
  return new THREE.Vector3(
    scalarToDisplayNumber(vector.x),
    scalarToDisplayNumber(vector.y),
    scalarToDisplayNumber(vector.z),
  );
}

/** Display-only world position of a Point3V1. */
export function pointToDisplayPosition(point: Point3V1): THREE.Vector3 {
  return vector3ToDisplay(point.position);
}

/** True when every component converted to a finite float (display guard). */
export function isFiniteDisplayVector(vector: THREE.Vector3): boolean {
  return (
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  );
}
