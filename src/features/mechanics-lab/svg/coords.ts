/**
 * 视图变换：场景坐标（世界坐标，x 向右 y 向上，单位 m）→ SVG 屏幕坐标（y 向下，单位 px）。
 * 渲染坐标永不写回物理模型；本模块为纯函数。
 */
import type { Vec2V1 } from "@/features/mechanics-lab/schema";

export interface ViewTransform {
  /** px / m */
  scale: number;
  /** 平移（px） */
  tx: number;
  ty: number;
}

export const DEFAULT_VIEW: ViewTransform = { scale: 60, tx: 320, ty: 260 };
export const MIN_SCALE = 10;
export const MAX_SCALE = 400;

export function worldToScreen(p: Vec2V1, v: ViewTransform): Vec2V1 {
  return { x: p.x * v.scale + v.tx, y: -p.y * v.scale + v.ty };
}

export function screenToWorld(s: Vec2V1, v: ViewTransform): Vec2V1 {
  return { x: (s.x - v.tx) / v.scale, y: -(s.y - v.ty) / v.scale };
}

/** 以屏幕上某点为中心缩放 */
export function zoomAt(v: ViewTransform, center: Vec2V1, factor: number): ViewTransform {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  const realFactor = scale / v.scale;
  return {
    scale,
    tx: center.x - (center.x - v.tx) * realFactor,
    ty: center.y - (center.y - v.ty) * realFactor,
  };
}

/** 按屏幕像素平移 */
export function panBy(v: ViewTransform, dxPx: number, dyPx: number): ViewTransform {
  return { ...v, tx: v.tx + dxPx, ty: v.ty + dyPx };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 自动适应视口：让场景包围盒以 padding 边距充满视口 */
export function fitBounds(
  bounds: Bounds,
  viewportWidth: number,
  viewportHeight: number,
  paddingPx = 64,
): ViewTransform {
  const w = Math.max(bounds.maxX - bounds.minX, 0.5);
  const h = Math.max(bounds.maxY - bounds.minY, 0.5);
  const availW = Math.max(viewportWidth - paddingPx * 2, 50);
  const availH = Math.max(viewportHeight - paddingPx * 2, 50);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(availW / w, availH / h)));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return {
    scale,
    tx: viewportWidth / 2 - cx * scale,
    ty: viewportHeight / 2 + cy * scale,
  };
}

/** 收集场景全部几何点的包围盒 */
export function boundsOfPoints(points: Vec2V1[]): Bounds {
  if (points.length === 0) return { minX: -3, minY: -2, maxX: 3, maxY: 2 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
