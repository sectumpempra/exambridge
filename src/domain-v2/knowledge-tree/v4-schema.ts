import { z } from "zod";

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const SourceEvidenceSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  documentVersion: z.string().min(1),
  locator: z.string().min(1),
  accessedAt: IsoDateSchema,
  sha256: Sha256Schema,
  sourceType: z.literal("official"),
});

const PaperApplicabilitySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("fixed"),
    papers: z.array(z.string().min(1)).min(1),
    evidence: z.array(SourceEvidenceSchema).min(1),
  }),
  z.object({
    kind: z.literal("eligible"),
    papers: z.array(z.string().min(1)).min(1),
    evidence: z.array(SourceEvidenceSchema).min(1),
  }),
  z.object({ kind: z.literal("not-specified") }),
]);

export const SyllabusPointMappingSchema = z.object({
  syllabusPointId: z.string().min(1),
  sourceReference: z.string().min(1),
  canonicalNodeIds: z.array(z.string().min(1)),
  unmappedReason: z.string().min(1).optional(),
  relation: z.enum(["exact", "broader", "narrower", "partial"]),
  assessmentDepth: z.enum(["knowledge", "application", "reasoning", "proof"]),
  paperApplicability: PaperApplicabilitySchema,
  reviewNotes: z.array(z.string().min(1)),
}).superRefine((point, context) => {
  if (point.canonicalNodeIds.length === 0 && !point.unmappedReason) {
    context.addIssue({ code: "custom", path: ["unmappedReason"], message: "Unmapped points require a reason." });
  }
  if (point.canonicalNodeIds.length > 0 && point.unmappedReason) {
    context.addIssue({ code: "custom", path: ["unmappedReason"], message: "Mapped points cannot also be marked unmapped." });
  }
});

export const KnowledgeMappingV4Schema = z.object({
  schemaVersion: z.literal("4.0.0"),
  qualificationVersionId: z.string().min(1),
  board: z.string().min(1),
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  level: z.string().min(1),
  syllabusVersion: z.string().min(1),
  effectiveFrom: IsoDateSchema,
  effectiveTo: IsoDateSchema.optional(),
  sources: z.array(SourceEvidenceSchema).min(1),
  reviewStatus: z.enum(["candidate", "machine-reviewed", "owner-approved", "rejected"]),
  review: z.object({
    generatedAt: IsoDateSchema,
    promptVersion: z.string().min(1).optional(),
    requestedModelId: z.string().min(1).optional(),
    responseModelId: z.string().min(1).optional(),
    reviewedAt: IsoDateSchema.optional(),
    approvedAt: IsoDateSchema.optional(),
    approvalBatch: z.string().min(1).optional(),
  }),
  declaredPapers: z.array(z.string().min(1)),
  syllabusPoints: z.array(SyllabusPointMappingSchema).min(1),
}).superRefine((mapping, context) => {
  if (mapping.effectiveTo && mapping.effectiveTo < mapping.effectiveFrom) {
    context.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo precedes effectiveFrom." });
  }
  if (mapping.review.requestedModelId || mapping.review.responseModelId) {
    if (mapping.review.requestedModelId !== "kimi-k2.7-code-highspeed" || mapping.review.responseModelId !== "kimi-k2.7-code-highspeed") {
      context.addIssue({ code: "custom", path: ["review"], message: "Kimi candidates must use the approved model." });
    }
  }
  if (mapping.reviewStatus === "owner-approved" && (!mapping.review.approvedAt || !mapping.review.approvalBatch)) {
    context.addIssue({ code: "custom", path: ["review"], message: "Owner-approved mappings require approval provenance." });
  }
});

export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;
export type SyllabusPointMapping = z.infer<typeof SyllabusPointMappingSchema>;
export type KnowledgeMappingV4 = z.infer<typeof KnowledgeMappingV4Schema>;
