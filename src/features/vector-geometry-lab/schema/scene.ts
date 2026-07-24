import { z } from "zod";
import { parseFailure, safeParseContract } from "./errors.js";
import type { ParseResult } from "./errors.js";
import {
  line3V1Schema,
  plane3V1Schema,
  point3V1Schema,
  vectorEntityV1Schema,
} from "./entities.js";
import { analysisRequestV1Schema } from "./analysis.js";
import { createId } from "./ids.js";
import type {
  Line3V1,
  Plane3V1,
  Point3V1,
  VectorEntityV1,
} from "./entities.js";
import type { AnalysisRequestV1 } from "./analysis.js";

/**
 * VectorGeometrySceneV1 — the versioned root document of the lab.
 *
 * Versioning strategy: `schemaVersion` is checked BEFORE any structural
 * parsing. Unknown versions are rejected safely with a structured
 * "unsupported-schema-version" result (never a thrown error). `migrateScene`
 * is the reserved migration hook: V1 is a pass-through, and future versions
 * register step migrations in `sceneMigrations` keyed by source version.
 */

export const VECTOR_GEOMETRY_SCHEMA_VERSION_V1 = "1.0.0" as const;

const SUPPORTED_SCENE_VERSIONS: ReadonlySet<string> = new Set([
  VECTOR_GEOMETRY_SCHEMA_VERSION_V1,
]);

export const vectorGeometrySceneV1Schema = z
  .object({
    schemaVersion: z.literal(VECTOR_GEOMETRY_SCHEMA_VERSION_V1),
    sceneId: z.string().min(1, "sceneId must be a non-empty string"),
    title: z.string().min(1, "title must be a non-empty string"),
    points: z.array(point3V1Schema),
    vectors: z.array(vectorEntityV1Schema),
    lines: z.array(line3V1Schema),
    planes: z.array(plane3V1Schema),
    requestedAnalysis: z.array(analysisRequestV1Schema),
  })
  .superRefine((scene, ctx) => {
    // Top-level entity ids must be unique across collections. Embedded ids
    // (e.g. a line's defining point) are intentionally NOT counted: reusing
    // a point entity inside a line is a legitimate reference.
    const seen = new Map<string, string>();
    const register = (id: string, path: (string | number)[]): void => {
      const existing = seen.get(id);
      if (existing !== undefined) {
        ctx.addIssue({
          code: "custom",
          path,
          message: `duplicate entity id "${id}" (first used at ${existing})`,
        });
        return;
      }
      seen.set(id, path.join("."));
    };
    scene.points.forEach((point, index) =>
      register(point.pointId, ["points", index, "pointId"]),
    );
    scene.vectors.forEach((vector, index) =>
      register(vector.vectorId, ["vectors", index, "vectorId"]),
    );
    scene.lines.forEach((line, index) =>
      register(line.lineId, ["lines", index, "lineId"]),
    );
    scene.planes.forEach((plane, index) =>
      register(plane.planeId, ["planes", index, "planeId"]),
    );
  });
export type VectorGeometrySceneV1 = z.infer<typeof vectorGeometrySceneV1Schema>;

function readSchemaVersion(input: unknown): string | undefined {
  if (typeof input === "object" && input !== null && "schemaVersion" in input) {
    const version = (input as Record<string, unknown>)["schemaVersion"];
    return typeof version === "string" ? version : undefined;
  }
  return undefined;
}

function unsupportedVersionFailure<T>(
  version: string | undefined,
): ParseResult<T> {
  const shown = version ?? "<missing>";
  return parseFailure(
    "unsupported-schema-version",
    `Unsupported schemaVersion "${shown}". This build supports: ${[
      ...SUPPORTED_SCENE_VERSIONS,
    ].join(", ")}.`,
    [
      {
        path: "schemaVersion",
        message: `no parser or migration path for schemaVersion "${shown}"`,
        code: "unsupported-schema-version",
      },
    ],
  );
}

/**
 * Safe scene entry point. Never throws: unknown schema versions and invalid
 * payloads both come back as structured failures.
 */
export function parseVectorGeometryScene(
  input: unknown,
): ParseResult<VectorGeometrySceneV1> {
  const version = readSchemaVersion(input);
  if (version !== undefined && !SUPPORTED_SCENE_VERSIONS.has(version)) {
    return unsupportedVersionFailure(version);
  }
  return safeParseContract(
    vectorGeometrySceneV1Schema,
    input,
    "Invalid VectorGeometrySceneV1 document.",
  );
}

/**
 * Reserved migration hook. Future schema versions register a step migration
 * here, keyed by the SOURCE schemaVersion; each step upgrades a document one
 * version closer to V1 shape (or directly to it). V1 documents pass through
 * unchanged.
 */
export const sceneMigrations: Readonly<
  Record<string, (input: unknown) => unknown>
> = Object.freeze({});

export function migrateScene(
  input: unknown,
): ParseResult<VectorGeometrySceneV1> {
  const version = readSchemaVersion(input);
  if (version === VECTOR_GEOMETRY_SCHEMA_VERSION_V1) {
    return parseVectorGeometryScene(input);
  }
  if (version !== undefined) {
    const migrate = sceneMigrations[version];
    if (migrate !== undefined) {
      return parseVectorGeometryScene(migrate(input));
    }
  }
  return unsupportedVersionFailure(version);
}

/** Assertive scene factory: throws ZodError on invalid construction. */
export function createScene(input: {
  readonly title: string;
  readonly sceneId?: string;
  readonly points?: readonly Point3V1[];
  readonly vectors?: readonly VectorEntityV1[];
  readonly lines?: readonly Line3V1[];
  readonly planes?: readonly Plane3V1[];
  readonly requestedAnalysis?: readonly AnalysisRequestV1[];
}): VectorGeometrySceneV1 {
  return vectorGeometrySceneV1Schema.parse({
    schemaVersion: VECTOR_GEOMETRY_SCHEMA_VERSION_V1,
    sceneId: input.sceneId ?? createId("scene"),
    title: input.title,
    points: input.points ?? [],
    vectors: input.vectors ?? [],
    lines: input.lines ?? [],
    planes: input.planes ?? [],
    requestedAnalysis: input.requestedAnalysis ?? [],
  });
}
