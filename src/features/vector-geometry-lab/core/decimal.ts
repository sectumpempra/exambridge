import { scalarToDecimal } from "@/features/vector-geometry-lab/schema";

import { bigintAbs, integerSqrtFloor } from "./bigint-utils.js";
import type { ExactRadical } from "./radical.js";
import type { ExactRational } from "./rational.js";
import { scalarFromRational } from "./rational.js";

/**
 * Unified decimal approximation — the ONLY rounding entry point in the core
 * package (spec §3: no silent, scattered rounding).
 *
 * Rounding rule (single rule everywhere, identical to the schema package's
 * scalarToDecimal): ROUND HALF AWAY FROM ZERO on the discarded fraction.
 *   0.125 → "0.13" at 2 digits; -0.125 → "-0.13"; 2.5 → "3" at 0 digits.
 *
 * - ExactRational delegates to the schema's scalarToDecimal, so rational
 *   rounding exists in exactly one implementation across the monorepo.
 * - ExactRadical with radicand 1 is rational and takes the same path.
 * - Irrational radicals are approximated with bigint guard digits: √r is
 *   underestimated by integerSqrtFloor(r·10^(2G)) with G chosen so the
 *   truncation error is < 10^-10 of one unit in the last requested digit.
 *   A tie exactly on a .5 boundary is impossible for irrationals (a decimal
 *   tie would be rational), so the guard makes the rounding decision exact.
 */

export const DECIMAL_ROUNDING_RULE = "round-half-away-from-zero" as const;

export const MAX_DECIMAL_DIGITS = 100;

export const DEFAULT_DECIMAL_DIGITS = 6;

function assertValidDigits(digits: number): void {
  if (!Number.isInteger(digits) || digits < 0 || digits > MAX_DECIMAL_DIGITS) {
    throw new RangeError(
      `digits must be an integer between 0 and ${MAX_DECIMAL_DIGITS}`,
    );
  }
}

function formatScaledInteger(
  scaledMagnitude: bigint,
  digits: number,
  negative: boolean,
): string {
  if (digits === 0) {
    return `${negative ? "-" : ""}${scaledMagnitude.toString()}`;
  }
  const scale = 10n ** BigInt(digits);
  const integerPart = scaledMagnitude / scale;
  const fractionPart = (scaledMagnitude % scale)
    .toString()
    .padStart(digits, "0");
  return `${negative ? "-" : ""}${integerPart.toString()}.${fractionPart}`;
}

function radicalToDecimal(value: ExactRadical, digits: number): string {
  const coefficient = value.coefficient;
  // Decimal magnitude of |c| (number of integer digits, clamped ≥ 0), so the
  // guard scale covers both the integer part and the requested fraction.
  const magnitudeDigits = Math.max(
    0,
    bigintAbs(coefficient.numerator).toString().length -
      coefficient.denominator.toString().length +
      1,
  );
  const guardDigits = digits + magnitudeDigits + 12;
  const guardScale = 10n ** BigInt(guardDigits);
  // s = floor(√r · 10^G) underestimates √r·10^G by less than 1.
  const s = integerSqrtFloor(value.radicand * guardScale * guardScale);
  const digitScale = 10n ** BigInt(digits);
  const dividend = bigintAbs(coefficient.numerator) * s * digitScale;
  const divisor = coefficient.denominator * guardScale;
  let scaled = dividend / divisor;
  const remainder = dividend % divisor;
  if (remainder * 2n >= divisor) {
    scaled += 1n;
  }
  return formatScaledInteger(scaled, digits, coefficient.numerator < 0n);
}

/**
 * Renders an exact value with `digits` fractional places (default 6),
 * rounded half away from zero. Rendering only — the stored exact value is
 * never mutated.
 */
export function toDecimal(
  value: ExactRational | ExactRadical,
  digits: number = DEFAULT_DECIMAL_DIGITS,
): string {
  assertValidDigits(digits);
  if ("radicand" in value) {
    if (value.radicand === 1n) {
      return scalarToDecimal(scalarFromRational(value.coefficient), digits);
    }
    return radicalToDecimal(value, digits);
  }
  return scalarToDecimal(scalarFromRational(value), digits);
}
