import { describe, expect, it } from "vitest";

import {
  compareScalars,
  compareScalarVectors,
  DEFAULT_TOLERANCE,
  formatTolerance,
  numbersWithinTolerance,
  orderScalars,
  resolveTolerance,
} from "@/features/vector-geometry-lab/core";
import { approx, sc, vec } from "./helpers.js";

describe("DEFAULT_TOLERANCE — single source of truth", () => {
  it("pins the project-wide values", () => {
    expect(DEFAULT_TOLERANCE).toEqual({ absolute: 1e-9, relative: 1e-9 });
  });

  it("is frozen", () => {
    expect(Object.isFrozen(DEFAULT_TOLERANCE)).toBe(true);
  });
});

describe("resolveTolerance", () => {
  it("returns the defaults without overrides", () => {
    expect(resolveTolerance()).toEqual(DEFAULT_TOLERANCE);
  });

  it("merges partial overrides", () => {
    expect(resolveTolerance({ absolute: 0.5 })).toEqual({
      absolute: 0.5,
      relative: 1e-9,
    });
    expect(resolveTolerance({ relative: 0.25 })).toEqual({
      absolute: 1e-9,
      relative: 0.25,
    });
  });

  it("rejects invalid tolerances", () => {
    expect(() => resolveTolerance({ absolute: -1 })).toThrow(RangeError);
    expect(() => resolveTolerance({ relative: Number.NaN })).toThrow(RangeError);
    expect(() => resolveTolerance({ absolute: Number.POSITIVE_INFINITY })).toThrow(
      RangeError,
    );
    expect(() =>
      resolveTolerance({ absolute: "1e-9" as unknown as number }),
    ).toThrow(RangeError);
  });
});

describe("compareScalars — dual path", () => {
  it("compares exactly when both sides are exact", () => {
    const result = compareScalars(sc("2"), sc("4/2"));
    expect(result).toEqual({ value: true, exact: true });
    expect("tolerance" in result).toBe(false);
  });

  it("reports inequality exactly without any tolerance", () => {
    const result = compareScalars(sc("1/3"), sc("1/2"));
    expect(result).toEqual({ value: false, exact: true });
  });

  it("uses and records the tolerance when either side is approximate", () => {
    const result = compareScalars(approx("sqrt(2)", "1.414213562"), sc("1.414213562"));
    expect(result.value).toBe(true);
    expect(result.exact).toBe(false);
    expect(result.tolerance).toEqual(DEFAULT_TOLERANCE);
  });

  it("never equates values beyond the tolerance", () => {
    const result = compareScalars(approx("a", "1.414"), sc("1.415"));
    expect(result.value).toBe(false);
    expect(result.exact).toBe(false);
  });

  it("treats the tolerance boundary as inclusive", () => {
    // Use exactly-representable floats: gap 1 vs bound 1 (equal), then a
    // strictly smaller bound (not equal).
    const boundary = compareScalars(approx("a", "2"), sc("1"), { absolute: 1 });
    expect(boundary.value).toBe(true);
    expect(boundary.tolerance).toEqual({ absolute: 1, relative: 1e-9 });
    const beyond = compareScalars(approx("a", "2"), sc("1"), { absolute: 0.5 });
    expect(beyond.value).toBe(false);
    // Default tolerance: gap 1e-8 > 1e-9 is NOT equal.
    expect(compareScalars(approx("a", "1.00000001"), sc("1")).value).toBe(false);
  });

  it("scales the bound relatively for large magnitudes", () => {
    // scale ≈ 1e9 → bound = max(1e-9, 1e-9·1e9) = 1 → gap 1 equal, gap 2 not.
    expect(compareScalars(approx("a", "1000000001"), sc("1000000000")).value).toBe(true);
    expect(compareScalars(approx("a", "1000000002"), sc("1000000000")).value).toBe(false);
  });

  it("honors custom tolerances", () => {
    const result = compareScalars(approx("a", "1.5"), sc("1"), { absolute: 1 });
    expect(result.value).toBe(true);
    expect(result.tolerance).toEqual({ absolute: 1, relative: 1e-9 });
  });
});

describe("orderScalars — dual path ordering", () => {
  it("orders exact scalars exactly", () => {
    expect(orderScalars(sc("1/3"), sc("1/2"))).toEqual({ value: -1, exact: true });
    expect(orderScalars(sc("1/2"), sc("1/3"))).toEqual({ value: 1, exact: true });
    expect(orderScalars(sc("2/4"), sc("1/2"))).toEqual({ value: 0, exact: true });
  });

  it("orders approximate scalars with recorded tolerance", () => {
    const less = orderScalars(approx("a", "1.4"), sc("1.5"));
    expect(less).toMatchObject({ value: -1, exact: false, tolerance: DEFAULT_TOLERANCE });
    const equal = orderScalars(approx("a", "1.0000000001"), sc("1"));
    expect(equal.value).toBe(0);
    const greater = orderScalars(approx("a", "1.5"), sc("1.4"));
    expect(greater.value).toBe(1);
  });
});

describe("compareScalarVectors", () => {
  it("compares component-wise exactly", () => {
    expect(compareScalarVectors(vec("1", "2", "3"), vec("1", "2", "3"))).toEqual({
      value: true,
      exact: true,
    });
    expect(compareScalarVectors(vec("1", "2", "3"), vec("1", "2", "4")).value).toBe(
      false,
    );
  });

  it("compares approximately with recorded tolerance", () => {
    const a = vec("1", "2", "3");
    const b = { x: approx("x", "1.0000000001"), y: sc("2"), z: sc("3") };
    const result = compareScalarVectors(a, b);
    expect(result.value).toBe(true);
    expect(result.exact).toBe(false);
    expect(result.tolerance).toEqual(DEFAULT_TOLERANCE);

    const far = { x: approx("x", "1.001"), y: sc("2"), z: sc("3") };
    expect(compareScalarVectors(a, far).value).toBe(false);
  });
});

describe("numbersWithinTolerance / formatTolerance", () => {
  it("implements the documented inclusive rule", () => {
    // 0.5 is exactly representable in binary floating point: gap == bound.
    expect(numbersWithinTolerance(1, 1.5, { absolute: 0.5, relative: 0 })).toBe(true);
    expect(numbersWithinTolerance(1, 1.5000001, { absolute: 0.5, relative: 0 })).toBe(
      false,
    );
    expect(numbersWithinTolerance(0, 0, DEFAULT_TOLERANCE)).toBe(true);
    expect(numbersWithinTolerance(1, 1 + 1e-8, DEFAULT_TOLERANCE)).toBe(false);
  });

  it("renders a stable tolerance string for validation records", () => {
    expect(formatTolerance(DEFAULT_TOLERANCE)).toBe(
      "absolute=1e-9; relative=1e-9",
    );
    expect(formatTolerance({ absolute: 0.5, relative: 0.25 })).toBe(
      "absolute=0.5; relative=0.25",
    );
  });
});
