/**
 * Feature Flags — v2 领域重构开关
 *
 * 控制 Calculator/Planner/Catalog 使用 legacy 还是 v2 实现。
 * Phase 0 中所有默认值均为 "legacy"，不改变 production 行为。
 */

export type CalculatorEngine = "legacy" | "v2" | "shadow";
export type PlannerEngine = "legacy" | "v2";
export type CatalogSource = "legacy" | "v2";

export interface FeatureFlags {
  calculatorEngine: CalculatorEngine;
  plannerEngine: PlannerEngine;
  catalogSource: CatalogSource;
}

/** Read flags from import.meta.env (Vite) with safe defaults */
export function getFeatureFlags(): FeatureFlags {
  return {
    calculatorEngine: readEnvFlag("VITE_CALCULATOR_ENGINE", ["legacy", "v2", "shadow"], "legacy"),
    plannerEngine: readEnvFlag("VITE_PLANNER_ENGINE", ["legacy", "v2"], "legacy"),
    catalogSource: readEnvFlag("VITE_CATALOG_SOURCE", ["legacy", "v2"], "legacy"),
  };
}

function readEnvFlag<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = (typeof import.meta !== "undefined" && import.meta.env?.[key]) ?? "";
  const value = String(raw).trim().toLowerCase();
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Check if v2 calculator is active (includes shadow mode) */
export function isV2Calculator(flags: FeatureFlags = getFeatureFlags()): boolean {
  return flags.calculatorEngine === "v2" || flags.calculatorEngine === "shadow";
}

/** Check if shadow diff mode is active */
export function isShadowMode(flags: FeatureFlags = getFeatureFlags()): boolean {
  return flags.calculatorEngine === "shadow";
}

/** Check if v2 planner is active */
export function isV2Planner(flags: FeatureFlags = getFeatureFlags()): boolean {
  return flags.plannerEngine === "v2";
}

/** Check if v2 catalog is active */
export function isV2Catalog(flags: FeatureFlags = getFeatureFlags()): boolean {
  return flags.catalogSource === "v2";
}
