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

export const PastPaperCoverageSchema = z.object({
  year: z.number().int().min(2021).max(2025),
  scope: z.literal("year-summary"),
  status: z.enum([
    "complete",
    "partial",
    "account-required",
    "not-held",
    "not-published",
    "removed",
    "review-required",
  ]),
  sourcePageUrl: z.string().url(),
  verifiedAt: IsoDateSchema,
  note: z.string().min(1),
});

const PastPaperCatalogBaseSchema = z.object({
  schemaVersion: z.literal("1.1.0"),
  key: z.string().min(1),
  board: z.string().min(1),
  qualificationCode: z.string().min(1),
  subjectCode: z.string().min(1),
  qualificationName: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  sourcePageUrl: z.string().url(),
  restrictedSourceUrl: z.string().url().optional(),
  accessNote: z.string().min(1),
  coverage: z.array(PastPaperCoverageSchema).length(5),
  assets: z.array(PastPaperAssetSchema),
});

function validateCoverage(catalog: z.infer<typeof PastPaperCatalogBaseSchema>, context: z.RefinementCtx) {
  const years = catalog.coverage.map((entry) => entry.year);
  if (new Set(years).size !== years.length || ![2021, 2022, 2023, 2024, 2025].every((year) => years.includes(year))) {
    context.addIssue({ code: "custom", path: ["coverage"], message: "Coverage must account for every year from 2021 through 2025 exactly once." });
  }
  for (const entry of catalog.coverage) {
    const publicAssets = catalog.assets.filter((asset) => asset.year === entry.year && asset.accessStatus === "public");
    if (entry.status === "complete" && publicAssets.length === 0) {
      context.addIssue({ code: "custom", path: ["coverage"], message: `${entry.year} cannot be complete without public assets.` });
    }
  }
}

export const PastPaperCatalogSchema = PastPaperCatalogBaseSchema.extend({
  release: PastPaperReleaseSchema,
}).superRefine(validateCoverage);

export const PastPaperCatalogCandidateSchema = PastPaperCatalogBaseSchema.extend({
  release: z.object({
    status: z.literal("candidate"),
    generatedAt: IsoDateSchema,
    sourceRun: z.string().min(1),
    requestedModelId: z.string().min(1),
    responseModelId: z.string().min(1),
    promptVersion: z.string().min(1),
  }),
}).superRefine(validateCoverage);

export type PastPaperAsset = z.infer<typeof PastPaperAssetSchema>;
export type PastPaperCatalog = z.infer<typeof PastPaperCatalogSchema>;
export type PastPaperCatalogCandidate = z.infer<typeof PastPaperCatalogCandidateSchema>;
export type PastPaperMaterialType = z.infer<typeof PastPaperMaterialTypeSchema>;
export type PastPaperCoverage = z.infer<typeof PastPaperCoverageSchema>;
