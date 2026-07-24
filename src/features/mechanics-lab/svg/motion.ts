/**
 * 恒加速度动画纯逻辑：时间线构建、状态采样、播放控制状态机。
 *
 * 硬约束（规格书第十节）：
 * - 只演示求解器已确认的恒加速度运动（status=solved/overdetermined-consistent，
 *   且场景为 dynamics/kinematics 模式）；
 * - 动画状态全部由确定性求解结果生成；动画不反向参与求解；
 * - 本模块为纯函数/纯状态机，可直接单测。
 */
import type {
  MechanicsSceneV1,
  MechanicsSolutionV1,
  Vec2V1,
} from "@/features/mechanics-lab/schema";

export interface MotionObjectState {
  objectId: string;
  /** 沿路径位移（m） */
  displacementAlongPath: number;
  /** 沿路径速度（m/s） */
  velocityAlongPath: number;
  /** 沿路径加速度（m/s²） */
  accelerationAlongPath: number;
  /** 世界坐标位置（m），用于画布渲染 */
  position: Vec2V1;
}

export interface MotionTimeline {
  /** 每个物体的运动学记录（含初始位置） */
  objects: {
    objectId: string;
    accelerationAlongPath: number;
    initialVelocityAlongPath: number;
    pathDirection: Vec2V1;
    initialPosition: Vec2V1;
  }[];
  /** 时间轴长度（s） */
  duration: number;
}

export const DEFAULT_MOTION_DURATION_S = 8;

/**
 * 从确定性求解结果构建动画时间线。
 * 非 solved/overdetermined-consistent、非动力学/运动学模式、或场景中有物体加速度未知时返回 null。
 */
export function buildMotionTimeline(
  solution: MechanicsSolutionV1,
  scene: MechanicsSceneV1,
  duration = DEFAULT_MOTION_DURATION_S,
): MotionTimeline | null {
  if (solution.status !== "solved" && solution.status !== "overdetermined-consistent") return null;
  if (scene.analysisMode !== "dynamics" && scene.analysisMode !== "kinematics") return null;

  const objects: MotionTimeline["objects"] = [];
  for (const report of solution.directionReports) {
    const obj = scene.objects.find((o) => o.id === report.objectId);
    if (obj === undefined) return null;
    const a = report.accelerationAlongPath;
    if (a === null) return null; // 存在被静摩擦/支点锁定的物体时，不做整体动画
    objects.push({
      objectId: report.objectId,
      accelerationAlongPath: a,
      initialVelocityAlongPath: report.initialVelocityAlongPath ?? 0,
      pathDirection: report.assumedPositiveDirection,
      initialPosition: obj.position,
    });
  }
  if (objects.length === 0) return null;
  return { objects, duration };
}

/** 采样 t 时刻全部物体状态（t 会被截断到 [0, duration]） */
export function motionStateAt(timeline: MotionTimeline, t: number): MotionObjectState[] {
  const tc = Math.min(Math.max(t, 0), timeline.duration);
  return timeline.objects.map((o) => {
    const s = o.initialVelocityAlongPath * tc + 0.5 * o.accelerationAlongPath * tc * tc;
    const v = o.initialVelocityAlongPath + o.accelerationAlongPath * tc;
    return {
      objectId: o.objectId,
      displacementAlongPath: s,
      velocityAlongPath: v,
      accelerationAlongPath: o.accelerationAlongPath,
      position: {
        x: o.initialPosition.x + o.pathDirection.x * s,
        y: o.initialPosition.y + o.pathDirection.y * s,
      },
    };
  });
}

/* ===================== 播放控制状态机 ===================== */

export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2;

export interface PlaybackState {
  playing: boolean;
  /** 当前时间（s，场景时间） */
  time: number;
  speed: PlaybackSpeed;
  duration: number;
}

export type PlaybackAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "set-speed"; speed: PlaybackSpeed }
  | { type: "seek"; time: number }
  | { type: "step"; dt?: number }
  | { type: "tick"; dt: number }
  | { type: "reset" };

export const PLAYBACK_STEP_S = 1 / 30;

export function createPlayback(duration: number): PlaybackState {
  return { playing: false, time: 0, speed: 1, duration };
}

const clampTime = (t: number, duration: number): number => Math.min(Math.max(t, 0), duration);

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "play":
      // 播到末尾后再按播放则从头开始
      return state.time >= state.duration
        ? { ...state, playing: true, time: 0 }
        : { ...state, playing: true };
    case "pause":
      return { ...state, playing: false };
    case "toggle":
      return state.playing
        ? { ...state, playing: false }
        : state.time >= state.duration
          ? { ...state, playing: true, time: 0 }
          : { ...state, playing: true };
    case "set-speed":
      return { ...state, speed: action.speed };
    case "seek":
      return { ...state, time: clampTime(action.time, state.duration) };
    case "step":
      return { ...state, playing: false, time: clampTime(state.time + (action.dt ?? PLAYBACK_STEP_S), state.duration) };
    case "tick": {
      if (!state.playing) return state;
      const next = clampTime(state.time + action.dt * state.speed, state.duration);
      return next >= state.duration ? { ...state, time: state.duration, playing: false } : { ...state, time: next };
    }
    case "reset":
      return { ...state, playing: false, time: 0 };
    default:
      return state;
  }
}
