const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const unique = values => [...new Set(values)];

function coverageCounts(matrix, awardQualificationId) {
  const cells = matrix.cells.filter(cell => cell.awardQualificationId === awardQualificationId);
  const expected = cells.filter(cell => cell.expectationId);
  return {
    expected: expected.length,
    satisfied: expected.filter(cell => cell.coverageStatus === "satisfied").length,
    explainedUnavailable: expected.filter(cell => cell.coverageStatus === "explained-unavailable").length,
    pending: expected.filter(cell => cell.coverageStatus === "pending").length,
    unexpected: cells.filter(cell => cell.coverageStatus === "unexpected-record").length,
    conflicting: cells.filter(cell => cell.coverageStatus === "conflicting-record").length,
  };
}

function gap({ awardQualificationId, qualificationVersionId, severity, category, suffix, description, sourceIds = [], remediation, blocks }) {
  return {
    gapId: `fact-gap:${slug(awardQualificationId)}:${suffix}`,
    awardQualificationId,
    ...(qualificationVersionId ? { qualificationVersionId } : {}),
    severity,
    category,
    description,
    sourceIds: unique(sourceIds),
    remediation,
    blocks,
  };
}

function buildGaps(scope, candidate, identityCatalog, matrices) {
  const gaps = [];
  for (const identity of identityCatalog.identities) {
    const awardId = identity.awardQualificationId;
    const current = identity.qualificationVersions.find(version => version.isCurrent);
    const rules = candidate.awardRules.filter(rule => rule.awardQualificationId === awardId);
    const currentRules = rules.filter(rule => rule.qualificationVersionId === current.qualificationVersionId);
    const boundaryCells = matrices.boundaries.cells.filter(cell => cell.awardQualificationId === awardId);
    const statisticsCells = matrices.statistics.cells.filter(cell => cell.awardQualificationId === awardId);
    const ruleCells = matrices.rules.cells.filter(cell => cell.awardQualificationId === awardId);
    const currentBoundaryCells = boundaryCells.filter(cell => cell.qualificationVersionId === current.qualificationVersionId && cell.expectationId);
    const currentRuleCells = ruleCells.filter(cell => cell.qualificationVersionId === current.qualificationVersionId && cell.expectationId);
    const earliestVersion = [...identity.qualificationVersions].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
    if (earliestVersion.effectiveFrom > `${scope.startYear}-12-31`) {
      gaps.push(gap({
        awardQualificationId: awardId,
        severity: "P0",
        category: "identity",
        suffix: "historical-version-window",
        description: `The identity catalog starts at ${earliestVersion.effectiveFrom}, after the ${scope.startYear} coverage baseline. Historical records before that version cannot be safely assigned.`,
        sourceIds: identity.sourceIds,
        remediation: "Add source-backed historical qualification versions before classifying pre-version records.",
        blocks: ["explain-ready", "activation"],
      }));
    }
    if (currentRules.length === 0) {
      gaps.push(gap({
        awardQualificationId: awardId,
        qualificationVersionId: current.qualificationVersionId,
        severity: "P0",
        category: "paper-structure",
        suffix: "current-rule-missing",
        description: "The current qualification version has no executable award rule or component structure.",
        sourceIds: identity.sourceIds,
        remediation: "Create a source-backed current rule with every valid component combination.",
        blocks: ["explain-ready", "calculator-ready", "activation"],
      }));
    }
    const unexpectedBoundaries = boundaryCells.filter(cell => cell.coverageStatus === "unexpected-record");
    if (unexpectedBoundaries.length > 0) {
      gaps.push(gap({
        awardQualificationId: awardId,
        severity: "P0",
        category: "unexpected-record",
        suffix: "unexpected-boundaries",
        description: `${unexpectedBoundaries.length} boundary record(s) are outside the current sparse expectation policy.`,
        sourceIds: unexpectedBoundaries.flatMap(cell => cell.sourceIds),
        remediation: "Confirm the official administration/version identity, then add an explicit expectation or quarantine the row.",
        blocks: ["activation"],
      }));
    }
    const implicitOptionCells = boundaryCells.filter(cell => cell.expectationId && cell.notes.some(note => note.includes("complete official option set")));
    if (implicitOptionCells.length > 0) {
      gaps.push(gap({
        awardQualificationId: awardId,
        severity: "P0",
        category: "boundary",
        suffix: "option-set-not-explicit",
        description: `${implicitOptionCells.length} route-series cell(s) contain published option rows, but the complete official option set is not declared by policy.`,
        sourceIds: implicitOptionCells.flatMap(cell => cell.sourceIds),
        remediation: "Declare every official option and component-variant combination for the affected series.",
        blocks: ["calculator-ready", "activation"],
      }));
    }
    const pendingCurrentRuleCells = currentRuleCells.filter(cell => cell.coverageStatus === "pending");
    if (pendingCurrentRuleCells.length > 0) {
      gaps.push(gap({
        awardQualificationId: awardId,
        qualificationVersionId: current.qualificationVersionId,
        severity: "P1",
        category: "review-maturity",
        suffix: "current-rule-review",
        description: `${pendingCurrentRuleCells.length} current award combination(s) have not reached codex-reviewed rule maturity.`,
        sourceIds: pendingCurrentRuleCells.flatMap(cell => cell.sourceIds),
        remediation: "Review the rule clauses and official examples before enabling deterministic calculation.",
        blocks: ["calculator-ready", "activation"],
      }));
    }
    const missingClauses = unique(currentRuleCells.flatMap(cell => cell.missingClauses));
    if (missingClauses.length > 0) {
      gaps.push(gap({
        awardQualificationId: awardId,
        qualificationVersionId: current.qualificationVersionId,
        severity: "P1",
        category: "rule-clause",
        suffix: "current-rule-clauses",
        description: `Current rule coverage is missing: ${missingClauses.join(", ")}.`,
        sourceIds: currentRuleCells.flatMap(cell => cell.sourceIds),
        remediation: "Add source-backed clauses and deterministic tests for each missing rule feature.",
        blocks: ["calculator-ready", "activation"],
      }));
    }
    const currentBoundarySatisfied = currentBoundaryCells.some(cell => cell.coverageStatus === "satisfied");
    if (!currentBoundarySatisfied) {
      gaps.push(gap({
        awardQualificationId: awardId,
        qualificationVersionId: current.qualificationVersionId,
        severity: "P1",
        category: "boundary",
        suffix: "current-boundary-not-ready",
        description: "No current-version overall boundary expectation is satisfied at codex-reviewed or owner-approved maturity.",
        sourceIds: currentBoundaryCells.flatMap(cell => cell.sourceIds),
        remediation: "Verify at least one applicable current official overall boundary and its exact route/tier/option identity.",
        blocks: ["calculator-ready"],
      }));
    }
    const historicalBoundaryPending = boundaryCells.filter(cell => cell.expectationId
      && cell.qualificationVersionId !== current.qualificationVersionId
      && cell.coverageStatus === "pending").length;
    if (historicalBoundaryPending > 0) {
      gaps.push(gap({
        awardQualificationId: awardId,
        severity: "P2",
        category: "boundary",
        suffix: "historical-boundary-gaps",
        description: `${historicalBoundaryPending} historical boundary expectation(s) remain pending.`,
        sourceIds: identity.sourceIds,
        remediation: "Prioritize only the historical series needed for business verification; do not block current explain-ready capability.",
        blocks: [],
      }));
    }
    const pendingStatistics = statisticsCells.filter(cell => cell.expectationId && cell.coverageStatus === "pending").length;
    const unexpectedStatistics = statisticsCells.filter(cell => cell.coverageStatus === "unexpected-record").length;
    if (pendingStatistics + unexpectedStatistics > 0) {
      gaps.push(gap({
        awardQualificationId: awardId,
        severity: "P3",
        category: "statistics",
        suffix: "statistics-auxiliary-gaps",
        description: `${pendingStatistics} expected Grade Statistics cell(s) are pending and ${unexpectedStatistics} observed row(s) need policy adjudication.`,
        sourceIds: statisticsCells.flatMap(cell => cell.sourceIds),
        remediation: "Continue statistics cleanup as auxiliary evidence without blocking rule explanation or calculation maturity.",
        blocks: [],
      }));
    }
  }
  return gaps;
}

function matchOverviewComponent(component, overview) {
  const normalized = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const code = normalized(component.code);
  return overview?.components.find(candidate => {
    const candidateCode = normalized(candidate.code);
    return candidateCode === code || candidateCode.endsWith(code) || code.endsWith(candidateCode);
  });
}

function cardMaturity(identity, currentRules, currentBoundaryCells, currentRuleCells, gaps) {
  const blockingExplain = gaps.some(item => item.blocks.includes("explain-ready"));
  const ruleExplainReady = currentRules.length > 0 && currentRules.every(rule => ["codex-reviewed", "owner-approved"].includes(rule.verificationStatus));
  const explainReady = identity.sourceIds.length > 0 && ruleExplainReady && !blockingExplain;
  const ownerApproved = identity.reviewStatus === "owner-approved"
    && currentRules.length > 0
    && currentRules.every(rule => rule.verificationStatus === "owner-approved")
    && currentBoundaryCells.some(cell => cell.coverageStatus === "satisfied" && cell.recordReviewStatus === "owner-approved");
  const calculatorAvailable = ownerApproved
    && currentRuleCells.length > 0
    && currentRuleCells.every(cell => cell.coverageStatus === "satisfied")
    && !gaps.some(item => item.blocks.includes("calculator-ready"));
  const level = calculatorAvailable
    ? "calculator-ready"
    : explainReady
      ? "explain-ready"
      : identity.sourceIds.length > 0
        ? "evidence-ready"
        : "catalogued";
  const reasons = [];
  if (!explainReady) reasons.push("Current rule evidence or a P0 identity/paper-structure condition is incomplete.");
  if (!ownerApproved) reasons.push("Owner approval is still required before production activation.");
  if (!calculatorAvailable) reasons.push("The calculator remains unavailable until current rules and an exact applicable overall boundary are owner-approved.");
  return { level, ownerApproved, calculatorAvailable, reasons };
}

export function buildQualificationFactCards({ scope, candidate, identityCatalog, matrices, courseCatalog, getExamOverviewForCourse }) {
  const gaps = buildGaps(scope, candidate, identityCatalog, matrices);
  const cards = identityCatalog.identities.map(identity => {
    const current = identity.qualificationVersions.find(version => version.isCurrent);
    const currentRules = candidate.awardRules.filter(rule => rule.awardQualificationId === identity.awardQualificationId
      && rule.qualificationVersionId === current.qualificationVersionId);
    const matchingCourses = courseCatalog.filter(course => identity.catalogQualificationIds.includes(course.qualificationId));
    const overviewCourse = matchingCourses.find(course => getExamOverviewForCourse(course)) ?? matchingCourses[0];
    const overview = getExamOverviewForCourse(overviewCourse);
    const awardRules = candidate.awardRules.filter(rule => rule.awardQualificationId === identity.awardQualificationId);
    const qualificationGaps = gaps.filter(item => item.awardQualificationId === identity.awardQualificationId);
    const currentBoundaryCells = matrices.boundaries.cells.filter(cell => cell.awardQualificationId === identity.awardQualificationId
      && cell.qualificationVersionId === current.qualificationVersionId && cell.expectationId);
    const currentRuleCells = matrices.rules.cells.filter(cell => cell.awardQualificationId === identity.awardQualificationId
      && cell.qualificationVersionId === current.qualificationVersionId && cell.expectationId);
    return {
      schemaVersion: "1.0.0",
      awardQualificationId: identity.awardQualificationId,
      board: identity.board,
      subjectCode: identity.subjectCode,
      subjectName: identity.subjectName,
      level: identity.level,
      currentQualificationVersionId: current.qualificationVersionId,
      qualificationVersions: identity.qualificationVersions,
      catalogQualificationIds: identity.catalogQualificationIds,
      knowledgeMappingCodes: identity.knowledgeMappingCodes,
      examSeries: overview?.examSeries.map(series => series.name) ?? [],
      calculatorSummary: overview?.calculator.summary ?? null,
      officialMaterials: overview?.materials.map(material => ({ title: material.title, version: material.version, officialUrl: material.officialUrl })) ?? [],
      routes: awardRules.map(rule => ({
        ruleId: rule.ruleId,
        qualificationVersionId: rule.qualificationVersionId,
        routeId: rule.routeId,
        routeType: rule.routeType,
        scoringSystem: rule.scoringSystem,
        effectiveFrom: rule.effectiveFrom,
        ...(rule.effectiveTo ? { effectiveTo: rule.effectiveTo } : {}),
        totalMaximumAwardMark: rule.totalMaximumAwardMark,
        gradeScale: rule.gradeScale,
        components: rule.components.map(component => {
          const overviewComponent = matchOverviewComponent(component, overview);
          return {
            code: component.code,
            inputKind: component.inputKind,
            maximumRawMark: component.maximumRawMark,
            maximumAwardMark: component.maximumAwardMark,
            weightingFactor: component.weightingFactor,
            durationMinutes: overviewComponent?.durationMinutes ?? null,
            calculator: overviewComponent?.calculator ?? (overview?.calculator.status === "all" ? "allowed" : overview?.calculator.status === "none" ? "not-allowed" : "unknown"),
          };
        }),
        validCombinationIds: rule.validCombinations.map(combination => combination.combinationId),
        roundingRule: rule.roundingRule,
        carryForward: Boolean(rule.carryForwardRule?.allowed),
        resit: rule.resitRule.allowed,
        cashIn: Boolean(rule.cashInRule?.required),
        unitLocking: Boolean(rule.unitLockingRule?.lockedAfterCashIn),
        aStarAvailable: Boolean(rule.aStarRule?.available),
        sourceIds: rule.sourceIds,
        reviewStatus: rule.verificationStatus,
      })),
      coverage: {
        boundaries: coverageCounts(matrices.boundaries, identity.awardQualificationId),
        statistics: coverageCounts(matrices.statistics, identity.awardQualificationId),
        rules: coverageCounts(matrices.rules, identity.awardQualificationId),
      },
      maturity: cardMaturity(identity, currentRules, currentBoundaryCells, currentRuleCells, qualificationGaps),
      sourceIds: unique([...identity.sourceIds, ...awardRules.flatMap(rule => rule.sourceIds)]),
      unresolvedGapIds: qualificationGaps.map(item => item.gapId),
      generatedAt: candidate.generatedAt,
      reviewStatus: "candidate",
    };
  });
  return {
    catalog: { schemaVersion: "1.0.0", cards },
    gapReport: {
      schemaVersion: "1.0.0",
      generatedAt: candidate.generatedAt,
      qualificationCount: cards.length,
      counts: Object.fromEntries(["P0", "P1", "P2", "P3"].map(severity => [severity, gaps.filter(item => item.severity === severity).length])),
      gaps,
    },
  };
}
