import { describe, expect, it } from "vitest";
import { solveMechanicsScene } from "@/features/mechanics-lab/core";
import type { MechanicsSceneV1 } from "@/features/mechanics-lab/schema";
import { buildSceneSvg } from "./export-svg.js";

const scene: MechanicsSceneV1 = {
  schemaVersion: "1.0.0",
  sceneId: "scene-export",
  title: "导出测试 <场景>",
  gravity: 10,
  analysisMode: "dynamics",
  objects: [
    { id: "m-obj-1", label: "m1", mass: 4, position: { x: 0, y: 0.3 }, surfaceId: "surf-1" },
    { id: "m-obj-2", label: "m2", mass: 2, position: { x: 2, y: -1 } },
  ],
  surfaces: [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }],
  supports: [],
  pulleys: [{ id: "pul-1", kind: "fixed", position: { x: 2, y: 0.3 } }],
  connectors: [
    {
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-obj-1" },
        { type: "pulley", pulleyId: "pul-1" },
        { type: "object", objectId: "m-obj-2" },
      ],
    },
  ],
  externalForces: [{ id: "force-1", objectId: "m-obj-1", magnitude: 5, angleDeg: 0, label: "F拉" }],
  initialConditions: [],
};

describe("buildSceneSvg", () => {
  it("包含标题、元数据、坐标轴、力箭头与公式标签", () => {
    const svg = buildSceneSvg(scene, { exportedAt: "2026-07-16T00:00:00Z" });
    expect(svg).toContain("<title>导出测试 &lt;场景&gt;</title>");
    expect(svg).toContain('"sceneId":"scene-export"');
    expect(svg).toContain('"schemaVersion":"1.0.0"');
    expect(svg).toContain("marker-end=\"url(#ex-axis)\"");
    expect(svg).toContain("F拉");
    expect(svg).toContain("polyline"); // 绳
    expect(svg).toContain("4kg");
    expect(svg).toContain("水平面（光滑）");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("包含求解结果力箭头（符号=数值）", () => {
    const sol = solveMechanicsScene(scene);
    const svg = buildSceneSvg(scene, { solution: sol, exportedAt: "2026-07-16T00:00:00Z" });
    // m1: T+5=4a；m2: T-20=-2a → T=35/3≈11.67 N
    expect(svg).toContain("T(rope-1)=11.67N");
    expect(svg).toContain("N(m-obj-1)=40.00N");
  });

  it("无 solution 时不含求解力标注", () => {
    const svg = buildSceneSvg(scene, { exportedAt: "2026-07-16T00:00:00Z" });
    expect(svg).not.toContain("T(rope-1)=");
  });

  it("支点与斜面与动滑轮渲染", () => {
    const sc2: MechanicsSceneV1 = {
      ...scene,
      title: "复杂场景",
      objects: [
        { id: "m-obj-1", label: "m1", mass: 2, position: { x: 1.732, y: 1.3 }, surfaceId: "surf-1" },
        { id: "m-obj-load", label: "load", mass: 6, position: { x: 0, y: 2 } },
      ],
      surfaces: [{ id: "surf-1", kind: "inclined", angleDeg: 30, friction: { model: "rough", muS: 0.3, muK: 0.2 } }],
      supports: [{ id: "sup-1", objectId: "m-obj-1" }],
      pulleys: [{ id: "pul-1", kind: "movable", position: { x: 0, y: 2 }, attachedObjectId: "m-obj-load" }],
    };
    const svg = buildSceneSvg(sc2, { exportedAt: "2026-07-16T00:00:00Z" });
    expect(svg).toContain("斜面 30°（粗糙）");
    expect(svg).toContain("支点 sup-1");
    expect(svg).toContain("动滑轮 pul-1");
  });
});
