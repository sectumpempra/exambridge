import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION_V1, type MechanicsSceneV1 } from "@/features/mechanics-lab/schema";
import { solveMechanicsScene } from "./solver.js";

/** 覆盖率补充：绳+摩擦耦合、欠定部分确定、锚定杆动力学、缺 μk 等场景 */
function base(): MechanicsSceneV1 {
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    sceneId: "scene-coverage",
    title: "覆盖率补充场景",
    gravity: 10,
    analysisMode: "dynamics",
    objects: [],
    surfaces: [],
    supports: [],
    pulleys: [],
    connectors: [],
    externalForces: [],
    initialConditions: [],
  };
}

describe("绳+摩擦耦合", () => {
  it("粗糙桌面物体 + 悬挂物体：静摩擦不足转滑动", () => {
    const scene = base();
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
      { id: "m-obj-2", label: "物体 m2", mass: 3, position: { x: 2, y: -1 } },
    ];
    scene.surfaces = [
      { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "rough", muS: 0.4, muK: 0.3 } },
    ];
    scene.pulleys.push({ id: "pul-1", kind: "fixed", position: { x: 2, y: 0.5 } });
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "pulley", pulleyId: "pul-1" },
        { type: "object", objectId: "m-obj-2" },
      ],
    });
    const sol = solveMechanicsScene(scene);
    // 静态：T=30，f=-30，上限 8 → 滑动；动摩擦 f=-6
    // m1: T-6=2a；m2: T-30=-3a... a=(30-6)/5=4.8；T=6+2×4.8=15.6
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "a(m-obj-1)")?.value).toBeCloseTo(4.8, 9);
    expect(sol.values.find((v) => v.symbol === "T(rope-1)")?.value).toBeCloseTo(15.6, 9);
    expect(sol.constraints.some((c) => c.kind === "friction-direction" && c.satisfied)).toBe(true);
  });

  it("粗糙桌面物体 + 轻悬挂：静摩擦保持，整体静止", () => {
    const scene = base();
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
      { id: "m-obj-2", label: "物体 m2", mass: 0.5, position: { x: 2, y: -1 } },
    ];
    scene.surfaces = [
      { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "rough", muS: 0.4, muK: 0.3 } },
    ];
    scene.pulleys.push({ id: "pul-1", kind: "fixed", position: { x: 2, y: 0.5 } });
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "pulley", pulleyId: "pul-1" },
        { type: "object", objectId: "m-obj-2" },
      ],
    });
    const sol = solveMechanicsScene(scene);
    // 静态：T=5，f=-5，|f| ≤ 8 → 静止
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "T(rope-1)")?.value).toBeCloseTo(5, 9);
    expect(sol.values.find((v) => v.symbol === "f(m-obj-1)")?.value).toBeCloseTo(-5, 9);
    expect(sol.values.find((v) => v.symbol === "a(m-obj-1)")).toBeUndefined();
  });

  it("动力学模式下绳段偏离路径：约束取几何余弦", () => {
    const scene = base();
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
      { id: "m-obj-2", label: "物体 m2", mass: 2, position: { x: 2, y: 3 } },
    ];
    scene.surfaces = [
      { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } },
    ];
    // 绳从 m1 斜向上 51° 到锚点上方滑轮：与路径夹角 >45°
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "anchor", point: { x: 1.5, y: 2.4 } },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.validation.some((v) => v.ruleId === "rope-direction-warning")).toBe(true);
  });
});

describe("欠定系统的部分确定值", () => {
  it("平面上物体 + 双竖直绳：支持力被确定，张力自由（欠定）", () => {
    const scene = base();
    scene.analysisMode = "equilibrium";
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
    ];
    scene.surfaces = [
      { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } },
    ];
    scene.connectors.push(
      {
        id: "rope-1",
        kind: "rope",
        nodes: [
          { type: "anchor", point: { x: -0.5, y: 3 } },
          { type: "object", objectId: "m-obj-1" },
        ],
      },
      {
        id: "rope-2",
        kind: "rope",
        nodes: [
          { type: "anchor", point: { x: 0.5, y: 3 } },
          { type: "object", objectId: "m-obj-1" },
        ],
      },
    );
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("underdetermined");
    // 支持力大小未被确定（与张力组合自由）
    const normal = sol.forces.find((f) => f.kind === "normal");
    expect(normal).toBeDefined();
  });

  it("粗糙平面 + 双水平绳：N 被确定，静摩擦与张力自由（欠定）", () => {
    const scene = base();
    scene.analysisMode = "equilibrium";
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
    ];
    scene.surfaces = [
      { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "rough", muS: 0.5, muK: 0.4 } },
    ];
    scene.connectors.push(
      {
        id: "rope-1",
        kind: "rope",
        nodes: [
          { type: "object", objectId: "m-obj-1" },
          { type: "anchor", point: { x: -2, y: 0.5 } },
        ],
      },
      {
        id: "rope-2",
        kind: "rope",
        nodes: [
          { type: "object", objectId: "m-obj-1" },
          { type: "anchor", point: { x: -2, y: 1 } },
        ],
      },
    );
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("underdetermined");
    expect(sol.values.find((v) => v.symbol === "N(m-obj-1)")?.value).toBeCloseTo(20, 9);
  });

  it("一物体单绳、另一物体双绳：T1 被确定，T2a/T2b 自由", () => {
    const scene = base();
    scene.analysisMode = "equilibrium";
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 1, position: { x: -2, y: 2 } },
      { id: "m-obj-2", label: "物体 m2", mass: 2, position: { x: 2, y: 2 } },
    ];
    scene.connectors.push(
      {
        id: "rope-1",
        kind: "rope",
        nodes: [
          { type: "anchor", point: { x: -2, y: 5 } },
          { type: "object", objectId: "m-obj-1" },
        ],
      },
      {
        id: "rope-2",
        kind: "rope",
        nodes: [
          { type: "anchor", point: { x: 1.5, y: 5 } },
          { type: "object", objectId: "m-obj-2" },
        ],
      },
      {
        id: "rope-3",
        kind: "rope",
        nodes: [
          { type: "anchor", point: { x: 2.5, y: 5 } },
          { type: "object", objectId: "m-obj-2" },
        ],
      },
    );
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("underdetermined");
    expect(sol.values.find((v) => v.symbol === "T(rope-1)")?.value).toBeCloseTo(10, 9);
    expect(sol.statusReason).toContain("欠定");
  });
});

describe("动力学缺 μk 与锚定杆", () => {
  it("粗糙平面只有 μs，动力学模式：input-required", () => {
    const scene = base();
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
    ];
    scene.surfaces = [
      { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "rough", muS: 0.4 } },
    ];
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.requiredInputs.some((r) => r.includes("μk"))).toBe(true);
  });

  it("锚定轻杆 + 动力学：杆长约束含单侧项", () => {
    const scene = base();
    scene.analysisMode = "dynamics";
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 1.7320508075688772, y: 1 }, surfaceId: "surf-1" },
    ];
    scene.surfaces = [
      { id: "surf-1", kind: "inclined", angleDeg: 30, friction: { model: "smooth" } },
    ];
    scene.connectors.push({
      id: "rod-1",
      kind: "rod",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "anchor", point: { x: 3.4641016151377544, y: 2 } },
      ],
    });
    const sol = solveMechanicsScene(scene);
    // 动力学模式但杆锚定：a(m1)·(path·axis)=0 → a=0，R=10 平衡
    expect(sol.status).toBe("solved");
    expect(sol.equations.some((e) => e.kind === "rod-length")).toBe(true);
    expect(sol.values.find((v) => v.symbol === "R(rod-1)")?.value).toBeCloseTo(10, 9);
  });
});
