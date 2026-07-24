import { describe, expect, it } from "vitest";

import {
  absRadical,
  compareRadicals,
  divideRationalByRadical,
  formatRadical,
  isRationalRadical,
  isZeroRadical,
  makeRadical,
  negateRadical,
  radicalAsRational,
  radicalFromRational,
  radicalFromRationalSquare,
  radicalSign,
  radicalsEqual,
  radicalToNumber,
  rational,
  squareRadical,
  unwrapCoreResult,
  ZERO_RADICAL,
} from "@/features/vector-geometry-lab/core";

describe("radicalFromRationalSquare", () => {
  it("simplifies √72 to 6√2", () => {
    const value = unwrapCoreResult(radicalFromRationalSquare(rational(72)));
    expect(value.coefficient).toEqual(rational(6));
    expect(value.radicand).toBe(2n);
    expect(formatRadical(value)).toBe("6√2");
  });

  it("simplifies √1 to the rational 1", () => {
    const value = unwrapCoreResult(radicalFromRationalSquare(rational(1)));
    expect(value).toEqual({ coefficient: rational(1), radicand: 1n });
    expect(isRationalRadical(value)).toBe(true);
  });

  it("simplifies √0 to the canonical zero radical", () => {
    expect(unwrapCoreResult(radicalFromRationalSquare(rational(0)))).toEqual(
      ZERO_RADICAL,
    );
  });

  it("simplifies √(9/4) to the rational 3/2", () => {
    const value = unwrapCoreResult(radicalFromRationalSquare(rational(9, 4)));
    expect(value).toEqual({ coefficient: rational(3, 2), radicand: 1n });
  });

  it("simplifies √(72/25) to (6/5)√2", () => {
    const value = unwrapCoreResult(radicalFromRationalSquare(rational(72, 25)));
    expect(value.coefficient).toEqual(rational(6, 5));
    expect(value.radicand).toBe(2n);
  });

  it("keeps square-free radicands intact (√2, √14)", () => {
    expect(unwrapCoreResult(radicalFromRationalSquare(rational(2)))).toEqual({
      coefficient: rational(1),
      radicand: 2n,
    });
    expect(unwrapCoreResult(radicalFromRationalSquare(rational(14)))).toEqual({
      coefficient: rational(1),
      radicand: 14n,
    });
  });

  it("extracts multi-prime square factors (294 = 2·3·7² → 7√6)", () => {
    const value = unwrapCoreResult(radicalFromRationalSquare(rational(294)));
    expect(value.coefficient).toEqual(rational(7));
    expect(value.radicand).toBe(6n);
  });

  it("extracts repeated square factors (2×10^12 → 10^6·√2)", () => {
    const value = unwrapCoreResult(
      radicalFromRationalSquare(rational(2n * 10n ** 12n)),
    );
    expect(value.coefficient).toEqual(rational(10n ** 6n));
    expect(value.radicand).toBe(2n);
  });

  it("handles a 30-digit perfect square exactly", () => {
    const root = 10n ** 15n;
    const value = unwrapCoreResult(
      radicalFromRationalSquare(rational(root * root)),
    );
    expect(value).toEqual({ coefficient: rational(root), radicand: 1n });
  });

  it("refuses negative input structurally", () => {
    const result = radicalFromRationalSquare(rational(-4));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("negative-radicand");
    }
  });

  it("fails structurally past the trial-division safety valve", () => {
    // 999983 is prime; with only 3 trial divisions allowed the cube-root
    // pass cannot finish, so the valve must trip (never a silent result).
    const result = radicalFromRationalSquare(rational(999983), {
      maxTrialDivisions: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("radical-reduction-overflow");
    }
  });

  it("trips the valve in the second pass too", () => {
    // 65 = 5·13: pass 1 needs d=2,3,4 (3 iterations); pass 2 then starts.
    const result = radicalFromRationalSquare(rational(65), {
      maxTrialDivisions: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("radical-reduction-overflow");
    }
  });
});

describe("makeRadical", () => {
  it("normalizes square factors out of the radicand", () => {
    const value = unwrapCoreResult(makeRadical(rational(2), 12n));
    expect(value).toEqual({ coefficient: rational(4), radicand: 3n });
  });

  it("canonicalizes a zero coefficient", () => {
    expect(unwrapCoreResult(makeRadical(rational(0), 7n))).toEqual(ZERO_RADICAL);
  });

  it("refuses non-positive radicands", () => {
    expect(makeRadical(rational(1), 0n).ok).toBe(false);
    const negative = makeRadical(rational(1), -5n);
    expect(negative.ok).toBe(false);
    if (!negative.ok) {
      expect(negative.error.code).toBe("invalid-input");
    }
  });

  it("honors the reduction safety valve", () => {
    const result = makeRadical(rational(1), 999983n, { maxTrialDivisions: 3 });
    expect(result.ok).toBe(false);
  });
});

describe("ExactRadical predicates and views", () => {
  it("detects zero and sign", () => {
    expect(isZeroRadical(ZERO_RADICAL)).toBe(true);
    expect(isZeroRadical(radicalFromRational(rational(2)))).toBe(false);
    expect(radicalSign(radicalFromRational(rational(-2)))).toBe(-1);
    expect(radicalSign(ZERO_RADICAL)).toBe(0);
    expect(radicalSign(unwrapCoreResult(makeRadical(rational(3), 5n)))).toBe(1);
  });

  it("exposes the rational view only when radicand is 1", () => {
    expect(radicalAsRational(radicalFromRational(rational(3, 4)))).toEqual(
      rational(3, 4),
    );
    expect(
      radicalAsRational(unwrapCoreResult(radicalFromRationalSquare(rational(2)))),
    ).toBeUndefined();
  });

  it("squares back to a rational", () => {
    const sixRootTwo = unwrapCoreResult(radicalFromRationalSquare(rational(72)));
    expect(squareRadical(sixRootTwo)).toEqual(rational(72));
    expect(squareRadical(radicalFromRational(rational(-3, 4)))).toEqual(rational(9, 16));
  });

  it("negates and takes absolute values", () => {
    const rootTwo = unwrapCoreResult(radicalFromRationalSquare(rational(2)));
    const negative = negateRadical(rootTwo);
    expect(negative.coefficient).toEqual(rational(-1));
    expect(negative.radicand).toBe(2n);
    expect(absRadical(negative)).toEqual(rootTwo);
    expect(absRadical(rootTwo)).toEqual(rootTwo);
  });

  it("approximates as a float for tolerance paths", () => {
    expect(
      radicalToNumber(unwrapCoreResult(radicalFromRationalSquare(rational(2)))),
    ).toBeCloseTo(Math.SQRT2, 12);
  });

  it("divides a rational by a radical: 1/(2√3) = (1/6)√3", () => {
    const divisor = unwrapCoreResult(makeRadical(rational(2), 3n));
    const result = divideRationalByRadical(rational(1), divisor);
    expect(result).toEqual({ coefficient: rational(1, 6), radicand: 3n });
    expect(squareRadical(result)).toEqual(rational(1, 12));
  });
});

describe("compareRadicals", () => {
  it("orders positives via squared comparison (2√3 < 3√2)", () => {
    const twoRootThree = unwrapCoreResult(makeRadical(rational(2), 3n));
    const threeRootTwo = unwrapCoreResult(makeRadical(rational(3), 2n));
    expect(compareRadicals(twoRootThree, threeRootTwo)).toBe(-1);
    expect(compareRadicals(threeRootTwo, twoRootThree)).toBe(1);
  });

  it("treats different constructions of the same value as equal (√12 = 2√3)", () => {
    const rootTwelve = unwrapCoreResult(radicalFromRationalSquare(rational(12)));
    const twoRootThree = unwrapCoreResult(makeRadical(rational(2), 3n));
    expect(compareRadicals(rootTwelve, twoRootThree)).toBe(0);
    expect(radicalsEqual(rootTwelve, twoRootThree)).toBe(true);
  });

  it("reverses squared order for negatives (−2√3 > −3√2)", () => {
    const a = unwrapCoreResult(makeRadical(rational(-2), 3n));
    const b = unwrapCoreResult(makeRadical(rational(-3), 2n));
    expect(compareRadicals(a, b)).toBe(1);
  });

  it("orders by sign across zero", () => {
    const negative = unwrapCoreResult(makeRadical(rational(-1), 2n));
    const positive = unwrapCoreResult(makeRadical(rational(1), 2n));
    expect(compareRadicals(negative, positive)).toBe(-1);
    expect(compareRadicals(positive, negative)).toBe(1);
    expect(compareRadicals(ZERO_RADICAL, ZERO_RADICAL)).toBe(0);
    expect(compareRadicals(ZERO_RADICAL, positive)).toBe(-1);
    expect(compareRadicals(positive, ZERO_RADICAL)).toBe(1);
  });

  it("distinguishes close values (radicalsEqual)", () => {
    const rootTwo = unwrapCoreResult(radicalFromRationalSquare(rational(2)));
    const rootThree = unwrapCoreResult(radicalFromRationalSquare(rational(3)));
    expect(radicalsEqual(rootTwo, rootThree)).toBe(false);
  });
});

describe("formatRadical", () => {
  it("renders canonical display forms", () => {
    expect(formatRadical(ZERO_RADICAL)).toBe("0");
    expect(formatRadical(radicalFromRational(rational(3, 4)))).toBe("3/4");
    expect(formatRadical(radicalFromRational(rational(-7)))).toBe("-7");
    expect(formatRadical(unwrapCoreResult(makeRadical(rational(1), 2n)))).toBe("√2");
    expect(formatRadical(unwrapCoreResult(makeRadical(rational(-1), 5n)))).toBe("-√5");
    expect(formatRadical(unwrapCoreResult(makeRadical(rational(6), 2n)))).toBe("6√2");
    expect(formatRadical(unwrapCoreResult(makeRadical(rational(-3, 4), 7n)))).toBe(
      "(-3/4)√7",
    );
  });
});

describe("determinism", () => {
  it("produces deeply identical output for identical input", () => {
    const first = radicalFromRationalSquare(rational(72, 25));
    const second = radicalFromRationalSquare(rational(72, 25));
    expect(first).toEqual(second);
  });
});
