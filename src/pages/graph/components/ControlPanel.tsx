import { useState } from 'react';
import { Plus, Download, Share2, Trash2, Undo2, Redo2, GitBranch, Presentation } from 'lucide-react';
import type { FunctionEntry, PresetFunction } from '../types';
import FunctionInput from './FunctionInput';

interface ControlPanelProps {
  functions: FunctionEntry[];
  onUpdate: (id: string, updates: Partial<FunctionEntry>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onApplyPreset: (preset: PresetFunction) => void;
  onExport: () => void;
  onExportLecture: () => void;
  onShare: () => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFindIntersections: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// ===== Param meanings for teacher reference =====
const PARAM_MEANINGS: Record<string, string> = {
  'a*sin(b*x+c)+d': 'a:振幅 b:频率 c:相位 d:垂直偏移',
  'a*cos(b*x+c)+d': 'a:振幅 b:频率 c:相位 d:垂直偏移',
  'a*tan(b*x+c)+d': 'a:振幅 b:频率 c:相位 d:垂直偏移',
  'a*x+b': 'a:斜率 b:截距',
  'a*x^2+b*x+c': 'a:开口 b:对称轴 c:垂直偏移',
  'a^(b*x+c)+d': 'a:底数 b:增长率 c:水平偏移 d:垂直偏移',
  'a/(b*x+c)+d': 'a:比例 b:缩放 c:水平偏移 d:垂直偏移',
  'a*abs(b*x+c)+d': 'a:开口 b:缩放 c:水平偏移 d:垂直偏移',
  'a*sqrt(b*x+c)+d': 'a:缩放 b:缩放 c:水平偏移 d:垂直偏移',
  'log(b*x+c)/log(a)+d': 'a:底数 b:缩放 c:水平偏移 d:垂直偏移',
};

function getParamMeaning(expression: string): string {
  // Normalize expression for lookup
  const normalized = expression.replace(/\s/g, '');
  return PARAM_MEANINGS[normalized] || '';
}

// ===== Teacher Common presets =====
const TEACHER_PRESETS: PresetFunction[] = [
  { name: '一次函数', expression: 'a*x+b', params: { a: 1, b: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: '二次函数', expression: 'a*x^2+b*x+c', params: { a: 1, b: 0, c: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: '指数函数', expression: 'a^(b*x+c)+d', params: { a: 2, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: '对数函数', expression: 'log(b*x+c)/log(a)+d', params: { a: 10, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '0', domainMax: '10' },
  { name: 'sin(x)', expression: 'a*sin(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: 'cos(x)', expression: 'a*cos(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: 'tan(x)', expression: 'a*tan(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
];

// ===== Trigonometric presets =====
const TRIG_ROWS: PresetFunction[][] = [
  [
    { name: 'sin', expression: 'a*sin(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
    { name: 'cos', expression: 'a*cos(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
    { name: 'tan', expression: 'a*tan(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  ],
  [
    { name: 'sec', expression: 'a*sec(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
    { name: 'csc', expression: 'a/sin(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
    { name: 'cot', expression: 'a*cot(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  ],
  [
    { name: 'arcsin', expression: 'a*asin(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-1', domainMax: '1' },
    { name: 'arccos', expression: 'a*acos(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-1', domainMax: '1' },
    { name: 'arctan', expression: 'a*atan(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  ],
  [
    { name: 'sinh', expression: 'a*sinh(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
    { name: 'cosh', expression: 'a*cosh(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
    { name: 'tanh', expression: 'a*tanh(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  ],
];

const ALGEBRA_PRESETS: PresetFunction[] = [
  { name: '一次函数 linear', expression: 'a*x+b', params: { a: 1, b: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: '二次抛物线 parabola', expression: 'a*x^2+b*x+c', params: { a: 1, b: 0, c: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: '指数增长 exponential', expression: 'a^(b*x+c)+d', params: { a: 2, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: '对数 log', expression: 'log(b*x+c)/log(a)+d', params: { a: 10, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '0', domainMax: '10' },
  { name: '双曲线 hyperbola', expression: 'a/(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: '绝对值 absolute', expression: 'a*abs(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10' },
  { name: '根号 sqrt', expression: 'a*sqrt(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '0', domainMax: '10' },
];

const POLAR_PRESETS: PresetFunction[] = [
  { name: '玫瑰线 rose', expression: 'a*sin(b*theta)', params: { a: 1, b: 4 }, mode: 'polar', domainMin: '0', domainMax: '4pi' },
  { name: '心形线 cardioid', expression: 'a*(1+cos(theta))', params: { a: 1 }, mode: 'polar', domainMin: '0', domainMax: '4pi' },
  { name: '阿基米德 spiral', expression: 'a*theta', params: { a: 0.5 }, mode: 'polar', domainMin: '0', domainMax: '4pi' },
  { name: '对数螺旋 log spiral', expression: 'a*(1.1^theta)', params: { a: 0.5 }, mode: 'polar', domainMin: '0', domainMax: '4pi' },
  { name: '双纽线 lemniscate', expression: 'a*sqrt(cos(2*theta))', params: { a: 1 }, mode: 'polar', domainMin: '0', domainMax: '4pi' },
  { name: '圆 circle', expression: 'a', params: { a: 2 }, mode: 'polar', domainMin: '0', domainMax: '4pi' },
];

function fmt(name: string): string {
  return name.replace(/theta/g, '\u03B8');
}

type CartTab = 'teacher' | 'trig' | 'algebra';

export default function ControlPanel({
  functions, onUpdate, onRemove, onAdd, onApplyPreset,
  onExport, onExportLecture, onShare, onClear,
  onUndo, onRedo, onFindIntersections,
  canUndo, canRedo,
}: ControlPanelProps) {
  const [cartTab, setCartTab] = useState<CartTab>('teacher');

  // Show param meaning for the first function if it has a known expression
  const firstMeaning = functions.length > 0 ? getParamMeaning(functions[0].expression) : '';

  return (
    <div className="w-[360px] flex-shrink-0 flex flex-col h-full bg-[#f9f9f9] border-l border-[#e5e5e5]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#e5e5e5]">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-black tracking-tight">函数画图工具</h1>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 transition-colors ${canUndo ? 'hover:bg-[#f0f0f0] text-[#6c6c6c]' : 'text-[#ccc] cursor-not-allowed'}`}
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 transition-colors ${canRedo ? 'hover:bg-[#f0f0f0] text-[#6c6c6c]' : 'text-[#ccc] cursor-not-allowed'}`}
              title="重做 (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClear}
              className="p-1.5 hover:bg-[#ffeaea] text-[#6c6c6c] transition-colors"
              title="清空画布"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-[#6c6c6c] mt-1 leading-relaxed">
          输入函数式，拖动滑块观察图像变化。支持定义域限制。
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll px-4 py-4 space-y-3">
        {/* Functions list */}
        <div className="space-y-3">
          {functions.map((entry, idx) => (
            <FunctionInput key={entry.id} entry={entry} index={idx} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>

        {/* Param meaning hint */}
        {firstMeaning && (
          <div className="text-[10px] text-[#999] bg-white border border-[#e5e5e5] px-3 py-2 rounded-sm">
            <span className="font-medium text-[#6c6c6c]">参数说明：</span>{firstMeaning}
          </div>
        )}

        {functions.length < 6 && (
          <button onClick={onAdd} className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#c0c0c0] text-[#6c6c6c] hover:border-black hover:text-black transition-colors text-sm">
            <Plus className="w-4 h-4" />
            添加函数
          </button>
        )}

        {/* Find intersections button */}
        {functions.filter(f => f.visible && f.expression).length >= 2 && (
          <button
            onClick={onFindIntersections}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm border border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5] hover:text-white transition-colors"
          >
            <GitBranch className="w-3.5 h-3.5" />
            求交点
          </button>
        )}

        {/* ===== Cartesian presets with tabs ===== */}
        <div className="pt-4 border-t border-[#e5e5e5]">
          <h3 className="text-xs font-medium text-[#6c6c6c] uppercase tracking-wider mb-2">直角坐标预设</h3>
          {/* Tab buttons: 3 tabs */}
          <div className="flex gap-0 mb-3">
            <button
              onClick={() => setCartTab('teacher')}
              className={`flex-1 py-1.5 text-xs font-medium border transition-colors ${
                cartTab === 'teacher'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-[#6c6c6c] border-[#e5e5e5] hover:border-black'
              }`}
            >
              教师常用
            </button>
            <button
              onClick={() => setCartTab('trig')}
              className={`flex-1 py-1.5 text-xs font-medium border border-l-0 transition-colors ${
                cartTab === 'trig'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-[#6c6c6c] border-[#e5e5e5] hover:border-black'
              }`}
            >
              三角函数
            </button>
            <button
              onClick={() => setCartTab('algebra')}
              className={`flex-1 py-1.5 text-xs font-medium border border-l-0 transition-colors ${
                cartTab === 'algebra'
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-[#6c6c6c] border-[#e5e5e5] hover:border-black'
              }`}
            >
              代数函数
            </button>
          </div>
          {/* Tab content */}
          {cartTab === 'teacher' && (
            <div className="grid grid-cols-3 gap-2">
              {TEACHER_PRESETS.map((p) => (
                <button key={p.name} onClick={() => onApplyPreset(p)} className="pill-btn justify-center text-xs py-1.5">{fmt(p.name)}</button>
              ))}
            </div>
          )}
          {cartTab === 'trig' && (
            <div className="space-y-2">
              {TRIG_ROWS.map((row, ri) => (
                <div key={ri} className="grid grid-cols-3 gap-2">
                  {row.map((p) => (
                    <button key={p.name} onClick={() => onApplyPreset(p)} className="pill-btn justify-center">{fmt(p.name)}</button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {cartTab === 'algebra' && (
            <div className="grid grid-cols-2 gap-2">
              {ALGEBRA_PRESETS.map((p) => (
                <button key={p.name} onClick={() => onApplyPreset(p)} className="pill-btn justify-center">{fmt(p.name)}</button>
              ))}
            </div>
          )}
        </div>

        {/* ===== Polar presets ===== */}
        <div className="pt-4 border-t border-[#e5e5e5]">
          <h3 className="text-xs font-medium text-[#6c6c6c] uppercase tracking-wider mb-3">极坐标预设</h3>
          <div className="grid grid-cols-3 gap-2">
            {POLAR_PRESETS.map((p) => (
              <button key={p.name} onClick={() => onApplyPreset(p)} className="pill-btn justify-center">{fmt(p.name)}</button>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="pt-4 border-t border-[#e5e5e5]">
          <h3 className="text-xs font-medium text-[#6c6c6c] uppercase tracking-wider mb-2">使用提示</h3>
          <ul className="text-xs text-[#6c6c6c] space-y-1 leading-relaxed">
            <li>所有预设均带 a/b 可调参数滑块</li>
            <li>支持定义域限制: 输入范围如 0 ~ 10</li>
            <li>键盘: +/- 缩放, 0 重置, 拖拽平移</li>
            <li>Ctrl+Z 撤销, Ctrl+Y 重做</li>
          </ul>
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="px-4 py-3 border-t border-[#e5e5e5] space-y-2">
        <div className="flex gap-2">
          <button onClick={onExport} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm border border-black bg-white text-black hover:bg-black hover:text-white transition-colors">
            <Download className="w-3.5 h-3.5" />
            导出 PNG
          </button>
          <button onClick={onExportLecture} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm border border-[#4f46e5] bg-white text-[#4f46e5] hover:bg-[#4f46e5] hover:text-white transition-colors">
            <Presentation className="w-3.5 h-3.5" />
            课件图片
          </button>
        </div>
        <button onClick={onShare} className="w-full flex items-center justify-center gap-1.5 py-2 text-sm border border-black bg-white text-black hover:bg-black hover:text-white transition-colors">
          <Share2 className="w-3.5 h-3.5" />
          分享链接
        </button>
      </div>
    </div>
  );
}
