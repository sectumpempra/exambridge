import { useState, useCallback } from 'react';
import { Pencil, GitBranch } from 'lucide-react';
import type { FunctionEntry } from '../types';
import { extractParams, compileExpression, convertNumbersToParams, convertNumbersWithExisting } from '../lib/graphRenderer';
import { domainVariable } from '../lib/displayUtils';
import EditableExpression from './EditableExpression';
import ParamSlider from './ParamSlider';

const PARAM_LABELS: Record<string, string> = {
  a: "振幅 / 系数",
  b: "频率 / 周期",
  c: "相位偏移",
  d: "垂直偏移",
};

interface FunctionInputProps {
  entry: FunctionEntry;
  index: number;
  onUpdate: (id: string, updates: Partial<FunctionEntry>) => void;
  onRemove: (id: string) => void;
}

/** Auto-convert trailing +number/-number to +d param (d=vertical shift), preserving the original value */
function normalizeTrailingConstant(expr: string): { expr: string; defaultValue?: number } {
  const trailingMatch = expr.match(/(.+)([+-])(\d+\.?\d*)$/);
  if (trailingMatch) {
    const [, prefix, sign, numStr] = trailingMatch;
    if (/[a-zA-Z]/.test(numStr)) return { expr };
    const value = parseFloat(sign + numStr);
    return { expr: prefix + '+d', defaultValue: value };
  }
  return { expr };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function FunctionInput({ entry, index: _index, onUpdate, onRemove: _onRemove }: FunctionInputProps) {
  const [editingExpr, setEditingExpr] = useState(!entry.expression.trim());
  const [exprInput, setExprInput] = useState(entry.expression);
  const [error, setError] = useState('');

  const validateAndUpdate = useCallback((newExpr: string) => {
    setExprInput(newExpr);
    if (!newExpr.trim()) { setError(''); onUpdate(entry.id, { expression: newExpr }); return; }

    try {
      let finalExpr = newExpr;
      let trailingDDefault: number | undefined;

      const normalized = normalizeTrailingConstant(newExpr);
      if (normalized.expr !== newExpr) {
        finalExpr = normalized.expr;
        trailingDDefault = normalized.defaultValue;
      }

      const compiled = compileExpression(finalExpr);
      if (!compiled) { setError('表达式语法错误'); onUpdate(entry.id, { expression: newExpr }); return; }

      let finalParams = { ...entry.params };
      if (trailingDDefault !== undefined) {
        finalParams = { ...finalParams, d: trailingDDefault };
      }

      const extractedParams = extractParams(finalExpr);

      if (extractedParams.length === 0) {
        const converted = convertNumbersToParams(finalExpr);
        if (converted) {
          finalExpr = converted.expression;
          finalParams = converted.params;
          if (trailingDDefault !== undefined) {
            finalParams = { ...finalParams, d: trailingDDefault };
          }
        } else {
          finalParams = trailingDDefault !== undefined ? { d: trailingDDefault } : {};
        }
      } else {
        const mergedParams: Record<string, number> = {};
        for (const p of extractedParams) {
          mergedParams[p] = finalParams[p] ?? entry.params[p] ?? (p === 'd' ? 0 : 1);
        }
        const converted = convertNumbersWithExisting(finalExpr, extractedParams);
        if (converted) {
          finalExpr = converted.expression;
          for (const [k, v] of Object.entries(converted.params)) {
            if (!(k in mergedParams)) {
              mergedParams[k] = v;
            }
          }
        }
        finalParams = mergedParams;
      }

      // Validate
      const validateCompiled = compileExpression(finalExpr);
      const testScope: Record<string, number> = {
        x: 1, theta: 1, t: 1, e: Math.E, pi: Math.PI, ...finalParams,
      };
      if (validateCompiled) validateCompiled.evaluate(testScope);

      setError('');
      setEditingExpr(false);
      onUpdate(entry.id, { expression: finalExpr, params: finalParams });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '无效的表达式');
      onUpdate(entry.id, { expression: newExpr });
    }
  }, [entry.id, entry.params, onUpdate]);

  const handleParamChange = useCallback((name: string, val: number) => {
    onUpdate(entry.id, { params: { ...entry.params, [name]: val } });
  }, [entry.id, entry.params, onUpdate]);

  const handleParamRangeChange = useCallback((name: string, min: number, max: number, step: number) => {
    onUpdate(entry.id, {
      paramRanges: { ...entry.paramRanges, [name]: { min, max, step } },
    });
  }, [entry.id, entry.paramRanges, onUpdate]);

  // Fixed order: a, b, c, d
  const ORDER = ['a', 'b', 'c', 'd'];
  const paramNames = Object.keys(entry.params).sort((a, b) => {
    const idxA = ORDER.indexOf(a);
    const idxB = ORDER.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
  const hasParams = paramNames.length > 0;
  const varLabel = domainVariable(entry.mode);

  return (
    <div>
      {/* Color picker + expression */}
      <div className="flex items-center gap-2 mb-2">
        <label className="relative cursor-pointer flex-shrink-0">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <input
            aria-label="函数颜色"
            type="color"
            value={entry.color}
            onChange={(e) => onUpdate(entry.id, { color: e.target.value })}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            title="更换颜色"
          />
        </label>
        {entry.expression.trim() && !editingExpr ? (
          <div className="flex items-baseline gap-2 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <EditableExpression expression={entry.expression} params={entry.params} mode={entry.mode} onParamChange={handleParamChange} />
            </div>
            <button onClick={() => setEditingExpr(true)} className="p-1 hover:bg-[#f0f0f0] transition-colors flex-shrink-0" title="编辑表达式">
              <Pencil className="w-3 h-3 text-[#bbb]" />
            </button>
          </div>
        ) : (
          <div className="flex items-baseline gap-1 flex-1">
            <span className="text-sm text-[#6c6c6c] select-none">{entry.mode === 'polar' ? 'r = ' : 'y = '}</span>
            <input
              type="text"
              value={exprInput}
              onChange={(e) => setExprInput(e.target.value)}
              onBlur={() => { if (exprInput === entry.expression && entry.expression.trim()) setEditingExpr(false); else validateAndUpdate(exprInput); }}
              onKeyDown={(e) => { if (e.key === 'Enter') validateAndUpdate(exprInput); if (e.key === 'Escape') { setExprInput(entry.expression); if (entry.expression.trim()) setEditingExpr(false); setError(''); } }}
              autoFocus
              className="mono-num flex-1 border-b-2 bg-transparent px-1 py-0.5 text-sm text-black focus:outline-none"
              style={{ borderColor: entry.color }}
              placeholder="输入函数式，如 a sin(bx)+c"
            />
          </div>
        )}
      </div>

      {/* Domain inputs */}
      <div className="flex items-center gap-1.5 mb-2">
        <input
          type="text"
          value={entry.domainMin}
          onChange={(e) => onUpdate(entry.id, { domainMin: e.target.value })}
          placeholder="-10"
          className="w-10 text-[11px] text-center mono-num border-b border-[#ddd] focus:border-black focus:outline-none text-[#6c6c6c] py-0.5"
        />
        <span className="text-[11px] text-[#626262] select-none">{String.fromCharCode(8804)} {varLabel} {String.fromCharCode(8804)}</span>
        <input
          type="text"
          value={entry.domainMax}
          onChange={(e) => onUpdate(entry.id, { domainMax: e.target.value })}
          placeholder="10"
          className="w-10 text-[11px] text-center mono-num border-b border-[#ddd] focus:border-black focus:outline-none text-[#6c6c6c] py-0.5"
        />
        {entry.mode === 'polar' && <span className="text-[10px] text-[#bbb]">默认 0 ~ 4π</span>}
      </div>

      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}

      {/* Param sliders */}
      {hasParams && (
        <div className="border-t border-[#f0f0f0] pt-2">
          {paramNames.map((name) => {
            const range = entry.paramRanges[name] || { min: -10, max: 10, step: 0.1 };
            return (
              <ParamSlider key={name} name={name} label={PARAM_LABELS[name]} value={entry.params[name]} onChange={handleParamChange}
                accentColor={entry.color}
                onRangeChange={handleParamRangeChange} min={range.min} max={range.max} step={range.step} />
            );
          })}
        </div>
      )}

      {/* Asymptote toggle */}
      {(entry.expression.includes('tan(') ||
        entry.expression.includes('cot(') ||
        entry.expression.includes('sec(') ||
        entry.expression.includes('csc(') ||
        entry.expression.includes('atan(') ||
        entry.expression.includes('asin(') ||
        entry.expression.includes('acos(') ||
        entry.expression.includes('/sin(') ||
        entry.expression.includes('/cos(') ||
        entry.expression.includes('/tan(') ||
        entry.expression.includes('/x') ||
        entry.expression.match(/\/\([^)]*x/) ||
        entry.expression.match(/\^\s*\(/) ||
        entry.expression.match(/\d+\^/) ||
        entry.expression.match(/\be\^/) ||
        entry.expression.match(/[a-zA-Z]\^x/) ||
        entry.expression.includes('log(')) && (
        <div className="mt-1">
          <button
            onClick={() => onUpdate(entry.id, { showAsymptotes: !entry.showAsymptotes })}
            className="flex items-center gap-1 text-[10px] text-[#6c6c6c] hover:text-[#4f46e5] transition-colors"
            title={entry.showAsymptotes ? '隐藏渐近线' : '显示渐近线'}
          >
            <GitBranch className={`w-3 h-3 ${entry.showAsymptotes ? 'text-[#4f46e5]' : 'text-[#c0c0c0]'}`} />
            {entry.showAsymptotes ? '渐近线：显示' : '渐近线：隐藏'}
          </button>
        </div>
      )}
    </div>
  );
}
