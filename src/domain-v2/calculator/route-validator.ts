/**
 * Route Validator — SelectionRule Engine
 *
 * Validates user-selected units against an AwardRoute's selection rules.
 * Each rule is evaluated independently; ALL rules must pass for the route to be valid.
 */

import type { AwardRoute, SelectionRule, AssessmentUnit } from "@/domain-v2/catalog/schema";
import type { RouteValidationResult } from "./types";

export interface RouteValidationInput {
  route: AwardRoute;
  selectedUnitIds: string[];
  unitMap: Map<string, AssessmentUnit>;
}

/**
 * Validate selected units against a route's selection rules.
 * Returns detailed result with missing/extra units and explanation.
 */
export function validateRoute(input: RouteValidationInput): RouteValidationResult {
  const { route, selectedUnitIds, unitMap } = input;

  const missingUnits: string[] = [];
  const extraUnits: string[] = [];
  const explanation: string[] = [];
  let valid = true;

  // Check for duplicate unit selections
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const uid of selectedUnitIds) {
    if (seen.has(uid)) duplicates.add(uid);
    seen.add(uid);
  }

  if (duplicates.size > 0) {
    valid = false;
    explanation.push(`存在重复单元: ${Array.from(duplicates).map((id) => unitCode(id, unitMap)).join(", ")}`);
  }

  // Evaluate each selection rule
  for (const rule of route.selectionRules) {
    const result = evaluateRule(rule, selectedUnitIds, unitMap);
    if (!result.passed) {
      valid = false;
      missingUnits.push(...result.missing);
      extraUnits.push(...result.extra);
      explanation.push(...result.messages);
    }
  }

  if (valid) {
    explanation.push(`路线 "${route.name}" 验证通过`);
  }

  return {
    valid,
    routeId: route.id,
    missingUnits: [...new Set(missingUnits)],
    extraUnits: [...new Set(extraUnits)],
    explanation,
  };
}

interface RuleEvaluationResult {
  passed: boolean;
  missing: string[];
  extra: string[];
  messages: string[];
}

function evaluateRule(
  rule: SelectionRule,
  selectedUnitIds: string[],
  unitMap: Map<string, AssessmentUnit>
): RuleEvaluationResult {
  const selected = new Set(selectedUnitIds);

  switch (rule.kind) {
    case "REQUIRE_ALL":
      return evaluateRequireAll(rule.unitIds, selected, unitMap);

    case "EXACTLY_N_FROM":
      return evaluateExactlyNFrom(rule.count, rule.unitIds, selected, unitMap);

    case "AT_LEAST_N_FROM":
      return evaluateAtLeastNFrom(rule.count, rule.unitIds, selected, unitMap);

    case "ONE_OF_GROUPS":
      return evaluateOneOfGroups(rule.groups, selected, unitMap);

    case "MUTUALLY_EXCLUSIVE":
      return evaluateMutuallyExclusive(rule.unitIds, selected, unitMap);

    case "TOTAL_UNIT_COUNT":
      return evaluateTotalUnitCount(rule.count, selectedUnitIds);

    case "NO_DUPLICATES":
      return evaluateNoDuplicates(selectedUnitIds);

    default: {
      // Exhaustiveness check
      const _exhaustive: never = rule;
      void _exhaustive;
      return { passed: false, missing: [], extra: [], messages: ["未知规则类型"] };
    }
  }
}

function evaluateRequireAll(
  requiredIds: string[],
  selected: Set<string>,
  unitMap: Map<string, AssessmentUnit>
): RuleEvaluationResult {
  const missing = requiredIds.filter((id) => id && !selected.has(id));
  if (missing.length === 0) {
    return { passed: true, missing: [], extra: [], messages: [] };
  }
  return {
    passed: false,
    missing,
    extra: [],
    messages: [
      `缺少必修单元: ${missing.map((id) => unitCode(id, unitMap)).join(", ")}`,
    ],
  };
}

function evaluateExactlyNFrom(
  count: number,
  poolIds: string[],
  selected: Set<string>,
  unitMap: Map<string, AssessmentUnit>
): RuleEvaluationResult {
  const selectedFromPool = poolIds.filter((id) => id && selected.has(id));
  if (selectedFromPool.length === count) {
    return { passed: true, missing: [], extra: [], messages: [] };
  }
  const unitCodes = poolIds.map((id) => unitCode(id, unitMap));
  if (selectedFromPool.length < count) {
    return {
      passed: false,
      missing: [],
      extra: [],
      messages: [
        `需要从 {${unitCodes.join(", ")}} 中恰好选择 ${count} 个，实际选了 ${selectedFromPool.length} 个`,
      ],
    };
  }
  return {
    passed: false,
    missing: [],
    extra: selectedFromPool.slice(count),
    messages: [
      `需要从 {${unitCodes.join(", ")}} 中恰好选择 ${count} 个，实际选了 ${selectedFromPool.length} 个（多选了 ${selectedFromPool.slice(count).map((id) => unitCode(id, unitMap)).join(", ")}）`,
    ],
  };
}

function evaluateAtLeastNFrom(
  count: number,
  poolIds: string[],
  selected: Set<string>,
  unitMap: Map<string, AssessmentUnit>
): RuleEvaluationResult {
  const selectedFromPool = poolIds.filter((id) => id && selected.has(id));
  if (selectedFromPool.length >= count) {
    return { passed: true, missing: [], extra: [], messages: [] };
  }
  return {
    passed: false,
    missing: poolIds.filter((id) => id && !selected.has(id)),
    extra: [],
    messages: [
      `需要从 {${poolIds.map((id) => unitCode(id, unitMap)).join(", ")}} 中至少选择 ${count} 个，实际选了 ${selectedFromPool.length} 个`,
    ],
  };
}

function evaluateOneOfGroups(
  groups: string[][],
  selected: Set<string>,
  unitMap: Map<string, AssessmentUnit>
): RuleEvaluationResult {
  const messages: string[] = [];
  let passed = true;

  for (const group of groups) {
    const selectedFromGroup = group.filter((id) => id && selected.has(id));
    if (selectedFromGroup.length === 0) {
      passed = false;
      messages.push(
        `未从允许组合 {${group.map((id) => unitCode(id, unitMap)).join(" / ")}} 中选择任何单元`
      );
    }
  }

  // Also check: user selected units that belong to NONE of the groups
  // (this catches "extra" applied units)
  const allGroupUnits = new Set(groups.flat());
  const extra = Array.from(selected).filter((id) => id && !allGroupUnits.has(id));

  return { passed, missing: [], extra, messages };
}

function evaluateMutuallyExclusive(
  unitIds: string[],
  selected: Set<string>,
  unitMap: Map<string, AssessmentUnit>
): RuleEvaluationResult {
  const selectedFromSet = unitIds.filter((id) => id && selected.has(id));
  if (selectedFromSet.length <= 1) {
    return { passed: true, missing: [], extra: [], messages: [] };
  }
  return {
    passed: false,
    missing: [],
    extra: selectedFromSet.slice(1),
    messages: [
      `互斥单元不能同时选择: ${selectedFromSet.map((id) => unitCode(id, unitMap)).join(" + ")}`,
    ],
  };
}

function evaluateTotalUnitCount(count: number, selectedUnitIds: string[]): RuleEvaluationResult {
  if (selectedUnitIds.length === count) {
    return { passed: true, missing: [], extra: [], messages: [] };
  }
  if (selectedUnitIds.length < count) {
    return {
      passed: false,
      missing: [],
      extra: [],
      messages: [`单元总数应为 ${count} 个，实际 ${selectedUnitIds.length} 个`],
    };
  }
  return {
    passed: false,
    missing: [],
    extra: [],
    messages: [`单元总数应为 ${count} 个，实际 ${selectedUnitIds.length} 个（多选了 ${selectedUnitIds.length - count} 个）`],
  };
}

function evaluateNoDuplicates(selectedUnitIds: string[]): RuleEvaluationResult {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of selectedUnitIds) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (duplicates.size === 0) {
    return { passed: true, missing: [], extra: [], messages: [] };
  }
  return {
    passed: false,
    missing: [],
    extra: [],
    messages: [`存在重复单元选择: ${Array.from(duplicates).join(", ")}`],
  };
}

function unitCode(unitId: string, unitMap: Map<string, AssessmentUnit>): string {
  const unit = unitMap.get(unitId);
  return unit?.code ?? unitId;
}
