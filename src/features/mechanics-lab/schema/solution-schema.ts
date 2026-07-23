/**
 * MechanicsSolutionV1 的 Zod 校验：用于测试与跨包边界处验证求解器输出结构。
 */
import { z } from "zod";
import { vec2SchemaV1 } from "./scene-schema.js";

export const solutionStatusSchemaV1 = z.enum([
  "solved",
  "input-required",
  "underdetermined",
  "overdetermined-consistent",
  "inconsistent",
  "assumption-invalid",
  "unsupported",
]);

const assumptionSchemaV1 = z.object({
  assumptionId: z.string(),
  kind: z.enum([
    "ideal-rope",
    "ideal-pulley",
    "light-rod",
    "rigid-surface",
    "point-mass",
    "friction-model",
    "equilibrium",
    "motion-direction",
    "rope-taut",
    "contact-maintained",
    "other",
  ]),
  text: z.string(),
});

const coordinateSystemSchemaV1 = z.object({
  coordinateSystemId: z.string(),
  kind: z.enum(["global", "along-surface"]),
  objectId: z.string().optional(),
  xAxis: vec2SchemaV1,
  yAxis: vec2SchemaV1,
  angleDeg: z.number(),
  description: z.string(),
});

const forceRecordSchemaV1 = z.object({
  forceId: z.string(),
  objectId: z.string(),
  kind: z.enum([
    "gravity",
    "normal",
    "static-friction",
    "kinetic-friction",
    "tension",
    "rod",
    "applied",
    "support-reaction",
  ]),
  label: z.string(),
  symbol: z.string(),
  source: z.string(),
  direction: vec2SchemaV1,
  magnitude: z.number().nullable(),
  unit: z.literal("N"),
  note: z.string().optional(),
});

const freeBodyDiagramSchemaV1 = z.object({
  objectId: z.string(),
  objectLabel: z.string(),
  forceIds: z.array(z.string()),
  note: z.string().optional(),
});

const equationSchemaV1 = z.object({
  equationId: z.string(),
  kind: z.enum(["newton-x", "newton-y", "rope-length", "rod-length"]),
  objectId: z.string().optional(),
  description: z.string(),
  terms: z.array(z.object({ symbol: z.string(), coefficient: z.number() })),
  constant: z.number(),
  symbolic: z.string(),
});

const relatesToSchemaV1 = z
  .object({
    kind: z.enum(["object", "rope", "rod", "support", "contact"]),
    id: z.string(),
  })
  .optional();

const unknownSchemaV1 = z.object({
  symbol: z.string(),
  meaning: z.string(),
  unit: z.string(),
  relatesTo: relatesToSchemaV1,
});

const solvedValueSchemaV1 = z.object({
  symbol: z.string(),
  value: z.number(),
  unit: z.string(),
  display: z.string(),
  meaning: z.string(),
  relatesTo: relatesToSchemaV1,
});

const constraintSchemaV1 = z.object({
  constraintId: z.string(),
  kind: z.enum([
    "rope-length",
    "rod-length",
    "rope-tension-equal",
    "tension-non-negative",
    "normal-non-negative",
    "static-friction-bound",
    "friction-direction",
    "residual-check",
    "topology",
  ]),
  expression: z.string(),
  satisfied: z.boolean(),
  detail: z.string(),
});

const validationSchemaV1 = z.object({
  ruleId: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  passed: z.boolean(),
  message: z.string(),
});

const explanationStepSchemaV1 = z.object({
  step: z.number().int(),
  title: z.string(),
  detail: z.string(),
});

const directionReportSchemaV1 = z.object({
  objectId: z.string(),
  assumedPositiveDirection: vec2SchemaV1,
  accelerationAlongPath: z.number().nullable(),
  initialVelocityAlongPath: z.number().nullable(),
  oppositeToAssumption: z.boolean(),
  decelerating: z.boolean(),
  note: z.string(),
});

const kinematicsRecordSchemaV1 = z.object({
  objectId: z.string(),
  accelerationAlongPath: z.number(),
  initialVelocityAlongPath: z.number(),
  pathDirection: vec2SchemaV1,
  velocityFunction: z.string(),
  displacementFunction: z.string(),
  samples: z.array(
    z.object({
      t: z.number(),
      velocityAlongPath: z.number(),
      displacementAlongPath: z.number(),
    }),
  ),
});

export const mechanicsSolutionSchemaV1 = z.object({
  status: solutionStatusSchemaV1,
  statusReason: z.string(),
  assumptions: z.array(assumptionSchemaV1),
  coordinateSystems: z.array(coordinateSystemSchemaV1),
  forces: z.array(forceRecordSchemaV1),
  freeBodyDiagrams: z.array(freeBodyDiagramSchemaV1),
  equations: z.array(equationSchemaV1),
  unknowns: z.array(unknownSchemaV1),
  values: z.array(solvedValueSchemaV1),
  constraints: z.array(constraintSchemaV1),
  validation: z.array(validationSchemaV1),
  explanationSteps: z.array(explanationStepSchemaV1),
  directionReports: z.array(directionReportSchemaV1),
  kinematics: z.array(kinematicsRecordSchemaV1),
  unsupportedFeatures: z.array(z.string()),
  requiredInputs: z.array(z.string()),
});

export type MechanicsSolutionParsedV1 = z.infer<typeof mechanicsSolutionSchemaV1>;
