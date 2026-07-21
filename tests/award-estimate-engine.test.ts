import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { awardCatalog, createAwardCatalog } from "@/domain-v2/awards/catalog";
import {
  assertEstimateMonotonicity,
  generateEstimatedBoundary,
} from "@/domain-v2/awards/estimate-core";
import {
  ESTIMATE_WARNING,
  calculateEstimatedAward,
} from "@/domain-v2/awards/estimate-engine";
import {
  AwardCalculationError,
  calculateOfficialAward,
} from "@/domain-v2/awards/official-engine";
import { weightedQuantile } from "@/domain-v2/awards/weighted-quantile";
import routesJson from "@/data/official/awards/routes.json";
import aqaJson from "@/data/official/awards/aqa-7357.json";
import ocrJson from "@/data/official/awards/ocr-h240.json";
import caieJson from "@/data/official/awards/caie-9709.json";
import estimatesJson from "../generated/estimates/award-boundaries-v1.json";
import {
  buildAwardEstimateArtifact,
  canonicalStringify,
} from "../scripts/build-award-estimates.mjs";

const aqaRoute = awardCatalog.getAwardRoute("award:aqa:7357:linear")!;
const aqaSamples = awardCatalog.officialBoundaries.filter(boundary => boundary.routeId === aqaRoute.id);
const bySeries = (series: string) => aqaSamples.find(boundary => boundary.series === series)!;
const aqa2021 = bySeries("2021-november");
const aqa2022 = bySeries("2022-june");
const aqa2023 = bySeries("2023-june");
const aqa2024 = bySeries("2024-june");
const aqa2025 = bySeries("2025-june");
const target = { targetSeries: "2026-june", dataAsOf: "2025-08-14" };

const estimateInput = (samples = [aqa2021, aqa2022, aqa2023, aqa2024, aqa2025]) => ({
  route: aqaRoute,
  ...target,
  samples,
});

const samplesWithTopGradeMarks = (marks: number[]) => marks.map((mark, index) => ({
  ...aqa2025,
  series: `${2025 - index}-june`,
  thresholds: Object.fromEntries(aqaRoute.grades.map((grade, gradeIndex) =>
    [grade, mark - gradeIndex * 30])),
}));

const expectAwardError = (fn: () => unknown, code: string) => {
  let error: unknown;
  try { fn(); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(AwardCalculationError);
  expect((error as AwardCalculationError).code).toBe(code);
};

const scoreInput = (total: number, consent = true) => ({
  routeId: aqaRoute.id,
  series: "2026-june",
  scores: [
    { componentCode: "7357/1", series: "2026-june", rawScore: Math.min(total, 100), inputKind: "raw" },
    { componentCode: "7357/2", series: "2026-june", rawScore: Math.min(Math.max(total - 100, 0), 100), inputKind: "raw" },
    { componentCode: "7357/3", series: "2026-june", rawScore: Math.min(Math.max(total - 200, 0), 100), inputKind: "raw" },
  ],
  estimateConsent: consent,
});

describe("weightedQuantile", () => {
  it.each([[0.25, 0.70], [0.5, 0.72], [0.75, 0.74]] as const)(
    "uses the first cumulative weight at q=%s",
    (q, expected) => {
      expect(weightedQuantile([
        { value: 0.70, weight: 2 },
        { value: 0.72, weight: 2 },
        { value: 0.74, weight: 2 },
      ], q)).toBe(expected);
    },
  );

  it.each([
    [[], 0.5],
    [[{ value: Number.NaN, weight: 1 }], 0.5],
    [[{ value: 1, weight: 0 }], 0.5],
    [[{ value: 1, weight: Number.POSITIVE_INFINITY }], 0.5],
    [[{ value: 1, weight: 1 }], 0.4],
  ])("rejects invalid samples or q", (samples, q) => {
    expect(() => weightedQuantile(samples as never, q as never)).toThrow(/INVALID_(WEIGHTED_SAMPLES|QUANTILE)/);
  });
});

describe("historical-weighted-median-v1 core", () => {
  it("sorts newest first, keeps five, weights by recency, normalizes and rounds", () => {
    const estimate = generateEstimatedBoundary(estimateInput([
      bySeries("2019-june"), aqa2023, aqa2021, aqa2025, aqa2022, aqa2024,
    ]));
    expect(estimate.methodVersion).toBe("historical-weighted-median-v1");
    expect(estimate.sampleSeries).toEqual([
      "2025-june", "2024-june", "2023-june", "2022-june", "2021-november",
    ]);
    expect(estimate.sampleSize).toBe(5);
    expect(estimate.thresholds).toEqual({
      "A*": { centre: 259, lower: 248, upper: 260 },
      A: { centre: 221, lower: 201, upper: 222 },
      B: { centre: 183, lower: 163, upper: 184 },
      C: { centre: 145, lower: 125, upper: 147 },
      D: { centre: 108, lower: 87, upper: 110 },
      E: { centre: 71, lower: 49, upper: 73 },
    });
    expect(estimate.confidence).toBe("low");
  });

  it.each([
    ["INSUFFICIENT_SAMPLES", [aqa2023, aqa2024]],
    ["INCOMPARABLE_SAMPLE", [aqa2023, { ...aqa2024, routeId: "other" }, aqa2025]],
    ["INCOMPARABLE_SAMPLE", [aqa2023, { ...aqa2024, optionCode: "X" }, aqa2025]],
    ["INCOMPARABLE_SAMPLE", [aqa2023, { ...aqa2024, componentVariants: ["7357/1"] }, aqa2025]],
    ["INCOMPARABLE_SAMPLE", [aqa2023, { ...aqa2024, maximumMarkAfterWeighting: 299 }, aqa2025]],
    ["INCOMPARABLE_SAMPLE", [aqa2023, { ...aqa2024, thresholds: { ...aqa2024.thresholds, Z: 1 } }, aqa2025]],
    ["FUTURE_SAMPLE", [aqa2023, aqa2024, { ...aqa2025, series: "2027-june" }]],
    ["OFFICIAL_TARGET_EXISTS", [aqa2023, aqa2024, { ...aqa2025, series: "2026-june" }]],
  ])("rejects %s", (reason, samples) => {
    expect(() => generateEstimatedBoundary(estimateInput(samples))).toThrow(reason);
  });

  it("rejects non-monotonic and out-of-range generated bands without smoothing", () => {
    expect(() => assertEstimateMonotonicity({
      "A*": { centre: 220, lower: 215, upper: 225 },
      A: { centre: 230, lower: 220, upper: 235 },
    }, ["A*", "A"], 300)).toThrow("NON_MONOTONIC_ESTIMATE");
    expect(() => assertEstimateMonotonicity({
      "A*": { centre: 301, lower: 300, upper: 302 },
    }, ["A*"], 300)).toThrow("ESTIMATE_OUT_OF_RANGE");
  });

  it.each([
    ["high", [0.80, 0.79, 0.78, 0.77, 0.76]],
    ["medium", [0.80, 0.77, 0.74]],
    ["low", [0.80, 0.70, 0.60]],
  ] as const)("assigns %s confidence", (confidence, normalized) => {
    const samples = normalized.map((value, index) => ({
      ...aqa2025,
      series: `${2025 - index}-june`,
      thresholds: Object.fromEntries(aqaRoute.grades.map((grade, gradeIndex) =>
        [grade, Math.round((value - gradeIndex * 0.08) * 300)])),
    }));
    expect(generateEstimatedBoundary(estimateInput(samples)).confidence).toBe(confidence);
  });

  it("round-trips exact integer lower and upper quantiles at a 300-mark maximum", () => {
    const estimate = generateEstimatedBoundary(estimateInput(
      samplesWithTopGradeMarks([220, 225, 230, 230, 230]),
    ));

    expect(estimate.thresholds["A*"]).toEqual({ centre: 225, lower: 220, upper: 230 });
  });

  it.each([
    ["high", [231, 235, 240, 240, 240], "exactly 9/300"],
    ["medium", [220, 230, 230, 230, 230], "just above 9/300"],
    ["medium", [220, 238, 238], "exactly 18/300"],
    ["low", [220, 239, 239], "just above 18/300"],
  ] as const)("assigns %s confidence for %s (%s)", (confidence, marks, boundary) => {
    expect(generateEstimatedBoundary(estimateInput(
      samplesWithTopGradeMarks([...marks]),
    )).confidence, boundary).toBe(confidence);
  });
});

describe("deterministic estimate artifact", () => {
  const officialBoundaries = [...aqaJson.boundaries, ...ocrJson.boundaries, ...caieJson.boundaries];

  it("uses deterministic global, record, and array hashes", () => {
    const artifact = buildAwardEstimateArtifact({
      routes: routesJson.routes,
      officialBoundaries,
      targets: [target],
    });
    expect(artifact.boundaries).toHaveLength(2);
    const record = artifact.boundaries[0];
    const { contentHash, ...withoutRecordHash } = record;
    expect(contentHash).toBe(createHash("sha256").update(canonicalStringify(withoutRecordHash)).digest("hex"));
    expect(artifact.contentHash).toBe(createHash("sha256").update(canonicalStringify(artifact.boundaries)).digest("hex"));
    expect(record.inputManifestHash).toBe(artifact.inputManifestHash);
  });

  it("emits only sufficiently sourced 2026 June predictions and skips configured official collisions", () => {
    const artifact = buildAwardEstimateArtifact({
      routes: routesJson.routes,
      officialBoundaries,
      targets: [target, { targetSeries: "2025-june", dataAsOf: "2025-08-14" }],
    });
    expect(artifact.boundaries.map(boundary => `${boundary.routeId}|${boundary.targetSeries}`))
      .toEqual(["award:aqa:7357:linear|2026-june", "award:ocr:h240:linear|2026-june"]);
    expect(artifact.boundaries.some(boundary => /caie/i.test(boundary.routeId))).toBe(false);
  });

  it("runs twice byte-for-byte identically and matches the committed artifact", () => {
    const path = join(process.cwd(), "generated/estimates/award-boundaries-v1.json");
    execFileSync(process.execPath, ["scripts/build-award-estimates.mjs"], { cwd: process.cwd() });
    const first = readFileSync(path);
    execFileSync(process.execPath, ["scripts/build-award-estimates.mjs"], { cwd: process.cwd() });
    const second = readFileSync(path);
    expect(second.equals(first)).toBe(true);
    expect(JSON.parse(second.toString("utf8"))).toEqual(estimatesJson);
  });
});

describe("explicit runtime estimate engine", () => {
  it("requires explicit consent and exact estimate lookup", () => {
    expectAwardError(() => calculateEstimatedAward(scoreInput(200, false), awardCatalog), "ESTIMATE_CONSENT_REQUIRED");
    expectAwardError(() => calculateEstimatedAward({ ...scoreInput(200), series: "2027-june",
      scores: scoreInput(200).scores.map(score => ({ ...score, series: "2027-june" })) }, awardCatalog), "MISSING_ESTIMATE");
  });

  it("returns centre grade and best-to-worst lenient/strict range", () => {
    const result = calculateEstimatedAward(scoreInput(221), awardCatalog);
    expect(result).toMatchObject({
      source: "estimated",
      total: 221,
      grade: "A",
      gradeRange: ["A", "B"],
      confidence: "low",
      methodVersion: "historical-weighted-median-v1",
      warning: ESTIMATE_WARNING,
    });
  });

  it("preserves sample series, warning, and de-duplicated provenance", () => {
    const result = calculateEstimatedAward(scoreInput(221), awardCatalog);
    expect(result.sampleSeries).toEqual(["2025-june", "2024-june", "2023-june", "2022-june", "2021-november"]);
    expect(result.warning).toBe("此结果基于历史整体分数线的统计预估，不是考试局正式成绩或官方分数线。");
    expect(result.sourceUrls.length).toBe(new Set(result.sourceUrls).size);
    expect(result.sourceUrls).toContain(aqaRoute.sourceUrl);
    expect(result.sourceUrls).toContain(aqa2025.sourceUrl);
  });

  it.each([
    ["UNKNOWN_ROUTE", { ...scoreInput(100), routeId: "missing" }],
    ["SCORE_OUT_OF_RANGE", { ...scoreInput(100), scores: [{ ...scoreInput(100).scores[0], rawScore: 101 }, ...scoreInput(100).scores.slice(1)] }],
    ["INCOMPLETE_ROUTE", { ...scoreInput(100), scores: scoreInput(100).scores.slice(0, 2) }],
  ])("retains stable Award error %s", (code, input) => {
    expectAwardError(() => calculateEstimatedAward(input, awardCatalog), code);
  });

  it("does not change AQA, OCR, or CAIE official calculations", () => {
    for (const boundary of [aqa2025, ocrJson.boundaries[0], caieJson.boundaries[0]]) {
      const route = awardCatalog.getAwardRoute(boundary.routeId)!;
      const scores = route.components.map(component => ({
        componentCode: component.code,
        ...(route.board === "CAIE" ? { variant: component.code.split("/").at(-1) } : {}),
        series: boundary.series,
        rawScore: 0,
        inputKind: component.inputKind,
      }));
      expect(calculateOfficialAward({
        routeId: route.id,
        series: boundary.series,
        ...(route.optionCode ? { optionCode: route.optionCode } : {}),
        scores,
        estimateConsent: false,
      }, awardCatalog).grade).toBe("U");
    }
  });

  it("wraps malformed catalog failures instead of leaking internal errors", () => {
    const malformed = createAwardCatalog({
      routes: routesJson.routes,
      officialBoundaries: [...aqaJson.boundaries, ...ocrJson.boundaries, ...caieJson.boundaries],
      estimatedBoundaries: estimatesJson.boundaries,
    });
    const broken = { ...malformed, findEstimatedBoundary: () => { throw new Error("zod/internal"); } };
    expectAwardError(() => calculateEstimatedAward(scoreInput(100), broken), "INTERNAL_ERROR");
  });
});
