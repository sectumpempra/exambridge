/** 二维向量工具（世界坐标：x 向右，y 向上；内部角度统一弧度） */
export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => vec(a.x + b.x, a.y + b.y);
export const sub = (a: Vec2, b: Vec2): Vec2 => vec(a.x - b.x, a.y - b.y);
export const scale = (a: Vec2, s: number): Vec2 => vec(a.x * s, a.y * s);
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const norm = (a: Vec2): number => Math.hypot(a.x, a.y);

export function unit(a: Vec2): Vec2 {
  const n = norm(a);
  if (n === 0) return vec(0, 0);
  return vec(a.x / n, a.y / n);
}

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

export const fromAngleDeg = (deg: number): Vec2 => {
  const r = degToRad(deg);
  return vec(Math.cos(r), Math.sin(r));
};
