import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COURSE_CATALOG } from "@/course-context/catalog-source";
import { awardCatalog } from "@/domain-v2/awards/catalog";
import type { AwardErrorCode } from "@/domain-v2/awards/official-engine";
import { componentVariantsForRoute } from "@/domain-v2/awards/official-engine";
import { calculateEstimatedAward, ESTIMATE_WARNING } from "@/domain-v2/awards/estimate-engine";
import {
  PUBLIC_AWARD_ERRORS,
  INITIAL_AWARD_INTERACTION,
  areAwardScoresComplete,
  buildAwardCalculatorViewModel,
  reduceAwardInteraction,
} from "@/pages/grade-calculator/AwardCalculatorPanel";
import AwardCalculatorPanel from "@/pages/grade-calculator/AwardCalculatorPanel";
import AwardResultCard from "@/pages/grade-calculator/AwardResultCard";

const course = (boardName: string, subjectCode?: string) => {
  const entry = COURSE_CATALOG.find(candidate =>
    candidate.boardName === boardName &&
    (subjectCode === undefined || candidate.subjectCode === subjectCode));
  if (!entry) throw new Error(`Missing test course ${boardName} ${subjectCode ?? ""}`);
  return entry;
};

describe("Award calculator view model", () => {
  it("shows an official AQA series without consent even when an estimate also exists", () => {
    const model = buildAwardCalculatorViewModel(course("AQA", "7357"), awardCatalog, "2025-june");

    expect(model.mode).toBe("official");
    expect(model.requiresConsent).toBe(false);
    expect(model.selectedSeries).toBe("2025-june");
    expect(model.routeOptions.map(option => option.id)).toContain("award:aqa:7357:linear");
    expect(model.seriesOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "2025-june", source: "official" }),
      expect.objectContaining({ id: "2026-june", source: "estimated" }),
    ]));
  });

  it("requires explicit consent only for the generated AQA estimate series", () => {
    const model = buildAwardCalculatorViewModel(course("AQA", "7357"), awardCatalog, "2026-june");

    expect(model.mode).toBe("estimated");
    expect(model.requiresConsent).toBe(true);
    expect(model.seriesOptions.find(option => option.id === "2026-june")).toMatchObject({
      source: "estimated",
    });
  });

  it("keeps stable CAIE route and option identifiers", () => {
    const model = buildAwardCalculatorViewModel(course("CAIE", "9709"), awardCatalog);

    expect(model.routeOptions.map(option => option.id)).toEqual(expect.arrayContaining([
      "award:caie:9709:2023-2025:as:S1",
      "award:caie:9709:2023-2025:al:same-series:AX",
      "award:caie:9709:2023-2025:al:staged:DX",
    ]));
    expect(model.routeOptions.map(option => option.optionCode)).toEqual(expect.arrayContaining(["S1", "AX", "DX"]));
  });

  it("does not expose a calculator action for an unavailable course", () => {
    const model = buildAwardCalculatorViewModel(course("WJEC/Eduqas"), awardCatalog);

    expect(model.mode).toBe("unavailable");
    expect(model.routeOptions).toEqual([]);
    expect(model.seriesOptions).toEqual([]);
    expect(model.requiresConsent).toBe(false);
  });

  it("provides fixed public Chinese copy for every engine error", () => {
    const codes: AwardErrorCode[] = [
      "INVALID_INPUT", "UNKNOWN_ROUTE", "UNSUPPORTED_ROUTE", "INCOMPLETE_ROUTE",
      "DUPLICATE_COMPONENT", "UNKNOWN_COMPONENT", "CROSS_SERIES", "SCORE_OUT_OF_RANGE",
      "OPTION_MISMATCH", "VARIANT_MISMATCH", "MISSING_BOUNDARY", "MISSING_ESTIMATE",
      "ESTIMATE_CONSENT_REQUIRED", "CARRY_FORWARD_REQUIRED", "INTERNAL_ERROR",
    ];

    expect(Object.keys(PUBLIC_AWARD_ERRORS).sort()).toEqual([...codes].sort());
    expect(codes.every(code => PUBLIC_AWARD_ERRORS[code].length > 0)).toBe(true);
    expect(Object.values(PUBLIC_AWARD_ERRORS)).not.toContain("INTERNAL_ERROR");
  });

  it("renders visible, stable labels for the Award form", () => {
    const html = renderToStaticMarkup(createElement(AwardCalculatorPanel, { course: course("AQA", "7357") }));
    expect(html).toContain('for="award-route"');
    expect(html).toContain('for="award-series"');
    expect(html).toContain("7357/1 分数");
    expect(html).toContain("7357/2 分数");
    expect(html).toContain("7357/3 分数");
    expect(html).toContain("计算等级");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>计算等级<\/button>/);
  });

  it("enables calculation only when every required score has a non-blank value", () => {
    const components = ["7357/1", "7357/2", "7357/3"];
    expect(areAwardScoresComplete(components, {})).toBe(false);
    expect(areAwardScoresComplete(components, { "7357/1": "90", "7357/2": " " })).toBe(false);
    expect(areAwardScoresComplete(components, { "7357/1": "90", "7357/2": "85", "7357/3": "85" })).toBe(true);
  });

  it("renders estimated provenance, range and warning as visible content", () => {
    const route = awardCatalog.getAwardRoute("award:aqa:7357:linear")!;
    const scores = route.components.map(component => ({
      componentCode: component.code,
      series: "2026-june",
      rawScore: 75,
      inputKind: component.inputKind,
    }));
    const result = calculateEstimatedAward({
      routeId: route.id,
      series: "2026-june",
      scores,
      estimateConsent: true,
    }, awardCatalog);
    const boundary = awardCatalog.findEstimatedBoundary({
      routeId: route.id,
      series: "2026-june",
      componentVariants: componentVariantsForRoute(route),
    })!;
    const html = renderToStaticMarkup(createElement(AwardResultCard, { result, route, scores, boundary }));
    expect(html).toContain("非官方预估等级");
    expect(html).toContain("合理范围");
    expect(html).toContain("置信度");
    expect(html).toContain("样本考季");
    expect(html).toContain("historical-weighted-median-v1");
    expect(html).toContain(ESTIMATE_WARNING);
  });

  it("invalidates a displayed result whenever scores or estimate consent change", () => {
    const dirty = {
      ...INITIAL_AWARD_INTERACTION,
      scores: { "7357/1": "90" },
      consent: true,
      calculated: {} as never,
      error: "旧错误",
    };
    expect(reduceAwardInteraction(dirty, { type: "score", componentCode: "7357/1", value: "91" })).toMatchObject({
      scores: { "7357/1": "91" }, calculated: null, error: null,
    });
    expect(reduceAwardInteraction(dirty, { type: "consent", value: false })).toMatchObject({
      consent: false, calculated: null, error: null,
    });
  });
});
