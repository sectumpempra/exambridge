/**
 * mechanics-explain — 把 MechanicsSolutionV1 转换为中文教学步骤文档。
 *
 * 严格规则：
 * - 绝不重新求解、绝不修改 core 的数值；只做格式化与文案组织；
 * - 结果面板顺序固定为规格书第九节 1-11：
 *   1 直接结论 → 2 使用的物理假设 → 3 每个物体的受力 → 4 正方向 →
 *   5 约束关系 → 6 方程 → 7 代入过程 → 8 求解结果 → 9 单位 →
 *   10 有效性检查 → 11 不支持或仍需输入的信息。
 */
import {
  UI_COPY_V1,
  type MechanicsEquationV1,
  type MechanicsSolutionV1,
  type SolvedValueV1,
} from "@/features/mechanics-lab/schema";

export interface ExplainItem {
  /** 文本条目；force/equation/value/check 供 UI 加样式 */
  kind: "text" | "force" | "equation" | "value" | "check-pass" | "check-fail" | "warning" | "error";
  text: string;
}

export interface ExplainSection {
  /** 1-11，对应规格书第九节顺序 */
  order: number;
  id:
    | "conclusion"
    | "assumptions"
    | "forces"
    | "positive-directions"
    | "constraints"
    | "equations"
    | "substitution"
    | "results"
    | "units"
    | "validation"
    | "unsupported-or-required";
  title: string;
  items: ExplainItem[];
}

export interface ExplanationDocument {
  status: MechanicsSolutionV1["status"];
  statusLabel: string;
  statusReason: string;
  sections: ExplainSection[];
}

const FORCE_KIND_LABEL: Record<string, string> = {
  gravity: "重力",
  normal: "支持力",
  "static-friction": "静摩擦力",
  "kinetic-friction": "滑动摩擦力",
  tension: "绳张力",
  rod: "轻杆作用力",
  applied: "外力",
  "support-reaction": "支点反力",
};

function displayNum(v: number): string {
  const r = Math.abs(v) < 1e-9 ? 0 : v;
  const s = r.toFixed(6);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

const fmt = displayNum;

function formatValue(value: SolvedValueV1): string {
  return `${value.symbol} = ${value.display} ${value.unit}（${value.meaning}）`;
}

/** 代入过程：把方程各项系数与解出的数值代入，形成可读的代入文本 */
export function substituteEquation(
  equation: MechanicsEquationV1,
  values: ReadonlyMap<string, number>,
): string | null {
  if (equation.terms.length === 0) return null;
  const parts: string[] = [];
  for (const t of equation.terms) {
    const v = values.get(t.symbol);
    if (v === undefined) return null; // 有未知量未解出，不做代入展示
    parts.push(`(${fmt(t.coefficient)})×(${fmt(v)})`);
  }
  const sum = equation.terms.reduce((s, t) => s + t.coefficient * (values.get(t.symbol) ?? 0), 0);
  const residual = Math.abs(sum - equation.constant);
  const ok = residual <= 1e-6;
  return `${parts.join(" + ")} = ${fmt(sum)}（应等于 ${fmt(equation.constant)}，${ok ? "验证通过" : `残差 ${residual.toExponential(2)}`}）`;
}

/** 主入口：生成教学解释文档 */
export function explainSolution(solution: MechanicsSolutionV1): ExplanationDocument {
  const valuesMap = new Map(solution.values.map((v) => [v.symbol, v.value]));

  // 1. 直接结论
  const conclusion: ExplainItem[] = [
    {
      kind: solution.status === "solved" || solution.status === "overdetermined-consistent" ? "check-pass" : solution.status === "underdetermined" || solution.status === "input-required" ? "warning" : "error",
      text: `${UI_COPY_V1.statusLabels[solution.status]}：${solution.statusReason}`,
    },
  ];
  if (solution.values.length > 0) {
    conclusion.push({
      kind: "text",
      text: `关键结果：${solution.values.slice(0, 4).map(formatValue).join("；")}${solution.values.length > 4 ? ` 等 ${solution.values.length} 项` : ""}`,
    });
  }

  // 2. 物理假设
  const assumptions: ExplainItem[] = solution.assumptions.map((a) => ({ kind: "text", text: a.text }));

  // 3. 每个物体的受力
  const forces: ExplainItem[] = [];
  for (const fbd of solution.freeBodyDiagrams) {
    const list = fbd.forceIds
      .map((id) => solution.forces.find((f) => f.forceId === id))
      .filter((f): f is NonNullable<typeof f> => f !== undefined);
    forces.push({ kind: "text", text: `${fbd.objectLabel}（${fbd.objectId}）共 ${list.length} 个力：` });
    for (const f of list) {
      const mag = f.magnitude === null ? "未知" : `${displayNum(f.magnitude)} ${f.unit}`;
      forces.push({
        kind: "force",
        text: `${FORCE_KIND_LABEL[f.kind] ?? f.kind} ${f.symbol}：大小 ${mag}，方向 (${f.direction.x.toFixed(3)}, ${f.direction.y.toFixed(3)})，来源 ${f.source}${f.note !== undefined ? `，${f.note}` : ""}`,
      });
    }
  }

  // 4. 正方向
  const directions: ExplainItem[] = solution.directionReports.map((d) => ({
    kind: d.oppositeToAssumption || d.decelerating ? "warning" : "text",
    text: `物体 ${d.objectId}：假定正方向 (${d.assumedPositiveDirection.x.toFixed(3)}, ${d.assumedPositiveDirection.y.toFixed(3)})。${d.note}`,
  }));
  for (const cs of solution.coordinateSystems) {
    if (cs.kind === "along-surface") {
      directions.push({
        kind: "text",
        text: `局部坐标系：${cs.description}（x′=(${cs.xAxis.x.toFixed(3)}, ${cs.xAxis.y.toFixed(3)})，y′=(${cs.yAxis.x.toFixed(3)}, ${cs.yAxis.y.toFixed(3)})）`,
      });
    }
  }

  // 5. 约束关系
  const constraints: ExplainItem[] = solution.constraints.map((c) => ({
    kind: c.satisfied ? "check-pass" : "check-fail",
    text: `${c.expression} — ${c.satisfied ? "满足" : "不满足"}。${c.detail}`,
  }));

  // 6. 方程
  const equations: ExplainItem[] = solution.equations.map((e) => ({
    kind: "equation",
    text: `${e.description}：${e.symbolic}`,
  }));

  // 7. 代入过程
  const substitution: ExplainItem[] = [];
  for (const e of solution.equations) {
    const text = substituteEquation(e, valuesMap);
    if (text !== null) substitution.push({ kind: "equation", text: `${e.description}：${text}` });
  }
  if (substitution.length === 0 && solution.equations.length > 0) {
    substitution.push({ kind: "text", text: "存在未解出的未知量，无法完整代入（见状态分类）。" });
  }

  // 8. 求解结果
  const results: ExplainItem[] = solution.values.map((v) => ({ kind: "value", text: formatValue(v) }));

  // 9. 单位
  const units: ExplainItem[] = [
    { kind: "text", text: "全部结果均为 SI 单位：力 N，质量 kg，加速度 m/s²，速度 m/s，长度 m，时间 s；角度输入为度，内部计算为弧度。" },
  ];

  // 10. 有效性检查
  const validation: ExplainItem[] = solution.validation.map((v) => ({
    kind: v.passed ? "check-pass" : v.severity === "error" ? "check-fail" : "warning",
    text: `[${v.ruleId}] ${v.message}`,
  }));

  // 11. 不支持或仍需输入
  const unsupported: ExplainItem[] = [];
  for (const f of solution.unsupportedFeatures) {
    unsupported.push({ kind: "error", text: `${UI_COPY_V1.unsupportedTitle}：${f}。${UI_COPY_V1.unsupportedHint}` });
  }
  for (const r of solution.requiredInputs) {
    unsupported.push({ kind: "warning", text: `仍需输入：${r}` });
  }
  if (unsupported.length === 0) {
    unsupported.push({ kind: "text", text: "无。" });
  }

  return {
    status: solution.status,
    statusLabel: UI_COPY_V1.statusLabels[solution.status],
    statusReason: solution.statusReason,
    sections: [
      { order: 1, id: "conclusion", title: "直接结论", items: conclusion },
      { order: 2, id: "assumptions", title: "使用的物理假设", items: assumptions },
      { order: 3, id: "forces", title: "每个物体的受力", items: forces },
      { order: 4, id: "positive-directions", title: "正方向", items: directions },
      { order: 5, id: "constraints", title: "约束关系", items: constraints },
      { order: 6, id: "equations", title: "方程", items: equations },
      { order: 7, id: "substitution", title: "代入过程", items: substitution },
      { order: 8, id: "results", title: "求解结果", items: results },
      { order: 9, id: "units", title: "单位", items: units },
      { order: 10, id: "validation", title: "有效性检查", items: validation },
      { order: 11, id: "unsupported-or-required", title: "不支持或仍需输入的信息", items: unsupported },
    ],
  };
}

export { displayNum };
