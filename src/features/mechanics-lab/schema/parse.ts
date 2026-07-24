/**
 * 场景 JSON 的解析、序列化与数据迁移入口。
 * 导入损坏或未知版本 JSON 时必须安全拒绝（规格书第十一节）。
 */
import type { z } from "zod";
import { SCHEMA_VERSION_V1 } from "./constants.js";
import { mechanicsSceneSchemaV1 } from "./scene-schema.js";
import type { MechanicsSceneV1 } from "./types.js";

export type SceneParseErrorKindV1 =
  | "invalid-json"
  | "unsupported-version"
  | "schema-violation";

export interface SceneParseIssueV1 {
  path: string;
  message: string;
}

export type SceneParseResultV1 =
  | { ok: true; scene: MechanicsSceneV1 }
  | {
      ok: false;
      kind: SceneParseErrorKindV1;
      message: string;
      issues: SceneParseIssueV1[];
      /** 检测到的 schemaVersion（若有） */
      foundVersion?: string;
    };

function simplifyIssues(error: z.ZodError): SceneParseIssueV1[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((p) => String(p)).join("."),
    message: issue.message,
  }));
}

/**
 * 解析场景 JSON 文本。任何非法输入都返回 { ok: false }，绝不抛出、绝不静默修正。
 */
export function parseSceneJson(text: string): SceneParseResultV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      kind: "invalid-json",
      message: `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
      issues: [],
    };
  }
  return parseSceneData(raw);
}

/** 解析已反序列化的数据对象 */
export function parseSceneData(raw: unknown): SceneParseResultV1 {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      kind: "schema-violation",
      message: "场景数据必须是 JSON 对象",
      issues: [{ path: "", message: "场景数据必须是 JSON 对象" }],
    };
  }
  const version = (raw as Record<string, unknown>).schemaVersion;
  if (version !== SCHEMA_VERSION_V1) {
    return {
      ok: false,
      kind: "unsupported-version",
      message: `不支持的 schemaVersion：${typeof version === "string" ? version : "缺失"}；当前支持 ${SCHEMA_VERSION_V1}`,
      issues: [],
      ...(typeof version === "string" ? { foundVersion: version } : {}),
    };
  }
  const result = mechanicsSceneSchemaV1.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      kind: "schema-violation",
      message: "场景数据不符合 MechanicsSceneV1 协议",
      issues: simplifyIssues(result.error),
    };
  }
  return { ok: true, scene: result.data as MechanicsSceneV1 };
}

/** 序列化场景为格式化 JSON */
export function serializeScene(scene: MechanicsSceneV1): string {
  return JSON.stringify(scene, null, 2);
}

/* ===================== 数据迁移入口 ===================== */

export type MigrationResultV1 =
  | { ok: true; scene: MechanicsSceneV1; migratedFrom?: string }
  | { ok: false; kind: SceneParseErrorKindV1; message: string };

/**
 * 版本迁移函数表。未来新增版本时在此注册迁移链：
 * 例如 "0.9.0": (raw) => 升级到 1.0.0 的数据。
 */
export const SCENE_MIGRATORS: Record<string, (raw: unknown) => unknown> = {};

/**
 * 数据迁移入口：接受任意历史版本数据，迁移到当前版本并校验。
 * 未知版本安全拒绝。
 */
export function migrateScene(raw: unknown): MigrationResultV1 {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, kind: "schema-violation", message: "场景数据必须是 JSON 对象" };
  }
  const version = (raw as Record<string, unknown>).schemaVersion;
  if (version === SCHEMA_VERSION_V1) {
    const parsed = parseSceneData(raw);
    return parsed.ok
      ? { ok: true, scene: parsed.scene }
      : { ok: false, kind: parsed.kind, message: parsed.message };
  }
  if (typeof version === "string" && version in SCENE_MIGRATORS) {
    const migrator = SCENE_MIGRATORS[version];
    if (migrator !== undefined) {
      const migrated = migrator(raw);
      const parsed = parseSceneData(migrated);
      return parsed.ok
        ? { ok: true, scene: parsed.scene, migratedFrom: version }
        : { ok: false, kind: parsed.kind, message: parsed.message };
    }
  }
  return {
    ok: false,
    kind: "unsupported-version",
    message: `无法迁移未知版本：${typeof version === "string" ? version : "缺失"}`,
  };
}
