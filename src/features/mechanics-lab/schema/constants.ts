/**
 * ExamBridge Mechanics Lab V1 — 全局常量
 * 纯数据定义，无运行时依赖。
 */

/** 场景协议版本 */
export const SCHEMA_VERSION_V1 = "1.0.0" as const;

/** 版本化 localStorage 键（规格书第十一节） */
export const LOCAL_STORAGE_SCENES_KEY_V1 = "exambridge:mechanics-lab:v1:scenes" as const;

export const STORAGE_KEYS_V1 = {
  scenes: LOCAL_STORAGE_SCENES_KEY_V1,
} as const;

/** SI 单位定义（规格书第五节） */
export const SI_UNITS_V1 = {
  mass: "kg",
  length: "m",
  time: "s",
  force: "N",
  acceleration: "m/s^2",
  velocity: "m/s",
  /** core 内部统一使用弧度；UI 输入可使用度 */
  angleInternal: "rad",
  angleInput: "deg",
} as const;

export type SiUnitsV1 = typeof SI_UNITS_V1;

/**
 * 稳定 ID 规则：字母开头，字母/数字/下划线/连字符，长度 3-64。
 * 所有实体必须使用稳定 ID，禁止自增数字等不稳定标识。
 */
export const STABLE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{2,63}$/;

export function isStableId(value: unknown): value is string {
  return typeof value === "string" && STABLE_ID_PATTERN.test(value);
}
