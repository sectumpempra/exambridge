/** 网格吸附与连接端点吸附（纯函数） */
import type { Vec2V1 } from "@/features/mechanics-lab/schema";

export const GRID_STEP_M = 0.25;
export const SNAP_DISTANCE_M = 0.4;

export function snapValue(v: number, step = GRID_STEP_M): number {
  return Math.round(v / step) * step;
}

export function snapPoint(p: Vec2V1, step = GRID_STEP_M): Vec2V1 {
  return { x: snapValue(p.x, step), y: snapValue(p.y, step) };
}

export interface SnapTarget {
  id: string;
  position: Vec2V1;
  kind: "object" | "pulley" | "anchor";
}

/** 在候选端点中找最近吸附目标；距离超过阈值返回 null */
export function findSnapTarget(
  point: Vec2V1,
  targets: SnapTarget[],
  maxDistance = SNAP_DISTANCE_M,
): SnapTarget | null {
  let best: SnapTarget | null = null;
  let bestDist = maxDistance;
  for (const t of targets) {
    const d = Math.hypot(t.position.x - point.x, t.position.y - point.y);
    if (d <= bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}
