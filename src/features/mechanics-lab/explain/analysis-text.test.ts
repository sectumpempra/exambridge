import { describe, expect, it } from "vitest";
import { solveMechanicsScene } from "@/features/mechanics-lab/core";
import { SCHEMA_VERSION_V1, type MechanicsSceneV1 } from "@/features/mechanics-lab/schema";
import { formatAnalysisText } from "./analysis-text.js";

describe("formatAnalysisText", () => {
  it("包含状态、章节标题与关键数值", () => {
    const scene: MechanicsSceneV1 = {
      schemaVersion: SCHEMA_VERSION_V1,
      sceneId: "scene-text",
      title: "光滑水平面",
      gravity: 10,
      analysisMode: "equilibrium",
      objects: [{ id: "m-obj-1", label: "m1", mass: 2, position: { x: 0, y: 0.3 }, surfaceId: "surf-1" }],
      surfaces: [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }],
      supports: [],
      pulleys: [],
      connectors: [],
      externalForces: [],
      initialConditions: [],
    };
    const sol = solveMechanicsScene(scene);
    const text = formatAnalysisText(sol);
    expect(text).toContain("已求解");
    expect(text).toContain("## 1. 直接结论");
    expect(text).toContain("## 8. 求解结果");
    expect(text).toContain("## 10. 有效性检查");
    expect(text).toContain("N(m-obj-1) = 20.000000 N");
    expect(text).toContain("确定性求解器");
  });
});
