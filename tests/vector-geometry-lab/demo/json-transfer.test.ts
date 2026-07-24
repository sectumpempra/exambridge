import { describe, expect, it } from "vitest";
import {
  createPoint3,
  createScene,
  createVector3,
  scalarFromLiteral,
} from "@/features/vector-geometry-lab/schema";
import { getExample } from "@/pages/vector-geometry-lab/examples/builtin-examples.js";
import {
  importSceneJson,
  inferExampleId,
  sceneToJson,
} from "@/pages/vector-geometry-lab/export/json-transfer.js";

function s(literal: string) {
  const parsed = scalarFromLiteral(literal);
  if (!parsed.ok) throw new Error("bad literal");
  return parsed.value;
}

describe("JSON export → import round trip", () => {
  it("exports the plain scene document and re-imports it losslessly", () => {
    const example = getExample("skew-lines")!;
    const json = sceneToJson(example.scene);
    const decoded = JSON.parse(json) as Record<string, unknown>;
    // The download is the raw VectorGeometrySceneV1 document (schemaVersioned).
    expect(decoded["schemaVersion"]).toBe("1.0.0");
    expect(decoded["sceneId"]).toBe(example.scene.sceneId);

    const imported = importSceneJson(json);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.scene).toEqual(example.scene);
    expect(imported.value.exampleId).toBe("skew-lines");
  });

  it("infers the analyzer from an '<exampleId>-edited' sceneId", () => {
    const example = getExample("point-plane-distance")!;
    const edited = { ...example.scene, sceneId: "point-plane-distance-edited" };
    const imported = importSceneJson(sceneToJson(edited));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.exampleId).toBe("point-plane-distance");
  });

  it("infers the analyzer by exact structural match for foreign sceneIds", () => {
    const example = getExample("parallel-planes")!;
    const renamed = { ...example.scene, sceneId: "teacher-handout-7" };
    expect(inferExampleId(renamed)).toBe("parallel-planes");
    const imported = importSceneJson(sceneToJson(renamed));
    expect(imported.ok && imported.value.exampleId).toBe("parallel-planes");
  });
});

describe("JSON import — safe refusals (spec §7 / §10.13-14)", () => {
  it("broken JSON → invalid-json with a clear message", () => {
    const imported = importSceneJson("{ \"schemaVersion\": ");
    expect(imported.ok).toBe(false);
    if (imported.ok) return;
    expect(imported.error.code).toBe("invalid-json");
    expect(imported.error.message).toContain("not valid JSON");
    expect(imported.error.message).toContain("Nothing was imported");
  });

  it("unknown schemaVersion → unsupported-schema-version", () => {
    const example = getExample("angle-between-vectors")!;
    const future = { ...example.scene, schemaVersion: "9.9.9" };
    const imported = importSceneJson(JSON.stringify(future));
    expect(imported.ok).toBe(false);
    if (imported.ok) return;
    expect(imported.error.code).toBe("unsupported-schema-version");
    expect(imported.error.message).toContain("9.9.9");
  });

  it("structurally invalid document → invalid-scene with issue path", () => {
    const broken = {
      schemaVersion: "1.0.0",
      sceneId: "x",
      title: "x",
      points: [{ pointId: "p1" }],
    };
    const imported = importSceneJson(JSON.stringify(broken));
    expect(imported.ok).toBe(false);
    if (imported.ok) return;
    expect(imported.error.code).toBe("invalid-scene");
    expect(imported.error.message).toContain("Nothing was imported");
  });

  it("valid but unsupported scene (no matching analyzer) → unsupported-scene", () => {
    // Five stray points match none of the 16 built-in analysis types.
    const foreign = createScene({
      sceneId: "foreign",
      title: "Foreign scene",
      points: [0, 1, 2, 3, 4].map((n) =>
        createPoint3({
          pointId: `p${String(n)}`,
          label: `P${String(n)}`,
          position: createVector3(s(String(n)), s("0"), s("0")),
        }),
      ),
    });
    const imported = importSceneJson(sceneToJson(foreign));
    expect(imported.ok).toBe(false);
    if (imported.ok) return;
    expect(imported.error.code).toBe("unsupported-scene");
    expect(imported.error.message).toContain("16 built-in analysis types");
  });
});
