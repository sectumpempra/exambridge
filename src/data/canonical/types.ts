import { z } from "zod";

export const VerificationStatusSchema = z.enum([
  "verified",
  "unverified",
  "not-held",
  "not-published",
  "quarantined",
  "archived",
]);

export const CanonicalBoundaryRecordSchema = z.object({
  id: z.string().min(1),
  board: z.string().min(1),
  qualification: z.string().min(1),
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  series: z.string().min(1),
  component: z.string().min(1),
  tier: z.string().nullable(),
  route: z.string().nullable(),
  maxMark: z.number().positive(),
  thresholds: z.record(z.string(), z.number().nonnegative().nullable()),
  sourceUrl: z.string().url(),
  publishedAt: z.string().nullable(),
  accessedAt: z.string(),
  sourceRowId: z.string().min(1),
  verificationStatus: VerificationStatusSchema,
  extractionMethod: z.enum(["official-json", "official-pdf", "legacy-import"]),
});

export const ResultStatisticRecordSchema = z.object({
  id: z.string().min(1),
  board: z.string().min(1),
  qualification: z.string().min(1),
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  series: z.string().min(1),
  entries: z.number().int().nonnegative().nullable(),
  cumulativeRates: z.record(z.string(), z.number().min(0).max(100).nullable()),
  sourceUrl: z.string().url(),
  accessedAt: z.string(),
  sourceRowId: z.string().min(1),
  verificationStatus: VerificationStatusSchema,
});

export type CanonicalBoundaryRecord = z.infer<typeof CanonicalBoundaryRecordSchema>;
export type ResultStatisticRecord = z.infer<typeof ResultStatisticRecordSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
