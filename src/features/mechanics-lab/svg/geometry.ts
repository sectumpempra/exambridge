/**
 * 渲染几何推导：从场景模型推导 SVG 绘制所需的几何量（纯函数）。
 * 平面在协议中无位置字段，由置于其上的物体隐式定位（V1 编辑器约定，见 PROGRESS.md）。
 */
import type {
  MechanicsConnectorV1,
  MechanicsSceneV1,
  MechanicsSurfaceV1,
  MechanicsObjectV1,
  Vec2V1,
} from "@/features/mechanics-lab/schema";

export const OBJECT_HALF_SIZE_M = 0.3;
export const PULLEY_RADIUS_M = 0.25;

const degToRad = (d: number): number => (d * Math.PI) / 180;

export function surfaceDirection(surface: MechanicsSurfaceV1): Vec2V1 {
  const r = degToRad(surface.angleDeg);
  return { x: Math.cos(r), y: Math.sin(r) };
}

export function surfaceNormal(surface: MechanicsSurfaceV1): Vec2V1 {
  const r = degToRad(surface.angleDeg);
  return { x: -Math.sin(r), y: Math.cos(r) };
}

/** 物体与平面的接触点（物体底面中点） */
export function objectContactPoint(obj: MechanicsObjectV1, surface: MechanicsSurfaceV1): Vec2V1 {
  const n = surfaceNormal(surface);
  return {
    x: obj.position.x - n.x * OBJECT_HALF_SIZE_M,
    y: obj.position.y - n.y * OBJECT_HALF_SIZE_M,
  };
}

export interface SurfaceLine {
  p1: Vec2V1;
  p2: Vec2V1;
  /** 是否有物体定位（无物体时为示意虚线） */
  anchored: boolean;
}

/** 平面渲染线段：沿其上物体接触点的投影范围，两端各延长 margin */
export function surfaceLine(
  surface: MechanicsSurfaceV1,
  objects: MechanicsObjectV1[],
  margin = 1.5,
): SurfaceLine {
  const d = surfaceDirection(surface);
  const contacts = objects
    .filter((o) => o.surfaceId === surface.id)
    .map((o) => objectContactPoint(o, surface));
  if (contacts.length === 0) {
    return {
      p1: { x: -4, y: 0 },
      p2: { x: 4 * d.x, y: 4 * d.y },
      anchored: false,
    };
  }
  let minT = Infinity;
  let maxT = -Infinity;
  for (const c of contacts) {
    const t = c.x * d.x + c.y * d.y;
    minT = Math.min(minT, t);
    maxT = Math.max(maxT, t);
  }
  const anchor = contacts[0] as Vec2V1;
  //  anchor 在方向上的投影点作为基准
  const baseT = anchor.x * d.x + anchor.y * d.y;
  const base = { x: d.x * baseT, y: d.y * baseT };
  const perpOffset = { x: anchor.x - base.x, y: anchor.y - base.y };
  return {
    p1: { x: d.x * (minT - margin) + perpOffset.x, y: d.y * (minT - margin) + perpOffset.y },
    p2: { x: d.x * (maxT + margin) + perpOffset.x, y: d.y * (maxT + margin) + perpOffset.y },
    anchored: true,
  };
}

/** 动滑轮渲染位置：随挂载物体时向下偏移到物体底缘下方（纯视觉，不影响物理模型） */
export function pulleyRenderPosition(pulley: { kind: string; attachedObjectId?: string; position: Vec2V1 }): Vec2V1 {
  if (pulley.kind === "movable" && pulley.attachedObjectId !== undefined) {
    return { x: pulley.position.x, y: pulley.position.y - (OBJECT_HALF_SIZE_M + PULLEY_RADIUS_M + 0.05) };
  }
  return pulley.position;
}

/** 连接节点的世界坐标（物体/滑轮/锚点）；渲染用途时动滑轮取偏移位置 */
export function connectorNodePosition(
  node: MechanicsConnectorV1["nodes"][number],
  scene: MechanicsSceneV1,
): Vec2V1 | null {
  if (node.type === "object") {
    return scene.objects.find((o) => o.id === node.objectId)?.position ?? null;
  }
  if (node.type === "pulley") {
    const pulley = scene.pulleys.find((p) => p.id === node.pulleyId);
    return pulley !== undefined ? pulleyRenderPosition(pulley) : null;
  }
  if (node.type === "anchor") return node.point;
  return null;
}

/** 绳/杆的折线点序列 */
export function connectorPathPoints(connector: MechanicsConnectorV1, scene: MechanicsSceneV1): Vec2V1[] {
  return connector.nodes
    .map((n) => connectorNodePosition(n, scene))
    .filter((p): p is Vec2V1 => p !== null);
}

/** 场景全部几何点（自动适应视口用） */
export function sceneGeometryPoints(scene: MechanicsSceneV1): Vec2V1[] {
  const points: Vec2V1[] = [
    ...scene.objects.map((o) => o.position),
    ...scene.pulleys.map((p) => p.position),
  ];
  for (const c of scene.connectors) {
    points.push(...connectorPathPoints(c, scene));
  }
  for (const surf of scene.surfaces) {
    const line = surfaceLine(surf, scene.objects);
    points.push(line.p1, line.p2);
  }
  return points;
}

/** 力箭头长度（世界坐标 m）：随大小缩放并截断 */
export function forceArrowLength(magnitude: number): number {
  return Math.min(2, Math.max(0.6, magnitude / 12));
}
