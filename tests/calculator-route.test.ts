import { describe, it, expect } from "vitest";
import { validateRoute } from "@/domain-v2/calculator/route-validator";
import type { AwardRoute, AssessmentUnit } from "@/domain-v2/catalog/schema";

// Helpers
function makeRoute(rules: AwardRoute["selectionRules"]): AwardRoute {
  return {
    id: "route:test",
    specificationId: "spec:test",
    name: "Test Route",
    awardType: "FULL",
    selectionRules: rules,
    aggregationPolicyId: "agg:test",
    gradePolicyId: "grade:test",
    status: "verified",
    sources: [],
  };
}

function makeUnits(codes: string[]): Map<string, AssessmentUnit> {
  const map = new Map<string, AssessmentUnit>();
  for (const code of codes) {
    map.set(`unit:${code}`, {
      id: `unit:${code}`,
      specificationId: "spec:test",
      code,
      aliases: [code],
      name: code,
      paperIds: [],
      status: "verified",
      sources: [],
    });
  }
  return map;
}

describe("Route Validator", () => {
  const u = makeUnits(["P1", "P2", "P3", "P4", "M1", "M2", "S1", "S2", "D1", "C12", "C34"]);

  it("passes REQUIRE_ALL when all units present", () => {
    const route = makeRoute([
      { kind: "REQUIRE_ALL", unitIds: ["unit:P1", "unit:P2"] },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:P1", "unit:P2"],
      unitMap: u,
    });
    expect(result.valid).toBe(true);
  });

  it("fails REQUIRE_ALL when a unit is missing", () => {
    const route = makeRoute([
      { kind: "REQUIRE_ALL", unitIds: ["unit:P1", "unit:P2", "unit:P3"] },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:P1", "unit:P2"],
      unitMap: u,
    });
    expect(result.valid).toBe(false);
    expect(result.missingUnits).toContain("unit:P3");
  });

  it("passes EXACTLY_N_FROM when count matches", () => {
    const route = makeRoute([
      { kind: "EXACTLY_N_FROM", count: 2, unitIds: ["unit:M1", "unit:M2", "unit:S1", "unit:S2"] },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:M1", "unit:S1"],
      unitMap: u,
    });
    expect(result.valid).toBe(true);
  });

  it("fails EXACTLY_N_FROM when too few selected", () => {
    const route = makeRoute([
      { kind: "EXACTLY_N_FROM", count: 2, unitIds: ["unit:M1", "unit:M2", "unit:S1"] },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:M1"],
      unitMap: u,
    });
    expect(result.valid).toBe(false);
  });

  it("fails EXACTLY_N_FROM when too many selected", () => {
    const route = makeRoute([
      { kind: "EXACTLY_N_FROM", count: 2, unitIds: ["unit:M1", "unit:M2", "unit:S1"] },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:M1", "unit:M2", "unit:S1"],
      unitMap: u,
    });
    expect(result.valid).toBe(false);
  });

  it("passes TOTAL_UNIT_COUNT when count matches", () => {
    const route = makeRoute([
      { kind: "TOTAL_UNIT_COUNT", count: 6 },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:P1", "unit:P2", "unit:P3", "unit:P4", "unit:M1", "unit:S1"],
      unitMap: u,
    });
    expect(result.valid).toBe(true);
  });

  it("fails TOTAL_UNIT_COUNT when count wrong", () => {
    const route = makeRoute([
      { kind: "TOTAL_UNIT_COUNT", count: 6 },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:P1", "unit:P2", "unit:P3", "unit:P4", "unit:M1"],
      unitMap: u,
    });
    expect(result.valid).toBe(false);
  });

  it("fails NO_DUPLICATES when duplicate present", () => {
    const route = makeRoute([
      { kind: "NO_DUPLICATES" },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:P1", "unit:P1"],
      unitMap: u,
    });
    expect(result.valid).toBe(false);
  });

  it("passes NO_DUPLICATES when no duplicates", () => {
    const route = makeRoute([
      { kind: "NO_DUPLICATES" },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:P1", "unit:P2"],
      unitMap: u,
    });
    expect(result.valid).toBe(true);
  });

  it("fails MUTUALLY_EXCLUSIVE when both selected", () => {
    const route = makeRoute([
      { kind: "MUTUALLY_EXCLUSIVE", unitIds: ["unit:C12", "unit:P1"] },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:C12", "unit:P1"],
      unitMap: u,
    });
    expect(result.valid).toBe(false);
  });

  it("passes MUTUALLY_EXCLUSIVE when only one selected", () => {
    const route = makeRoute([
      { kind: "MUTUALLY_EXCLUSIVE", unitIds: ["unit:C12", "unit:P1"] },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:C12"],
      unitMap: u,
    });
    expect(result.valid).toBe(true);
  });

  it("validates full YMA01 new spec route (P1+P2+P3+P4+M1+S1)", () => {
    const route = makeRoute([
      { kind: "REQUIRE_ALL", unitIds: ["unit:P1", "unit:P2", "unit:P3", "unit:P4"] },
      {
        kind: "ONE_OF_GROUPS",
        groups: [
          ["unit:M1", "unit:M2"],
          ["unit:S1", "unit:S2"],
          ["unit:M1", "unit:S1"],
        ],
      },
      { kind: "TOTAL_UNIT_COUNT", count: 6 },
      { kind: "NO_DUPLICATES" },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:P1", "unit:P2", "unit:P3", "unit:P4", "unit:M1", "unit:S1"],
      unitMap: u,
    });
    expect(result.valid).toBe(true);
  });

  it("fails YMA01 route with missing P4", () => {
    const route = makeRoute([
      { kind: "REQUIRE_ALL", unitIds: ["unit:P1", "unit:P2", "unit:P3", "unit:P4"] },
      {
        kind: "ONE_OF_GROUPS",
        groups: [
          ["unit:M1", "unit:M2"],
          ["unit:S1", "unit:S2"],
        ],
      },
      { kind: "TOTAL_UNIT_COUNT", count: 6 },
      { kind: "NO_DUPLICATES" },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:P1", "unit:P2", "unit:P3", "unit:M1", "unit:S1"],
      unitMap: u,
    });
    expect(result.valid).toBe(false);
    expect(result.missingUnits).toContain("unit:P4");
  });

  it("fails YMA01 route with illegal applied pair (M1+M3)", () => {
    const u3 = makeUnits(["P1", "P2", "P3", "P4", "M1", "M3"]);
    const route = makeRoute([
      { kind: "REQUIRE_ALL", unitIds: ["unit:P1", "unit:P2", "unit:P3", "unit:P4"] },
      {
        kind: "ONE_OF_GROUPS",
        groups: [
          ["unit:M1", "unit:M2"],
          ["unit:S1", "unit:S2"],
          ["unit:M1", "unit:S1"],
        ],
      },
      { kind: "TOTAL_UNIT_COUNT", count: 6 },
      { kind: "NO_DUPLICATES" },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:P1", "unit:P2", "unit:P3", "unit:P4", "unit:M1", "unit:M3"],
      unitMap: u3,
    });
    expect(result.valid).toBe(false);
  });

  it("fails old/new spec mix (C12 + P1)", () => {
    const route = makeRoute([
      { kind: "REQUIRE_ALL", unitIds: ["unit:P1", "unit:P2", "unit:P3", "unit:P4"] },
      { kind: "MUTUALLY_EXCLUSIVE", unitIds: ["unit:C12", "unit:C34"] },
      { kind: "TOTAL_UNIT_COUNT", count: 6 },
      { kind: "NO_DUPLICATES" },
    ]);
    const result = validateRoute({
      route,
      selectedUnitIds: ["unit:C12", "unit:P2", "unit:P3", "unit:P4", "unit:M1", "unit:S1"],
      unitMap: u,
    });
    expect(result.valid).toBe(false);
  });
});
