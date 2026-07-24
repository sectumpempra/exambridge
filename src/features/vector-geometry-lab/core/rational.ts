import type { ScalarV1 } from "@/features/vector-geometry-lab/schema";

import { bigintAbs, bigintGcd } from "./bigint-utils.js";
import type { CoreResult } from "./errors.js";
import { coreFail, coreOk } from "./errors.js";

/**
 * ExactRational — bigint numerator/denominator with hard invariants:
 * always reduced to lowest terms, denominator strictly positive, and the
 * canonical zero 0/1 (enforced automatically: 0/d reduces to 0/1 because
 * gcd(0, d) = d). Every arithmetic operation re-normalizes, so the
 * invariants hold for ANY value produced by this module.
 *
 * Interop with ScalarV1 (the schema contract) is lossless in both
 * directions: `rationalFromScalar` consumes the string-carried integers;
 * `scalarFromRational` regenerates a canonical `input` literal and marks
 * `exact: true` by default (or propagates approximate provenance when
 * asked to).
 */

export interface ExactRational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function normalizeParts(numerator: bigint, denominator: bigint): ExactRational {
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = bigintGcd(n, d);
  return { numerator: n / divisor, denominator: d / divisor };
}

function toBigInt(value: bigint | number, argumentName: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${argumentName} must be a safe integer or bigint`);
  }
  return BigInt(value);
}

/**
 * Assertive factory (schema-package precedent: factories throw on invalid
 * construction). A zero denominator is a programmer error, not a math
 * outcome, so it raises RangeError.
 */
export function rational(
  numerator: bigint | number,
  denominator: bigint | number = 1n,
): ExactRational {
  const n = toBigInt(numerator, "numerator");
  const d = toBigInt(denominator, "denominator");
  if (d === 0n) {
    throw new RangeError("ExactRational denominator must not be zero");
  }
  return normalizeParts(n, d);
}

/** Internal unchecked variant for call sites with a provably non-zero denominator. */
function rationalUnsafe(numerator: bigint, denominator: bigint): ExactRational {
  return normalizeParts(numerator, denominator);
}

export const ZERO_RATIONAL: ExactRational = Object.freeze({
  numerator: 0n,
  denominator: 1n,
});

export const ONE_RATIONAL: ExactRational = Object.freeze({
  numerator: 1n,
  denominator: 1n,
});

export function isZeroRational(value: ExactRational): boolean {
  return value.numerator === 0n;
}

export function rationalSign(value: ExactRational): -1 | 0 | 1 {
  if (value.numerator > 0n) {
    return 1;
  }
  return value.numerator < 0n ? -1 : 0;
}

export function addRationals(a: ExactRational, b: ExactRational): ExactRational {
  return normalizeParts(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

export function negateRational(value: ExactRational): ExactRational {
  return { numerator: -value.numerator, denominator: value.denominator };
}

export function subtractRationals(
  a: ExactRational,
  b: ExactRational,
): ExactRational {
  return addRationals(a, negateRational(b));
}

export function multiplyRationals(
  a: ExactRational,
  b: ExactRational,
): ExactRational {
  return normalizeParts(
    a.numerator * b.numerator,
    a.denominator * b.denominator,
  );
}

export function divideRationals(
  a: ExactRational,
  b: ExactRational,
): CoreResult<ExactRational> {
  if (isZeroRational(b)) {
    return coreFail(
      "division-by-zero",
      "cannot divide by the zero rational",
      { divisor: "0" },
    );
  }
  return coreOk(
    normalizeParts(a.numerator * b.denominator, a.denominator * b.numerator),
  );
}

/** Division where the divisor is non-zero by construction; throws otherwise. */
export function divideRationalsUnsafe(
  a: ExactRational,
  b: ExactRational,
): ExactRational {
  if (isZeroRational(b)) {
    throw new RangeError("divideRationalsUnsafe requires a non-zero divisor");
  }
  return rationalUnsafe(a.numerator * b.denominator, a.denominator * b.numerator);
}

export function absRational(value: ExactRational): ExactRational {
  return { numerator: bigintAbs(value.numerator), denominator: value.denominator };
}

export function compareRationals(a: ExactRational, b: ExactRational): -1 | 0 | 1 {
  const left = a.numerator * b.denominator;
  const right = b.numerator * a.denominator;
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

export function rationalsEqual(a: ExactRational, b: ExactRational): boolean {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

export const MAX_RATIONAL_POWER = 100;

/**
 * Integer power for small exponents (|exponent| ≤ 100). 0^0 is defined as 1
 * (documented convention); 0 raised to a negative exponent is a structured
 * division-by-zero failure.
 */
export function powRational(
  base: ExactRational,
  exponent: number,
): CoreResult<ExactRational> {
  if (!Number.isSafeInteger(exponent)) {
    throw new RangeError("exponent must be a safe integer");
  }
  if (bigintAbs(BigInt(exponent)) > BigInt(MAX_RATIONAL_POWER)) {
    throw new RangeError(
      `exponent magnitude must not exceed ${MAX_RATIONAL_POWER}`,
    );
  }
  if (exponent === 0) {
    return coreOk(ONE_RATIONAL);
  }
  if (isZeroRational(base) && exponent < 0) {
    return coreFail(
      "division-by-zero",
      "zero cannot be raised to a negative exponent",
    );
  }
  if (exponent > 0) {
    const e = BigInt(exponent);
    return coreOk({
      numerator: base.numerator ** e,
      denominator: base.denominator ** e,
    });
  }
  const e = BigInt(-exponent);
  return coreOk(
    normalizeParts(base.denominator ** e, base.numerator ** e),
  );
}

/** Float view for tolerance comparisons only — never for exact decisions. */
export function rationalToNumber(value: ExactRational): number {
  return Number(value.numerator) / Number(value.denominator);
}

/* --------------------------------------------------------------------------
 * ScalarV1 interop
 * ------------------------------------------------------------------------ */

/** Lossless ScalarV1 → ExactRational. The schema guarantees normalized parts. */
export function rationalFromScalar(scalar: ScalarV1): ExactRational {
  return {
    numerator: BigInt(scalar.numerator),
    denominator: BigInt(scalar.denominator),
  };
}

export interface ScalarFromRationalOptions {
  /**
   * Exactness flag of the produced scalar. Defaults to true (canonical
   * exact output). Pass false to propagate approximate provenance — e.g. a
   * result computed from exact:false inputs.
   */
  readonly exact?: boolean;
  /**
   * Original literal to preserve in `input`. Defaults to the canonical
   * regenerated literal ("-3" or "5/4"). When provided it must be non-empty.
   */
  readonly input?: string;
}

/**
 * ExactRational → ScalarV1. Regenerates a canonical `input` literal
 * ("n" for integers, "n/d" otherwise) and marks exact:true by default.
 * The produced value always satisfies scalarV1Schema (reduced, positive
 * denominator, integer kind ⟺ denominator "1").
 */
export function scalarFromRational(
  value: ExactRational,
  options?: ScalarFromRationalOptions,
): ScalarV1 {
  const isInteger = value.denominator === 1n;
  const canonical = isInteger
    ? value.numerator.toString()
    : `${value.numerator.toString()}/${value.denominator.toString()}`;
  const input = options?.input ?? canonical;
  if (input.length === 0) {
    throw new RangeError("ScalarV1 input literal must be non-empty");
  }
  return {
    input,
    kind: isInteger ? "integer" : "fraction",
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    exact: options?.exact ?? true,
  };
}

/** Canonical human-readable rendering: "3" for integers, "-5/4" otherwise. */
export function formatRational(value: ExactRational): string {
  if (value.denominator === 1n) {
    return value.numerator.toString();
  }
  return `${value.numerator.toString()}/${value.denominator.toString()}`;
}
