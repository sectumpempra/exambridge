import { Undo2, Redo2, Trash2 } from 'lucide-react';

interface PanelHeaderProps {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function PanelHeader({ onUndo, onRedo, onClear, canUndo, canRedo }: PanelHeaderProps) {
  return (
    <div className="px-4 py-3 border-b border-[#e5e5e5] bg-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#3d3832]">函数控制面板</h2>
          <p className="text-[10px] text-[#999] mt-0.5">选择预设，调整参数，生成图像</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition-colors ${canUndo ? 'hover:bg-[#f0f0f0] text-[#6c6c6c]' : 'text-[#ccc] cursor-not-allowed'}`}
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition-colors ${canRedo ? 'hover:bg-[#f0f0f0] text-[#6c6c6c]' : 'text-[#ccc] cursor-not-allowed'}`}
            title="重做 (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClear}
            className="p-1.5 rounded hover:bg-[#ffeaea] text-[#6c6c6c] transition-colors"
            title="清空画布"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
