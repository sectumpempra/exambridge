import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  QualificationFactCardCatalogV1Schema,
  QualificationFactGapReportV1Schema,
} from "@/domain-v2/academic-results";

const cards = QualificationFactCardCatalogV1Schema.parse(JSON.parse(
  readFileSync("generated/academic-results-v2/qualification-fact-cards.json", "utf8"),
));
const gaps = QualificationFactGapReportV1Schema.parse(JSON.parse(
  readFileSync("generated/academic-results-v2/real-gap-report.json", "utf8"),
));

describe("Academic Results qualification fact cards", () => {
  it("generates one source-backed fact card for every approved award", () => {
    expect(cards.cards).toHaveLength(13);
    expect(new Set(cards.cards.map(card => card.awardQualificationId)).size).toBe(13);
    expect(cards.cards.every(card => card.sourceIds.length > 0 && card.routes.length > 0)).toBe(true);
  });

  it("keeps shared Pearson IAL specification versions separated by award identity", () => {
    const mathematics = cards.cards.find(card => card.awardQualificationId === "award:pearson:ial-mathematics");
    const further = cards.cards.find(card => card.awardQualificationId === "award:pearson:ial-further-mathematics");
    expect(mathematics?.currentQualificationVersionId).toBe("Edexcel-IAL:2018");
    expect(further?.currentQualificationVersionId).toBe("Edexcel-IAL:2018");
    expect(mathematics?.subjectCode).toBe("YMA01");
    expect(further?.subjectCode).toBe("YFM01");
    expect(mathematics?.routes[0].routeId).not.toBe(further?.routes[0].routeId);
  });

  it("does not expose calculator-ready before owner approval", () => {
    expect(cards.cards.every(card => card.maturity.ownerApproved === false)).toBe(true);
    expect(cards.cards.every(card => card.maturity.calculatorAvailable === false)).toBe(true);
    expect(cards.cards.every(card => card.maturity.level !== "calculator-ready")).toBe(true);
  });

  it("preserves OCR 6993 as A to E without A-star", () => {
    const fsmq = cards.cards.find(card => card.awardQualificationId === "award:ocr:6993");
    expect(fsmq?.routes.length).toBeGreaterThan(0);
    expect(fsmq?.routes.every(route => route.aStarAvailable === false && !route.gradeScale.includes("A*"))).toBe(true);
  });

  it("reports P0 to P3 separately and never lets statistics gaps block rule maturity", () => {
    expect(gaps.counts.P0).toBeGreaterThan(0);
    expect(gaps.counts.P1).toBeGreaterThan(0);
    expect(gaps.counts.P3).toBeGreaterThan(0);
    expect(gaps.gaps.filter(gap => gap.category === "statistics").every(gap => gap.blocks.length === 0)).toBe(true);
  });
});
