/**
 * 结果面板（阶段5）：按规格书第九节顺序展示教学步骤 + 自由体图。
 * 数据流：MechanicsSolutionV1 → mechanics-explain（文案）+ mechanics-svg（自由体图）。
 */
import { useState } from "react";
import type { MechanicsSolutionV1 } from "@/features/mechanics-lab/schema";
import { explainSolution, type ExplainItem } from "@/features/mechanics-lab/explain";
import { FreeBodyDiagram } from "@/features/mechanics-lab/svg";

export function ResultsPanel({ solution }: { solution: MechanicsSolutionV1 }): React.JSX.Element {
  const doc = explainSolution(solution);
  const [fbdMode, setFbdMode] = useState<"all" | "single">("all");
  const [showComponents, setShowComponents] = useState(false);
  const [showLocalAxes, setShowLocalAxes] = useState(false);
  const [showConstraints, setShowConstraints] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("conclusion");

  return (
    <div className={`results status-${solution.status}`}>
      <div className="results-head">
        <strong className="status-badge" aria-live="polite">
          {doc.statusLabel}
        </strong>
        <span>{doc.statusReason}</span>
      </div>

      {solution.freeBodyDiagrams.length > 0 && (
        <div className="fbd-controls" role="group" aria-label="自由体图显示选项">
          <span>自由体图：</span>
          <label>
            <input type="radio" name="fbd-mode" checked={fbdMode === "all"} onChange={() => setFbdMode("all")} />
            全部物体
          </label>
          <label>
            <input type="radio" name="fbd-mode" checked={fbdMode === "single"} onChange={() => setFbdMode("single")} />
            单个物体
          </label>
          <label>
            <input type="checkbox" checked={showComponents} onChange={(e) => setShowComponents(e.target.checked)} />
            显示分量
          </label>
          <label>
            <input type="checkbox" checked={showLocalAxes} onChange={(e) => setShowLocalAxes(e.target.checked)} />
            局部坐标轴
          </label>
          <label>
            <input type="checkbox" checked={showConstraints} onChange={(e) => setShowConstraints(e.target.checked)} />
            约束方向
          </label>
        </div>
      )}
      {solution.freeBodyDiagrams.length > 0 && (
        <FreeBodyDiagram
          solution={solution}
          mode={fbdMode}
          showComponents={showComponents}
          showLocalAxes={showLocalAxes}
          showConstraintDirections={showConstraints}
        />
      )}

      <div className="explain-sections">
        {doc.sections.map((section) => (
          <details
            key={section.id}
            className="explain-section"
            open={openSection === section.id || section.id === "conclusion"}
            onToggle={(e) => {
              if ((e.target as HTMLDetailsElement).open) setOpenSection(section.id);
            }}
          >
            <summary>
              {section.order}. {section.title}
              <span className="section-count">（{section.items.length}）</span>
            </summary>
            <ul className="explain-list">
              {section.items.map((item, i) => (
                <ExplainRow key={i} item={item} />
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}

function ExplainRow({ item }: { item: ExplainItem }): React.JSX.Element {
  const icon =
    item.kind === "check-pass" ? "✓" : item.kind === "check-fail" ? "✗" : item.kind === "warning" ? "⚠" : item.kind === "error" ? "✗" : null;
  return (
    <li className={`explain-item kind-${item.kind}`}>
      {icon !== null && (
        <span className={`item-icon icon-${item.kind}`} aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{item.text}</span>
    </li>
  );
}
