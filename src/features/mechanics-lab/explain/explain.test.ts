import { describe, expect, it } from "vitest";
import { solveMechanicsScene } from "@/features/mechanics-lab/core";
import { SCHEMA_VERSION_V1, type MechanicsSceneV1 } from "@/features/mechanics-lab/schema";
import { explainSolution, substituteEquation } from "./explain.js";

function roughInclineScene(): MechanicsSceneV1 {
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    sceneId: "scene-explain",
    title: "粗糙斜面下滑",
    gravity: 10,
    analysisMode: "dynamics",
    objects: [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 1.7320508075688772, y: 1 }, surfaceId: "surf-1" },
    ],
    surfaces: [
      { id: "surf-1", kind: "inclined", angleDeg: 30, friction: { model: "rough", muS: 0.3, muK: 0.2 } },
    ],
    supports: [],
    pulleys: [],
    connectors: [],
    externalForces: [],
    initialConditions: [],
  };
}

function unsupportedScene(): MechanicsSceneV1 {
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    sceneId: "scene-explain-u",
    title: "弹簧",
    gravity: 10,
    analysisMode: "dynamics",
    objects: [{ id: "m-obj-1", label: "m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" }],
    surfaces: [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }],
    supports: [],
    pulleys: [],
    connectors: [
      { id: "spring-1", kind: "spring", nodes: [{ type: "object", objectId: "m-obj-1" }, { type: "anchor", point: { x: 2, y: 0.5 } }] },
    ],
    externalForces: [],
    initialConditions: [],
  };
}

describe("explainSolution", () => {
  it("按规格书第九节 1-11 顺序生成章节", () => {
    const sol = solveMechanicsScene(roughInclineScene());
    const doc = explainSolution(sol);
    expect(doc.sections.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(doc.sections.map((s) => s.id)).toEqual([
      "conclusion",
      "assumptions",
      "forces",
      "positive-directions",
      "constraints",
      "equations",
      "substitution",
      "results",
      "units",
      "validation",
      "unsupported-or-required",
    ]);
    expect(doc.statusLabel).toBe("已求解");
  });

  it("不修改 core 数值：结果章节与 solution.values 一致", () => {
    const sol = solveMechanicsScene(roughInclineScene());
    const doc = explainSolution(sol);
    const results = doc.sections.find((s) => s.id === "results");
    expect(results?.items).toHaveLength(sol.values.length);
    const aItem = results?.items.find((i) => i.text.includes("a(m-obj-1)"));
    expect(aItem?.text).toContain("-3.267949");
  });

  it("受力章节包含力种类、方向与单位", () => {
    const sol = solveMechanicsScene(roughInclineScene());
    const doc = explainSolution(sol);
    const forces = doc.sections.find((s) => s.id === "forces");
    expect(forces?.items.some((i) => i.text.includes("重力"))).toBe(true);
    expect(forces?.items.some((i) => i.text.includes("支持力"))).toBe(true);
    expect(forces?.items.some((i) => i.text.includes("滑动摩擦力"))).toBe(true);
    expect(forces?.items.some((i) => i.text.includes("N"))).toBe(true);
  });

  it("代入过程包含验证通过标记", () => {
    const sol = solveMechanicsScene(roughInclineScene());
    const doc = explainSolution(sol);
    const sub = doc.sections.find((s) => s.id === "substitution");
    expect(sub?.items.length).toBeGreaterThan(0);
    expect(sub?.items.every((i) => i.text.includes("验证通过"))).toBe(true);
  });

  it("unsupported 状态展示不支持能力文案", () => {
    const sol = solveMechanicsScene(unsupportedScene());
    expect(sol.status).toBe("unsupported");
    const doc = explainSolution(sol);
    const sec = doc.sections.find((s) => s.id === "unsupported-or-required");
    expect(sec?.items.some((i) => i.text.includes("弹簧"))).toBe(true);
    expect(sec?.items.some((i) => i.text.includes("当前版本不支持"))).toBe(true);
    expect(doc.statusLabel).toBe("当前版本不支持");
  });

  it("方向报告把方向相反标注为 warning", () => {
    const sol = solveMechanicsScene(roughInclineScene());
    const doc = explainSolution(sol);
    const dirs = doc.sections.find((s) => s.id === "positive-directions");
    // 粗糙斜面下滑 a<0：oppositeToAssumption=true → warning
    expect(dirs?.items.some((i) => i.kind === "warning" && i.text.includes("m-obj-1"))).toBe(true);
  });
});

describe("substituteEquation", () => {
  it("未知量未解出时返回 null", () => {
    const eq = {
      equationId: "eq-1",
      kind: "newton-y" as const,
      description: "测试",
      terms: [{ symbol: "T(x)", coefficient: 1 }],
      constant: 10,
      symbolic: "T(x) = 10",
    };
    expect(substituteEquation(eq, new Map())).toBeNull();
    expect(substituteEquation(eq, new Map([["T(x)", 10]]))).toContain("验证通过");
  });

  it("无项方程返回 null", () => {
    const eq = {
      equationId: "eq-2",
      kind: "newton-x" as const,
      description: "空",
      terms: [],
      constant: 0,
      symbolic: "0 = 0",
    };
    expect(substituteEquation(eq, new Map())).toBeNull();
  });
});
