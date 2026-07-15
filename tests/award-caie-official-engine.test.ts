import { describe, expect, it } from "vitest";
import {
  AwardCalculationError,
  calculateOfficialAward,
  type AwardErrorCode,
} from "@/domain-v2/awards";
import { awardCatalog, createAwardCatalog } from "@/domain-v2/awards/catalog";
import caieJson from "@/data/official/awards/caie-9709.json";

const S1_ROUTE_ID = "award:caie:9709:2023-2025:as:S1";
const AX_ROUTE_ID = "award:caie:9709:2023-2025:al:same-series:AX";
const DX_ROUTE_ID = "award:caie:9709:2023-2025:al:staged:DX";

type InputKind = "raw" | "carried-forward";

const suffix = (componentCode: string) => componentCode.slice(componentCode.lastIndexOf("/") + 1);
const thresholdFor = (thresholds: Partial<Record<string, number>>, grade: string) => {
  const threshold = thresholds[grade];
  if (threshold === undefined) throw new Error(`Missing test threshold ${grade}`);
  return threshold;
};
const caieScore = (
  componentCode: string,
  rawScore: number,
  inputKind: InputKind = "raw",
  series = "2025-june",
  variant: string | null = suffix(componentCode),
) => ({
  componentCode,
  rawScore,
  inputKind,
  series,
  ...(variant === null ? {} : { variant }),
});

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

const caieScoresForTotal = (routeId: string, total: number, series = "2025-june") => {
  const route = awardCatalog.getAwardRoute(routeId);
  if (!route) throw new Error(`Missing test route ${routeId}`);
  let remaining = total;
  return route.components.map(component => {
    const rawScore = Math.min(component.maxRawMark, Math.max(0, remaining));
    remaining -= rawScore;
    return caieScore(component.code, rawScore, component.inputKind, series);
  });
};

const thresholdCases = caieJson.boundaries.flatMap(boundary => {
  const route = awardCatalog.getAwardRoute(boundary.routeId);
  if (!route) throw new Error(`Missing test route ${boundary.routeId}`);
  return route.grades.flatMap(publishedGrade => {
    const threshold = thresholdFor(boundary.thresholds, publishedGrade);
    return [-1, 0, 1].map(offset => {
      const total = threshold + offset;
      const expectedGrade = route.grades.find(grade =>
        total >= thresholdFor(boundary.thresholds, grade)) ?? "U";
      return {
        label: `${boundary.optionCode} ${publishedGrade} threshold ${offset >= 0 ? "+" : ""}${offset}`,
        routeId: route.id,
        optionCode: boundary.optionCode,
        total,
        expectedGrade,
      };
    });
  });
});

const validAxScores = [
  caieScore("9709/11", 70),
  caieScore("9709/31", 70),
  caieScore("9709/41", 50),
  caieScore("9709/51", 34),
];

const validDxScores = [
  caieScore("9709/31", 55),
  caieScore("9709/51", 45),
  caieScore("9709/84", 108, "carried-forward"),
];

describe("Official CAIE 9709 awards", () => {
  it("maps the exact CAIE AX total 224 to A*", () => {
    const result = calculateOfficialAward({
      routeId: AX_ROUTE_ID,
      series: "2025-june",
      optionCode: "AX",
      scores: validAxScores,
      estimateConsent: false,
    }, awardCatalog);

    expect(result).toMatchObject({
      source: "official",
      routeId: AX_ROUTE_ID,
      optionCode: "AX",
      total: 224,
      maximumMarkAfterWeighting: 250,
      grade: "A*",
    });
  });

  it("maps the exact CAIE S1 total 97 to a without exposing A*", () => {
    const result = calculateOfficialAward({
      routeId: S1_ROUTE_ID,
      series: "2025-june",
      optionCode: "S1",
      scores: [caieScore("9709/11", 59), caieScore("9709/21", 38)],
      estimateConsent: false,
    }, awardCatalog);

    expect(result).toMatchObject({ total: 97, maximumMarkAfterWeighting: 125, grade: "a" });
    expect(awardCatalog.getAwardRoute(S1_ROUTE_ID)?.grades).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("maps a valid official DX carried-forward total 55 + 45 + 108 = 208 to A*", () => {
    const result = calculateOfficialAward({
      routeId: DX_ROUTE_ID,
      series: "2025-june",
      optionCode: "DX",
      scores: validDxScores,
      estimateConsent: false,
    }, awardCatalog);

    expect(result).toMatchObject({ total: 208, maximumMarkAfterWeighting: 250, grade: "A*" });
  });

  it.each(thresholdCases)("maps CAIE $label through the route grade order", ({
    routeId,
    optionCode,
    total,
    expectedGrade,
  }) => {
    const result = calculateOfficialAward({
      routeId,
      series: "2025-june",
      optionCode,
      scores: caieScoresForTotal(routeId, total),
      estimateConsent: false,
    }, awardCatalog);

    expect(result.grade).toBe(expectedGrade);
  });

  it.each([
    ["wrong", "WRONG"],
    ["absent", undefined],
  ])("rejects a %s CAIE option before lookup", (_label, optionCode) => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AX_ROUTE_ID,
      series: "2025-june",
      ...(optionCode === undefined ? {} : { optionCode }),
      scores: validAxScores,
      estimateConsent: false,
    }, awardCatalog), "OPTION_MISMATCH");
  });

  it.each([
    ["wrong", "12"],
    ["absent", null],
  ])("rejects a %s CAIE component variant before lookup", (_label, variant) => {
    const scores = validAxScores.map((item, index) =>
      index === 0 ? caieScore(item.componentCode, item.rawScore, item.inputKind, item.series, variant) : item);
    expectAwardError(() => calculateOfficialAward({
      routeId: AX_ROUTE_ID,
      series: "2025-june",
      optionCode: "AX",
      scores,
      estimateConsent: false,
    }, awardCatalog), "VARIANT_MISMATCH");
  });

  it.each([
    {
      label: "a missing component",
      scores: validAxScores.slice(0, -1),
      code: "INCOMPLETE_ROUTE",
    },
    {
      label: "a duplicate component",
      scores: [validAxScores[0], validAxScores[0], validAxScores[2], validAxScores[3]],
      code: "DUPLICATE_COMPONENT",
    },
    {
      label: "a cross-series component",
      scores: validAxScores.map((item, index) => index === 0 ? { ...item, series: "2024-june" } : item),
      code: "CROSS_SERIES",
    },
    {
      label: "a score over maximum",
      scores: validAxScores.map((item, index) => index === 0 ? { ...item, rawScore: 76 } : item),
      code: "SCORE_OUT_OF_RANGE",
    },
    {
      label: "a fractional score",
      scores: validAxScores.map((item, index) => index === 0 ? { ...item, rawScore: 69.5 } : item),
      code: "SCORE_OUT_OF_RANGE",
    },
    {
      label: "the wrong kind for a raw component",
      scores: validAxScores.map((item, index) => index === 0 ? { ...item, inputKind: "carried-forward" as const } : item),
      code: "INVALID_INPUT",
    },
  ] satisfies Array<{ label: string; scores: typeof validAxScores; code: AwardErrorCode }>)
  ("rejects CAIE $label with $code", ({ scores, code }) => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AX_ROUTE_ID,
      series: "2025-june",
      optionCode: "AX",
      scores,
      estimateConsent: false,
    }, awardCatalog), code);
  });

  it("rejects DX component 84 supplied as a raw Paper input", () => {
    const scores = validDxScores.map(item => item.componentCode === "9709/84"
      ? { ...item, inputKind: "raw" as const }
      : item);
    expectAwardError(() => calculateOfficialAward({
      routeId: DX_ROUTE_ID,
      series: "2025-june",
      optionCode: "DX",
      scores,
      estimateConsent: false,
    }, awardCatalog), "CARRY_FORWARD_REQUIRED");
  });

  it("rejects prior Paper components instead of reconstructing carried-forward component 84", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: DX_ROUTE_ID,
      series: "2025-june",
      optionCode: "DX",
      scores: [
        caieScore("9709/31", 55),
        caieScore("9709/51", 45),
        caieScore("9709/11", 60),
        caieScore("9709/21", 48),
      ],
      estimateConsent: false,
    }, awardCatalog), "CARRY_FORWARD_REQUIRED");
  });

  it("rejects a non-integer official-carry-forward weighted total", () => {
    const route = structuredClone(awardCatalog.getAwardRoute(DX_ROUTE_ID)!);
    const boundary = structuredClone(caieJson.boundaries.find(item => item.optionCode === "DX")!);
    route.components[0].weightingFactor = 0.5;
    const fractionalCatalog = createAwardCatalog({
      routes: [route],
      officialBoundaries: [boundary],
      estimatedBoundaries: [],
    });

    expectAwardError(() => calculateOfficialAward({
      routeId: DX_ROUTE_ID,
      series: "2025-june",
      optionCode: "DX",
      scores: validDxScores,
      estimateConsent: false,
    }, fractionalCatalog), "CARRY_FORWARD_REQUIRED");
  });

  it("applies a route's nearest-integer rounding rule", () => {
    const route = structuredClone(awardCatalog.getAwardRoute(AX_ROUTE_ID)!);
    const boundary = structuredClone(caieJson.boundaries.find(item => item.optionCode === "AX")!);
    route.components[3].weightingFactor = 0.5;
    route.roundingRule = "nearest-integer";
    const roundedCatalog = createAwardCatalog({
      routes: [route],
      officialBoundaries: [boundary],
      estimatedBoundaries: [],
    });

    const result = calculateOfficialAward({
      routeId: AX_ROUTE_ID,
      series: "2025-june",
      optionCode: "AX",
      scores: [
        caieScore("9709/11", 75),
        caieScore("9709/31", 75),
        caieScore("9709/41", 50),
        caieScore("9709/51", 47),
      ],
      estimateConsent: false,
    }, roundedCatalog);

    expect(result).toMatchObject({ total: 224, grade: "A*" });
  });

  it("rejects a missing exact CAIE boundary", () => {
    expectAwardError(() => calculateOfficialAward({
      routeId: AX_ROUTE_ID,
      series: "2026-june",
      optionCode: "AX",
      scores: validAxScores.map(item => ({ ...item, series: "2026-june" })),
      estimateConsent: false,
    }, awardCatalog), "MISSING_BOUNDARY");
  });

  it("returns de-duplicated CAIE route, supporting, and boundary source URLs", () => {
    const route = awardCatalog.getAwardRoute(DX_ROUTE_ID)!;
    const boundary = caieJson.boundaries.find(item => item.optionCode === "DX")!;
    const result = calculateOfficialAward({
      routeId: DX_ROUTE_ID,
      series: "2025-june",
      optionCode: "DX",
      scores: validDxScores,
      estimateConsent: false,
    }, awardCatalog);

    expect(result.sourceUrls).toEqual([route.sourceUrl, boundary.sourceUrl]);
  });
});
