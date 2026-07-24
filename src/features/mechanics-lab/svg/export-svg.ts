/**
 * 场景 SVG 导出（纯字符串构建，可单测）。
 * 保留：力箭头、文字、公式标签、坐标轴、场景标题、必要元数据。
 */
import type {
  MechanicsSceneV1,
  MechanicsSolutionV1,
  Vec2V1,
} from "@/features/mechanics-lab/schema";
import {
  OBJECT_HALF_SIZE_M,
  PULLEY_RADIUS_M,
  connectorPathPoints,
  forceArrowLength,
  pulleyRenderPosition,
  sceneGeometryPoints,
  surfaceLine,
} from "./geometry.js";
import { boundsOfPoints, fitBounds, worldToScreen, type ViewTransform } from "./coords.js";

export interface ExportSvgOptions {
  solution?: MechanicsSolutionV1 | null;
  width?: number;
  height?: number;
  /** 元数据时间戳（测试时注入固定值） */
  exportedAt?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const num = (v: number): string => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(2);

function arrowHead(id: string, color: string): string {
  return `<marker id="${id}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><polygon points="0 0, 8 4, 0 8" fill="${color}" /></marker>`;
}

function arrowLine(p1: Vec2V1, p2: Vec2V1, color: string, markerId: string, width = 2.5, dash?: string): string {
  return `<line x1="${num(p1.x)}" y1="${num(p1.y)}" x2="${num(p2.x)}" y2="${num(p2.y)}" stroke="${color}" stroke-width="${width}"${dash !== undefined ? ` stroke-dasharray="${dash}"` : ""} marker-end="url(#${markerId})" />`;
}

/** 构建可独立打开的完整 SVG 文档 */
export function buildSceneSvg(scene: MechanicsSceneV1, options: ExportSvgOptions = {}): string {
  const width = options.width ?? 960;
  const height = options.height ?? 640;
  const view: ViewTransform = fitBounds(boundsOfPoints(sceneGeometryPoints(scene)), width, height - 60, 60);
  const W = (p: Vec2V1): Vec2V1 => worldToScreen(p, view);
  const parts: string[] = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(scene.title)}">`);
  parts.push(`<title>${esc(scene.title)}</title>`);
  parts.push(
    `<metadata>{"generator":"exambridge-mechanics-lab","schemaVersion":"${scene.schemaVersion}","sceneId":"${esc(scene.sceneId)}","analysisMode":"${scene.analysisMode}","gravity":${scene.gravity},"exportedAt":"${options.exportedAt ?? ""}"}</metadata>`,
  );
  parts.push(`<desc>ExamBridge Mechanics Lab V1 场景导出：${scene.objects.length} 个物体，${scene.surfaces.length} 个平面，${scene.pulleys.length} 个滑轮，${scene.connectors.length} 个连接，${scene.externalForces.length} 个外力。</desc>`);
  parts.push(`<defs>${arrowHead("ex-arrow", "#dc2626")}${arrowHead("ex-axis", "#94a3b8")}</defs>`);
  parts.push(`<rect width="${width}" height="${height}" fill="#ffffff" />`);

  // 标题文字
  parts.push(`<text x="24" y="32" font-size="20" font-family="sans-serif" fill="#0f172a">${esc(scene.title)}</text>`);
  parts.push(`<text x="24" y="52" font-size="12" font-family="sans-serif" fill="#64748b">ExamBridge Mechanics Lab V1 · schemaVersion ${scene.schemaVersion} · g=${scene.gravity} m/s² · ${scene.analysisMode}</text>`);

  // 坐标轴（左下角，y 向上）
  const ax0 = { x: 60, y: height - 60 };
  parts.push(arrowLine(ax0, { x: ax0.x + 60, y: ax0.y }, "#94a3b8", "ex-axis", 1.5));
  parts.push(arrowLine(ax0, { x: ax0.x, y: ax0.y - 60 }, "#94a3b8", "ex-axis", 1.5));
  parts.push(`<text x="${ax0.x + 64}" y="${ax0.y + 4}" font-size="12" fill="#94a3b8">x</text>`);
  parts.push(`<text x="${ax0.x - 4}" y="${ax0.y - 64}" font-size="12" fill="#94a3b8">y</text>`);

  // 平面
  for (const surf of scene.surfaces) {
    const line = surfaceLine(surf, scene.objects);
    const p1 = W(line.p1);
    const p2 = W(line.p2);
    parts.push(
      `<line x1="${num(p1.x)}" y1="${num(p1.y)}" x2="${num(p2.x)}" y2="${num(p2.y)}" stroke="#334155" stroke-width="3"${line.anchored ? "" : ' stroke-dasharray="6 4"'} />`,
    );
    parts.push(
      `<text x="${num((p1.x + p2.x) / 2)}" y="${num((p1.y + p2.y) / 2 + 16)}" font-size="11" fill="#64748b" text-anchor="middle">${surf.kind === "horizontal" ? "水平面" : `斜面 ${surf.angleDeg}°`}${surf.friction.model === "rough" ? "（粗糙）" : "（光滑）"}</text>`,
    );
  }

  // 支点
  for (const sup of scene.supports) {
    const obj = scene.objects.find((o) => o.id === sup.objectId);
    if (obj === undefined) continue;
    const c = W(obj.position);
    const s = OBJECT_HALF_SIZE_M * view.scale;
    parts.push(
      `<polygon points="${num(c.x - s * 0.8)},${num(c.y + s * 1.6)} ${num(c.x + s * 0.8)},${num(c.y + s * 1.6)} ${num(c.x)},${num(c.y + s * 0.7)}" fill="#475569"><title>支点 ${esc(sup.id)}</title></polygon>`,
    );
  }

  // 连接（绳/杆）
  for (const conn of scene.connectors) {
    const pts = connectorPathPoints(conn, scene).map(W);
    const points = pts.map((p) => `${num(p.x)},${num(p.y)}`).join(" ");
    const isRod = conn.kind === "rod";
    parts.push(
      `<polyline points="${points}" fill="none" stroke="${isRod ? "#7c3aed" : "#0369a1"}" stroke-width="${isRod ? 6 : 2.5}" stroke-linecap="round"><title>${isRod ? "轻杆" : "绳"} ${esc(conn.id)}</title></polyline>`,
    );
    for (const n of conn.nodes) {
      if (n.type === "anchor") {
        const c = W(n.point);
        parts.push(`<circle cx="${num(c.x)}" cy="${num(c.y)}" r="4" fill="#0f172a"><title>锚点</title></circle>`);
      }
    }
  }

  // 滑轮（动滑轮随挂载物体渲染在下方）
  for (const pul of scene.pulleys) {
    const c = W(pulleyRenderPosition(pul));
    const r = PULLEY_RADIUS_M * view.scale;
    parts.push(
      `<circle cx="${num(c.x)}" cy="${num(c.y)}" r="${num(r)}" fill="${pul.kind === "movable" ? "#fef3c7" : "#e2e8f0"}" stroke="#0f172a" stroke-width="2"><title>${pul.kind === "movable" ? "动滑轮" : "定滑轮"} ${esc(pul.id)}</title></circle>`,
    );
    parts.push(`<circle cx="${num(c.x)}" cy="${num(c.y)}" r="3" fill="#0f172a" />`);
  }

  // 物体
  for (const obj of scene.objects) {
    const c = W(obj.position);
    const half = OBJECT_HALF_SIZE_M * view.scale;
    const surf = scene.surfaces.find((s) => s.id === obj.surfaceId);
    const angle = surf !== undefined ? surf.angleDeg : 0;
    parts.push(
      `<g transform="rotate(${-angle} ${num(c.x)} ${num(c.y)})"><rect x="${num(c.x - half)}" y="${num(c.y - half)}" width="${num(half * 2)}" height="${num(half * 2)}" fill="#dbeafe" stroke="#1d4ed8" stroke-width="2" rx="3"><title>${esc(obj.label)}，质量 ${obj.mass} kg</title></rect><text x="${num(c.x)}" y="${num(c.y + 4)}" font-size="12" text-anchor="middle" fill="#0f172a">${obj.mass}kg</text></g>`,
    );
  }

  // 外力箭头（公式标签）
  for (const f of scene.externalForces) {
    const obj = scene.objects.find((o) => o.id === f.objectId);
    if (obj === undefined) continue;
    const rad = (f.angleDeg * Math.PI) / 180;
    const dir = { x: Math.cos(rad), y: Math.sin(rad) };
    const len = forceArrowLength(f.magnitude);
    const start = { x: obj.position.x + dir.x * OBJECT_HALF_SIZE_M, y: obj.position.y + dir.y * OBJECT_HALF_SIZE_M };
    const end = { x: start.x + dir.x * len, y: start.y + dir.y * len };
    const p1 = W(start);
    const p2 = W(end);
    parts.push(arrowLine(p1, p2, "#dc2626", "ex-arrow"));
    parts.push(
      `<text x="${num(p2.x + 6)}" y="${num(p2.y - 6)}" font-size="12" fill="#dc2626">${esc(f.label ?? `F=${f.magnitude}N ∠${f.angleDeg}°`)}</text>`,
    );
  }

  // 求解结果力箭头（可选）：每个物体的已解出力，用符号=数值标注
  if (options.solution != null) {
    const sol = options.solution;
    for (const force of sol.forces) {
      if (force.kind === "applied" || force.magnitude === null) continue;
      const obj = scene.objects.find((o) => o.id === force.objectId);
      if (obj === undefined) continue;
      const len = forceArrowLength(Math.abs(force.magnitude));
      const start = obj.position;
      const end = {
        x: start.x + force.direction.x * len * Math.sign(force.magnitude >= 0 ? 1 : -1),
        y: start.y + force.direction.y * len * Math.sign(force.magnitude >= 0 ? 1 : -1),
      };
      const p1 = W(start);
      const p2 = W(end);
      parts.push(arrowLine(p1, p2, "#0f766e", "ex-arrow", 2, "5 3"));
      parts.push(
        `<text x="${num(p2.x + 5)}" y="${num(p2.y - 4)}" font-size="10" fill="#0f766e">${esc(`${force.symbol}=${force.magnitude.toFixed(2)}N`)}</text>`,
      );
    }
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}
