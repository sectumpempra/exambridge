import type {
  EstimatedAwardBoundary,
  OfficialAwardBoundary,
  OfficialAwardRoute,
} from "./schema.ts";
import { weightedQuantile } from "./weighted-quantile.ts";

export const ESTIMATE_METHOD_VERSION = "historical-weighted-median-v1" as const;

export type EstimateBand = { centre: number; lower: number; upper: number };
export type EstimateBands = Record<string, EstimateBand>;
export type EstimatedAwardBoundaryDraft = Omit<EstimatedAwardBoundary, "inputManifestHash" | "contentHash">;
export type GenerateEstimatedBoundaryInput = {
  route: OfficialAwardRoute;
  targetSeries: string;
  samples: OfficialAwardBoundary[];
  dataAsOf: string;
};

const SEASON_ORDER: Record<string, number> = { march: 0, june: 1, november: 2 };

const parseSeries = (series: string): { year: number; season: string; order: number } => {
  const match = /^(\d{4})-(march|june|november)$/.exec(series);
  if (!match) throw new Error("INVALID_SERIES");
  return { year: Number(match[1]), season: match[2], order: SEASON_ORDER[match[2]] };
};

const compareSeries = (left: string, right: string): number => {
  const a = parseSeries(left);
  const b = parseSeries(right);
  return a.year - b.year || a.order - b.order || left.localeCompare(right);
};

const expectedVariants = (route: OfficialAwardRoute): string[] => route.components.map(component => {
  if (route.board !== "CAIE") return component.code;
  return component.code.slice(component.code.lastIndexOf("/") + 1);
}).sort();

const sameStrings = (actual: string[], expected: string[]): boolean => {
  const ordered = [...actual].sort();
  const expectedOrdered = [...expected].sort();
  return new Set(ordered).size === ordered.length && ordered.length === expectedOrdered.length &&
    ordered.every((value, index) => value === expectedOrdered[index]);
};

const isQualificationLevelBoundary = (sample: OfficialAwardBoundary, route: OfficialAwardRoute): boolean =>
  route.board === "CAIE" || (sample.sourceRowId.endsWith("OVERALL") && sample.maximumMarkAfterWeighting === 300);

const isComparable = (sample: OfficialAwardBoundary, route: OfficialAwardRoute): boolean => {
  const grades = Object.keys(sample.thresholds);
  const values = route.grades.map(grade => sample.thresholds[grade]);
  return sample.source === "official" && sample.verificationStatus === "verified" &&
    sample.routeId === route.id &&
    (sample.optionCode ?? "") === (route.optionCode ?? "") &&
    sameStrings(sample.componentVariants, expectedVariants(route)) &&
    sample.maximumMarkAfterWeighting === route.maximumMarkAfterWeighting &&
    grades.length === route.grades.length && sameStrings(grades, route.grades) &&
    values.every((value, index) => Number.isFinite(value) && value >= 0 &&
      value <= sample.maximumMarkAfterWeighting && (index === 0 || value <= values[index - 1])) &&
    isQualificationLevelBoundary(sample, route);
};

export function collectComparableSamples(
  route: OfficialAwardRoute,
  targetSeries: string,
  boundaries: OfficialAwardBoundary[],
): OfficialAwardBoundary[] {
  return boundaries.filter(sample =>
    isComparable(sample, route) && compareSeries(sample.series, targetSeries) < 0);
}

export function assertEstimateMonotonicity(
  bands: EstimateBands,
  gradeOrder: string[],
  maximumMark: number,
): void {
  let previous: EstimateBand | undefined;
  for (const grade of gradeOrder) {
    const band = bands[grade];
    if (!band || ![band.lower, band.centre, band.upper].every(Number.isFinite) ||
      band.lower < 0 || band.upper > maximumMark || band.lower > band.centre || band.centre > band.upper) {
      throw new Error("ESTIMATE_OUT_OF_RANGE");
    }
    if (previous && (band.lower > previous.lower || band.centre > previous.centre || band.upper > previous.upper)) {
      throw new Error("NON_MONOTONIC_ESTIMATE");
    }
    previous = band;
  }
}

export function generateEstimatedBoundary(
  input: GenerateEstimatedBoundaryInput,
): EstimatedAwardBoundaryDraft {
  const target = parseSeries(input.targetSeries);
  const seenSeries = new Set<string>();
  for (const sample of input.samples) {
    if (sample.series === input.targetSeries) throw new Error("OFFICIAL_TARGET_EXISTS");
    if (compareSeries(sample.series, input.targetSeries) > 0) throw new Error("FUTURE_SAMPLE");
    if (seenSeries.has(sample.series) || !isComparable(sample, input.route)) {
      throw new Error("INCOMPARABLE_SAMPLE");
    }
    seenSeries.add(sample.series);
  }

  const selected = [...input.samples]
    .sort((a, b) => compareSeries(b.series, a.series) || a.sourceRowId.localeCompare(b.sourceRowId))
    .slice(0, 5);
  if (selected.length < 3) throw new Error("INSUFFICIENT_SAMPLES");

  const thresholds: EstimateBands = {};
  const iqrMarks: number[] = [];
  for (const grade of input.route.grades) {
    const values = selected.map((sample, index) => ({
      value: sample.thresholds[grade] / sample.maximumMarkAfterWeighting,
      weight: selected.length - index,
      mark: sample.thresholds[grade],
    }));
    const selectedMark = (q: 0.25 | 0.5 | 0.75): number => {
      const normalized = weightedQuantile(values, q);
      return values.find(sample => sample.value === normalized)!.mark;
    };
    const lower = selectedMark(0.25);
    const centre = selectedMark(0.5);
    const upper = selectedMark(0.75);
    iqrMarks.push(upper - lower);
    thresholds[grade] = {
      centre: Math.round(centre),
      lower: Math.floor(lower),
      upper: Math.ceil(upper),
    };
  }
  assertEstimateMonotonicity(thresholds, input.route.grades, input.route.maximumMarkAfterWeighting);

  const sameSeason = selected.every(sample => parseSeries(sample.series).season === target.season);
  const everyIqrAtMostPercent = (percent: number) => iqrMarks.every(iqr =>
    iqr * 100 <= input.route.maximumMarkAfterWeighting * percent);
  const confidence = selected.length === 5 && sameSeason && everyIqrAtMostPercent(3)
    ? "high"
    : selected.length >= 3 && sameSeason && everyIqrAtMostPercent(6)
      ? "medium"
      : "low";

  return {
    source: "estimated",
    methodVersion: ESTIMATE_METHOD_VERSION,
    routeId: input.route.id,
    targetSeries: input.targetSeries,
    ...(input.route.optionCode === undefined ? {} : { optionCode: input.route.optionCode }),
    componentVariants: expectedVariants(input.route),
    maximumMarkAfterWeighting: input.route.maximumMarkAfterWeighting,
    sampleSeries: selected.map(sample => sample.series),
    sampleSize: selected.length,
    thresholds,
    confidence,
    dataAsOf: input.dataAsOf,
    isOfficial: false,
  };
}
