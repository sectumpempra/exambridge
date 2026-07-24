/**
 * FreeBodyDiagram — 自由体图渲染组件。
 * 数据来源：MechanicsSolutionV1.forces / freeBodyDiagrams / coordinateSystems / constraints。
 * 本组件只渲染 core 的结构化结果，绝不重新计算。
 */
import { useId, useMemo, useState } from "react";
import type { MechanicsSolutionV1 } from "@/features/mechanics-lab/schema";
import { ForceArrow, FORCE_KIND_LABEL } from "./ForceArrow.js";

export interface FreeBodyDiagramProps {
  solution: MechanicsSolutionV1;
  /** 显示完整系统（全部物体）或单个物体 */
  mode: "all" | "single";
  objectId?: string;
  showComponents?: boolean;
  showLocalAxes?: boolean;
  showConstraintDirections?: boolean;
}

const ARROW_BASE_PX = 26;
const ARROW_MAX_PX = 64;
const BODY_R = 16;

export function FreeBodyDiagram({
  solution,
  mode,
  objectId,
  showComponents = false,
  showLocalAxes = false,
  showConstraintDirections = false,
}: FreeBodyDiagramProps): React.JSX.Element {
  const fbds =
    mode === "single" && objectId !== undefined
      ? solution.freeBodyDiagrams.filter((f) => f.objectId === objectId)
      : solution.freeBodyDiagrams;
  const [selectedId, setSelectedId] = useState<string | null>(objectId ?? null);

  const chosen = useMemo(() => {
    if (mode === "single") {
      const effective = selectedId ?? fbds[0]?.objectId ?? null;
      return fbds.filter((f) => f.objectId === effective);
    }
    return fbds;
  }, [fbds, mode, selectedId]);

  const effectiveSelectedId = selectedId ?? fbds[0]?.objectId ?? "";

  const markerId = `fbd-arrow-${useId().replace(/:/g, "")}`;

  if (fbds.length === 0) {
    return <p className="fbd-empty">暂无可显示的自由体图（求解状态：{solution.status}）。</p>;
  }

  return (
    <div className="fbd-panel">
      {mode === "single" && (
        <label className="fbd-picker">
          选择物体：
          <select
            value={effectiveSelectedId}
            onChange={(e) => setSelectedId(e.target.value === "" ? null : e.target.value)}
            aria-label="选择要显示自由体图的物体"
          >
            {fbds.map((f) => (
              <option key={f.objectId} value={f.objectId}>
                {f.objectLabel}（{f.objectId}）
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="fbd-grid">
        {chosen.map((fbd) => {
          const forces = fbd.forceIds
            .map((id) => solution.forces.find((f) => f.forceId === id))
            .filter((f): f is NonNullable<typeof f> => f !== undefined);
          const localCs = solution.coordinateSystems.find((cs) => cs.objectId === fbd.objectId);
          const dirReport = solution.directionReports.find((d) => d.objectId === fbd.objectId);
          const constraints = showConstraintDirections
            ? solution.constraints.filter((c) => c.constraintId.includes(fbd.objectId))
            : [];
          return (
            <figure key={fbd.objectId} className="fbd-card" aria-label={`物体 ${fbd.objectId} 的自由体图`}>
              <svg viewBox="-110 -110 220 220" width={220} height={220} role="img" aria-label={`${fbd.objectLabel} 自由体图`}>
                <defs>
                  <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <polygon points="0 0, 8 4, 0 8" fill="currentColor" />
                  </marker>
                </defs>
                <circle cx={0} cy={0} r={BODY_R} fill="#e2e8f0" stroke="#334155" strokeWidth={2} />
                <text x={0} y={4} fontSize={11} textAnchor="middle" fill="#0f172a">
                  {fbd.objectId}
                </text>
                {showLocalAxes && localCs !== undefined && (
                  <>
                    <line x1={0} y1={0} x2={localCs.xAxis.x * 90} y2={-localCs.xAxis.y * 90} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" />
                    <line x1={0} y1={0} x2={localCs.yAxis.x * 90} y2={-localCs.yAxis.y * 90} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" />
                    <text x={localCs.xAxis.x * 94} y={-localCs.xAxis.y * 94} fontSize={10} fill="#94a3b8">x′</text>
                    <text x={localCs.yAxis.x * 94} y={-localCs.yAxis.y * 94} fontSize={10} fill="#94a3b8">y′</text>
                  </>
                )}
                {dirReport !== undefined && (
                  <text x={0} y={BODY_R + 16} fontSize={10} textAnchor="middle" fill="#64748b">
                    正方向 ({dirReport.assumedPositiveDirection.x.toFixed(2)}, {dirReport.assumedPositiveDirection.y.toFixed(2)})
                  </text>
                )}
                {forces.map((force, i) => {
                  const mag = force.magnitude;
                  const len =
                    mag === null
                      ? ARROW_BASE_PX
                      : Math.min(ARROW_MAX_PX, ARROW_BASE_PX + Math.abs(mag) * 1.2);
                  // 同方向（含符号）箭头标签错位，避免重叠
                  const sign = mag === null || mag >= 0 ? 1 : -1;
                  const dx = force.direction.x * sign;
                  const dy = force.direction.y * sign;
                  const sameDirCount = forces.slice(0, i).filter((f) => {
                    const s2 = f.magnitude === null || (f.magnitude ?? 0) >= 0 ? 1 : -1;
                    const d2x = f.direction.x * s2;
                    const d2y = f.direction.y * s2;
                    return d2x * dx + d2y * dy > 0.9;
                  }).length;
                  return (
                    <ForceArrow
                      key={force.forceId}
                      force={force}
                      x={0}
                      y={0}
                      length={len}
                      showComponents={showComponents}
                      markerId={markerId}
                      labelOffset={sameDirCount * 16}
                    />
                  );
                })}
              </svg>
              <figcaption>
                <strong>{fbd.objectLabel}</strong>（{forces.length} 个力）
                <ul className="fbd-force-list">
                  {forces.map((f) => (
                    <li key={f.forceId}>
                      {FORCE_KIND_LABEL[f.kind]} {f.symbol}：
                      {f.magnitude === null ? "未知" : `${f.magnitude.toFixed(3)} ${f.unit}`}
                      {f.note !== undefined ? `（${f.note}）` : ""}
                    </li>
                  ))}
                </ul>
                {constraints.length > 0 && (
                  <ul className="fbd-constraint-list">
                    {constraints.map((c) => (
                      <li key={c.constraintId}>{c.expression} — {c.satisfied ? "满足" : "不满足"}</li>
                    ))}
                  </ul>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
