import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AcademicResultsCoverageMatrixV2Schema,
  BoundaryCoverageMatrixV1Schema,
  CoverageExpectationPolicyCatalogV1Schema,
  RuleCoverageMatrixV1Schema,
  StatisticsCoverageMatrixV1Schema,
} from "@/domain-v2/academic-results/schema";

const matrix = AcademicResultsCoverageMatrixV2Schema.parse(JSON.parse(readFileSync("generated/academic-results-v2/coverage-matrix.json", "utf8")));
const legacySnapshot = AcademicResultsCoverageMatrixV2Schema.parse(JSON.parse(readFileSync("generated/academic-results-v2/legacy-combined-coverage.json", "utf8")));
const policies = CoverageExpectationPolicyCatalogV1Schema.parse(JSON.parse(readFileSync("generated/academic-results-v2/coverage-expectation-policies.json", "utf8")));
const boundaryMatrix = BoundaryCoverageMatrixV1Schema.parse(JSON.parse(readFileSync("generated/academic-results-v2/boundary-coverage-matrix.json", "utf8")));
const statisticsMatrix = StatisticsCoverageMatrixV1Schema.parse(JSON.parse(readFileSync("generated/academic-results-v2/statistics-coverage-matrix.json", "utf8")));
const ruleMatrix = RuleCoverageMatrixV1Schema.parse(JSON.parse(readFileSync("generated/academic-results-v2/rule-coverage-matrix.json", "utf8")));
const migration = JSON.parse(readFileSync("generated/academic-results-v2/coverage-migration-report.json", "utf8"));

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
    expect(matrix.unresolvedCellCount).toBe(matrix.cells.filter(cell => cell.expectedByPolicy
      && [cell.boundaryStatus, cell.statisticsStatus, cell.awardRuleStatus].some(status => status === "source-unavailable" || status === "conflict")).length);
    expect(matrix.cells.some(cell => cell.statisticsStatus === "conflict")).toBe(false);
    expect(matrix.cells.some(cell => cell.boundaryStatus === "source-unavailable")).toBe(true);
  });
});

describe("Academic Results sparse coverage", () => {
  it("archives the mixed metric and replaces it with three independently validated matrices", () => {
    expect(legacySnapshot).toEqual(matrix);
    expect(migration.legacy).toMatchObject({ matrixName: "legacy-combined-coverage", status: "archived-metric" });
    expect(boundaryMatrix.matrixKind).toBe("grade-boundary");
    expect(statisticsMatrix.matrixKind).toBe("grade-statistics");
    expect(ruleMatrix.matrixKind).toBe("award-rule");
    expect(migration.replacements.statistics.blocksRuleMaturity).toBe(false);
  });

  it("uses 13 sparse policies without generating cross-products across optional dimensions", () => {
    expect(policies.policies).toHaveLength(13);
    const expectationIds = policies.policies.flatMap(policy => [
      ...policy.boundaryExpectations,
      ...policy.statisticsExpectations,
      ...policy.ruleExpectations,
    ].map(expectation => expectation.expectationId));
    expect(new Set(expectationIds).size).toBe(expectationIds.length);
    expect(policies.policies.flatMap(policy => policy.boundaryExpectations).every(expectation =>
      typeof expectation.routeId === "string"
      && (expectation.optionCode === undefined || typeof expectation.optionCode === "string")
      && (expectation.tier === undefined || typeof expectation.tier === "string"))).toBe(true);
  });

  it("keeps administration, evidence maturity and coverage resolution as separate fields", () => {
    const cancelled = boundaryMatrix.cells.find(cell =>
      cell.awardQualificationId === "award:aqa:7357" && cell.year === 2020 && cell.series === "june");
    expect(cancelled).toMatchObject({ administrationStatus: "cancelled", coverageStatus: "explained-unavailable", recordReviewStatus: null });
    const candidate0580 = boundaryMatrix.cells.find(cell =>
      cell.awardQualificationId === "award:caie:0580" && cell.year === 2025 && cell.series === "june" && cell.routeId.endsWith(":extended"));
    expect(candidate0580).toMatchObject({ administrationStatus: "held", coverageStatus: "pending", recordReviewStatus: "candidate" });
  });

  it("reports candidate gaps without letting Grade Statistics block rule maturity", () => {
    expect(statisticsMatrix.pendingCellCount).toBeGreaterThan(0);
    expect(statisticsMatrix.blockingCellCount).toBe(0);
    expect(ruleMatrix.pendingCellCount).toBeLessThan(statisticsMatrix.pendingCellCount);
    expect(ruleMatrix.blockingCellCount).toBe(0);
  });
});
