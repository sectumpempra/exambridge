import { describe, expect, it } from "vitest";
import type { MechanicsSceneV1, MechanicsSurfaceV1 } from "@/features/mechanics-lab/schema";
import {
  connectorPathPoints,
  forceArrowLength,
  objectContactPoint,
  sceneGeometryPoints,
  surfaceDirection,
  surfaceLine,
  surfaceNormal,
} from "./geometry.js";

const horizontal: MechanicsSurfaceV1 = { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } };
const inclined: MechanicsSurfaceV1 = { id: "surf-2", kind: "inclined", angleDeg: 30, friction: { model: "smooth" } };

function scene(over: Partial<MechanicsSceneV1>): MechanicsSceneV1 {
  return {
    schemaVersion: "1.0.0",
    sceneId: "scene-geo",
    title: "几何测试",
    gravity: 10,
    analysisMode: "equilibrium",
    objects: [],
    surfaces: [],
    supports: [],
    pulleys: [],
    connectors: [],
    externalForces: [],
    initialConditions: [],
    ...over,
  };
}

describe("geometry 渲染几何", () => {
  it("水平面方向/法线", () => {
    expect(surfaceDirection(horizontal)).toEqual({ x: 1, y: 0 });
    expect(surfaceNormal(horizontal)).toEqual({ x: -0, y: 1 });
  });

  it("斜面 30° 方向/法线", () => {
    const d = surfaceDirection(inclined);
    expect(d.x).toBeCloseTo(Math.cos(Math.PI / 6), 9);
    expect(d.y).toBeCloseTo(0.5, 9);
    const n = surfaceNormal(inclined);
    expect(n.x).toBeCloseTo(-0.5, 9);
    expect(n.y).toBeCloseTo(Math.cos(Math.PI / 6), 9);
  });

  it("接触点为物体底面中点", () => {
    const obj = { id: "m-obj-1", label: "m1", mass: 2, position: { x: 0, y: 0.3 }, surfaceId: "surf-1" };
    const c = objectContactPoint(obj, horizontal);
    expect(c.y).toBeCloseTo(0, 9);
  });

  it("无物体平面给出示意虚线", () => {
    const line = surfaceLine(inclined, []);
    expect(line.anchored).toBe(false);
  });

  it("有物体平面沿接触点延伸", () => {
    const objs = [
      { id: "m-obj-1", label: "m1", mass: 2, position: { x: 0, y: 0.3 }, surfaceId: "surf-1" },
      { id: "m-obj-2", label: "m2", mass: 2, position: { x: 2, y: 0.3 }, surfaceId: "surf-1" },
    ];
    const line = surfaceLine(horizontal, objs);
    expect(line.anchored).toBe(true);
    expect(line.p1.y).toBeCloseTo(0, 9);
    expect(line.p2.y).toBeCloseTo(0, 9);
    expect(line.p1.x).toBeLessThan(0);
    expect(line.p2.x).toBeGreaterThan(2);
  });

  it("连接折线点与场景几何点", () => {
    const sc = scene({
      objects: [{ id: "m-obj-1", label: "m1", mass: 2, position: { x: 0, y: 2 } }],
      connectors: [
        {
          id: "rope-1",
          kind: "rope",
          nodes: [
            { type: "object", objectId: "m-obj-1" },
            { type: "anchor", point: { x: 0, y: 4 } },
          ],
        },
      ],
    });
    const pts = connectorPathPoints(sc.connectors[0]!, sc);
    expect(pts).toHaveLength(2);
    expect(sceneGeometryPoints(sc).length).toBeGreaterThanOrEqual(3);
  });

  it("力箭头长度截断", () => {
    expect(forceArrowLength(0)).toBeCloseTo(0.6, 9);
    expect(forceArrowLength(100)).toBe(2);
    expect(forceArrowLength(12)).toBeCloseTo(1, 9);
  });

  it("斜面上有物体时平面线沿斜面延伸", () => {
    const objs = [
      { id: "m-obj-1", label: "m1", mass: 2, position: { x: 1.7320508075688772, y: 1.3 }, surfaceId: "surf-2" },
    ];
    const line = surfaceLine(inclined, objs);
    expect(line.anchored).toBe(true);
    const d = surfaceDirection(inclined);
    const dirX = line.p2.x - line.p1.x;
    const dirY = line.p2.y - line.p1.y;
    // 方向与斜面平行
    expect(dirY / dirX).toBeCloseTo(d.y / d.x, 6);
  });

  it("force 端点不贡献折线点", () => {
    const sc = scene({
      objects: [{ id: "m-obj-1", label: "m1", mass: 2, position: { x: 0, y: 2 } }],
      pulleys: [{ id: "pul-1", kind: "fixed", position: { x: 0, y: 4 } }],
      connectors: [
        {
          id: "rope-1",
          kind: "rope",
          nodes: [
            { type: "object", objectId: "m-obj-1" },
            { type: "pulley", pulleyId: "pul-1" },
            { type: "force", magnitude: 20 },
          ],
        },
      ],
    });
    const pts = connectorPathPoints(sc.connectors[0]!, sc);
    expect(pts).toHaveLength(2);
  });
});
