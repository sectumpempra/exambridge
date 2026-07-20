import { z } from "zod";

const GradeSchema = z.enum(["A*", "A", "B", "C", "D", "E", "a", "b", "c", "d", "e"]);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const QualificationBoardPairs = new Set(["AQA|7357", "OCR|H240", "OCR|6993", "CAIE|9709", "Edexcel UK|8MA0"]);
const OfficialSourceReferenceFields = {
  sourceUrl: z.string().url(),
  publishedAt: z.string().min(1),
  accessedAt: z.string().min(1),
  sourceRowId: z.string().min(1),
  sourceDocumentHash: HashSchema,
};

const thresholdsAreValid = (thresholds: Record<string, number>, max: number) => {
  const values = Object.values(thresholds);
  return values.length > 0 && values.every(Number.isFinite) &&
    values.every(value => value >= 0 && value <= max) &&
    values.every((value, index) => index === 0 || value <= values[index - 1]);
};

export const AwardComponentSchema = z.object({
  code: z.string().min(1),
  inputKind: z.enum(["raw", "carried-forward"]),
  maxRawMark: z.number().positive(),
  weightingFactor: z.number().positive(),
});

export const OfficialSourceReferenceSchema = z.strictObject(OfficialSourceReferenceFields);

export const OfficialAwardRouteSchema = z.object({
  id: z.string().min(1),
  board: z.enum(["AQA", "OCR", "CAIE", "Edexcel UK"]),
  qualificationCode: z.enum(["7357", "H240", "6993", "9709", "8MA0"]),
  level: z.enum(["A-Level", "AS-Level", "Level 3 FSMQ"]),
  specificationVersion: z.string().min(1),
  routeType: z.enum(["linear", "same-series", "staged"]),
  routeKey: z.string().min(1),
  optionCode: z.string().min(1).optional(),
  components: z.array(AwardComponentSchema).min(1),
  maximumMarkAfterWeighting: z.number().positive(),
  roundingRule: z.enum(["none", "nearest-integer", "official-carry-forward"]),
  grades: z.array(GradeSchema).min(1),
  ...OfficialSourceReferenceFields,
  supportingSources: z.array(OfficialSourceReferenceSchema).default([]),
  verificationStatus: z.literal("verified"),
}).refine(value => QualificationBoardPairs.has(`${value.board}|${value.qualificationCode}`), {
  path: ["qualificationCode"],
  message: "Qualification code must match the awarding board",
});

export const OfficialAwardBoundarySchema = z.object({
  source: z.literal("official"),
  routeId: z.string().min(1),
  series: z.string().regex(/^\d{4}-(march|june|november)$/),
  optionCode: z.string().min(1).optional(),
  componentVariants: z.array(z.string().min(1)).min(1),
  maximumMarkAfterWeighting: z.number().positive(),
  thresholds: z.record(z.string(), z.number()),
  ...OfficialSourceReferenceFields,
  verificationStatus: z.literal("verified"),
}).superRefine((value, ctx) => {
  if (!thresholdsAreValid(value.thresholds, value.maximumMarkAfterWeighting)) {
    ctx.addIssue({ code: "custom", path: ["thresholds"], message: "Thresholds must be monotonic and within the maximum mark" });
  }
});

const EstimateBandSchema = z.object({
  centre: z.number().nonnegative(), lower: z.number().nonnegative(), upper: z.number().nonnegative(),
}).refine(value => value.lower <= value.centre && value.centre <= value.upper, "Estimate band must contain its centre");

export const EstimatedAwardBoundarySchema = z.object({
  source: z.literal("estimated"),
  methodVersion: z.literal("historical-weighted-median-v1"),
  routeId: z.string().min(1),
  targetSeries: z.string().regex(/^\d{4}-(march|june|november)$/),
  optionCode: z.string().min(1).optional(),
  componentVariants: z.array(z.string().min(1)).min(1),
  maximumMarkAfterWeighting: z.number().positive(),
  sampleSeries: z.array(z.string()).min(3).max(5),
  sampleSize: z.number().int().min(3).max(5),
  thresholds: z.record(z.string(), EstimateBandSchema),
  confidence: z.enum(["high", "medium", "low"]),
  dataAsOf: z.string().min(1),
  inputManifestHash: HashSchema,
  contentHash: HashSchema,
  isOfficial: z.literal(false),
}).refine(value => value.sampleSize === value.sampleSeries.length, "Sample size must match sample series")
  .superRefine((value, ctx) => {
    const bands = Object.values(value.thresholds);
    const inRange = bands.every(band => band.upper <= value.maximumMarkAfterWeighting);
    const monotonic = bands.every((band, index) => index === 0 ||
      band.centre <= bands[index - 1].centre && band.lower <= bands[index - 1].lower && band.upper <= bands[index - 1].upper);
    if (!inRange || !monotonic) ctx.addIssue({
      code: "custom", path: ["thresholds"], message: "Estimate bands must be monotonic and within the maximum mark",
    });
  });

export const AwardScoreInputSchema = z.object({
  componentCode: z.string().min(1),
  variant: z.string().min(1).optional(),
  series: z.string().regex(/^\d{4}-(march|june|november)$/),
  rawScore: z.number().finite().int().nonnegative(),
  inputKind: z.enum(["raw", "carried-forward"]).default("raw"),
});

export const AwardCalculationInputSchema = z.object({
  routeId: z.string().min(1),
  series: z.string().regex(/^\d{4}-(march|june|november)$/),
  optionCode: z.string().min(1).optional(),
  scores: z.array(AwardScoreInputSchema).min(1),
  estimateConsent: z.boolean(),
});

export const AwardCalculationResultSchema = z.object({
  source: z.enum(["official", "estimated"]),
  routeId: z.string(), series: z.string(), optionCode: z.string().optional(),
  total: z.number(), maximumMarkAfterWeighting: z.number().positive(),
  grade: z.string(), gradeRange: z.tuple([z.string(), z.string()]).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  sampleSeries: z.array(z.string()).optional(), methodVersion: z.string().optional(),
  warning: z.string().optional(), sourceUrls: z.array(z.string().url()),
});

export const GradeCalculationAvailabilitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("official"), routeIds: z.array(z.string()).min(1) }),
  z.object({ status: z.literal("estimated"), routeIds: z.array(z.string()).min(1), disclaimerRequired: z.literal(true) }),
  z.object({ status: z.literal("unavailable"), reason: z.string().min(1) }),
]);

export type OfficialAwardRoute = z.infer<typeof OfficialAwardRouteSchema>;
export type OfficialAwardBoundary = z.infer<typeof OfficialAwardBoundarySchema>;
export type EstimatedAwardBoundary = z.infer<typeof EstimatedAwardBoundarySchema>;
export type AwardCalculationInput = z.infer<typeof AwardCalculationInputSchema>;
export type AwardCalculationResult = z.infer<typeof AwardCalculationResultSchema>;
export type GradeCalculationAvailability = z.infer<typeof GradeCalculationAvailabilitySchema>;
