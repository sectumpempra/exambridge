/**
 * 场景拓扑构建与合法性检查（求解流程第 2-4 步）。
 * 建立 物体—平面—绳—滑轮—杆 拓扑图，检查端点与连接是否合法。
 */
import type {
  MechanicsConnectorV1,
  MechanicsPulleyV1,
  MechanicsSceneV1,
  MechanicsSupportV1,
  MechanicsSurfaceV1,
} from "@/features/mechanics-lab/schema";
import { fromAngleDeg, unit, vec, type Vec2 } from "./vec2.js";

export interface TopologyIssue {
  category: "input-required" | "unsupported";
  ruleId: string;
  message: string;
  /** unsupported 时对应的能力名称 */
  feature?: string;
}

export interface BodyModel {
  id: string;
  label: string;
  mass: number;
  position: Vec2;
  /** 运动路径正方向（单位向量） */
  path: Vec2;
  /** 平面外法线（无平面时为 null） */
  normalDir: Vec2 | null;
  surface: MechanicsSurfaceV1 | null;
  fixedBySupport: MechanicsSupportV1 | null;
  /** 沿路径的初速度（未提供为 0） */
  initialVelocity: number;
}

/** 绳段端点：运动点（物体/动滑轮随动）或固定点（锚点/定滑轮） */
export interface RopeEndpoint {
  /** 驱动该端点运动的物体 id；固定端点为 null */
  movingObjectId: string | null;
  position: Vec2;
  /** 端点描述（用于方程文本） */
  label: string;
}

export interface RopeSegment {
  from: RopeEndpoint;
  to: RopeEndpoint;
}

export interface RopeModel {
  id: string;
  segments: RopeSegment[];
  /** 绳端直接施加的已知拉力（force 端点）；否则张力为未知量 */
  tensionKnown: number | null;
  /** 每个物体端点的绳方向（单位向量，指向绳另一侧，已按路径理想化） */
  objectEnds: { objectId: string; direction: Vec2 }[];
  /** 动滑轮挂载：滑轮 id、挂载物体、两绳段对滑轮的作用方向 */
  movablePulleys: {
    pulleyId: string;
    attachedObjectId: string;
    segmentDirections: Vec2[];
  }[];
  /** 绳经过的滑轮 id（用于"同一根绳张力相等"约束记录） */
  pulleyIds: string[];
  /** 是否全部为物体/锚点端点（可建立绳长约束） */
  constrainable: boolean;
}

export interface RodModel {
  id: string;
  /** 两个端点 */
  endA: { objectId: string | null; position: Vec2; label: string };
  endB: { objectId: string | null; position: Vec2; label: string };
  /** 轴向单位向量（endA → endB） */
  axis: Vec2;
}

export interface SceneModel {
  bodies: BodyModel[];
  ropes: RopeModel[];
  rods: RodModel[];
  issues: TopologyIssue[];
  /** 有粗糙平面但缺少摩擦系数时的提示 */
  missingFrictionInputs: string[];
}

function resolveNodePosition(
  node: MechanicsConnectorV1["nodes"][number],
  scene: MechanicsSceneV1,
): Vec2 | null {
  if (node.type === "object") {
    // schema 已保证引用完整，物体必然存在
    return scene.objects.find((o) => o.id === node.objectId)?.position ?? /* v8 ignore next -- 引用完整性由 schema 保证 */ null;
  }
  if (node.type === "anchor") return node.point;
  if (node.type === "pulley") {
    return scene.pulleys.find((p) => p.id === node.pulleyId)?.position ?? /* v8 ignore next -- 引用完整性由 schema 保证 */ null;
  }
  return null;
}

function isTerminal(
  node: MechanicsConnectorV1["nodes"][number],
): node is { type: "object"; objectId: string } | { type: "anchor"; point: Vec2 } | { type: "force"; magnitude: number } {
  return node.type === "object" || node.type === "anchor" || node.type === "force";
}

/** 构建拓扑模型；schema 校验已通过为前提，本函数做物理拓扑检查 */
export function buildSceneModel(scene: MechanicsSceneV1): SceneModel {
  const issues: TopologyIssue[] = [];
  const missingFrictionInputs: string[] = [];
  const surfaceById = new Map(scene.surfaces.map((s) => [s.id, s]));
  const pulleyById = new Map(scene.pulleys.map((p) => [p.id, p]));
  const supportByObject = new Map(scene.supports.map((s) => [s.objectId, s]));
  const velocityByObject = new Map(scene.initialConditions.map((ic) => [ic.objectId, ic.velocity]));

  // ---- 物体与运动路径（第 4 步：识别自由度） ----
  const bodies: BodyModel[] = scene.objects.map((obj) => {
    const surface = obj.surfaceId !== undefined ? (surfaceById.get(obj.surfaceId) ?? /* v8 ignore next -- 引用完整性由 schema 保证 */ null) : null;
    let path: Vec2;
    let normalDir: Vec2 | null;
    if (surface !== null) {
      path = fromAngleDeg(surface.angleDeg);
      normalDir = vec(-Math.sin((surface.angleDeg * Math.PI) / 180), Math.cos((surface.angleDeg * Math.PI) / 180));
    } else {
      // 悬挂/自由物体：V1 理想化为竖直路径（向上为正）
      path = vec(0, 1);
      normalDir = null;
    }
    if (surface !== null && surface.friction.model === "rough") {
      const needsMuK = scene.analysisMode === "dynamics" || scene.analysisMode === "kinematics";
      if (surface.friction.muS === undefined) {
        missingFrictionInputs.push(`平面 ${surface.id} 为粗糙平面，缺少静摩擦系数 μs`);
      }
      if (needsMuK && surface.friction.muK === undefined) {
        missingFrictionInputs.push(`平面 ${surface.id} 为粗糙平面，动力学分析缺少动摩擦系数 μk`);
      }
    }
    return {
      id: obj.id,
      label: obj.label,
      mass: obj.mass,
      position: obj.position,
      path,
      normalDir,
      surface,
      fixedBySupport: supportByObject.get(obj.id) ?? null,
      initialVelocity: velocityByObject.get(obj.id) ?? 0,
    };
  });

  // ---- 滑轮检查 ----
  for (const pulley of scene.pulleys) {
    if ((pulley.mass ?? 0) > 0) {
      issues.push({
        category: "unsupported",
        ruleId: "massive-pulley",
        message: `滑轮 ${pulley.id} 质量为 ${pulley.mass} kg，第一版仅支持理想（无质量）滑轮`,
        feature: "有质量滑轮",
      });
    }
  }

  // ---- 连接（绳/杆） ----
  const ropes: RopeModel[] = [];
  const rods: RodModel[] = [];

  for (const conn of scene.connectors) {
    if (conn.kind === "spring") {
      issues.push({
        category: "unsupported",
        ruleId: "spring-connector",
        message: `连接 ${conn.id} 为弹簧，第一版不支持`,
        feature: "弹簧",
      });
      continue;
    }
    if (conn.kind === "rod") {
      buildRod(conn, scene, rods, issues);
      continue;
    }
    buildRope(conn, scene, pulleyById, ropes, issues);
  }

  return { bodies, ropes, rods, issues, missingFrictionInputs };
}

function buildRod(
  conn: MechanicsConnectorV1,
  scene: MechanicsSceneV1,
  rods: RodModel[],
  issues: TopologyIssue[],
): void {
  if (conn.nodes.length !== 2) {
    issues.push({
      category: "input-required",
      ruleId: "rod-node-count",
      message: `轻杆 ${conn.id} 需要恰好两个端点，当前 ${conn.nodes.length} 个`,
    });
    return;
  }
  const [na, nb] = conn.nodes;
  if (na === undefined || nb === undefined || !isTerminal(na) || !isTerminal(nb) || na.type === "force" || nb.type === "force") {
    issues.push({
      category: "input-required",
      ruleId: "rod-endpoint-kind",
      message: `轻杆 ${conn.id} 的端点必须是物体或固定锚点`,
    });
    return;
  }
  const pa = resolveNodePosition(na, scene);
  const pb = resolveNodePosition(nb, scene);
  if (pa === null || pb === null || (pa.x === pb.x && pa.y === pb.y)) {
    issues.push({
      category: "input-required",
      ruleId: "rod-geometry",
      message: `轻杆 ${conn.id} 的两个端点位置重合或无法解析`,
    });
    return;
  }
  rods.push({
    id: conn.id,
    endA: {
      objectId: na.type === "object" ? na.objectId : null,
      position: pa,
      label: na.type === "object" ? `物体 ${na.objectId}` : "锚点",
    },
    endB: {
      objectId: nb.type === "object" ? nb.objectId : null,
      position: pb,
      label: nb.type === "object" ? `物体 ${nb.objectId}` : "锚点",
    },
    axis: unit({ x: pb.x - pa.x, y: pb.y - pa.y }),
  });
}

function buildRope(
  conn: MechanicsConnectorV1,
  scene: MechanicsSceneV1,
  pulleyById: Map<string, MechanicsPulleyV1>,
  ropes: RopeModel[],
  issues: TopologyIssue[],
): void {
  if (conn.nodes.length < 2) {
    issues.push({
      category: "input-required",
      ruleId: "rope-endpoints",
      message: `绳 ${conn.id} 需要两个端点，当前不足（绳可能已断开）`,
    });
    return;
  }
  if (conn.nodes.some((n) => n.type === "loose")) {
    issues.push({
      category: "input-required",
      ruleId: "rope-loose-end",
      message: `绳 ${conn.id} 存在未连接的端点（绳已断开，请重新连接）`,
    });
    return;
  }
  const first = conn.nodes[0];
  const last = conn.nodes[conn.nodes.length - 1];
  if (first === undefined || last === undefined || !isTerminal(first) || !isTerminal(last)) {
    issues.push({
      category: "input-required",
      ruleId: "rope-terminal-pulley",
      message: `绳 ${conn.id} 的端点不能是滑轮（非法滑轮连接），端点必须是物体、锚点或拉力端`,
    });
    return;
  }
  const middle = conn.nodes.slice(1, -1);
  if (middle.some((n) => n.type !== "pulley")) {
    issues.push({
      category: "input-required",
      ruleId: "rope-middle-kind",
      message: `绳 ${conn.id} 的中间节点必须是滑轮`,
    });
    return;
  }
  if (!conn.nodes.some((n) => n.type === "object")) {
    issues.push({
      category: "input-required",
      ruleId: "rope-no-object",
      message: `绳 ${conn.id} 未连接任何物体`,
    });
    return;
  }

  const pulleys = middle
    .map((n) => (n.type === "pulley" ? (pulleyById.get(n.pulleyId) ?? /* v8 ignore next -- 引用完整性由 schema 保证 */ null) : /* v8 ignore next -- 中间节点已校验为滑轮 */ null))
    .filter((p): p is MechanicsPulleyV1 => p !== null);
  const movable = pulleys.filter((p) => p.kind === "movable");
  if (movable.length > 1) {
    issues.push({
      category: "unsupported",
      ruleId: "complex-pulley-train",
      message: `绳 ${conn.id} 经过 ${movable.length} 个动滑轮，第一版仅支持简单动滑轮`,
      feature: "复杂连续滑轮组",
    });
    return;
  }
  for (const mp of movable) {
    if (mp.attachedObjectId === undefined) {
      issues.push({
        category: "input-required",
        ruleId: "movable-pulley-no-load",
        message: `动滑轮 ${mp.id} 未挂载物体`,
      });
      return;
    }
  }
  // 拉力端（force）缺乏几何方向，无法正确建立动滑轮两绳段模型 → V1 显式拒绝
  if (movable.length > 0 && (first.type === "force" || last.type === "force")) {
    issues.push({
      category: "input-required",
      ruleId: "rope-force-movable",
      message: `绳 ${conn.id} 的拉力端经过动滑轮，V1 无法确定拉力方向，请改用锚点或悬挂物体`,
    });
    return;
  }

  // 解析端点与绳段
  const endpointOf = (node: MechanicsConnectorV1["nodes"][number]): RopeEndpoint | null => {
    const pos = resolveNodePosition(node, scene);
    if (pos === null) return null;
    if (node.type === "object") {
      return { movingObjectId: node.objectId, position: pos, label: `物体 ${node.objectId}` };
    }
    if (node.type === "pulley") {
      const pulley = pulleyById.get(node.pulleyId);
      /* v8 ignore next -- 引用完整性由 schema 保证 */
      if (pulley === undefined) return null;
      if (pulley.kind === "movable" && pulley.attachedObjectId !== undefined) {
        return {
          movingObjectId: pulley.attachedObjectId,
          position: pos,
          label: `动滑轮 ${pulley.id}`,
        };
      }
      return { movingObjectId: null, position: pos, label: `定滑轮 ${pulley.id}` };
    }
    if (node.type === "anchor") return { movingObjectId: null, position: pos, label: "锚点" };
    return null; // force 端点不作为几何端点参与约束
  };

  // force 端点不作为几何端点（endpointOf 返回 null）；中间节点含 force 已在前面被
  // "rope-middle-kind" 拦截，此处 force 只可能位于终端。
  const endpoints: (RopeEndpoint | null)[] = conn.nodes.map(endpointOf);

  // 建立绳段（相邻节点）
  const segments: RopeSegment[] = [];
  for (let i = 0; i + 1 < conn.nodes.length; i++) {
    const a = endpoints[i];
    const b = endpoints[i + 1];
    if (a == null || b == null) continue; // force 端点无几何端点
    segments.push({ from: a, to: b });
  }

  // 物体端点绳方向：指向最近的可解析几何节点（跳过 force 端点），并按路径理想化
  const nearestEndpoint = (fromIndex: number, step: 1 | -1): RopeEndpoint | null => {
    for (let i = fromIndex + step; i >= 0 && i < endpoints.length; i += step) {
      const e = endpoints[i];
      if (e !== null && e !== undefined) return e;
    }
    return null;
  };
  const objectEnds: { objectId: string; direction: Vec2 }[] = [];
  if (first.type === "object") {
    const next = nearestEndpoint(0, 1);
    const objPos = scene.objects.find((o) => o.id === first.objectId)?.position;
    if (objPos !== undefined) {
      if (next === null) {
        issues.push({
          category: "input-required",
          ruleId: "rope-direction-undefined",
          message: `绳 ${conn.id} 的拉力端缺少滑轮或锚点，无法确定绳方向`,
        });
        return;
      }
      objectEnds.push({
        objectId: first.objectId,
        direction: unit({ x: next.position.x - objPos.x, y: next.position.y - objPos.y }),
      });
    }
  }
  if (last.type === "object" && conn.nodes.length >= 2) {
    const prev = nearestEndpoint(conn.nodes.length - 1, -1);
    const objPos = scene.objects.find((o) => o.id === last.objectId)?.position;
    if (prev !== null && objPos !== undefined) {
      objectEnds.push({
        objectId: last.objectId,
        direction: unit({ x: prev.position.x - objPos.x, y: prev.position.y - objPos.y }),
      });
    }
  }

  // 动滑轮两绳段方向（几何方向）
  const movableModels: RopeModel["movablePulleys"] = [];
  for (const mp of movable) {
    const idx = conn.nodes.findIndex((n) => n.type === "pulley" && n.pulleyId === mp.id);
    const dirs: Vec2[] = [];
    const prev = endpoints[idx - 1];
    const next = endpoints[idx + 1];
    if (prev !== null && prev !== undefined) {
      dirs.push(unit({ x: prev.position.x - mp.position.x, y: prev.position.y - mp.position.y }));
    }
    if (next !== null && next !== undefined) {
      dirs.push(unit({ x: next.position.x - mp.position.x, y: next.position.y - mp.position.y }));
    }
    if (mp.attachedObjectId !== undefined) {
      movableModels.push({ pulleyId: mp.id, attachedObjectId: mp.attachedObjectId, segmentDirections: dirs });
    }
  }

  const tensionKnown =
    (first.type === "force" ? first.magnitude : null) ?? (last.type === "force" ? last.magnitude : null);

  ropes.push({
    id: conn.id,
    segments,
    tensionKnown,
    objectEnds,
    movablePulleys: movableModels,
    pulleyIds: pulleys.map((p) => p.id),
    constrainable: first.type !== "force" && last.type !== "force",
  });
}
