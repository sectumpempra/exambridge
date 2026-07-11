/**
 * A* Checker
 *
 * Evaluates A* policy conditions independently from regular grade mapping.
 * A* is NEVER automatically granted by grade mapping — it requires explicit
 * evaluation of all AStarPolicy conditions.
 */

import type { AStarPolicy, AssessmentUnit } from "@/domain-v2/catalog/schema";
import type { PaperCalculationResult } from "./types";

export interface AStarCheckInput {
  policy: AStarPolicy;
  paperResults: PaperCalculationResult[];
  totalUMS: number;
  maxUMS: number;
  currentGrade: string;
  unitMap: Map<string, AssessmentUnit>;
}

export interface AStarCheckResult {
  eligible: boolean;
  totalMet: boolean;
  a2Met: boolean;
  totalThreshold: number;
  a2Threshold: number;
  details: string[];
}

/**
 * Check if A* conditions are met.
 *
 * Requirements:
 * 1. Current grade must be A (A* requires A first)
 * 2. ALL policy conditions must be satisfied
 *
 * For YMA01:
 * - TOTAL_MIN: total UMS >= 480 (80% of 600)
 * - UNIT_PAIR_MIN: P3 + P4 UMS >= 180 (90% of 200)
 */
export function checkAStar(input: AStarCheckInput): AStarCheckResult {
  const { policy, paperResults, totalUMS, currentGrade, unitMap } = input;
  const details: string[] = [];

  // A* requires at least grade A first
  if (currentGrade !== "A" && currentGrade !== "A*") {
    details.push(`当前等级为 ${currentGrade}，A* 需要首先达到 A 等级`);
    return {
      eligible: false,
      totalMet: false,
      a2Met: false,
      totalThreshold: 0,
      a2Threshold: 0,
      details,
    };
  }

  let totalMet = true;
  let a2Met = true;
  let totalThreshold = 0;
  let a2Threshold = 0;

  for (const condition of policy.conditions) {
    switch (condition.kind) {
      case "TOTAL_MIN": {
        const min = condition.minTotal ?? 0;
        totalThreshold = min;
        const met = totalUMS >= min;
        if (!met) {
          totalMet = false;
          details.push(
            `总分要求: ${totalUMS}/${min} UMS (差 ${min - totalUMS} UMS)`
          );
        } else {
          details.push(`总分要求: ${totalUMS}/${min} UMS ✓`);
        }
        break;
      }

      case "A2_AVERAGE_MIN": {
        const minAvg = condition.minAverage ?? 0;
        a2Threshold = Math.round(minAvg * 100);
        // A2 units are identified by stage or explicit unitIds
        const a2UnitIds = condition.unitIds ?? [];
        const a2Results = paperResults.filter((p) => a2UnitIds.includes(p.unitId));
        const a2UMS = a2Results.reduce((s, r) => s + r.normalizedScore, 0);
        const a2Max = a2Results.reduce((s, r) => s + r.normalizedMax, 0);
        const avg = a2Max > 0 ? a2UMS / a2Max : 0;
        const met = avg >= minAvg;
        if (!met) {
          a2Met = false;
          details.push(
            `A2 平均分要求: ${(avg * 100).toFixed(1)}%/${(minAvg * 100).toFixed(0)}% (A2 UMS ${a2UMS}/${a2Max})`
          );
        } else {
          details.push(`A2 平均分要求: ${(avg * 100).toFixed(1)}%/${(minAvg * 100).toFixed(0)}% ✓`);
        }
        break;
      }

      case "UNIT_PAIR_MIN": {
        const minSum = condition.minSum ?? 0;
        const pairIds = condition.unitIds ?? [];
        const pairResults = paperResults.filter((p) => pairIds.includes(p.unitId));
        const pairUMS = pairResults.reduce((s, r) => s + r.normalizedScore, 0);
        a2Threshold = minSum;
        const met = pairUMS >= minSum;
        if (!met) {
          a2Met = false;
          const unitNames = pairIds.map((id) => {
            const unit = unitMap.get(id);
            return unit?.aliases[0] ?? unit?.code ?? id;
          });
          details.push(
            `${unitNames.join("+")} 要求: ${pairUMS}/${minSum} UMS (差 ${minSum - pairUMS} UMS)`
          );
        } else {
          const unitNames = pairIds.map((id) => {
            const unit = unitMap.get(id);
            return unit?.aliases[0] ?? unit?.code ?? id;
          });
          details.push(`${unitNames.join("+")}: ${pairUMS}/${minSum} UMS ✓`);
        }
        break;
      }

      case "UNIT_MIN": {
        const minScore = condition.minScore ?? 0;
        const unitId = condition.unitId ?? "";
        const result = paperResults.find((p) => p.unitId === unitId);
        const score = result?.normalizedScore ?? 0;
        const met = score >= minScore;
        const unitName = unitMap.get(unitId)?.aliases[0] ?? unitId;
        if (!met) {
          a2Met = false;
          details.push(`${unitName} 最低分要求: ${score}/${minScore} UMS (差 ${minScore - score} UMS)`);
        } else {
          details.push(`${unitName} 最低分要求: ${score}/${minScore} UMS ✓`);
        }
        break;
      }

      default: {
        // Unknown condition kind
        details.push(`未知条件类型: ${(condition as { kind: string }).kind}`);
      }
    }
  }

  const eligible = totalMet && a2Met;

  if (eligible) {
    details.push("A* 条件全部满足");
  } else {
    details.push("A* 条件未全部满足");
  }

  return {
    eligible,
    totalMet,
    a2Met,
    totalThreshold,
    a2Threshold,
    details,
  };
}
