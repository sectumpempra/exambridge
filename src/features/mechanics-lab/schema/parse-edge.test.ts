/**
 * 引用完整性、迁移器注册表与边界分支补充测试（覆盖率）。
 */
import { describe, expect, it } from "vitest";
import {
  SCENE_MIGRATORS,
  SCHEMA_VERSION_V1,
  migrateScene,
  parseSceneData,
  type MechanicsSceneV1,
} from "./index.js";
import { makeMinimalScene } from "./schema.test.js";

describe("引用完整性分支", () => {
  it("物体引用不存在的平面", () => {
    const scene = makeMinimalScene();
    const obj = scene.objects[0];
    if (obj) obj.surfaceId = "surf-ghost";
    const r = parseSceneData(scene);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.message.includes("surf-ghost"))).toBe(true);
  });

  it("支点引用不存在的物体", () => {
    const scene = makeMinimalScene();
    scene.supports.push({ id: "sup-1", objectId: "m-ghost" });
    const r = parseSceneData(scene);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.message.includes("m-ghost"))).toBe(true);
  });

  it("动滑轮挂载不存在的物体", () => {
    const scene = makeMinimalScene();
    scene.pulleys.push({
      id: "pul-1",
      kind: "movable",
      position: { x: 0, y: 2 },
      attachedObjectId: "m-ghost",
    });
    const r = parseSceneData(scene);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.message.includes("m-ghost"))).toBe(true);
  });

  it("连接引用不存在的滑轮与物体", () => {
    const scene = makeMinimalScene();
    scene.connectors.push({
      id: "rope-1",
      kind: "rope",
      nodes: [
        { type: "object", objectId: "m-ghost" },
        { type: "pulley", pulleyId: "pul-ghost" },
      ],
    });
    const r = parseSceneData(scene);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.message.includes("m-ghost"))).toBe(true);
      expect(r.issues.some((i) => i.message.includes("pul-ghost"))).toBe(true);
    }
  });

  it("初始条件引用不存在的物体", () => {
    const scene = makeMinimalScene();
    scene.initialConditions.push({ objectId: "m-ghost", velocity: 1 });
    const r = parseSceneData(scene);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.message.includes("m-ghost"))).toBe(true);
  });

  it("外力角度范围与绳节点数边界", () => {
    const scene = makeMinimalScene();
    scene.externalForces.push({ id: "force-1", objectId: "m-obj-1", magnitude: 1, angleDeg: 720 });
    expect(parseSceneData(scene).ok).toBe(false);
    scene.externalForces = [];
    scene.connectors.push({ id: "rope-1", kind: "rope", nodes: [] });
    expect(parseSceneData(scene).ok).toBe(false);
  });
});

describe("迁移器注册表", () => {
  it("注册迁移器后旧版本可迁移", () => {
    const legacy = { schemaVersion: "0.9.0", note: "旧版数据" };
    SCENE_MIGRATORS["0.9.0"] = () => makeMinimalScene() as unknown;
    const r = migrateScene(legacy);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.migratedFrom).toBe("0.9.0");
    delete SCENE_MIGRATORS["0.9.0"];
  });

  it("迁移结果仍须通过当前版本校验", () => {
    SCENE_MIGRATORS["0.8.0"] = () => ({ schemaVersion: SCHEMA_VERSION_V1, bad: true });
    const r = migrateScene({ schemaVersion: "0.8.0" });
    expect(r.ok).toBe(false);
    delete SCENE_MIGRATORS["0.8.0"];
  });

  it("当前版本但数据非法：迁移入口同样拒绝", () => {
    const bad: MechanicsSceneV1 = { ...makeMinimalScene(), gravity: -1 };
    const r = migrateScene(bad);
    expect(r.ok).toBe(false);
  });
});
