import { describe, expect, it } from "vitest";
import {
  LOCAL_STORAGE_SCENES_KEY_V1,
  SCHEMA_VERSION_V1,
  SI_UNITS_V1,
  STABLE_ID_PATTERN,
  UI_COPY_V1,
  UNSUPPORTED_CAPABILITIES_V1,
  isStableId,
  mechanicsSceneSchemaV1,
  mechanicsSolutionSchemaV1,
  migrateScene,
  parseSceneData,
  parseSceneJson,
  serializeScene,
  type MechanicsSceneV1,
  type MechanicsSolutionV1,
} from "./index.js";

export function makeMinimalScene(): MechanicsSceneV1 {
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    sceneId: "scene-test-01",
    title: "光滑水平面单物体",
    gravity: 10,
    analysisMode: "equilibrium",
    objects: [
      { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
    ],
    surfaces: [
      { id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } },
    ],
    supports: [],
    pulleys: [],
    connectors: [],
    externalForces: [],
    initialConditions: [],
  };
}

describe("constants", () => {
  it("导出协议版本与版本化 localStorage 键", () => {
    expect(SCHEMA_VERSION_V1).toBe("1.0.0");
    expect(LOCAL_STORAGE_SCENES_KEY_V1).toBe("exambridge:mechanics-lab:v1:scenes");
  });

  it("SI 单位定义符合规格书", () => {
    expect(SI_UNITS_V1.mass).toBe("kg");
    expect(SI_UNITS_V1.length).toBe("m");
    expect(SI_UNITS_V1.time).toBe("s");
    expect(SI_UNITS_V1.force).toBe("N");
    expect(SI_UNITS_V1.acceleration).toBe("m/s^2");
    expect(SI_UNITS_V1.angleInternal).toBe("rad");
    expect(SI_UNITS_V1.angleInput).toBe("deg");
  });

  it("稳定 ID 校验", () => {
    expect(isStableId("m-obj-1")).toBe(true);
    expect(isStableId("rope_AB-2")).toBe(true);
    expect(isStableId("1abc")).toBe(false);
    expect(isStableId("ab")).toBe(false);
    expect(isStableId("has space")).toBe(false);
    expect(isStableId(42)).toBe(false);
    expect(STABLE_ID_PATTERN.test("x".repeat(65))).toBe(false);
  });
});

describe("scene schema 校验", () => {
  it("接受合法最小场景并往返序列化", () => {
    const scene = makeMinimalScene();
    const parsed = mechanicsSceneSchemaV1.safeParse(scene);
    expect(parsed.success).toBe(true);
    const roundTrip = parseSceneJson(serializeScene(scene));
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) expect(roundTrip.scene).toEqual(scene);
  });

  it("拒绝负质量", () => {
    const scene = makeMinimalScene();
    const obj = scene.objects[0];
    if (obj) obj.mass = -2;
    const result = parseSceneData(scene);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("schema-violation");
      expect(result.issues.some((i) => i.message.includes("质量"))).toBe(true);
    }
  });

  it("拒绝非法摩擦系数（μk > μs 与负数）", () => {
    const scene = makeMinimalScene();
    scene.surfaces[0] = {
      id: "surf-1",
      kind: "horizontal",
      angleDeg: 0,
      friction: { model: "rough", muS: 0.3, muK: 0.5 },
    };
    expect(parseSceneData(scene).ok).toBe(false);
    scene.surfaces[0] = {
      id: "surf-1",
      kind: "horizontal",
      angleDeg: 0,
      friction: { model: "rough", muS: -0.1 },
    };
    expect(parseSceneData(scene).ok).toBe(false);
  });

  it("拒绝重复 ID 与悬空引用", () => {
    const dup = makeMinimalScene();
    dup.externalForces.push({
      id: "m-obj-1",
      objectId: "m-obj-1",
      magnitude: 1,
      angleDeg: 0,
    });
    expect(parseSceneData(dup).ok).toBe(false);

    const dangling = makeMinimalScene();
    dangling.externalForces.push({
      id: "force-1",
      objectId: "m-ghost",
      magnitude: 1,
      angleDeg: 0,
    });
    const result = parseSceneData(dangling);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.message.includes("m-ghost"))).toBe(true);
  });

  it("拒绝水平面非零倾角与固定滑轮挂载物体", () => {
    const scene = makeMinimalScene();
    scene.surfaces[0] = {
      id: "surf-1",
      kind: "horizontal",
      angleDeg: 15,
      friction: { model: "smooth" },
    };
    expect(parseSceneData(scene).ok).toBe(false);

    const withPulley = makeMinimalScene();
    withPulley.pulleys.push({
      id: "pulley-1",
      kind: "fixed",
      position: { x: 0, y: 2 },
      attachedObjectId: "m-obj-1",
    });
    expect(parseSceneData(withPulley).ok).toBe(false);
  });

  it("拒绝非对象数据与空场景", () => {
    expect(parseSceneData([1, 2, 3]).ok).toBe(false);
    expect(parseSceneData("hello").ok).toBe(false);
    const empty = makeMinimalScene();
    empty.objects = [];
    expect(parseSceneData(empty).ok).toBe(false);
  });
});

describe("parseSceneJson 入口", () => {
  it("拒绝损坏 JSON", () => {
    const result = parseSceneJson('{"schemaVersion": "1.0.0", "objects": [');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("invalid-json");
  });

  it("拒绝未知版本并报告 foundVersion", () => {
    const result = parseSceneJson(JSON.stringify({ schemaVersion: "2.0.0" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("unsupported-version");
      expect(result.foundVersion).toBe("2.0.0");
    }
  });

  it("拒绝缺失版本", () => {
    const result = parseSceneData({ sceneId: "scene-x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("unsupported-version");
  });
});

describe("数据迁移入口", () => {
  it("当前版本直接校验通过", () => {
    const result = migrateScene(makeMinimalScene());
    expect(result.ok).toBe(true);
  });

  it("未知版本安全拒绝", () => {
    const result = migrateScene({ schemaVersion: "0.9.0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("unsupported-version");
  });

  it("非对象数据安全拒绝", () => {
    expect(migrateScene(null).ok).toBe(false);
    expect(migrateScene(42).ok).toBe(false);
  });
});

describe("solution schema", () => {
  it("校验一个完整 MechanicsSolutionV1 结构", () => {
    const solution: MechanicsSolutionV1 = {
      status: "solved",
      statusReason: "方程组满秩，解唯一",
      assumptions: [
        { assumptionId: "a1", kind: "point-mass", text: "物体视为质点" },
      ],
      coordinateSystems: [
        {
          coordinateSystemId: "cs-global",
          kind: "global",
          xAxis: { x: 1, y: 0 },
          yAxis: { x: 0, y: 1 },
          angleDeg: 0,
          description: "全局坐标系",
        },
      ],
      forces: [
        {
          forceId: "f-gravity-m-obj-1",
          objectId: "m-obj-1",
          kind: "gravity",
          label: "重力",
          symbol: "G(m-obj-1)",
          source: "地球",
          direction: { x: 0, y: -1 },
          magnitude: 20,
          unit: "N",
        },
      ],
      freeBodyDiagrams: [
        { objectId: "m-obj-1", objectLabel: "物体 m1", forceIds: ["f-gravity-m-obj-1"] },
      ],
      equations: [
        {
          equationId: "eq-1",
          kind: "newton-y",
          objectId: "m-obj-1",
          description: "物体 m1 的 y 方向平衡方程",
          terms: [{ symbol: "N(m-obj-1)", coefficient: 1 }],
          constant: 20,
          symbolic: "N(m-obj-1) = 20",
        },
      ],
      unknowns: [{ symbol: "N(m-obj-1)", meaning: "支持力", unit: "N" }],
      values: [
        {
          symbol: "N(m-obj-1)",
          value: 20,
          unit: "N",
          display: "20.000000",
          meaning: "支持力",
        },
      ],
      constraints: [
        {
          constraintId: "c-normal",
          kind: "normal-non-negative",
          expression: "N(m-obj-1) ≥ 0",
          satisfied: true,
          detail: "N = 20 N",
        },
      ],
      validation: [
        { ruleId: "residual-check", severity: "info", passed: true, message: "残差 0" },
      ],
      explanationSteps: [{ step: 1, title: "校验输入", detail: "输入合法" }],
      directionReports: [],
      kinematics: [],
      unsupportedFeatures: [],
      requiredInputs: [],
    };
    expect(mechanicsSolutionSchemaV1.safeParse(solution).success).toBe(true);
  });

  it("拒绝非法状态枚举", () => {
    const bad = { status: "计算失败" };
    expect(mechanicsSolutionSchemaV1.safeParse(bad).success).toBe(false);
  });
});

describe("UI 文案常量", () => {
  it("列出第一版全部不支持能力（规格书第六节 12 项）", () => {
    expect(UNSUPPORTED_CAPABILITIES_V1).toHaveLength(12);
    expect(UNSUPPORTED_CAPABILITIES_V1).toContain("有质量滑轮");
    expect(UNSUPPORTED_CAPABILITIES_V1).toContain("弹簧");
    expect(UNSUPPORTED_CAPABILITIES_V1).toContain("复杂连续滑轮组");
    expect(UI_COPY_V1.unsupportedCapabilities).toBe(UNSUPPORTED_CAPABILITIES_V1);
    expect(UI_COPY_V1.statusLabels.solved).toBe("已求解");
    expect(UI_COPY_V1.statusLabels["assumption-invalid"]).toBe("物理假设不成立");
  });
});
