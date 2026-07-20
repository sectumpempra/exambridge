import { z } from "zod";

export const AI_ASSISTANT_MESSAGE_MAX_LENGTH = 2_000;
export const AI_ASSISTANT_HISTORY_MAX_MESSAGES = 12;
export const AI_ASSISTANT_HISTORY_MAX_CHARACTERS = 16_000;

export const AIChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(AI_ASSISTANT_MESSAGE_MAX_LENGTH),
});

export const AIPageContextSchema = z.object({
  pageType: z.enum(["assistant-home", "exam-overview", "knowledge-comparison"]),
  route: z.string().min(1).max(500),
  // Empty slots preserve A/B alignment for Paper-vs-subject comparisons.
  selectedPaperIds: z.array(z.string().max(120)).max(2).default([]),
  comparisonIds: z.array(z.string().min(1).max(120)).max(2).default([]),
});

export const AIResolvedContextSchema = z.object({
  qualificationIds: z.array(z.string().min(1).max(200)).max(2),
  qualificationCodes: z.array(z.string().min(1).max(80)).max(2),
  paperIds: z.array(z.string().min(1).max(120)).max(2),
  labels: z.array(z.string().min(1).max(240)).max(2),
});

export const AIChatRequestSchema = z.object({
  mode: z.literal("exam_assistant"),
  qualificationIds: z.array(z.string().min(1).max(200)).max(2),
  syllabusVersions: z.array(z.string().min(1).max(120)).max(2),
  pageContext: AIPageContextSchema,
  messages: z.array(AIChatMessageSchema).min(1).max(AI_ASSISTANT_HISTORY_MAX_MESSAGES),
  locale: z.enum(["zh-CN", "en-GB"]).default("zh-CN"),
  resolvedContext: AIResolvedContextSchema.optional(),
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
    ]),
    message: z.string().min(1).max(500),
    retryAfterSeconds: z.number().int().positive().optional(),
  }),
]);

export type AIChatMessage = z.infer<typeof AIChatMessageSchema>;
export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;
export type AIPageContext = z.infer<typeof AIPageContextSchema>;
export type AIResolvedContext = z.infer<typeof AIResolvedContextSchema>;
export type AICitation = z.infer<typeof AICitationSchema>;
export type AIStreamEvent = z.infer<typeof AIStreamEventSchema>;
