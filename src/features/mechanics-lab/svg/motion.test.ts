import { describe, expect, it } from "vitest";
import { solveMechanicsScene } from "@/features/mechanics-lab/core";
import type { MechanicsSceneV1 } from "@/features/mechanics-lab/schema";
import {
  PLAYBACK_STEP_S,
  buildMotionTimeline,
  createPlayback,
  motionStateAt,
  playbackReducer,
} from "./motion.js";

const dynamicScene: MechanicsSceneV1 = {
  schemaVersion: "1.0.0",
  sceneId: "scene-motion",
  title: "桌面+悬挂",
  gravity: 10,
  analysisMode: "dynamics",
  objects: [
    { id: "m-obj-1", label: "m1", mass: 4, position: { x: 0, y: 0.5 }, surfaceId: "surf-1" },
    { id: "m-obj-2", label: "m2", mass: 2, position: { x: 2, y: -1 } },
  ],
  surfaces: [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }],
  supports: [],
  pulleys: [{ id: "pul-1", kind: "fixed", position: { x: 2, y: 0.5 } }],
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
  externalForces: [],
  initialConditions: [],
};

describe("buildMotionTimeline 门槛", () => {
  it("solved + dynamics：生成时间线（a=10/3）", () => {
    const sol = solveMechanicsScene(dynamicScene);
    const tl = buildMotionTimeline(sol, dynamicScene);
    expect(tl).not.toBeNull();
    expect(tl?.objects).toHaveLength(2);
    const m1 = tl?.objects.find((o) => o.objectId === "m-obj-1");
    expect(m1?.accelerationAlongPath).toBeCloseTo(10 / 3, 9);
    expect(m1?.initialVelocityAlongPath).toBe(0);
  });

  it("equilibrium 模式：null", () => {
    const scene: MechanicsSceneV1 = { ...dynamicScene, analysisMode: "equilibrium" };
    const sol = solveMechanicsScene(scene);
    expect(buildMotionTimeline(sol, scene)).toBeNull();
  });

  it("非 solved 状态：null", () => {
    const bad: MechanicsSceneV1 = {
      ...dynamicScene,
      analysisMode: "dynamics",
      externalForces: [{ id: "force-1", objectId: "m-obj-1", magnitude: 60, angleDeg: 0 }],
    };
    const sol = solveMechanicsScene(bad); // 绷紧假设解出 T<0 → assumption-invalid
    expect(sol.status).toBe("assumption-invalid");
    expect(buildMotionTimeline(sol, bad)).toBeNull();
  });
});

describe("motionStateAt", () => {
  it("v0=0、a=10/3：s=½at²、v=at", () => {
    const sol = solveMechanicsScene(dynamicScene);
    const tl = buildMotionTimeline(sol, dynamicScene);
    if (tl === null) throw new Error("timeline null");
    const states = motionStateAt(tl, 2);
    const m1 = states.find((s) => s.objectId === "m-obj-1");
    expect(m1?.velocityAlongPath).toBeCloseTo(20 / 3, 9);
    expect(m1?.displacementAlongPath).toBeCloseTo(20 / 3, 9);
    // m1 沿 +x：位置 x = 0 + s
    expect(m1?.position.x).toBeCloseTo(20 / 3, 9);
    const m2 = states.find((s) => s.objectId === "m-obj-2");
    expect(m2?.accelerationAlongPath).toBeCloseTo(-10 / 3, 9);
  });

  it("t 截断到 [0, duration]", () => {
    const sol = solveMechanicsScene(dynamicScene);
    const tl = buildMotionTimeline(sol, dynamicScene);
    if (tl === null) throw new Error("timeline null");
    expect(motionStateAt(tl, -5)).toEqual(motionStateAt(tl, 0));
    expect(motionStateAt(tl, 999)).toEqual(motionStateAt(tl, tl.duration));
  });
});

describe("playbackReducer", () => {
  it("play/pause/toggle/reset", () => {
    let s = createPlayback(8);
    s = playbackReducer(s, { type: "play" });
    expect(s.playing).toBe(true);
    s = playbackReducer(s, { type: "tick", dt: 1 });
    expect(s.time).toBeCloseTo(1, 9);
    s = playbackReducer(s, { type: "pause" });
    expect(s.playing).toBe(false);
    s = playbackReducer(s, { type: "tick", dt: 1 });
    expect(s.time).toBeCloseTo(1, 9); // 暂停时 tick 无效
    s = playbackReducer(s, { type: "toggle" });
    expect(s.playing).toBe(true);
    s = playbackReducer(s, { type: "reset" });
    expect(s).toEqual({ playing: false, time: 0, speed: 1, duration: 8 });
  });

  it("速度倍率与单步", () => {
    let s = createPlayback(8);
    s = playbackReducer(s, { type: "set-speed", speed: 0.25 });
    s = playbackReducer(s, { type: "play" });
    s = playbackReducer(s, { type: "tick", dt: 1 });
    expect(s.time).toBeCloseTo(0.25, 9);
    s = playbackReducer(s, { type: "step" });
    expect(s.playing).toBe(false);
    expect(s.time).toBeCloseTo(0.25 + PLAYBACK_STEP_S, 9);
  });

  it("播到末尾自动停止；再按播放从头开始", () => {
    let s = createPlayback(1);
    s = playbackReducer(s, { type: "play" });
    s = playbackReducer(s, { type: "tick", dt: 2 });
    expect(s.playing).toBe(false);
    expect(s.time).toBe(1);
    s = playbackReducer(s, { type: "play" });
    expect(s.time).toBe(0);
    expect(s.playing).toBe(true);
    // toggle 到末尾同样从头
    s = playbackReducer(s, { type: "tick", dt: 5 });
    s = playbackReducer(s, { type: "toggle" });
    expect(s.time).toBe(0);
  });

  it("seek 截断", () => {
    let s = createPlayback(8);
    s = playbackReducer(s, { type: "seek", time: -1 });
    expect(s.time).toBe(0);
    s = playbackReducer(s, { type: "seek", time: 99 });
    expect(s.time).toBe(8);
  });
});
