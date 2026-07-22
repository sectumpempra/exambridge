import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sanitizeSpreadsheetValue } from "../src/utils/excelExport";
import { compileExpression, extractParams, GRAPH_LIMITS } from "../src/pages/graph/lib/graphRenderer";
import {
  getSubjectsForBoard,
  isVerifiedCalculatorSubject,
  ARCHIVED_BOUNDARY_CONFLICTS,
} from "../src/data/calculatorIndex";
import { CanonicalBoundaryRecordSchema, ResultStatisticRecordSchema } from "../src/data/canonical/types";

describe("spreadsheet export hardening", () => {
  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "  =HYPERLINK(\"x\")"])(
    "neutralizes formula-like text %s",
    (value) => expect(sanitizeSpreadsheetValue(value)).toBe(`'${value}`),
  );

  it("leaves ordinary text and numeric values untouched", () => {
    expect(sanitizeSpreadsheetValue("数学")).toBe("数学");
    expect(sanitizeSpreadsheetValue(42)).toBe(42);
  });
});

describe("graph input limits", () => {
  it("rejects assignments, unapproved functions and oversized expressions", () => {
    expect(compileExpression("a=2")).toBeNull();
    expect(compileExpression("import(x)")).toBeNull();
    expect(compileExpression("x".repeat(GRAPH_LIMITS.expressionLength + 1))).toBeNull();
  });

  it("caps the number of independent parameters", () => {
    const expression = Array.from({ length: GRAPH_LIMITS.parameters + 1 }, (_, index) => `p${index}`).join("+");
    expect(extractParams(expression)).toEqual([]);
    expect(compileExpression(expression)).toBeNull();
  });
});

describe("strict calculator release policy", () => {
  it("only exposes qualifications with verified award routes", () => {
    expect(isVerifiedCalculatorSubject("Edexcel-AL", "WMA")).toBe(true);
    expect(isVerifiedCalculatorSubject("AQA-AL", "7357")).toBe(false);
    expect(getSubjectsForBoard("AQA-AL")).toEqual([]);
    expect(getSubjectsForBoard("CAIE-AL")).toEqual([]);
  });

  it("archives ambiguous legacy groups instead of selecting one", () => {
    expect(ARCHIVED_BOUNDARY_CONFLICTS.length).toBeGreaterThan(0);
    expect(ARCHIVED_BOUNDARY_CONFLICTS.every((item) => item.variantCount > 1)).toBe(true);
  });
});

describe("canonical data and PWA release contracts", () => {
  it("represents unavailable thresholds as null and rejects invalid provenance", () => {
    const boundary = {
      id: "AQA|GCSE|8300|2025-june|overall", board: "AQA", qualification: "GCSE",
      subjectCode: "8300", subjectName: "Mathematics", series: "2025-june", component: "overall",
      tier: "H", route: null, maxMark: 240, thresholds: { "9": 206, "1": null },
      sourceUrl: "https://www.aqa.org.uk/", publishedAt: "2025-08-21", accessedAt: "2026-07-11",
      sourceRowId: "page-1-row-1", verificationStatus: "verified", extractionMethod: "official-pdf",
    };
    expect(CanonicalBoundaryRecordSchema.safeParse(boundary).success).toBe(true);
    expect(CanonicalBoundaryRecordSchema.safeParse({ ...boundary, maxMark: -1 }).success).toBe(false);
    expect(ResultStatisticRecordSchema.safeParse({
      id: "AQA|7357|2025", board: "AQA", qualification: "A-Level", subjectCode: "7357", subjectName: "Mathematics",
      series: "2025-june", entries: 15532, cumulativeRates: { "A*": 12.2, A: 36.2 }, sourceUrl: "https://www.aqa.org.uk/",
      accessedAt: "2026-07-11", sourceRowId: "row-1", verificationStatus: "verified",
    }).success).toBe(true);
  });

  it("versions caches, revalidates data and removes obsolete ExamBridge caches", () => {
    const serviceWorker = readFileSync("public/sw.js", "utf8");
    expect(serviceWorker).toContain('const VERSION = "exambridge-v4"');
    expect(serviceWorker).toContain('/brand/exambridge-logo-horizontal.svg');
    expect(serviceWorker).toContain('/favicon.svg');
    expect(serviceWorker).toContain("self.skipWaiting()");
    expect(serviceWorker).toContain("staleWhileRevalidate");
    expect(serviceWorker).toContain("key.startsWith(CACHE_PREFIX)");
    expect(serviceWorker).toContain("caches.delete(key)");
  });
});
