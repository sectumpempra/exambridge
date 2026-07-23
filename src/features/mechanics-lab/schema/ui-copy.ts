/**
 * UI 文案常量：第一版不支持的能力必须在 UI 中明确显示（规格书第六节）。
 * 放在 schema 包以便 apps/demo 与 mechanics-explain 共用。
 */

/** 第一版不支持的能力（规格书第六节清单） */
export const UNSUPPORTED_CAPABILITIES_V1 = [
  "有质量滑轮",
  "滑轮转动惯量",
  "弹性绳",
  "弹簧",
  "任意碰撞",
  "空气阻力",
  "三维受力",
  "非惯性参考系",
  "复杂连续滑轮组",
  "杆的弯曲",
  "梁的变形",
  "任意刚体转动动力学",
] as const;

export const UI_COPY_V1 = {
  unsupportedTitle: "当前版本不支持",
  unsupportedHint: "该场景包含第一版不支持的物理能力，无法给出确定性结果。",
  unsupportedCapabilities: UNSUPPORTED_CAPABILITIES_V1,
  statusLabels: {
    solved: "已求解",
    "input-required": "需要补充输入",
    underdetermined: "欠定系统（解不唯一）",
    "overdetermined-consistent": "超定但一致",
    inconsistent: "输入矛盾",
    "assumption-invalid": "物理假设不成立",
    unsupported: "当前版本不支持",
  },
  units: {
    force: "N",
    mass: "kg",
    acceleration: "m/s²",
    velocity: "m/s",
    length: "m",
  },
} as const;
