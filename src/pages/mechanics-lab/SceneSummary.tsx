/**
 * 场景结构化文本摘要（规格书第十三节）：为读屏用户提供画布之外的完整等价信息。
 */
import type { MechanicsSceneV1 } from "@/features/mechanics-lab/schema";

export function SceneSummary({ scene }: { scene: MechanicsSceneV1 }): React.JSX.Element {
  return (
    <details className="scene-summary">
      <summary>场景文本摘要（读屏等价内容）：{scene.title}</summary>
      <ul>
        <li>
          分析模式：{scene.analysisMode}；重力加速度 g = {scene.gravity} m/s²。
        </li>
        <li>
          物体（{scene.objects.length}）：
          {scene.objects.length === 0
            ? "无"
            : scene.objects
                .map((o) => `${o.label}（${o.id}，质量 ${o.mass} kg，位置 (${o.position.x}, ${o.position.y}) m${o.surfaceId !== undefined ? `，在平面 ${o.surfaceId} 上` : "，悬挂/自由"}）`)
                .join("；")}
        </li>
        <li>
          平面（{scene.surfaces.length}）：
          {scene.surfaces.length === 0
            ? "无"
            : scene.surfaces
                .map((s) => `${s.id}（${s.kind === "horizontal" ? "水平面" : `斜面 ${s.angleDeg}°`}，${s.friction.model === "smooth" ? "光滑" : `粗糙 μs=${s.friction.muS ?? "?"} μk=${s.friction.muK ?? "?"}`}）`)
                .join("；")}
        </li>
        <li>
          支点（{scene.supports.length}）：
          {scene.supports.length === 0 ? "无" : scene.supports.map((s) => `${s.id}（固定 ${s.objectId}）`).join("；")}
        </li>
        <li>
          滑轮（{scene.pulleys.length}）：
          {scene.pulleys.length === 0
            ? "无"
            : scene.pulleys
                .map((p) => `${p.id}（${p.kind === "movable" ? `动滑轮，挂载 ${p.attachedObjectId ?? "无"}` : "定滑轮"}，位置 (${p.position.x}, ${p.position.y}) m）`)
                .join("；")}
        </li>
        <li>
          连接（{scene.connectors.length}）：
          {scene.connectors.length === 0
            ? "无"
            : scene.connectors
                .map(
                  (c) =>
                    `${c.id}（${c.kind === "rod" ? "轻杆" : c.kind === "spring" ? "弹簧" : "绳"}：${c.nodes
                      .map((n) => (n.type === "object" ? n.objectId : n.type === "pulley" ? n.pulleyId : n.type === "anchor" ? "锚点" : n.type === "force" ? `拉力${n.magnitude}N` : "悬空"))
                      .join(" → ")}）`,
                )
                .join("；")}
        </li>
        <li>
          外力（{scene.externalForces.length}）：
          {scene.externalForces.length === 0
            ? "无"
            : scene.externalForces.map((f) => `${f.id}（作用于 ${f.objectId}，${f.magnitude} N，方向 ${f.angleDeg}°）`).join("；")}
        </li>
        <li>
          初始条件（{scene.initialConditions.length}）：
          {scene.initialConditions.length === 0 ? "无（默认静止）" : scene.initialConditions.map((i) => `${i.objectId}：v0 = ${i.velocity} m/s`).join("；")}
        </li>
      </ul>
    </details>
  );
}
