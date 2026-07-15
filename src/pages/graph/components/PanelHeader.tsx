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
    <div className="border-b border-[#d9e2f1] bg-gradient-to-r from-[#eef4ff] via-white to-[#f5efff] px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#25364d]">函数控制面板</h2>
          <p className="mt-0.5 text-[10px] text-[#63738a]">选择预设，调整参数，生成图像</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`rounded-md p-1.5 transition-colors ${canUndo ? 'bg-[#e8f1ff] text-[#315f86] hover:bg-[#d8e8ff]' : 'text-[#b9c2ce] cursor-not-allowed'}`}
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`rounded-md p-1.5 transition-colors ${canRedo ? 'bg-[#eee9ff] text-[#6650a4] hover:bg-[#e2d9ff]' : 'text-[#b9c2ce] cursor-not-allowed'}`}
            title="重做 (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClear}
            className="rounded-md bg-[#fff0f0] p-1.5 text-[#a94848] transition-colors hover:bg-[#ffe0e0]"
            title="清空画布"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
