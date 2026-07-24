/** 左侧/顶部对象工具栏 */
import type { EditorAction, EditorTool } from "@/features/mechanics-lab/svg";

const TOOLS: { tool: EditorTool; label: string; hint: string }[] = [
  { tool: "select", label: "选择", hint: "选择/移动实体" },
  { tool: "add-object", label: "物体", hint: "添加物体" },
  { tool: "add-horizontal-surface", label: "水平面", hint: "添加水平面" },
  { tool: "add-inclined-surface", label: "斜面", hint: "添加斜面（默认 30°）" },
  { tool: "add-support", label: "固定支点", hint: "点击物体添加支点" },
  { tool: "add-fixed-pulley", label: "固定滑轮", hint: "添加固定滑轮" },
  { tool: "add-movable-pulley", label: "动滑轮", hint: "添加动滑轮" },
  { tool: "add-rope", label: "绳", hint: "连接绳（轻且不可伸长）" },
  { tool: "add-rod", label: "杆", hint: "连接轻杆（只传轴向力）" },
  { tool: "add-force", label: "外力", hint: "点击物体添加外力" },
  { tool: "delete", label: "删除", hint: "点击实体删除" },
];

export interface ToolbarProps {
  tool: EditorTool;
  dispatch: (action: EditorAction) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
}

export function Toolbar({ tool, dispatch, canUndo, canRedo, hasSelection }: ToolbarProps): React.JSX.Element {
  return (
    <div className="toolbar" role="toolbar" aria-label="对象工具栏" aria-orientation="vertical">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          type="button"
          className={`toolbar-btn${tool === t.tool ? " active" : ""}`}
          title={t.hint}
          aria-pressed={tool === t.tool}
          onClick={() => dispatch({ type: "set-tool", tool: t.tool })}
        >
          {t.label}
        </button>
      ))}
      <div className="toolbar-sep" aria-hidden="true" />
      <button type="button" className="toolbar-btn" disabled={!hasSelection} onClick={() => dispatch({ type: "duplicate-selection" })}>
        复制
      </button>
      <button type="button" className="toolbar-btn" disabled={!canUndo} onClick={() => dispatch({ type: "undo" })}>
        撤销
      </button>
      <button type="button" className="toolbar-btn" disabled={!canRedo} onClick={() => dispatch({ type: "redo" })}>
        重做
      </button>
    </div>
  );
}
