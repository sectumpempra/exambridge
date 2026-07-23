import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION_V1, type MechanicsSceneV1 } from "@/features/mechanics-lab/schema";
import { solveMechanicsScene } from "./solver.js";
import { NUMERICAL_TOLERANCE, DISPLAY_TOLERANCE } from "./tolerances.js";

function baseScene(): MechanicsSceneV1 {
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    sceneId: "scene-unit",
    title: "单元测试场景",
    gravity: 10,
    analysisMode: "equilibrium",
    objects: [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
    ],
    surfaces: [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }],
    supports: [],
    pulleys: [],
    connectors: [],
    externalForces: [],
    initialConditions: [],
  };
}

describe("容差常量", () => {
  it("集中定义", () => {
    expect(NUMERICAL_TOLERANCE).toBe(1e-9);
    expect(DISPLAY_TOLERANCE).toBe(1e-6);
  });
});

describe("solveMechanicsScene 基础路径", () => {
  it("拒绝协议非法输入（input-required 而非抛异常）", () => {
    const bad = { ...baseScene(), gravity: -1 } as MechanicsSceneV1;
    const sol = solveMechanicsScene(bad);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "schema-check")).toBe(true);
  });

  it("光滑水平面平衡：N=mg，状态 solved", () => {
    const sol = solveMechanicsScene(baseScene());
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "N(m-obj-1)")?.value).toBeCloseTo(20, 9);
    expect(sol.freeBodyDiagrams).toHaveLength(1);
    expect(sol.forces.some((f) => f.kind === "gravity")).toBe(true);
    expect(sol.explanationSteps.length).toBeGreaterThanOrEqual(5);
    expect(sol.coordinateSystems[0]?.kind).toBe("global");
  });

  it("固定支点：自由物体被固定并解出支点反力", () => {
    const scene = baseScene();
    scene.objects = [{ id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 2 } }];
    scene.surfaces = [];
    scene.supports.push({ id: "sup-1", objectId: "m-obj-1" });
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 7, angleDeg: 0 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "Rx(sup-1)")?.value).toBeCloseTo(-7, 9);
    expect(sol.values.find((v) => v.symbol === "Ry(sup-1)")?.value).toBeCloseTo(20, 9);
    expect(sol.forces.some((f) => f.kind === "support-reaction")).toBe(true);
  });

  it("绳端拉力已知（force 端点经定滑轮）：悬挂物体平衡", () => {
    const scene = baseScene();
    scene.objects = [{ id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 2 } }];
    scene.surfaces = [];
    scene.pulleys.push({ id: "pul-1", kind: "fixed", position: { x: 0, y: 4 } });
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "pulley", pulleyId: "pul-1" },
        { type: "force", magnitude: 20, label: "手提" },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    // T=20 已知 = mg，平衡成立
    expect(sol.forces.some((f) => f.kind === "tension" && f.magnitude === 20)).toBe(true);
  });

  it("自由物体受水平外力：unsupported（二维自由运动）", () => {
    const scene = baseScene();
    scene.objects = [{ id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 5 } }];
    scene.surfaces = [];
    scene.analysisMode = "dynamics";
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 5, angleDeg: 0 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("unsupported");
    expect(sol.unsupportedFeatures.length).toBeGreaterThan(0);
  });

  it("粗糙平面缺少 μ 值：input-required", () => {
    const scene = baseScene();
    scene.surfaces = [
      { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "rough" } },
    ];
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.requiredInputs.some((r) => r.includes("μs"))).toBe(true);
  });

  it("轻杆节点数错误：input-required", () => {
    const scene = baseScene();
    scene.connectors.push({
      id: "rod-1",
      kind: "rod",
      nodes: [{ type: "object", objectId: "m-obj-1" }],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "rod-node-count")).toBe(true);
  });

  it("绳不连接任何物体：input-required", () => {
    const scene = baseScene();
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "anchor", point: { x: 0, y: 3 } },
        { type: "anchor", point: { x: 1, y: 3 } },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "rope-no-object")).toBe(true);
  });
});
