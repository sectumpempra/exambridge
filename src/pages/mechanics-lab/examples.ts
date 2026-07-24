/**
 * 内置示例场景（数据复用自 gold-cases/ 的场景 JSON）。
 */
import type { MechanicsSceneV1 } from "@/features/mechanics-lab/schema";

export interface ExampleScene {
  id: string;
  title: string;
  description: string;
  scene: MechanicsSceneV1;
}

export const EXAMPLE_SCENES: ExampleScene[] = [
  {
    id: "ex-smooth-horizontal",
    title: "光滑水平面（静力平衡）",
    description: "复用 gold case gc-01：2 kg 物体静置光滑水平面",
    scene: {
      schemaVersion: "1.0.0",
      sceneId: "scene-gc-01",
      title: "光滑水平面单物体",
      gravity: 10,
      analysisMode: "equilibrium",
      objects: [
        { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 0, y: 0.3 }, surfaceId: "surf-1" },
      ],
      surfaces: [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }],
      supports: [],
      pulleys: [],
      connectors: [],
      externalForces: [],
      initialConditions: [],
    },
  },
  {
    id: "ex-rough-incline",
    title: "粗糙斜面（下滑）",
    description: "复用 gold case gc-06：30° 粗糙斜面自由下滑",
    scene: {
      schemaVersion: "1.0.0",
      sceneId: "scene-gc-06",
      title: "粗糙斜面下滑",
      gravity: 10,
      analysisMode: "dynamics",
      objects: [
        { id: "m-obj-1", label: "物体 m1", mass: 2, position: { x: 1.7320508075688772, y: 1.3 }, surfaceId: "surf-1" },
      ],
      surfaces: [
        { id: "surf-1", kind: "inclined", angleDeg: 30, friction: { model: "rough", muS: 0.3, muK: 0.2 } },
      ],
      supports: [],
      pulleys: [],
      connectors: [],
      externalForces: [],
      initialConditions: [],
    },
  },
  {
    id: "ex-fixed-pulley",
    title: "固定滑轮 + 悬挂（桌面物体）",
    description: "复用 gold case gc-12：m1=4 桌面、m2=2 悬挂",
    scene: {
      schemaVersion: "1.0.0",
      sceneId: "scene-gc-12",
      title: "桌面物体连接悬挂物体",
      gravity: 10,
      analysisMode: "dynamics",
      objects: [
        { id: "m-obj-1", label: "物体 m1", mass: 4, position: { x: 0, y: 0.3 }, surfaceId: "surf-1" },
        { id: "m-obj-2", label: "物体 m2", mass: 2, position: { x: 2, y: -1 } },
      ],
      surfaces: [{ id: "surf-1", kind: "horizontal", angleDeg: 0, friction: { model: "smooth" } }],
      supports: [],
      pulleys: [{ id: "pul-1", kind: "fixed", position: { x: 2, y: 0.3 } }],
      connectors: [
        {
          id: "rope-1",
          kind: "rope",
          nodes: [
            { type: "object", objectId: "m-obj-1" },
            { type: "pulley", pulleyId: "pul-1" },
            { type: "object", objectId: "m-obj-2" },
          ],
        },
      ],
      externalForces: [],
      initialConditions: [],
    },
  },
  {
    id: "ex-movable-pulley",
    title: "简单动滑轮",
    description: "复用 gold case gc-14：动滑轮挂 6 kg、自由端挂 2 kg（坐标经展示优化）",
    scene: {
      schemaVersion: "1.0.0",
      sceneId: "scene-gc-14",
      title: "简单动滑轮",
      gravity: 10,
      analysisMode: "dynamics",
      objects: [
        { id: "m-obj-load", label: "重物 load", mass: 6, position: { x: 0, y: 1.6 } },
        { id: "m-obj-2", label: "物体 m2", mass: 2, position: { x: 1.4, y: 2.6 } },
      ],
      surfaces: [],
      supports: [],
      pulleys: [
        { id: "pul-1", kind: "movable", position: { x: 0, y: 1.6 }, attachedObjectId: "m-obj-load" },
        { id: "pul-2", kind: "fixed", position: { x: 1.4, y: 4.6 } },
      ],
      connectors: [
        {
          id: "rope-1",
          kind: "rope",
          nodes: [
            { type: "anchor", point: { x: 0, y: 4.6 } },
            { type: "pulley", pulleyId: "pul-1" },
            { type: "pulley", pulleyId: "pul-2" },
            { type: "object", objectId: "m-obj-2" },
          ],
        },
      ],
      externalForces: [],
      initialConditions: [],
    },
  },
];
