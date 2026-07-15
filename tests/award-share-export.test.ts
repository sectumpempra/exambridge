import { describe, expect, it } from "vitest";
import { awardCatalog } from "@/domain-v2/awards/catalog";
import { calculateEstimatedAward, ESTIMATE_WARNING } from "@/domain-v2/awards/estimate-engine";
import { componentVariantsForRoute } from "@/domain-v2/awards/official-engine";
import type { AwardCalculationInput } from "@/domain-v2/awards/schema";
import {
  MAX_AWARD_SHARE_LENGTH,
  decodeAwardShareState,
  encodeAwardShareState,
  getAwardShareParam,
  readStoredAwardShare,
  resolveSharedAward,
  withAwardShareParam,
  writeStoredAwardShare,
} from "@/domain-v2/awards/share-state";
import { buildAwardExportRows } from "@/pages/grade-calculator/exportAwardResult";
import { sanitizeSpreadsheetValue } from "@/utils/excelExport";

const officialInput: AwardCalculationInput = {
  routeId: "award:aqa:7357:linear",
  series: "2025-june",
  estimateConsent: false,
  scores: [
    { componentCode: "7357/1", series: "2025-june", rawScore: 90, inputKind: "raw" },
    { componentCode: "7357/2", series: "2025-june", rawScore: 85, inputKind: "raw" },
    { componentCode: "7357/3", series: "2025-june", rawScore: 85, inputKind: "raw" },
  ],
};

const encodeUnchecked = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

describe("Award share state", () => {
  it("round-trips a versioned state under the size limit without thresholds", () => {
    const state = { version: 1 as const, input: officialInput, displayedSource: "official" as const };
    const encoded = encodeAwardShareState(state);
    expect(encoded.length).toBeLessThanOrEqual(MAX_AWARD_SHARE_LENGTH);
    expect(encoded).not.toContain("thresholds");
    expect(decodeAwardShareState(encoded)).toEqual(state);
  });

  it("accepts a valid state exactly at the 4096-character boundary", () => {
    const stateAtLimit = Array.from({ length: 5000 }, (_, length) => ({
      version: 1 as const,
      input: {
        ...officialInput,
        scores: [{ ...officialInput.scores[0], variant: `v${"x".repeat(length)}` }],
      },
      displayedSource: "official" as const,
    })).find(state => encodeUnchecked(state).length === MAX_AWARD_SHARE_LENGTH);

    expect(stateAtLimit).toBeDefined();
    const encoded = encodeAwardShareState(stateAtLimit!);
    expect(encoded).toHaveLength(MAX_AWARD_SHARE_LENGTH);
    expect(decodeAwardShareState(encoded)).toEqual(stateAtLimit);
  });

  it("rejects oversized, malformed, wrong-version and invalid-score state", () => {
    expect(decodeAwardShareState("x".repeat(MAX_AWARD_SHARE_LENGTH + 1))).toBeNull();
    expect(decodeAwardShareState("not!base64url")).toBeNull();
    expect(decodeAwardShareState(encodeUnchecked({ version: 2, input: officialInput, displayedSource: "official" }))).toBeNull();
    expect(decodeAwardShareState(encodeUnchecked({
      version: 1,
      input: { ...officialInput, scores: [{ ...officialInput.scores[0], rawScore: -1 }] },
      displayedSource: "official",
    }))).toBeNull();
    expect(decodeAwardShareState(encodeUnchecked({
      version: 1,
      input: { ...officialInput, routeId: "" },
      displayedSource: "official",
    }))).toBeNull();
    expect(decodeAwardShareState(encodeUnchecked({
      version: 1,
      input: { ...officialInput, scores: [{ ...officialInput.scores[0], componentCode: "" }] },
      displayedSource: "official",
    }))).toBeNull();
  });

  it("preserves course parameters in the hash and stores only valid encoded state", () => {
    const encoded = encodeAwardShareState({ version: 1, input: officialInput, displayedSource: "official" });
    const hash = withAwardShareParam("#/calculator?course=qual%3Aaqa%3Aa-level%3A7357&spec=spec-aqa", encoded);
    expect(hash).toContain("course=qual%3Aaqa%3Aa-level%3A7357");
    expect(hash).toContain("spec=spec-aqa");
    expect(getAwardShareParam(hash)).toBe(encoded);
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    writeStoredAwardShare(storage, encoded);
    expect(readStoredAwardShare(storage)).toBe(encoded);
    writeStoredAwardShare(storage, "not-valid");
    expect(readStoredAwardShare(storage)).toBe(encoded);
  });

  it("upgrades an old displayed estimate when an exact official boundary now exists", () => {
    expect(resolveSharedAward({
      version: 1,
      input: { ...officialInput, estimateConsent: true },
      displayedSource: "estimated",
    }, awardCatalog)).toMatchObject({
      result: { source: "official", grade: "A*" },
      notice: "官方边界现已发布",
    });
  });

  it("restores an estimate only with explicit stored consent", () => {
    const estimatedInput: AwardCalculationInput = {
      ...officialInput,
      series: "2026-june",
      estimateConsent: true,
      scores: officialInput.scores.map(score => ({ ...score, series: "2026-june", rawScore: 75 })),
    };
    expect(resolveSharedAward({ version: 1, input: estimatedInput, displayedSource: "estimated" }, awardCatalog).result)
      .toMatchObject({ source: "estimated", warning: ESTIMATE_WARNING });
    expect(() => resolveSharedAward({
      version: 1,
      input: { ...estimatedInput, estimateConsent: false },
      displayedSource: "estimated",
    }, awardCatalog)).toThrowError("ESTIMATE_CONSENT_REQUIRED");
  });
});

describe("Award export provenance", () => {
  it("keeps estimate provenance in every export row", () => {
    const route = awardCatalog.getAwardRoute("award:aqa:7357:linear")!;
    const input: AwardCalculationInput = {
      ...officialInput,
      series: "2026-june",
      estimateConsent: true,
      scores: officialInput.scores.map(score => ({ ...score, series: "2026-june", rawScore: 75 })),
    };
    const result = calculateEstimatedAward(input, awardCatalog);
    expect(awardCatalog.findEstimatedBoundary({ routeId: route.id, series: input.series, componentVariants: componentVariantsForRoute(route) })).toBeDefined();
    expect(buildAwardExportRows(result)).toEqual([expect.objectContaining({
      结果类型: "非官方预估等级",
      资格路线: route.id,
      置信度: result.confidence,
      算法版本: "historical-weighted-median-v1",
      警告: ESTIMATE_WARNING,
    })]);
  });

  it("uses a distinct verified label for official rows and retains formula protection", () => {
    const result = resolveSharedAward({ version: 1, input: officialInput, displayedSource: "official" }, awardCatalog).result;
    expect(buildAwardExportRows(result)[0]).toMatchObject({ 结果类型: "官方整体边界 · 已核验", 置信度: "", 算法版本: "" });
    for (const prefix of ["=", "+", "-", "@"]) expect(String(sanitizeSpreadsheetValue(`${prefix}formula`))).toBe(`'${prefix}formula`);
  });
});
