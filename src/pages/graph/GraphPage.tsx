import { useState, useCallback, useRef, useEffect } from 'react';
import LZString from 'lz-string';
import type { FunctionEntry, PresetFunction } from './types';
import { getFunctionColor, getNextUnusedColor } from './lib/graphRenderer';
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
    expression: index === 0 ? 'a*sin(b*x+c)+d' : '',
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
  // Use LZString instead of btoa to support Unicode (Chinese, π, etc.)
  return LZString.compressToEncodedURIComponent(JSON.stringify(data));
}

function deserializeState(hash: string): FunctionEntry[] | null {
  try {
    const decoded = LZString.decompressFromEncodedURIComponent(hash);
    if (!decoded) return null;
    const data = JSON.parse(decoded);
    if (!Array.isArray(data)) return null;
    return data.map((item: Record<string, unknown>, index: number) => ({
      id: generateId(),
      expression: (item.e as string) || '',
      visible: item.v !== false,
      color: (item.c as string) || getFunctionColor(index),
      params: (item.p as Record<string, number>) || {},
      mode: ((item.m as string) || 'cartesian') as 'cartesian' | 'polar',
      domainMin: (item.d1 as string) || '',
      domainMax: (item.d2 as string) || '',
      paramRanges: (item.r as Record<string, { min: number; max: number; step: number }>) || {},
      showAsymptotes: item.sa !== false,
    }));
  } catch {
    return null;
  }
}

const STORAGE_KEY = 'grademaster-graph-state';

const NAV_LINKS = [
  { label: '首页', to: '/' },
  { label: '分数线', to: '/alevel' },
  { label: '等级预测', to: '/calculator' },
  { label: 'A*率趋势', to: '/statistics' },
  { label: '刷题规划', to: '/planner' },
];

export default function GraphPage() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const [functions, setFunctions] = useState<FunctionEntry[]>(() => {
    // Priority 1: URL state param (for shared links)
    try {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      if (qIdx !== -1) {
        const params = new URLSearchParams(hash.slice(qIdx + 1));
        const stateParam = params.get('state');
        if (stateParam) {
          const restored = deserializeState(stateParam);
          if (restored && restored.length > 0) {
            // Clean URL state after restoring
            window.history.replaceState(null, '', window.location.pathname + window.location.hash.slice(0, qIdx));
            return restored;
          }
        }
      }
    } catch { /* ignore parse errors */ }

    // Priority 2: localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const restored = deserializeState(saved);
      if (restored && restored.length > 0) return restored;
    }
    return [createDefaultFunction(0)];
  });

  const handleUpdate = useCallback((id: string, updates: Partial<FunctionEntry>) => {
    setFunctions((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setFunctions((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleAdd = useCallback(() => {
    setFunctions((prev) => {
      if (prev.length >= 6) return prev;
      const newIndex = prev.length;
      return [
        ...prev,
        {
          id: generateId(),
          expression: '',
          visible: true,
          color: getFunctionColor(newIndex),
          params: {},
          mode: 'cartesian',
          domainMin: '',
          domainMax: '',
          paramRanges: {},
          showAsymptotes: true,
        },
      ];
    });
  }, []);

  const handleApplyPreset = useCallback((preset: PresetFunction) => {
    setFunctions((prev) => {
      if (prev.length >= 6) {
        toast.error('最多支持 6 个函数');
        return prev;
      }

      const mergedParams: Record<string, number> = {};
      for (const [k, v] of Object.entries(preset.params)) {
        mergedParams[k] = v;
      }

      const usedColors = prev.map((f) => f.color);
      const color = getNextUnusedColor(usedColors);

      return [
        ...prev,
        {
          id: generateId(),
          expression: preset.expression,
          params: mergedParams,
          visible: true,
          color,
          mode: preset.mode,
          domainMin: preset.domainMin,
          domainMax: preset.domainMax,
          paramRanges: {},
          showAsymptotes: true,
        },
      ];
    });
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

  const handleShare = useCallback(() => {
    const hash = serializeState(functions);
    const url = window.location.origin + '/#/graph?state=' + hash;
    if (url.length > 2000) {
      toast.error('链接过长，请改用导出 PNG 分享');
      return;
    }
    navigator.clipboard.writeText(url).then(() => toast.success('链接已复制')).catch(() => toast.error('复制失败'));
  }, [functions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, serializeState(functions));
      } catch { /* storage full */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [functions]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <Header title="函数画图" links={NAV_LINKS} />
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div ref={canvasContainerRef} style={{ flex: 1, height: 'calc(100vh - 120px)' }}>
          <GraphCanvas functions={functions} />
        </div>
        <ControlPanel
          functions={functions}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          onAdd={handleAdd}
          onApplyPreset={handleApplyPreset}
          onExport={handleExport}
          onShare={handleShare}
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
