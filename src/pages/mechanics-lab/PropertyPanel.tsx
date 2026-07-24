/** 右侧属性面板：编辑场景级与所选实体的物理属性（不写视觉属性到物理模型） */
import type {
  AnalysisModeV1,
  MechanicsSceneV1,
} from "@/features/mechanics-lab/schema";
import type { EditorAction } from "@/features/mechanics-lab/svg";

export interface PropertyPanelProps {
  scene: MechanicsSceneV1;
  selection: string[];
  dispatch: (action: EditorAction) => void;
}

const MODES: { value: AnalysisModeV1; label: string }[] = [
  { value: "equilibrium", label: "静力平衡" },
  { value: "limiting-equilibrium", label: "临界平衡" },
  { value: "dynamics", label: "动力学" },
  { value: "kinematics", label: "运动学（恒加速度）" },
];

export function PropertyPanel({ scene, selection, dispatch }: PropertyPanelProps): React.JSX.Element {
  const update = (mutate: (s: MechanicsSceneV1) => MechanicsSceneV1): void => {
    dispatch({ type: "update-scene", mutate });
  };
  const selected = selection[0];

  const num = (v: string, fallback = 0): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <aside className="props" aria-label="属性面板">
      <h2>场景属性</h2>
      <label>
        标题
        <input
          value={scene.title}
          onChange={(e) => update((s) => ({ ...s, title: e.target.value }))}
        />
      </label>
      <label>
        重力加速度 g（m/s²）
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={scene.gravity}
          onChange={(e) => update((s) => ({ ...s, gravity: Math.max(0.01, num(e.target.value, 10)) }))}
        />
      </label>
      <label>
        分析模式
        <select
          value={scene.analysisMode}
          onChange={(e) => update((s) => ({ ...s, analysisMode: e.target.value as AnalysisModeV1 }))}
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <h2>所选实体</h2>
      {selected === undefined && <p className="props-empty">未选择实体。点击画布中的物体、平面、滑轮、连接或外力进行编辑。</p>}
      {renderEntityProps(scene, selected, update, num)}
    </aside>
  );
}

function renderEntityProps(
  scene: MechanicsSceneV1,
  selected: string | undefined,
  update: (m: (s: MechanicsSceneV1) => MechanicsSceneV1) => void,
  num: (v: string, fb?: number) => number,
): React.JSX.Element | null {
  if (selected === undefined) return null;

  const obj = scene.objects.find((o) => o.id === selected);
  if (obj !== undefined) {
    const ic = scene.initialConditions.find((i) => i.objectId === obj.id);
    return (
      <fieldset>
        <legend>物体 {obj.id}</legend>
        <label>
          名称
          <input value={obj.label} onChange={(e) => update((s) => ({ ...s, objects: s.objects.map((o) => (o.id === obj.id ? { ...o, label: e.target.value } : o)) }))} />
        </label>
        <label>
          质量（kg）
          <input type="number" step="0.1" min="0.01" value={obj.mass} onChange={(e) => update((s) => ({ ...s, objects: s.objects.map((o) => (o.id === obj.id ? { ...o, mass: Math.max(0.01, num(e.target.value, 2)) } : o)) }))} />
        </label>
        <label>
          初始位置 x（m）
          <input type="number" step="0.1" value={obj.position.x} onChange={(e) => update((s) => ({ ...s, objects: s.objects.map((o) => (o.id === obj.id ? { ...o, position: { ...o.position, x: num(e.target.value) } } : o)) }))} />
        </label>
        <label>
          初始位置 y（m）
          <input type="number" step="0.1" value={obj.position.y} onChange={(e) => update((s) => ({ ...s, objects: s.objects.map((o) => (o.id === obj.id ? { ...o, position: { ...o.position, y: num(e.target.value) } } : o)) }))} />
        </label>
        <label>
          所在平面
          <select
            value={obj.surfaceId ?? ""}
            onChange={(e) =>
              update((s) => ({
                ...s,
                objects: s.objects.map((o) => (o.id === obj.id ? { ...o, surfaceId: e.target.value === "" ? undefined : e.target.value } : o)),
              }))
            }
          >
            <option value="">无（悬挂/自由）</option>
            {scene.surfaces.map((su) => (
              <option key={su.id} value={su.id}>
                {su.id}（{su.kind === "horizontal" ? "水平面" : `斜面 ${su.angleDeg}°`}）
              </option>
            ))}
          </select>
        </label>
        <label>
          初速度（m/s，沿路径）
          <input
            type="number"
            step="0.1"
            value={ic?.velocity ?? 0}
            onChange={(e) => {
              const v = num(e.target.value);
              update((s) => ({
                ...s,
                initialConditions: [...s.initialConditions.filter((i) => i.objectId !== obj.id), { objectId: obj.id, velocity: v }],
              }));
            }}
          />
        </label>
      </fieldset>
    );
  }

  const surf = scene.surfaces.find((o) => o.id === selected);
  if (surf !== undefined) {
    return (
      <fieldset>
        <legend>{surf.kind === "horizontal" ? "水平面" : "斜面"} {surf.id}</legend>
        <label>
          平面角度（°）
          <input
            type="number"
            step="1"
            min={surf.kind === "horizontal" ? 0 : -90}
            max="90"
            value={surf.angleDeg}
            onChange={(e) =>
              update((s) => ({
                ...s,
                surfaces: s.surfaces.map((x) => (x.id === surf.id ? { ...x, angleDeg: x.kind === "horizontal" ? 0 : num(e.target.value) } : x)),
              }))
            }
            disabled={surf.kind === "horizontal"}
          />
        </label>
        <label>
          摩擦模型
          <select
            value={surf.friction.model}
            onChange={(e) =>
              update((s) => ({
                ...s,
                surfaces: s.surfaces.map((x) =>
                  x.id === surf.id
                    ? { ...x, friction: e.target.value === "smooth" ? { model: "smooth" } : { model: "rough", muS: 0.4, muK: 0.3 } }
                    : x,
                ),
              }))
            }
          >
            <option value="smooth">光滑</option>
            <option value="rough">粗糙</option>
          </select>
        </label>
        {surf.friction.model === "rough" && (
          <>
            <label>
              静摩擦系数 μs
              <input
                type="number"
                step="0.05"
                min="0"
                value={surf.friction.muS ?? 0}
                onChange={(e) =>
                  update((s) => ({
                    ...s,
                    surfaces: s.surfaces.map((x) => (x.id === surf.id && x.friction.model === "rough" ? { ...x, friction: { ...x.friction, muS: Math.max(0, num(e.target.value)) } } : x)),
                  }))
                }
              />
            </label>
            <label>
              动摩擦系数 μk
              <input
                type="number"
                step="0.05"
                min="0"
                value={surf.friction.muK ?? 0}
                onChange={(e) =>
                  update((s) => ({
                    ...s,
                    surfaces: s.surfaces.map((x) => (x.id === surf.id && x.friction.model === "rough" ? { ...x, friction: { ...x.friction, muK: Math.max(0, num(e.target.value)) } } : x)),
                  }))
                }
              />
            </label>
          </>
        )}
      </fieldset>
    );
  }

  const pulley = scene.pulleys.find((o) => o.id === selected);
  if (pulley !== undefined) {
    return (
      <fieldset>
        <legend>{pulley.kind === "movable" ? "动滑轮" : "固定滑轮"} {pulley.id}</legend>
        <label>
          位置 x（m）
          <input type="number" step="0.1" value={pulley.position.x} onChange={(e) => update((s) => ({ ...s, pulleys: s.pulleys.map((p) => (p.id === pulley.id ? { ...p, position: { ...p.position, x: num(e.target.value) } } : p)) }))} />
        </label>
        <label>
          位置 y（m）
          <input type="number" step="0.1" value={pulley.position.y} onChange={(e) => update((s) => ({ ...s, pulleys: s.pulleys.map((p) => (p.id === pulley.id ? { ...p, position: { ...p.position, y: num(e.target.value) } } : p)) }))} />
        </label>
        {pulley.kind === "movable" && (
          <label>
            挂载物体
            <select
              value={pulley.attachedObjectId ?? ""}
              onChange={(e) =>
                update((s) => ({
                  ...s,
                  pulleys: s.pulleys.map((p) => (p.id === pulley.id ? { ...p, attachedObjectId: e.target.value === "" ? undefined : e.target.value } : p)),
                }))
              }
            >
              <option value="">未挂载</option>
              {scene.objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}（{o.id}）
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          滑轮质量（kg，&gt;0 为不支持能力）
          <input type="number" step="0.1" min="0" value={pulley.mass ?? 0} onChange={(e) => update((s) => ({ ...s, pulleys: s.pulleys.map((p) => (p.id === pulley.id ? { ...p, mass: Math.max(0, num(e.target.value)) } : p)) }))} />
        </label>
      </fieldset>
    );
  }

  const force = scene.externalForces.find((o) => o.id === selected);
  if (force !== undefined) {
    return (
      <fieldset>
        <legend>外力 {force.id}</legend>
        <label>
          标签
          <input value={force.label ?? ""} onChange={(e) => update((s) => ({ ...s, externalForces: s.externalForces.map((f) => (f.id === force.id ? { ...f, label: e.target.value } : f)) }))} />
        </label>
        <label>
          大小（N）
          <input type="number" step="0.5" min="0" value={force.magnitude} onChange={(e) => update((s) => ({ ...s, externalForces: s.externalForces.map((f) => (f.id === force.id ? { ...f, magnitude: Math.max(0, num(e.target.value)) } : f)) }))} />
        </label>
        <label>
          方向（°，自 +x 逆时针）
          <input type="number" step="5" value={force.angleDeg} onChange={(e) => update((s) => ({ ...s, externalForces: s.externalForces.map((f) => (f.id === force.id ? { ...f, angleDeg: num(e.target.value) } : f)) }))} />
        </label>
        <p className="props-note">作用于 {force.objectId}</p>
      </fieldset>
    );
  }

  const conn = scene.connectors.find((o) => o.id === selected);
  if (conn !== undefined) {
    return (
      <fieldset>
        <legend>{conn.kind === "rod" ? "轻杆" : "绳"} {conn.id}</legend>
        <p className="props-note">
          {conn.nodes.length} 个节点：
          {conn.nodes
            .map((n) => (n.type === "object" ? `物体 ${n.objectId}` : n.type === "pulley" ? `滑轮 ${n.pulleyId}` : n.type === "anchor" ? "锚点" : n.type === "force" ? `拉力 ${n.magnitude}N` : "悬空"))
            .join(" → ")}
        </p>
        <p className="props-note">重建连接请删除后使用工具栏的绳/杆工具。</p>
      </fieldset>
    );
  }

  const support = scene.supports.find((o) => o.id === selected);
  if (support !== undefined) {
    return (
      <fieldset>
        <legend>固定支点 {support.id}</legend>
        <p className="props-note">固定物体 {support.objectId} 的位置，并提供支点反力。</p>
      </fieldset>
    );
  }

  return null;
}
