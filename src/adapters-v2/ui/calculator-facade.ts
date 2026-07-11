/**
 * Calculator Facade v2 — 空壳 (Phase 0)
 *
 * 在 Phase 2 中实现为首个纵切片的入口。
 * 当前仅提供类型定义和 legacy 透传接口。
 *
 * 职责:
 * - 接收页面输入 (unit IDs, raw scores, series)
 * - 调用 v2 计算引擎 或 legacy 引擎 (由 feature flag 决定)
 * - shadow 模式下双引擎并行并记录 diff
 * - 返回统一结果供页面展示
 */

import { getFeatureFlags, isV2Calculator } from "@/domain-v2/shared";
import type { CalculationResult } from "@/domain-v2/calculator/types";

export interface CalculatorFacadeInput {
  qualificationId: string;
  papers: Array<{
    unitId: string;
    series: string;
    rawScore: number;
  }>;
}

export interface CalculatorFacadeOutput {
  /** 实际使用的结果 */
  result: CalculationResult | null;
  /** shadow 模式下 legacy 结果 */
  legacyResult?: unknown;
  /** shadow 模式下 v2 结果 */
  v2Result?: CalculationResult | null;
  /** shadow diff 报告 */
  shadowDiff?: ShadowDiffReport;
}

export interface ShadowDiffReport {
  gradeMatch: boolean;
  umsMatch: boolean;
  differences: string[];
}

/**
 * Phase 0 空壳: 始终返回 null，提醒调用者尚未实现。
 * 页面应检查返回结果并在 null 时回退到 legacy 路径。
 */
export function calculateQualification(
  input: CalculatorFacadeInput
): CalculatorFacadeOutput {
  void input; // will be used in Phase 2
  const flags = getFeatureFlags();

  // Phase 0: v2 尚未实现，始终返回 null
  if (isV2Calculator(flags)) {
    return {
      result: null,
      v2Result: null,
      legacyResult: null,
    };
  }

  // Legacy path — 页面继续使用旧实现
  return { result: null, v2Result: null, legacyResult: null };
}
