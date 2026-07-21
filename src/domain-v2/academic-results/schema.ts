import { z } from "zod";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const DateTimeSchema = z.string().datetime({ offset: true });
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const NonEmptyString = z.string().trim().min(1);

export const ReviewStatusSchema = z.enum([
  "candidate",
  "machine-reviewed",
  "codex-reviewed",
  "owner-approved",
  "rejected",
]);

export const QualificationVersionIdentityV2Schema = z.strictObject({
  qualificationVersionId: NonEmptyString,
  effectiveFrom: DateSchema,
  effectiveTo: DateSchema.optional(),
  isCurrent: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must not precede effectiveFrom" });
  }
});

export const QualificationIdentityV2Schema = z.strictObject({
  schemaVersion: z.literal("2.0.0"),
  awardQualificationId: NonEmptyString,
  board: NonEmptyString,
  subjectCode: NonEmptyString,
  subjectName: NonEmptyString,
  level: NonEmptyString,
  catalogQualificationIds: z.array(NonEmptyString).min(1),
  knowledgeMappingCodes: z.array(NonEmptyString).min(1),
  qualificationVersions: z.array(QualificationVersionIdentityV2Schema).min(1),
  aliases: z.array(NonEmptyString).min(1),
  sourceIds: z.array(NonEmptyString).min(1),
  processingPolicy: z.enum(["local-only", "deepseek-candidate"]),
  reviewStatus: ReviewStatusSchema,
}).superRefine((value, ctx) => {
  const uniqueFields = ["catalogQualificationIds", "knowledgeMappingCodes", "aliases", "sourceIds"] as const;
  for (const field of uniqueFields) {
    const normalized = value[field].map(item => item.trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({ code: "custom", path: [field], message: `${field} must be unique after normalization` });
    }
  }
  const versionIds = value.qualificationVersions.map(version => version.qualificationVersionId);
  if (new Set(versionIds).size !== versionIds.length) {
    ctx.addIssue({ code: "custom", path: ["qualificationVersions"], message: "qualificationVersionId values must be unique within an award" });
  }
  if (value.qualificationVersions.filter(version => version.isCurrent).length !== 1) {
    ctx.addIssue({ code: "custom", path: ["qualificationVersions"], message: "exactly one qualification version must be current" });
  }
});

export const QualificationIdentityCatalogV2Schema = z.strictObject({
  schemaVersion: z.literal("2.0.0"),
  generatedFor: z.literal("academic-results-v2"),
  identities: z.array(QualificationIdentityV2Schema).min(1),
}).superRefine((value, ctx) => {
  const awardIds = value.identities.map(identity => identity.awardQualificationId);
  if (new Set(awardIds).size !== awardIds.length) {
    ctx.addIssue({ code: "custom", path: ["identities"], message: "awardQualificationId values must be unique" });
  }
});

export const ExamSeriesSchema = z.enum(["january", "march", "june", "october", "november", "other"]);

export const AcademicCoverageStatusSchema = z.enum([
  "verified-record",
  "candidate-record",
  "conflict",
  "not-held",
  "not-published",
  "cancelled",
  "restricted",
  "source-unavailable",
]);

export const AcademicResultsCoverageCellV2Schema = z.strictObject({
  cellId: NonEmptyString,
  awardQualificationId: NonEmptyString,
  qualificationVersionId: NonEmptyString,
  year: z.number().int().min(2019).max(2100),
  series: ExamSeriesSchema,
  routeId: NonEmptyString,
  region: NonEmptyString.optional(),
  expectedByPolicy: z.boolean(),
  administrationStatus: z.enum(["held", "not-held", "not-published", "cancelled", "restricted", "source-unavailable"]),
  boundaryStatus: AcademicCoverageStatusSchema,
  statisticsStatus: AcademicCoverageStatusSchema,
  awardRuleStatus: z.enum(["verified-record", "candidate-record", "source-unavailable"]),
  sourceUrls: z.array(z.string().url()).min(1),
  notes: z.array(NonEmptyString),
});

export const AcademicResultsCoverageMatrixV2Schema = z.strictObject({
  schemaVersion: z.literal("2.0.0"),
  generatedAt: DateTimeSchema,
  baselineCommit: z.string().regex(/^[a-f0-9]{40}$/),
  startYear: z.number().int().min(2019),
  latestYear: z.number().int().min(2019),
  qualificationCount: z.number().int().positive(),
  expectedCellCount: z.number().int().nonnegative(),
  unresolvedCellCount: z.number().int().nonnegative(),
  cells: z.array(AcademicResultsCoverageCellV2Schema),
});

export const AdministrationStatusV1Schema = z.enum([
  "held",
  "not-held",
  "cancelled",
  "not-published",
  "restricted",
  "unknown",
]);

export const CoverageResolutionStatusV1Schema = z.enum([
  "satisfied",
  "explained-unavailable",
  "pending",
  "unexpected-record",
  "conflicting-record",
  "not-applicable",
]);

const CoverageExpectationBaseV1Shape = {
  expectationId: NonEmptyString,
  awardQualificationId: NonEmptyString,
  qualificationVersionId: NonEmptyString,
  effectiveFrom: DateSchema,
  effectiveTo: DateSchema.optional(),
  sourceIds: z.array(NonEmptyString).min(1),
  reviewStatus: ReviewStatusSchema,
};

export const BoundaryExpectationV1Schema = z.strictObject({
  ...CoverageExpectationBaseV1Shape,
  series: z.array(ExamSeriesSchema).min(1),
  routeId: NonEmptyString,
  boundaryScope: z.enum(["component", "overall"]),
  tier: NonEmptyString.optional(),
  optionCode: NonEmptyString.optional(),
  componentVariants: z.array(NonEmptyString).min(1).optional(),
  region: NonEmptyString.optional(),
  componentCode: NonEmptyString.optional(),
}).superRefine((value, ctx) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must not precede effectiveFrom" });
  }
  if (value.boundaryScope === "component" && !value.componentCode) {
    ctx.addIssue({ code: "custom", path: ["componentCode"], message: "component boundary expectations require componentCode" });
  }
  if (value.boundaryScope === "overall" && value.componentCode) {
    ctx.addIssue({ code: "custom", path: ["componentCode"], message: "overall boundary expectations must not declare componentCode" });
  }
});

export const StatisticsExpectationV1Schema = z.strictObject({
  ...CoverageExpectationBaseV1Shape,
  series: z.array(ExamSeriesSchema).min(1),
  routeId: NonEmptyString.optional(),
  regionScope: NonEmptyString,
  populationScope: NonEmptyString,
  statisticsScope: z.enum(["component", "overall"]),
  componentCode: NonEmptyString.optional(),
  rateKind: z.enum(["cumulative", "exclusive"]),
}).superRefine((value, ctx) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must not precede effectiveFrom" });
  }
  if (value.statisticsScope === "component" && !value.componentCode) {
    ctx.addIssue({ code: "custom", path: ["componentCode"], message: "component statistics expectations require componentCode" });
  }
  if (value.statisticsScope === "overall" && value.componentCode) {
    ctx.addIssue({ code: "custom", path: ["componentCode"], message: "overall statistics expectations must not declare componentCode" });
  }
});

export const RuleClauseV1Schema = z.enum([
  "qualification-version",
  "paper-structure",
  "valid-combination",
  "scoring-scale",
  "rounding",
  "carry-forward",
  "resit",
  "cash-in",
  "unit-locking",
  "a-star",
  "boundary-selection",
]);

export const RuleClauseEvidenceV1Schema = z.strictObject({
  clause: RuleClauseV1Schema,
  sourceIds: z.array(NonEmptyString).min(1),
  reviewStatus: ReviewStatusSchema,
  notes: z.array(NonEmptyString),
});

export const RuleExpectationV1Schema = z.strictObject({
  ...CoverageExpectationBaseV1Shape,
  routeId: NonEmptyString,
  combinationId: NonEmptyString,
  requiredClauses: z.array(RuleClauseV1Schema).min(1),
}).superRefine((value, ctx) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must not precede effectiveFrom" });
  }
});

export const CoverageExpectationPolicyV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  policyId: NonEmptyString,
  awardQualificationId: NonEmptyString,
  sourceIds: z.array(NonEmptyString).min(1),
  boundaryExpectations: z.array(BoundaryExpectationV1Schema),
  statisticsExpectations: z.array(StatisticsExpectationV1Schema),
  ruleExpectations: z.array(RuleExpectationV1Schema),
  reviewStatus: ReviewStatusSchema,
});

export const CoverageExpectationPolicyCatalogV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  policies: z.array(CoverageExpectationPolicyV1Schema).min(1),
}).superRefine((value, ctx) => {
  const awardIds = value.policies.map(policy => policy.awardQualificationId);
  if (new Set(awardIds).size !== awardIds.length) {
    ctx.addIssue({ code: "custom", path: ["policies"], message: "policies must have unique awardQualificationId values" });
  }
  const expectationIds = value.policies.flatMap(policy => [
    ...policy.boundaryExpectations,
    ...policy.statisticsExpectations,
    ...policy.ruleExpectations,
  ].map(expectation => expectation.expectationId));
  if (new Set(expectationIds).size !== expectationIds.length) {
    ctx.addIssue({ code: "custom", path: ["policies"], message: "expectationId values must be globally unique" });
  }
});

const CoverageCellBaseV1Shape = {
  cellId: NonEmptyString,
  expectationId: NonEmptyString.optional(),
  awardQualificationId: NonEmptyString,
  qualificationVersionId: NonEmptyString,
  administrationStatus: AdministrationStatusV1Schema,
  coverageStatus: CoverageResolutionStatusV1Schema,
  recordReviewStatus: ReviewStatusSchema.nullable(),
  observedRecordIds: z.array(NonEmptyString),
  sourceIds: z.array(NonEmptyString),
  notes: z.array(NonEmptyString),
};

export const BoundaryCoverageCellV1Schema = z.strictObject({
  ...CoverageCellBaseV1Shape,
  year: z.number().int().min(2019).max(2100),
  series: ExamSeriesSchema,
  routeId: NonEmptyString,
  boundaryScope: z.enum(["component", "overall"]),
  tier: NonEmptyString.optional(),
  optionCode: NonEmptyString.optional(),
  componentVariants: z.array(NonEmptyString).min(1).optional(),
  region: NonEmptyString.optional(),
  componentCode: NonEmptyString.optional(),
});

export const StatisticsCoverageCellV1Schema = z.strictObject({
  ...CoverageCellBaseV1Shape,
  year: z.number().int().min(2019).max(2100),
  series: ExamSeriesSchema,
  routeId: NonEmptyString.optional(),
  regionScope: NonEmptyString,
  populationScope: NonEmptyString,
  statisticsScope: z.enum(["component", "overall"]),
  componentCode: NonEmptyString.optional(),
  rateKind: z.enum(["cumulative", "exclusive"]),
});

export const RuleCoverageCellV1Schema = z.strictObject({
  ...CoverageCellBaseV1Shape,
  routeId: NonEmptyString,
  combinationId: NonEmptyString,
  effectiveFrom: DateSchema,
  effectiveTo: DateSchema.optional(),
  requiredClauses: z.array(RuleClauseV1Schema).min(1),
  explainRequiredClauses: z.array(RuleClauseV1Schema).min(1),
  satisfiedClauses: z.array(RuleClauseV1Schema),
  missingClauses: z.array(RuleClauseV1Schema),
  explainReady: z.boolean(),
  calculatorReady: z.boolean(),
});

const CoverageMatrixSummaryV1Shape = {
  schemaVersion: z.literal("1.0.0"),
  generatedAt: DateTimeSchema,
  baselineCommit: z.string().regex(/^[a-f0-9]{40}$/),
  qualificationCount: z.number().int().positive(),
  expectedCellCount: z.number().int().nonnegative(),
  satisfiedCellCount: z.number().int().nonnegative(),
  explainedUnavailableCellCount: z.number().int().nonnegative(),
  pendingCellCount: z.number().int().nonnegative(),
  unexpectedRecordCount: z.number().int().nonnegative(),
  blockingCellCount: z.number().int().nonnegative(),
};

export const BoundaryCoverageMatrixV1Schema = z.strictObject({
  ...CoverageMatrixSummaryV1Shape,
  matrixKind: z.literal("grade-boundary"),
  cells: z.array(BoundaryCoverageCellV1Schema),
});

export const StatisticsCoverageMatrixV1Schema = z.strictObject({
  ...CoverageMatrixSummaryV1Shape,
  matrixKind: z.literal("grade-statistics"),
  cells: z.array(StatisticsCoverageCellV1Schema),
});

export const RuleCoverageMatrixV1Schema = z.strictObject({
  ...CoverageMatrixSummaryV1Shape,
  matrixKind: z.literal("award-rule"),
  cells: z.array(RuleCoverageCellV1Schema),
});

const FactCardComponentV1Schema = z.strictObject({
  code: NonEmptyString,
  inputKind: z.enum(["raw", "scaled-raw", "ums", "carried-forward"]),
  maximumRawMark: z.number().finite().positive().nullable(),
  maximumAwardMark: z.number().finite().positive(),
  weightingFactor: z.number().finite().positive(),
  durationMinutes: z.number().int().positive().nullable(),
  calculator: z.enum(["allowed", "not-allowed", "required", "unknown"]),
});

const FactCardRouteV1Schema = z.strictObject({
  ruleId: NonEmptyString,
  qualificationVersionId: NonEmptyString,
  routeId: NonEmptyString,
  routeType: z.enum(["linear", "same-series", "staged", "modular"]),
  scoringSystem: z.enum(["raw", "scaled-raw", "UMS", "weighted-raw"]),
  effectiveFrom: DateSchema,
  effectiveTo: DateSchema.optional(),
  totalMaximumAwardMark: z.number().finite().positive(),
  gradeScale: z.array(NonEmptyString).min(1),
  components: z.array(FactCardComponentV1Schema).min(1),
  validCombinationIds: z.array(NonEmptyString).min(1),
  roundingRule: NonEmptyString,
  carryForward: z.boolean(),
  resit: z.boolean(),
  cashIn: z.boolean(),
  unitLocking: z.boolean(),
  aStarAvailable: z.boolean(),
  clauseEvidence: z.array(RuleClauseEvidenceV1Schema).min(1),
  explainReady: z.boolean(),
  calculatorReady: z.boolean(),
  sourceIds: z.array(NonEmptyString).min(1),
  reviewStatus: ReviewStatusSchema,
});

const CoverageCountsV1Schema = z.strictObject({
  expected: z.number().int().nonnegative(),
  satisfied: z.number().int().nonnegative(),
  explainedUnavailable: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  unexpected: z.number().int().nonnegative(),
  conflicting: z.number().int().nonnegative(),
});

export const QualificationFactCardV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  awardQualificationId: NonEmptyString,
  board: NonEmptyString,
  subjectCode: NonEmptyString,
  subjectName: NonEmptyString,
  level: NonEmptyString,
  currentQualificationVersionId: NonEmptyString,
  qualificationVersions: z.array(QualificationVersionIdentityV2Schema).min(1),
  catalogQualificationIds: z.array(NonEmptyString).min(1),
  knowledgeMappingCodes: z.array(NonEmptyString).min(1),
  examSeries: z.array(NonEmptyString),
  calculatorSummary: NonEmptyString.nullable(),
  officialMaterials: z.array(z.strictObject({
    title: NonEmptyString,
    version: NonEmptyString,
    officialUrl: z.string().url(),
  })),
  routes: z.array(FactCardRouteV1Schema),
  coverage: z.strictObject({
    boundaries: CoverageCountsV1Schema,
    statistics: CoverageCountsV1Schema,
    rules: CoverageCountsV1Schema,
  }),
  maturity: z.strictObject({
    level: z.enum(["catalogued", "evidence-ready", "explain-ready", "calculator-ready"]),
    ownerApproved: z.boolean(),
    calculatorAvailable: z.boolean(),
    reasons: z.array(NonEmptyString),
  }),
  sourceIds: z.array(NonEmptyString).min(1),
  unresolvedGapIds: z.array(NonEmptyString),
  generatedAt: DateTimeSchema,
  reviewStatus: ReviewStatusSchema,
});

export const QualificationFactCardCatalogV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  cards: z.array(QualificationFactCardV1Schema).min(1),
});

export const QualificationFactGapV1Schema = z.strictObject({
  gapId: NonEmptyString,
  awardQualificationId: NonEmptyString,
  qualificationVersionId: NonEmptyString.optional(),
  severity: z.enum(["P0", "P1", "P2", "P3"]),
  category: z.enum(["identity", "paper-structure", "rule-clause", "boundary", "statistics", "unexpected-record", "review-maturity"]),
  description: NonEmptyString,
  sourceIds: z.array(NonEmptyString),
  remediation: NonEmptyString,
  blocks: z.array(z.enum(["explain-ready", "calculator-ready", "activation"])),
});

export const QualificationFactGapReportV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: DateTimeSchema,
  qualificationCount: z.number().int().positive(),
  counts: z.strictObject({
    P0: z.number().int().nonnegative(),
    P1: z.number().int().nonnegative(),
    P2: z.number().int().nonnegative(),
    P3: z.number().int().nonnegative(),
  }),
  gaps: z.array(QualificationFactGapV1Schema),
});

export const MisconceptionRecordV1Schema = z.strictObject({
  misconceptionId: NonEmptyString,
  awardQualificationIds: z.array(NonEmptyString).min(1),
  qualificationVersionIds: z.array(NonEmptyString).min(1),
  incorrectClaim: NonEmptyString,
  correctedFact: NonEmptyString,
  applicabilityNotes: z.array(NonEmptyString).min(1),
  sourceIds: z.array(NonEmptyString).min(1),
  escalationTriggers: z.array(NonEmptyString).min(1),
  suggestedResponse: NonEmptyString,
  reviewStatus: ReviewStatusSchema,
});

export const MisconceptionLibraryV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  generatedAt: DateTimeSchema,
  activationDecision: z.literal("candidate-only"),
  records: z.array(MisconceptionRecordV1Schema).min(1),
}).superRefine((value, ctx) => {
  const ids = value.records.map(record => record.misconceptionId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: "custom", path: ["records"], message: "misconception IDs must be unique" });
  }
});

export const SourceEvidenceV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  sourceId: NonEmptyString,
  board: NonEmptyString,
  officialUrl: z.string().url(),
  documentTitle: NonEmptyString,
  documentVersion: NonEmptyString.optional(),
  publishedAt: DateSchema.optional(),
  accessedAt: DateSchema,
  printedPage: z.number().int().positive().optional(),
  pdfPage: z.number().int().positive().optional(),
  tableName: NonEmptyString.optional(),
  sourceRowId: NonEmptyString.optional(),
  sourceDocumentHash: HashSchema.optional(),
  effectiveFrom: DateSchema,
  effectiveTo: DateSchema.optional(),
  verificationStatus: ReviewStatusSchema,
}).superRefine((value, ctx) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must not precede effectiveFrom" });
  }
  if (value.verificationStatus === "owner-approved" && !value.sourceDocumentHash) {
    ctx.addIssue({ code: "custom", path: ["sourceDocumentHash"], message: "owner-approved evidence requires a source document hash" });
  }
});

const PublicationStatusSchema = z.enum([
  "final",
  "provisional",
  "estimated",
  "not-held",
  "not-published",
  "cancelled",
  "restricted",
  "source-unavailable",
]);

const GradeValueRecordSchema = z.record(NonEmptyString, z.number().finite().nonnegative().nullable());

export const GradeBoundaryV2Schema = z.strictObject({
  schemaVersion: z.literal("2.0.0"),
  boundaryId: NonEmptyString,
  qualificationVersionId: NonEmptyString,
  awardQualificationId: NonEmptyString,
  year: z.number().int().min(2019).max(2100),
  series: ExamSeriesSchema,
  routeId: NonEmptyString,
  tier: NonEmptyString.optional(),
  optionCode: NonEmptyString.optional(),
  componentVariants: z.array(NonEmptyString).min(1).optional(),
  region: NonEmptyString.optional(),
  componentCode: NonEmptyString.optional(),
  boundaryScope: z.enum(["component", "overall"]),
  maximumMark: z.number().finite().positive().nullable(),
  gradeOrder: z.array(NonEmptyString).min(1),
  thresholds: GradeValueRecordSchema,
  publicationStatus: PublicationStatusSchema,
  sourceIds: z.array(NonEmptyString),
  verificationStatus: ReviewStatusSchema,
}).superRefine((value, ctx) => {
  if (new Set(value.gradeOrder).size !== value.gradeOrder.length) {
    ctx.addIssue({ code: "custom", path: ["gradeOrder"], message: "gradeOrder must be unique" });
  }
  if (value.componentVariants && new Set(value.componentVariants).size !== value.componentVariants.length) {
    ctx.addIssue({ code: "custom", path: ["componentVariants"], message: "componentVariants must be unique" });
  }
  if (value.boundaryScope === "component" && !value.componentCode) {
    ctx.addIssue({ code: "custom", path: ["componentCode"], message: "component boundaries require componentCode" });
  }
  if (value.boundaryScope === "overall" && value.componentCode) {
    ctx.addIssue({ code: "custom", path: ["componentCode"], message: "overall boundaries must not declare componentCode" });
  }

  const hasNumericThreshold = value.gradeOrder.some(grade => value.thresholds[grade] !== null && value.thresholds[grade] !== undefined);
  const published = value.publicationStatus === "final" || value.publicationStatus === "provisional" || value.publicationStatus === "estimated";
  if (published && (!hasNumericThreshold || value.maximumMark === null)) {
    ctx.addIssue({ code: "custom", path: ["thresholds"], message: "published boundaries require thresholds and maximumMark" });
  }
  if (!published && hasNumericThreshold) {
    ctx.addIssue({ code: "custom", path: ["thresholds"], message: "non-published statuses must not contain numeric thresholds" });
  }
  if (value.verificationStatus === "owner-approved" && value.sourceIds.length === 0) {
    ctx.addIssue({ code: "custom", path: ["sourceIds"], message: "owner-approved boundaries require row-level evidence" });
  }

  let previous = Number.POSITIVE_INFINITY;
  for (const grade of value.gradeOrder) {
    const threshold = value.thresholds[grade];
    if (threshold === null || threshold === undefined) continue;
    if (value.maximumMark !== null && threshold > value.maximumMark) {
      ctx.addIssue({ code: "custom", path: ["thresholds", grade], message: "threshold exceeds maximumMark" });
    }
    if (threshold > previous) {
      ctx.addIssue({ code: "custom", path: ["thresholds", grade], message: "thresholds must be monotonic in gradeOrder" });
    }
    previous = threshold;
  }
});

export const GradeStatisticsV2Schema = z.strictObject({
  schemaVersion: z.literal("2.0.0"),
  statisticsId: NonEmptyString,
  qualificationVersionId: NonEmptyString,
  awardQualificationId: NonEmptyString,
  year: z.number().int().min(2019).max(2100),
  series: ExamSeriesSchema,
  routeId: NonEmptyString.optional(),
  tier: NonEmptyString.optional(),
  regionScope: NonEmptyString,
  populationScope: NonEmptyString.default("all-candidates"),
  statisticsScope: z.enum(["component", "overall"]).default("overall"),
  componentCode: NonEmptyString.optional(),
  candidateCount: z.number().int().nonnegative().nullable(),
  rateKind: z.enum(["cumulative", "exclusive"]),
  gradeOrder: z.array(NonEmptyString).min(1),
  gradeRates: GradeValueRecordSchema,
  rawGradeRates: GradeValueRecordSchema.optional(),
  publicationStatus: z.enum(["final", "provisional", "not-published", "restricted", "source-unavailable"]),
  normalization: z.strictObject({
    originalKind: NonEmptyString,
    normalizedKind: NonEmptyString,
    reason: NonEmptyString,
  }).optional(),
  sourceIds: z.array(NonEmptyString),
  verificationStatus: ReviewStatusSchema,
}).superRefine((value, ctx) => {
  if (value.statisticsScope === "component" && !value.componentCode) {
    ctx.addIssue({ code: "custom", path: ["componentCode"], message: "component statistics require componentCode" });
  }
  if (value.statisticsScope === "overall" && value.componentCode) {
    ctx.addIssue({ code: "custom", path: ["componentCode"], message: "overall statistics must not declare componentCode" });
  }
  if (new Set(value.gradeOrder).size !== value.gradeOrder.length) {
    ctx.addIssue({ code: "custom", path: ["gradeOrder"], message: "gradeOrder must be unique" });
  }
  const rates = value.gradeOrder
    .map(grade => ({ grade, value: value.gradeRates[grade] }))
    .filter((entry): entry is { grade: string; value: number } => entry.value !== null && entry.value !== undefined);
  for (const { grade, value: rate } of rates) {
    if (rate > 100) ctx.addIssue({ code: "custom", path: ["gradeRates", grade], message: "grade rate must be between 0 and 100" });
  }
  if (value.rateKind === "cumulative") {
    for (let index = 1; index < rates.length; index += 1) {
      if (rates[index].value < rates[index - 1].value) {
        ctx.addIssue({ code: "custom", path: ["gradeRates", rates[index].grade], message: "cumulative rates must be non-decreasing" });
      }
    }
  } else {
    const total = rates.reduce((sum, entry) => sum + entry.value, 0);
    if (total > 100.0001) ctx.addIssue({ code: "custom", path: ["gradeRates"], message: "exclusive rates must not total more than 100" });
  }
  if (value.verificationStatus === "owner-approved" && value.sourceIds.length === 0) {
    ctx.addIssue({ code: "custom", path: ["sourceIds"], message: "owner-approved statistics require row-level evidence" });
  }
  if (value.rawGradeRates && !value.normalization) {
    ctx.addIssue({ code: "custom", path: ["normalization"], message: "rawGradeRates require an explicit normalization record" });
  }
});

const ComponentRuleV2Schema = z.strictObject({
  code: NonEmptyString,
  inputKind: z.enum(["raw", "scaled-raw", "ums", "carried-forward"]),
  maximumRawMark: z.number().finite().positive().nullable(),
  maximumAwardMark: z.number().finite().positive(),
  weightingFactor: z.number().finite().positive(),
  optional: z.boolean().default(false),
});

const CombinationSchema = z.strictObject({
  combinationId: NonEmptyString,
  componentCodes: z.array(NonEmptyString).min(1),
  optionCode: NonEmptyString.optional(),
  awardLevel: NonEmptyString,
});

export const QualificationAwardRuleV2Schema = z.strictObject({
  schemaVersion: z.literal("2.0.0"),
  ruleId: NonEmptyString,
  qualificationVersionId: NonEmptyString,
  awardQualificationId: NonEmptyString,
  board: NonEmptyString,
  subjectCode: NonEmptyString,
  routeId: NonEmptyString,
  routeType: z.enum(["linear", "same-series", "staged", "modular"]),
  scoringSystem: z.enum(["raw", "scaled-raw", "UMS", "weighted-raw"]),
  components: z.array(ComponentRuleV2Schema).min(1),
  validCombinations: z.array(CombinationSchema).min(1),
  combinationSelectionRule: z.strictObject({
    selectionMethod: z.enum(["explicit-combination", "best-official-grade"]),
    allowExtraComponentScores: z.boolean(),
    tieBreak: z.enum(["not-applicable", "highest-award-mark"]),
    notes: z.array(NonEmptyString),
  }).optional(),
  boundarySelectionRule: z.strictObject({
    requiresOptionCode: z.boolean(),
    requiresComponentVariants: z.boolean(),
    notes: z.array(NonEmptyString),
  }).optional(),
  totalMaximumAwardMark: z.number().finite().positive(),
  gradeScale: z.array(NonEmptyString).min(1),
  roundingRule: z.enum(["none", "nearest-integer", "official-carry-forward", "board-published"]),
  resitRule: z.strictObject({ allowed: z.boolean(), selectionMethod: NonEmptyString, notes: z.array(NonEmptyString) }),
  carryForwardRule: z.strictObject({ allowed: z.boolean(), maximumMonths: z.number().int().positive().optional(), unit: z.enum(["whole-as", "component", "none"]), notes: z.array(NonEmptyString) }).optional(),
  cashInRule: z.strictObject({ required: z.boolean(), entryCode: NonEmptyString.optional(), notes: z.array(NonEmptyString) }).optional(),
  unitLockingRule: z.strictObject({
    lockedAfterCashIn: z.boolean(),
    unlockAllowed: z.boolean(),
    notes: z.array(NonEmptyString),
  }).optional(),
  aStarRule: z.strictObject({
    available: z.boolean(),
    ruleKind: z.enum(["boundary-only", "overall-plus-advanced-units", "overall-plus-best-advanced-units", "not-available"]),
    overallMinimumAwardMark: z.number().finite().nonnegative().optional(),
    advancedUnitCodes: z.array(NonEmptyString).optional(),
    advancedUnitCount: z.number().int().positive().optional(),
    advancedUnitMinimumAwardMark: z.number().finite().nonnegative().optional(),
    notes: z.array(NonEmptyString),
  }).optional(),
  effectiveFrom: DateSchema,
  effectiveTo: DateSchema.optional(),
  sourceIds: z.array(NonEmptyString).min(1),
  clauseEvidence: z.array(RuleClauseEvidenceV1Schema).min(1),
  verificationStatus: ReviewStatusSchema,
}).superRefine((value, ctx) => {
  const componentCodes = value.components.map(component => component.code);
  if (new Set(componentCodes).size !== componentCodes.length) {
    ctx.addIssue({ code: "custom", path: ["components"], message: "component codes must be unique" });
  }
  const knownCodes = new Set(componentCodes);
  for (const [index, combination] of value.validCombinations.entries()) {
    if (new Set(combination.componentCodes).size !== combination.componentCodes.length) {
      ctx.addIssue({ code: "custom", path: ["validCombinations", index], message: "combination component codes must be unique" });
    }
    for (const code of combination.componentCodes) {
      if (!knownCodes.has(code)) ctx.addIssue({ code: "custom", path: ["validCombinations", index, "componentCodes"], message: `unknown component code ${code}` });
    }
  }
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must not precede effectiveFrom" });
  }
  const clauseNames = value.clauseEvidence.map(item => item.clause);
  if (new Set(clauseNames).size !== clauseNames.length) {
    ctx.addIssue({ code: "custom", path: ["clauseEvidence"], message: "rule clause evidence must use unique clause names" });
  }
  const ruleSourceIds = new Set(value.sourceIds);
  for (const [index, evidence] of value.clauseEvidence.entries()) {
    for (const sourceId of evidence.sourceIds) {
      if (!ruleSourceIds.has(sourceId)) {
        ctx.addIssue({ code: "custom", path: ["clauseEvidence", index, "sourceIds"], message: `unknown rule source ${sourceId}` });
      }
    }
  }
  if (value.aStarRule?.ruleKind === "overall-plus-advanced-units" || value.aStarRule?.ruleKind === "overall-plus-best-advanced-units") {
    if (!value.aStarRule.available || !value.aStarRule.overallMinimumAwardMark || !value.aStarRule.advancedUnitMinimumAwardMark || !(value.aStarRule.advancedUnitCodes?.length)) {
      ctx.addIssue({ code: "custom", path: ["aStarRule"], message: "advanced-unit A* rules require overall and advanced-unit thresholds" });
    } else {
      for (const code of value.aStarRule.advancedUnitCodes) {
        if (!knownCodes.has(code)) ctx.addIssue({ code: "custom", path: ["aStarRule", "advancedUnitCodes"], message: `unknown advanced unit code ${code}` });
      }
    }
    if (value.aStarRule.ruleKind === "overall-plus-best-advanced-units" && (!value.aStarRule.advancedUnitCount || value.aStarRule.advancedUnitCount > (value.aStarRule.advancedUnitCodes?.length ?? 0))) {
      ctx.addIssue({ code: "custom", path: ["aStarRule", "advancedUnitCount"], message: "best-advanced-unit A* rules require a valid unit count" });
    }
  }
});

export const AwardComponentScoreV2Schema = z.strictObject({
  componentCode: NonEmptyString,
  series: z.string().regex(/^\d{4}-(january|march|june|october|november)$/),
  rawMark: z.number().finite().nonnegative().optional(),
  awardMark: z.number().finite().nonnegative().optional(),
});

const AwardInputV2Shape = {
  ruleId: NonEmptyString,
  routeId: NonEmptyString,
  targetSeries: z.string().regex(/^\d{4}-(january|march|june|october|november)$/),
  optionCode: NonEmptyString.optional(),
  componentVariants: z.array(NonEmptyString).min(1).optional(),
  componentScores: z.array(AwardComponentScoreV2Schema).min(1),
};

const validateAwardInputVariants = (value: { componentVariants?: string[] }, ctx: z.RefinementCtx) => {
  if (value.componentVariants && new Set(value.componentVariants).size !== value.componentVariants.length) {
    ctx.addIssue({ code: "custom", path: ["componentVariants"], message: "componentVariants must be unique" });
  }
};

export const AwardCalculationInputV2Schema = z.strictObject({
  ...AwardInputV2Shape,
  combinationId: NonEmptyString,
}).superRefine(validateAwardInputVariants);

export const AwardSelectionInputV2Schema = z.strictObject(AwardInputV2Shape).superRefine(validateAwardInputVariants);

export const AwardCalculationResultV2Schema = z.strictObject({
  ruleId: NonEmptyString,
  routeId: NonEmptyString,
  boundaryId: NonEmptyString,
  combinationId: NonEmptyString,
  targetSeries: NonEmptyString,
  componentAwardMarks: z.record(NonEmptyString, z.number().finite().nonnegative()),
  totalAwardMark: z.number().finite().nonnegative(),
  maximumAwardMark: z.number().finite().positive(),
  grade: NonEmptyString,
  aStarSatisfied: z.boolean().optional(),
  calculationStatus: z.literal("official"),
  sourceIds: z.array(NonEmptyString).min(1),
});

export const AwardSelectionResultV2Schema = z.strictObject({
  selected: AwardCalculationResultV2Schema,
  consideredCombinationIds: z.array(NonEmptyString).min(1),
  selectionMethod: z.literal("best-official-grade"),
});

const DifficultyDimensionSchema = z.strictObject({
  score: z.number().finite().min(0).max(100).nullable(),
  evidenceCoverage: z.number().finite().min(0).max(1),
  sourceIds: z.array(NonEmptyString),
  explanation: NonEmptyString,
});

export const DifficultyProfileV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  profileId: NonEmptyString,
  sourceQualificationVersionId: NonEmptyString,
  sourceRouteId: NonEmptyString,
  sourcePaperIds: z.array(NonEmptyString).min(1).optional(),
  sourceTiers: z.array(NonEmptyString).optional(),
  targetQualificationVersionId: NonEmptyString,
  targetRouteId: NonEmptyString,
  targetPaperIds: z.array(NonEmptyString).min(1).optional(),
  targetTiers: z.array(NonEmptyString).optional(),
  direction: z.literal("source-to-target"),
  weights: z.strictObject({ contentGap: z.literal(0.30), depthUplift: z.literal(0.25), assessmentDemand: z.literal(0.20), questionComplexity: z.literal(0.15), empiricalDemand: z.literal(0.10) }),
  dimensions: z.strictObject({
    contentGap: DifficultyDimensionSchema,
    depthUplift: DifficultyDimensionSchema,
    assessmentDemand: DifficultyDimensionSchema,
    questionComplexity: DifficultyDimensionSchema,
    empiricalDemand: DifficultyDimensionSchema,
  }),
  score: z.number().finite().min(0).max(100),
  interval: z.tuple([z.number().finite().min(0).max(100), z.number().finite().min(0).max(100)]),
  evidenceCoverage: z.number().finite().min(0).max(1),
  confidence: z.enum(["high", "medium", "low"]),
  methodVersion: z.literal("exambridge-transition-difficulty-v1"),
  verificationStatus: ReviewStatusSchema,
}).refine(value => value.interval[0] <= value.score && value.score <= value.interval[1], {
  path: ["interval"], message: "difficulty score must sit inside its interval",
});

export const BoundaryPredictionV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  predictionId: NonEmptyString,
  qualificationVersionId: NonEmptyString,
  awardQualificationId: NonEmptyString,
  routeId: NonEmptyString,
  tier: NonEmptyString.optional(),
  optionCode: NonEmptyString.optional(),
  targetYear: z.number().int().min(2019).max(2100),
  targetSeries: ExamSeriesSchema,
  maximumMark: z.number().finite().positive(),
  gradeOrder: z.array(NonEmptyString).min(1),
  predictedThresholds: GradeValueRecordSchema,
  intervals: z.record(NonEmptyString, z.tuple([
    z.number().finite().nonnegative(),
    z.number().finite().nonnegative(),
  ])),
  sampleBoundaryIds: z.array(NonEmptyString).min(3).max(5),
  sampleSeries: z.array(z.string().regex(/^\d{4}-(january|march|june|october|november)$/)).min(3).max(5),
  dataCutoff: DateSchema,
  methodVersion: z.literal("exambridge-boundary-prediction-v1"),
  confidence: z.enum(["high", "medium", "low"]),
  disclaimerVersion: NonEmptyString,
  verificationStatus: z.literal("candidate"),
}).superRefine((value, ctx) => {
  if (new Set(value.sampleBoundaryIds).size !== value.sampleBoundaryIds.length) {
    ctx.addIssue({ code: "custom", path: ["sampleBoundaryIds"], message: "sample boundary IDs must be unique" });
  }
  if (new Set(value.sampleSeries).size !== value.sampleSeries.length) {
    ctx.addIssue({ code: "custom", path: ["sampleSeries"], message: "sample series must be unique" });
  }
  for (const grade of value.gradeOrder) {
    const threshold = value.predictedThresholds[grade];
    if (threshold === null || threshold === undefined) continue;
    if (threshold > value.maximumMark) {
      ctx.addIssue({ code: "custom", path: ["predictedThresholds", grade], message: "prediction exceeds maximumMark" });
    }
    const interval = value.intervals[grade];
    if (!interval || interval[0] > threshold || threshold > interval[1] || interval[1] > value.maximumMark) {
      ctx.addIssue({ code: "custom", path: ["intervals", grade], message: "prediction must sit inside a valid interval" });
    }
  }
});

export const StudentMasteryProfileV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  profileVersion: z.literal(1),
  knowledgeBatchId: NonEmptyString,
  sourceQualificationVersionId: NonEmptyString,
  sourceRouteId: NonEmptyString,
  targetQualificationVersionId: NonEmptyString,
  targetRouteId: NonEmptyString,
  mastery: z.array(z.strictObject({
    nodeId: NonEmptyString,
    level: z.enum(["not-studied", "weak", "basic", "proficient"]),
  })),
  targetExamDate: DateSchema.optional(),
  weeklyStudyHours: z.number().finite().min(0).max(168).optional(),
  updatedAt: DateTimeSchema,
}).refine(value => new Set(value.mastery.map(item => item.nodeId)).size === value.mastery.length, {
  path: ["mastery"], message: "mastery node IDs must be unique",
});

export const ExternalEvidenceV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  evidenceId: NonEmptyString,
  provider: z.literal("openai-web-search"),
  requestedModel: NonEmptyString,
  returnedModel: NonEmptyString,
  query: NonEmptyString,
  board: NonEmptyString,
  qualificationCode: NonEmptyString,
  year: z.number().int().min(2019).max(2100).optional(),
  series: ExamSeriesSchema.optional(),
  officialUrl: z.string().url(),
  documentTitle: NonEmptyString,
  locator: NonEmptyString.optional(),
  retrievedAt: DateTimeSchema,
  allowedDomain: z.boolean(),
  exactIdentityMatch: z.boolean(),
  numericValidationPassed: z.boolean(),
  conflictsWithActive: z.boolean(),
  directAnswerEligible: z.boolean(),
  verificationStatus: z.literal("candidate"),
}).superRefine((value, ctx) => {
  if (value.directAnswerEligible && (!value.allowedDomain || !value.exactIdentityMatch || !value.numericValidationPassed || value.conflictsWithActive || !value.locator)) {
    ctx.addIssue({ code: "custom", path: ["directAnswerEligible"], message: "direct answers require allow-listed, exact, validated, non-conflicting evidence with a locator" });
  }
});

export const AcademicResultsManifestV2Schema = z.strictObject({
  schemaVersion: z.literal("2.0.0"),
  activationBatch: NonEmptyString.nullable(),
  sources: z.array(SourceEvidenceV1Schema),
  boundaries: z.array(GradeBoundaryV2Schema),
  statistics: z.array(GradeStatisticsV2Schema),
  awardRules: z.array(QualificationAwardRuleV2Schema),
  difficultyProfiles: z.array(DifficultyProfileV1Schema),
});

export type SourceEvidenceV1 = z.infer<typeof SourceEvidenceV1Schema>;
export type QualificationVersionIdentityV2 = z.infer<typeof QualificationVersionIdentityV2Schema>;
export type QualificationIdentityV2 = z.infer<typeof QualificationIdentityV2Schema>;
export type QualificationIdentityCatalogV2 = z.infer<typeof QualificationIdentityCatalogV2Schema>;
export type AdministrationStatusV1 = z.infer<typeof AdministrationStatusV1Schema>;
export type CoverageResolutionStatusV1 = z.infer<typeof CoverageResolutionStatusV1Schema>;
export type CoverageExpectationPolicyV1 = z.infer<typeof CoverageExpectationPolicyV1Schema>;
export type CoverageExpectationPolicyCatalogV1 = z.infer<typeof CoverageExpectationPolicyCatalogV1Schema>;
export type BoundaryCoverageMatrixV1 = z.infer<typeof BoundaryCoverageMatrixV1Schema>;
export type StatisticsCoverageMatrixV1 = z.infer<typeof StatisticsCoverageMatrixV1Schema>;
export type RuleCoverageMatrixV1 = z.infer<typeof RuleCoverageMatrixV1Schema>;
export type QualificationFactCardV1 = z.infer<typeof QualificationFactCardV1Schema>;
export type QualificationFactCardCatalogV1 = z.infer<typeof QualificationFactCardCatalogV1Schema>;
export type QualificationFactGapV1 = z.infer<typeof QualificationFactGapV1Schema>;
export type QualificationFactGapReportV1 = z.infer<typeof QualificationFactGapReportV1Schema>;
export type GradeBoundaryV2 = z.infer<typeof GradeBoundaryV2Schema>;
export type GradeStatisticsV2 = z.infer<typeof GradeStatisticsV2Schema>;
export type QualificationAwardRuleV2 = z.infer<typeof QualificationAwardRuleV2Schema>;
export type AwardComponentScoreV2 = z.infer<typeof AwardComponentScoreV2Schema>;
export type AwardCalculationInputV2 = z.infer<typeof AwardCalculationInputV2Schema>;
export type AwardCalculationResultV2 = z.infer<typeof AwardCalculationResultV2Schema>;
export type AwardSelectionInputV2 = z.infer<typeof AwardSelectionInputV2Schema>;
export type AwardSelectionResultV2 = z.infer<typeof AwardSelectionResultV2Schema>;
export type DifficultyProfileV1 = z.infer<typeof DifficultyProfileV1Schema>;
export type BoundaryPredictionV1 = z.infer<typeof BoundaryPredictionV1Schema>;
export type StudentMasteryProfileV1 = z.infer<typeof StudentMasteryProfileV1Schema>;
export type ExternalEvidenceV1 = z.infer<typeof ExternalEvidenceV1Schema>;
export type AcademicResultsManifestV2 = z.infer<typeof AcademicResultsManifestV2Schema>;
