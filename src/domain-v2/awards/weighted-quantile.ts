export type WeightedSample = { value: number; weight: number };

export function weightedQuantile(
  samples: WeightedSample[],
  q: 0.25 | 0.5 | 0.75,
): number {
  if (q !== 0.25 && q !== 0.5 && q !== 0.75) {
    throw new Error("INVALID_QUANTILE");
  }
  if (samples.length === 0 || samples.some(sample =>
    !Number.isFinite(sample.value) || !Number.isFinite(sample.weight) || sample.weight <= 0)) {
    throw new Error("INVALID_WEIGHTED_SAMPLES");
  }

  const ordered = [...samples].sort((a, b) => a.value - b.value || a.weight - b.weight);
  const target = ordered.reduce((sum, sample) => sum + sample.weight, 0) * q;
  let cumulative = 0;
  for (const sample of ordered) {
    cumulative += sample.weight;
    if (cumulative >= target) return sample.value;
  }
  return ordered[ordered.length - 1].value;
}
