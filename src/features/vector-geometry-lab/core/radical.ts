import { perfectSquareRoot } from "./bigint-utils.js";
import type { CoreResult } from "./errors.js";
import { coreFail, coreOk } from "./errors.js";
import type { ExactRational } from "./rational.js";
import {
  compareRationals,
  divideRationalsUnsafe,
  isZeroRational,
  multiplyRationals,
  rational,
  rationalSign,
  rationalToNumber,
  rationalsEqual,
  ZERO_RATIONAL,
} from "./rational.js";

/**
 * ExactRadical — exact representation of c·√r where:
 * - `coefficient` is an ExactRational c,
 * - `radicand` r is a square-free positive integer (bigint, r ≥ 1),
 * - r = 1 degenerates to a plain rational,
 * - zero has the canonical form 0·√1.
 *
 * All constructors reduce the radicand to its square-free kernel, so any
 * value produced by this module is canonical: two radicals are equal iff
 * their coefficients and radicands match.
 *
 * Square-free reduction uses trial division up to the cube root of the
 * remaining factor (two passes: square factors, then single factors, then a
 * final perfect-square check). This is complete and exact, with worst-case
 * cost ~2·n^(1/3) trial divisions. A configurable safety valve
 * (`maxTrialDivisions`, default 5,000,000) bounds pathological inputs; the
 * default comfortably covers squared norms of coordinates up to ~10^9
 * (radicands up to ~1.6×10^19). Hitting the valve is a structured
 * "radical-reduction-overflow" failure, never a silently unreduced result.
 *
 * Note on correctness: comparison and equality do NOT rely on square-free
 * canonical form (they compare c²·r exactly), so results stay correct even
 * for adversarial inputs — the valve only guards canonical-form cost.
 */

export interface ExactRadical {
  readonly coefficient: ExactRational;
  readonly radicand: bigint;
}

export const ZERO_RADICAL: ExactRadical = Object.freeze({
  coefficient: ZERO_RATIONAL,
  radicand: 1n,
});

export const DEFAULT_MAX_TRIAL_DIVISIONS = 5_000_000;

export interface RadicalReductionOptions {
  readonly maxTrialDivisions?: number;
}

interface SquareExtraction {
  readonly outside: bigint;
  readonly radicand: bigint;
}

/**
 * Writes n = outside² · radicand with radicand square-free.
 * Pass 1 removes d² factors for d up to the cube root of the shrinking
 * remainder; pass 2 removes single prime factors in the same range; the
 * leftover is then provably either 1, square-free, or exactly one prime
 * squared (absorbed via a perfect-square check).
 */
function extractSquareFactor(
  n: bigint,
  maxTrialDivisions: number,
): CoreResult<SquareExtraction> {
  const initialRoot = perfectSquareRoot(n);
  if (initialRoot !== undefined) {
    return coreOk({ outside: initialRoot, radicand: 1n });
  }
  let remaining = n;
  let outside = 1n;
  let divisions = 0;

  let d = 2n;
  while (d * d * d <= remaining) {
    if (divisions >= maxTrialDivisions) {
      return coreFail(
        "radical-reduction-overflow",
        `square-factor extraction exceeded the safety valve of ${maxTrialDivisions} trial divisions`,
        { limit: String(maxTrialDivisions) },
      );
    }
    const dSquared = d * d;
    while (remaining % dSquared === 0n) {
      remaining /= dSquared;
      outside *= d;
    }
    d += 1n;
    divisions += 1;
  }

  let radicand = 1n;
  let d2 = 2n;
  while (d2 * d2 * d2 <= remaining) {
    if (divisions >= maxTrialDivisions) {
      return coreFail(
        "radical-reduction-overflow",
        `square-factor extraction exceeded the safety valve of ${maxTrialDivisions} trial divisions`,
        { limit: String(maxTrialDivisions) },
      );
    }
    while (remaining % d2 === 0n) {
      remaining /= d2;
      radicand *= d2;
    }
    d2 += 1n;
    divisions += 1;
  }

  const leftoverRoot = perfectSquareRoot(remaining);
  if (leftoverRoot !== undefined) {
    outside *= leftoverRoot;
  } else {
    radicand *= remaining;
  }
  return coreOk({ outside, radicand });
}

/** Constructor for an ALREADY square-free radicand (internal invariant path). */
function radicalFromSquareFree(
  coefficient: ExactRational,
  squareFreeRadicand: bigint,
): ExactRadical {
  if (isZeroRational(coefficient)) {
    return ZERO_RADICAL;
  }
  return { coefficient, radicand: squareFreeRadicand };
}

/**
 * Normalizing constructor: reduces square factors out of `radicand` into
 * the coefficient. radicand must be a positive integer.
 */
export function makeRadical(
  coefficient: ExactRational,
  radicand: bigint,
  options?: RadicalReductionOptions,
): CoreResult<ExactRadical> {
  if (radicand < 1n) {
    return coreFail(
      "invalid-input",
      "radicand must be a positive integer",
      { radicand: radicand.toString() },
    );
  }
  if (isZeroRational(coefficient)) {
    return coreOk(ZERO_RADICAL);
  }
  const extraction = extractSquareFactor(
    radicand,
    options?.maxTrialDivisions ?? DEFAULT_MAX_TRIAL_DIVISIONS,
  );
  if (!extraction.ok) {
    return extraction;
  }
  return coreOk(
    radicalFromSquareFree(
      multiplyRationals(coefficient, rational(extraction.value.outside)),
      extraction.value.radicand,
    ),
  );
}

/** c → c·√1 (the rational degenerate case). */
export function radicalFromRational(value: ExactRational): ExactRadical {
  return radicalFromSquareFree(value, 1n);
}

/**
 * √q for a rational q = n/d ≥ 0, computed exactly as √(n·d)/d.
 * A negative input is a structured "negative-radicand" failure — the core
 * never returns NaN or silently clamps.
 */
export function radicalFromRationalSquare(
  value: ExactRational,
  options?: RadicalReductionOptions,
): CoreResult<ExactRadical> {
  if (rationalSign(value) < 0) {
    return coreFail(
      "negative-radicand",
      "cannot take the real square root of a negative rational",
      { value: `${value.numerator.toString()}/${value.denominator.toString()}` },
    );
  }
  if (isZeroRational(value)) {
    return coreOk(ZERO_RADICAL);
  }
  const product = value.numerator * value.denominator;
  const extraction = extractSquareFactor(
    product,
    options?.maxTrialDivisions ?? DEFAULT_MAX_TRIAL_DIVISIONS,
  );
  if (!extraction.ok) {
    return extraction;
  }
  return coreOk(
    radicalFromSquareFree(
      rational(extraction.value.outside, value.denominator),
      extraction.value.radicand,
    ),
  );
}

export function isZeroRadical(value: ExactRadical): boolean {
  return isZeroRational(value.coefficient);
}

export function radicalSign(value: ExactRadical): -1 | 0 | 1 {
  return rationalSign(value.coefficient);
}

/** True when the value is rational (radicand 1). */
export function isRationalRadical(value: ExactRadical): boolean {
  return value.radicand === 1n;
}

/** The rational value when radicand is 1, otherwise undefined. */
export function radicalAsRational(value: ExactRadical): ExactRational | undefined {
  return value.radicand === 1n ? value.coefficient : undefined;
}

/** (c·√r)² = c²·r — always an exact rational. */
export function squareRadical(value: ExactRadical): ExactRational {
  return multiplyRationals(
    multiplyRationals(value.coefficient, value.coefficient),
    rational(value.radicand),
  );
}

export function negateRadical(value: ExactRadical): ExactRadical {
  return radicalFromSquareFree(
    rational(-value.coefficient.numerator, value.coefficient.denominator),
    value.radicand,
  );
}

export function absRadical(value: ExactRadical): ExactRadical {
  return radicalSign(value) < 0 ? negateRadical(value) : value;
}

/**
 * Exact total order via sign + squared comparison:
 * compare signs first; for equal non-zero signs compare c²·r and flip the
 * outcome when both are negative. Correct for ANY representation, canonical
 * or not.
 */
export function compareRadicals(a: ExactRadical, b: ExactRadical): -1 | 0 | 1 {
  const signA = radicalSign(a);
  const signB = radicalSign(b);
  if (signA !== signB) {
    return signA < signB ? -1 : 1;
  }
  if (signA === 0) {
    return 0;
  }
  const squaredOrder = compareRationals(squareRadical(a), squareRadical(b));
  return signA > 0 ? squaredOrder : ((-squaredOrder) as -1 | 0 | 1);
}

/** Canonical-form equality (both sides are always reduced by construction). */
export function radicalsEqual(a: ExactRadical, b: ExactRadical): boolean {
  return a.radicand === b.radicand && rationalsEqual(a.coefficient, b.coefficient);
}

/** Float view for tolerance comparisons / display hints only. */
export function radicalToNumber(value: ExactRadical): number {
  return rationalToNumber(value.coefficient) * Math.sqrt(Number(value.radicand));
}

/**
 * Scales an exact vector component-wise by 1/(c·√r): v_i/(c√r) =
 * (v_i/(c·r))·√r. Used by vector normalization; the radicand is reused
 * as-is because it is already square-free.
 */
export function divideRationalByRadical(
  value: ExactRational,
  divisor: ExactRadical,
): ExactRadical {
  const scaledDenominator = multiplyRationals(
    divisor.coefficient,
    rational(divisor.radicand),
  );
  return radicalFromSquareFree(
    divideRationalsUnsafe(value, scaledDenominator),
    divisor.radicand,
  );
}

/** Canonical display form: "0", "3/4", "√2", "-√5", "6√2", "(-3/4)√7". */
export function formatRadical(value: ExactRadical): string {
  if (isZeroRadical(value)) {
    return "0";
  }
  const c = value.coefficient;
  if (value.radicand === 1n) {
    return c.denominator === 1n
      ? c.numerator.toString()
      : `${c.numerator.toString()}/${c.denominator.toString()}`;
  }
  const root = `√${value.radicand.toString()}`;
  if (c.denominator === 1n) {
    if (c.numerator === 1n) {
      return root;
    }
    if (c.numerator === -1n) {
      return `-${root}`;
    }
    return `${c.numerator.toString()}${root}`;
  }
  return `(${c.numerator.toString()}/${c.denominator.toString()})${root}`;
}
