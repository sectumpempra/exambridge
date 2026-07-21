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

export const ExamSeriesSchema = z.enum(["january", "march", "june", "november", "other"]);

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
  totalMaximumAwardMark: z.number().finite().positive(),
  gradeScale: z.array(NonEmptyString).min(1),
  roundingRule: z.enum(["none", "nearest-integer", "official-carry-forward", "board-published"]),
  resitRule: z.strictObject({ allowed: z.boolean(), selectionMethod: NonEmptyString, notes: z.array(NonEmptyString) }),
  carryForwardRule: z.strictObject({ allowed: z.boolean(), maximumMonths: z.number().int().positive().optional(), unit: z.enum(["whole-as", "component", "none"]), notes: z.array(NonEmptyString) }).optional(),
  cashInRule: z.strictObject({ required: z.boolean(), entryCode: NonEmptyString.optional(), notes: z.array(NonEmptyString) }).optional(),
  aStarRule: z.strictObject({
    available: z.boolean(),
    ruleKind: z.enum(["boundary-only", "overall-plus-advanced-units", "not-available"]),
    overallMinimumAwardMark: z.number().finite().nonnegative().optional(),
    advancedUnitCodes: z.array(NonEmptyString).optional(),
    advancedUnitMinimumAwardMark: z.number().finite().nonnegative().optional(),
    notes: z.array(NonEmptyString),
  }).optional(),
  effectiveFrom: DateSchema,
  effectiveTo: DateSchema.optional(),
  sourceIds: z.array(NonEmptyString).min(1),
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
  if (value.aStarRule?.ruleKind === "overall-plus-advanced-units") {
    if (!value.aStarRule.available || !value.aStarRule.overallMinimumAwardMark || !value.aStarRule.advancedUnitMinimumAwardMark || !(value.aStarRule.advancedUnitCodes?.length)) {
      ctx.addIssue({ code: "custom", path: ["aStarRule"], message: "advanced-unit A* rules require overall and advanced-unit thresholds" });
    } else {
      for (const code of value.aStarRule.advancedUnitCodes) {
        if (!knownCodes.has(code)) ctx.addIssue({ code: "custom", path: ["aStarRule", "advancedUnitCodes"], message: `unknown advanced unit code ${code}` });
      }
    }
  }
});

export const AwardComponentScoreV2Schema = z.strictObject({
  componentCode: NonEmptyString,
  series: z.string().regex(/^\d{4}-(january|march|june|november)$/),
  rawMark: z.number().finite().nonnegative().optional(),
  awardMark: z.number().finite().nonnegative().optional(),
});

export const AwardCalculationInputV2Schema = z.strictObject({
  ruleId: NonEmptyString,
  routeId: NonEmptyString,
  targetSeries: z.string().regex(/^\d{4}-(january|march|june|november)$/),
  combinationId: NonEmptyString,
  componentScores: z.array(AwardComponentScoreV2Schema).min(1),
});

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
  targetQualificationVersionId: NonEmptyString,
  targetRouteId: NonEmptyString,
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

export type SourceEvidenceV1 = z.infer<typeof SourceEvidenceV1Schema>;
export type GradeBoundaryV2 = z.infer<typeof GradeBoundaryV2Schema>;
export type GradeStatisticsV2 = z.infer<typeof GradeStatisticsV2Schema>;
export type QualificationAwardRuleV2 = z.infer<typeof QualificationAwardRuleV2Schema>;
export type AwardComponentScoreV2 = z.infer<typeof AwardComponentScoreV2Schema>;
export type AwardCalculationInputV2 = z.infer<typeof AwardCalculationInputV2Schema>;
export type AwardCalculationResultV2 = z.infer<typeof AwardCalculationResultV2Schema>;
export type DifficultyProfileV1 = z.infer<typeof DifficultyProfileV1Schema>;
export type StudentMasteryProfileV1 = z.infer<typeof StudentMasteryProfileV1Schema>;
export type ExternalEvidenceV1 = z.infer<typeof ExternalEvidenceV1Schema>;
