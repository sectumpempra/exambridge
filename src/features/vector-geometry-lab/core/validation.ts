import type { ScalarV1, ValidationRecordV1 } from "@/features/vector-geometry-lab/schema";

import type { PlaneEquation } from "./line-plane.js";
import type { ExactRational } from "./rational.js";
import {
  absRational,
  formatRational,
  isZeroRational,
  rationalToNumber,
  scalarFromRational,
  subtractRationals,
} from "./rational.js";
import type { Tolerance } from "./tolerance.js";
import {
  formatTolerance,
  numbersWithinTolerance,
  resolveTolerance,
} from "./tolerance.js";
import type { ExactVector3 } from "./vectors.js";
import {
  addVectors,
  crossProduct,
  dotProduct,
  negateVector,
} from "./vectors.js";

/**
 * Residual / back-substitution tools (spec §4: 结果代回验证 + 残差记录).
 *
 * Dual-path like comparisons: with exact provenance a residual passes iff it
 * is EXACTLY zero (no tolerance attached); with approximate provenance it
 * passes iff it is within tolerance, and the tolerance used is recorded on
 * the produced ValidationRecordV1 (as a stable string) — spec §3.
 */

export interface ResidualCheck {
  /** |actual − expected| as an exact rational on the carried values. */
  readonly residual: ExactRational;
  readonly passed: boolean;
  readonly exact: boolean;
  readonly tolerance?: Tolerance;
}

export interface ResidualCheckOptions {
  /** Provenance of the compared values; default true (exact zero test). */
  readonly exact?: boolean;
  readonly tolerance?: Partial<Tolerance>;
}

export function checkScalarResidual(
  actual: ExactRational,
  expected: ExactRational,
  options?: ResidualCheckOptions,
): ResidualCheck {
  const residual = absRational(subtractRationals(actual, expected));
  const exact = options?.exact ?? true;
  if (exact) {
    return { residual, passed: isZeroRational(residual), exact: true };
  }
  const tolerance = resolveTolerance(options?.tolerance);
  return {
    residual,
    passed: numbersWithinTolerance(
      rationalToNumber(actual),
      rationalToNumber(expected),
      tolerance,
    ),
    exact: false,
    tolerance,
  };
}

/** The residual magnitude as a ScalarV1; exactness follows the check. */
export function residualScalar(check: ResidualCheck): ScalarV1 {
  return scalarFromRational(check.residual, { exact: check.exact });
}

/**
 * Builds a schema-valid ValidationRecordV1 from a residual check.
 * Non-exact checks attach the tolerance string; exact checks omit it.
 */
export function validationRecordFromResidual(
  check: ResidualCheck,
  meta: {
    readonly validationId: string;
    readonly rule: string;
    readonly message?: string;
    readonly targetIds?: readonly string[];
    readonly severity?: "info" | "warning" | "error";
  },
): ValidationRecordV1 {
  const base = {
    validationId: meta.validationId,
    rule: meta.rule,
    severity: meta.severity ?? (check.passed ? ("info" as const) : ("error" as const)),
    passed: check.passed,
    message:
      meta.message ??
      (check.passed
        ? `residual ${formatRational(check.residual)} within required accuracy`
        : `residual ${formatRational(check.residual)} exceeds required accuracy`),
    targetIds: [...(meta.targetIds ?? [])],
    residual: residualScalar(check),
  };
  if (check.exact || check.tolerance === undefined) {
    return base;
  }
  return { ...base, tolerance: formatTolerance(check.tolerance) };
}

/** Plane residual r·n − d for a candidate point (exact). */
export function planePointResidual(
  equation: PlaneEquation,
  point: ExactVector3,
): ExactRational {
  return subtractRationals(dotProduct(point, equation.normal), equation.d);
}

/**
 * Line residual vector (p − a) × b for the line r = a + λb. The point lies
 * on the line (with b ≠ 0) iff this is exactly the zero vector.
 */
export function linePointResidualVector(
  point: ExactVector3,
  linePoint: ExactVector3,
  lineDirection: ExactVector3,
): ExactVector3 {
  return crossProduct(
    addVectors(point, negateVector(linePoint)),
    lineDirection,
  );
}

/** Convenience: per-component |actual − expected| for vector candidates. */
export function vectorResidualComponents(
  actual: ExactVector3,
  expected: ExactVector3,
): ExactVector3 {
  return {
    x: absRational(subtractRationals(actual.x, expected.x)),
    y: absRational(subtractRationals(actual.y, expected.y)),
    z: absRational(subtractRationals(actual.z, expected.z)),
  };
}

/**
 * Deterministic sequential-id collector for ValidationRecordV1, mirroring
 * DerivationRecorder. Ids are `<prefix>-1`, `<prefix>-2`, ... — no
 * randomness. Optional fields are only attached when provided.
 */
export interface ValidationRecordInput {
  readonly rule: string;
  readonly severity?: "info" | "warning" | "error";
  readonly passed: boolean;
  readonly message: string;
  readonly targetIds?: readonly string[];
  readonly residual?: ScalarV1;
  readonly tolerance?: string;
}

export class ValidationRecorder {
  private readonly idPrefix: string;

  private readonly collected: ValidationRecordV1[] = [];

  constructor(idPrefix = "validation") {
    if (idPrefix.length === 0) {
      throw new RangeError("ValidationRecorder idPrefix must be non-empty");
    }
    this.idPrefix = idPrefix;
  }

  record(input: ValidationRecordInput): ValidationRecordV1 {
    if (input.rule.length === 0) {
      throw new RangeError("validation rule must be non-empty");
    }
    let record: ValidationRecordV1 = {
      validationId: `${this.idPrefix}-${this.collected.length + 1}`,
      rule: input.rule,
      severity: input.severity ?? (input.passed ? "info" : "error"),
      passed: input.passed,
      message: input.message,
      targetIds: [...(input.targetIds ?? [])],
    };
    if (input.residual !== undefined) {
      record = { ...record, residual: input.residual };
    }
    if (input.tolerance !== undefined) {
      record = { ...record, tolerance: input.tolerance };
    }
    this.collected.push(record);
    return record;
  }

  get size(): number {
    return this.collected.length;
  }

  get records(): readonly ValidationRecordV1[] {
    return [...this.collected];
  }
}
