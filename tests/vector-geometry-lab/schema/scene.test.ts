import { describe, expect, it } from "vitest";
import {
  ANALYSIS_KINDS_V1,
  createPlane3,
  createPoint3,
  createScene,
  createVector3,
  migrateScene,
  parseAnalysisRequest,
  parseVectorGeometryScene,
  scalarFromLiteral,
  VECTOR_GEOMETRY_SCHEMA_VERSION_V1,
} from "@/features/vector-geometry-lab/schema";
import type {
  ScalarV1,
  Vector3V1,
  VectorGeometrySceneV1,
} from "@/features/vector-geometry-lab/schema";

function scalar(literal: string): ScalarV1 {
  const result = scalarFromLiteral(literal);
  if (!result.ok) throw new Error(`bad literal ${literal}`);
  return result.value;
}

function vec(x: string, y: string, z: string): Vector3V1 {
  return createVector3(scalar(x), scalar(y), scalar(z));
}

const pointA = createPoint3({
  label: "A",
  position: vec("1", "2", "3"),
  pointId: "point_A",
});
const pointB = createPoint3({
  label: "B",
  position: vec("4", "0", "-1"),
  pointId: "point_B",
});

function buildScene(): VectorGeometrySceneV1 {
  return createScene({
    title: "Demo scene",
    sceneId: "scene_demo",
    points: [pointA, pointB],
    lines: [
      {
        lineId: "line_l1",
        label: "l1",
        point: pointA,
        direction: vec("1", "1", "0"),
      },
    ],
    planes: [
      createPlane3({
        label: "π1",
        point: pointB,
        normal: vec("0", "0", "1"),
        planeId: "plane_p1",
      }),
    ],
    requestedAnalysis: [
      {
        analysisId: "analysis_1",
        kind: "distance-point-plane",
        targetIds: ["point_A", "plane_p1"],
      },
    ],
  });
}

describe("AnalysisRequestV1", () => {
  it("exposes the full V1 analysis kind list", () => {
    expect(ANALYSIS_KINDS_V1.length).toBe(20);
    expect(ANALYSIS_KINDS_V1).toContain("distance-point-line");
    expect(ANALYSIS_KINDS_V1).toContain("intersection-plane-plane");
  });

  it("accepts a valid request", () => {
    expect(
      parseAnalysisRequest({
        analysisId: "a1",
        kind: "angle-vector-vector",
        targetIds: ["vector_u", "vector_v"],
      }).ok,
    ).toBe(true);
  });

  it("rejects an unknown analysis kind", () => {
    expect(
      parseAnalysisRequest({
        analysisId: "a1",
        kind: "solve-everything",
        targetIds: ["vector_u"],
      }).ok,
    ).toBe(false);
  });

  it("rejects an empty target list", () => {
    expect(
      parseAnalysisRequest({
        analysisId: "a1",
        kind: "vector-norm",
        targetIds: [],
      }).ok,
    ).toBe(false);
  });
});

describe("parseVectorGeometryScene", () => {
  it("accepts a full valid scene", () => {
    const scene = buildScene();
    const result = parseVectorGeometryScene(scene);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.schemaVersion).toBe(VECTOR_GEOMETRY_SCHEMA_VERSION_V1);
    expect(result.value.points).toHaveLength(2);
  });

  it("accepts an empty scene", () => {
    const result = parseVectorGeometryScene(createScene({ title: "Empty" }));
    expect(result.ok).toBe(true);
  });

  it("round-trips through JSON unchanged", () => {
    const scene = buildScene();
    const revived: unknown = JSON.parse(JSON.stringify(scene));
    const result = parseVectorGeometryScene(revived);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual(scene);
  });

  it("safely rejects an unknown schemaVersion without throwing", () => {
    const result = parseVectorGeometryScene({
      ...buildScene(),
      schemaVersion: "2.0.0",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("unsupported-schema-version");
    expect(result.error.message).toContain("2.0.0");
    expect(result.error.issues[0]?.path).toBe("schemaVersion");
  });

  it("rejects a missing schemaVersion as invalid input", () => {
    const { schemaVersion: _omit, ...rest } = buildScene();
    const result = parseVectorGeometryScene(rest);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid-input");
  });

  it("rejects a non-string schemaVersion as invalid input", () => {
    const result = parseVectorGeometryScene({
      ...buildScene(),
      schemaVersion: 42,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid-input");
  });

  it("rejects non-object input without throwing", () => {
    expect(parseVectorGeometryScene("not a scene").ok).toBe(false);
    expect(parseVectorGeometryScene(null).ok).toBe(false);
    expect(parseVectorGeometryScene(undefined).ok).toBe(false);
    expect(parseVectorGeometryScene([1, 2, 3]).ok).toBe(false);
  });

  it("rejects corrupted nested entities", () => {
    const scene = buildScene();
    scene.lines[0] = { ...scene.lines[0]!, direction: vec("0", "0", "0") };
    const result = parseVectorGeometryScene(scene);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid-input");
  });

  it("rejects duplicate top-level entity ids across collections", () => {
    const scene = buildScene();
    scene.planes[0] = { ...scene.planes[0]!, planeId: "point_A" };
    const result = parseVectorGeometryScene(scene);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(
      result.error.issues.some((issue) =>
        issue.message.includes('duplicate entity id "point_A"'),
      ),
    ).toBe(true);
  });

  it("allows an embedded defining point to reuse a top-level point id", () => {
    // The line's defining point embeds pointA (same pointId) — legitimate.
    const result = parseVectorGeometryScene(buildScene());
    expect(result.ok).toBe(true);
  });
});

describe("migrateScene — reserved migration hook", () => {
  it("passes V1 documents through unchanged", () => {
    const scene = buildScene();
    const result = migrateScene(scene);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual(scene);
  });

  it("safely rejects unknown versions with a structured result", () => {
    const result = migrateScene({ schemaVersion: "0.9.0", sceneId: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("unsupported-schema-version");
  });

  it("safely rejects documents without a schemaVersion", () => {
    const result = migrateScene({ sceneId: "x" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("unsupported-schema-version");
    expect(result.error.message).toContain("<missing>");
  });
});

describe("createScene factory", () => {
  it("fills defaults and generates a sceneId", () => {
    const scene = createScene({ title: "T" });
    expect(scene.sceneId.startsWith("scene_")).toBe(true);
    expect(scene.points).toEqual([]);
    expect(scene.requestedAnalysis).toEqual([]);
    expect(scene.schemaVersion).toBe(VECTOR_GEOMETRY_SCHEMA_VERSION_V1);
  });

  it("throws on invalid assembled scenes", () => {
    expect(() =>
      createScene({
        title: "bad",
        lines: [
          {
            lineId: "line_x",
            label: "x",
            point: pointA,
            direction: vec("0", "0", "0"),
          },
        ],
      }),
    ).toThrow();
  });
});
