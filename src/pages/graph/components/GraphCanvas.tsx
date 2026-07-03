import { useRef, useEffect, useCallback, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, ListCollapse, List } from 'lucide-react';
import type { FunctionEntry, ViewState, TooltipData, AxisMode, Point } from '../types';
import {
  drawGrid,
  drawFunction,
  drawFunctionLabels,
  findNearestPoint,
  drawHoverIndicator,
  canvasToMath,
} from '../lib/graphRenderer';

interface GraphCanvasProps {
  functions: FunctionEntry[];
  intersections?: Point[];
  onClearIntersections?: () => void;
}

const AXIS_MODE_CYCLE: AxisMode[] = ['number', 'pi', 'degree'];

export default function GraphCanvas({ functions, intersections = [], onClearIntersections }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ViewState>({ scale: 1, offsetX: 0, offsetY: 0, axisMode: 'number' });
  const sizeRef = useRef({ width: 0, height: 0 });
  const dprRef = useRef(1);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ left: 0, top: 0 });
  const [axisMode, setAxisMode] = useState<AxisMode>('number');
  const [showLegend, setShowLegend] = useState(true);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const needsRenderRef = useRef(true);
  const animIdRef = useRef<number | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const mouseRafRef = useRef<number | null>(null);
  const pendingMouse = useRef<{ x: number; y: number } | null>(null);

  // Auto-detect axis mode based on functions
  useEffect(() => {
    const visibleFuncs = functions.filter(f => f.visible && f.expression);
    if (visibleFuncs.length === 0) return;

    const exprs = visibleFuncs.map(f => f.expression.toLowerCase());
    const hasTrig = exprs.some(e => /sin|cos|tan/.test(e));
    const hasInverseTrig = exprs.some(e => /asin|acos|atan/.test(e));
    const domainRange = visibleFuncs.some(f => {
      const min = parseFloat(f.domainMin);
      const max = parseFloat(f.domainMax);
      return !isNaN(min) && !isNaN(max) && min >= -2 * Math.PI && max <= 2 * Math.PI;
    });

    let suggestedMode: AxisMode = 'number';
    if (hasInverseTrig) {
      suggestedMode = 'degree';
    } else if (hasTrig && domainRange) {
      suggestedMode = 'pi';
    }

    if (suggestedMode !== viewRef.current.axisMode) {
      viewRef.current.axisMode = suggestedMode;
      setAxisMode(suggestedMode);
      needsRenderRef.current = true;
      requestRenderRef.current();
    }
  }, [functions]);

  const zoom = useCallback((factor: number) => {
    const { width, height } = sizeRef.current;
    const view = viewRef.current;
    const centerX = width / 2;
    const centerY = height / 2;
    const [beforeX, beforeY] = canvasToMath(centerX, centerY, width, height, view);
    view.scale = Math.max(0.02, Math.min(100, view.scale * factor));
    const [afterX, afterY] = canvasToMath(centerX, centerY, width, height, view);
    view.offsetX += (afterX - beforeX) * 40 * view.scale;
    view.offsetY -= (afterY - beforeY) * 40 * view.scale;
    needsRenderRef.current = true;
    requestRenderRef.current();
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = { scale: 1, offsetX: 0, offsetY: 0, axisMode: viewRef.current.axisMode };
    needsRenderRef.current = true;
    requestRenderRef.current();
  }, []);

  const cycleAxisMode = useCallback(() => {
    setAxisMode((prev) => {
      const idx = AXIS_MODE_CYCLE.indexOf(prev);
      const next = AXIS_MODE_CYCLE[(idx + 1) % AXIS_MODE_CYCLE.length];
      viewRef.current.axisMode = next;
      needsRenderRef.current = true;
      requestRenderRef.current();
      return next;
    });
  }, []);

  // Draw intersections on canvas
  const drawIntersections = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, view: ViewState) => {
    if (intersections.length === 0) return;

    const { scale, offsetX, offsetY } = view;
    const step = 40 * scale;
    const originX = width / 2 + offsetX;
    const originY = height / 2 + offsetY;

    for (const pt of intersections) {
      const cx = originX + pt.x * step;
      const cy = originY - pt.y * step;

      // Only draw if within visible area
      if (cx < -20 || cx > width + 20 || cy < -20 || cy > height + 20) continue;

      // Draw crosshair marker
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 2;
      const s = 6;
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.stroke();

      // Draw circle around
      ctx.strokeStyle = 'rgba(225, 29, 72, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();

      // Draw coordinate label
      ctx.fillStyle = '#e11d48';
      ctx.font = 'bold 10px "Courier New", monospace';
      ctx.textAlign = 'left';
      const label = `(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`;
      ctx.fillText(label, cx + 12, cy - 8);
    }
  }, [intersections]);

  const render = useCallback(() => {
    needsRenderRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;

    const view = viewRef.current;
    drawGrid(ctx, width, height, view);

    for (const entry of functions) {
      drawFunction(ctx, entry, width, height, view);
    }

    drawFunctionLabels(ctx, functions, width, height, view);
    drawIntersections(ctx, width, height, view);

    if (tooltip) {
      drawHoverIndicator(ctx, tooltip, width, height, view);
    }
  }, [functions, tooltip, drawIntersections]);

  // Render loop
  useEffect(() => {
    const loop = () => {
      animIdRef.current = null;
      if (needsRenderRef.current) render();
    };

    const requestRender = () => {
      if (animIdRef.current === null) {
        animIdRef.current = requestAnimationFrame(loop);
      }
    };

    requestRenderRef.current = requestRender;
    needsRenderRef.current = true;
    render();

    return () => {
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, [render]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      const { width: oldW, height: oldH } = sizeRef.current;
      if (w !== oldW || h !== oldH) {
        sizeRef.current = { width: w, height: h };
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      needsRenderRef.current = true;
      requestRenderRef.current();
      render();
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoom(1.25);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoom(0.8);
      } else if (e.key === '0') {
        e.preventDefault();
        resetView();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setShowLegend(prev => !prev);
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    container.tabIndex = 0;
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [zoom, resetView]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { width, height } = sizeRef.current;

      if (isDragging.current) {
        const dx = x - lastMouse.current.x;
        const dy = y - lastMouse.current.y;
        viewRef.current.offsetX += dx;
        viewRef.current.offsetY += dy;
        lastMouse.current = { x, y };
        needsRenderRef.current = true;
        requestRenderRef.current();
        return;
      }

      pendingMouse.current = { x, y };
      if (mouseRafRef.current === null) {
        mouseRafRef.current = requestAnimationFrame(() => {
          mouseRafRef.current = null;
          const m = pendingMouse.current;
          if (!m) return;
          pendingMouse.current = null;
          const found = findNearestPoint(m.x, m.y, functions, width, height, viewRef.current);
          if (found) {
            setTooltip(found);
            setTooltipPos({
              left: Math.min(found.canvasX + 16, width - 160),
              top: Math.max(found.canvasY - 50, 8),
            });
            needsRenderRef.current = true;
            requestRenderRef.current();
          } else {
            if (tooltip) {
              setTooltip(null);
              needsRenderRef.current = true;
              requestRenderRef.current();
            }
          }
        });
      }
    },
    [functions, tooltip]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    isDragging.current = true;
    lastMouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    canvas.style.cursor = 'grabbing';
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = 'crosshair';
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { width, height } = sizeRef.current;
      const view = viewRef.current;
      const [beforeX, beforeY] = canvasToMath(mouseX, mouseY, width, height, view);
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      view.scale = Math.max(0.02, Math.min(100, view.scale * delta));
      const [afterX, afterY] = canvasToMath(mouseX, mouseY, width, height, view);
      view.offsetX += (afterX - beforeX) * 40 * view.scale;
      view.offsetY -= (afterY - beforeY) * 40 * view.scale;
      needsRenderRef.current = true;
      requestRenderRef.current();
    },
    []
  );

  const handleDoubleClick = useCallback(() => {
    resetView();
  }, [resetView]);

  // Legend functions
  const legendFuncs = functions.filter(f => f.visible && f.expression);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      tabIndex={0}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      />

      {/* Zoom controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 bg-white border border-[#e5e5e5] shadow-sm z-20">
        <button onClick={() => zoom(1.25)} className="p-2 hover:bg-[#f5f5f5] transition-colors" title="放大 (+)">
          <ZoomIn className="w-4 h-4 text-[#333]" />
        </button>
        <button onClick={() => zoom(0.8)} className="p-2 hover:bg-[#f5f5f5] transition-colors border-t border-[#e5e5e5]" title="缩小 (-)">
          <ZoomOut className="w-4 h-4 text-[#333]" />
        </button>
        <button onClick={resetView} className="p-2 hover:bg-[#f5f5f5] transition-colors border-t border-[#e5e5e5]" title="重置视图 (0)">
          <Maximize className="w-4 h-4 text-[#333]" />
        </button>
        <button
          onClick={cycleAxisMode}
          className={`p-2 transition-colors border-t border-[#e5e5e5] text-xs font-bold mono-num ${
            axisMode !== 'number' ? 'bg-black text-white' : 'hover:bg-[#f5f5f5] text-[#333]'
          }`}
          title="切换横坐标刻度 (x / π / °)"
        >
          {axisMode === 'pi' ? 'π' : axisMode === 'degree' ? '°' : 'x'}
        </button>
        <button
          onClick={() => setShowLegend(!showLegend)}
          className={`p-2 transition-colors border-t border-[#e5e5e5] ${
            showLegend ? 'bg-black text-white' : 'hover:bg-[#f5f5f5] text-[#333]'
          }`}
          title="切换图例 (L)"
        >
          {showLegend ? <ListCollapse className="w-4 h-4" /> : <List className="w-4 h-4" />}
        </button>
      </div>

      {/* Function Legend */}
      {showLegend && legendFuncs.length > 0 && (
        <div className="absolute top-4 right-4 z-20 rounded-lg border border-[#e5e5e5] bg-white/95 p-3 shadow-sm max-w-[200px]">
          <h4 className="mb-2 text-xs font-semibold text-[#333] uppercase tracking-wider">函数图例</h4>
          <div className="space-y-1.5">
            {legendFuncs.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
                <span className="mono-num text-[#555] truncate" title={f.expression}>
                  {f.mode === 'polar' ? 'r = ' : 'y = '}{f.expression}
                </span>
              </div>
            ))}
          </div>
          {intersections.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[#e5e5e5]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#e11d48] font-medium">
                  {intersections.length} 个交点
                </span>
                <button
                  onClick={onClearIntersections}
                  className="text-[10px] text-[#999] hover:text-[#333] transition-colors"
                >
                  清除
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-3 left-4 z-10 pointer-events-none">
        <span className="text-[10px] text-[#bbb] mono-num">
          +/- 缩放 &nbsp;|&nbsp; 0 重置 &nbsp;|&nbsp; L 图例 &nbsp;|&nbsp; 拖拽平移
        </span>
      </div>

      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 px-3 py-2 bg-white border border-black tooltip-fade"
          style={{ left: tooltipPos.left, top: tooltipPos.top }}
        >
          {tooltip.mode === 'polar' ? (
            <>
              <div className="mono-num text-xs text-black">
                <span className="text-[#6c6c6c]">r:</span>{' '}
                {tooltip.y.toFixed(2)}
              </div>
              <div className="mono-num text-xs text-black mt-0.5">
                <span className="text-[#6c6c6c]">θ:</span>{' '}
                {axisMode === 'degree'
                  ? `${(tooltip.x * 180 / Math.PI).toFixed(1)}°`
                  : axisMode === 'pi'
                  ? `${(tooltip.x / Math.PI).toFixed(2)}π`
                  : tooltip.x.toFixed(2)}
              </div>
            </>
          ) : (
            <>
              <div className="mono-num text-xs text-black">
                <span className="text-[#6c6c6c]">x:</span>{' '}
                {axisMode === 'degree'
                  ? `${(tooltip.x * 180 / Math.PI).toFixed(1)}°`
                  : axisMode === 'pi'
                  ? `${(tooltip.x / Math.PI).toFixed(2)}π`
                  : tooltip.x.toFixed(2)}
              </div>
              <div className="mono-num text-xs text-black mt-0.5">
                <span className="text-[#6c6c6c]">y:</span>{' '}
                {tooltip.y.toFixed(2)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
