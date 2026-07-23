/**
 * ExamBridge Mechanics Lab V1 — 场景与求解结果的 TypeScript 类型契约。
 * 与 Zod schema（scene-schema.ts / solution-schema.ts）一一对应。
 *
 * 坐标规范（规格书第五节）：
 * - 世界坐标 x 轴向右，y 轴向上；
 * - 角度输入使用度（angleDeg），core 内部统一弧度；
 * - 质量 kg，长度 m，时间 s，力 N，加速度 m/s²。
 * 物理属性与视觉属性（visual）分离。
 */

import type { SCHEMA_VERSION_V1 } from "./constants.js";

export type SchemaVersionV1 = typeof SCHEMA_VERSION_V1;

export interface Vec2V1 {
  x: number;
  y: number;
}

/** 分析模式：静力平衡 / 临界平衡 / 动力学 / 运动学（恒加速度演示） */
export type AnalysisModeV1 =
  | "equilibrium"
  | "limiting-equilibrium"
  | "dynamics"
  | "kinematics";

/** 视觉属性与物理属性分离；core 永不读取 visual。 */
export interface VisualPropsV1 {
  color?: string;
  labelOffset?: Vec2V1;
  [key: string]: unknown;
}

export interface MechanicsObjectV1 {
  id: string;
  label: string;
  /** 质量 kg，必须为正数 */
  mass: number;
  /** 场景坐标（m），非屏幕像素 */
  position: Vec2V1;
  /** 若物体置于某平面上，引用 surface id；悬挂/自由物体缺省 */
  surfaceId?: string;
  visual?: VisualPropsV1;
}

export type SurfaceFrictionV1 =
  | { model: "smooth" }
  | {
      model: "rough";
      /** 静摩擦系数 μs；缺省时求解器返回 input-required */
      muS?: number;
      /** 动摩擦系数 μk；必须满足 μk ≤ μs */
      muK?: number;
    };

export interface MechanicsSurfaceV1 {
  id: string;
  kind: "horizontal" | "inclined";
  /** 相对世界 +x 轴的倾角（度），逆时针为正；水平面必须为 0 */
  angleDeg: number;
  friction: SurfaceFrictionV1;
  visual?: VisualPropsV1;
}

/** 固定支点：使物体位置固定并提供支点反力 */
export interface MechanicsSupportV1 {
  id: string;
  objectId: string;
  label?: string;
}

export interface MechanicsPulleyV1 {
  id: string;
  kind: "fixed" | "movable";
  /** 场景坐标（m）；固定滑轮位置固定，动滑轮位置随挂载物体 */
  position: Vec2V1;
  /** 动滑轮必须挂载一个物体（滑轮随其运动）；固定滑轮不得挂载 */
  attachedObjectId?: string;
  /** 滑轮质量 kg；理想滑轮为 0 或缺省。>0 属于第一版不支持能力 */
  mass?: number;
  visual?: VisualPropsV1;
}

/** 绳/杆连接节点 */
export type ConnectorNodeV1 =
  | { type: "object"; objectId: string }
  | { type: "anchor"; point: Vec2V1; label?: string }
  | { type: "pulley"; pulleyId: string }
  | { type: "loose" }
  | { type: "force"; magnitude: number; label?: string };

export type ConnectorKindV1 = "rope" | "rod" | "spring";

export interface MechanicsConnectorV1 {
  id: string;
  /**
   * rope：轻且不可伸长的绳，只能受拉；
   * rod：轻杆，只传递轴向力，可拉可压；
   * spring：第一版不支持（求解器返回 unsupported）。
   */
  kind: ConnectorKindV1;
  /**
   * 有序节点。绳：端点为 object/anchor/loose/force，中间节点为 pulley；
   * 杆：恰好两个端点（object/anchor）。
   */
  nodes: ConnectorNodeV1[];
}

/** 外加推力或拉力 */
export interface AppliedForceV1 {
  id: string;
  objectId: string;
  /** 大小 N，非负 */
  magnitude: number;
  /** 方向（度），自世界 +x 轴逆时针 */
  angleDeg: number;
  label?: string;
}

/** 初始条件：沿物体运动路径方向的带符号初速度（m/s） */
export interface InitialConditionV1 {
  objectId: string;
  /** 沿路径正方向的初速度（m/s），可为负 */
  velocity: number;
}

export interface MechanicsSceneV1 {
  schemaVersion: SchemaVersionV1;
  sceneId: string;
  title: string;
  /** 重力加速度 m/s²，正数 */
  gravity: number;
  analysisMode: AnalysisModeV1;
  objects: MechanicsObjectV1[];
  surfaces: MechanicsSurfaceV1[];
  supports: MechanicsSupportV1[];
  pulleys: MechanicsPulleyV1[];
  connectors: MechanicsConnectorV1[];
  externalForces: AppliedForceV1[];
  initialConditions: InitialConditionV1[];
}

/* ===================== 求解结果类型（规格书第七节） ===================== */

export type SolutionStatusV1 =
  | "solved"
  | "input-required"
  | "underdetermined"
  | "overdetermined-consistent"
  | "inconsistent"
  | "assumption-invalid"
  | "unsupported";

export interface MechanicsAssumptionV1 {
  assumptionId: string;
  kind:
    | "ideal-rope"
    | "ideal-pulley"
    | "light-rod"
    | "rigid-surface"
    | "point-mass"
    | "friction-model"
    | "equilibrium"
    | "motion-direction"
    | "rope-taut"
    | "contact-maintained"
    | "other";
  /** 中文假设说明 */
  text: string;
}

export interface CoordinateSystemV1 {
  coordinateSystemId: string;
  kind: "global" | "along-surface";
  /** 关联对象；全局坐标系缺省 */
  objectId?: string;
  /** x 轴单位向量（世界坐标） */
  xAxis: Vec2V1;
  /** y 轴单位向量（世界坐标） */
  yAxis: Vec2V1;
  /** 相对世界 +x 的倾角（度） */
  angleDeg: number;
  description: string;
}

export type ForceKindV1 =
  | "gravity"
  | "normal"
  | "static-friction"
  | "kinetic-friction"
  | "tension"
  | "rod"
  | "applied"
  | "support-reaction";

export interface ForceRecordV1 {
  forceId: string;
  objectId: string;
  kind: ForceKindV1;
  /** 力的中文名称，如 "重力"、"支持力" */
  label: string;
  /** 符号，如 "N(m1)"、"T(rope-ab)" */
  symbol: string;
  /** 来源说明，如 "平面 surface-1"、"绳 rope-ab" */
  source: string;
  /**
   * 方向单位向量（世界坐标）。对杆：为假定受拉方向；
   * 对带符号求解的力，配合 signedMagnitudeAlongDirection 解读。
   */
  direction: Vec2V1;
  /** 求解后的有符号大小（沿 direction 正方向）；未知为 null */
  magnitude: number | null;
  /** 单位，固定 "N" */
  unit: "N";
  /** 备注（如 "杆受压"、"方向与假定相反"） */
  note?: string;
}

export interface FreeBodyDiagramV1 {
  objectId: string;
  objectLabel: string;
  forceIds: string[];
  note?: string;
}

export interface EquationTermV1 {
  /** 未知量符号 */
  symbol: string;
  coefficient: number;
}

export interface MechanicsEquationV1 {
  equationId: string;
  kind: "newton-x" | "newton-y" | "rope-length" | "rod-length";
  /** 关联物体；约束方程可缺省 */
  objectId?: string;
  /** 中文说明，如 "物体 m1 的 x 方向牛顿第二定律" */
  description: string;
  /** Σ terms = constant */
  terms: EquationTermV1[];
  constant: number;
  /** 符号形式文本，如 "T(rope-ab) - f(m1) = 0" */
  symbolic: string;
}

export interface MechanicsUnknownV1 {
  symbol: string;
  /** 中文含义 */
  meaning: string;
  unit: string;
  /** 关联实体 */
  relatesTo?: { kind: "object" | "rope" | "rod" | "support" | "contact"; id: string };
}

export interface SolvedValueV1 {
  symbol: string;
  value: number;
  unit: string;
  /** 按 DISPLAY_TOLERANCE 舍入的展示值 */
  display: string;
  meaning: string;
  relatesTo?: { kind: "object" | "rope" | "rod" | "support" | "contact"; id: string };
}

export type ConstraintKindV1 =
  | "rope-length"
  | "rod-length"
  | "rope-tension-equal"
  | "tension-non-negative"
  | "normal-non-negative"
  | "static-friction-bound"
  | "friction-direction"
  | "residual-check"
  | "topology";

export interface EvaluatedConstraintV1 {
  constraintId: string;
  kind: ConstraintKindV1;
  /** 约束表达式文本 */
  expression: string;
  satisfied: boolean;
  detail: string;
}

export interface ValidationResultV1 {
  ruleId: string;
  severity: "info" | "warning" | "error";
  passed: boolean;
  message: string;
}

export interface ExplanationStepV1 {
  step: number;
  title: string;
  detail: string;
}

/** 运动方向报告：假定正方向 vs 求解方向，禁止静默取绝对值 */
export interface DirectionReportV1 {
  objectId: string;
  /** 假定路径正方向单位向量 */
  assumedPositiveDirection: Vec2V1;
  /** 沿路径的加速度（带符号 m/s²）；平衡/静定情形为 0 */
  accelerationAlongPath: number | null;
  /** 沿路径的初速度（带符号 m/s）；未提供为 null */
  initialVelocityAlongPath: number | null;
  /** 求解运动方向与假定正方向是否相反 */
  oppositeToAssumption: boolean;
  /** 是否在减速（加速度与速度反号） */
  decelerating: boolean;
  note: string;
}

export interface KinematicsSampleV1 {
  t: number;
  velocityAlongPath: number;
  displacementAlongPath: number;
}

export interface KinematicsRecordV1 {
  objectId: string;
  accelerationAlongPath: number;
  initialVelocityAlongPath: number;
  pathDirection: Vec2V1;
  velocityFunction: string;
  displacementFunction: string;
  samples: KinematicsSampleV1[];
}

export interface MechanicsSolutionV1 {
  status: SolutionStatusV1;
  /** 状态中文说明 */
  statusReason: string;
  assumptions: MechanicsAssumptionV1[];
  coordinateSystems: CoordinateSystemV1[];
  forces: ForceRecordV1[];
  freeBodyDiagrams: FreeBodyDiagramV1[];
  equations: MechanicsEquationV1[];
  unknowns: MechanicsUnknownV1[];
  values: SolvedValueV1[];
  constraints: EvaluatedConstraintV1[];
  validation: ValidationResultV1[];
  explanationSteps: ExplanationStepV1[];
  directionReports: DirectionReportV1[];
  kinematics: KinematicsRecordV1[];
  /** status 为 unsupported 时列出不支持能力 */
  unsupportedFeatures: string[];
  /** status 为 input-required 时列出所需输入 */
  requiredInputs: string[];
}
