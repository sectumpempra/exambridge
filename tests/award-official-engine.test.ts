import { describe, expect, it } from "vitest";
import {
  AwardCalculationError,
  calculateOfficialAward,
  type AwardErrorCode,
} from "@/domain-v2/awards";
import { awardCatalog, createAwardCatalog } from "@/domain-v2/awards/catalog";
import aqaJson from "@/data/official/awards/aqa-7357.json";
import ocrJson from "@/data/official/awards/ocr-h240.json";
import pearson8ma0Json from "@/data/official/awards/pearson-8ma0.json";

const AQA_ROUTE_ID = "award:aqa:7357:linear";
const OCR_ROUTE_ID = "award:ocr:h240:linear";
const PEARSON_8MA0_ROUTE_ID = "award:pearson:8ma0:linear";

const score = (componentCode: string, rawScore: number, series = "2025-june", variant?: string) => ({
  componentCode,
  rawScore,
  series,
  ...(variant === undefined ? {} : { variant }),
});

const linearScores = (routeId: string, total: number, series: string) => {
  const route = awardCatalog.getAwardRoute(routeId);
  if (!route) throw new Error(`Missing test route ${routeId}`);
  let remaining = total;
  return route.components.map(component => {
    const rawScore = Math.min(component.maxRawMark, Math.max(0, remaining));
    remaining -= rawScore;
    return score(component.code, rawScore, series);
  });
};

const expectAwardError = (run: () => unknown, code: AwardErrorCode) => {
  try {
    run();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(AwardCalculationError);
    expect((error as AwardCalculationError).code).toBe(code);
    expect((error as Error).message).toBe(code);
  }
};

const thresholdCases = [...aqaJson.boundaries, ...ocrJson.boundaries, ...pearson8ma0Json.boundaries].flatMap(boundary => {
  const route = awardCatalog.getAwardRoute(boundary.routeId);
  if (!route) throw new Error(`Missing test route ${boundary.routeId}`);
  return route.grades.flatMap(publishedGrade => {
    const threshold = boundary.thresholds[publishedGrade as keyof typeof boundary.thresholds];
    return [-1, 0, 1].map(offset => {
      const total = threshold + offset;
      const expectedGrade = route.grades.find(grade =>
        total >= boundary.thresholds[grade as keyof typeof boundary.thresholds]) ?? "U";
      return {
        label: `${route.board} ${boundary.series} ${publishedGrade} threshold ${offset >= 0 ? "+" : ""}${offset}`,
        routeId: route.id,
        series: boundary.series,
        total,
        expectedGrade,
      };
    });
  });
});

describe("Official linear awards", () => {
  it.each([
    [259, "A"],
    [260, "A*"],
    [261, "A*"],
  ])("maps AQA 7357 June 2025 total %i to %s", (total, grade) => {
    const result = calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: linearScores(AQA_ROUTE_ID, total, "2025-june"),
    }, awardCatalog);

    expect(result).toMatchObject({
      source: "official",
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      total,
      maximumMarkAfterWeighting: 300,
      grade,
    });
  });

  it("uses the OCR H240 qualification-level Overall boundary", () => {
    const result = calculateOfficialAward({
      routeId: OCR_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: [score("H240/01", 82), score("H240/02", 80), score("H240/03", 80)],
    }, awardCatalog);

    expect(result).toMatchObject({ source: "official", total: 242, grade: "A*" });
  });

  it.each([
    [107, "B"],
    [108, "A"],
    [109, "A"],
  ])("maps Pearson 8MA0 June 2025 total %i to %s", (total, grade) => {
    const result = calculateOfficialAward({
      routeId: PEARSON_8MA0_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: linearScores(PEARSON_8MA0_ROUTE_ID, total, "2025-june"),
    }, awardCatalog);

    expect(result).toMatchObject({
      source: "official",
      routeId: PEARSON_8MA0_ROUTE_ID,
      total,
      maximumMarkAfterWeighting: 160,
      grade,
    });
  });

  it.each(thresholdCases)("maps $label through the explicit grade order", ({ routeId, series, total, expectedGrade }) => {
    const result = calculateOfficialAward({
      routeId,
      series,
      estimateConsent: false,
      scores: linearScores(routeId, total, series),
    }, awardCatalog);

    expect(result.grade).toBe(expectedGrade);
  });

  it.each([
    [AQA_ROUTE_ID, "2025-june", 70],
    [OCR_ROUTE_ID, "2025-june", 63],
    [PEARSON_8MA0_ROUTE_ID, "2025-june", 56],
  ])("maps %s totals below the lowest published threshold to U", (routeId, series, total) => {
    const result = calculateOfficialAward({
      routeId,
      series,
      estimateConsent: false,
      scores: linearScores(routeId, total, series),
    }, awardCatalog);

    expect(result.grade).toBe("U");
  });

  it("aggregates raw scores with each route component weighting factor", () => {
    const route = structuredClone(awardCatalog.getAwardRoute(AQA_ROUTE_ID)!);
    const boundary = structuredClone(aqaJson.boundaries.at(-1)!);
    route.components[0].weightingFactor = 2;
    route.components[1].weightingFactor = 0.5;
    route.components[2].weightingFactor = 0.5;
    const weightedCatalog = createAwardCatalog({
      routes: [route],
      officialBoundaries: [boundary],
      estimatedBoundaries: [],
    });

    const result = calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: [score("7357/1", 10), score("7357/2", 20), score("7357/3", 30)],
    }, weightedCatalog);

    expect(result).toMatchObject({ total: 45, maximumMarkAfterWeighting: 300 });
  });

  it("returns de-duplicated route and boundary provenance URLs", () => {
    const route = structuredClone(awardCatalog.getAwardRoute(AQA_ROUTE_ID)!);
    const boundary = structuredClone(aqaJson.boundaries.at(-1)!);
    boundary.sourceUrl = route.sourceUrl;
    const sameSourceCatalog = createAwardCatalog({
      routes: [route],
      officialBoundaries: [boundary],
      estimatedBoundaries: [],
    });

    const result = calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: linearScores(AQA_ROUTE_ID, 260, "2025-june"),
    }, sameSourceCatalog);

    expect(result.sourceUrls).toEqual([route.sourceUrl]);
  });

  it.each([
    {
      label: "a missing component",
      scores: [score("7357/1", 70), score("7357/2", 70)],
      code: "INCOMPLETE_ROUTE",
    },
    {
      label: "a duplicate component",
      scores: [score("7357/1", 70), score("7357/1", 70), score("7357/3", 70)],
      code: "DUPLICATE_COMPONENT",
    },
    {
      label: "a cross-series score",
      scores: [score("7357/1", 70), score("7357/2", 70, "2024-june"), score("7357/3", 70)],
      code: "CROSS_SERIES",
    },
    {
      label: "an unknown component",
      scores: [score("7357/1", 70), score("7357/2", 70), score("7357/4", 70)],
      code: "UNKNOWN_COMPONENT",
    },
    {
      label: "a score over the component maximum",
      scores: [score("7357/1", 101), score("7357/2", 70), score("7357/3", 70)],
      code: "SCORE_OUT_OF_RANGE",
    },
    {
      label: "a negative score rejected by the schema",
      scores: [score("7357/1", -1), score("7357/2", 70), score("7357/3", 70)],
      code: "SCORE_OUT_OF_RANGE",
    },
    {
      label: "NaN rejected by the schema",
      scores: [score("7357/1", Number.NaN), score("7357/2", 70), score("7357/3", 70)],
      code: "SCORE_OUT_OF_RANGE",
    },
    {
      label: "Infinity rejected by the schema",
      scores: [score("7357/1", Number.POSITIVE_INFINITY), score("7357/2", 70), score("7357/3", 70)],
      code: "SCORE_OUT_OF_RANGE",
    },
  ] satisfies Array<{ label: string; scores: ReturnType<typeof score>[]; code: AwardErrorCode }>)
  ("rejects $label with $code", ({ scores, code }) => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores,
    }, awardCatalog), code);
  });

  it("rejects an unknown route", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: "award:missing",
      series: "2025-june",
      estimateConsent: false,
      scores: [score("missing", 1)],
    }, awardCatalog), "UNKNOWN_ROUTE");
  });

  it("rejects an invalid non-score input without leaking a Zod error", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "June 2025",
      estimateConsent: false,
      scores: [score("7357/1", 1)],
    }, awardCatalog), "INVALID_INPUT");
  });

  it("rejects an option on an optionless linear route", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      optionCode: "AX",
      estimateConsent: false,
      scores: linearScores(AQA_ROUTE_ID, 260, "2025-june"),
    }, awardCatalog), "OPTION_MISMATCH");
  });

  it("rejects a non-exact component variant", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: [score("7357/1", 100, "2025-june", "1"), score("7357/2", 80), score("7357/3", 80)],
    }, awardCatalog), "VARIANT_MISMATCH");
  });

  it("preserves CROSS_SERIES precedence over a wrong AQA variant", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: [
        score("7357/1", 100),
        score("7357/2", 80, "2024-june", "wrong"),
        score("7357/3", 80),
      ],
    }, awardCatalog), "CROSS_SERIES");
  });

  it("preserves DUPLICATE_COMPONENT precedence over a wrong AQA variant", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: [
        score("7357/1", 100),
        score("7357/1", 80, "2025-june", "wrong"),
        score("7357/3", 80),
      ],
    }, awardCatalog), "DUPLICATE_COMPONENT");
  });

  it("preserves an earlier AQA VARIANT_MISMATCH before a later duplicate", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: [
        score("7357/1", 70, "2025-june", "wrong"),
        score("7357/1", 70),
        score("7357/3", 70),
      ],
    }, awardCatalog), "VARIANT_MISMATCH");
  });

  it("preserves an earlier AQA UNKNOWN_COMPONENT before a later cross-series score", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: [
        score("7357/4", 70),
        score("7357/2", 70, "2024-june"),
        score("7357/3", 70),
      ],
    }, awardCatalog), "UNKNOWN_COMPONENT");
  });

  it("rejects a missing exact official boundary without consulting estimates", () => {
    const officialOnlyCatalog = {
      ...awardCatalog,
      findEstimatedBoundary: () => {
        throw new Error("estimated data must not be consulted");
      },
    };

    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2026-june",
      estimateConsent: true,
      scores: linearScores(AQA_ROUTE_ID, 260, "2026-june"),
    }, officialOnlyCatalog), "MISSING_BOUNDARY");
  });

  it("rejects an AQA component/notional row even when its exact key matches", () => {
    const route = structuredClone(awardCatalog.getAwardRoute(AQA_ROUTE_ID)!);
    const boundary = structuredClone(aqaJson.boundaries.at(-1)!);
    boundary.sourceRowId = "AQA-2025-JUNE-7357-COMPONENT";
    const notionalCatalog = createAwardCatalog({
      routes: [route],
      officialBoundaries: [boundary],
      estimatedBoundaries: [],
    });

    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: linearScores(AQA_ROUTE_ID, 260, "2025-june"),
    }, notionalCatalog), "MISSING_BOUNDARY");
  });

  it("normalizes unexpected dependency failures without exposing internal text", () => {
    const failingCatalog = {
      ...awardCatalog,
      getAwardRoute: () => {
        throw new Error("sensitive catalog detail");
      },
    };

    expectAwardError(() => calculateOfficialAward({
      routeId: AQA_ROUTE_ID,
      series: "2025-june",
      estimateConsent: false,
      scores: linearScores(AQA_ROUTE_ID, 260, "2025-june"),
    }, failingCatalog), "INTERNAL_ERROR");
  });
});
