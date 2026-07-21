import { legacyCombinedCoveragePolicies } from "./academic-results-v2-coverage.mjs";

const REVIEW_RANK = { candidate: 1, "machine-reviewed": 2, "codex-reviewed": 3, "owner-approved": 4, rejected: 0 };
const UK_2020_SOURCE = "source:uk-written-exams-cancelled-2020";
const UK_2021_SOURCE = "source:uk-written-exams-cancelled-2021";

const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const unique = values => [...new Set(values)];
const maxDate = (a, b) => a > b ? a : b;
const minDate = (a, b) => !a ? b : !b ? a : a < b ? a : b;
const seriesMonth = { january: "01", march: "03", june: "06", october: "10", november: "11" };
const seriesDate = (year, series) => `${year}-${seriesMonth[series]}-01`;
const appliesAt = (record, date) => record.effectiveFrom <= date && (!record.effectiveTo || record.effectiveTo >= date);

function intersection(a, b) {
  const effectiveFrom = maxDate(a.effectiveFrom, b.effectiveFrom);
  const effectiveTo = minDate(a.effectiveTo, b.effectiveTo);
  return effectiveTo && effectiveTo < effectiveFrom ? null : { effectiveFrom, ...(effectiveTo ? { effectiveTo } : {}) };
}

function bestReviewStatus(records) {
  if (records.length === 0) return null;
  return [...records].sort((a, b) => (REVIEW_RANK[b.verificationStatus] ?? 0) - (REVIEW_RANK[a.verificationStatus] ?? 0))[0].verificationStatus;
}

function recordCoverage(records, administrationStatus, hasAdministrativeEvidence, needsExplicitOptionSet = false) {
  if (records.length > 0) {
    const reviewStatus = bestReviewStatus(records);
    if (needsExplicitOptionSet) return { coverageStatus: "pending", reviewStatus };
    return {
      coverageStatus: ["codex-reviewed", "owner-approved"].includes(reviewStatus) ? "satisfied" : "pending",
      reviewStatus,
    };
  }
  if (["not-held", "cancelled", "not-published", "restricted"].includes(administrationStatus) && hasAdministrativeEvidence) {
    return { coverageStatus: "explained-unavailable", reviewStatus: null };
  }
  return { coverageStatus: "pending", reviewStatus: null };
}

function administrationEvidence(awardQualificationId, year, series, candidateSourceIds) {
  const uk = awardQualificationId.startsWith("award:aqa:")
    || awardQualificationId.startsWith("award:ocr:")
    || awardQualificationId === "award:pearson:8ma0";
  if (uk && series === "june" && year === 2020 && candidateSourceIds.has(UK_2020_SOURCE)) {
    return { status: "cancelled", sourceIds: [UK_2020_SOURCE] };
  }
  if (uk && series === "june" && year === 2021 && candidateSourceIds.has(UK_2021_SOURCE)) {
    return { status: "cancelled", sourceIds: [UK_2021_SOURCE] };
  }
  if (awardQualificationId.startsWith("award:caie:") && year === 2020 && series === "june") {
    return { status: "cancelled", sourceIds: [] };
  }
  if (awardQualificationId.startsWith("award:caie:") && series === "march") {
    return { status: "restricted", sourceIds: [] };
  }
  if (year === 2026 && ["june", "october", "november"].includes(series)) {
    return { status: "not-published", sourceIds: [] };
  }
  return { status: "unknown", sourceIds: [] };
}

function resolveAdministration(awardQualificationId, year, series, records, candidateSourceIds) {
  const evidence = administrationEvidence(awardQualificationId, year, series, candidateSourceIds);
  if (records.length > 0) return { status: "held", sourceIds: evidence.sourceIds };
  return evidence;
}

function requiredRuleClauses(rule) {
  const clauses = ["qualification-version", "paper-structure", "valid-combination", "scoring-scale", "rounding", "resit", "a-star"];
  if (rule.routeType === "staged" || rule.carryForwardRule) clauses.push("carry-forward");
  if (rule.routeType === "modular" || rule.cashInRule) clauses.push("cash-in");
  if (rule.unitLockingRule) clauses.push("unit-locking");
  if (rule.boundarySelectionRule) clauses.push("boundary-selection");
  return unique(clauses);
}

function satisfiedRuleClauses(rule) {
  const clauses = [];
  if (rule.qualificationVersionId && rule.effectiveFrom) clauses.push("qualification-version");
  if (rule.components?.length) clauses.push("paper-structure");
  if (rule.validCombinations?.length) clauses.push("valid-combination");
  if (rule.scoringSystem && rule.totalMaximumAwardMark) clauses.push("scoring-scale");
  if (rule.roundingRule) clauses.push("rounding");
  if (rule.resitRule) clauses.push("resit");
  if (rule.aStarRule) clauses.push("a-star");
  if (rule.carryForwardRule) clauses.push("carry-forward");
  if (rule.cashInRule) clauses.push("cash-in");
  if (rule.unitLockingRule) clauses.push("unit-locking");
  if (rule.boundarySelectionRule) clauses.push("boundary-selection");
  return clauses;
}

export function buildCoverageExpectationPolicies(scope, candidate, identityCatalog) {
  const policies = identityCatalog.identities.map(identity => {
    const legacyPolicy = legacyCombinedCoveragePolicies[identity.awardQualificationId];
    if (!legacyPolicy) throw new Error(`Missing legacy policy for ${identity.awardQualificationId}`);
    const boundaryExpectations = [];
    const statisticsExpectations = [];
    for (const policyWindow of legacyPolicy.windows) {
      for (const version of identity.qualificationVersions) {
        const dates = intersection(policyWindow, version);
        if (!dates) continue;
        for (const routeId of policyWindow.routes) {
          boundaryExpectations.push({
            expectationId: `boundary-expectation:${slug(identity.awardQualificationId)}:${slug(version.qualificationVersionId)}:${slug(routeId)}:${slug(policyWindow.series.join("-"))}:${dates.effectiveFrom}:${dates.effectiveTo ?? "open"}`,
            awardQualificationId: identity.awardQualificationId,
            qualificationVersionId: version.qualificationVersionId,
            ...dates,
            series: policyWindow.series,
            routeId,
            boundaryScope: "overall",
            sourceIds: identity.sourceIds,
            reviewStatus: "codex-reviewed",
          });
        }
        statisticsExpectations.push({
          expectationId: `statistics-expectation:${slug(identity.awardQualificationId)}:${slug(version.qualificationVersionId)}:${slug(policyWindow.series.join("-"))}:${dates.effectiveFrom}:${dates.effectiveTo ?? "open"}`,
          awardQualificationId: identity.awardQualificationId,
          qualificationVersionId: version.qualificationVersionId,
          ...dates,
          series: policyWindow.series,
          regionScope: "all-published-candidates",
          populationScope: "all-candidates",
          statisticsScope: "overall",
          rateKind: "cumulative",
          sourceIds: identity.sourceIds,
          reviewStatus: "codex-reviewed",
        });
      }
    }
    const ruleExpectations = candidate.awardRules
      .filter(rule => rule.awardQualificationId === identity.awardQualificationId)
      .flatMap(rule => rule.validCombinations.map(combination => ({
        expectationId: `rule-expectation:${slug(rule.ruleId)}:${slug(combination.combinationId)}`,
        awardQualificationId: identity.awardQualificationId,
        qualificationVersionId: rule.qualificationVersionId,
        effectiveFrom: rule.effectiveFrom,
        ...(rule.effectiveTo ? { effectiveTo: rule.effectiveTo } : {}),
        routeId: rule.routeId,
        combinationId: combination.combinationId,
        requiredClauses: requiredRuleClauses(rule),
        sourceIds: rule.sourceIds,
        reviewStatus: "codex-reviewed",
      })));
    for (const record of candidate.boundaries.filter(record => record.awardQualificationId === identity.awardQualificationId
      && ["codex-reviewed", "owner-approved"].includes(record.verificationStatus)
      && record.sourceIds.length > 0)) {
      const exactDate = seriesDate(record.year, record.series);
      boundaryExpectations.push({
        expectationId: `boundary-expectation:exact:${slug(record.boundaryId)}`,
        awardQualificationId: record.awardQualificationId,
        qualificationVersionId: record.qualificationVersionId,
        effectiveFrom: exactDate,
        effectiveTo: exactDate,
        series: [record.series],
        routeId: record.routeId,
        boundaryScope: record.boundaryScope,
        ...(record.tier ? { tier: record.tier } : {}),
        ...(record.optionCode ? { optionCode: record.optionCode } : {}),
        ...(record.componentVariants ? { componentVariants: record.componentVariants } : {}),
        ...(record.region ? { region: record.region } : {}),
        ...(record.componentCode ? { componentCode: record.componentCode } : {}),
        sourceIds: record.sourceIds,
        reviewStatus: record.verificationStatus,
      });
    }
    return {
      schemaVersion: "1.0.0",
      policyId: `coverage-policy:${slug(identity.awardQualificationId)}`,
      awardQualificationId: identity.awardQualificationId,
      sourceIds: identity.sourceIds,
      boundaryExpectations,
      statisticsExpectations,
      ruleExpectations,
      reviewStatus: "codex-reviewed",
    };
  });
  return { schemaVersion: "1.0.0", policies };
}

function summarize(matrixKind, cells, scope, generatedAt) {
  const expected = cells.filter(cell => cell.expectationId);
  return {
    schemaVersion: "1.0.0",
    matrixKind,
    generatedAt,
    baselineCommit: scope.baselineCommit,
    qualificationCount: scope.qualifications.length,
    expectedCellCount: expected.length,
    satisfiedCellCount: expected.filter(cell => cell.coverageStatus === "satisfied").length,
    explainedUnavailableCellCount: expected.filter(cell => cell.coverageStatus === "explained-unavailable").length,
    pendingCellCount: expected.filter(cell => cell.coverageStatus === "pending").length,
    unexpectedRecordCount: cells.filter(cell => cell.coverageStatus === "unexpected-record").length,
    blockingCellCount: cells.filter(cell => cell.coverageStatus === "conflicting-record").length,
    cells,
  };
}

function boundaryMatchesExpectation(record, expectation, year, series) {
  return record.awardQualificationId === expectation.awardQualificationId
    && record.qualificationVersionId === expectation.qualificationVersionId
    && record.year === year
    && record.series === series
    && record.routeId === expectation.routeId
    && record.boundaryScope === expectation.boundaryScope
    && (!expectation.tier || record.tier === expectation.tier)
    && (!expectation.optionCode || record.optionCode === expectation.optionCode)
    && (!expectation.region || record.region === expectation.region)
    && (!expectation.componentCode || record.componentCode === expectation.componentCode)
    && (!expectation.componentVariants || expectation.componentVariants.every(variant => record.componentVariants?.includes(variant)));
}

function statisticsMatchesExpectation(record, expectation, year, series) {
  return record.awardQualificationId === expectation.awardQualificationId
    && record.qualificationVersionId === expectation.qualificationVersionId
    && record.year === year
    && record.series === series
    && (!expectation.routeId || record.routeId === expectation.routeId)
    && record.regionScope === expectation.regionScope
    && (record.populationScope ?? "all-candidates") === expectation.populationScope
    && (record.statisticsScope ?? "overall") === expectation.statisticsScope
    && (!expectation.componentCode || record.componentCode === expectation.componentCode)
    && record.rateKind === expectation.rateKind;
}

export function buildSparseCoverageMatrices(scope, candidate, policyCatalog) {
  const sourceIds = new Set(candidate.sources.map(source => source.sourceId));
  const boundaryCells = [];
  const matchedBoundaryIds = new Set();
  const statisticsCells = [];
  const matchedStatisticsIds = new Set();
  const ruleCells = [];
  const matchedRuleKeys = new Set();

  for (const policy of policyCatalog.policies) {
    for (const expectation of policy.boundaryExpectations) {
      for (let year = scope.startYear; year <= scope.latestYear; year += 1) {
        for (const series of expectation.series) {
          const date = seriesDate(year, series);
          if (!appliesAt(expectation, date)) continue;
          const moreSpecificExpectations = policy.boundaryExpectations.filter(candidateExpectation =>
            candidateExpectation.expectationId !== expectation.expectationId
            && candidateExpectation.awardQualificationId === expectation.awardQualificationId
            && candidateExpectation.qualificationVersionId === expectation.qualificationVersionId
            && candidateExpectation.routeId === expectation.routeId
            && candidateExpectation.boundaryScope === expectation.boundaryScope
            && candidateExpectation.effectiveFrom === date
            && candidateExpectation.effectiveTo === date);
          const genericExpectation = expectation.effectiveFrom !== date || expectation.effectiveTo !== date;
          if (genericExpectation && moreSpecificExpectations.length > 0) continue;
          const records = candidate.boundaries.filter(record => boundaryMatchesExpectation(record, expectation, year, series));
          records.forEach(record => matchedBoundaryIds.add(record.boundaryId));
          const administration = resolveAdministration(expectation.awardQualificationId, year, series, records, sourceIds);
          const needsExplicitOptionSet = !expectation.optionCode && records.some(record => record.optionCode);
          const resolution = recordCoverage(records, administration.status, administration.sourceIds.length > 0, needsExplicitOptionSet);
          boundaryCells.push({
            cellId: `boundary-coverage:${slug(expectation.expectationId)}:${year}:${series}`,
            expectationId: expectation.expectationId,
            awardQualificationId: expectation.awardQualificationId,
            qualificationVersionId: expectation.qualificationVersionId,
            year,
            series,
            routeId: expectation.routeId,
            boundaryScope: expectation.boundaryScope,
            ...(expectation.tier ? { tier: expectation.tier } : {}),
            ...(expectation.optionCode ? { optionCode: expectation.optionCode } : {}),
            ...(expectation.componentVariants ? { componentVariants: expectation.componentVariants } : {}),
            ...(expectation.region ? { region: expectation.region } : {}),
            ...(expectation.componentCode ? { componentCode: expectation.componentCode } : {}),
            administrationStatus: administration.status,
            coverageStatus: resolution.coverageStatus,
            recordReviewStatus: resolution.reviewStatus,
            observedRecordIds: records.map(record => record.boundaryId),
            sourceIds: unique([...expectation.sourceIds, ...administration.sourceIds, ...records.flatMap(record => record.sourceIds)]),
            notes: [
              ...(needsExplicitOptionSet ? ["Published option rows exist, but the expectation policy has not yet declared the complete official option set; keep this cell pending."] : []),
              ...(records.length === 0 && administration.sourceIds.length === 0 ? ["No matching boundary or row-level administrative evidence is available."] : []),
            ],
          });
        }
      }
    }

    for (const expectation of policy.statisticsExpectations) {
      for (let year = scope.startYear; year <= scope.latestYear; year += 1) {
        for (const series of expectation.series) {
          const date = seriesDate(year, series);
          if (!appliesAt(expectation, date)) continue;
          const records = candidate.statistics.filter(record => statisticsMatchesExpectation(record, expectation, year, series));
          records.forEach(record => matchedStatisticsIds.add(record.statisticsId));
          const administration = resolveAdministration(expectation.awardQualificationId, year, series, records, sourceIds);
          const resolution = recordCoverage(records, administration.status, administration.sourceIds.length > 0);
          statisticsCells.push({
            cellId: `statistics-coverage:${slug(expectation.expectationId)}:${year}:${series}`,
            expectationId: expectation.expectationId,
            awardQualificationId: expectation.awardQualificationId,
            qualificationVersionId: expectation.qualificationVersionId,
            year,
            series,
            ...(expectation.routeId ? { routeId: expectation.routeId } : {}),
            regionScope: expectation.regionScope,
            populationScope: expectation.populationScope,
            statisticsScope: expectation.statisticsScope,
            ...(expectation.componentCode ? { componentCode: expectation.componentCode } : {}),
            rateKind: expectation.rateKind,
            administrationStatus: administration.status,
            coverageStatus: resolution.coverageStatus,
            recordReviewStatus: resolution.reviewStatus,
            observedRecordIds: records.map(record => record.statisticsId),
            sourceIds: unique([...expectation.sourceIds, ...administration.sourceIds, ...records.flatMap(record => record.sourceIds)]),
            notes: records.length === 0 && administration.sourceIds.length === 0
              ? ["No matching Grade Statistics row or row-level administrative evidence is available; this does not block award-rule maturity."]
              : [],
          });
        }
      }
    }

    for (const expectation of policy.ruleExpectations) {
      const rule = candidate.awardRules.find(record => record.awardQualificationId === expectation.awardQualificationId
        && record.qualificationVersionId === expectation.qualificationVersionId
        && record.routeId === expectation.routeId
        && record.validCombinations.some(combination => combination.combinationId === expectation.combinationId));
      if (rule) matchedRuleKeys.add(`${rule.ruleId}|${expectation.combinationId}`);
      const satisfiedClauses = rule ? satisfiedRuleClauses(rule).filter(clause => expectation.requiredClauses.includes(clause)) : [];
      const missingClauses = expectation.requiredClauses.filter(clause => !satisfiedClauses.includes(clause));
      const reviewStatus = rule?.verificationStatus ?? null;
      const coverageStatus = !rule || missingClauses.length > 0 || !["codex-reviewed", "owner-approved"].includes(reviewStatus)
        ? "pending"
        : "satisfied";
      ruleCells.push({
        cellId: `rule-coverage:${slug(expectation.expectationId)}`,
        expectationId: expectation.expectationId,
        awardQualificationId: expectation.awardQualificationId,
        qualificationVersionId: expectation.qualificationVersionId,
        routeId: expectation.routeId,
        combinationId: expectation.combinationId,
        effectiveFrom: expectation.effectiveFrom,
        ...(expectation.effectiveTo ? { effectiveTo: expectation.effectiveTo } : {}),
        requiredClauses: expectation.requiredClauses,
        satisfiedClauses,
        missingClauses,
        administrationStatus: "held",
        coverageStatus,
        recordReviewStatus: reviewStatus,
        observedRecordIds: rule ? [rule.ruleId] : [],
        sourceIds: unique([...expectation.sourceIds, ...(rule?.sourceIds ?? [])]),
        notes: missingClauses.length > 0 ? [`Missing required rule clauses: ${missingClauses.join(", ")}.`] : [],
      });
    }
  }

  for (const record of candidate.boundaries.filter(record => !matchedBoundaryIds.has(record.boundaryId))) {
    boundaryCells.push({
      cellId: `boundary-coverage:unexpected:${slug(record.boundaryId)}`,
      awardQualificationId: record.awardQualificationId,
      qualificationVersionId: record.qualificationVersionId,
      year: record.year,
      series: record.series,
      routeId: record.routeId,
      boundaryScope: record.boundaryScope,
      ...(record.tier ? { tier: record.tier } : {}),
      ...(record.optionCode ? { optionCode: record.optionCode } : {}),
      ...(record.componentVariants ? { componentVariants: record.componentVariants } : {}),
      ...(record.region ? { region: record.region } : {}),
      ...(record.componentCode ? { componentCode: record.componentCode } : {}),
      administrationStatus: "held",
      coverageStatus: "unexpected-record",
      recordReviewStatus: record.verificationStatus,
      observedRecordIds: [record.boundaryId],
      sourceIds: record.sourceIds,
      notes: ["Observed boundary is outside the current sparse expectation policy and must be adjudicated before activation."],
    });
  }

  for (const record of candidate.statistics.filter(record => !matchedStatisticsIds.has(record.statisticsId))) {
    statisticsCells.push({
      cellId: `statistics-coverage:unexpected:${slug(record.statisticsId)}`,
      awardQualificationId: record.awardQualificationId,
      qualificationVersionId: record.qualificationVersionId,
      year: record.year,
      series: record.series,
      ...(record.routeId ? { routeId: record.routeId } : {}),
      regionScope: record.regionScope,
      populationScope: record.populationScope ?? "all-candidates",
      statisticsScope: record.statisticsScope ?? "overall",
      ...(record.componentCode ? { componentCode: record.componentCode } : {}),
      rateKind: record.rateKind,
      administrationStatus: "held",
      coverageStatus: "unexpected-record",
      recordReviewStatus: record.verificationStatus,
      observedRecordIds: [record.statisticsId],
      sourceIds: record.sourceIds,
      notes: ["Observed Grade Statistics row is outside the current sparse expectation policy and must be adjudicated before activation."],
    });
  }

  for (const rule of candidate.awardRules) {
    for (const combination of rule.validCombinations) {
      const key = `${rule.ruleId}|${combination.combinationId}`;
      if (matchedRuleKeys.has(key)) continue;
      ruleCells.push({
        cellId: `rule-coverage:unexpected:${slug(rule.ruleId)}:${slug(combination.combinationId)}`,
        awardQualificationId: rule.awardQualificationId,
        qualificationVersionId: rule.qualificationVersionId,
        routeId: rule.routeId,
        combinationId: combination.combinationId,
        effectiveFrom: rule.effectiveFrom,
        ...(rule.effectiveTo ? { effectiveTo: rule.effectiveTo } : {}),
        requiredClauses: requiredRuleClauses(rule),
        satisfiedClauses: satisfiedRuleClauses(rule),
        missingClauses: [],
        administrationStatus: "held",
        coverageStatus: "unexpected-record",
        recordReviewStatus: rule.verificationStatus,
        observedRecordIds: [rule.ruleId],
        sourceIds: rule.sourceIds,
        notes: ["Observed award combination is outside the current sparse expectation policy and must be adjudicated before activation."],
      });
    }
  }

  return {
    boundaries: summarize("grade-boundary", boundaryCells, scope, candidate.generatedAt),
    statistics: summarize("grade-statistics", statisticsCells, scope, candidate.generatedAt),
    rules: summarize("award-rule", ruleCells, scope, candidate.generatedAt),
  };
}

export function buildCoverageMigrationReport(legacyMatrix, matrices) {
  return {
    schemaVersion: "1.0.0",
    legacy: {
      matrixName: "legacy-combined-coverage",
      expectedCellCount: legacyMatrix.expectedCellCount,
      unresolvedCellCount: legacyMatrix.unresolvedCellCount,
      status: "archived-metric",
      reason: "The legacy cell mixed grade boundaries, Grade Statistics and award rules at route-series grain.",
    },
    replacements: {
      boundaries: {
        expectedCellCount: matrices.boundaries.expectedCellCount,
        pendingCellCount: matrices.boundaries.pendingCellCount,
        unexpectedRecordCount: matrices.boundaries.unexpectedRecordCount,
        blockingCellCount: matrices.boundaries.blockingCellCount,
      },
      statistics: {
        expectedCellCount: matrices.statistics.expectedCellCount,
        pendingCellCount: matrices.statistics.pendingCellCount,
        unexpectedRecordCount: matrices.statistics.unexpectedRecordCount,
        blockingCellCount: matrices.statistics.blockingCellCount,
        blocksRuleMaturity: false,
      },
      rules: {
        expectedCellCount: matrices.rules.expectedCellCount,
        pendingCellCount: matrices.rules.pendingCellCount,
        unexpectedRecordCount: matrices.rules.unexpectedRecordCount,
        blockingCellCount: matrices.rules.blockingCellCount,
      },
    },
  };
}
