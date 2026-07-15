import type { createAwardCatalog } from "./catalog";
import {
  AwardCalculationInputSchema,
  type AwardCalculationInput,
  type AwardCalculationResult,
  type OfficialAwardBoundary,
  type OfficialAwardRoute,
} from "./schema";

export type AwardErrorCode =
  | "INVALID_INPUT"
  | "UNKNOWN_ROUTE"
  | "UNSUPPORTED_ROUTE"
  | "INCOMPLETE_ROUTE"
  | "DUPLICATE_COMPONENT"
  | "UNKNOWN_COMPONENT"
  | "CROSS_SERIES"
  | "SCORE_OUT_OF_RANGE"
  | "OPTION_MISMATCH"
  | "VARIANT_MISMATCH"
  | "MISSING_BOUNDARY"
  | "MISSING_ESTIMATE"
  | "ESTIMATE_CONSENT_REQUIRED"
  | "CARRY_FORWARD_REQUIRED"
  | "INTERNAL_ERROR";

export class AwardCalculationError extends Error {
  constructor(public readonly code: AwardErrorCode) {
    super(code);
    this.name = "AwardCalculationError";
  }
}

export type AwardCatalog = ReturnType<typeof createAwardCatalog>;

const SUPPORTED_CAIE_ROUTE_IDS = new Set([
  "award:caie:9709:2023-2025:as:S1",
  "award:caie:9709:2023-2025:al:same-series:AX",
  "award:caie:9709:2023-2025:al:staged:DX",
]);

const parseInput = (inputValue: unknown): AwardCalculationInput => {
  const parsed = AwardCalculationInputSchema.safeParse(inputValue);
  if (parsed.success) return parsed.data;

  const hasRawScoreIssue = parsed.error.issues.some(issue =>
    issue.path[0] === "scores" && issue.path.includes("rawScore"));
  throw new AwardCalculationError(hasRawScoreIssue ? "SCORE_OUT_OF_RANGE" : "INVALID_INPUT");
};

const validateSupportedRoute = (route: OfficialAwardRoute) => {
  const isLinear = (route.board === "AQA" || route.board === "OCR") && route.routeType === "linear";
  const isVerifiedCaie = route.board === "CAIE" && SUPPORTED_CAIE_ROUTE_IDS.has(route.id) &&
    (route.routeType === "same-series" || route.routeType === "staged");
  if (!isLinear && !isVerifiedCaie) throw new AwardCalculationError("UNSUPPORTED_ROUTE");
};

const validateOption = (input: AwardCalculationInput, route: OfficialAwardRoute) => {
  if ((input.optionCode ?? "") !== (route.optionCode ?? "")) {
    throw new AwardCalculationError("OPTION_MISMATCH");
  }
};

const componentSuffix = (componentCode: string) =>
  componentCode.slice(componentCode.lastIndexOf("/") + 1);

export const componentVariantsForRoute = (route: OfficialAwardRoute): string[] =>
  route.components.map(component => route.board === "CAIE" ? componentSuffix(component.code) : component.code);

const validateVariants = (input: AwardCalculationInput, route: OfficialAwardRoute) => {
  if (route.board !== "CAIE") return;

  for (const score of input.scores) {
    if (score.variant === undefined || score.variant !== componentSuffix(score.componentCode)) {
      throw new AwardCalculationError("VARIANT_MISMATCH");
    }
  }
};

const validateScores = (input: AwardCalculationInput, route: OfficialAwardRoute) => {
  const expected = new Map(route.components.map(component => [component.code, component]));
  const seen = new Set<string>();

  if (route.board !== "CAIE") {
    for (const score of input.scores) {
      if (score.series !== input.series) throw new AwardCalculationError("CROSS_SERIES");
      if (seen.has(score.componentCode)) throw new AwardCalculationError("DUPLICATE_COMPONENT");
      seen.add(score.componentCode);

      const component = expected.get(score.componentCode);
      if (!component) throw new AwardCalculationError("UNKNOWN_COMPONENT");
      if (score.variant !== undefined && score.variant !== component.code) {
        throw new AwardCalculationError("VARIANT_MISMATCH");
      }
      if (!Number.isFinite(score.rawScore) || !Number.isInteger(score.rawScore) ||
        score.rawScore < 0 || score.rawScore > component.maxRawMark) {
        throw new AwardCalculationError("SCORE_OUT_OF_RANGE");
      }
      if (score.inputKind !== component.inputKind) throw new AwardCalculationError("INVALID_INPUT");
    }

    if (seen.size !== expected.size || [...expected.keys()].some(code => !seen.has(code))) {
      throw new AwardCalculationError("INCOMPLETE_ROUTE");
    }
    return;
  }

  for (const score of input.scores) {
    if (score.series !== input.series) throw new AwardCalculationError("CROSS_SERIES");
    if (seen.has(score.componentCode)) throw new AwardCalculationError("DUPLICATE_COMPONENT");
    seen.add(score.componentCode);
  }

  const carriedForwardComponent = route.components.find(component => component.inputKind === "carried-forward");
  if (carriedForwardComponent && !seen.has(carriedForwardComponent.code)) {
    throw new AwardCalculationError("CARRY_FORWARD_REQUIRED");
  }

  for (const score of input.scores) {
    const component = expected.get(score.componentCode);
    if (!component) throw new AwardCalculationError("UNKNOWN_COMPONENT");
    if (!Number.isFinite(score.rawScore) || !Number.isInteger(score.rawScore) ||
      score.rawScore < 0 || score.rawScore > component.maxRawMark) {
      throw new AwardCalculationError("SCORE_OUT_OF_RANGE");
    }
    if (score.inputKind !== component.inputKind) {
      throw new AwardCalculationError(component.inputKind === "carried-forward"
        ? "CARRY_FORWARD_REQUIRED"
        : "INVALID_INPUT");
    }
  }

  if (seen.size !== expected.size || [...expected.keys()].some(code => !seen.has(code))) {
    throw new AwardCalculationError("INCOMPLETE_ROUTE");
  }
};

const mapGrade = (total: number, boundary: OfficialAwardBoundary, gradeOrder: string[]) =>
  gradeOrder.find(grade => total >= boundary.thresholds[grade]) ?? "U";

export const roundAwardTotal = (value: number, rule: OfficialAwardRoute["roundingRule"]) => {
  if (rule === "none") return value;
  if (rule === "nearest-integer") return Math.round(value);
  if (rule === "official-carry-forward" && Number.isInteger(value)) return value;
  throw new AwardCalculationError("CARRY_FORWARD_REQUIRED");
};

export type PreparedAwardCalculation = {
  input: AwardCalculationInput;
  route: OfficialAwardRoute;
  weightedTotal: number;
  componentVariants: string[];
};

export const prepareAwardCalculation = (
  inputValue: unknown,
  catalog: AwardCatalog,
): PreparedAwardCalculation => {
  const input = parseInput(inputValue);
  const route = catalog.getAwardRoute(input.routeId);
  if (!route) throw new AwardCalculationError("UNKNOWN_ROUTE");

  validateOption(input, route);
  validateSupportedRoute(route);
  validateVariants(input, route);
  validateScores(input, route);

  const componentByCode = new Map(route.components.map(component => [component.code, component]));
  const weightedTotal = input.scores.reduce((sum, score) =>
    sum + score.rawScore * componentByCode.get(score.componentCode)!.weightingFactor, 0);
  return {
    input,
    route,
    weightedTotal,
    componentVariants: componentVariantsForRoute(route),
  };
};

const calculateAward = (inputValue: unknown, catalog: AwardCatalog): AwardCalculationResult => {
  const prepared = prepareAwardCalculation(inputValue, catalog);
  const { input, route } = prepared;

  const boundary = catalog.findOfficialBoundary({
    routeId: route.id,
    series: input.series,
    optionCode: input.optionCode,
    componentVariants: prepared.componentVariants,
  });
  if (!boundary) throw new AwardCalculationError("MISSING_BOUNDARY");
  if (route.board !== "CAIE" &&
    (!boundary.sourceRowId.endsWith("OVERALL") || boundary.maximumMarkAfterWeighting !== 300)) {
    throw new AwardCalculationError("MISSING_BOUNDARY");
  }
  const total = roundAwardTotal(prepared.weightedTotal, route.roundingRule);

  return {
    source: "official",
    routeId: route.id,
    series: input.series,
    ...(input.optionCode === undefined ? {} : { optionCode: input.optionCode }),
    total,
    maximumMarkAfterWeighting: route.maximumMarkAfterWeighting,
    grade: mapGrade(total, boundary, route.grades),
    sourceUrls: [...new Set([
      route.sourceUrl,
      ...route.supportingSources.map(source => source.sourceUrl),
      boundary.sourceUrl,
    ])],
  };
};

export function calculateOfficialAward(inputValue: unknown, catalog: AwardCatalog): AwardCalculationResult {
  try {
    return calculateAward(inputValue, catalog);
  } catch (error) {
    if (error instanceof AwardCalculationError) throw error;
    throw new AwardCalculationError("INTERNAL_ERROR");
  }
}
