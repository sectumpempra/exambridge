import { describe, expect, it } from "vitest";

import {
  DECIMAL_ROUNDING_RULE,
  makeRadical,
  MAX_DECIMAL_DIGITS,
  radicalFromRational,
  radicalFromRationalSquare,
  rational,
  toDecimal,
  unwrapCoreResult,
} from "@/features/vector-geometry-lab/core";

describe("toDecimal — unified rounding entry point", () => {
  it("documents the single rounding rule", () => {
    expect(DECIMAL_ROUNDING_RULE).toBe("round-half-away-from-zero");
  });

  it("renders rationals with 6 digits by default", () => {
    expect(toDecimal(rational(1, 3))).toBe("0.333333");
    expect(toDecimal(rational(-2, 7))).toBe("-0.285714");
    expect(toDecimal(rational(5))).toBe("5.000000");
  });

  it("rounds half away from zero on exact ties", () => {
    expect(toDecimal(rational(1, 8), 2)).toBe("0.13");
    expect(toDecimal(rational(-1, 8), 2)).toBe("-0.13");
    expect(toDecimal(rational(5, 2), 0)).toBe("3");
    expect(toDecimal(rational(-5, 2), 0)).toBe("-3");
    expect(toDecimal(rational(1, 2), 0)).toBe("1");
  });

  it("renders zero digits", () => {
    expect(toDecimal(rational(1, 3), 0)).toBe("0");
    expect(toDecimal(rational(2, 3), 0)).toBe("1");
  });

  it("supports the documented maximum digit count", () => {
    const rendered = toDecimal(rational(1, 3), MAX_DECIMAL_DIGITS);
    expect(rendered).toBe(`0.${"3".repeat(MAX_DECIMAL_DIGITS)}`);
  });

  it("rejects invalid digit counts on both dispatch paths", () => {
    expect(() => toDecimal(rational(1), -1)).toThrow(RangeError);
    expect(() => toDecimal(rational(1), MAX_DECIMAL_DIGITS + 1)).toThrow(RangeError);
    expect(() => toDecimal(rational(1), 1.5)).toThrow(RangeError);
    const rootTwo = unwrapCoreResult(radicalFromRationalSquare(rational(2)));
    expect(() => toDecimal(rootTwo, -1)).toThrow(RangeError);
    expect(() => toDecimal(rootTwo, 2.5)).toThrow(RangeError);
  });
});

describe("toDecimal — radicals", () => {
  it("renders √2 to 6 digits", () => {
    const rootTwo = unwrapCoreResult(radicalFromRationalSquare(rational(2)));
    expect(toDecimal(rootTwo)).toBe("1.414214");
    expect(toDecimal(rootTwo, 0)).toBe("1");
    expect(toDecimal(rootTwo, 10)).toBe("1.4142135624");
  });

  it("renders 6√2 to 4 digits", () => {
    const sixRootTwo = unwrapCoreResult(radicalFromRationalSquare(rational(72)));
    expect(toDecimal(sixRootTwo, 4)).toBe("8.4853");
  });

  it("renders negative radicals", () => {
    const negative = unwrapCoreResult(makeRadical(rational(-1), 2n));
    expect(toDecimal(negative)).toBe("-1.414214");
  });

  it("delegates radicand-1 radicals to the rational path (same rounding)", () => {
    const asRadical = radicalFromRational(rational(1, 8));
    expect(toDecimal(asRadical, 2)).toBe("0.13");
  });

  it("keeps guard-digit accuracy with huge coefficients", () => {
    // 10^12·√2 = 1414213562373.0950488… → rounds to …095049 at 6 digits.
    const huge = unwrapCoreResult(makeRadical(rational(10n ** 12n), 2n));
    expect(toDecimal(huge)).toBe("1414213562373.095049");
  });

  it("renders tiny fractional radicals", () => {
    const tiny = unwrapCoreResult(makeRadical(rational(1, 10n ** 6n), 2n));
    expect(toDecimal(tiny, 9)).toBe("0.000001414");
  });

  it("renders negative radicals at zero digits", () => {
    const negative = unwrapCoreResult(makeRadical(rational(-3, 2), 2n));
    // -(3/2)√2 ≈ -2.1213 → "-2" at 0 digits.
    expect(toDecimal(negative, 0)).toBe("-2");
  });

  it("is deterministic", () => {
    const rootTwo = unwrapCoreResult(radicalFromRationalSquare(rational(2)));
    expect(toDecimal(rootTwo, 12)).toBe(toDecimal(rootTwo, 12));
  });
});
