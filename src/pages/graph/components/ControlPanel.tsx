import { GitBranch } from 'lucide-react';
import type { FunctionEntry, PresetFunction } from '../types';
import PresetSection from './PresetSection';
import FunctionList from './FunctionList';
import PanelHeader from './PanelHeader';
import PanelFooter from './PanelFooter';

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

export default function ControlPanel({
  functions, onUpdate, onRemove, onAdd, onApplyPreset,
  onExport, onExportLecture, onShare, onClear,
  onUndo, onRedo, onFindIntersections,
  canUndo, canRedo,
}: ControlPanelProps) {
  const visibleCount = functions.filter((f) => f.visible && f.expression).length;

  return (
    <aside className="w-[360px] flex-shrink-0 flex flex-col h-[calc(100vh-120px)] bg-[#f9f9f9] border-l border-[#e5e5e5]">
      <PanelHeader
        onUndo={onUndo}
        onRedo={onRedo}
        onClear={onClear}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="flex-1 overflow-y-auto custom-scroll">
        <PresetSection onApplyPreset={onApplyPreset} />

        <FunctionList
          functions={functions}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onAdd={onAdd}
        />

        {visibleCount >= 2 && (
          <div className="px-4 pb-4">
            <button
              onClick={onFindIntersections}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs border border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5] hover:text-white transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              求两条函数交点
            </button>
          </div>
        )}

        <div className="px-4 pb-4">
          <h3 className="text-xs font-medium text-[#6c6c6c] uppercase tracking-wider mb-2">使用提示</h3>
          <ul className="text-xs text-[#6c6c6c] space-y-1 leading-relaxed">
            <li>所有预设均带可调参数滑块</li>
            <li>支持定义域限制，如 0 ~ 10</li>
            <li>鼠标滚轮缩放，拖拽平移</li>
            <li>Ctrl+Z 撤销，Ctrl+Y 重做</li>
          </ul>
        </div>
      </div>

      <PanelFooter
        onExport={onExport}
        onExportLecture={onExportLecture}
        onShare={onShare}
      />
    </aside>
  );
}
