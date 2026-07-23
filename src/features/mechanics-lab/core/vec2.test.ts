import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION_V1, type MechanicsSceneV1 } from "@/features/mechanics-lab/schema";
import { solveMechanicsScene } from "./solver.js";
import { unit, radToDeg, degToRad, fromAngleDeg, norm, add, sub, scale, dot, vec } from "./vec2.js";

describe("vec2 工具", () => {
  it("unit 零向量与常规向量", () => {
    expect(unit(vec(0, 0))).toEqual({ x: 0, y: 0 });
    const u = unit(vec(3, 4));
    expect(u.x).toBeCloseTo(0.6, 9);
    expect(u.y).toBeCloseTo(0.8, 9);
  });

  it("角度换算与运算", () => {
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 9);
    expect(degToRad(180)).toBeCloseTo(Math.PI, 9);
    const d = fromAngleDeg(90);
    expect(d.x).toBeCloseTo(0, 9);
    expect(d.y).toBeCloseTo(1, 9);
    expect(norm(vec(3, 4))).toBe(5);
    expect(add(vec(1, 2), vec(3, 4))).toEqual({ x: 4, y: 6 });
    expect(sub(vec(3, 4), vec(1, 2))).toEqual({ x: 2, y: 2 });
    expect(scale(vec(1, 2), 3)).toEqual({ x: 3, y: 6 });
    expect(dot(vec(1, 2), vec(3, 4))).toBe(11);
  });
});

describe("绳拉力端方向解析", () => {
  it("两节点绳（物体+拉力端）缺少几何参照：input-required", () => {
    const scene: MechanicsSceneV1 = {
      schemaVersion: SCHEMA_VERSION_V1,
      sceneId: "scene-rope-force",
      title: "拉力端无方向",
      gravity: 10,
      analysisMode: "equilibrium",
      objects: [{ id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 2 } }],
      surfaces: [],
      supports: [],
      pulleys: [],
      connectors: [
        {
          id: "rope-1",
          kind: "rope",
          nodes: [
            { type: "object", objectId: "m-obj-1" },
            { type: "force", magnitude: 20 },
          ],
        },
      ],
      externalForces: [],
      initialConditions: [],
    };
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "rope-direction-undefined")).toBe(true);
  });
});
