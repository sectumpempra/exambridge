import { describe, expect, it } from "vitest";
import {
  approximateScalar,
  isZeroScalar,
  ONE_SCALAR_V1,
  parseScalar,
  scalarEquals,
  scalarFromLiteral,
  scalarToDecimal,
  scalarV1Schema,
  ZERO_SCALAR_V1,
} from "@/features/vector-geometry-lab/schema";
import type { ScalarV1 } from "@/features/vector-geometry-lab/schema";

function expectScalar(
  result: ReturnType<typeof scalarFromLiteral>,
  expected: { numerator: string; denominator: string; kind: string },
): ScalarV1 {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error("expected parse success");
  }
  expect(result.value.numerator).toBe(expected.numerator);
  expect(result.value.denominator).toBe(expected.denominator);
  expect(result.value.kind).toBe(expected.kind);
  expect(result.value.exact).toBe(true);
  return result.value;
}

describe("scalarFromLiteral — accepted literals", () => {
  it("parses positive integers and keeps the original literal", () => {
    const scalar = expectScalar(scalarFromLiteral("42"), {
      numerator: "42",
      denominator: "1",
      kind: "integer",
    });
    expect(scalar.input).toBe("42");
  });

  it("parses negative integers", () => {
    expectScalar(scalarFromLiteral("-3"), {
      numerator: "-3",
      denominator: "1",
      kind: "integer",
    });
  });

  it("parses explicit-plus integers", () => {
    expectScalar(scalarFromLiteral("+7"), {
      numerator: "7",
      denominator: "1",
      kind: "integer",
    });
  });

  it("keeps 0 as a first-class value, never as missing", () => {
    const scalar = expectScalar(scalarFromLiteral("0"), {
      numerator: "0",
      denominator: "1",
      kind: "integer",
    });
    expect(isZeroScalar(scalar)).toBe(true);
    expect(scalar.exact).toBe(true);
  });

  it("normalizes leading zeros", () => {
    expectScalar(scalarFromLiteral("007"), {
      numerator: "7",
      denominator: "1",
      kind: "integer",
    });
  });

  it("trims surrounding whitespace", () => {
    const scalar = expectScalar(scalarFromLiteral("  -5  "), {
      numerator: "-5",
      denominator: "1",
      kind: "integer",
    });
    expect(scalar.input).toBe("-5");
  });

  it("parses decimals into exact fractions", () => {
    expectScalar(scalarFromLiteral("1.25"), {
      numerator: "5",
      denominator: "4",
      kind: "decimal",
    });
  });

  it("parses negative decimals", () => {
    expectScalar(scalarFromLiteral("-0.5"), {
      numerator: "-1",
      denominator: "2",
      kind: "decimal",
    });
  });

  it("parses shorthand decimals like .5", () => {
    expectScalar(scalarFromLiteral(".5"), {
      numerator: "1",
      denominator: "2",
      kind: "decimal",
    });
  });

  it("parses trailing-dot decimals like 2.", () => {
    expectScalar(scalarFromLiteral("2."), {
      numerator: "2",
      denominator: "1",
      kind: "decimal",
    });
  });

  it("keeps kind=decimal even when the value normalizes to an integer", () => {
    expectScalar(scalarFromLiteral("1.0"), {
      numerator: "1",
      denominator: "1",
      kind: "decimal",
    });
  });

  it("parses fractions", () => {
    expectScalar(scalarFromLiteral("5/4"), {
      numerator: "5",
      denominator: "4",
      kind: "fraction",
    });
  });

  it("accepts whitespace around the fraction slash", () => {
    expectScalar(scalarFromLiteral("3 / 4"), {
      numerator: "3",
      denominator: "4",
      kind: "fraction",
    });
  });

  it("parses huge integers beyond double precision exactly", () => {
    expectScalar(scalarFromLiteral("123456789012345678901234567890"), {
      numerator: "123456789012345678901234567890",
      denominator: "1",
      kind: "integer",
    });
  });

  it("parses tiny coordinates exactly", () => {
    expectScalar(scalarFromLiteral("0.0000000001"), {
      numerator: "1",
      denominator: "10000000000",
      kind: "decimal",
    });
  });
});

describe("scalarFromLiteral — fraction normalization", () => {
  it("reduces to lowest terms", () => {
    expectScalar(scalarFromLiteral("4/2"), {
      numerator: "2",
      denominator: "1",
      kind: "fraction",
    });
  });

  it("reduces common factors", () => {
    expectScalar(scalarFromLiteral("12/18"), {
      numerator: "2",
      denominator: "3",
      kind: "fraction",
    });
  });

  it("moves a negative denominator sign to the numerator", () => {
    expectScalar(scalarFromLiteral("3/-4"), {
      numerator: "-3",
      denominator: "4",
      kind: "fraction",
    });
  });

  it("normalizes a doubly negative fraction to positive", () => {
    expectScalar(scalarFromLiteral("-2/-4"), {
      numerator: "1",
      denominator: "2",
      kind: "fraction",
    });
  });

  it("normalizes a zero numerator to 0/1", () => {
    expectScalar(scalarFromLiteral("0/5"), {
      numerator: "0",
      denominator: "1",
      kind: "fraction",
    });
  });
});

describe("scalarFromLiteral — rejections", () => {
  function expectInvalid(result: ReturnType<typeof scalarFromLiteral>): void {
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected parse failure");
    }
    expect(result.error.code).toBe("invalid-input");
    expect(result.error.issues.length).toBeGreaterThan(0);
    expect(result.error.issues[0]?.code).toBe("invalid-scalar-literal");
  }

  it("rejects a zero denominator", () => {
    expectInvalid(scalarFromLiteral("1/0"));
  });

  it("rejects alphabetic garbage", () => {
    expectInvalid(scalarFromLiteral("abc"));
  });

  it("rejects empty input", () => {
    expectInvalid(scalarFromLiteral(""));
  });

  it("rejects whitespace-only input", () => {
    expectInvalid(scalarFromLiteral("   "));
  });

  it("rejects malformed decimals", () => {
    expectInvalid(scalarFromLiteral("1.2.3"));
  });

  it("rejects chained fractions", () => {
    expectInvalid(scalarFromLiteral("1/2/3"));
  });

  it("rejects a bare dot", () => {
    expectInvalid(scalarFromLiteral("."));
  });

  it("rejects irrational literals and points to approximateScalar", () => {
    expectInvalid(scalarFromLiteral("sqrt(2)"));
    const result = scalarFromLiteral("sqrt(2)");
    if (result.ok) {
      throw new Error("expected parse failure");
    }
    expect(result.error.message).toContain("approximateScalar");
  });

  it("rejects non-string input without throwing", () => {
    expectInvalid(scalarFromLiteral(5 as unknown as string));
  });
});

describe("scalarV1Schema — handcrafted payload validation", () => {
  const base: ScalarV1 = {
    input: "1/2",
    kind: "fraction",
    numerator: "1",
    denominator: "2",
    exact: true,
  };

  it("accepts a valid scalar", () => {
    expect(scalarV1Schema.safeParse(base).success).toBe(true);
  });

  it("rejects a non-reduced fraction", () => {
    const result = parseScalar({ ...base, numerator: "2", denominator: "4" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid-input");
  });

  it("rejects a zero denominator", () => {
    expect(parseScalar({ ...base, denominator: "0" }).ok).toBe(false);
  });

  it("rejects a negative denominator", () => {
    expect(parseScalar({ ...base, denominator: "-2" }).ok).toBe(false);
  });

  it("rejects non-canonical numerator strings", () => {
    expect(parseScalar({ ...base, numerator: "01" }).ok).toBe(false);
  });

  it("rejects integer kind with a non-unit denominator", () => {
    expect(
      parseScalar({ ...base, kind: "integer", numerator: "3", denominator: "2" })
        .ok,
    ).toBe(false);
  });

  it("rejects an empty input literal", () => {
    expect(parseScalar({ ...base, input: "" }).ok).toBe(false);
  });

  it("rejects a missing exact flag", () => {
    const { exact: _exact, ...rest } = base;
    expect(parseScalar(rest).ok).toBe(false);
  });
});

describe("approximateScalar — explicit inexact carriers", () => {
  it("carries an irrational literal as an exact:false decimal", () => {
    const result = approximateScalar("sqrt(2)", "1.4142135624");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.input).toBe("sqrt(2)");
    expect(result.value.exact).toBe(false);
    expect(result.value.kind).toBe("decimal");
    expect(result.value.numerator).toBe("1767766953");
    expect(result.value.denominator).toBe("1250000000");
  });

  it("accepts integer approximations", () => {
    const result = approximateScalar("pi", "3");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.exact).toBe(false);
    expect(result.value.kind).toBe("integer");
    expect(result.value.denominator).toBe("1");
  });

  it("rejects empty original input", () => {
    expect(approximateScalar("", "1.5").ok).toBe(false);
  });

  it("rejects non-decimal approximations", () => {
    expect(approximateScalar("sqrt(2)", "sqrt(2)").ok).toBe(false);
  });

  it("never silently marks an approximation as exact", () => {
    const result = approximateScalar("x", "2.0");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.exact).toBe(false);
  });
});

describe("scalar helpers", () => {
  it("scalarEquals compares normalized parts", () => {
    const half = scalarFromLiteral("1/2");
    const otherHalf = scalarFromLiteral("0.5");
    const third = scalarFromLiteral("1/3");
    if (!half.ok || !otherHalf.ok || !third.ok) {
      throw new Error("expected success");
    }
    expect(scalarEquals(half.value, otherHalf.value)).toBe(true);
    expect(scalarEquals(half.value, third.value)).toBe(false);
  });

  it("isZeroScalar only matches a zero numerator", () => {
    expect(isZeroScalar(ZERO_SCALAR_V1)).toBe(true);
    expect(isZeroScalar(ONE_SCALAR_V1)).toBe(false);
  });

  it("scalarToDecimal renders fixed digits", () => {
    expect(scalarToDecimal(ONE_SCALAR_V1, 4)).toBe("1.0000");
  });

  it("scalarToDecimal truncates-and-rounds thirds", () => {
    const third = scalarFromLiteral("1/3");
    if (!third.ok) throw new Error("expected success");
    expect(scalarToDecimal(third.value, 4)).toBe("0.3333");
  });

  it("scalarToDecimal rounds half away from zero", () => {
    const sixth = scalarFromLiteral("1/6");
    if (!sixth.ok) throw new Error("expected success");
    expect(scalarToDecimal(sixth.value, 2)).toBe("0.17");
  });

  it("scalarToDecimal handles negatives", () => {
    const value = scalarFromLiteral("-1/6");
    if (!value.ok) throw new Error("expected success");
    expect(scalarToDecimal(value.value, 2)).toBe("-0.17");
  });

  it("scalarToDecimal supports zero digits", () => {
    const value = scalarFromLiteral("5/2");
    if (!value.ok) throw new Error("expected success");
    expect(scalarToDecimal(value.value, 0)).toBe("3");
  });

  it("scalarToDecimal rejects invalid digit counts", () => {
    expect(() => scalarToDecimal(ONE_SCALAR_V1, -1)).toThrow(RangeError);
    expect(() => scalarToDecimal(ONE_SCALAR_V1, 1.5)).toThrow(RangeError);
    expect(() => scalarToDecimal(ONE_SCALAR_V1, 101)).toThrow(RangeError);
  });
});

describe("round-trip serialization", () => {
  it("survives JSON round-trip unchanged", () => {
    const original = scalarFromLiteral("-3/4");
    if (!original.ok) throw new Error("expected success");
    const revived: unknown = JSON.parse(JSON.stringify(original.value));
    const reparsed = parseScalar(revived);
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) throw new Error("expected success");
    expect(reparsed.value).toEqual(original.value);
    expect(scalarEquals(reparsed.value, original.value)).toBe(true);
  });
});
