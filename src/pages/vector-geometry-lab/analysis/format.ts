/**
 * Display formatting helpers for math-layer values. These render the EXACT
 * literals carried by ScalarV1 (never silently rounded) alongside the core's
 * own decimal approximations — presentation only, never new mathematics.
 */

import type { ScalarV1, Vector3V1 } from "@/features/vector-geometry-lab/schema";
import { formatRadical } from "@/features/vector-geometry-lab/core";
import type {
  AngleMeasurement,
  DistanceMeasurement,
  LinePlaneAngleMeasurement,
} from "@/features/vector-geometry-lab/core";

/** Exact literal of a scalar (the original input, e.g. "3/2", "-7"). */
export function formatScalar(scalar: ScalarV1): string {
  return scalar.input;
}

/** "(x, y, z)" using exact literals. */
export function formatVector(vector: Vector3V1): string {
  return `(${formatScalar(vector.x)}, ${formatScalar(vector.y)}, ${formatScalar(vector.z)})`;
}

/** Exact radical + decimal approximation; approximate path shows tolerance. */
export function formatDistance(measurement: DistanceMeasurement): string {
  if (measurement.kind === "exact") {
    return `${formatRadical(measurement.radical)} (≈ ${measurement.decimalApproximation})`;
  }
  return `≈ ${measurement.value} (approximate; tolerance abs ${measurement.tolerance.absolute}, rel ${measurement.tolerance.relative})`;
}

function formatDegrees(degrees: number): string {
  return `${Number(degrees.toFixed(4))}°`;
}

/** Angle rendering: degrees (+ exact cosine/sine when available). */
export function formatAngle(
  measurement: AngleMeasurement | LinePlaneAngleMeasurement,
): string {
  if (measurement.kind === "exact") {
    const trig =
      "cosine" in measurement
        ? `cos θ = ${formatRadical(measurement.cosine)} (≈ ${measurement.cosineDecimalApproximation})`
        : `sin θ = ${formatRadical(measurement.sine)} (≈ ${measurement.sineDecimalApproximation})`;
    return `${formatDegrees(measurement.angleDegrees)} with ${trig}`;
  }
  return `${formatDegrees(measurement.angleDegrees)} (approximate)`;
}

/** Rounded sweep degrees for the 3d angle-arc payload (display only). */
export function sweepDegreesOf(
  measurement: AngleMeasurement | LinePlaneAngleMeasurement,
): string {
  return String(Number(measurement.angleDegrees.toFixed(4)));
}
