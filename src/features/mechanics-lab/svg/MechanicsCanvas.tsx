/**
 * MechanicsCanvas — 原生 SVG 场景编辑器主组件。
 * 职责：渲染、拖拽、缩放平移、选择、连接端点吸附、连接合法性提示。
 * 绝不计算物理答案；渲染坐标永不写回物理模型（写回的都是场景坐标）。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import type {
  ConnectorNodeV1,
  MechanicsSceneV1,
  Vec2V1,
} from "@/features/mechanics-lab/schema";
import {
  DEFAULT_VIEW,
  boundsOfPoints,
  fitBounds,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type ViewTransform,
} from "./coords.js";
import {
  OBJECT_HALF_SIZE_M,
  PULLEY_RADIUS_M,
  connectorPathPoints,
  forceArrowLength,
  pulleyRenderPosition,
  sceneGeometryPoints,
  surfaceLine,
  surfaceNormal,
} from "./geometry.js";
import { GRID_STEP_M, findSnapTarget, snapPoint, type SnapTarget } from "./snap.js";
import type { EditorAction, EditorState, EditorTool } from "./editor-state.js";
import { connectionHint } from "./editor-state.js";

export interface MechanicsCanvasProps {
  state: EditorState;
  dispatch: (action: EditorAction) => void;
  /** 画布无障碍标签 */
  ariaLabel?: string;
  /** 动画位置覆盖（仅渲染用；不写入物理模型） */
  animatedPositions?: ReadonlyMap<string, Vec2V1>;
}

interface DragSession {
  kind: "pan" | "move" | "none";
  startScreen: Vec2V1;
  lastScreen: Vec2V1;
  moved: boolean;
  coalesceKey: string;
}

const TOOL_HINTS: Record<EditorTool, string> = {
  select: "选择：点击实体选中，拖动移动；拖动空白平移；滚轮缩放",
  "add-object": "点击画布放置物体",
  "add-horizontal-surface": "点击画布添加水平面",
  "add-inclined-surface": "点击画布添加 30° 斜面（角度可在属性面板修改）",
  "add-support": "点击一个物体，为其添加固定支点",
  "add-fixed-pulley": "点击画布放置固定滑轮",
  "add-movable-pulley": "点击画布放置动滑轮（挂载物体在属性面板设置）",
  "add-rope": "依次点击物体/锚点/滑轮，双击或回车完成绳连接，Esc 取消",
  "add-rod": "点击两个端点（物体或锚点）完成轻杆，Esc 取消",
  "add-force": "点击一个物体，为其添加外力",
  delete: "点击实体删除（含其引用）",
};

export function MechanicsCanvas({ state, dispatch, ariaLabel, animatedPositions }: MechanicsCanvasProps): React.JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<ViewTransform>(DEFAULT_VIEW);
  const [cursorWorld, setCursorWorld] = useState<Vec2V1 | null>(null);
  const dragRef = useRef<DragSession>({ kind: "none", startScreen: { x: 0, y: 0 }, lastScreen: { x: 0, y: 0 }, moved: false, coalesceKey: "" });
  const { scene: rawScene, selection, tool, pendingNodes, connectingKind } = state;

  // 动画位置覆盖只影响渲染：物理模型保持不变；动滑轮随挂载物体
  const scene = useMemo<MechanicsSceneV1>(() => {
    if (animatedPositions === undefined || animatedPositions.size === 0) return rawScene;
    return {
      ...rawScene,
      objects: rawScene.objects.map((o) => {
        const p = animatedPositions.get(o.id);
        return p !== undefined ? { ...o, position: p } : o;
      }),
      pulleys: rawScene.pulleys.map((p) => {
        if (p.attachedObjectId === undefined) return p;
        const pos = animatedPositions.get(p.attachedObjectId);
        return pos !== undefined ? { ...p, position: pos } : p;
      }),
    };
  }, [rawScene, animatedPositions]);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Vec2V1 => {
      const rect = svgRef.current?.getBoundingClientRect();
      const sx = clientX - (rect?.left ?? 0);
      const sy = clientY - (rect?.top ?? 0);
      return screenToWorld({ x: sx, y: sy }, view);
    },
    [view],
  );
  const toScreen = useCallback(
    (clientX: number, clientY: number): Vec2V1 => {
      const rect = svgRef.current?.getBoundingClientRect();
      return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
    },
    [],
  );

  const snapTargets = useMemo<SnapTarget[]>(
    () => [
      ...scene.objects.map((o) => ({ id: o.id, position: o.position, kind: "object" as const })),
      ...scene.pulleys.map((p) => ({ id: p.id, position: p.position, kind: "pulley" as const })),
    ],
    [scene.objects, scene.pulleys],
  );

  const handleFit = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    const bounds = boundsOfPoints(sceneGeometryPoints(scene));
    setView(fitBounds(bounds, rect?.width ?? 800, rect?.height ?? 600));
  }, [scene]);

  // 场景载入（replace-scene）后自动适应一次
  const lastSceneId = useRef<string>("");
  useEffect(() => {
    const key = `${scene.sceneId}:${scene.title}`;
    if (lastSceneId.current !== key) {
      lastSceneId.current = key;
      handleFit();
    }
  }, [scene, handleFit]);

  // 键盘：删除 / Escape / 撤销 / 重做 / 复制
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        if (connectingKind !== null) dispatch({ type: "cancel-connection" });
        else dispatch({ type: "clear-selection" });
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement | null;
        if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
        dispatch({ type: "delete-selection" });
        return;
      }
      if (e.key === "Enter" && connectingKind !== null) {
        dispatch({ type: "finish-connection" });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        dispatch({ type: "duplicate-selection" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, connectingKind]);

  const onWheel = (e: ReactWheelEvent<SVGSVGElement>): void => {
    e.preventDefault();
    const center = toScreen(e.clientX, e.clientY);
    setView((v) => zoomAt(v, center, e.deltaY < 0 ? 1.12 : 1 / 1.12));
  };

  const entityAt = (worldPt: Vec2V1): string | null => {
    const hit = findSnapTarget(worldPt, snapTargets, Math.max(0.45, 12 / view.scale));
    if (hit !== null) return hit.id;
    // 平面线：点到线段距离
    for (const surf of scene.surfaces) {
      const line = surfaceLine(surf, scene.objects);
      if (distToSegment(worldPt, line.p1, line.p2) < Math.max(0.3, 10 / view.scale)) return surf.id;
    }
    // 连接（绳/杆）折线
    for (const conn of scene.connectors) {
      const pts = connectorPathPoints(conn, scene);
      for (let i = 0; i + 1 < pts.length; i++) {
        if (distToSegment(worldPt, pts[i] as Vec2V1, pts[i + 1] as Vec2V1) < Math.max(0.25, 8 / view.scale)) return conn.id;
      }
    }
    // 外力箭头根部
    for (const f of scene.externalForces) {
      const obj = scene.objects.find((o) => o.id === f.objectId);
      if (obj !== undefined && Math.hypot(obj.position.x - worldPt.x, obj.position.y - worldPt.y) < 0.6) return f.id;
    }
    return null;
  };

  const onEntityKeyDown = (e: React.KeyboardEvent, entityId: string): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      dispatch({ type: "select", ids: [entityId], additive: e.shiftKey });
      return;
    }
    const step = e.shiftKey ? 1 : GRID_STEP_M;
    const deltaMap: Record<string, Vec2V1> = {
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
    };
    const delta = deltaMap[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      const ids = selection.includes(entityId) ? selection : [entityId];
      dispatch({ type: "move-entities", ids, delta });
    }
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>): void => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const sp = toScreen(e.clientX, e.clientY);
    const wp = toWorld(e.clientX, e.clientY);
    dragRef.current = { kind: "none", startScreen: sp, lastScreen: sp, moved: false, coalesceKey: `drag-${Date.now()}` };

    if (tool === "select") {
      const hit = entityAt(wp);
      if (hit !== null) {
        const already = selection.includes(hit);
        if (!already) dispatch({ type: "select", ids: [hit], additive: e.shiftKey });
        dragRef.current.kind = "move";
      } else {
        if (!e.shiftKey) dispatch({ type: "clear-selection" });
        dragRef.current.kind = "pan";
      }
      return;
    }
    if (tool === "delete") {
      const hit = entityAt(wp);
      if (hit !== null) dispatch({ type: "delete-entity", id: hit });
      return;
    }
    if (tool === "add-support" || tool === "add-force") {
      const hit = findSnapTarget(wp, snapTargets.filter((t) => t.kind === "object"), Math.max(0.5, 14 / view.scale));
      if (hit !== null) {
        dispatch({ type: tool === "add-support" ? "add-support-to" : "add-force-to", objectId: hit.id });
      }
      return;
    }
    if (tool === "add-rope" || tool === "add-rod") {
      const hit = findSnapTarget(wp, snapTargets, Math.max(0.5, 14 / view.scale));
      let node: ConnectorNodeV1;
      if (hit !== null) {
        node = hit.kind === "object" ? { type: "object", objectId: hit.id } : { type: "pulley", pulleyId: hit.id };
      } else {
        node = { type: "anchor", point: snapPoint(wp) };
      }
      if (connectingKind !== null) {
        const hint = connectionHint(connectingKind, pendingNodes, node);
        if (hint.valid) dispatch({ type: "add-connection-node", node });
      }
      return;
    }
    const kindMap: Partial<Record<EditorTool, "object" | "horizontal-surface" | "inclined-surface" | "fixed-pulley" | "movable-pulley">> = {
      "add-object": "object",
      "add-horizontal-surface": "horizontal-surface",
      "add-inclined-surface": "inclined-surface",
      "add-fixed-pulley": "fixed-pulley",
      "add-movable-pulley": "movable-pulley",
    };
    const kind = kindMap[tool];
    if (kind !== undefined) {
      dispatch({ type: "add-entity", kind, at: snapPoint(wp) });
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    const sp = toScreen(e.clientX, e.clientY);
    const wp = toWorld(e.clientX, e.clientY);
    setCursorWorld(wp);
    const drag = dragRef.current;
    if (drag.kind === "pan") {
      setView((v) => panBy(v, sp.x - drag.lastScreen.x, sp.y - drag.lastScreen.y));
      drag.lastScreen = sp;
      drag.moved = true;
      return;
    }
    if (drag.kind === "move" && selection.length > 0) {
      const lastWorld = screenToWorld(drag.lastScreen, view);
      const delta = { x: wp.x - lastWorld.x, y: wp.y - lastWorld.y };
      if (Math.abs(delta.x) + Math.abs(delta.y) > 0) {
        dispatch({ type: "move-entities", ids: selection, delta, coalesceKey: drag.coalesceKey });
        drag.moved = true;
      }
      drag.lastScreen = sp;
    }
  };

  const onPointerUp = (): void => {
    dragRef.current.kind = "none";
  };

  const onDoubleClick = (): void => {
    if (connectingKind !== null) dispatch({ type: "finish-connection" });
  };

  const W = (p: Vec2V1): Vec2V1 => worldToScreen(p, view);
  const gridLines = useMemo(() => buildGrid(view, 800, 600), [view]);

  const selected = new Set(selection);
  const connecting = connectingKind !== null;
  const pendingPositions = pendingNodes
    .map((n) => nodePosition(n, scene))
    .filter((p): p is Vec2V1 => p !== null);

  return (
    <div className="mech-canvas-wrap">
      <div className="mech-canvas-toolbar" role="toolbar" aria-label="画布操作">
        <button type="button" onClick={handleFit} title="自动适应视口">适应视口</button>
        <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={state.past.length === 0}>撤销</button>
        <button type="button" onClick={() => dispatch({ type: "redo" })} disabled={state.future.length === 0}>重做</button>
        <button type="button" onClick={() => dispatch({ type: "duplicate-selection" })} disabled={selection.length === 0}>复制</button>
        <button type="button" onClick={() => dispatch({ type: "delete-selection" })} disabled={selection.length === 0}>删除</button>
        {connecting && (
          <button type="button" onClick={() => dispatch({ type: "finish-connection" })}>
            完成连接（{pendingNodes.length} 节点）
          </button>
        )}
        <span className="mech-canvas-hint" aria-live="polite">{TOOL_HINTS[tool]}</span>
      </div>
      <svg
        ref={svgRef}
        className="mech-canvas"
        role="application"
        aria-label={ariaLabel ?? "力学场景编辑画布"}
        tabIndex={0}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <title>力学场景编辑画布：{scene.title}</title>
        <desc>
          场景包含 {scene.objects.length} 个物体、{scene.surfaces.length} 个平面、{scene.pulleys.length} 个滑轮、
          {scene.connectors.length} 个连接、{scene.externalForces.length} 个外力。
        </desc>
        {gridLines}
        {/* 平面 */}
        {scene.surfaces.map((surf) => {
          const line = surfaceLine(surf, scene.objects);
          const p1 = W(line.p1);
          const p2 = W(line.p2);
          return (
            <g key={surf.id} data-entity-id={surf.id} aria-label={`平面 ${surf.id}`}>
              <line
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke={selected.has(surf.id) ? "#d97706" : "#334155"}
                strokeWidth={selected.has(surf.id) ? 4 : 3}
                strokeDasharray={line.anchored ? undefined : "6 4"}
              />
              <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 + 16} fontSize={11} fill="#64748b">
                {surf.kind === "horizontal" ? "水平面" : `斜面 ${surf.angleDeg}°`}
                {surf.friction.model === "rough" ? "（粗糙）" : "（光滑）"}
              </text>
            </g>
          );
        })}
        {/* 支点 */}
        {scene.supports.map((sup) => {
          const obj = scene.objects.find((o) => o.id === sup.objectId);
          if (obj === undefined) return null;
          const c = W(obj.position);
          const size = OBJECT_HALF_SIZE_M * view.scale;
          return (
            <g key={sup.id} data-entity-id={sup.id} aria-label={`支点 ${sup.id}`}>
              <polygon
                points={`${c.x - size * 0.8},${c.y + size * 1.6} ${c.x + size * 0.8},${c.y + size * 1.6} ${c.x},${c.y + size * 0.7}`}
                fill={selected.has(sup.id) ? "#d97706" : "#475569"}
              />
            </g>
          );
        })}
        {/* 连接（绳/杆） */}
        {scene.connectors.map((conn) => {
          const pts = connectorPathPoints(conn, scene).map(W);
          const points = pts.map((p) => `${p.x},${p.y}`).join(" ");
          const isRod = conn.kind === "rod";
          return (
            <g key={conn.id} data-entity-id={conn.id} aria-label={`${isRod ? "轻杆" : "绳"} ${conn.id}`}>
              <polyline
                points={points}
                fill="none"
                stroke={selected.has(conn.id) ? "#d97706" : isRod ? "#7c3aed" : "#0369a1"}
                strokeWidth={isRod ? 6 : 2.5}
                strokeLinecap="round"
              />
              {conn.nodes.map((n, i) =>
                n.type === "anchor" ? (
                  <circle key={i} cx={W(n.point).x} cy={W(n.point).y} r={4} fill="#0f172a" />
                ) : null,
              )}
            </g>
          );
        })}
        {/* 滑轮（键盘可达：Enter 选中，方向键移动；动滑轮随挂载物体渲染在下方） */}
        {scene.pulleys.map((pul) => {
          const c = W(pulleyRenderPosition(pul));
          const r = PULLEY_RADIUS_M * view.scale;
          return (
            <g key={pul.id} data-entity-id={pul.id} aria-label={`滑轮 ${pul.id}`}>
              <circle
                cx={c.x} cy={c.y} r={r}
                fill={pul.kind === "movable" ? "#fef3c7" : "#e2e8f0"}
                stroke={selected.has(pul.id) ? "#d97706" : "#0f172a"}
                strokeWidth={selected.has(pul.id) ? 3 : 2}
                tabIndex={0}
                role="button"
                aria-label={`${pul.kind === "movable" ? "动滑轮" : "定滑轮"} ${pul.id}，Enter 选中，方向键移动`}
                style={{ outline: "none" }}
                onKeyDown={(e) => onEntityKeyDown(e, pul.id)}
              />
              <circle cx={c.x} cy={c.y} r={3} fill="#0f172a" />
              <text x={c.x} y={pul.kind === "movable" ? c.y + r + 14 : c.y - r - 6} fontSize={11} textAnchor="middle" fill="#64748b">
                {pul.kind === "movable" ? "动滑轮" : "定滑轮"}
              </text>
            </g>
          );
        })}
        {/* 物体（键盘可达：Enter 选中，方向键按网格移动） */}
        {scene.objects.map((obj) => {
          const c = W(obj.position);
          const half = OBJECT_HALF_SIZE_M * view.scale;
          const surf = scene.surfaces.find((s) => s.id === obj.surfaceId);
          const angle = surf !== undefined ? surf.angleDeg : 0;
          return (
            <g
              key={obj.id}
              data-entity-id={obj.id}
              aria-label={`物体 ${obj.id}，质量 ${obj.mass} kg`}
              transform={`rotate(${-angle} ${c.x} ${c.y})`}
            >
              <rect
                x={c.x - half} y={c.y - half} width={half * 2} height={half * 2}
                fill={selected.has(obj.id) ? "#fde68a" : "#dbeafe"}
                stroke={selected.has(obj.id) ? "#d97706" : "#1d4ed8"}
                strokeWidth={selected.has(obj.id) ? 3 : 2}
                rx={3}
                tabIndex={0}
                role="button"
                aria-label={`物体 ${obj.id}，质量 ${obj.mass} kg，Enter 选中，方向键移动，Delete 删除`}
                style={{ outline: "none" }}
                onKeyDown={(e) => onEntityKeyDown(e, obj.id)}
              />
              <text x={c.x} y={c.y + 4} fontSize={12} textAnchor="middle" fill="#0f172a">
                {obj.mass}kg
              </text>
            </g>
          );
        })}
        {/* 外力箭头 */}
        {scene.externalForces.map((f) => {
          const obj = scene.objects.find((o) => o.id === f.objectId);
          if (obj === undefined) return null;
          const rad = (f.angleDeg * Math.PI) / 180;
          const dir = { x: Math.cos(rad), y: Math.sin(rad) };
          const len = forceArrowLength(f.magnitude);
          const start = { x: obj.position.x + dir.x * OBJECT_HALF_SIZE_M, y: obj.position.y + dir.y * OBJECT_HALF_SIZE_M };
          const end = { x: start.x + dir.x * len, y: start.y + dir.y * len };
          const p1 = W(start);
          const p2 = W(end);
          return (
            <g key={f.id} data-entity-id={f.id} aria-label={`外力 ${f.id}，${f.magnitude} N，方向 ${f.angleDeg}°`}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={selected.has(f.id) ? "#d97706" : "#dc2626"} strokeWidth={2.5} markerEnd="url(#mech-arrowhead)" />
              <text x={p2.x + 6} y={p2.y - 6} fontSize={11} fill="#dc2626">
                {f.label ?? `F=${f.magnitude}N`}
              </text>
            </g>
          );
        })}
        {/* 连接预览线 */}
        {connecting && pendingPositions.length > 0 && cursorWorld !== null && (
          <polyline
            points={[...pendingPositions, cursorWorld].map((p) => `${W(p).x},${W(p).y}`).join(" ")}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        )}
        <defs>
          <marker id="mech-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <polygon points="0 0, 8 4, 0 8" fill="#dc2626" />
          </marker>
        </defs>
      </svg>
      <div className="mech-canvas-status" aria-live="polite">
        已选：{selection.length > 0 ? selection.join("、") : "无"}
        {cursorWorld !== null && ` 坐标：(${cursorWorld.x.toFixed(2)}, ${cursorWorld.y.toFixed(2)}) m`}
      </div>
    </div>
  );
}

function nodePosition(node: ConnectorNodeV1, scene: MechanicsSceneV1): Vec2V1 | null {
  if (node.type === "object") return scene.objects.find((o) => o.id === node.objectId)?.position ?? null;
  if (node.type === "pulley") return scene.pulleys.find((p) => p.id === node.pulleyId)?.position ?? null;
  if (node.type === "anchor") return node.point;
  return null;
}

function distToSegment(p: Vec2V1, a: Vec2V1, b: Vec2V1): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function buildGrid(view: ViewTransform, width: number, height: number): React.JSX.Element {
  const lines: React.JSX.Element[] = [];
  const stepPx = GRID_STEP_M * view.scale;
  if (stepPx >= 8) {
    const startX = ((view.tx % stepPx) + stepPx) % stepPx;
    const startY = ((view.ty % stepPx) + stepPx) % stepPx;
    for (let x = startX; x < width; x += stepPx) {
      lines.push(<line key={`v${x.toFixed(1)}`} x1={x} y1={0} x2={x} y2={height} stroke="#f1f5f9" strokeWidth={1} />);
    }
    for (let y = startY; y < height; y += stepPx) {
      lines.push(<line key={`h${y.toFixed(1)}`} x1={0} y1={y} x2={width} y2={y} stroke="#f1f5f9" strokeWidth={1} />);
    }
  }
  return <g aria-hidden="true">{lines}</g>;
}

export { surfaceNormal };
