import { z } from "zod";
import { safeParseContract } from "./errors.js";
import type { ParseResult } from "./errors.js";

/**
 * AnalysisRequestV1 — declarative description of what the teacher wants the
 * deterministic engine to compute. The schema layer only validates the shape;
 * target-id existence and solvability are validated by the core engine.
 */
export const ANALYSIS_KINDS_V1 = [
  "vector-norm",
  "distance-point-point",
  "distance-point-line",
  "distance-point-plane",
  "distance-line-line",
  "distance-plane-plane",
  "angle-vector-vector",
  "angle-line-line",
  "angle-line-plane",
  "angle-plane-plane",
  "relation-vector-plane",
  "relation-line-plane",
  "relation-plane-plane",
  "intersection-line-line",
  "intersection-line-plane",
  "intersection-plane-plane",
  "equation-line",
  "equation-plane",
  "point-on-line",
  "point-on-plane",
] as const;

export type AnalysisKindV1 = (typeof ANALYSIS_KINDS_V1)[number];

export const analysisRequestV1Schema = z.object({
  analysisId: z.string().min(1, "analysisId must be a non-empty string"),
  kind: z.enum(ANALYSIS_KINDS_V1),
  targetIds: z
    .array(z.string().min(1))
    .min(1, "an analysis must reference at least one target entity"),
});
export type AnalysisRequestV1 = z.infer<typeof analysisRequestV1Schema>;

export function parseAnalysisRequest(
  input: unknown,
): ParseResult<AnalysisRequestV1> {
  return safeParseContract(
    analysisRequestV1Schema,
    input,
    "Invalid AnalysisRequestV1 value.",
  );
}
