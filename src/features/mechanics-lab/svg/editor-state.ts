/**
 * 编辑器状态机（纯 reducer，无 React 依赖，可直接单测）。
 * 物理属性与视觉属性分离；撤销/重做以场景快照实现；拖拽用 coalesce 键合并历史。
 */
import {
  SCHEMA_VERSION_V1,
  type AppliedForceV1,
  type ConnectorNodeV1,
  type MechanicsConnectorV1,
  type MechanicsObjectV1,
  type MechanicsPulleyV1,
  type MechanicsSceneV1,
  type MechanicsSurfaceV1,
  type MechanicsSupportV1,
  type Vec2V1,
} from "@/features/mechanics-lab/schema";

export type EditorTool =
  | "select"
  | "add-object"
  | "add-horizontal-surface"
  | "add-inclined-surface"
  | "add-support"
  | "add-fixed-pulley"
  | "add-movable-pulley"
  | "add-rope"
  | "add-rod"
  | "add-force"
  | "delete";

export interface EditorState {
  scene: MechanicsSceneV1;
  selection: string[];
  tool: EditorTool;
  past: MechanicsSceneV1[];
  future: MechanicsSceneV1[];
  /** 连接模式：绳/杆已选择的节点 */
  pendingNodes: ConnectorNodeV1[];
  connectingKind: "rope" | "rod" | null;
  /** 场景内唯一 id 计数器（稳定 id：字母开头） */
  idCounter: number;
  /** 最后一次历史合并键（拖拽连续修改合并为一步） */
  lastCoalesceKey: string | null;
}

export function createEmptyScene(): MechanicsSceneV1 {
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    sceneId: "scene-editor",
    title: "未命名场景",
    gravity: 10,
    analysisMode: "equilibrium",
    objects: [],
    surfaces: [],
    supports: [],
    pulleys: [],
    connectors: [],
    externalForces: [],
    initialConditions: [],
  };
}

export function createEditorState(scene?: MechanicsSceneV1): EditorState {
  return {
    scene: scene ?? createEmptyScene(),
    selection: [],
    tool: "select",
    past: [],
    future: [],
    pendingNodes: [],
    connectingKind: null,
    idCounter: 1,
    lastCoalesceKey: null,
  };
}

export type AddEntityKind =
  | "object"
  | "horizontal-surface"
  | "inclined-surface"
  | "fixed-pulley"
  | "movable-pulley";

export type EditorAction =
  | { type: "set-tool"; tool: EditorTool }
  | { type: "select"; ids: string[]; additive?: boolean }
  | { type: "clear-selection" }
  | { type: "replace-scene"; scene: MechanicsSceneV1 }
  | { type: "update-scene"; mutate: (scene: MechanicsSceneV1) => MechanicsSceneV1; coalesceKey?: string }
  | { type: "add-entity"; kind: AddEntityKind; at: Vec2V1 }
  | { type: "add-support-to"; objectId: string }
  | { type: "add-force-to"; objectId: string }
  | { type: "delete-selection" }
  | { type: "delete-entity"; id: string }
  | { type: "duplicate-selection" }
  | { type: "move-entities"; ids: string[]; delta: Vec2V1; coalesceKey?: string }
  | { type: "begin-connection"; kind: "rope" | "rod" }
  | { type: "add-connection-node"; node: ConnectorNodeV1 }
  | { type: "finish-connection" }
  | { type: "cancel-connection" }
  | { type: "undo" }
  | { type: "redo" };

const ID_PREFIX: Record<string, string> = {
  object: "m-obj",
  surface: "surf",
  pulley: "pul",
  rope: "rope",
  rod: "rod",
  force: "force",
  support: "sup",
};

function nextId(state: EditorState, kind: string): string {
  return `${ID_PREFIX[kind] ?? "ent"}-${state.idCounter}`;
}

function pushHistory(state: EditorState, scene: MechanicsSceneV1, coalesceKey?: string): EditorState {
  if (coalesceKey !== undefined && coalesceKey === state.lastCoalesceKey) {
    return { ...state, scene };
  }
  return {
    ...state,
    scene,
    past: [...state.past, state.scene],
    future: [],
    lastCoalesceKey: coalesceKey ?? null,
  };
}

/** 删除实体及其全部引用（连接、外力、支点、初始条件、物体-平面引用） */
export function removeEntity(scene: MechanicsSceneV1, id: string): MechanicsSceneV1 {
  const removedObjectOrPulley =
    scene.objects.some((o) => o.id === id) || scene.pulleys.some((p) => p.id === id);
  return {
    ...scene,
    objects: scene.objects.filter((o) => o.id !== id).map((o) => (o.surfaceId === id ? { ...o, surfaceId: undefined } : o)),
    surfaces: scene.surfaces.filter((s) => s.id !== id),
    supports: scene.supports.filter((s) => s.id !== id && s.objectId !== id),
    pulleys: scene.pulleys.filter((p) => p.id !== id).map((p) => (p.attachedObjectId === id ? { ...p, attachedObjectId: undefined } : p)),
    connectors: removedObjectOrPulley
      ? scene.connectors
          .filter((c) => c.id !== id)
          .filter(
            (c) =>
              !c.nodes.some(
                (n) =>
                  (n.type === "object" && n.objectId === id) ||
                  (n.type === "pulley" && n.pulleyId === id),
              ),
          )
      : scene.connectors.filter((c) => c.id !== id),
    externalForces: scene.externalForces.filter((f) => f.id !== id && f.objectId !== id),
    initialConditions: scene.initialConditions.filter((ic) => ic.objectId !== id),
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "set-tool": {
      return {
        ...state,
        tool: action.tool,
        pendingNodes: [],
        connectingKind: action.tool === "add-rope" ? "rope" : action.tool === "add-rod" ? "rod" : null,
      };
    }
    case "select": {
      const ids = action.ids;
      if (action.additive === true) {
        const set = new Set(state.selection);
        for (const id of ids) {
          if (set.has(id)) set.delete(id);
          else set.add(id);
        }
        return { ...state, selection: [...set] };
      }
      return { ...state, selection: ids };
    }
    case "clear-selection":
      return { ...state, selection: [] };
    case "replace-scene":
      return {
        ...createEditorState(action.scene),
        past: [...state.past, state.scene],
        idCounter: Math.max(state.idCounter, nextCounterForScene(action.scene)),
      };
    case "update-scene": {
      const next = action.mutate(state.scene);
      return pushHistory(state, next, action.coalesceKey);
    }
    case "add-entity": {
      const scene = state.scene;
      let next = scene;
      let newId = "";
      if (action.kind === "object") {
        newId = nextId(state, "object");
        // 若存在平面，优先吸附到最近的平面（接触距离 1m 内）
        const surface = nearestSurface(scene);
        const obj: MechanicsObjectV1 = {
          id: newId,
          label: `物体 ${newId}`,
          mass: 2,
          position: action.at,
          ...(surface !== null ? { surfaceId: surface.id } : {}),
        };
        next = { ...scene, objects: [...scene.objects, obj] };
      } else if (action.kind === "horizontal-surface" || action.kind === "inclined-surface") {
        newId = nextId(state, "surface");
        const surf: MechanicsSurfaceV1 = {
          id: newId,
          kind: action.kind === "horizontal-surface" ? "horizontal" : "inclined",
          angleDeg: action.kind === "inclined-surface" ? 30 : 0,
          friction: { model: "smooth" },
        };
        next = { ...scene, surfaces: [...scene.surfaces, surf] };
      } else {
        newId = nextId(state, "pulley");
        const pulley: MechanicsPulleyV1 = {
          id: newId,
          kind: action.kind === "fixed-pulley" ? "fixed" : "movable",
          position: action.at,
        };
        next = { ...scene, pulleys: [...scene.pulleys, pulley] };
      }
      const pushed = pushHistory(state, next);
      return { ...pushed, idCounter: state.idCounter + 1, selection: [newId], tool: "select" };
    }
    case "add-support-to": {
      const newId = nextId(state, "support");
      const support: MechanicsSupportV1 = { id: newId, objectId: action.objectId };
      const pushed = pushHistory(state, { ...state.scene, supports: [...state.scene.supports, support] });
      return { ...pushed, idCounter: state.idCounter + 1, selection: [newId], tool: "select" };
    }
    case "add-force-to": {
      const newId = nextId(state, "force");
      const force: AppliedForceV1 = { id: newId, objectId: action.objectId, magnitude: 10, angleDeg: 0 };
      const pushed = pushHistory(state, { ...state.scene, externalForces: [...state.scene.externalForces, force] });
      return { ...pushed, idCounter: state.idCounter + 1, selection: [newId], tool: "select" };
    }
    case "delete-entity": {
      const next = removeEntity(state.scene, action.id);
      return { ...pushHistory(state, next), selection: state.selection.filter((s) => s !== action.id) };
    }
    case "delete-selection": {
      let next = state.scene;
      for (const id of state.selection) next = removeEntity(next, id);
      return { ...pushHistory(state, next), selection: [] };
    }
    case "duplicate-selection": {
      let next = state.scene;
      let counter = state.idCounter;
      const newIds: string[] = [];
      const idMap = new Map<string, string>();
      for (const id of state.selection) {
        const obj = next.objects.find((o) => o.id === id);
        if (obj !== undefined) {
          const nid = `${ID_PREFIX["object"]}-${counter++}`;
          idMap.set(id, nid);
          newIds.push(nid);
          next = { ...next, objects: [...next.objects, { ...obj, id: nid, position: { x: obj.position.x + 1, y: obj.position.y + 1 } }] };
          continue;
        }
        const pulley = next.pulleys.find((p) => p.id === id);
        if (pulley !== undefined) {
          const nid = `${ID_PREFIX["pulley"]}-${counter++}`;
          idMap.set(id, nid);
          newIds.push(nid);
          next = { ...next, pulleys: [...next.pulleys, { ...pulley, id: nid, position: { x: pulley.position.x + 1, y: pulley.position.y + 1 } }] };
        }
      }
      // 复制选中物体之间的连接与外力
      for (const conn of state.scene.connectors) {
        const mapNode = (n: typeof conn.nodes[number]): typeof conn.nodes[number] | null => {
          if (n.type === "object") {
            const mapped = idMap.get(n.objectId);
            return mapped !== undefined ? { type: "object", objectId: mapped } : null;
          }
          if (n.type === "pulley") {
            const mapped = idMap.get(n.pulleyId);
            return mapped !== undefined ? { type: "pulley", pulleyId: mapped } : null;
          }
          return n;
        };
        if (conn.nodes.some((n) => (n.type === "object" && idMap.has(n.objectId)) || (n.type === "pulley" && idMap.has(n.pulleyId)))) {
          const nodes = conn.nodes.map(mapNode);
          if (nodes.every((n) => n !== null)) {
            const nid = `${ID_PREFIX[conn.kind] ?? "rope"}-${counter++}`;
            next = { ...next, connectors: [...next.connectors, { ...conn, id: nid, nodes: nodes as typeof conn.nodes }] };
          }
        }
      }
      for (const f of state.scene.externalForces) {
        const mapped = idMap.get(f.objectId);
        if (mapped !== undefined) {
          const nid = `${ID_PREFIX["force"]}-${counter++}`;
          next = { ...next, externalForces: [...next.externalForces, { ...f, id: nid, objectId: mapped }] };
        }
      }
      if (newIds.length === 0) return state;
      return { ...pushHistory(state, next), idCounter: counter, selection: newIds };
    }
    case "move-entities": {
      const idSet = new Set(action.ids);
      const move = (p: Vec2V1): Vec2V1 => ({ x: p.x + action.delta.x, y: p.y + action.delta.y });
      const next: MechanicsSceneV1 = {
        ...state.scene,
        objects: state.scene.objects.map((o) => (idSet.has(o.id) ? { ...o, position: move(o.position) } : o)),
        pulleys: state.scene.pulleys.map((p) => (idSet.has(p.id) ? { ...p, position: move(p.position) } : p)),
      };
      return pushHistory(state, next, action.coalesceKey);
    }
    case "begin-connection":
      return { ...state, connectingKind: action.kind, pendingNodes: [] };
    case "add-connection-node": {
      if (state.connectingKind === null) return state;
      return { ...state, pendingNodes: [...state.pendingNodes, action.node] };
    }
    case "finish-connection": {
      if (state.connectingKind === null || state.pendingNodes.length < 2) {
        return { ...state, connectingKind: null, pendingNodes: [] };
      }
      const kind = state.connectingKind;
      const newId = `${ID_PREFIX[kind]}-${state.idCounter}`;
      const conn: MechanicsConnectorV1 = { id: newId, kind, nodes: state.pendingNodes };
      const pushed = pushHistory(state, { ...state.scene, connectors: [...state.scene.connectors, conn] });
      return {
        ...pushed,
        idCounter: state.idCounter + 1,
        connectingKind: null,
        pendingNodes: [],
        selection: [newId],
        tool: "select",
      };
    }
    case "cancel-connection":
      return { ...state, connectingKind: null, pendingNodes: [] };
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1] as MechanicsSceneV1;
      return {
        ...state,
        scene: previous,
        past: state.past.slice(0, -1),
        future: [state.scene, ...state.future],
        selection: [],
        lastCoalesceKey: null,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [nextScene, ...rest] = state.future as [MechanicsSceneV1, ...MechanicsSceneV1[]];
      return {
        ...state,
        scene: nextScene,
        past: [...state.past, state.scene],
        future: rest,
        selection: [],
        lastCoalesceKey: null,
      };
    }
    default:
      return state;
  }
}

/** 根据场景现有 id 计算下一个可用计数（避免载入场景后 id 冲突） */
export function nextCounterForScene(scene: MechanicsSceneV1): number {
  let max = 0;
  const allIds = [
    ...scene.objects.map((o) => o.id),
    ...scene.surfaces.map((s) => s.id),
    ...scene.supports.map((s) => s.id),
    ...scene.pulleys.map((p) => p.id),
    ...scene.connectors.map((c) => c.id),
    ...scene.externalForces.map((f) => f.id),
  ];
  for (const id of allIds) {
    const m = /-(\d+)$/.exec(id);
    if (m !== null) {
      const n = Number(m[1]);
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return max + 1;
}

function nearestSurface(scene: MechanicsSceneV1): MechanicsSurfaceV1 | null {
  // V1：平面由置于其上的物体隐式定位；若场景已有平面则挂到第一个（可在属性面板改）
  const first = scene.surfaces[0];
  return first !== undefined && scene.surfaces.length === 1 ? first : null;
}

/** 连接合法性提示（编辑器即时反馈；最终判定以 mechanics-core topology 为准） */
export function connectionHint(
  kind: "rope" | "rod",
  pending: ConnectorNodeV1[],
  candidate: ConnectorNodeV1,
): { valid: boolean; hint: string } {
  const next = [...pending, candidate];
  if (kind === "rod") {
    if (next.length > 2) return { valid: false, hint: "轻杆只能有两个端点" };
    if (candidate.type === "pulley" || candidate.type === "force" || candidate.type === "loose") {
      return { valid: false, hint: "轻杆端点必须是物体或锚点" };
    }
    return { valid: true, hint: next.length === 2 ? "再次点击完成轻杆" : "选择轻杆另一端" };
  }
  // rope
  if (pending.length === 0) {
    if (candidate.type === "pulley") return { valid: false, hint: "绳必须从物体、锚点或拉力端开始" };
    return { valid: true, hint: "选择绳的起点" };
  }
  const last = pending[pending.length - 1];
  if (candidate.type === "pulley") {
    if (last !== undefined && last.type === "pulley" && last.pulleyId === candidate.pulleyId) {
      return { valid: false, hint: "同一滑轮不能连续出现两次" };
    }
    if (last !== undefined && last.type !== "pulley" && pending.length >= 2) {
      return { valid: false, hint: "绳已有两个端点，中间只能经过滑轮" };
    }
    return { valid: true, hint: "绳经过滑轮（继续选择下一个节点）" };
  }
  // 终端候选（object/anchor/force）：pending 只有起点时可作为第二端点；其后只能经过滑轮
  if (candidate.type === "loose") return { valid: false, hint: "悬空端点仅在断开绳场景使用" };
  if (pending.length >= 2 && last !== undefined && last.type !== "pulley") {
    return { valid: false, hint: "绳已有两个端点，中间只能经过滑轮" };
  }
  return { valid: true, hint: "点击“完成连接”结束，或继续选择滑轮" };
}
