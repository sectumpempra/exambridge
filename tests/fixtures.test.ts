import { describe, it, expect } from "vitest";
import {
  ALL_YMA01_FIXTURES,
  YMA01_VALID_A,
  YMA01_VALID_A_STAR,
  YMA01_MISSING_P4,
  YMA01_MIXED_SPEC,
  YMA01_ILLEGAL_APPLIED,
  YMA01_OLD_SPEC_VALID,
} from "./fixtures";

describe("YMA01 Characterization Fixtures", () => {
  it("has 6 fixtures total", () => {
    expect(ALL_YMA01_FIXTURES.length).toBe(6);
  });

  it("valid routes have predicted grades", () => {
    expect(YMA01_VALID_A.expected.predictedGrade).toBe("A");
    expect(YMA01_VALID_A_STAR.expected.predictedGrade).toBe("A*");
    expect(YMA01_OLD_SPEC_VALID.expected.predictedGrade).toBe("A");
  });

  it("invalid routes have null predicted grades", () => {
    expect(YMA01_MISSING_P4.expected.predictedGrade).toBeNull();
    expect(YMA01_MIXED_SPEC.expected.predictedGrade).toBeNull();
    expect(YMA01_ILLEGAL_APPLIED.expected.predictedGrade).toBeNull();
  });

  it("invalid routes have validRoute=false", () => {
    expect(YMA01_MISSING_P4.expected.validRoute).toBe(false);
    expect(YMA01_MIXED_SPEC.expected.validRoute).toBe(false);
    expect(YMA01_ILLEGAL_APPLIED.expected.validRoute).toBe(false);
  });

  it("A* fixture has aStarEligible=true", () => {
    expect(YMA01_VALID_A_STAR.expected.aStarEligible).toBe(true);
  });

  it("old spec uses C12/C34 with 200 UMS each", () => {
    const c12 = YMA01_OLD_SPEC_VALID.papers.find((p) => p.unit === "C12");
    const c34 = YMA01_OLD_SPEC_VALID.papers.find((p) => p.unit === "C34");
    expect(c12).toBeDefined();
    expect(c34).toBeDefined();
    expect(c12!.maxMark).toBe(125); // raw max, not UMS
    expect(c34!.maxMark).toBe(125);
  });

  it("new spec has exactly 6 papers", () => {
    expect(YMA01_VALID_A.papers.length).toBe(6);
    expect(YMA01_VALID_A_STAR.papers.length).toBe(6);
  });

  it("old spec has exactly 4 papers", () => {
    expect(YMA01_OLD_SPEC_VALID.papers.length).toBe(4);
  });

  it("all fixtures have unique names", () => {
    const names = ALL_YMA01_FIXTURES.map((f) => f.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
