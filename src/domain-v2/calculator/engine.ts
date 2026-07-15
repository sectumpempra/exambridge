/**
 * Calculator Engine v2 — Main Orchestrator
 *
 * Coordinates the full calculation pipeline:
 * 1. Validate inputs (finite, in range, no duplicates)
 * 2. Resolve qualification + specification from catalog
 * 3. Resolve units and find boundary sets
 * 4. Calculate UMS per paper (Pearson UMS policy)
 * 5. Validate route (SelectionRule engine)
 * 6. Aggregate UMS
 * 7. Map grade
 * 8. Check A*
 * 9. Generate explanation
 *
 * All functions are pure — no side effects, no React, no network.
 */

import type { Catalog } from "@/domain-v2/catalog/catalog";
import type { AssessmentUnit, BoundarySet } from "@/domain-v2/catalog/schema";
import type {
  CalculateQualificationInput,
  CalculationResult,
  PaperCalculationResult,
  AStarCheck,
  ExplanationStep,
} from "./types";
import { calculateUMS } from "./policies/pearson-ums";
import { calculatePUM } from "./policies/caie-pum";
import { validateRoute } from "./route-validator";
import { mapGrade } from "./grade-mapper";
import { checkAStar } from "./astar-checker";

const PEARSON_SOURCE = {
  title: "Pearson Edexcel International A Level specification",
  publisher: "Pearson",
  url: "https://qualifications.pearson.com/en/qualifications/edexcel-international-advanced-levels/mathematics.coursematerials.html",
  accessedAt: "2026-07-11",
};

/**
 * Main entry point: calculate qualification grade from paper inputs.
 */
export function calculateQualification(
  input: CalculateQualificationInput,
  catalog: Catalog
): CalculationResult {
  const errors: Array<{ code: string; message: string }> = [];
  const warnings: Array<{ code: string; message: string }> = [];
  const explanation: ExplanationStep[] = [];

  // ── Step 1: Resolve qualification ──
  const qual = catalog.getQualification(input.qualificationId);
  if (!qual) {
    return errorResult(input, "UNKNOWN_QUALIFICATION",
      `未知资格: ${input.qualificationId}`);
  }

  if (qual.status === "unsupported") {
    return errorResult(input, "UNSUPPORTED_QUALIFICATION",
      `资格 ${qual.subjectCode} 暂不支持`);
  }

  // ── Step 2: Resolve specification from series ──
  const series = input.papers[0]?.series ?? "";
  const spec = catalog.getSpecificationForSeries(qual.id, series);
  if (!spec) {
    return errorResult(input, "SERIES_SPEC_MISMATCH",
      `无法为 series "${series}" 找到对应的 specification`);
  }

  // ── Step 3: Resolve units ──
  const unitMap = new Map<string, AssessmentUnit>();
  const units = catalog.listUnits(spec.id);
  for (const u of units) {
    unitMap.set(u.id, u);
  }

  // ── Step 4: Validate paper inputs ──
  const duplicateCheck = new Set<string>();
  for (const paper of input.papers) {
    if (!Number.isFinite(paper.rawScore) || paper.rawScore < 0) {
      return errorResult(input, "SCORE_OUT_OF_RANGE",
        `无效分数: ${paper.rawScore} (unit ${paper.unitId})`);
    }
    if (duplicateCheck.has(paper.unitId)) {
      return errorResult(input, "DUPLICATE_UNIT",
        `重复单元: ${paper.unitId}`);
    }
    duplicateCheck.add(paper.unitId);
  }

  // ── Step 5: Find route ──
  const routes = catalog.listRoutes(spec.id);
  if (routes.length === 0) {
    return errorResult(input, "INVALID_ROUTE",
      `Specification ${spec.id} 没有定义 award route`);
  }

  // If user specified a route, use it; otherwise check ambiguity
  const route = input.routeId
    ? routes.find((r) => r.id === input.routeId)
    : routes[0];

  if (routes.length > 1 && !input.routeId) {
    return errorResult(input, "AMBIGUOUS_ROUTE",
      `多个可用路线: ${routes.map((r) => r.name).join(", ")}，请指定 routeId`);
  }

  if (!route) {
    return errorResult(input, "INVALID_ROUTE",
      `找不到路线: ${input.routeId}`);
  }

  // ── Step 6: Validate route ──
  const selectedUnitIds = input.papers.map((p) => p.unitId);
  const routeValidation = validateRoute({
    route,
    selectedUnitIds,
    unitMap,
  });

  // ── Step 7: Find boundary sets and calculate UMS per paper ──
  const paperResults: PaperCalculationResult[] = [];
  let totalNormalized = 0;
  let totalNormalizedMax = 0;

  for (const paper of input.papers) {
    const unit = unitMap.get(paper.unitId);
    if (!unit) {
      return errorResult(input, "UNKNOWN_UNIT",
        `未知单元: ${paper.unitId}`);
    }

    // Find boundary set
    const boundaryResult = catalog.getBoundary({
      unitId: paper.unitId,
      series: paper.series,
    });

    let boundary: BoundarySet | undefined;
    if (boundaryResult.kind === "FOUND") {
      boundary = boundaryResult.boundary;
    } else if (boundaryResult.kind === "AMBIGUOUS") {
      return errorResult(input, "AMBIGUOUS_BOUNDARY",
        `单元 ${unit.code} (${paper.series}) 存在多个边界集，请选择`);
    } else {
      return errorResult(input, "MISSING_BOUNDARY",
        `找不到单元 ${unit.code} (${paper.series}) 的边界数据`);
    }

    // Validate score within maxMark
    const maxMark = boundary.maxMark;
    if (paper.rawScore > maxMark) {
      return errorResult(input, "SCORE_OUT_OF_RANGE",
        `分数 ${paper.rawScore} 超过最大值 ${maxMark} (单元 ${unit.code})`);
    }

    // Calculate normalized score (UMS for Pearson, PUM for CAIE)
    const boardCode = catalog.rawCatalog.boards.find((b) => b.id === qual.boardId)?.code ?? "";
    let normalizedScore: number;
    let normalizedMax: number;
    let scoreType: "RAW" | "UMS" | "PUM" | "GNS";
    let grade: string;

    if (boardCode === "CAIE") {
      // CAIE: use PUM (Percentage Uniform Mark)
      const pumResult = calculatePUM({
        rawScore: paper.rawScore,
        maxMark,
        boundarySet: boundary,
      });
      normalizedScore = pumResult.pum;
      normalizedMax = 100;
      scoreType = "PUM";
      grade = pumResult.grade;
    } else {
      // Pearson: use UMS
      const umsMax = unit.umsMax ?? 100;
      const umsResult = calculateUMS({
        rawScore: paper.rawScore,
        maxMark,
        umsMax,
        boundarySet: boundary,
      });
      normalizedScore = umsResult.ums;
      normalizedMax = umsMax;
      scoreType = "UMS";
      grade = umsResult.grade;
    }

    paperResults.push({
      unitId: paper.unitId,
      rawScore: paper.rawScore,
      maxMark,
      normalizedScore,
      normalizedMax,
      scoreType,
      grade,
    });

    totalNormalized += normalizedScore;
    totalNormalizedMax += normalizedMax;
  }

  // ── Step 8: Aggregate and map grade ──
  const aggregationPolicy = catalog.getAggregationPolicy(route.aggregationPolicyId);
  if (!aggregationPolicy) {
    return errorResult(input, "UNVERIFIED_RULE",
      `找不到聚合策略: ${route.aggregationPolicyId}`);
  }

  const gradePolicy = catalog.getGradePolicy(route.gradePolicyId);
  if (!gradePolicy) {
    return errorResult(input, "UNVERIFIED_RULE",
      `找不到等级策略: ${route.gradePolicyId}`);
  }

  const gradingScale = catalog.getGradingScale(gradePolicy.gradingScaleId);
  if (!gradingScale) {
    return errorResult(input, "UNVERIFIED_RULE",
      `找不到评分标准: ${gradePolicy.gradingScaleId}`);
  }

  const gradeResult = mapGrade({
    totalScore: totalNormalized,
    maxScore: totalNormalizedMax,
    gradePolicy,
    gradingScale,
  });

  // ── Step 9: Check A* ──
  let aStarCheck: AStarCheck | undefined;
  if (route.aStarPolicyId) {
    const aStarPolicy = catalog.getAStarPolicy(route.aStarPolicyId);
    if (aStarPolicy) {
      const aStarResult = checkAStar({
        policy: aStarPolicy,
        paperResults,
        totalUMS: totalNormalized,
        maxUMS: totalNormalizedMax,
        currentGrade: gradeResult.grade,
        unitMap,
      });

      aStarCheck = {
        eligible: aStarResult.eligible,
        totalMet: aStarResult.totalMet,
        a2Met: aStarResult.a2Met,
        totalThreshold: aStarResult.totalThreshold,
        a2Threshold: aStarResult.a2Threshold,
        details: aStarResult.details,
      };
    }
  }

  // Final grade: A* if eligible, otherwise the mapped grade
  const predictedGrade = aStarCheck?.eligible ? "A*" : gradeResult.grade;

  // ── Step 10: Build explanation ──
  explanation.push({
    step: 1,
    title: "资格与规格",
    details: [
      `资格: ${qual.subjectName} (${qual.subjectCode})`,
      `规格: ${spec.label}`,
      `路线: ${route.name}`,
    ],
  });

  explanation.push({
    step: 2,
    title: "各单元成绩",
    details: paperResults.map((p) => {
      const unit = unitMap.get(p.unitId);
      const code = unit?.aliases[0] ?? unit?.code ?? p.unitId;
      return `${code}: Raw ${p.rawScore}/${p.maxMark} → UMS ${p.normalizedScore}/${p.normalizedMax} (${p.grade})`;
    }),
  });

  explanation.push({
    step: 3,
    title: "聚合",
    details: [
      `方法: ${aggregationPolicy.name}`,
      `总分: ${totalNormalized}/${totalNormalizedMax} UMS (${((totalNormalized / totalNormalizedMax) * 100).toFixed(1)}%)`,
    ],
  });

  explanation.push({
    step: 4,
    title: "等级评估",
    details: gradeResult.gradeChecks.map((g) =>
      `${g.grade}: ${g.achieved ? "✓ 达到" : "✗ 未达到"} (阈值 ${g.threshold} UMS${!g.achieved ? `, 差 ${g.gap}` : ""})`
    ),
  });

  if (aStarCheck) {
    explanation.push({
      step: 5,
      title: "A* 评估",
      details: aStarCheck.details,
    });
  }

  if (gradeResult.nextGrade) {
    explanation.push({
      step: 6,
      title: "下一等级",
      details: [`距离 ${gradeResult.nextGrade.grade} 还差 ${gradeResult.nextGrade.gap} UMS`],
    });
  }

  // ── Determine status ──
  let status: CalculationResult["status"] = "SUCCESS";
  if (!routeValidation.valid) {
    status = "INCOMPLETE";
  }

  return {
    status,
    qualificationId: qual.id,
    specificationId: spec.id,
    routeId: route.id,
    predictedGrade: routeValidation.valid ? predictedGrade : null,
    normalizedTotal: totalNormalized,
    normalizedMax: totalNormalizedMax,
    percentage: totalNormalizedMax > 0 ? totalNormalized / totalNormalizedMax : 0,
    paperResults,
    routeValidation,
    gradeChecks: gradeResult.gradeChecks,
    aStarCheck,
    nextGrade: gradeResult.nextGrade
      ? {
          grade: gradeResult.nextGrade.grade,
          gap: gradeResult.nextGrade.gap,
          scale: "UMS" as const,
        }
      : undefined,
    warnings,
    errors,
    explanation,
    sources: [PEARSON_SOURCE],
  };
}

function errorResult(
  input: CalculateQualificationInput,
  code: string,
  message: string
): CalculationResult {
  return {
    status: "INVALID",
    qualificationId: input.qualificationId,
    predictedGrade: null,
    paperResults: [],
    routeValidation: {
      valid: false,
      explanation: [`[${code}] ${message}`],
    },
    gradeChecks: [],
    warnings: [],
    errors: [{ code, message }],
    explanation: [{
      step: 0,
      title: "计算错误",
      details: [`[${code}] ${message}`],
    }],
    sources: [PEARSON_SOURCE],
  };
}
