import { parseScalar } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  absRational,
  addRationals,
  compareRationals,
  divideRationals,
  divideRationalsUnsafe,
  formatRational,
  isZeroRational,
  MAX_RATIONAL_POWER,
  multiplyRationals,
  negateRational,
  ONE_RATIONAL,
  powRational,
  rational,
  rationalFromScalar,
  rationalsEqual,
  rationalSign,
  rationalToNumber,
  scalarFromRational,
  subtractRationals,
  unwrapCoreResult,
  ZERO_RATIONAL,
} from "@/features/vector-geometry-lab/core";
import { approx, sc } from "./helpers.js";

describe("ExactRational normalization", () => {
  it("reduces to lowest terms", () => {
    expect(rational(2, 4)).toEqual({ numerator: 1n, denominator: 2n });
    expect(rational(14, 21)).toEqual({ numerator: 2n, denominator: 3n });
  });

  it("forces the denominator positive", () => {
    expect(rational(3, -4)).toEqual({ numerator: -3n, denominator: 4n });
    expect(rational(-3, -4)).toEqual({ numerator: 3n, denominator: 4n });
  });

  it("canonicalizes zero to 0/1", () => {
    expect(rational(0, 7)).toEqual({ numerator: 0n, denominator: 1n });
    expect(rational(0, -13)).toEqual(ZERO_RATIONAL);
  });

  it("accepts bigint input", () => {
    expect(rational(10n ** 30n, 3n)).toEqual({
      numerator: 10n ** 30n,
      denominator: 3n,
    });
  });

  it("rejects a zero denominator", () => {
    expect(() => rational(1, 0)).toThrow(RangeError);
  });

  it("rejects non-safe-integer number input", () => {
    expect(() => rational(1.5)).toThrow(RangeError);
    expect(() => rational(Number.NaN)).toThrow(RangeError);
    expect(() => rational(2 ** 60)).toThrow(RangeError);
  });
});

describe("ExactRational arithmetic", () => {
  it("adds and subtracts", () => {
    expect(addRationals(rational(1, 2), rational(1, 3))).toEqual(rational(5, 6));
    expect(subtractRationals(rational(1, 2), rational(1, 3))).toEqual(rational(1, 6));
    expect(subtractRationals(rational(1, 3), rational(1, 2))).toEqual(rational(-1, 6));
  });

  it("multiplies and divides", () => {
    expect(multiplyRationals(rational(2, 3), rational(9, 4))).toEqual(rational(3, 2));
    expect(unwrapCoreResult(divideRationals(rational(2, 3), rational(4, 9)))).toEqual(
      rational(3, 2),
    );
  });

  it("refuses division by zero structurally", () => {
    const result = divideRationals(rational(1), ZERO_RATIONAL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("division-by-zero");
    }
  });

  it("divideRationalsUnsafe throws on a zero divisor", () => {
    expect(() => divideRationalsUnsafe(rational(1), ZERO_RATIONAL)).toThrow(RangeError);
    expect(divideRationalsUnsafe(rational(3, 4), rational(-2, 5))).toEqual(rational(-15, 8));
  });

  it("unwrapCoreResult throws on failure", () => {
    expect(() =>
      unwrapCoreResult(divideRationals(rational(1), ZERO_RATIONAL)),
    ).toThrow(RangeError);
  });

  it("negates and takes absolute values", () => {
    expect(negateRational(rational(3, 4))).toEqual(rational(-3, 4));
    expect(absRational(rational(-3, 4))).toEqual(rational(3, 4));
    expect(absRational(rational(3, 4))).toEqual(rational(3, 4));
  });

  it("compares and reports sign", () => {
    expect(compareRationals(rational(1, 3), rational(1, 2))).toBe(-1);
    expect(compareRationals(rational(1, 2), rational(1, 3))).toBe(1);
    expect(compareRationals(rational(2, 4), rational(1, 2))).toBe(0);
    expect(rationalsEqual(rational(2, 4), rational(1, 2))).toBe(true);
    expect(rationalsEqual(rational(1, 3), rational(1, 2))).toBe(false);
    expect(rationalSign(rational(-7, 2))).toBe(-1);
    expect(rationalSign(ZERO_RATIONAL)).toBe(0);
    expect(rationalSign(rational(7, 2))).toBe(1);
    expect(isZeroRational(ZERO_RATIONAL)).toBe(true);
    expect(isZeroRational(rational(1))).toBe(false);
  });

  it("computes small integer powers", () => {
    expect(unwrapCoreResult(powRational(rational(2), 10))).toEqual(rational(1024));
    expect(unwrapCoreResult(powRational(rational(2, 3), 3))).toEqual(rational(8, 27));
    expect(unwrapCoreResult(powRational(rational(2, 3), -2))).toEqual(rational(9, 4));
    expect(unwrapCoreResult(powRational(rational(-2), 3))).toEqual(rational(-8));
  });

  it("defines 0^0 = 1 and x^0 = 1", () => {
    expect(unwrapCoreResult(powRational(ZERO_RATIONAL, 0))).toEqual(ONE_RATIONAL);
    expect(unwrapCoreResult(powRational(rational(99, 7), 0))).toEqual(ONE_RATIONAL);
  });

  it("refuses 0 to a negative exponent structurally", () => {
    const result = powRational(ZERO_RATIONAL, -1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("division-by-zero");
    }
  });

  it("bounds the exponent", () => {
    expect(() => powRational(rational(2), 1.5)).toThrow(RangeError);
    expect(() => powRational(rational(2), MAX_RATIONAL_POWER + 1)).toThrow(RangeError);
    expect(() => powRational(rational(2), -MAX_RATIONAL_POWER - 1)).toThrow(RangeError);
  });

  it("converts to number", () => {
    expect(rationalToNumber(rational(1, 4))).toBe(0.25);
    expect(rationalToNumber(rational(-3, 2))).toBe(-1.5);
  });
});

describe("ExactRational bigint-scale arithmetic (30 digits)", () => {
  const big = 10n ** 30n;

  it("multiplies 30-digit operands exactly", () => {
    const result = multiplyRationals(rational(big, 3n), rational(big + 1n, 7n));
    expect(result).toEqual(rational(big * (big + 1n), 21n));
  });

  it("adds 30-digit operands exactly", () => {
    const result = addRationals(rational(big, 1n), rational(1n, big));
    expect(result).toEqual(rational(big * big + 1n, big));
  });

  it("keeps cross-multiplication order on 30-digit comparisons", () => {
    const a = rational(big * big + 1n, big);
    const b = rational(big, 1n);
    expect(compareRationals(a, b)).toBe(1);
  });
});

describe("ScalarV1 interop", () => {
  it("round-trips exact scalars losslessly", () => {
    const scalar = sc("14/21");
    const value = rationalFromScalar(scalar);
    expect(value).toEqual({ numerator: 2n, denominator: 3n });
    const back = scalarFromRational(value);
    expect(back).toEqual({
      input: "2/3",
      kind: "fraction",
      numerator: "2",
      denominator: "3",
      exact: true,
    });
    expect(parseScalar(back).ok).toBe(true);
  });

  it("regenerates canonical integer literals", () => {
    const back = scalarFromRational(rational(-7));
    expect(back).toEqual({
      input: "-7",
      kind: "integer",
      numerator: "-7",
      denominator: "1",
      exact: true,
    });
    expect(parseScalar(back).ok).toBe(true);
  });

  it("round-trips through literal parse → rational → scalar deterministically", () => {
    const first = scalarFromRational(rationalFromScalar(sc("3.25")));
    const second = scalarFromRational(rationalFromScalar(sc("3.25")));
    expect(first).toEqual(second);
    expect(first).toEqual({
      input: "13/4",
      kind: "fraction",
      numerator: "13",
      denominator: "4",
      exact: true,
    });
  });

  it("propagates approximate provenance on request", () => {
    const original = approx("sqrt(2)", "1.414214");
    const value = rationalFromScalar(original);
    const back = scalarFromRational(value, { exact: false, input: original.input });
    expect(back.exact).toBe(false);
    expect(back.input).toBe("sqrt(2)");
    expect(parseScalar(back).ok).toBe(true);
  });

  it("rejects an empty custom input literal", () => {
    expect(() => scalarFromRational(rational(1), { input: "" })).toThrow(RangeError);
  });

  it("formats canonically", () => {
    expect(formatRational(rational(3))).toBe("3");
    expect(formatRational(rational(-5, 4))).toBe("-5/4");
    expect(formatRational(ZERO_RATIONAL)).toBe("0");
  });
});
