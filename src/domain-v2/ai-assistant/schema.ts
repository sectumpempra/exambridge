import { z } from "zod";

export const AI_ASSISTANT_MESSAGE_MAX_LENGTH = 2_000;
export const AI_ASSISTANT_HISTORY_MAX_MESSAGES = 12;
export const AI_ASSISTANT_HISTORY_MAX_CHARACTERS = 16_000;

export const AIChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(AI_ASSISTANT_MESSAGE_MAX_LENGTH),
});

export const AIPageContextSchema = z.object({
  pageType: z.enum(["assistant-home", "exam-overview", "knowledge-comparison", "academic-results", "difficulty-comparison", "transition-readiness"]),
  route: z.string().min(1).max(500),
  // Empty slots preserve A/B alignment for Paper-vs-subject comparisons.
  selectedPaperIds: z.array(z.string().max(120)).max(4).default([]),
  comparisonIds: z.array(z.string().min(1).max(120)).max(4).default([]),
});

export const AIQueryScopeSchema = z.object({
  awardQualificationIds: z.array(z.string().min(1).max(200)).max(4).default([]),
  qualificationVersionIds: z.array(z.string().min(1).max(200)).max(4).default([]),
  catalogQualificationIds: z.array(z.string().min(1).max(200)).max(4).default([]),
  source: z.enum(["explicit-query", "manual-selection", "page-context", "inferred"]),
}).refine(value => value.awardQualificationIds.length + value.qualificationVersionIds.length + value.catalogQualificationIds.length > 0, {
  message: "a query scope must identify at least one qualification",
});

const AIAcademicQuerySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lookup"),
    awardQualificationId: z.string().min(1).max(200),
    year: z.number().int().min(2019).max(2100).optional(),
    series: z.enum(["january", "march", "june", "october", "november", "other"]).optional(),
    routeId: z.string().min(1).max(200).optional(),
    tier: z.string().min(1).max(100).optional(),
  }),
  z.object({
    type: z.literal("award-calculation"),
    awardQualificationId: z.string().min(1).max(200),
    ruleId: z.string().min(1).max(300),
    routeId: z.string().min(1).max(200),
    targetSeries: z.string().regex(/^\d{4}-(january|march|june|october|november)$/),
    combinationId: z.string().min(1).max(200),
    optionCode: z.string().min(1).max(100).optional(),
    componentVariants: z.array(z.string().min(1).max(100)).min(1).max(12).optional(),
    componentScores: z.array(z.object({
      componentCode: z.string().min(1).max(120),
      series: z.string().regex(/^\d{4}-(january|march|june|october|november)$/),
      rawMark: z.number().finite().nonnegative().optional(),
      awardMark: z.number().finite().nonnegative().optional(),
    })).min(1).max(12),
  }),
]);

const AIAnonymousMasterySchema = z.array(z.object({
  nodeId: z.string().min(1).max(160),
  level: z.enum(["not-studied", "weak", "basic", "proficient"]),
})).max(1_200).refine(items => new Set(items.map(item => item.nodeId)).size === items.length, {
  message: "mastery node IDs must be unique",
});

export const AIResolvedContextSchema = z.object({
  awardQualificationIds: z.array(z.string().min(1).max(200)).max(4).default([]),
  qualificationVersionIds: z.array(z.string().min(1).max(200)).max(4).default([]),
  qualificationIds: z.array(z.string().min(1).max(200)).max(4),
  qualificationCodes: z.array(z.string().min(1).max(80)).max(4),
  paperIds: z.array(z.string().min(1).max(120)).max(4),
  labels: z.array(z.string().min(1).max(240)).max(4),
});

export const AIChatRequestSchema = z.object({
  version: z.literal(2).default(2),
  mode: z.literal("exam_assistant"),
  scopes: z.array(AIQueryScopeSchema).max(4).default([]),
  // Deprecated V1 fields are accepted only for in-tab request/session migration.
  qualificationIds: z.array(z.string().min(1).max(200)).max(4).default([]),
  syllabusVersions: z.array(z.string().min(1).max(120)).max(4).default([]),
  pageContext: AIPageContextSchema,
  pageContextQualificationVersionId: z.string().min(1).max(200).optional(),
  roleView: z.enum(["teaching", "consulting", "sales", "operations"]).default("consulting"),
  messages: z.array(AIChatMessageSchema).min(1).max(AI_ASSISTANT_HISTORY_MAX_MESSAGES),
  locale: z.enum(["zh-CN", "en-GB"]).default("zh-CN"),
  resolvedContext: AIResolvedContextSchema.optional(),
  academicQuery: AIAcademicQuerySchema.optional(),
  anonymousMastery: AIAnonymousMasterySchema.optional(),
  featureConsent: z.object({
    boundaryPrediction: z.object({
      enabled: z.boolean(),
      disclaimerVersion: z.string().min(1).max(120).optional(),
    }).optional(),
    externalSearch: z.object({ enabled: z.boolean() }).optional(),
  }).optional(),
});

export const AICitationSchema = z.object({
  sourceId: z.string().regex(/^S\d+$/),
  title: z.string().min(1).max(500),
  url: z.string().url().refine((url) => url.startsWith("https://"), "Citation URLs must use HTTPS"),
  dataVersion: z.string().min(1).max(200),
});

export const AIStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meta"),
    requestId: z.string().uuid(),
    resolvedContext: AIResolvedContextSchema,
  }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("citations"), citations: z.array(AICitationSchema) }),
  z.object({ type: z.literal("suggestions"), suggestions: z.array(z.string().min(1).max(200)).max(4) }),
  z.object({
    type: z.literal("done"),
    answer: z.string(),
    requestId: z.string().uuid(),
    resolvedContext: AIResolvedContextSchema,
  }),
  z.object({
    type: z.literal("error"),
    code: z.enum([
      "invalid-request", "context-required", "rate-limited", "busy",
      "provider-timeout", "provider-unavailable", "configuration-error", "internal-error",
      "service-limit",
    ]),
    message: z.string().min(1).max(500),
    retryAfterSeconds: z.number().int().positive().optional(),
  }),
]);

export type AIChatMessage = z.infer<typeof AIChatMessageSchema>;
export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;
export type AIPageContext = z.infer<typeof AIPageContextSchema>;
export type AIQueryScope = z.infer<typeof AIQueryScopeSchema>;
export type AIResolvedContext = z.infer<typeof AIResolvedContextSchema>;
export type AICitation = z.infer<typeof AICitationSchema>;
export type AIStreamEvent = z.infer<typeof AIStreamEventSchema>;
