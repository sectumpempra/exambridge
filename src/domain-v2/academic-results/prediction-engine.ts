import {
  BoundaryPredictionV1Schema,
  GradeBoundaryV2Schema,
  type BoundaryPredictionV1,
  type GradeBoundaryV2,
} from "./schema";

export const BOUNDARY_PREDICTION_DISCLAIMER_VERSION = "exambridge-boundary-prediction-disclaimer-v1";

export type BoundaryPredictionRequestV1 = {
  qualificationVersionId: string;
  awardQualificationId: string;
  routeId: string;
  targetYear: number;
  targetSeries: GradeBoundaryV2["series"];
  dataCutoff: string;
  tier?: string;
  optionCode?: string;
  disclaimerAccepted: boolean;
  disclaimerVersion?: string;
};

export class BoundaryPredictionErrorV1 extends Error {
  constructor(public readonly code: "CONSENT_REQUIRED" | "INSUFFICIENT_SAMPLES" | "INCOMPATIBLE_SAMPLES") {
    super(code);
    this.name = "BoundaryPredictionErrorV1";
  }
}

const seriesOrder: Record<GradeBoundaryV2["series"], number> = {
  january: 1,
  march: 3,
  june: 6,
  november: 11,
  other: 12,
};

const seriesKey = (boundary: GradeBoundaryV2) => boundary.year * 100 + seriesOrder[boundary.series];

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const weightedMedian = (samples: Array<{ value: number; weight: number }>) => {
  const ordered = [...samples].sort((a, b) => a.value - b.value);
  const total = ordered.reduce((sum, sample) => sum + sample.weight, 0);
  let cumulative = 0;
  for (const sample of ordered) {
    cumulative += sample.weight;
    if (cumulative >= total / 2) return sample.value;
  }
  return ordered.at(-1)?.value ?? 0;
};

export function predictGradeBoundaryV1(
  request: BoundaryPredictionRequestV1,
  boundaryValues: unknown[],
): BoundaryPredictionV1 {
  if (!request.disclaimerAccepted || request.disclaimerVersion !== BOUNDARY_PREDICTION_DISCLAIMER_VERSION) {
    throw new BoundaryPredictionErrorV1("CONSENT_REQUIRED");
  }
  const targetKey = request.targetYear * 100 + seriesOrder[request.targetSeries];
  const eligible = boundaryValues
    .map(value => GradeBoundaryV2Schema.parse(value))
    .filter(boundary => boundary.verificationStatus === "owner-approved")
    .filter(boundary => boundary.publicationStatus === "final")
    .filter(boundary => boundary.boundaryScope === "overall")
    .filter(boundary => boundary.qualificationVersionId === request.qualificationVersionId)
    .filter(boundary => boundary.awardQualificationId === request.awardQualificationId)
    .filter(boundary => boundary.routeId === request.routeId)
    .filter(boundary => boundary.tier === request.tier)
    .filter(boundary => boundary.optionCode === request.optionCode)
    .filter(boundary => seriesKey(boundary) < targetKey)
    .sort((a, b) => seriesKey(b) - seriesKey(a));

  if (eligible.length < 3) throw new BoundaryPredictionErrorV1("INSUFFICIENT_SAMPLES");
  const maximumMark = eligible[0].maximumMark;
  const gradeOrder = eligible[0].gradeOrder;
  const compatible = eligible.filter(boundary =>
    boundary.maximumMark === maximumMark
    && JSON.stringify(boundary.gradeOrder) === JSON.stringify(gradeOrder),
  ).slice(0, 5);
  if (compatible.length < 3 || maximumMark === null) throw new BoundaryPredictionErrorV1("INCOMPATIBLE_SAMPLES");

  const predictedThresholds: Record<string, number | null> = {};
  const intervals: Record<string, [number, number]> = {};
  for (const grade of gradeOrder) {
    const values = compatible
      .map((boundary, index) => ({ value: boundary.thresholds[grade], weight: compatible.length - index }))
      .filter((sample): sample is { value: number; weight: number } => sample.value !== null && sample.value !== undefined);
    if (values.length < 3) {
      predictedThresholds[grade] = null;
      continue;
    }
    const predicted = Math.round(weightedMedian(values));
    const deviations = values.map(sample => Math.abs(sample.value - median(values.map(item => item.value))));
    const spread = Math.max(2, Math.ceil(1.5 * median(deviations)));
    predictedThresholds[grade] = predicted;
    intervals[grade] = [Math.max(0, predicted - spread), Math.min(maximumMark, predicted + spread)];
  }

  const targetLabel = `${request.targetYear}-${request.targetSeries}`;
  return BoundaryPredictionV1Schema.parse({
    schemaVersion: "1.0.0",
    predictionId: `prediction:${request.awardQualificationId}:${request.routeId}:${targetLabel}`,
    qualificationVersionId: request.qualificationVersionId,
    awardQualificationId: request.awardQualificationId,
    routeId: request.routeId,
    ...(request.tier ? { tier: request.tier } : {}),
    ...(request.optionCode ? { optionCode: request.optionCode } : {}),
    targetYear: request.targetYear,
    targetSeries: request.targetSeries,
    maximumMark,
    gradeOrder,
    predictedThresholds,
    intervals,
    sampleBoundaryIds: compatible.map(boundary => boundary.boundaryId),
    sampleSeries: compatible.map(boundary => `${boundary.year}-${boundary.series}`),
    dataCutoff: request.dataCutoff,
    methodVersion: "exambridge-boundary-prediction-v1",
    confidence: compatible.length === 5 ? "high" : compatible.length === 4 ? "medium" : "low",
    disclaimerVersion: BOUNDARY_PREDICTION_DISCLAIMER_VERSION,
    verificationStatus: "candidate",
  });
}
