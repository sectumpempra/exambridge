import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION_V1, type MechanicsSceneV1 } from "@/features/mechanics-lab/schema";
import { solveMechanicsScene } from "./solver.js";

/** 针对摩擦分支、杆约束、拓扑边界的补充单元测试（覆盖率） */
function base(): MechanicsSceneV1 {
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    sceneId: "scene-friction",
    title: "摩擦边界测试",
    gravity: 10,
    analysisMode: "dynamics",
    objects: [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
    ],
    surfaces: [
      { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "rough", muS: 0.5, muK: 0.4 } },
    ],
    supports: [],
    pulleys: [],
    connectors: [],
    externalForces: [],
    initialConditions: [],
  };
}

describe("摩擦分支补充", () => {
  it("动力学静摩擦足够：a=0 且 solved", () => {
    const scene = base();
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 5, angleDeg: 0 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "f(m-obj-1)")?.value).toBeCloseTo(-5, 9);
    expect(sol.constraints.some((c) => c.kind === "static-friction-bound" && c.satisfied)).toBe(true);
  });

  it("初速度给定：滑动摩擦与速度相反，允许减速", () => {
    const scene = base();
    scene.initialConditions.push({ objectId: "m-obj-1", velocity: 4 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    // f = -μkN = -8，a = -4 m/s²（减速）
    expect(sol.values.find((v) => v.symbol === "a(m-obj-1)")?.value).toBeCloseTo(-4, 9);
    expect(sol.directionReports[0]?.decelerating).toBe(true);
    expect(sol.directionReports[0]?.initialVelocityAlongPath).toBe(4);
  });

  it("负初速度：摩擦沿 +x，加速度为正（减速）", () => {
    const scene = base();
    scene.initialConditions.push({ objectId: "m-obj-1", velocity: -2 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "a(m-obj-1)")?.value).toBeCloseTo(4, 9);
  });

  it("动力学但无外力无初速度：静摩擦 f=0，a=0", () => {
    const scene = base();
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "f(m-obj-1)")?.value).toBeCloseTo(0, 9);
  });

  it("粗糙斜面静止（μs 足够，动力学模式）：a=0", () => {
    const scene = base();
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 1.7320508075688772, y: 1 }, surfaceId: "surf-1" },
    ];
    scene.surfaces = [
      { id: "surf-1", kind: "inclined", angleDeg: 30, friction: { model: "rough", muS: 0.8, muK: 0.5 } },
    ];
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    // f = +10（沿斜面向上），上限 0.8×17.32≈13.86 > 10
    expect(sol.values.find((v) => v.symbol === "f(m-obj-1)")?.value).toBeCloseTo(10, 9);
  });
});

describe("杆与支点边界", () => {
  it("动力学模式轻杆：杆长约束方程出现", () => {
    const scene = base();
    scene.surfaces = [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }];
    scene.objects.push({ id: "m-obj-2", label: "物体 m2", mass: 3, position: { x: 2, y: 0.5 }, surfaceId: "surf-1" });
    scene.connectors.push({
      id: "rod-1",
      kind: "rod",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "object", objectId: "m-obj-2" },
      ],
    });
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 10, angleDeg: 180 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    expect(sol.equations.some((e) => e.kind === "rod-length")).toBe(true);
    // 杆连接两物体共同加速：a = -10/(2+3) = -2
    expect(sol.values.find((v) => v.symbol === "a(m-obj-1)")?.value).toBeCloseTo(-2, 9);
    expect(sol.values.find((v) => v.symbol === "a(m-obj-2)")?.value).toBeCloseTo(-2, 9);
  });

  it("杆端点位置重合：input-required", () => {
    const scene = base();
    scene.connectors.push({
      id: "rod-1",
      kind: "rod",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "anchor", point: { x: 0, y: 0.5 } },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "rod-geometry")).toBe(true);
  });

  it("杆端点类型非法（含 force 端）：input-required", () => {
    const scene = base();
    scene.connectors.push({
      id: "rod-1",
      kind: "rod",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "force", magnitude: 5 },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "rod-endpoint-kind")).toBe(true);
  });

  it("支点固定的自由物体在动力学模式保持静止", () => {
    const scene = base();
    scene.objects = [{ id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 2 } }];
    scene.surfaces = [];
    scene.supports.push({ id: "sup-1", objectId: "m-obj-1" });
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 9, angleDeg: 0 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "a(m-obj-1)")).toBeUndefined();
    expect(sol.directionReports[0]?.note).toContain("加速度为零");
  });
});

describe("拓扑边界补充", () => {
  it("动滑轮未挂载物体：input-required", () => {
    const scene = base();
    scene.objects = [{ id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0.5, y: 3 } }];
    scene.surfaces = [];
    scene.pulleys.push(
      { id: "pul-1", kind: "movable", position: { x: 0, y: 2 } },
      { id: "pul-2", kind: "fixed", position: { x: 0.5, y: 5 } },
    );
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "anchor", point: { x: 0, y: 5 } },
        { type: "pulley", pulleyId: "pul-1" },
        { type: "pulley", pulleyId: "pul-2" },
        { type: "object", objectId: "m-obj-1" },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "movable-pulley-no-load")).toBe(true);
  });

  it("一根绳两个动滑轮：unsupported（复杂滑轮组）", () => {
    const scene = base();
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 2 } },
      { id: "m-obj-2", label: "物体 m2", mass: 2, position: { x: 1, y: 2 } },
      { id: "m-obj-3", label: "物体 m3", mass: 2, position: { x: 2, y: 3 } },
    ];
    scene.surfaces = [];
    scene.pulleys.push(
      { id: "pul-1", kind: "movable", position: { x: 0, y: 2 }, attachedObjectId: "m-obj-1" },
      { id: "pul-2", kind: "movable", position: { x: 1, y: 2 }, attachedObjectId: "m-obj-2" },
    );
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "anchor", point: { x: -1, y: 5 } },
        { type: "pulley", pulleyId: "pul-1" },
        { type: "pulley", pulleyId: "pul-2" },
        { type: "object", objectId: "m-obj-3" },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("unsupported");
    expect(sol.unsupportedFeatures).toContain("复杂连续滑轮组");
  });

  it("绳只有一个节点：input-required", () => {
    const scene = base();
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [{ type: "object", objectId: "m-obj-1" }],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "rope-endpoints")).toBe(true);
  });

  it("拉力端经过动滑轮：input-required（V1 无法确定方向）", () => {
    const scene = base();
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 4 } },
      { id: "m-obj-load", label: "重物", mass: 6, position: { x: 0, y: 2 } },
    ];
    scene.surfaces = [];
    scene.pulleys.push({ id: "pul-1", kind: "movable", position: { x: 0, y: 2 }, attachedObjectId: "m-obj-load" });
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "pulley", pulleyId: "pul-1" },
        { type: "force", magnitude: 30 },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "rope-force-movable")).toBe(true);
  });

  it("绳中间节点不是滑轮：input-required", () => {
    const scene = base();
    scene.objects.push({ id: "m-obj-2", label: "物体 m2", mass: 2, position: { x: 2, y: 0.5 }, surfaceId: "surf-1" });
    scene.objects.push({ id: "m-obj-3", label: "物体 m3", mass: 2, position: { x: 4, y: 0.5 }, surfaceId: "surf-1" });
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "object", objectId: "m-obj-2" },
        { type: "object", objectId: "m-obj-3" },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("input-required");
    expect(sol.validation.some((v) => v.ruleId === "rope-middle-kind")).toBe(true);
  });

  it("绳方向偏离路径超过 45°：按几何方向计算并告警", () => {
    const scene = base();
    scene.surfaces = [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }];
    // 物体在水平面上，绳从物体竖直向上（与路径夹角 90°）
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "anchor", point: { x: 0, y: 3 } },
      ],
    });
    scene.analysisMode = "equilibrium";
    const sol = solveMechanicsScene(scene);
    expect(sol.validation.some((v) => v.ruleId === "rope-direction-warning")).toBe(true);
  });
});

describe("结果结构补充", () => {
  it("平衡模式静摩擦不足（正方向 f）：assumption-invalid 且给出滑动估算", () => {
    const scene = base();
    scene.analysisMode = "equilibrium";
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 12, angleDeg: 180 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("assumption-invalid");
    expect(sol.statusReason).toContain("静力平衡假设不成立");
    expect(sol.statusReason).toContain("若转为滑动");
  });

  it("锚点在前、物体在后的轻杆：平衡求解", () => {
    const scene = base();
    scene.analysisMode = "equilibrium";
    scene.surfaces = [
      { id: "surf-1", kind: "inclined", angleDeg: 30, friction: { model: "smooth" } },
    ];
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 1.7320508075688772, y: 1 }, surfaceId: "surf-1" },
    ];
    scene.connectors.push({
      id: "rod-1",
      kind: "rod",
      nodes: [
        { type: "anchor", point: { x: 3.4641016151377544, y: 2 } },
        { type: "object", objectId: "m-obj-1" },
      ],
    });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "R(rod-1)")?.value).toBeCloseTo(10, 9);
  });

  it("两物体场景但只有一物体接杆：另一物体的杆记录被跳过", () => {
    const scene = base();
    scene.analysisMode = "equilibrium";
    scene.surfaces = [
      { id: "surf-1", kind: "inclined", angleDeg: 30, friction: { model: "smooth" } },
      { id: "surf-2", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } },
    ];
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 1.7320508075688772, y: 1 }, surfaceId: "surf-1" },
      { id: "m-obj-2", label: "物体 m2", mass: 1, position: { x: 5, y: 0.5 }, surfaceId: "surf-2" },
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
    expect(sol.status).toBe("solved");
    expect(sol.forces.filter((f) => f.kind === "rod")).toHaveLength(1);
  });

  it("动力学模式 + 拉力端绳（不可约束绳）", () => {
    const scene = base();
    scene.surfaces = [];
    scene.objects = [{ id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 2 } }];
    scene.pulleys.push({ id: "pul-1", kind: "fixed", position: { x: 0, y: 4 } });
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "pulley", pulleyId: "pul-1" },
        { type: "force", magnitude: 30 },
      ],
    });
    const sol = solveMechanicsScene(scene);
    // T=30 已知 > mg=20 → a=+5 上升
    expect(sol.status).toBe("solved");
    expect(sol.values.find((v) => v.symbol === "a(m-obj-1)")?.value).toBeCloseTo(5, 9);
    expect(sol.equations.some((e) => e.kind === "rope-length")).toBe(false);
  });

  it("kinematics 模式无初始条件且静摩擦保持：v0=0、a=0 回退分支", () => {
    const scene = base();
    scene.analysisMode = "kinematics";
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 5, angleDeg: 0 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    expect(sol.kinematics).toHaveLength(1);
    expect(sol.kinematics[0]?.accelerationAlongPath).toBeCloseTo(0, 9);
    expect(sol.kinematics[0]?.initialVelocityAlongPath).toBe(0);
  });

  it("kinematics 模式记录位移/速度函数", () => {
    const scene = base();
    scene.analysisMode = "kinematics";
    scene.surfaces = [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }];
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 10, angleDeg: 0 });
    scene.initialConditions.push({ objectId: "m-obj-1", velocity: 1 });
    const sol = solveMechanicsScene(scene);
    expect(sol.status).toBe("solved");
    expect(sol.kinematics).toHaveLength(1);
    expect(sol.kinematics[0]?.accelerationAlongPath).toBeCloseTo(5, 9);
    expect(sol.kinematics[0]?.velocityFunction).toContain("v(t)");
    const s1 = sol.kinematics[0]?.samples.find((s) => s.t === 1);
    expect(s1?.velocityAlongPath).toBeCloseTo(6, 9);
    expect(s1?.displacementAlongPath).toBeCloseTo(3.5, 9);
  });

  it("solution 通过 schema 的 solution Zod 校验", async () => {
    const { mechanicsSolutionSchemaV1 } = await import("@/features/mechanics-lab/schema");
    const scene = base();
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 12, angleDeg: 0 });
    const sol = solveMechanicsScene(scene);
    expect(mechanicsSolutionSchemaV1.safeParse(sol).success).toBe(true);
  });

  it("阿特伍德不等质量平衡模式：inconsistent", () => {
    const scene = base();
    scene.analysisMode = "equilibrium";
    scene.objects = [
      { id: "m-obj-1", label: "物体 m1", mass: 3, position: { x: -0.3, y: 2 } },
      { id: "m-obj-2", label: "物体 m2", mass: 5, position: { x: 0.3, y: 2 } },
    ];
    scene.surfaces = [];
    scene.pulleys.push({ id: "pul-1", kind: "fixed", position: { x: 0, y: 4 } });
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
    expect(sol.status).toBe("inconsistent");
  });
});
