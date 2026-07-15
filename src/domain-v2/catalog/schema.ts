/**
 * Canonical Exam Catalog — Zod Schemas and TypeScript Types
 *
 * All catalog entities use Zod for runtime validation.
 * Types are inferred from schemas to guarantee consistency.
 *
 * Phase 1: YMA01 (Pearson Edexcel IAL Mathematics) as first vertical slice.
 */

import { z } from "zod";

// ── Shared primitives ──────────────────────────────────────────────────────

export const SourceRefSchema = z.object({
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  documentVersion: z.string().optional(),
  publishedAt: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(),
  accessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  page: z.string().optional(),
  note: z.string().optional(),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

export const VerificationStatusSchema = z.enum([
  "verified",
  "unverified",
  "conflicted",
  "unsupported",
]);

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const DomainWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type DomainWarning = z.infer<typeof DomainWarningSchema>;

export const DomainErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type DomainError = z.infer<typeof DomainErrorSchema>;

// ── Board ──────────────────────────────────────────────────────────────────

export const BoardSchema = z.object({
  id: z.string().regex(/^board:[a-z0-9-]+$/),
  code: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
});

export type Board = z.infer<typeof BoardSchema>;

// ── Grading Scale ──────────────────────────────────────────────────────────

export const GradeThresholdSchema = z.object({
  grade: z.string().min(1),
  minMark: z.number().int().nonnegative(),
});

export type GradeThreshold = z.infer<typeof GradeThresholdSchema>;

export const GradingScaleSchema = z.object({
  id: z.string().regex(/^scale:[a-z0-9-:]+$/),
  name: z.string().min(1),
  kind: z.enum(["A_STAR_TO_E", "A_TO_E", "NINE_TO_ONE", "A_STAR_TO_G", "OTHER"]),
  thresholds: z.array(GradeThresholdSchema).refine(
    (t) => t.length >= 2,
    "Grading scale must have at least 2 thresholds"
  ),
  hasAStar: z.boolean().default(false),
  sources: z.array(SourceRefSchema).default([]),
});

export type GradingScale = z.infer<typeof GradingScaleSchema>;

// ── Qualification ──────────────────────────────────────────────────────────

export const QualificationSchema = z.object({
  id: z.string().regex(/^qual:[a-z0-9-:]+$/),
  boardId: z.string(),
  level: z.enum(["GCSE", "IGCSE", "AS", "A_LEVEL", "IAL", "OTHER"]),
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  gradingScaleId: z.string(),
  specificationIds: z.array(z.string()),
  status: VerificationStatusSchema,
  sources: z.array(SourceRefSchema).default([]),
});

export type Qualification = z.infer<typeof QualificationSchema>;

// ── Specification Version ──────────────────────────────────────────────────

export const SpecificationVersionSchema = z.object({
  id: z.string().regex(/^spec:[a-z0-9-:]+$/),
  qualificationId: z.string(),
  label: z.string().min(1),
  validFrom: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/),
  validTo: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(),
  routeIds: z.array(z.string()).default([]),
  unitIds: z.array(z.string()).default([]),
  status: VerificationStatusSchema,
  sources: z.array(SourceRefSchema).default([]),
});

export type SpecificationVersion = z.infer<typeof SpecificationVersionSchema>;

// ── Assessment Unit ────────────────────────────────────────────────────────

export const AssessmentUnitSchema = z.object({
  id: z.string().regex(/^unit:[a-z0-9-:]+$/),
  specificationId: z.string(),
  code: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  name: z.string().min(1),
  stage: z.enum(["AS", "A2", "FULL"]).optional(),
  rawMax: z.number().int().positive().optional(),
  umsMax: z.number().int().positive().optional(),
  weight: z.number().positive().optional(),
  paperIds: z.array(z.string()).default([]),
  status: VerificationStatusSchema,
  sources: z.array(SourceRefSchema).default([]),
});

export type AssessmentUnit = z.infer<typeof AssessmentUnitSchema>;

// ── Paper ──────────────────────────────────────────────────────────────────

export const PaperSchema = z.object({
  id: z.string().regex(/^paper:[a-z0-9-:]+$/),
  unitId: z.string().optional(),
  qualificationId: z.string(),
  numberOrCode: z.string().min(1),
  name: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
  rawMax: z.number().int().positive().optional(),
  weight: z.number().positive().optional(),
  calculatorAllowed: z.boolean().optional(),
  paperType: z.enum(["WRITTEN", "PRACTICAL", "COURSEWORK", "OTHER"]).optional(),
  variantIds: z.array(z.string()).default([]),
  sources: z.array(SourceRefSchema).default([]),
});

export type Paper = z.infer<typeof PaperSchema>;

// ── Paper Variant ──────────────────────────────────────────────────────────

export const PaperVariantSchema = z.object({
  id: z.string().regex(/^variant:[a-z0-9-:]+$/),
  paperId: z.string(),
  code: z.string().min(1),
  zone: z.string().optional(),
  aliases: z.array(z.string()).default([]),
});

export type PaperVariant = z.infer<typeof PaperVariantSchema>;

// ── Exam Sitting ───────────────────────────────────────────────────────────

export const ExamSittingSchema = z.object({
  id: z.string().regex(/^sitting:[a-z0-9-:]+$/),
  paperVariantId: z.string(),
  series: z.string().min(1), // canonical, e.g. "2025-june"
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTimeLocal: z.string().optional(),
  timezone: z.string().optional(),
  status: VerificationStatusSchema,
  sources: z.array(SourceRefSchema).default([]),
});

export type ExamSitting = z.infer<typeof ExamSittingSchema>;

// ── Boundary Set ───────────────────────────────────────────────────────────

export const BoundaryThresholdSchema = z.object({
  grade: z.string().min(1),
  minMark: z.number().int().nonnegative(),
});

export type BoundaryThreshold = z.infer<typeof BoundaryThresholdSchema>;

export const BoundarySetSchema = z.object({
  id: z.string().regex(/^boundary:[a-z0-9-:]+$/),
  paperVariantId: z.string().optional(),
  unitId: z.string().optional(),
  qualificationId: z.string().optional(),
  series: z.string().min(1),
  maxMark: z.number().int().positive(),
  thresholds: z.array(BoundaryThresholdSchema),
  scale: z.enum(["RAW", "UMS", "PUM", "GNS"]),
  variantLabel: z.string().optional(),
  status: VerificationStatusSchema,
  sources: z.array(SourceRefSchema).default([]),
}).refine(
  (b) => b.thresholds.every((t) => t.minMark >= 0 && t.minMark <= b.maxMark),
  "All thresholds must be within [0, maxMark]"
);

export type BoundarySet = z.infer<typeof BoundarySetSchema>;

// ── Award Route (Selection Rules) ──────────────────────────────────────────

export const SelectionRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("REQUIRE_ALL"), unitIds: z.array(z.string()) }),
  z.object({ kind: z.literal("EXACTLY_N_FROM"), count: z.number().int().positive(), unitIds: z.array(z.string()) }),
  z.object({ kind: z.literal("AT_LEAST_N_FROM"), count: z.number().int().nonnegative(), unitIds: z.array(z.string()) }),
  z.object({ kind: z.literal("ONE_OF_GROUPS"), groups: z.array(z.array(z.string())) }),
  z.object({ kind: z.literal("MUTUALLY_EXCLUSIVE"), unitIds: z.array(z.string()) }),
  z.object({ kind: z.literal("TOTAL_UNIT_COUNT"), count: z.number().int().positive() }),
  z.object({ kind: z.literal("NO_DUPLICATES") }),
]);

export type SelectionRule = z.infer<typeof SelectionRuleSchema>;

export const AwardRouteSchema = z.object({
  id: z.string().regex(/^route:[a-z0-9-:]+$/),
  specificationId: z.string(),
  name: z.string().min(1),
  awardType: z.enum(["AS", "FULL"]),
  selectionRules: z.array(SelectionRuleSchema).min(1),
  aggregationPolicyId: z.string(),
  gradePolicyId: z.string(),
  aStarPolicyId: z.string().optional(),
  status: VerificationStatusSchema,
  sources: z.array(SourceRefSchema).default([]),
});

export type AwardRoute = z.infer<typeof AwardRouteSchema>;

// ── Aggregation Policy ─────────────────────────────────────────────────────

export const AggregationPolicySchema = z.object({
  id: z.string().regex(/^agg:[a-z0-9-:]+$/),
  name: z.string().min(1),
  method: z.enum(["SUM_UMS", "WEIGHTED_AVERAGE_PUM", "SUM_RAW", "OTHER"]),
  description: z.string().optional(),
  sources: z.array(SourceRefSchema).default([]),
});

export type AggregationPolicy = z.infer<typeof AggregationPolicySchema>;

// ── Grade Policy ───────────────────────────────────────────────────────────

export const GradePolicySchema = z.object({
  id: z.string().regex(/^grade:[a-z0-9-:]+$/),
  name: z.string().min(1),
  gradingScaleId: z.string(),
  // Percentage of max total required for each grade (override of scale defaults)
  gradeThresholds: z.record(z.string(), z.number().min(0).max(1)).optional(),
  sources: z.array(SourceRefSchema).default([]),
});

export type GradePolicy = z.infer<typeof GradePolicySchema>;

// ── A* Policy ──────────────────────────────────────────────────────────────

export const AStarPolicySchema = z.object({
  id: z.string().regex(/^astar:[a-z0-9-:]+$/),
  name: z.string().min(1),
  // A* requires ALL of these conditions
  conditions: z.array(z.object({
    kind: z.enum(["TOTAL_MIN", "A2_AVERAGE_MIN", "UNIT_PAIR_MIN", "UNIT_MIN"]),
    // For TOTAL_MIN: minTotal (absolute UMS/raw)
    // For A2_AVERAGE_MIN: minAverage (percentage 0-1)
    // For UNIT_PAIR_MIN: unitIds + minSum
    // For UNIT_MIN: unitId + minScore
    unitIds: z.array(z.string()).optional(),
    unitId: z.string().optional(),
    minTotal: z.number().optional(),
    minAverage: z.number().optional(),
    minSum: z.number().optional(),
    minScore: z.number().optional(),
  })).min(1),
  sources: z.array(SourceRefSchema).default([]),
});

export type AStarPolicy = z.infer<typeof AStarPolicySchema>;

// ── Calculation Policy ─────────────────────────────────────────────────────

export const CalculationPolicySchema = z.object({
  id: z.string().regex(/^policy:[a-z0-9-:]+$/),
  name: z.string().min(1),
  kind: z.enum(["CAIE_PUM", "PEARSON_UMS", "RAW_AGGREGATE", "GNS"]),
  description: z.string().optional(),
  sources: z.array(SourceRefSchema).default([]),
});

export type CalculationPolicy = z.infer<typeof CalculationPolicySchema>;

// ── Full Catalog ───────────────────────────────────────────────────────────

export const ExamCatalogSchema = z.object({
  schemaVersion: z.string().default("1.0.0"),
  generatedAt: z.string().datetime(),
  boards: z.array(BoardSchema),
  qualifications: z.array(QualificationSchema),
  specifications: z.array(SpecificationVersionSchema),
  units: z.array(AssessmentUnitSchema),
  papers: z.array(PaperSchema),
  paperVariants: z.array(PaperVariantSchema),
  sittings: z.array(ExamSittingSchema),
  boundarySets: z.array(BoundarySetSchema),
  routes: z.array(AwardRouteSchema),
  gradingScales: z.array(GradingScaleSchema),
  aggregationPolicies: z.array(AggregationPolicySchema),
  gradePolicies: z.array(GradePolicySchema),
  aStarPolicies: z.array(AStarPolicySchema),
  calculationPolicies: z.array(CalculationPolicySchema),
});

export type ExamCatalog = z.infer<typeof ExamCatalogSchema>;
