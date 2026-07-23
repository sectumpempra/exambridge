import { describe, expect, it } from "vitest";
import {
  connectionHint,
  createEditorState,
  createEmptyScene,
  editorReducer,
  nextCounterForScene,
  removeEntity,
  type EditorState,
} from "./editor-state.js";

function withSurface(state?: EditorState): EditorState {
  let s = state ?? createEditorState();
  s = editorReducer(s, { type: "add-entity", kind: "horizontal-surface", at: { x: 0, y: 0 } });
  return s;
}

describe("editor-state 基础", () => {
  it("createEmptyScene 协议字段齐备", () => {
    const scene = createEmptyScene();
    expect(scene.schemaVersion).toBe("1.0.0");
    expect(scene.gravity).toBe(10);
    expect(scene.analysisMode).toBe("equilibrium");
    expect(scene.objects).toEqual([]);
  });

  it("添加实体生成稳定 id 并选中", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 1, y: 0.5 } });
    expect(s.scene.objects).toHaveLength(1);
    expect(s.scene.objects[0]?.id).toMatch(/^m-obj-\d+$/);
    expect(s.scene.objects[0]?.surfaceId).toBe("surf-1");
    expect(s.selection).toEqual([s.scene.objects[0]?.id]);
    expect(s.tool).toBe("select");
  });

  it("撤销/重做", () => {
    let s = withSurface();
    const withSurf = s.scene;
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 0, y: 0.5 } });
    expect(s.scene.objects).toHaveLength(1);
    s = editorReducer(s, { type: "undo" });
    expect(s.scene.objects).toHaveLength(0);
    s = editorReducer(s, { type: "redo" });
    expect(s.scene.objects).toHaveLength(1);
    s = editorReducer(s, { type: "undo" });
    expect(s.scene).toEqual(withSurf);
    s = editorReducer(s, { type: "undo" });
    expect(s.scene.surfaces).toHaveLength(0);
    // 空栈撤销安全
    s = editorReducer(s, { type: "undo" });
    expect(s.past).toHaveLength(0);
  });

  it("拖拽合并历史（coalesceKey）", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 0, y: 0.5 } });
    const id = s.scene.objects[0]?.id ?? "";
    const pastLen = s.past.length;
    s = editorReducer(s, { type: "move-entities", ids: [id], delta: { x: 0.1, y: 0 }, coalesceKey: "drag-1" });
    s = editorReducer(s, { type: "move-entities", ids: [id], delta: { x: 0.1, y: 0 }, coalesceKey: "drag-1" });
    expect(s.past.length).toBe(pastLen + 1);
    expect(s.scene.objects[0]?.position.x).toBeCloseTo(0.2, 9);
  });

  it("删除实体清理全部引用", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 0, y: 0.5 } });
    const id = s.scene.objects[0]?.id ?? "";
    s = editorReducer(s, { type: "add-force-to", objectId: id });
    s = editorReducer(s, { type: "add-support-to", objectId: id });
    s = editorReducer(s, { type: "update-scene", mutate: (sc) => ({ ...sc, initialConditions: [{ objectId: id, velocity: 1 }] }) });
    const cleaned = removeEntity(s.scene, id);
    expect(cleaned.objects).toHaveLength(0);
    expect(cleaned.externalForces).toHaveLength(0);
    expect(cleaned.supports).toHaveLength(0);
    expect(cleaned.initialConditions).toHaveLength(0);
  });

  it("删除平面、滑轮和连接时清理各类反向引用", () => {
    const scene = {
      ...createEmptyScene(),
      objects: [
        { id: "m-obj-1", label: "A", mass: 2, position: { x: 0, y: 0 }, surfaceId: "surf-2" },
        { id: "m-obj-2", label: "B", mass: 3, position: { x: 2, y: 0 } },
      ],
      surfaces: [
        { id: "surf-2", kind: "horizontal" as const, angleDeg: 0, friction: { model: "smooth" as const } },
      ],
      pulleys: [
        { id: "pul-3", kind: "fixed" as const, position: { x: 1, y: 2 }, attachedObjectId: "m-obj-1" },
      ],
      connectors: [
        {
          id: "rope-4",
          kind: "rope" as const,
          nodes: [
            { type: "object" as const, objectId: "m-obj-1" },
            { type: "pulley" as const, pulleyId: "pul-3" },
            { type: "object" as const, objectId: "m-obj-2" },
          ],
        },
      ],
    };

    const withoutSurface = removeEntity(scene, "surf-2");
    expect(withoutSurface.objects[0]?.surfaceId).toBeUndefined();

    const withoutPulley = removeEntity(scene, "pul-3");
    expect(withoutPulley.connectors).toHaveLength(0);

    const withoutObject = removeEntity(scene, "m-obj-1");
    expect(withoutObject.pulleys[0]?.attachedObjectId).toBeUndefined();
    expect(withoutObject.connectors).toHaveLength(0);

    const withoutConnector = removeEntity(scene, "rope-4");
    expect(withoutConnector.connectors).toHaveLength(0);
    expect(withoutConnector.objects).toHaveLength(2);
  });

  it("复制选中物体（含内部连接与外力）", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 0, y: 0.5 } });
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 2, y: 0.5 } });
    const [a, b] = s.scene.objects.map((o) => o.id);
    s = editorReducer(s, { type: "begin-connection", kind: "rope" });
    s = editorReducer(s, { type: "add-connection-node", node: { type: "object", objectId: a ?? "" } });
    s = editorReducer(s, { type: "add-connection-node", node: { type: "object", objectId: b ?? "" } });
    s = editorReducer(s, { type: "finish-connection" });
    expect(s.scene.connectors).toHaveLength(1);
    s = editorReducer(s, { type: "select", ids: [a ?? "", b ?? ""] });
    s = editorReducer(s, { type: "duplicate-selection" });
    expect(s.scene.objects).toHaveLength(4);
    expect(s.scene.connectors).toHaveLength(2);
  });

  it("复制物体会复制其外力，复制滑轮会映射内部连接", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 0, y: 0.5 } });
    const objectId = s.scene.objects[0]?.id ?? "";
    s = editorReducer(s, { type: "add-force-to", objectId });
    s = editorReducer(s, { type: "select", ids: [objectId] });
    s = editorReducer(s, { type: "duplicate-selection" });
    expect(s.scene.externalForces).toHaveLength(2);
    expect(s.scene.externalForces[1]?.objectId).toBe(s.selection[0]);

    const pulleyScene = {
      ...createEmptyScene(),
      pulleys: [
        { id: "pul-1", kind: "fixed" as const, position: { x: 0, y: 2 } },
        { id: "pul-2", kind: "movable" as const, position: { x: 2, y: 2 } },
      ],
      connectors: [
        {
          id: "rope-3",
          kind: "rope" as const,
          nodes: [
            { type: "pulley" as const, pulleyId: "pul-1" },
            { type: "pulley" as const, pulleyId: "pul-2" },
          ],
        },
      ],
    };
    s = {
      ...createEditorState(pulleyScene),
      selection: ["pul-1", "pul-2"],
      idCounter: 4,
    };
    s = editorReducer(s, { type: "duplicate-selection" });
    expect(s.scene.pulleys).toHaveLength(4);
    expect(s.scene.connectors).toHaveLength(2);
  });

  it("连接流程：开始/节点/完成/取消", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 0, y: 0.5 } });
    const id = s.scene.objects[0]?.id ?? "";
    s = editorReducer(s, { type: "begin-connection", kind: "rope" });
    s = editorReducer(s, { type: "add-connection-node", node: { type: "object", objectId: id } });
    s = editorReducer(s, { type: "add-connection-node", node: { type: "anchor", point: { x: 0, y: 3 } } });
    s = editorReducer(s, { type: "finish-connection" });
    expect(s.scene.connectors).toHaveLength(1);
    expect(s.scene.connectors[0]?.kind).toBe("rope");
    expect(s.connectingKind).toBeNull();
    // 单节点完成无效
    s = editorReducer(s, { type: "begin-connection", kind: "rod" });
    s = editorReducer(s, { type: "add-connection-node", node: { type: "object", objectId: id } });
    s = editorReducer(s, { type: "finish-connection" });
    expect(s.scene.connectors).toHaveLength(1);
    // 取消
    s = editorReducer(s, { type: "begin-connection", kind: "rod" });
    s = editorReducer(s, { type: "cancel-connection" });
    expect(s.pendingNodes).toHaveLength(0);
  });

  it("多选（additive 切换）", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "select", ids: ["a"] });
    s = editorReducer(s, { type: "select", ids: ["b"], additive: true });
    expect(s.selection).toEqual(["a", "b"]);
    s = editorReducer(s, { type: "select", ids: ["a"], additive: true });
    expect(s.selection).toEqual(["b"]);
  });

  it("set-tool 切换并清理连接状态", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "begin-connection", kind: "rope" });
    s = editorReducer(s, { type: "add-connection-node", node: { type: "anchor", point: { x: 0, y: 1 } } });
    s = editorReducer(s, { type: "set-tool", tool: "select" });
    expect(s.connectingKind).toBeNull();
    expect(s.pendingNodes).toHaveLength(0);
    s = editorReducer(s, { type: "set-tool", tool: "add-rope" });
    expect(s.connectingKind).toBe("rope");
    s = editorReducer(s, { type: "set-tool", tool: "add-rod" });
    expect(s.connectingKind).toBe("rod");
  });

  it("replace-scene 保留历史并重置选择", () => {
    let s = withSurface();
    const replacement = { ...s.scene, title: "替换场景" };
    s = editorReducer(s, { type: "replace-scene", scene: replacement });
    expect(s.scene.title).toBe("替换场景");
    expect(s.selection).toEqual([]);
    s = editorReducer(s, { type: "undo" });
    expect(s.scene.title).toBe("未命名场景");
  });

  it("delete-entity 与 delete-selection", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 0, y: 0.5 } });
    const id = s.scene.objects[0]?.id ?? "";
    s = editorReducer(s, { type: "delete-entity", id });
    expect(s.scene.objects).toHaveLength(0);
    // delete-selection
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 0, y: 0.5 } });
    const id2 = s.scene.objects[0]?.id ?? "";
    s = editorReducer(s, { type: "select", ids: [id2] });
    s = editorReducer(s, { type: "delete-selection" });
    expect(s.scene.objects).toHaveLength(0);
    expect(s.selection).toEqual([]);
  });

  it("添加斜面与固定/动滑轮", () => {
    let s = createEditorState();
    s = editorReducer(s, { type: "add-entity", kind: "inclined-surface", at: { x: 0, y: 0 } });
    expect(s.scene.surfaces[0]?.angleDeg).toBe(30);
    s = editorReducer(s, { type: "add-entity", kind: "fixed-pulley", at: { x: 1, y: 2 } });
    expect(s.scene.pulleys[0]?.kind).toBe("fixed");
    s = editorReducer(s, { type: "add-entity", kind: "movable-pulley", at: { x: 2, y: 2 } });
    expect(s.scene.pulleys[1]?.kind).toBe("movable");
  });

  it("多个平面时新物体不自动挂接（属性面板手动选择）", () => {
    let s = withSurface();
    s = editorReducer(s, { type: "add-entity", kind: "inclined-surface", at: { x: 0, y: 0 } });
    s = editorReducer(s, { type: "add-entity", kind: "object", at: { x: 0, y: 0.5 } });
    expect(s.scene.objects[0]?.surfaceId).toBeUndefined();
  });

  it("移动滑轮并从所有实体类别计算安全的下一个 id", () => {
    let s = createEditorState();
    s = editorReducer(s, { type: "add-entity", kind: "fixed-pulley", at: { x: 1, y: 2 } });
    const pulleyId = s.scene.pulleys[0]?.id ?? "";
    s = editorReducer(s, {
      type: "move-entities",
      ids: [pulleyId],
      delta: { x: 2, y: -1 },
    });
    expect(s.scene.pulleys[0]?.position).toEqual({ x: 3, y: 1 });

    const scene = {
      ...createEmptyScene(),
      objects: [{ id: "m-obj-2", label: "A", mass: 1, position: { x: 0, y: 0 } }],
      surfaces: [{ id: "surf-3", kind: "horizontal" as const, angleDeg: 0, friction: { model: "smooth" as const } }],
      supports: [{ id: "sup-4", objectId: "m-obj-2" }],
      pulleys: [{ id: "pul-5", kind: "fixed" as const, position: { x: 0, y: 2 } }],
      connectors: [{
        id: "rope-6",
        kind: "rope" as const,
        nodes: [
          { type: "object" as const, objectId: "m-obj-2" },
          { type: "anchor" as const, point: { x: 0, y: 3 } },
        ],
      }],
      externalForces: [{ id: "force-7", objectId: "m-obj-2", magnitude: 5, angleDeg: 0 }],
    };
    expect(nextCounterForScene(scene)).toBe(8);
    expect(nextCounterForScene({ ...scene, externalForces: [{ ...scene.externalForces[0]!, id: "force-x" }] })).toBe(7);
  });
});

describe("connectionHint 连接合法性提示", () => {
  it("轻杆：恰好两端点且不能是滑轮", () => {
    expect(connectionHint("rod", [], { type: "object", objectId: "m-obj-1" }).valid).toBe(true);
    expect(connectionHint("rod", [], { type: "pulley", pulleyId: "pul-1" }).valid).toBe(false);
    const one = [{ type: "object", objectId: "m-obj-1" } as const];
    expect(connectionHint("rod", [...one], { type: "anchor", point: { x: 0, y: 0 } }).valid).toBe(true);
    expect(connectionHint("rod", [...one, { type: "anchor", point: { x: 0, y: 0 } }], { type: "object", objectId: "m-obj-2" }).valid).toBe(false);
  });

  it("绳：起点不能是滑轮；端点后只能经过滑轮", () => {
    expect(connectionHint("rope", [], { type: "pulley", pulleyId: "pul-1" }).valid).toBe(false);
    expect(connectionHint("rope", [], { type: "object", objectId: "m-obj-1" }).valid).toBe(true);
    expect(connectionHint("rope", [], { type: "anchor", point: { x: 0, y: 1 } }).valid).toBe(true);
    expect(connectionHint("rope", [], { type: "force", magnitude: 10 }).valid).toBe(true);
    const started = [{ type: "object", objectId: "m-obj-1" } as const];
    expect(connectionHint("rope", [...started], { type: "pulley", pulleyId: "pul-1" }).valid).toBe(true);
    const viaPulley = [...started, { type: "pulley", pulleyId: "pul-1" } as const];
    expect(connectionHint("rope", [...viaPulley], { type: "object", objectId: "m-obj-2" }).valid).toBe(true);
    const terminated = [...started, { type: "anchor", point: { x: 0, y: 0 } } as const];
    expect(connectionHint("rope", [...terminated], { type: "object", objectId: "m-obj-2" }).valid).toBe(false);
    expect(connectionHint("rope", [...terminated], { type: "pulley", pulleyId: "pul-9" }).valid).toBe(false);
    expect(connectionHint("rope", [...viaPulley], { type: "pulley", pulleyId: "pul-1" }).valid).toBe(false);
    expect(connectionHint("rope", [...viaPulley], { type: "pulley", pulleyId: "pul-2" }).valid).toBe(true);
    expect(connectionHint("rope", [...started], { type: "loose" }).valid).toBe(false);
    expect(connectionHint("rope", [...viaPulley], { type: "force", magnitude: 5 }).valid).toBe(true);
    // 物体→物体 / 物体→锚点：最基本的合法绳
    expect(connectionHint("rope", [...started], { type: "object", objectId: "m-obj-2" }).valid).toBe(true);
    expect(connectionHint("rope", [...started], { type: "anchor", point: { x: 1, y: 1 } }).valid).toBe(true);
  });
});
