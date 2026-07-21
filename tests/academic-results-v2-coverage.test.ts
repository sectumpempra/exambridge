import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AcademicResultsCoverageMatrixV2Schema } from "@/domain-v2/academic-results/schema";

const matrix = AcademicResultsCoverageMatrixV2Schema.parse(JSON.parse(readFileSync("generated/academic-results-v2/coverage-matrix.json", "utf8")));

describe("Academic Results V2 route-series coverage", () => {
  it("accounts for every approved qualification using explicit routes and recurring series", () => {
    expect(matrix.schemaVersion).toBe("2.0.0");
    expect(matrix.qualificationCount).toBe(13);
    expect(matrix.expectedCellCount).toBeGreaterThan(300);
    expect(new Set(matrix.cells.map(cell => cell.awardQualificationId)).size).toBe(13);
    expect(matrix.cells.every(cell => cell.routeId.length > 0 && cell.sourceUrls.length > 0)).toBe(true);
    expect(matrix.cells.some(cell => cell.awardQualificationId === "award:pearson:ial-mathematics" && cell.series === "october" && cell.expectedByPolicy)).toBe(true);
  });

  it("does not confuse exceptional or cancelled series with ordinary examined outcomes", () => {
    const ukCancelled = matrix.cells.filter(cell => ["award:aqa:7357", "award:ocr:h240", "award:pearson:8ma0"].includes(cell.awardQualificationId) && [2020, 2021].includes(cell.year) && cell.series === "june");
    expect(ukCancelled.length).toBeGreaterThan(0);
    expect(ukCancelled.every(cell => cell.administrationStatus === "cancelled")).toBe(true);
    expect(matrix.cells.filter(cell => cell.awardQualificationId.startsWith("award:caie:") && cell.series === "march").every(cell => cell.region === "restricted-march-series-centres")).toBe(true);
    expect(JSON.stringify(matrix)).not.toContain("8M1");
  });

  it("applies historical route and series windows instead of projecting current policy backwards", () => {
    const expected9231 = matrix.cells.filter(cell => cell.awardQualificationId === "award:caie:9231" && cell.expectedByPolicy);
    expect(expected9231.every(cell => ["june", "november"].includes(cell.series))).toBe(true);
    expect(expected9231.filter(cell => cell.year === 2019).map(cell => cell.routeId)).toEqual([
      "award:caie:9231:legacy-al",
      "award:caie:9231:legacy-al",
    ]);
    expect(expected9231.filter(cell => cell.year === 2020).some(cell => cell.routeId === "award:caie:9231:as")).toBe(true);

    const expected4ma1 = matrix.cells.filter(cell => cell.awardQualificationId === "award:pearson:4ma1" && cell.expectedByPolicy);
    expect(expected4ma1.some(cell => cell.year === 2022 && cell.series === "november")).toBe(false);
    expect(expected4ma1.some(cell => cell.year === 2023 && cell.series === "january")).toBe(true);
    expect(expected4ma1.some(cell => cell.year === 2024 && cell.series === "january")).toBe(false);
    expect(expected4ma1.some(cell => cell.year === 2024 && cell.series === "november")).toBe(true);
  });

  it("keeps unresolved evidence visible instead of claiming complete coverage", () => {
    expect(matrix.unresolvedCellCount).toBeGreaterThan(0);
    expect(matrix.cells.some(cell => cell.statisticsStatus === "conflict")).toBe(false);
    expect(matrix.cells.some(cell => cell.boundaryStatus === "source-unavailable")).toBe(true);
  });
});
