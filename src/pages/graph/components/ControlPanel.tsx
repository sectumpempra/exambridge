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
    <aside className="flex h-auto w-full flex-shrink-0 flex-col border-t border-[#dbe3ec] bg-[#f7f9fc] lg:h-[calc(100vh-120px)] lg:w-[380px] lg:border-l lg:border-t-0">
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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0f8b8d] bg-[#ecf8f7] py-2.5 text-xs font-semibold text-[#0b6f71] transition-all hover:bg-[#0f8b8d] hover:text-white"
            >
              <GitBranch className="w-3.5 h-3.5" />
              求两条函数交点
            </button>
          </div>
        )}

        <div className="mx-4 mb-4 rounded-xl border border-[#ead9b7] bg-[#fff9ec] p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8a5a18]">使用提示</h3>
          <ul className="space-y-1 text-xs leading-relaxed text-[#6f5a38]">
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
