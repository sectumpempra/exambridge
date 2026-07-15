import { describe, it, expect } from "vitest";
import {
  getFeatureFlags,
  isV2Calculator,
  isShadowMode,
  isV2Planner,
  isV2Catalog,
} from "@/domain-v2/shared";

describe("Feature Flags", () => {
  it("returns safe defaults (all legacy)", () => {
    const flags = getFeatureFlags();
    expect(flags.calculatorEngine).toBe("legacy");
    expect(flags.plannerEngine).toBe("legacy");
    expect(flags.catalogSource).toBe("legacy");
  });

  it("isV2Calculator returns false by default", () => {
    expect(isV2Calculator()).toBe(false);
  });

  it("isShadowMode returns false by default", () => {
    expect(isShadowMode()).toBe(false);
  });

  it("isV2Planner returns false by default", () => {
    expect(isV2Planner()).toBe(false);
  });

  it("isV2Catalog returns false by default", () => {
    expect(isV2Catalog()).toBe(false);
  });
});
