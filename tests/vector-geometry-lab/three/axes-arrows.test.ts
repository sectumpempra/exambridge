import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createArrow } from "@/features/vector-geometry-lab/three/arrows";
import { createAxesGroup } from "@/features/vector-geometry-lab/three/axes";
import { createStubCanvas2DFactory, findByName } from "./helpers.js";

describe("createArrow", () => {
  it("builds a solid arrow: cylinder shaft + cone head, oriented +Y → direction", () => {
    const arrow = createArrow(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 2),
      { color: 0xff0000, lineStyle: "solid" },
    );
    expect(findByName(arrow, "arrow-shaft-solid")).toHaveLength(1);
    expect(findByName(arrow, "arrow-head")).toHaveLength(1);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion);
    expect(up.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-9);
  });

  it("builds a dashed arrow: dashed line shaft (normals) with computed line distances", () => {
    const arrow = createArrow(
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(1, 3, 1),
      { color: 0x00ff00, lineStyle: "dashed" },
    );
    const shafts = findByName(arrow, "arrow-shaft-dashed");
    expect(shafts).toHaveLength(1);
    const shaft = shafts[0] as THREE.Line;
    expect(shaft.material).toBeInstanceOf(THREE.LineDashedMaterial);
    expect(
      shaft.geometry.getAttribute("lineDistance"),
    ).toBeDefined();
    expect(arrow.position.equals(new THREE.Vector3(1, 1, 1))).toBe(true);
  });

  it("replaces a zero-length arrow with a marker instead of crashing", () => {
    const arrow = createArrow(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      { color: 0x0000ff, lineStyle: "solid" },
    );
    expect(findByName(arrow, "arrow-degenerate-marker")).toHaveLength(1);
    expect(findByName(arrow, "arrow-head")).toHaveLength(0);
  });
});

describe("createAxesGroup", () => {
  it("contains x/y/z axes, grid and origin (5 registry entries)", () => {
    const { factory } = createStubCanvas2DFactory();
    const { entries } = createAxesGroup({ canvasFactory: factory });
    const ids = entries.map((e) => e.id);
    expect(ids).toEqual(["axis-x", "axis-y", "axis-z", "grid", "origin"]);
    expect(entries.map((e) => e.kind)).toEqual([
      "axis",
      "axis",
      "axis",
      "grid",
      "origin-marker",
    ]);
  });

  it("distinguishes positive (solid) and negative (dashed) arms plus an axis label — polarity is not colour-only", () => {
    const { factory, recorder } = createStubCanvas2DFactory();
    const { object3d } = createAxesGroup({ canvasFactory: factory });
    const axisX = object3d.children.find((c) => c.name === "axis-x");
    expect(axisX).toBeDefined();
    if (axisX === undefined) {
      return;
    }
    const positive = findByName(axisX, "axis-arm-positive");
    const negative = findByName(axisX, "axis-arm-negative");
    expect(positive).toHaveLength(1);
    expect(negative).toHaveLength(1);
    expect((positive[0] as THREE.Line).material).toBeInstanceOf(
      THREE.LineBasicMaterial,
    );
    expect((negative[0] as THREE.Line).material).toBeInstanceOf(
      THREE.LineDashedMaterial,
    );
    // Axis labels x/y/z + origin label "O" were rasterised.
    expect(recorder.fillTextCalls.map((c) => c.text).sort()).toEqual([
      "O",
      "x",
      "y",
      "z",
    ]);
  });

  it("spans the configured half length", () => {
    const { object3d } = createAxesGroup({ halfLength: 4, labelsEnabled: false });
    const axisY = object3d.children.find((c) => c.name === "axis-y");
    expect(axisY).toBeDefined();
    if (axisY === undefined) {
      return;
    }
    const positive = findByName(axisY, "axis-arm-positive")[0] as THREE.Line;
    const attribute = positive.geometry.getAttribute("position");
    expect(attribute.getY(1)).toBe(4);
  });

  it("can omit the grid", () => {
    const { entries } = createAxesGroup({
      includeGrid: false,
      labelsEnabled: false,
    });
    expect(entries.map((e) => e.id)).toEqual([
      "axis-x",
      "axis-y",
      "axis-z",
      "origin",
    ]);
  });

  it("places the origin marker at (0,0,0)", () => {
    const { object3d } = createAxesGroup({ labelsEnabled: false });
    const origin = findByName(object3d, "origin-marker")[0];
    expect(origin?.position.length()).toBe(0);
  });
});
