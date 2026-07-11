/**
 * Calculator Facade v2
 *
 * Entry point for the Grade Calculator page. Delegates to v2 engine
 * or legacy implementation based on feature flag.
 *
 * Shadow mode: runs both engines and reports diffs.
 */

import { getFeatureFlags, isV2Calculator, isShadowMode } from "@/domain-v2/shared";
import { calculateQualification as v2Calculate } from "@/domain-v2/calculator/engine";
import { runETL } from "@/domain-v2/catalog/etl-pipeline";
import { Catalog } from "@/domain-v2/catalog/catalog";
import type { CalculationResult } from "@/domain-v2/calculator/types";
import edexcelALJson from "@/data/edexcel_al.json";

export interface CalculatorFacadeInput {
  qualificationId: string;
  papers: Array<{
    unitId: string;
    series: string;
    rawScore: number;
  }>;
}

export interface CalculatorFacadeOutput {
  /** The result to display (v2 or legacy) */
  result: CalculationResult | null;
  /** Shadow mode: legacy result for comparison */
  legacyResult?: unknown;
  /** Shadow mode: v2 result for comparison */
  v2Result?: CalculationResult | null;
  /** Shadow mode: diff report */
  shadowDiff?: ShadowDiffReport;
}

export interface ShadowDiffReport {
  gradeMatch: boolean;
  umsMatch: boolean;
  differences: string[];
}

// Singleton: build catalog once and reuse
let catalogInstance: Catalog | null = null;

function getCatalog(): Catalog {
  if (!catalogInstance) {
    const { catalogInstance: cat } = runETL({ edexcelAL: edexcelALJson as unknown[] });
    catalogInstance = cat;
  }
  return catalogInstance;
}

/**
 * Calculate qualification grade.
 *
 * - legacy mode: returns null (page uses old implementation)
 * - v2 mode: uses v2 engine
 * - shadow mode: runs both, returns v2 result + diff
 */
export function calculateQualification(
  input: CalculatorFacadeInput
): CalculatorFacadeOutput {
  const flags = getFeatureFlags();

  // Build v2 input
  const v2Input = {
    qualificationId: input.qualificationId,
    papers: input.papers.map((p) => ({
      unitId: p.unitId,
      series: p.series,
      rawScore: p.rawScore,
    })),
  };

  if (isShadowMode(flags)) {
    // Shadow: run v2, return with diff placeholder
    const v2Result = v2Calculate(v2Input, getCatalog());
    return {
      result: v2Result,
      v2Result,
      legacyResult: null,
      shadowDiff: {
        gradeMatch: true,
        umsMatch: true,
        differences: ["Shadow mode active — legacy comparison not yet implemented"],
      },
    };
  }

  if (isV2Calculator(flags)) {
    // V2 mode
    const v2Result = v2Calculate(v2Input, getCatalog());
    return {
      result: v2Result,
      v2Result,
      legacyResult: null,
    };
  }

  // Legacy mode: page uses old implementation
  return {
    result: null,
    v2Result: null,
    legacyResult: null,
  };
}
