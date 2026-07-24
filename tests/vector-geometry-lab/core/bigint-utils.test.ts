import { describe, expect, it } from "vitest";

import {
  bigintAbs,
  bigintGcd,
  bigintGcdAll,
  bigintLcm,
  bigintLcmAll,
  bigintMax,
  bigintMin,
  integerSqrtFloor,
  perfectSquareRoot,
} from "@/features/vector-geometry-lab/core";

describe("bigint primitives", () => {
  it("abs / gcd / lcm", () => {
    expect(bigintAbs(-7n)).toBe(7n);
    expect(bigintAbs(7n)).toBe(7n);
    expect(bigintGcd(12n, 18n)).toBe(6n);
    expect(bigintGcd(-12n, 18n)).toBe(6n);
    expect(bigintGcd(0n, 5n)).toBe(5n);
    expect(bigintLcm(4n, 6n)).toBe(12n);
    expect(bigintLcm(0n, 6n)).toBe(0n);
    expect(bigintLcm(-4n, 6n)).toBe(12n);
  });

  it("gcd/lcm of lists", () => {
    expect(bigintGcdAll([12n, 18n, 30n])).toBe(6n);
    expect(bigintGcdAll([])).toBe(0n);
    expect(bigintGcdAll([0n, 0n, 7n])).toBe(7n);
    expect(bigintLcmAll([2n, 3n, 4n])).toBe(12n);
    expect(bigintLcmAll([])).toBe(1n);
  });

  it("min / max", () => {
    expect(bigintMin(3n, 5n)).toBe(3n);
    expect(bigintMin(5n, 3n)).toBe(3n);
    expect(bigintMax(3n, 5n)).toBe(5n);
    expect(bigintMax(5n, 3n)).toBe(5n);
  });
});

describe("integerSqrtFloor", () => {
  it("floors the root", () => {
    expect(integerSqrtFloor(0n)).toBe(0n);
    expect(integerSqrtFloor(1n)).toBe(1n);
    expect(integerSqrtFloor(2n)).toBe(1n);
    expect(integerSqrtFloor(15n)).toBe(3n);
    expect(integerSqrtFloor(16n)).toBe(4n);
    expect(integerSqrtFloor(17n)).toBe(4n);
  });

  it("handles very large inputs via the bit-length seed", () => {
    const root = 10n ** 18n;
    expect(integerSqrtFloor(root * root)).toBe(root);
    expect(integerSqrtFloor(root * root - 1n)).toBe(root - 1n);
    expect(integerSqrtFloor(root * root + 1n)).toBe(root);
  });

  it("rejects negatives", () => {
    expect(() => integerSqrtFloor(-1n)).toThrow(RangeError);
  });
});

describe("perfectSquareRoot", () => {
  it("detects perfect squares", () => {
    expect(perfectSquareRoot(144n)).toBe(12n);
    expect(perfectSquareRoot(0n)).toBe(0n);
    expect(perfectSquareRoot(2n)).toBeUndefined();
    expect(perfectSquareRoot(-4n)).toBeUndefined();
  });
});
