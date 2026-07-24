/**
 * MechanicsSceneV1 的 Zod 校验：结构校验 + 引用完整性 + 物理参数合法性。
 * 非法数据必须在入口处被拒绝（规格书第五节、第十二节）。
 */
import { z } from "zod";
import { SCHEMA_VERSION_V1, STABLE_ID_PATTERN } from "./constants.js";

const idSchema = z
  .string()
  .regex(STABLE_ID_PATTERN, "实体 ID 必须为稳定 ID：字母开头，仅含字母/数字/_/-，长度 3-64");

const finiteNumber = z.number().finite();

export const vec2SchemaV1 = z.object({
  x: finiteNumber,
  y: finiteNumber,
});

const visualSchemaV1 = z
  .object({
    color: z.string().optional(),
    labelOffset: vec2SchemaV1.optional(),
  })
  .loose();

export const mechanicsObjectSchemaV1 = z.object({
  id: idSchema,
  label: z.string().min(1),
  mass: finiteNumber.positive("质量必须为正数（kg）"),
  position: vec2SchemaV1,
  surfaceId: idSchema.optional(),
  visual: visualSchemaV1.optional(),
});

export const surfaceFrictionSchemaV1 = z.discriminatedUnion("model", [
  z.object({ model: z.literal("smooth") }),
  z
    .object({
      model: z.literal("rough"),
      muS: finiteNumber.min(0, "静摩擦系数不得为负").max(2, "静摩擦系数超出合理范围").optional(),
      muK: finiteNumber.min(0, "动摩擦系数不得为负").max(2, "动摩擦系数超出合理范围").optional(),
    })
    .refine((f) => f.muS === undefined || f.muK === undefined || f.muK <= f.muS, {
      message: "动摩擦系数 μk 不得大于静摩擦系数 μs",
    }),
]);

export const mechanicsSurfaceSchemaV1 = z
  .object({
    id: idSchema,
    kind: z.enum(["horizontal", "inclined"]),
    angleDeg: finiteNumber.min(-90, "倾角不得小于 -90°").max(90, "倾角不得大于 90°"),
    friction: surfaceFrictionSchemaV1,
    visual: visualSchemaV1.optional(),
  })
  .refine((s) => s.kind !== "horizontal" || s.angleDeg === 0, {
    message: "水平面的 angleDeg 必须为 0",
  });

export const mechanicsSupportSchemaV1 = z.object({
  id: idSchema,
  objectId: idSchema,
  label: z.string().optional(),
});

export const mechanicsPulleySchemaV1 = z
  .object({
    id: idSchema,
    kind: z.enum(["fixed", "movable"]),
    position: vec2SchemaV1,
    attachedObjectId: idSchema.optional(),
    mass: finiteNumber.min(0, "滑轮质量不得为负").optional(),
    visual: visualSchemaV1.optional(),
  })
  .refine((p) => p.kind !== "fixed" || p.attachedObjectId === undefined, {
    message: "固定滑轮不得挂载物体",
  });

export const connectorNodeSchemaV1 = z.discriminatedUnion("type", [
  z.object({ type: z.literal("object"), objectId: idSchema }),
  z.object({ type: z.literal("anchor"), point: vec2SchemaV1, label: z.string().optional() }),
  z.object({ type: z.literal("pulley"), pulleyId: idSchema }),
  z.object({ type: z.literal("loose") }),
  z.object({
    type: z.literal("force"),
    magnitude: finiteNumber.min(0, "绳端拉力不得为负"),
    label: z.string().optional(),
  }),
]);

export const mechanicsConnectorSchemaV1 = z.object({
  id: idSchema,
  kind: z.enum(["rope", "rod", "spring"]),
  nodes: z.array(connectorNodeSchemaV1).min(1, "连接至少需要一个节点"),
});

export const appliedForceSchemaV1 = z.object({
  id: idSchema,
  objectId: idSchema,
  magnitude: finiteNumber.min(0, "外力大小不得为负"),
  angleDeg: finiteNumber.min(-360).max(360),
  label: z.string().optional(),
});

export const initialConditionSchemaV1 = z.object({
  objectId: idSchema,
  velocity: finiteNumber,
});

export const analysisModeSchemaV1 = z.enum([
  "equilibrium",
  "limiting-equilibrium",
  "dynamics",
  "kinematics",
]);

const sceneBaseSchemaV1 = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION_V1),
  sceneId: idSchema,
  title: z.string().min(1),
  gravity: finiteNumber.positive("重力加速度必须为正数"),
  analysisMode: analysisModeSchemaV1,
  objects: z.array(mechanicsObjectSchemaV1).min(1, "场景至少包含一个物体"),
  surfaces: z.array(mechanicsSurfaceSchemaV1),
  supports: z.array(mechanicsSupportSchemaV1),
  pulleys: z.array(mechanicsPulleySchemaV1),
  connectors: z.array(mechanicsConnectorSchemaV1),
  externalForces: z.array(appliedForceSchemaV1),
  initialConditions: z.array(initialConditionSchemaV1),
});

type SceneBase = z.infer<typeof sceneBaseSchemaV1>;

/** 引用完整性与 ID 唯一性检查 */
function checkReferentialIntegrity(scene: SceneBase, ctx: z.RefinementCtx): void {
  const objectIds = new Set(scene.objects.map((o) => o.id));
  const surfaceIds = new Set(scene.surfaces.map((s) => s.id));
  const pulleyIds = new Set(scene.pulleys.map((p) => p.id));

  const allIds = [
    ...scene.objects.map((o) => o.id),
    ...scene.surfaces.map((s) => s.id),
    ...scene.supports.map((s) => s.id),
    ...scene.pulleys.map((p) => p.id),
    ...scene.connectors.map((c) => c.id),
    ...scene.externalForces.map((f) => f.id),
  ];
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) {
      ctx.addIssue({ code: "custom", message: `实体 ID 重复：${id}` });
    }
    seen.add(id);
  }

  for (const obj of scene.objects) {
    if (obj.surfaceId !== undefined && !surfaceIds.has(obj.surfaceId)) {
      ctx.addIssue({
        code: "custom",
        message: `物体 ${obj.id} 引用了不存在的平面 ${obj.surfaceId}`,
      });
    }
  }
  for (const support of scene.supports) {
    if (!objectIds.has(support.objectId)) {
      ctx.addIssue({
        code: "custom",
        message: `支点 ${support.id} 引用了不存在的物体 ${support.objectId}`,
      });
    }
  }
  for (const pulley of scene.pulleys) {
    if (pulley.attachedObjectId !== undefined && !objectIds.has(pulley.attachedObjectId)) {
      ctx.addIssue({
        code: "custom",
        message: `动滑轮 ${pulley.id} 挂载了不存在的物体 ${pulley.attachedObjectId}`,
      });
    }
  }
  for (const connector of scene.connectors) {
    for (const node of connector.nodes) {
      if (node.type === "object" && !objectIds.has(node.objectId)) {
        ctx.addIssue({
          code: "custom",
          message: `连接 ${connector.id} 引用了不存在的物体 ${node.objectId}`,
        });
      }
      if (node.type === "pulley" && !pulleyIds.has(node.pulleyId)) {
        ctx.addIssue({
          code: "custom",
          message: `连接 ${connector.id} 引用了不存在的滑轮 ${node.pulleyId}`,
        });
      }
    }
  }
  for (const force of scene.externalForces) {
    if (!objectIds.has(force.objectId)) {
      ctx.addIssue({
        code: "custom",
        message: `外力 ${force.id} 引用了不存在的物体 ${force.objectId}`,
      });
    }
  }
  for (const ic of scene.initialConditions) {
    if (!objectIds.has(ic.objectId)) {
      ctx.addIssue({
        code: "custom",
        message: `初始条件引用了不存在的物体 ${ic.objectId}`,
      });
    }
  }
}

export const mechanicsSceneSchemaV1 = sceneBaseSchemaV1.superRefine(checkReferentialIntegrity);

export type MechanicsSceneParsedV1 = z.infer<typeof mechanicsSceneSchemaV1>;
