import {
  AwardCalculationError,
  componentVariantsForRoute,
  prepareAwardCalculation,
  roundAwardTotal,
  type AwardCatalog,
} from "./official-engine";
import type { AwardCalculationResult, EstimatedAwardBoundary } from "./schema";

export const ESTIMATE_WARNING = "此结果基于历史整体分数线的统计预估，不是考试局正式成绩或官方分数线。";

const hasEstimateConsent = (inputValue: unknown): boolean =>
  typeof inputValue === "object" && inputValue !== null &&
  (inputValue as { estimateConsent?: unknown }).estimateConsent === true;

const mapEstimateGrade = (
  total: number,
  boundary: EstimatedAwardBoundary,
  gradeOrder: string[],
  threshold: "centre" | "lower" | "upper",
): string => gradeOrder.find(grade => total >= boundary.thresholds[grade][threshold]) ?? "U";

const calculateEstimate = (inputValue: unknown, catalog: AwardCatalog): AwardCalculationResult => {
  if (!hasEstimateConsent(inputValue)) throw new AwardCalculationError("ESTIMATE_CONSENT_REQUIRED");

  const prepared = prepareAwardCalculation(inputValue, catalog);
  const { input, route } = prepared;
  const boundary = catalog.findEstimatedBoundary({
    routeId: route.id,
    series: input.series,
    optionCode: input.optionCode,
    componentVariants: prepared.componentVariants,
  });
  if (!boundary) throw new AwardCalculationError("MISSING_ESTIMATE");
  const total = roundAwardTotal(prepared.weightedTotal, route.roundingRule);

  const sampleSeries = new Set(boundary.sampleSeries);
  const sampleSources = catalog.officialBoundaries.filter(sample =>
    sample.routeId === route.id && sampleSeries.has(sample.series) &&
    (sample.optionCode ?? "") === (route.optionCode ?? "") &&
    [...sample.componentVariants].sort().join("|") === [...componentVariantsForRoute(route)].sort().join("|"));

  return {
    source: "estimated",
    routeId: route.id,
    series: input.series,
    ...(input.optionCode === undefined ? {} : { optionCode: input.optionCode }),
    total,
    maximumMarkAfterWeighting: route.maximumMarkAfterWeighting,
    grade: mapEstimateGrade(total, boundary, route.grades, "centre"),
    gradeRange: [
      mapEstimateGrade(total, boundary, route.grades, "lower"),
      mapEstimateGrade(total, boundary, route.grades, "upper"),
    ],
    confidence: boundary.confidence,
    sampleSeries: boundary.sampleSeries,
    methodVersion: boundary.methodVersion,
    warning: ESTIMATE_WARNING,
    sourceUrls: [...new Set([
      route.sourceUrl,
      ...route.supportingSources.map(source => source.sourceUrl),
      ...sampleSources.map(source => source.sourceUrl),
    ])],
  };
};

export function calculateEstimatedAward(inputValue: unknown, catalog: AwardCatalog): AwardCalculationResult {
  try {
    return calculateEstimate(inputValue, catalog);
  } catch (error) {
    if (error instanceof AwardCalculationError) throw error;
    throw new AwardCalculationError("INTERNAL_ERROR");
  }
}
