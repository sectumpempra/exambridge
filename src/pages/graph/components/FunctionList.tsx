import { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { FunctionEntry } from '../types';
import FunctionInput from './FunctionInput';

interface FunctionListProps {
  functions: FunctionEntry[];
  onUpdate: (id: string, updates: Partial<FunctionEntry>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

function FunctionCard({
  entry,
  index,
  onUpdate,
  onRemove,
}: {
  entry: FunctionEntry;
  index: number;
  onUpdate: (id: string, updates: Partial<FunctionEntry>) => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const prefix = entry.mode === 'polar' ? 'r =' : 'y =';
  const displayExpr = entry.expression || `函数 ${index + 1}`;

  return (
    <div className="rounded-lg border border-[#d4d2cb] bg-white overflow-hidden">
      {/* 头部：始终可见 */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#fafafa] border-b border-[#f0f0f0]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-medium text-[#3d3832] truncate">
            {prefix} {displayExpr}
          </span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onUpdate(entry.id, { visible: !entry.visible })}
            className="p-1.5 hover:bg-[#f0f0f0] transition-colors"
            title={entry.visible ? '隐藏' : '显示'}
          >
            {entry.visible ? (
              <Eye className="w-3.5 h-3.5 text-[#6c6c6c]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-[#c0c0c0]" />
            )}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-[#f0f0f0] transition-colors"
            title={expanded ? '折叠' : '展开'}
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-[#6c6c6c]" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-[#6c6c6c]" />
            )}
          </button>
          <button
            onClick={() => onRemove(entry.id)}
            className="p-1.5 hover:bg-[#ffeaea] transition-colors"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#6c6c6c]" />
          </button>
        </div>
      </div>

      {/* 主体：参数滑块，可折叠 */}
      {expanded && (
        <div className="px-3 py-2">
          <FunctionInput entry={entry} index={index} onUpdate={onUpdate} onRemove={onRemove} />
        </div>
      )}
    </div>
  );
}

export default function FunctionList({ functions, onUpdate, onRemove, onAdd }: FunctionListProps) {
  const [allExpanded, setAllExpanded] = useState(true);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium text-[#6c6c6c] uppercase tracking-wider">
          已添加函数 ({functions.length}/6)
        </h3>
        <button
          onClick={() => setAllExpanded(!allExpanded)}
          className="text-[11px] text-[#8f7f6e] hover:underline"
        >
          {allExpanded ? '全部折叠' : '全部展开'}
        </button>
      </div>

      <div className="space-y-3">
        {functions.map((entry, idx) => (
          <FunctionCard
            key={entry.id}
            entry={entry}
            index={idx}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </div>

      {functions.length < 6 && (
        <button
          onClick={onAdd}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#c0c0c0] text-[#6c6c6c] hover:border-black hover:text-black transition-colors text-sm rounded-lg"
        >
          <span className="text-base leading-none">+</span>
          添加函数
        </button>
      )}
    </div>
  );
}
