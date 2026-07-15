import { useState, useCallback, useRef, useEffect } from 'react';
import LZString from 'lz-string';
import type { FunctionEntry, PresetFunction, Point } from './types';
import { getFunctionColor, getNextUnusedColor, compileExpression, GRAPH_LIMITS } from './lib/graphRenderer';
import { labelExpression } from './lib/displayUtils';
import GraphCanvas from './components/GraphCanvas';
import ControlPanel from './components/ControlPanel';
import { Toaster, toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import './graph.css';

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return 'func_' + idCounter + '_' + Date.now().toString(36);
}

function createDefaultFunction(index: number): FunctionEntry {
  return {
    id: generateId(),
    expression: index === 0 ? 'a sin(bx+c)+d' : '',
    visible: true,
    color: getFunctionColor(index),
    params: { a: 1, b: 1, c: 0, d: 0 },
    mode: 'cartesian',
    domainMin: '',
    domainMax: '',
    paramRanges: {},
    showAsymptotes: true,
  };
}

function serializeState(functions: FunctionEntry[]): string {
  const data = functions.map((f) => ({
    e: f.expression,
    v: f.visible,
    c: f.color,
    p: f.params,
    m: f.mode,
    d1: f.domainMin,
    d2: f.domainMax,
    r: f.paramRanges,
    sa: f.showAsymptotes,
  }));
  return LZString.compressToEncodedURIComponent(JSON.stringify(data));
}

const MAX_FUNCTIONS = 6;
const MAX_SERIALIZED_STATE = 4_000;

function finiteNumberRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > GRAPH_LIMITS.parameters) return null;
  const result: Record<string, number> = {};
  for (const [key, number] of entries) {
    if (!/^(?:[a-z]|p\d{1,2})$/i.test(key) || typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number) > 1e6) return null;
    result[key] = number;
  }
  return result;
}

export function deserializeState(hash: string): FunctionEntry[] | null {
  try {
    if (!hash || hash.length > MAX_SERIALIZED_STATE) return null;
    const decoded = LZString.decompressFromEncodedURIComponent(hash);
    if (!decoded || decoded.length > 20_000) return null;
    const data = JSON.parse(decoded);
    if (!Array.isArray(data) || data.length === 0 || data.length > MAX_FUNCTIONS) return null;
    const restored: FunctionEntry[] = [];
    for (const [index, raw] of data.entries()) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const item = raw as Record<string, unknown>;
      const expression = typeof item.e === 'string' ? item.e : '';
      const mode = item.m === 'polar' ? 'polar' : item.m === 'cartesian' || item.m === undefined ? 'cartesian' : null;
      const params = finiteNumberRecord(item.p);
      if (!mode || !params || expression.length > GRAPH_LIMITS.expressionLength || (expression && !compileExpression(expression, mode))) return null;
      const domainMin = typeof item.d1 === 'string' && item.d1.length <= 64 ? item.d1 : '';
      const domainMax = typeof item.d2 === 'string' && item.d2.length <= 64 ? item.d2 : '';
      const color = typeof item.c === 'string' && /^#[0-9a-f]{6}$/i.test(item.c) ? item.c : getFunctionColor(index);
      restored.push({
        id: generateId(), expression, visible: item.v !== false, color, params, mode,
        domainMin, domainMax, paramRanges: {}, showAsymptotes: item.sa !== false,
      });
    }
    return restored;
  } catch {
    return null;
  }
}

const STORAGE_KEY = 'exambridge-graph-state';
const HISTORY_LIMIT = 20;

// Deep clone for history snapshots
function cloneFunctions(funcs: FunctionEntry[]): FunctionEntry[] {
  return funcs.map(f => ({ ...f, params: { ...f.params }, paramRanges: { ...f.paramRanges } }));
}

export default function GraphPage() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [functions, setFunctions] = useState<FunctionEntry[]>(() => {
    try {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const params = new URLSearchParams(hash.slice(qIdx + 1));
        const stateParam = params.get('state');
        if (stateParam) {
          const restored = deserializeState(stateParam);
          if (restored && restored.length > 0) {
            params.delete('state');
            const nextHash = `${hash.slice(0, qIdx)}${params.size ? `?${params.toString()}` : ''}`;
            window.history.replaceState(null, '', window.location.pathname + nextHash);
            return restored;
          }
        }
      }
    } catch { /* ignore */ }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const restored = deserializeState(saved);
      if (restored && restored.length > 0) return restored;
    }
    return [createDefaultFunction(0)];
  });

  // ===== History for undo/redo =====
  const [history, setHistory] = useState<FunctionEntry[][]>(() => [cloneFunctions(functions)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoingRef = useRef(false);
  const pendingSnapshotRef = useRef<FunctionEntry[] | null>(null);

  // Push history via effect to avoid duplication in every callback
  useEffect(() => {
    if (isUndoingRef.current) return;
    if (pendingSnapshotRef.current === functions) return;

    setHistory(h => {
      const trimmed = h.slice(0, historyIndex + 1);
      const snapshot = cloneFunctions(functions);
      // Avoid duplicate consecutive entries
      if (trimmed.length > 0 && JSON.stringify(trimmed[trimmed.length - 1]) === JSON.stringify(snapshot)) {
        return trimmed;
      }
      const next = [...trimmed, snapshot];
      if (next.length > HISTORY_LIMIT + 1) next.shift();
      return next;
    });
    setHistoryIndex(idx => Math.min(idx + 1, HISTORY_LIMIT));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functions]);

  const handleUndo = useCallback(() => {
    setHistoryIndex(currentIdx => {
      if (currentIdx <= 0) return currentIdx;
      const newIdx = currentIdx - 1;
      isUndoingRef.current = true;
      const snapshot = cloneFunctions(history[newIdx]);
      pendingSnapshotRef.current = snapshot;
      setFunctions(snapshot);
      requestAnimationFrame(() => { isUndoingRef.current = false; });
      return newIdx;
    });
  }, [history]);

  const handleRedo = useCallback(() => {
    setHistoryIndex(currentIdx => {
      if (currentIdx >= history.length - 1) return currentIdx;
      const newIdx = currentIdx + 1;
      isUndoingRef.current = true;
      const snapshot = cloneFunctions(history[newIdx]);
      pendingSnapshotRef.current = snapshot;
      setFunctions(snapshot);
      requestAnimationFrame(() => { isUndoingRef.current = false; });
      return newIdx;
    });
  }, [history]);

  // Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleUpdate = useCallback((id: string, updates: Partial<FunctionEntry>) => {
    setFunctions(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setFunctions(prev => {
      const next = prev.filter(f => f.id !== id);
      if (next.length === 0) next.push(createDefaultFunction(0));
      return next;
    });
  }, []);

  const handleAdd = useCallback(() => {
    setFunctions(prev => {
      if (prev.length >= 6) {
        toast.error('最多支持 6 个函数');
        return prev;
      }
      return [
        {
          id: generateId(),
          expression: '',
          visible: true,
          color: getNextUnusedColor(prev.map(f => f.color)),
          params: {},
          mode: 'cartesian' as const,
          domainMin: '',
          domainMax: '',
          paramRanges: {},
          showAsymptotes: true,
        },
        ...prev,
      ];
    });
  }, []);

  const handleApplyPreset = useCallback((preset: PresetFunction) => {
    setFunctions(prev => {
      const isOnlyEmpty = prev.length === 1 && (!prev[0].expression || ['a sin(bx+c)+d', 'a*sin(b*x+c)+d'].includes(prev[0].expression));
      const mergedParams: Record<string, number> = {};
      for (const [k, v] of Object.entries(preset.params)) mergedParams[k] = v;

      if (isOnlyEmpty) {
        return [{
          ...prev[0],
          id: generateId(),
          expression: preset.expression,
          params: mergedParams,
          visible: true,
          color: getFunctionColor(0),
          mode: preset.mode,
          domainMin: preset.domainMin,
          domainMax: preset.domainMax,
          showAsymptotes: true,
        }];
      }

      if (prev.length >= 6) {
        toast.error('最多支持 6 个函数');
        return prev;
      }

      const usedColors = prev.map(f => f.color);
      return [
        {
          id: generateId(),
          expression: preset.expression,
          params: mergedParams,
          visible: true,
          color: getNextUnusedColor(usedColors),
          mode: preset.mode,
          domainMin: preset.domainMin,
          domainMax: preset.domainMax,
          paramRanges: {},
          showAsymptotes: true,
        },
        ...prev,
      ];
    });
  }, []);

  const handleClear = useCallback(() => {
    setFunctions([createDefaultFunction(0)]);
    toast.success('画布已清空');
  }, []);

  const handleExport = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const canvasEl = container.querySelector('canvas');
    if (!canvasEl) return;
    try {
      const link = document.createElement('a');
      link.download = 'function-graph.png';
      link.href = (canvasEl as HTMLCanvasElement).toDataURL('image/png');
      link.click();
      toast.success('图像已导出');
    } catch {
      toast.error('导出失败');
    }
  }, []);

  const handleExportLecture = useCallback(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const sourceCanvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!sourceCanvas) return;

    try {
      const offscreen = document.createElement('canvas');
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      const visibleFuncs = functions.filter(f => f.visible && f.expression);
      const padding = 40;
      const titleHeight = 60;
      const legendHeight = visibleFuncs.length * 24 + 30;
      const w = sourceCanvas.width;
      const h = sourceCanvas.height;

      offscreen.width = w + padding * 2;
      offscreen.height = h + padding * 2 + titleHeight + legendHeight;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);

      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('ExamBridge 函数图像', padding, padding + 30);

      ctx.drawImage(sourceCanvas, padding, padding + titleHeight);

      const legendY = padding + titleHeight + h + 20;
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText('函数图例', padding, legendY);

      let ly = legendY + 20;
      visibleFuncs.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(padding + 8, ly - 4, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#333';
        ctx.font = '12px "Courier New", monospace';
        const displayLabel = labelExpression(f.expression, f.mode, f.params);
        ctx.fillText(displayLabel, padding + 22, ly);

        const paramStr = Object.entries(f.params).map(([k, v]) => `${k}=${Number.isInteger(v) ? v : v.toFixed(2)}`).join(', ');
        if (paramStr) {
          ctx.fillStyle = '#626262';
          ctx.font = '10px "Courier New", monospace';
          ctx.fillText(`(${paramStr})`, padding + 22 + ctx.measureText(displayLabel).width + 8, ly);
        }
        ly += 24;
      });

      const link = document.createElement('a');
      link.download = 'exambridge-lecture-graph.png';
      link.href = offscreen.toDataURL('image/png');
      link.click();
      toast.success('课件图片已导出');
    } catch {
      toast.error('导出失败');
    }
  }, [functions]);

  const [intersections, setIntersections] = useState<Point[]>([]);

  const handleFindIntersections = useCallback(() => {
    const visible = functions.filter(f => f.visible && f.expression);
    if (visible.length < 2) {
      toast.error('需要至少两个可见函数');
      return;
    }
    const f1 = visible[0];
    const f2 = visible[1];

    const compiled1 = compileExpression(f1.expression);
    const compiled2 = compileExpression(f2.expression);
    if (!compiled1 || !compiled2) {
      toast.error('表达式编译失败');
      return;
    }

    const points: Point[] = [];
    const scope1: Record<string, number> = { ...f1.params, e: Math.E, pi: Math.PI };
    const scope2: Record<string, number> = { ...f2.params, e: Math.E, pi: Math.PI };

    const min = -10;
    const max = 10;
    const steps = 2000;
    const step = (max - min) / steps;

    let prevDiff = 0;
    let prevX = min;

    for (let si = 0; si <= steps; si++) {
      const x = min + si * step;
      scope1.x = x;
      scope2.x = x;
      if (f1.mode === 'polar') scope1.theta = x;
      if (f2.mode === 'polar') scope2.theta = x;

      try {
        const y1 = compiled1.evaluate(scope1);
        const y2 = compiled2.evaluate(scope2);
        const diff = y1 - y2;

        if (si > 0 && prevDiff * diff < 0) {
          let a = prevX, b = x;
          for (let iter = 0; iter < 20; iter++) {
            const mid = (a + b) / 2;
            scope1.x = mid; scope2.x = mid;
            if (f1.mode === 'polar') { scope1.theta = mid; scope2.theta = mid; }
            const midDiff = compiled1.evaluate(scope1) - compiled2.evaluate(scope2);
            if (midDiff === 0) { a = b = mid; break; }
            if (prevDiff * midDiff < 0) b = mid;
            else a = mid;
          }
          const rootX = (a + b) / 2;
          scope1.x = rootX; scope2.x = rootX;
          if (f1.mode === 'polar') { scope1.theta = rootX; scope2.theta = rootX; }
          const rootY = compiled1.evaluate(scope1);

          const isDup = points.some(p => Math.abs(p.x - rootX) < 0.01);
          if (!isDup && Math.abs(rootY) < 1000) points.push({ x: rootX, y: rootY });
        }
        prevDiff = diff;
        prevX = x;
      } catch {
        prevDiff = 0;
        prevX = x;
      }
    }

    setIntersections(points);
    if (points.length > 0) toast.success(`找到 ${points.length} 个交点`);
    else toast('未找到交点（在当前视窗内）');
  }, [functions]);

  const handleClearIntersections = useCallback(() => setIntersections([]), []);

  const handleShare = useCallback(() => {
    const hash = serializeState(functions);
    const currentHash = window.location.hash || '#/graph';
    const qIdx = currentHash.indexOf('?');
    const params = new URLSearchParams(qIdx === -1 ? '' : currentHash.slice(qIdx + 1));
    params.set('state', hash);
    const url = `${window.location.origin}${window.location.pathname}#/graph?${params.toString()}`;
    if (url.length > 2000) {
      toast.error('链接过长，请改用导出 PNG 分享');
      return;
    }
    navigator.clipboard.writeText(url).then(() => toast.success('链接已复制')).catch(() => toast.error('复制失败'));
  }, [functions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, serializeState(functions)); } catch { /* storage full */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [functions]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="graph-page-shell flex min-h-screen flex-col">
      <Header title="函数画图工具" />
      <main className="flex flex-1 flex-col overflow-visible lg:flex-row lg:overflow-hidden">
        <h1 className="sr-only">函数画图工具</h1>
        <div ref={canvasContainerRef} className="h-[58vh] min-h-[420px] w-full flex-1 lg:h-[calc(100vh-120px)] lg:min-h-0">
          <GraphCanvas functions={functions} intersections={intersections} onClearIntersections={handleClearIntersections} />
        </div>
        <ControlPanel
          functions={functions}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          onAdd={handleAdd}
          onApplyPreset={handleApplyPreset}
          onExport={handleExport}
          onExportLecture={handleExportLecture}
          onShare={handleShare}
          onClear={handleClear}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onFindIntersections={handleFindIntersections}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </main>
      <Toaster
        position="bottom-left"
        toastOptions={{ style: { background: '#000', color: '#fff', border: 'none', borderRadius: '0', fontSize: '13px' } }}
      />
      <Footer />
    </div>
  );
}
