import { z } from "zod";
import { parseFailure, safeParseContract } from "./errors.js";
import type { ParseResult } from "./errors.js";
import { point3V1Schema, vector3V1Schema } from "./entities.js";
import { scalarV1Schema } from "./scalar.js";
import { VECTOR_GEOMETRY_SCHEMA_VERSION_V1 } from "./scene.js";

/**
 * VectorGeometrySolutionV1 — the versioned output document produced by the
 * deterministic core engine. Every failure/degenerate state is represented
 * by an explicit status; failed states never carry a fabricated formal
 * answer (spec §10.20).
 */

export const SOLUTION_STATUSES_V1 = [
  "solved",
  "input-required",
  "degenerate",
  "parallel",
  "coincident",
  "no-intersection",
  "infinite-solutions",
  "unsupported",
  "invalid-input",
] as const;

export type SolutionStatusV1 = (typeof SOLUTION_STATUSES_V1)[number];

export const solutionStatusV1Schema = z.enum(SOLUTION_STATUSES_V1);

const resultBaseFields = {
  resultId: z.string().min(1, "resultId must be a non-empty string"),
  label: z.string().min(1, "label must be a non-empty string"),
  formula: z.string(),
  interpretation: z.string(),
};

/**
 * GeometryResultV1 — discriminated union on `kind`. Scalar results carry the
 * exact rational plus a rendered decimal approximation so the UI never has
 * to round silently. `unit` is an abstract unit label or "dimensionless".
 */
export const geometryResultV1Schema = z.discriminatedUnion("kind", [
  z.object({
    ...resultBaseFields,
    kind: z.literal("scalar"),
    value: scalarV1Schema,
    decimalApproximation: z
      .string()
      .min(1, "scalar results must carry a decimal approximation"),
    unit: z.string().min(1, 'unit must be explicit ("dimensionless" allowed)'),
  }),
  z.object({
    ...resultBaseFields,
    kind: z.literal("vector"),
    value: vector3V1Schema,
    unit: z.string().min(1, 'unit must be explicit ("dimensionless" allowed)'),
  }),
  z.object({
    ...resultBaseFields,
    kind: z.literal("point"),
    value: point3V1Schema,
  }),
  z.object({
    ...resultBaseFields,
    kind: z.literal("boolean"),
    value: z.boolean(),
  }),
  z.object({
    ...resultBaseFields,
    kind: z.literal("text"),
    value: z.string(),
  }),
]);
export type GeometryResultV1 = z.infer<typeof geometryResultV1Schema>;

/**
 * DerivationStepV1 — one ordered step of the worked solution (formula,
 * substitution, result). Free-text fields may be empty strings but the keys
 * must be present so renderers can rely on a stable shape.
 */
export const derivationStepV1Schema = z.object({
  stepId: z.string().min(1, "stepId must be a non-empty string"),
  order: z.number().int().nonnegative(),
  title: z.string().min(1, "title must be a non-empty string"),
  description: z.string(),
  formula: z.string(),
  substitution: z.string(),
  result: z.string(),
});
export type DerivationStepV1 = z.infer<typeof derivationStepV1Schema>;

export const VALIDATION_SEVERITIES_V1 = ["info", "warning", "error"] as const;
export type ValidationSeverityV1 = (typeof VALIDATION_SEVERITIES_V1)[number];

/**
 * ValidationRecordV1 — audit trail for back-substitution / residual checks.
 * `tolerance` records the exact tolerance string used for any float-based
 * comparison (spec §3: comparisons must record the tolerance used).
 */
export const validationRecordV1Schema = z.object({
  validationId: z.string().min(1, "validationId must be a non-empty string"),
  rule: z.string().min(1, "rule must be a non-empty string"),
  severity: z.enum(VALIDATION_SEVERITIES_V1),
  passed: z.boolean(),
  message: z.string(),
  targetIds: z.array(z.string().min(1)),
  residual: scalarV1Schema.optional(),
  tolerance: z.string().min(1).optional(),
});
export type ValidationRecordV1 = z.infer<typeof validationRecordV1Schema>;

/**
 * DisplayGeometryV1 — math-layer description of auxiliary render geometry
 * (perpendicular segments, angle arcs, normals...). The 3d package renders
 * these; it never derives math from them.
 */
export const DISPLAY_GEOMETRY_KINDS_V1 = [
  "point",
  "vector-arrow",
  "line",
  "plane",
  "segment",
  "angle-arc",
  "normal-arrow",
] as const;
export type DisplayGeometryKindV1 = (typeof DISPLAY_GEOMETRY_KINDS_V1)[number];

export const displayGeometryV1Schema = z.object({
  displayId: z.string().min(1, "displayId must be a non-empty string"),
  kind: z.enum(DISPLAY_GEOMETRY_KINDS_V1),
  label: z.string(),
  relatedEntityIds: z.array(z.string().min(1)),
  points: z.array(point3V1Schema),
  direction: vector3V1Schema.optional(),
  normal: vector3V1Schema.optional(),
});
export type DisplayGeometryV1 = z.infer<typeof displayGeometryV1Schema>;

export const vectorGeometrySolutionV1Schema = z.object({
  schemaVersion: z.literal(VECTOR_GEOMETRY_SCHEMA_VERSION_V1),
  status: solutionStatusV1Schema,
  results: z.array(geometryResultV1Schema),
  derivations: z.array(derivationStepV1Schema),
  validation: z.array(validationRecordV1Schema),
  displayGeometry: z.array(displayGeometryV1Schema),
});
export type VectorGeometrySolutionV1 = z.infer<
  typeof vectorGeometrySolutionV1Schema
>;

export function parseVectorGeometrySolution(
  input: unknown,
): ParseResult<VectorGeometrySolutionV1> {
  if (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input
  ) {
    const version = (input as Record<string, unknown>)["schemaVersion"];
    if (typeof version === "string" && version !== VECTOR_GEOMETRY_SCHEMA_VERSION_V1) {
      return parseFailure(
        "unsupported-schema-version",
        `Unsupported schemaVersion "${version}". This build supports: ${VECTOR_GEOMETRY_SCHEMA_VERSION_V1}.`,
        [
          {
            path: "schemaVersion",
            message: `no parser for schemaVersion "${version}"`,
            code: "unsupported-schema-version",
          },
        ],
      );
    }
  }
  return safeParseContract(
    vectorGeometrySolutionV1Schema,
    input,
    "Invalid VectorGeometrySolutionV1 document.",
  );
}
