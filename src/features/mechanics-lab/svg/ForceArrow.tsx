/**
 * ForceArrow — 单个力箭头（自由体图与结果展示共用）。
 * 每个箭头包含：forceId、名称、符号、作用对象、来源、方向、数值或未知量、单位、可访问文本。
 * 颜色不是唯一信息来源：线型（实线/虚线/粗细）+ 文字标签同时编码。
 */
import type { ForceRecordV1 } from "@/features/mechanics-lab/schema";

export const FORCE_KIND_LABEL: Record<ForceRecordV1["kind"], string> = {
  gravity: "重力",
  normal: "支持力",
  "static-friction": "静摩擦",
  "kinetic-friction": "动摩擦",
  tension: "张力",
  rod: "杆作用力",
  applied: "外力",
  "support-reaction": "支点反力",
};

export const FORCE_KIND_STYLE: Record<ForceRecordV1["kind"], { color: string; dash?: string; width: number }> = {
  gravity: { color: "#16a34a", width: 2.5 },
  normal: { color: "#2563eb", width: 2.5 },
  "static-friction": { color: "#9333ea", width: 2.5 },
  "kinetic-friction": { color: "#9333ea", dash: "7 4", width: 2.5 },
  tension: { color: "#0369a1", width: 2.5 },
  rod: { color: "#7c3aed", width: 4 },
  applied: { color: "#dc2626", width: 2.5 },
  "support-reaction": { color: "#475569", width: 2.5 },
};

export interface ForceArrowProps {
  force: ForceRecordV1;
  /** 起点（px） */
  x: number;
  y: number;
  /** 箭头长度（px） */
  length: number;
  showComponents: boolean;
  markerId: string;
  /** 标签沿箭头方向的额外偏移（避免相邻标签重叠） */
  labelOffset?: number;
}

export function ForceArrow({ force, x, y, length, showComponents, markerId, labelOffset = 0 }: ForceArrowProps): React.JSX.Element {
  const style = FORCE_KIND_STYLE[force.kind];
  const unknown = force.magnitude === null;
  const magnitude = force.magnitude ?? 0;
  // 带符号大小：负值力沿参考方向的反方向绘制（禁止静默取绝对值）
  const sign = unknown || magnitude >= 0 ? 1 : -1;
  const ex = x + force.direction.x * length * sign;
  const ey = y - force.direction.y * length * sign;
  const magText = unknown ? "未知" : `${magnitude >= 0 ? "" : "−"}${Math.abs(magnitude).toFixed(3)}`;
  const labelX = ex + (force.direction.x * sign >= 0 ? 6 : -6) + force.direction.x * sign * labelOffset;
  const labelAnchor = force.direction.x * sign >= 0 ? "start" : "end";
  const ariaText = `${FORCE_KIND_LABEL[force.kind]} ${force.symbol}，作用于 ${force.objectId}，来源 ${force.source}，方向 (${(force.direction.x * sign).toFixed(3)}, ${(force.direction.y * sign).toFixed(3)})，大小 ${unknown ? "未知量" : `${magText} ${force.unit}`}${force.note !== undefined ? `，备注：${force.note}` : ""}`;
  return (
    <g data-force-id={force.forceId} role="img" aria-label={ariaText}>
      <title>{ariaText}</title>
      <line
        x1={x}
        y1={y}
        x2={ex}
        y2={ey}
        stroke={style.color}
        strokeWidth={style.width}
        strokeDasharray={unknown ? "3 3" : style.dash}
        markerEnd={`url(#${markerId})`}
      />
      {showComponents && !unknown && (
        <>
          <line x1={x} y1={y} x2={ex} y2={y} stroke={style.color} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
          <line x1={ex} y1={y} x2={ex} y2={ey} stroke={style.color} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
        </>
      )}
      <text x={labelX} y={ey - 4 - labelOffset * 0.6} fontSize={10} textAnchor={labelAnchor} fill={style.color}>
        {force.symbol}
        {unknown ? " = ?" : ` = ${magText} ${force.unit}`}
      </text>
    </g>
  );
}
