import {
  AwardCalculationInputV2Schema,
  AwardCalculationResultV2Schema,
  AwardSelectionInputV2Schema,
  AwardSelectionResultV2Schema,
  type AwardCalculationInputV2,
  type AwardCalculationResultV2,
  type AwardSelectionResultV2,
  type GradeBoundaryV2,
  type QualificationAwardRuleV2,
} from "./schema";

export type AwardCalculationErrorCodeV2 =
  | "INVALID_INPUT"
  | "RULE_ROUTE_MISMATCH"
  | "RULE_NOT_EFFECTIVE"
  | "UNKNOWN_COMBINATION"
  | "DUPLICATE_COMPONENT"
  | "INCOMPLETE_COMBINATION"
  | "UNKNOWN_COMPONENT"
  | "CROSS_SERIES"
  | "RAW_MARK_REQUIRED"
  | "AWARD_MARK_REQUIRED"
  | "SCORE_OUT_OF_RANGE"
  | "BOUNDARY_MISMATCH"
  | "AUTO_SELECTION_NOT_ALLOWED"
  | "NO_ELIGIBLE_COMBINATION"
  | "NO_MATCHING_BOUNDARY";

export class AwardCalculationErrorV2 extends Error {
  constructor(public readonly code: AwardCalculationErrorCodeV2) {
    super(code);
    this.name = "AwardCalculationErrorV2";
  }
}

const seriesDate = (series: string) => {
  const [year, season] = series.split("-");
  const month = { january: "01", march: "03", june: "06", october: "10", november: "11" }[season];
  return `${year}-${month ?? "01"}-01`;
};

const rounded = (value: number, rule: QualificationAwardRuleV2["roundingRule"]) => {
  if (rule === "nearest-integer") return Math.round(value);
  if (rule === "board-published" || rule === "official-carry-forward") {
    if (!Number.isInteger(value)) throw new AwardCalculationErrorV2("SCORE_OUT_OF_RANGE");
  }
  return value;
};

const gradeFor = (total: number, boundary: GradeBoundaryV2) =>
  boundary.gradeOrder.find(grade => {
    const threshold = boundary.thresholds[grade];
    return threshold !== null && threshold !== undefined && total >= threshold;
  }) ?? "U";

const sameStringSet = (left: string[] | undefined, right: string[] | undefined) => {
  if (!left || !right || left.length !== right.length) return false;
  const sortedRight = [...right].sort();
  return [...left].sort().every((value, index) => value === sortedRight[index]);
};

const calculate = (
  inputValue: unknown,
  rule: QualificationAwardRuleV2,
  boundary: GradeBoundaryV2,
): AwardCalculationResultV2 => {
  const parsed = AwardCalculationInputV2Schema.safeParse(inputValue);
  if (!parsed.success) throw new AwardCalculationErrorV2("INVALID_INPUT");
  const input: AwardCalculationInputV2 = parsed.data;
  if (input.ruleId !== rule.ruleId || input.routeId !== rule.routeId) throw new AwardCalculationErrorV2("RULE_ROUTE_MISMATCH");

  const targetDate = seriesDate(input.targetSeries);
  if (targetDate < rule.effectiveFrom || (rule.effectiveTo && targetDate > rule.effectiveTo)) {
    throw new AwardCalculationErrorV2("RULE_NOT_EFFECTIVE");
  }

  const combination = rule.validCombinations.find(item => item.combinationId === input.combinationId);
  if (!combination) throw new AwardCalculationErrorV2("UNKNOWN_COMBINATION");
  const expected = new Set(combination.componentCodes);
  const seen = new Set<string>();
  for (const score of input.componentScores) {
    if (seen.has(score.componentCode)) throw new AwardCalculationErrorV2("DUPLICATE_COMPONENT");
    seen.add(score.componentCode);
    if (!expected.has(score.componentCode)) throw new AwardCalculationErrorV2("UNKNOWN_COMPONENT");
  }
  if (seen.size !== expected.size || [...expected].some(code => !seen.has(code))) {
    throw new AwardCalculationErrorV2("INCOMPLETE_COMBINATION");
  }

  const componentByCode = new Map(rule.components.map(component => [component.code, component]));
  const componentAwardMarks: Record<string, number> = {};
  for (const score of input.componentScores) {
    const component = componentByCode.get(score.componentCode);
    if (!component) throw new AwardCalculationErrorV2("UNKNOWN_COMPONENT");
    const isCarriedForward = component.inputKind === "carried-forward";
    if (rule.routeType !== "modular" && !isCarriedForward && score.series !== input.targetSeries) {
      throw new AwardCalculationErrorV2("CROSS_SERIES");
    }

    let awardMark: number;
    if (component.inputKind === "raw" || component.inputKind === "scaled-raw") {
      if (score.rawMark === undefined) throw new AwardCalculationErrorV2("RAW_MARK_REQUIRED");
      if (component.maximumRawMark === null || score.rawMark > component.maximumRawMark) {
        throw new AwardCalculationErrorV2("SCORE_OUT_OF_RANGE");
      }
      awardMark = score.rawMark * component.weightingFactor;
    } else {
      if (score.awardMark === undefined) throw new AwardCalculationErrorV2("AWARD_MARK_REQUIRED");
      awardMark = score.awardMark;
    }
    if (awardMark > component.maximumAwardMark) throw new AwardCalculationErrorV2("SCORE_OUT_OF_RANGE");
    componentAwardMarks[score.componentCode] = awardMark;
  }

  const totalAwardMark = rounded(Object.values(componentAwardMarks).reduce((sum, value) => sum + value, 0), rule.roundingRule);
  const boundarySelection = rule.boundarySelectionRule;
  const optionMatchesCombination = combination.optionCode
    ? boundary.optionCode === combination.optionCode
    : true;
  const requiredOptionMatches = !boundarySelection?.requiresOptionCode
    || Boolean(input.optionCode && boundary.optionCode === input.optionCode);
  const requiredVariantsMatch = !boundarySelection?.requiresComponentVariants
    || sameStringSet(input.componentVariants, boundary.componentVariants);
  if (
    boundary.routeId !== rule.routeId ||
    boundary.boundaryScope !== "overall" ||
    `${boundary.year}-${boundary.series}` !== input.targetSeries ||
    boundary.maximumMark !== rule.totalMaximumAwardMark ||
    !optionMatchesCombination ||
    !requiredOptionMatches ||
    !requiredVariantsMatch
  ) throw new AwardCalculationErrorV2("BOUNDARY_MISMATCH");

  let grade = gradeFor(totalAwardMark, boundary);
  let aStarSatisfied: boolean | undefined;
  if (grade === "A*" && (rule.aStarRule?.ruleKind === "overall-plus-advanced-units" || rule.aStarRule?.ruleKind === "overall-plus-best-advanced-units")) {
    const advancedMarks = (rule.aStarRule.advancedUnitCodes ?? []).map(code => componentAwardMarks[code]).filter((value): value is number => value !== undefined);
    const selectedAdvancedMarks = rule.aStarRule.ruleKind === "overall-plus-best-advanced-units"
      ? advancedMarks.sort((a, b) => b - a).slice(0, rule.aStarRule.advancedUnitCount)
      : advancedMarks;
    const advancedTotal = selectedAdvancedMarks.reduce((sum, mark) => sum + mark, 0);
    aStarSatisfied = totalAwardMark >= (rule.aStarRule.overallMinimumAwardMark ?? Number.POSITIVE_INFINITY) &&
      advancedTotal >= (rule.aStarRule.advancedUnitMinimumAwardMark ?? Number.POSITIVE_INFINITY);
    if (!aStarSatisfied) grade = "A";
  } else if (grade === "A*" && rule.aStarRule?.available) {
    aStarSatisfied = true;
  }

  return AwardCalculationResultV2Schema.parse({
    ruleId: rule.ruleId,
    routeId: rule.routeId,
    boundaryId: boundary.boundaryId,
    combinationId: combination.combinationId,
    targetSeries: input.targetSeries,
    componentAwardMarks,
    totalAwardMark,
    maximumAwardMark: rule.totalMaximumAwardMark,
    grade,
    ...(aStarSatisfied === undefined ? {} : { aStarSatisfied }),
    calculationStatus: "official",
    sourceIds: [...new Set([...rule.sourceIds, ...boundary.sourceIds])],
  });
};

export function calculateQualificationAwardV2(
  inputValue: unknown,
  rule: QualificationAwardRuleV2,
  boundary: GradeBoundaryV2,
): AwardCalculationResultV2 {
  try {
    return calculate(inputValue, rule, boundary);
  } catch (error) {
    if (error instanceof AwardCalculationErrorV2) throw error;
    throw new AwardCalculationErrorV2("INVALID_INPUT");
  }
}

export function calculateBestQualificationAwardV2(
  inputValue: unknown,
  rule: QualificationAwardRuleV2,
  boundaries: GradeBoundaryV2[],
): AwardSelectionResultV2 {
  const parsed = AwardSelectionInputV2Schema.safeParse(inputValue);
  if (!parsed.success) throw new AwardCalculationErrorV2("INVALID_INPUT");
  if (parsed.data.ruleId !== rule.ruleId || parsed.data.routeId !== rule.routeId) {
    throw new AwardCalculationErrorV2("RULE_ROUTE_MISMATCH");
  }
  if (rule.combinationSelectionRule?.selectionMethod !== "best-official-grade" || !rule.combinationSelectionRule.allowExtraComponentScores) {
    throw new AwardCalculationErrorV2("AUTO_SELECTION_NOT_ALLOWED");
  }

  const providedCodes = new Set(parsed.data.componentScores.map(score => score.componentCode));
  if (providedCodes.size !== parsed.data.componentScores.length) throw new AwardCalculationErrorV2("DUPLICATE_COMPONENT");
  const knownCodes = new Set(rule.components.map(component => component.code));
  if ([...providedCodes].some(code => !knownCodes.has(code))) throw new AwardCalculationErrorV2("UNKNOWN_COMPONENT");
  const eligible = rule.validCombinations.filter(combination => combination.componentCodes.every(code => providedCodes.has(code)));
  if (eligible.length === 0) throw new AwardCalculationErrorV2("NO_ELIGIBLE_COMBINATION");

  const results = eligible.map(combination => {
    const boundary = boundaries.find(item => item.routeId === rule.routeId
      && `${item.year}-${item.series}` === parsed.data.targetSeries
      && (combination.optionCode ? item.optionCode === combination.optionCode : !item.optionCode));
    if (!boundary) throw new AwardCalculationErrorV2("NO_MATCHING_BOUNDARY");
    return calculateQualificationAwardV2({
      ...parsed.data,
      combinationId: combination.combinationId,
      componentScores: parsed.data.componentScores.filter(score => combination.componentCodes.includes(score.componentCode)),
    }, rule, boundary);
  });
  const gradeRank = new Map(rule.gradeScale.map((grade, index) => [grade, index]));
  gradeRank.set("U", rule.gradeScale.length);
  results.sort((left, right) => (gradeRank.get(left.grade) ?? Number.POSITIVE_INFINITY) - (gradeRank.get(right.grade) ?? Number.POSITIVE_INFINITY)
    || right.totalAwardMark - left.totalAwardMark
    || left.combinationId.localeCompare(right.combinationId));
  return AwardSelectionResultV2Schema.parse({
    selected: results[0],
    consideredCombinationIds: results.map(result => result.combinationId).sort(),
    selectionMethod: "best-official-grade",
  });
}
