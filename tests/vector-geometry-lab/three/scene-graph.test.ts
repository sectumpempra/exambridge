import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { DisplayGeometryV1 } from "@/features/vector-geometry-lab/schema";
import { buildDisplayEntry, resolveSceneBuildOptions } from "@/features/vector-geometry-lab/three/display-builders";
import {
  buildSceneGraph,
  readSceneGraphMeta,
  SCENE_GRAPH_META_KEY,
} from "@/features/vector-geometry-lab/three/scene-graph";
import type { SceneEntityMeta } from "@/features/vector-geometry-lab/three/types";
import {
  createStubCanvas2DFactory,
  findByName,
  linePositions,
  makePoint,
  makeScalar,
  makeVector3,
} from "./helpers.js";

function makeDisplay(partial: Partial<DisplayGeometryV1> & { displayId: string }): DisplayGeometryV1 {
  return {
    kind: "point",
    label: "",
    relatedEntityIds: [],
    points: [],
    ...partial,
  } as DisplayGeometryV1;
}

function meta(): ReturnType<typeof readSceneGraphMeta> {
  throw new Error("unused");
}
void meta;

describe("buildSceneGraph — entities", () => {
  it("maps a point entity to a sphere marker + label, registered by pointId", () => {
    const { factory, recorder } = createStubCanvas2DFactory();
    const graph = buildSceneGraph(
      { points: [makePoint("pt-a", "A", "1", "2", "3")] },
      { canvasFactory: factory },
    );
    const meta = readSceneGraphMeta(graph);
    const entry = meta?.registry.find((e) => e.id === "pt-a");
    expect(entry?.kind).toBe("point");
    expect(entry?.name).toBe("A");
    const marker = findByName(entry!.object3d, "point-marker")[0] as THREE.Mesh;
    expect(marker.position.equals(new THREE.Vector3(1, 2, 3))).toBe(true);
    expect(marker.geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect(recorder.fillTextCalls.map((c) => c.text)).toContain("A");
  });

  it("maps a vector entity to a solid arrow from its origin", () => {
    const graph = buildSceneGraph(
      {
        vectors: [
          {
            vectorId: "v1",
            label: "u",
            components: makeVector3("0", "0", "2"),
            origin: makePoint("o1", "O1", "1", "1", "1"),
          },
        ],
      },
      { labelsEnabled: false },
    );
    const meta = readSceneGraphMeta(graph);
    const entry = meta?.registry.find((e) => e.id === "v1");
    expect(entry?.kind).toBe("vector-arrow");
    expect(findByName(entry!.object3d, "arrow-shaft-solid")).toHaveLength(1);
    expect(findByName(entry!.object3d, "arrow-head")).toHaveLength(1);
  });

  it("draws a zero free vector as a marker and records a warning", () => {
    const graph = buildSceneGraph(
      {
        vectors: [
          {
            vectorId: "v0",
            label: "zero",
            components: makeVector3("0", "0", "0"),
          },
        ],
      },
      { labelsEnabled: false },
    );
    const meta = readSceneGraphMeta(graph);
    const entry = meta?.registry.find((e) => e.id === "v0");
    expect(findByName(entry!.object3d, "vector-zero-marker")).toHaveLength(1);
    expect(meta?.warnings.some((w) => w.includes("v0"))).toBe(true);
  });

  it("maps a line entity to a finite window: solid ±viewExtent plus two dashed tails", () => {
    const graph = buildSceneGraph(
      {
        lines: [
          {
            lineId: "l1",
            label: "l",
            point: makePoint("lp", "P", "1", "0", "0"),
            direction: makeVector3("0", "1", "0"),
          },
        ],
      },
      { labelsEnabled: false, viewExtent: 7, lineExtensionLength: 3 },
    );
    const meta = readSceneGraphMeta(graph);
    const entry = meta?.registry.find((e) => e.id === "l1");
    const solid = findByName(entry!.object3d, "line-window-solid")[0] as THREE.Line;
    const points = linePositions(solid);
    expect(points[0]?.equals(new THREE.Vector3(1, -7, 0))).toBe(true);
    expect(points[1]?.equals(new THREE.Vector3(1, 7, 0))).toBe(true);
    const tailPos = findByName(entry!.object3d, "line-extension-positive")[0] as THREE.Line;
    const tailPoints = linePositions(tailPos);
    expect(tailPoints[0]?.equals(new THREE.Vector3(1, 7, 0))).toBe(true);
    expect(tailPoints[1]?.equals(new THREE.Vector3(1, 10, 0))).toBe(true);
    expect(tailPos.material).toBeInstanceOf(THREE.LineDashedMaterial);
    expect(findByName(entry!.object3d, "line-extension-negative")).toHaveLength(1);
  });

  it("maps a plane entity to a translucent double-sided quad with outline and dashed normal arrow", () => {
    const graph = buildSceneGraph(
      {
        planes: [
          {
            planeId: "pl1",
            label: "π",
            point: makePoint("pp", "P", "0", "1", "0"),
            normal: makeVector3("0", "0", "2"),
          },
        ],
      },
      { labelsEnabled: false, planeOpacity: 0.5 },
    );
    const meta = readSceneGraphMeta(graph);
    const entry = meta?.registry.find((e) => e.id === "pl1");
    expect(entry?.kind).toBe("plane");
    const surface = findByName(entry!.object3d, "plane-surface")[0] as THREE.Mesh;
    const material = surface.material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBe(0.5);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(findByName(entry!.object3d, "plane-outline")).toHaveLength(1);
    // Plane quad local +z is rotated onto the normal direction (0,0,1).
    const quad = findByName(entry!.object3d, "plane-quad")[0] as THREE.Group;
    const mapped = new THREE.Vector3(0, 0, 1).applyQuaternion(quad.quaternion);
    expect(mapped.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-9);
    expect(quad.position.equals(new THREE.Vector3(0, 1, 0))).toBe(true);
    // Normal arrow: dashed shaft.
    expect(findByName(entry!.object3d, "arrow-shaft-dashed")).toHaveLength(1);
  });
});

describe("buildSceneGraph — DisplayGeometryV1 payloads", () => {
  it("display 'point' (intersection marker) is a sphere registered under displayId", () => {
    const graph = buildSceneGraph(
      {
        displayGeometry: [
          makeDisplay({
            displayId: "int-1",
            kind: "point",
            label: "intersection X",
            points: [makePoint("ix", "X", "2", "0", "0")],
          }),
        ],
      },
      { labelsEnabled: false },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "int-1");
    expect(entry?.kind).toBe("point");
    expect(entry?.name).toBe("intersection X");
    const marker = findByName(entry!.object3d, "point-marker")[0] as THREE.Mesh;
    expect(marker.position.equals(new THREE.Vector3(2, 0, 0))).toBe(true);
  });

  it("display 'segment' (shortest distance) is a tube with end caps", () => {
    const graph = buildSceneGraph(
      {
        displayGeometry: [
          makeDisplay({
            displayId: "seg-1",
            kind: "segment",
            label: "shortest distance",
            points: [
              makePoint("s1", "F1", "0", "0", "0"),
              makePoint("s2", "F2", "0", "3", "4"),
            ],
          }),
        ],
      },
      { labelsEnabled: false },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "seg-1");
    const tube = findByName(entry!.object3d, "segment-tube")[0] as THREE.Mesh;
    const geometry = tube.geometry as THREE.CylinderGeometry;
    expect(geometry.parameters.height).toBeCloseTo(5, 6);
    expect(tube.position.distanceTo(new THREE.Vector3(0, 1.5, 2))).toBeLessThan(1e-9);
    expect(findByName(entry!.object3d, "segment-end-0")).toHaveLength(1);
    expect(findByName(entry!.object3d, "segment-end-1")).toHaveLength(1);
  });

  it("display 'segment' with coincident ends degrades to a marker", () => {
    const graph = buildSceneGraph(
      {
        displayGeometry: [
          makeDisplay({
            displayId: "seg-0",
            kind: "segment",
            label: "zero distance",
            points: [
              makePoint("z1", "Z", "1", "1", "1"),
              makePoint("z2", "Z", "1", "1", "1"),
            ],
          }),
        ],
      },
      { labelsEnabled: false },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "seg-0");
    expect(findByName(entry!.object3d, "segment-degenerate-marker")).toHaveLength(1);
  });

  it("display 'line' (plane intersection) uses the finite window with configurable extent", () => {
    const graph = buildSceneGraph(
      {
        displayGeometry: [
          makeDisplay({
            displayId: "int-line",
            kind: "line",
            label: "intersection line",
            points: [makePoint("ilp", "P", "0", "0", "2")],
            direction: makeVector3("1", "0", "0"),
          }),
        ],
      },
      { labelsEnabled: false, viewExtent: 4 },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "int-line");
    const solid = findByName(entry!.object3d, "line-window-solid")[0] as THREE.Line;
    const points = linePositions(solid);
    expect(points[0]?.equals(new THREE.Vector3(-4, 0, 2))).toBe(true);
    expect(points[1]?.equals(new THREE.Vector3(4, 0, 2))).toBe(true);
  });

  it("display 'normal-arrow' is dashed; display 'vector-arrow' is solid", () => {
    const graph = buildSceneGraph(
      {
        displayGeometry: [
          makeDisplay({
            displayId: "na",
            kind: "normal-arrow",
            label: "n",
            points: [makePoint("nb", "B", "0", "0", "0")],
            direction: makeVector3("0", "1", "0"),
          }),
          makeDisplay({
            displayId: "va",
            kind: "vector-arrow",
            label: "v",
            points: [makePoint("vb", "B", "0", "0", "0")],
            direction: makeVector3("1", "0", "0"),
          }),
        ],
      },
      { labelsEnabled: false },
    );
    const registry = readSceneGraphMeta(graph)!.registry;
    const normal = registry.find((e) => e.id === "na")!;
    const vector = registry.find((e) => e.id === "va")!;
    expect(normal.kind).toBe("normal-arrow");
    expect(findByName(normal.object3d, "arrow-shaft-dashed")).toHaveLength(1);
    expect(findByName(vector.object3d, "arrow-shaft-solid")).toHaveLength(1);
  });

  it("display 'plane' renders translucent with the configured opacity", () => {
    const graph = buildSceneGraph(
      {
        displayGeometry: [
          makeDisplay({
            displayId: "dp",
            kind: "plane",
            label: "π2",
            points: [makePoint("dpp", "P", "0", "0", "0")],
            normal: makeVector3("0", "1", "0"),
          }),
        ],
      },
      { labelsEnabled: false, planeOpacity: 0.2 },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "dp");
    const surface = findByName(entry!.object3d, "plane-surface")[0] as THREE.Mesh;
    expect((surface.material as THREE.MeshBasicMaterial).opacity).toBe(0.2);
  });
});

describe("angle-arc geometry", () => {
  const arcDisplay = makeDisplay({
    displayId: "arc-1",
    kind: "angle-arc",
    label: "angle arc (suggested radius 1 unit): from d1 towards d2",
    points: [makePoint("av", "V", "0", "0", "0")],
    direction: makeVector3("1", "0", "0"),
    normal: makeVector3("0", "0", "1"),
  });

  it("arc points lie in the plane spanned by start/end directions through the centre", () => {
    const graph = buildSceneGraph(
      {
        displayGeometry: [arcDisplay],
        metadata: [
          {
            id: "arc-1",
            kind: "angle-arc",
            name: "θ",
            equationText: "cos θ = 3/5",
            keyParams: { sweepDegrees: "53.13" },
          } satisfies SceneEntityMeta,
        ],
      },
      { labelsEnabled: false, arcSegments: 32 },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "arc-1");
    expect(entry?.equationText).toBe("cos θ = 3/5");
    const arc = findByName(entry!.object3d, "angle-arc-line")[0] as THREE.Line;
    const points = linePositions(arc);
    expect(points).toHaveLength(33);
    const normal = new THREE.Vector3(0, 0, 1);
    for (const p of points) {
      // Every arc point is in the arc plane (z = 0) on the radius-1 circle.
      expect(Math.abs(p.dot(normal))).toBeLessThan(1e-9);
      expect(p.length()).toBeCloseTo(1, 6);
    }
    // First point is along the start direction.
    expect(points[0]!.distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-9);
    // Sweep matches the caller-provided solved angle.
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const cosSweep = first.clone().normalize().dot(last.clone().normalize());
    expect(cosSweep).toBeCloseTo(Math.cos((53.13 * Math.PI) / 180), 3);
    // Sector fan present.
    expect(findByName(entry!.object3d, "angle-arc-sector")).toHaveLength(1);
  });

  it("defaults to a 90° sweep when no metadata sweep is supplied", () => {
    const graph = buildSceneGraph(
      { displayGeometry: [arcDisplay] },
      { labelsEnabled: false, arcSegments: 8 },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "arc-1");
    const arc = findByName(entry!.object3d, "angle-arc-line")[0] as THREE.Line;
    const points = linePositions(arc);
    const last = points[points.length - 1]!;
    expect(last.distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-6);
  });

  it("a payload without an arc normal (0°/180° case) degrades to a marker", () => {
    const graph = buildSceneGraph(
      {
        displayGeometry: [
          makeDisplay({
            displayId: "arc-deg",
            kind: "angle-arc",
            label: "0° arc",
            points: [makePoint("adv", "V", "1", "0", "0")],
            direction: makeVector3("1", "0", "0"),
          }),
        ],
      },
      { labelsEnabled: false },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "arc-deg");
    expect(
      findByName(entry!.object3d, "angle-arc-degenerate-marker"),
    ).toHaveLength(1);
    expect(findByName(entry!.object3d, "angle-arc-line")).toHaveLength(0);
  });
});

describe("buildSceneGraph — robustness and meta", () => {
  it("malformed payloads record a warning and are skipped, never crash", () => {
    const graph = buildSceneGraph(
      {
        displayGeometry: [
          makeDisplay({ displayId: "bad-1", kind: "point" }),
          makeDisplay({ displayId: "bad-2", kind: "segment", points: [makePoint("x", "x", "0", "0", "0")] }),
          makeDisplay({ displayId: "bad-3", kind: "line", points: [makePoint("x", "x", "0", "0", "0")] }),
          makeDisplay({
            displayId: "bad-4",
            kind: "plane",
            points: [makePoint("x", "x", "0", "0", "0")],
            normal: makeVector3("0", "0", "0"),
          }),
          makeDisplay({
            displayId: "bad-5",
            kind: "vector-arrow",
            direction: makeVector3("0", "0", "0"),
          }),
        ],
      },
      { labelsEnabled: false },
    );
    const meta = readSceneGraphMeta(graph);
    expect(meta?.warnings).toHaveLength(5);
    const ids = meta?.registry.map((e) => e.id) ?? [];
    for (const bad of ["bad-1", "bad-2", "bad-3", "bad-4", "bad-5"]) {
      expect(ids).not.toContain(bad);
    }
  });

  it("attaches registry + legend + warnings to group.userData", () => {
    const graph = buildSceneGraph({}, { labelsEnabled: false });
    expect(graph.userData[SCENE_GRAPH_META_KEY]).toBeDefined();
    const meta = readSceneGraphMeta(graph);
    expect(meta?.legend.entries.length).toBeGreaterThan(0);
    // readSceneGraphMeta on a foreign group → undefined
    expect(readSceneGraphMeta(new THREE.Group())).toBeUndefined();
  });

  it("includeAxes:false omits the orientation scaffold", () => {
    const graph = buildSceneGraph(
      { points: [makePoint("p", "P", "0", "0", "0")] },
      { includeAxes: false, labelsEnabled: false },
    );
    const meta = readSceneGraphMeta(graph);
    expect(meta?.registry.map((e) => e.id)).toEqual(["p"]);
  });

  it("labelsEnabled:false produces no sprites at all", () => {
    const { factory, recorder } = createStubCanvas2DFactory();
    const graph = buildSceneGraph(
      { points: [makePoint("p", "P", "0", "0", "0")] },
      { labelsEnabled: false, canvasFactory: factory },
    );
    let spriteCount = 0;
    graph.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) {
        spriteCount += 1;
      }
    });
    expect(spriteCount).toBe(0);
    expect(recorder.fillTextCalls).toHaveLength(0);
  });

  it("caller metadata lands in the registry (equation text is displayed, never computed)", () => {
    const graph = buildSceneGraph(
      {
        points: [makePoint("p", "P", "1", "2", "3")],
        metadata: [
          {
            id: "p",
            kind: "point",
            name: "Point P",
            equationText: "P = (1, 2, 3)",
            keyParams: { x: "1", y: "2", z: "3" },
          },
        ],
      },
      { labelsEnabled: false },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "p");
    expect(entry?.equationText).toBe("P = (1, 2, 3)");
    expect(entry?.keyParams["z"]).toBe("3");
  });
});

describe("resolveSceneBuildOptions / buildDisplayEntry", () => {
  it("applies documented defaults", () => {
    const resolved = resolveSceneBuildOptions();
    expect(resolved.viewExtent).toBe(10);
    expect(resolved.lineExtensionLength).toBe(5);
    expect(resolved.planeOpacity).toBe(0.35);
    expect(resolved.defaultArcSweepDegrees).toBe(90);
    expect(resolved.labelsEnabled).toBe(true);
  });

  it("buildDisplayEntry uses the display label as the fallback name", () => {
    const warnings: string[] = [];
    const entry = buildDisplayEntry(
      makeDisplay({
        displayId: "d",
        kind: "point",
        label: "",
        points: [makePoint("x", "x", "0", "0", "0")],
      }),
      undefined,
      { options: resolveSceneBuildOptions({ labelsEnabled: false }), warnings },
    );
    expect(entry?.name).toBe("d");
  });

  it("honours a negative sweep direction", () => {
    const warnings: string[] = [];
    const entry = buildDisplayEntry(
      makeDisplay({
        displayId: "arc-neg",
        kind: "angle-arc",
        label: "negative sweep",
        points: [makePoint("x", "x", "0", "0", "0")],
        direction: makeVector3("1", "0", "0"),
        normal: makeVector3("0", "0", "1"),
      }),
      {
        id: "arc-neg",
        kind: "angle-arc",
        name: "neg",
        equationText: "",
        keyParams: { sweepDegrees: "-45" },
      },
      { options: resolveSceneBuildOptions({ labelsEnabled: false }), warnings },
    );
    const arc = findByName(entry!.object3d, "angle-arc-line")[0] as THREE.Line;
    const points = linePositions(arc);
    const last = points[points.length - 1]!;
    expect(last.y).toBeLessThan(0);
  });
});

describe("scalar edge cases through the display pipeline", () => {
  it("fractional and negative coordinates place objects exactly (float view)", () => {
    const graph = buildSceneGraph(
      { points: [makePoint("pf", "F", "3/2", "-7/4", "0")] },
      { labelsEnabled: false },
    );
    const entry = readSceneGraphMeta(graph)?.registry.find((e) => e.id === "pf");
    const marker = findByName(entry!.object3d, "point-marker")[0] as THREE.Mesh;
    expect(marker.position.x).toBeCloseTo(1.5, 9);
    expect(marker.position.y).toBeCloseTo(-1.75, 9);
  });
});

// Referenced to keep the import meaningful for type-level assertions.
void makeScalar;
