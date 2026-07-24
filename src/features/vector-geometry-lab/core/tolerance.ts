import type { ScalarV1, Vector3V1 } from "@/features/vector-geometry-lab/schema";

import {
  compareRationals,
  rationalFromScalar,
  rationalToNumber,
} from "./rational.js";

/**
 * Tolerance policy — spec §3 hard requirements:
 *
 * 1. DEFAULT_TOLERANCE is the single source of truth for the whole project.
 * 2. Every comparison is dual-path:
 *    - both sides carry exact:true provenance → EXACT comparison of the
 *      underlying rationals/radicals, result flagged `exact: true` and NO
 *      tolerance is attached;
 *    - either side approximate → float comparison against the tolerance,
 *      and the returned value RECORDS the tolerance actually used.
 * 3. Values farther apart than the tolerance are NEVER reported as equal.
 *
 * Float rule: |a − b| ≤ max(absolute, relative · max(|a|, |b|)). The bound
 * is INCLUSIVE: a gap exactly equal to the tolerance counts as equal (this
 * is the documented boundary convention; anything strictly larger does not).
 */

export interface Tolerance {
  readonly absolute: number;
  readonly relative: number;
}

export const DEFAULT_TOLERANCE: Tolerance = Object.freeze({
  absolute: 1e-9,
  relative: 1e-9,
});

/** Validates and merges an optional partial override over the defaults. */
export function resolveTolerance(override?: Partial<Tolerance>): Tolerance {
  const absolute = override?.absolute ?? DEFAULT_TOLERANCE.absolute;
  const relative = override?.relative ?? DEFAULT_TOLERANCE.relative;
  for (const [name, value] of [
    ["absolute", absolute],
    ["relative", relative],
  ] as const) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new RangeError(
        `tolerance.${name} must be a finite non-negative number`,
      );
    }
  }
  return Object.freeze({ absolute, relative });
}

/**
 * Outcome of a dual-path comparison. `exact: true` means the decision was
 * made by exact arithmetic; `exact: false` means the recorded `tolerance`
 * was used.
 */
export interface Comparison<T> {
  readonly value: T;
  readonly exact: boolean;
  readonly tolerance?: Tolerance;
}

function exactComparison<T>(value: T): Comparison<T> {
  return { value, exact: true };
}

function tolerantComparison<T>(value: T, tolerance: Tolerance): Comparison<T> {
  return { value, exact: false, tolerance };
}

/** The raw float rule, exported so residual checks share one implementation. */
export function numbersWithinTolerance(
  a: number,
  b: number,
  tolerance: Tolerance,
): boolean {
  const gap = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return gap <= Math.max(tolerance.absolute, tolerance.relative * scale);
}

/** Dual-path scalar equality. */
export function compareScalars(
  a: ScalarV1,
  b: ScalarV1,
  toleranceOverride?: Partial<Tolerance>,
): Comparison<boolean> {
  if (a.exact && b.exact) {
    return exactComparison(
      compareRationals(rationalFromScalar(a), rationalFromScalar(b)) === 0,
    );
  }
  const tolerance = resolveTolerance(toleranceOverride);
  return tolerantComparison(
    numbersWithinTolerance(
      rationalToNumber(rationalFromScalar(a)),
      rationalToNumber(rationalFromScalar(b)),
      tolerance,
    ),
    tolerance,
  );
}

/** Dual-path total order on scalars (−1 / 0 / +1; 0 means "equal"). */
export function orderScalars(
  a: ScalarV1,
  b: ScalarV1,
  toleranceOverride?: Partial<Tolerance>,
): Comparison<-1 | 0 | 1> {
  if (a.exact && b.exact) {
    return exactComparison(
      compareRationals(rationalFromScalar(a), rationalFromScalar(b)),
    );
  }
  const tolerance = resolveTolerance(toleranceOverride);
  const x = rationalToNumber(rationalFromScalar(a));
  const y = rationalToNumber(rationalFromScalar(b));
  if (numbersWithinTolerance(x, y, tolerance)) {
    return tolerantComparison(0, tolerance);
  }
  return tolerantComparison(x < y ? -1 : 1, tolerance);
}

/** Dual-path component-wise vector equality. */
export function compareScalarVectors(
  a: Vector3V1,
  b: Vector3V1,
  toleranceOverride?: Partial<Tolerance>,
): Comparison<boolean> {
  const exact = a.x.exact && a.y.exact && a.z.exact && b.x.exact && b.y.exact && b.z.exact;
  if (exact) {
    return exactComparison(
      compareRationals(rationalFromScalar(a.x), rationalFromScalar(b.x)) === 0 &&
        compareRationals(rationalFromScalar(a.y), rationalFromScalar(b.y)) === 0 &&
        compareRationals(rationalFromScalar(a.z), rationalFromScalar(b.z)) === 0,
    );
  }
  const tolerance = resolveTolerance(toleranceOverride);
  const equal =
    numbersWithinTolerance(
      rationalToNumber(rationalFromScalar(a.x)),
      rationalToNumber(rationalFromScalar(b.x)),
      tolerance,
    ) &&
    numbersWithinTolerance(
      rationalToNumber(rationalFromScalar(a.y)),
      rationalToNumber(rationalFromScalar(b.y)),
      tolerance,
    ) &&
    numbersWithinTolerance(
      rationalToNumber(rationalFromScalar(a.z)),
      rationalToNumber(rationalFromScalar(b.z)),
      tolerance,
    );
  return tolerantComparison(equal, tolerance);
}

/** Stable string form for ValidationRecordV1.tolerance. */
export function formatTolerance(tolerance: Tolerance): string {
  return `absolute=${tolerance.absolute}; relative=${tolerance.relative}`;
}
