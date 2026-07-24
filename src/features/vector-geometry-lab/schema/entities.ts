import { z } from "zod";
import { safeParseContract } from "./errors.js";
import type { ParseResult } from "./errors.js";
import { createId } from "./ids.js";
import { isZeroScalar, scalarV1Schema } from "./scalar.js";
import type { ScalarV1 } from "./scalar.js";

/**
 * Geometry entity contracts (V1). All coordinates are abstract,
 * SI-independent length units. `0` is always a valid coordinate and is never
 * treated as missing data.
 */

const idSchema = z.string().min(1, "id must be a non-empty stable string");
const labelSchema = z.string().min(1, "label must be a non-empty string");

export const vector3V1Schema = z.object({
  x: scalarV1Schema,
  y: scalarV1Schema,
  z: scalarV1Schema,
});
export type Vector3V1 = z.infer<typeof vector3V1Schema>;

export const point3V1Schema = z.object({
  pointId: idSchema,
  label: labelSchema,
  position: vector3V1Schema,
});
export type Point3V1 = z.infer<typeof point3V1Schema>;

export function isZeroVector3(vector: Vector3V1): boolean {
  return (
    isZeroScalar(vector.x) && isZeroScalar(vector.y) && isZeroScalar(vector.z)
  );
}

/**
 * Hard rule from the spec: a line MUST NOT be defined by a zero direction
 * vector. Rejected at the contract layer with a structured issue.
 */
export const line3V1Schema = z
  .object({
    lineId: idSchema,
    label: labelSchema,
    point: point3V1Schema,
    direction: vector3V1Schema,
  })
  .superRefine((line, ctx) => {
    if (isZeroVector3(line.direction)) {
      ctx.addIssue({
        code: "custom",
        path: ["direction"],
        message: "line direction must be a non-zero vector",
      });
    }
  });
export type Line3V1 = z.infer<typeof line3V1Schema>;

/**
 * Hard rule from the spec: a plane MUST NOT be defined by a zero normal.
 */
export const plane3V1Schema = z
  .object({
    planeId: idSchema,
    label: labelSchema,
    point: point3V1Schema,
    normal: vector3V1Schema,
  })
  .superRefine((plane, ctx) => {
    if (isZeroVector3(plane.normal)) {
      ctx.addIssue({
        code: "custom",
        path: ["normal"],
        message: "plane normal must be a non-zero vector",
      });
    }
  });
export type Plane3V1 = z.infer<typeof plane3V1Schema>;

/**
 * A free vector entity. Zero vectors ARE allowed here on purpose: the core
 * engine must be able to receive them and reject e.g. angle computations
 * explicitly (spec §2) instead of the schema silently dropping the input.
 * `origin` is optional; an omitted origin means a pure/free vector.
 */
export const vectorEntityV1Schema = z.object({
  vectorId: idSchema,
  label: labelSchema,
  components: vector3V1Schema,
  origin: point3V1Schema.optional(),
});
export type VectorEntityV1 = z.infer<typeof vectorEntityV1Schema>;

/* --------------------------------------------------------------------------
 * Safe parse helpers (structured results, never throw)
 * ------------------------------------------------------------------------ */

export function parseVector3(input: unknown): ParseResult<Vector3V1> {
  return safeParseContract(vector3V1Schema, input, "Invalid Vector3V1 value.");
}

export function parsePoint3(input: unknown): ParseResult<Point3V1> {
  return safeParseContract(point3V1Schema, input, "Invalid Point3V1 value.");
}

export function parseLine3(input: unknown): ParseResult<Line3V1> {
  return safeParseContract(line3V1Schema, input, "Invalid Line3V1 value.");
}

export function parsePlane3(input: unknown): ParseResult<Plane3V1> {
  return safeParseContract(plane3V1Schema, input, "Invalid Plane3V1 value.");
}

export function parseVectorEntity(input: unknown): ParseResult<VectorEntityV1> {
  return safeParseContract(
    vectorEntityV1Schema,
    input,
    "Invalid VectorEntityV1 value.",
  );
}

/* --------------------------------------------------------------------------
 * Entity factories (assertive: throw ZodError on invalid construction)
 *
 * Use these when constructing entities programmatically from already-typed
 * parts. For untrusted external input, use the parse* helpers above.
 * ------------------------------------------------------------------------ */

export function createVector3(x: ScalarV1, y: ScalarV1, z: ScalarV1): Vector3V1 {
  return vector3V1Schema.parse({ x, y, z });
}

export function createPoint3(input: {
  readonly label: string;
  readonly position: Vector3V1;
  readonly pointId?: string;
}): Point3V1 {
  return point3V1Schema.parse({
    pointId: input.pointId ?? createId("point"),
    label: input.label,
    position: input.position,
  });
}

export function createLine3(input: {
  readonly label: string;
  readonly point: Point3V1;
  readonly direction: Vector3V1;
  readonly lineId?: string;
}): Line3V1 {
  return line3V1Schema.parse({
    lineId: input.lineId ?? createId("line"),
    label: input.label,
    point: input.point,
    direction: input.direction,
  });
}

export function createPlane3(input: {
  readonly label: string;
  readonly point: Point3V1;
  readonly normal: Vector3V1;
  readonly planeId?: string;
}): Plane3V1 {
  return plane3V1Schema.parse({
    planeId: input.planeId ?? createId("plane"),
    label: input.label,
    point: input.point,
    normal: input.normal,
  });
}

export function createVectorEntity(input: {
  readonly label: string;
  readonly components: Vector3V1;
  readonly vectorId?: string;
  readonly origin?: Point3V1;
}): VectorEntityV1 {
  const base = {
    vectorId: input.vectorId ?? createId("vector"),
    label: input.label,
    components: input.components,
  };
  return vectorEntityV1Schema.parse(
    input.origin === undefined ? base : { ...base, origin: input.origin },
  );
}
