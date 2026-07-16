import { z } from "zod";

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const PastPaperMaterialTypeSchema = z.enum([
  "question-paper",
  "mark-scheme",
  "examiner-report",
  "insert",
  "data-booklet",
  "audio",
  "source-file",
]);

export const PastPaperAssetSchema = z.object({
  id: z.string().min(1),
  paperSetId: z.string().min(1).optional(),
  paperCode: z.string().min(1).optional(),
  componentCode: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(2200),
  series: z.enum(["january", "march", "june", "november", "specimen"]),
  materialType: PastPaperMaterialTypeSchema,
  title: z.string().min(1),
  sourcePageUrl: z.string().url(),
  officialFileUrl: z.string().url().optional(),
  hostedPath: z.string().regex(/^\/exam-materials\//).optional(),
  accessStatus: z.enum(["public", "account-required", "not-published", "removed", "unknown"]),
  distributionStatus: z.enum(["link-only", "hosting-permitted", "restricted", "unknown"]),
  syllabusApplicability: z.enum(["current", "historical", "review-required", "unknown"]),
  rights: z.object({
    basis: z.enum(["official-link-only", "public-licence", "written-permission", "internal-use-only", "unknown"]),
    evidenceUrl: z.string().url().optional(),
    note: z.string().min(1),
  }),
  provenance: z.object({
    sourceType: z.literal("official"),
    verifiedAt: IsoDateSchema,
    verifiedBy: z.enum(["human", "candidate-only"]),
  }),
  linkStatus: z.object({
    status: z.enum(["ok", "redirected", "login-required", "broken", "unchecked"]),
    checkedAt: IsoDateSchema,
  }),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).superRefine((asset, context) => {
  if (["question-paper", "mark-scheme"].includes(asset.materialType) && !asset.paperSetId) {
    context.addIssue({ code: "custom", path: ["paperSetId"], message: "Question papers and mark schemes require a paperSetId." });
  }
  if (asset.distributionStatus === "hosting-permitted") {
    if (!asset.hostedPath) {
      context.addIssue({ code: "custom", path: ["hostedPath"], message: "Hosted assets require a persistent exam-materials path." });
    }
    if (!["public-licence", "written-permission"].includes(asset.rights.basis)) {
      context.addIssue({ code: "custom", path: ["rights", "basis"], message: "Hosted assets require an explicit redistribution basis." });
    }
  } else if (asset.hostedPath) {
    context.addIssue({ code: "custom", path: ["hostedPath"], message: "Only hosting-permitted assets may define hostedPath." });
  }
});

const PastPaperReleaseSchema = z.object({
  status: z.literal("approved"),
  approvedAt: IsoDateSchema,
  verifiedAt: IsoDateSchema,
  approvedBy: z.literal("human"),
});

export const PastPaperCatalogSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  key: z.string().min(1),
  board: z.string().min(1),
  qualificationCode: z.string().min(1),
  subjectCode: z.string().min(1),
  qualificationName: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  sourcePageUrl: z.string().url(),
  restrictedSourceUrl: z.string().url().optional(),
  accessNote: z.string().min(1),
  release: PastPaperReleaseSchema,
  assets: z.array(PastPaperAssetSchema),
});

export const PastPaperCatalogCandidateSchema = PastPaperCatalogSchema.extend({
  release: z.object({
    status: z.literal("candidate"),
    generatedAt: IsoDateSchema,
    sourceRun: z.string().min(1),
    requestedModelId: z.string().min(1),
    responseModelId: z.string().min(1),
    promptVersion: z.string().min(1),
  }),
});

export type PastPaperAsset = z.infer<typeof PastPaperAssetSchema>;
export type PastPaperCatalog = z.infer<typeof PastPaperCatalogSchema>;
export type PastPaperCatalogCandidate = z.infer<typeof PastPaperCatalogCandidateSchema>;
export type PastPaperMaterialType = z.infer<typeof PastPaperMaterialTypeSchema>;
