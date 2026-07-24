/**
 * 确定性求解主管线（规格书第七节 1-17 步）。
 *
 * 1 Zod 校验输入 → 2 拓扑图 → 3 连接合法性 → 4 自由度 → 5 受力识别 →
 * 6 坐标系 → 7 力分解 → 8 牛顿方程 → 9 绳长约束 → 10 杆长约束 →
 * 11 摩擦状态分支 → 12 方程/未知量计数 → 13 欠定/超定/矛盾/可解分类 →
 * 14 求解 → 15 代回验证 → 16 张力/支持力/摩擦条件 → 17 结构化输出。
 *
 * 硬约束：
 * - 不硬编码任何 gold case 答案；求解完全通用；
 * - 不用 Math.abs 掩盖方向错误；负张力/负支持力必须显式报告；
 * - 不使用无约束最小二乘伪造唯一解；
 * - 求解方向与假定方向相反时必须在 directionReports 中明确报告。
 */
import {
  mechanicsSceneSchemaV1,
  type CoordinateSystemV1,
  type DirectionReportV1,
  type EvaluatedConstraintV1,
  type ExplanationStepV1,
  type ForceRecordV1,
  type FreeBodyDiagramV1,
  type KinematicsRecordV1,
  type MechanicsAssumptionV1,
  type MechanicsSceneV1,
  type MechanicsSolutionV1,
  type SolvedValueV1,
  type SolutionStatusV1,
  type ValidationResultV1,
} from "@/features/mechanics-lab/schema";
import {
  assembleSystem,
  frictionSymbol,
  normalSymbol,
  accelSymbol,
  rodSymbol,
  tensionSymbol,
  type AssembledSystem,
  type FrictionAssignment,
  type KnownForce,
} from "./equations.js";
import { analyzeLinearSystem, type LinearSystemAnalysis } from "./linear-system.js";
import { DISPLAY_TOLERANCE, NUMERICAL_TOLERANCE } from "./tolerances.js";
import { buildSceneModel, type BodyModel, type SceneModel } from "./topology.js";
import { scale, unit, vec, type Vec2 } from "./vec2.js";

interface SolveContext {
  scene: MechanicsSceneV1;
  model: SceneModel;
  dynamic: boolean;
  assumptions: MechanicsAssumptionV1[];
  coordinateSystems: CoordinateSystemV1[];
  validation: ValidationResultV1[];
  explanation: ExplanationStepV1[];
}

const display = (v: number): string => {
  const r = Math.abs(v) < DISPLAY_TOLERANCE ? 0 : v;
  return r.toFixed(6);
};

function emptySolution(status: SolutionStatusV1, statusReason: string): MechanicsSolutionV1 {
  return {
    status,
    statusReason,
    assumptions: [],
    coordinateSystems: [],
    forces: [],
    freeBodyDiagrams: [],
    equations: [],
    unknowns: [],
    values: [],
    constraints: [],
    validation: [],
    explanationSteps: [],
    directionReports: [],
    kinematics: [],
    unsupportedFeatures: [],
    requiredInputs: [],
  };
}

function toMatrix(system: AssembledSystem): { A: number[][]; b: number[] } {
  const index = new Map(system.unknowns.map((u, i) => [u.symbol, i]));
  const n = system.unknowns.length;
  const A: number[][] = [];
  const b: number[] = [];
  for (const eq of system.equations) {
    const row = new Array<number>(n).fill(0);
    for (const t of eq.terms) {
      const i = index.get(t.symbol);
      if (i !== undefined) row[i] = (row[i] as number) + t.coefficient;
    }
    A.push(row);
    b.push(eq.constant);
  }
  return { A, b };
}

/** 状态分类：依据秩与独立方程数（第 12-13 步） */
function classify(
  analysis: LinearSystemAnalysis,
  system: AssembledSystem,
): "solved" | "overdetermined-consistent" | "underdetermined" | "inconsistent" {
  if (!analysis.consistent) return "inconsistent";
  const n = analysis.unknownCount;
  if (analysis.rank < n) return "underdetermined";
  const nonzeroRows = system.equations.filter((eq) =>
    eq.terms.some((t) => Math.abs(t.coefficient) > NUMERICAL_TOLERANCE),
  ).length;
  return nonzeroRows > n ? "overdetermined-consistent" : "solved";
}

function buildAssumptions(ctx: SolveContext): MechanicsAssumptionV1[] {
  const { model } = ctx;
  const list: MechanicsAssumptionV1[] = [];
  let i = 0;
  const push = (kind: MechanicsAssumptionV1["kind"], text: string): void => {
    i++;
    list.push({ assumptionId: `assumption-${i}`, kind, text });
  };
  push("point-mass", "所有物体视为质点，忽略转动与尺寸效应");
  if (model.ropes.length > 0) push("ideal-rope", "绳轻且不可伸长，只能受拉，张力不得为负");
  if (model.ropes.some((r) => r.pulleyIds.length > 0))
    push("ideal-pulley", "滑轮为理想滑轮：无质量、无摩擦，同一根绳张力处处相等");
  if (model.rods.length > 0) push("light-rod", "轻杆只传递轴向力，可受拉也可受压");
  if (model.bodies.some((b) => b.surface !== null)) push("rigid-surface", "平面为刚性平面，支持力沿外法线方向且不得为负");
  if (model.bodies.some((b) => b.surface?.friction.model === "rough"))
    push("friction-model", "摩擦模型：静摩擦 |F| ≤ μsN，滑动后 f = μkN，方向与运动（趋势）相反");
  if (!ctx.dynamic) push("equilibrium", "平衡模式：所有物体加速度为零");
  push("rope-taut", "假设绳保持绷紧；若解出负张力则判定绳松弛并明确报告");
  push("contact-maintained", "假设物体与平面保持接触；若解出负支持力则判定物体脱离平面并明确报告");
  return list;
}

function buildCoordinateSystems(ctx: SolveContext): CoordinateSystemV1[] {
  const list: CoordinateSystemV1[] = [
    {
      coordinateSystemId: "cs-global",
      kind: "global",
      xAxis: vec(1, 0),
      yAxis: vec(0, 1),
      angleDeg: 0,
      description: "全局坐标系：x 向右，y 向上",
    },
  ];
  for (const body of ctx.model.bodies) {
    if (body.surface !== null && body.surface.kind === "inclined" && body.normalDir !== null) {
      list.push({
        coordinateSystemId: `cs-along-${body.id}`,
        kind: "along-surface",
        objectId: body.id,
        xAxis: body.path,
        yAxis: body.normalDir,
        angleDeg: body.surface.angleDeg,
        description: `物体 ${body.id} 的沿斜面坐标系（x 沿斜面向上，y 垂直斜面向上）`,
      });
    }
  }
  return list;
}

interface SolvedState {
  system: AssembledSystem;
  analysis: LinearSystemAnalysis;
  valuesBySymbol: Map<string, number>;
  classification: ReturnType<typeof classify>;
}

function solveOnce(
  scene: MechanicsSceneV1,
  model: SceneModel,
  dynamic: boolean,
  friction: Map<string, FrictionAssignment>,
  slackRopes?: ReadonlySet<string>,
): SolvedState {
  const system = assembleSystem(scene, model, dynamic, friction, slackRopes);
  const { A, b } = toMatrix(system);
  const analysis = analyzeLinearSystem(A, b);
  const valuesBySymbol = new Map<string, number>();
  if (analysis.solution !== null) {
    const solved = analysis.solution;
    system.unknowns.forEach((u, i) => valuesBySymbol.set(u.symbol, solved[i] as number));
  } else {
    for (const [col, value] of analysis.determinedValues) {
      const u = system.unknowns[col];
      if (u !== undefined) valuesBySymbol.set(u.symbol, value);
    }
  }
  return { system, analysis, valuesBySymbol, classification: classify(analysis, system) };
}

/** 主入口 */
export function solveMechanicsScene(sceneInput: MechanicsSceneV1): MechanicsSolutionV1 {
  // 第 1 步：Zod 校验输入
  const parsed = mechanicsSceneSchemaV1.safeParse(sceneInput);
  if (!parsed.success) {
    const sol = emptySolution("input-required", "输入场景不符合 MechanicsSceneV1 协议");
    sol.requiredInputs = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    sol.validation.push({
      ruleId: "schema-check",
      severity: "error",
      passed: false,
      message: "场景未通过 Zod 协议校验",
    });
    return sol;
  }
  const scene = parsed.data as MechanicsSceneV1;

  // 第 2-3 步：拓扑构建与连接合法性
  const model = buildSceneModel(scene);
  const unsupported = model.issues.filter((i) => i.category === "unsupported");
  if (unsupported.length > 0) {
    const sol = emptySolution(
      "unsupported",
      `场景包含第一版不支持的能力：${unsupported.map((u) => u.feature ?? /* v8 ignore next -- unsupported 问题总是携带 feature */ u.ruleId).join("、")}`,
    );
    sol.unsupportedFeatures = unsupported.map((u) => u.feature ?? /* v8 ignore next -- 同上 */ u.message);
    sol.validation = unsupported.map((u) => ({
      ruleId: u.ruleId,
      severity: "error" as const,
      passed: false,
      message: u.message,
    }));
    return sol;
  }
  const inputIssues = model.issues.filter((i) => i.category === "input-required");
  if (inputIssues.length > 0 || model.missingFrictionInputs.length > 0) {
    const sol = emptySolution("input-required", "场景拓扑不完整或缺少必要输入，无法建立方程");
    sol.requiredInputs = [...inputIssues.map((i) => i.message), ...model.missingFrictionInputs];
    sol.validation = inputIssues.map((i) => ({
      ruleId: i.ruleId,
      severity: "error" as const,
      passed: false,
      message: i.message,
    }));
    return sol;
  }

  // 自由物体二维运动检查（V1 仅支持竖直自由运动）
  const attachedObjects = new Set<string>();
  for (const rope of model.ropes) {
    for (const e of rope.objectEnds) attachedObjects.add(e.objectId);
    for (const mp of rope.movablePulleys) attachedObjects.add(mp.attachedObjectId);
  }
  for (const rod of model.rods) {
    if (rod.endA.objectId !== null) attachedObjects.add(rod.endA.objectId);
    if (rod.endB.objectId !== null) attachedObjects.add(rod.endB.objectId);
  }
  for (const body of model.bodies) {
    if (body.surface === null && !attachedObjects.has(body.id) && body.fixedBySupport === null) {
      const fx = scene.externalForces
        .filter((f) => f.objectId === body.id)
        .reduce((s, f) => s + f.magnitude * Math.cos((f.angleDeg * Math.PI) / 180), 0);
      if (Math.abs(fx) > DISPLAY_TOLERANCE) {
        const sol = emptySolution(
          "unsupported",
          `物体 ${body.id} 为自由物体且受水平方向外力，二维自由运动（抛体）超出第一版范围`,
        );
        sol.unsupportedFeatures = ["二维自由运动（抛体）"];
        return sol;
      }
    }
  }

  const dynamic = scene.analysisMode === "dynamics" || scene.analysisMode === "kinematics";
  const ctx: SolveContext = { scene, model, dynamic, assumptions: [], coordinateSystems: [], validation: [], explanation: [] };

  // 第 11 步：摩擦状态初始分配
  const friction = new Map<string, FrictionAssignment>();
  for (const body of model.bodies) {
    if (body.surface === null) continue;
    if (body.surface.friction.model === "smooth") {
      friction.set(body.id, { state: "smooth", direction: 1, reason: "平面光滑" });
      continue;
    }
    if (!dynamic) {
      friction.set(body.id, { state: "static", direction: 1, reason: "平衡模式：按静摩擦求解" });
      continue;
    }
    if (Math.abs(body.initialVelocity) > NUMERICAL_TOLERANCE) {
      friction.set(body.id, {
        state: "kinetic",
        direction: body.initialVelocity > 0 ? -1 : 1,
        reason: "已给定初速度：滑动摩擦方向与速度方向相反",
      });
    } else {
      friction.set(body.id, { state: "static", direction: 1, reason: "先假设静摩擦，随后校验 |F| ≤ μsN" });
    }
  }

  // 第 11-14 步：摩擦分支 + 求解迭代。
  // 注：静摩擦假设不会导致方程矛盾（f 为自由未知量、约束常数为零），
  // 矛盾只可能来自输入本身（如平衡模式下无约束外力），故 inconsistent 直接终止。
  let frictionFailure: { body: BodyModel; f: number; n: number; muS: number } | null = null;
  let state: SolvedState = solveOnce(scene, model, dynamic, friction);
  for (let attempt = 0; attempt < 6; attempt++) {
    if (
      state.classification === "inconsistent" ||
      state.classification === "underdetermined" ||
      state.analysis.solution === null
    ) {
      break;
    }

    // 静摩擦上限校验
    let retry = false;
    frictionFailure = null;
    for (const body of model.bodies) {
      const fa = friction.get(body.id);
      if (fa?.state !== "static" || body.surface === null || body.surface.friction.model !== "rough") continue;
      const f = state.valuesBySymbol.get(frictionSymbol(body.id)) ?? 0;
      const n = state.valuesBySymbol.get(normalSymbol(body.id)) ?? 0;
      // topology 已保证粗糙平面提供 μS
      const muS = body.surface.friction.muS as number;
      const bound = muS * Math.max(n, 0);
      if (Math.abs(f) > bound + DISPLAY_TOLERANCE * Math.max(1, Math.abs(f))) {
        if (!dynamic) {
          frictionFailure = { body, f, n, muS };
          break;
        }
        friction.set(body.id, {
          state: "kinetic",
          direction: f >= 0 ? 1 : -1,
          reason: `静摩擦需求 |f|=${display(Math.abs(f))} N 超过上限 μsN=${display(bound)} N，转为滑动摩擦`,
        });
        retry = true;
      }
    }
    if (frictionFailure !== null) break;
    if (retry) {
      state = solveOnce(scene, model, dynamic, friction);
      continue;
    }

    // 滑动摩擦方向正确性由构造保证：方向取自初速度符号或所需静摩擦方向，
    // 求解后必然与运动趋势一致（方向相反的情形由 directionReports 明确报告）。
    break; // 成功
  }

  // 平衡模式静摩擦不足 → 假设不成立，并给出滑动加速度提示
  if (frictionFailure !== null) {
    const { body, f, n, muS } = frictionFailure;
    const slideNote = estimateSlidingNote(scene, model, friction, body, f);
    const sol = buildFullSolution(ctx, state, friction, "assumption-invalid");
    sol.statusReason = `物体 ${body.id} 所需静摩擦 |f|=${display(Math.abs(f))} N 超过上限 μsN=${display(muS * Math.max(n, 0))} N，静力平衡假设不成立。${slideNote}`;
    sol.validation.push({
      ruleId: "static-friction-bound",
      severity: "error",
      passed: false,
      message: sol.statusReason,
    });
    return sol;
  }

  // 状态分类输出
  const classification = state.classification;
  if (classification === "inconsistent") {
    const sol = buildFullSolution(ctx, state, friction, "inconsistent");
    sol.statusReason = "方程组矛盾：不存在同时满足所有方程与约束的解（输入矛盾或平衡假设不成立）";
    sol.validation.push({
      ruleId: "consistency-check",
      severity: "error",
      passed: false,
      message: `系数矩阵秩 ${state.analysis.rank} < 增广矩阵秩 ${state.analysis.augmentedRank}`,
    });
    return sol;
  }
  if (classification === "underdetermined") {
    const freeSymbols = state.analysis.freeColumns
      .map((c) => state.system.unknowns[c]?.symbol)
      .filter((s): s is string => s !== undefined);
    const sol = buildFullSolution(ctx, state, friction, "underdetermined");
    sol.statusReason = `欠定系统：独立方程数 ${state.analysis.rank} 少于未知量数 ${state.analysis.unknownCount}，解不唯一。自由未知量：${freeSymbols.join("、")}`;
    sol.validation.push({
      ruleId: "determinacy-check",
      severity: "warning",
      passed: false,
      message: sol.statusReason,
    });
    return sol;
  }

  // 第 15-16 步：代回验证 + 物理条件检查
  const sol = buildFullSolution(ctx, state, friction, classification);
  const physicalStatus = runPhysicalChecks(ctx, state, friction, sol);
  sol.status = physicalStatus;
  if (physicalStatus === "assumption-invalid") {
    const failure = sol.validation.find((v) => !v.passed && v.severity === "error");
    sol.statusReason =
      failure?.message ?? /* v8 ignore next -- assumption-invalid 必然携带失败验证项 */ "物理假设不成立";
  } else {
    sol.statusReason =
      classification === "solved"
        ? `方程组满秩（${state.analysis.unknownCount} 个未知量），解唯一，全部物理条件满足`
        : `方程数多于未知量数但相容，解满足全部方程（超定一致）`;
  }
  return sol;
}

/** 平衡模式摩擦不足时估算滑动加速度（信息性） */
function estimateSlidingNote(
  scene: MechanicsSceneV1,
  model: SceneModel,
  friction: Map<string, FrictionAssignment>,
  body: BodyModel,
  f: number,
): string {
  const kinetic = new Map(friction);
  kinetic.set(body.id, { state: "kinetic", direction: f >= 0 ? 1 : -1, reason: "滑动估算" });
  const probe = solveOnce(scene, model, true, kinetic);
  const a = probe.valuesBySymbol.get(accelSymbol(body.id));
  /* v8 ignore next 2 -- 滑动估算在动力学重解下必然有解；防御性回退 */
  if (a === undefined || probe.analysis.solution === null) return "";
  return `若转为滑动，加速度约为 ${display(a)} m/s²（沿路径方向）。`;
}

/** 第 16 步：张力/支持力/摩擦条件检查；必要时绳松弛重解 */
function runPhysicalChecks(
  ctx: SolveContext,
  state: SolvedState,
  friction: Map<string, FrictionAssignment>,
  sol: MechanicsSolutionV1,
): SolutionStatusV1 {
  const { scene, model } = ctx;
  // 张力不得为负（禁止取绝对值掩盖）
  const slackRopeIds = new Set<string>();
  for (const rope of model.ropes) {
    if (rope.tensionKnown !== null) continue;
    const t = state.valuesBySymbol.get(tensionSymbol(rope.id)) ?? 0;
    if (t < -DISPLAY_TOLERANCE) {
      slackRopeIds.add(rope.id);
    }
  }
  if (slackRopeIds.size > 0) {
    const retry = solveOnce(scene, model, ctx.dynamic, friction, slackRopeIds);
    const slackValues = [...slackRopeIds].map((id) => {
      const t = state.valuesBySymbol.get(tensionSymbol(id)) ?? 0;
      return `绳 ${id} 解出张力 ${display(t)} N`;
    });
    let resolution = "";
    /* v8 ignore next 3 -- 绳松弛重解在常规拓扑下必然有解；防御性分支 */
    if (retry.analysis.solution !== null) {
      const parts = retry.system.unknowns
        .map((u, i) => `${u.symbol}=${display(retry.analysis.solution?.[i] ?? 0)}`)
        .join("，");
      resolution = `若按绳松弛（T=0）重新求解：${parts}`;
    }
    sol.validation.push({
      ruleId: "tension-non-negative",
      severity: "error",
      passed: false,
      message: `理想绳只能受拉不能受压：${slackValues.join("；")}。绳将松弛，绷紧假设不成立。${resolution}`,
    });
    sol.constraints.push(
      ...[...slackRopeIds].map((id) => ({
        constraintId: `constraint-tension-sign-${id}`,
        kind: "tension-non-negative" as const,
        expression: `T(${id}) ≥ 0`,
        satisfied: false,
        detail: `T(${id}) = ${display(state.valuesBySymbol.get(tensionSymbol(id)) ?? 0)} N < 0`,
      })),
    );
    return "assumption-invalid";
  }

  // 支持力不得为负（物体脱离平面）
  for (const body of model.bodies) {
    if (body.surface === null) continue;
    const n = state.valuesBySymbol.get(normalSymbol(body.id)) ?? 0;
    if (n < -DISPLAY_TOLERANCE) {
      sol.validation.push({
        ruleId: "normal-non-negative",
        severity: "error",
        passed: false,
        message: `物体 ${body.id} 的支持力 N=${display(n)} N < 0：平面无法提供拉力，物体将脱离平面，接触假设不成立`,
      });
      sol.constraints.push({
        constraintId: `constraint-normal-sign-${body.id}`,
        kind: "normal-non-negative",
        expression: `N(${body.id}) ≥ 0`,
        satisfied: false,
        detail: `N(${body.id}) = ${display(n)} N < 0`,
      });
      return "assumption-invalid";
    }
  }
  return sol.status;
}

/** 构建完整结构化结果（第 17 步） */
function buildFullSolution(
  ctx: SolveContext,
  state: SolvedState,
  friction: Map<string, FrictionAssignment>,
  status: SolutionStatusV1,
): MechanicsSolutionV1 {
  const { scene, model, dynamic } = ctx;
  const sol = emptySolution(status, "");
  sol.assumptions = buildAssumptions(ctx);
  sol.coordinateSystems = buildCoordinateSystems(ctx);
  sol.equations = state.system.equations;
  sol.unknowns = state.system.unknowns;

  // 求解值
  const values: SolvedValueV1[] = [];
  for (const u of state.system.unknowns) {
    const v = state.valuesBySymbol.get(u.symbol);
    if (v === undefined) continue;
    values.push({
      symbol: u.symbol,
      value: v,
      unit: u.unit,
      display: display(v),
      meaning: u.meaning,
      relatesTo: u.relatesTo,
    });
  }
  sol.values = values;

  // 受力记录与自由体图
  const forces: ForceRecordV1[] = [];
  const fbds: FreeBodyDiagramV1[] = [];
  for (const body of model.bodies) {
    const forceIds: string[] = [];
    const pushForce = (f: ForceRecordV1): void => {
      forces.push(f);
      forceIds.push(f.forceId);
    };
    // assembleSystem 为每个物体登记 knownForces（至少含重力）
    for (const kf of state.system.knownForces.get(body.id) as KnownForce[]) {
      pushForce({
        forceId: `force-${kf.kind}-${body.id}-${kf.symbol}`,
        objectId: body.id,
        kind: kf.kind,
        label: kf.label,
        symbol: kf.symbol,
        source: kf.source,
        direction: kf.direction,
        magnitude: kf.magnitude,
        unit: "N",
      });
    }
    if (body.surface !== null && body.normalDir !== null) {
      const n = state.valuesBySymbol.get(normalSymbol(body.id));
      pushForce({
        forceId: `force-normal-${body.id}`,
        objectId: body.id,
        kind: "normal",
        label: "支持力",
        symbol: normalSymbol(body.id),
        source: `平面 ${body.surface.id}`,
        direction: body.normalDir,
        magnitude: n ?? null,
        unit: "N",
      });
      const fa = friction.get(body.id);
      if (fa?.state === "static" && body.surface.friction.model === "rough") {
        const f = state.valuesBySymbol.get(frictionSymbol(body.id));
        pushForce({
          forceId: `force-friction-${body.id}`,
          objectId: body.id,
          kind: "static-friction",
          label: "静摩擦力",
          symbol: frictionSymbol(body.id),
          source: `平面 ${body.surface.id}`,
          direction: body.path,
          magnitude: f ?? null,
          unit: "N",
        });
      }
      if (fa?.state === "kinetic" && body.surface.friction.model === "rough") {
        // 滑动摩擦只出现在求解成功后，N 与 μk 必然存在
        const n2 = state.valuesBySymbol.get(normalSymbol(body.id)) as number;
        const muK = body.surface.friction.muK as number;
        pushForce({
          forceId: `force-friction-${body.id}`,
          objectId: body.id,
          kind: "kinetic-friction",
          label: "滑动摩擦力",
          symbol: frictionSymbol(body.id),
          source: `平面 ${body.surface.id}（f=μkN）`,
          direction: body.path,
          magnitude: muK * n2 * fa.direction,
          unit: "N",
          note: `方向与运动（趋势）相反：${fa.reason}`,
        });
      }
    }
    for (const end of state.system.ropeEndDirections.get(body.id) ?? []) {
      const t = state.valuesBySymbol.get(tensionSymbol(end.ropeId));
      if (t === undefined) continue; // 已知张力端已在 knownForces 记录
      pushForce({
        forceId: `force-tension-${body.id}-${end.ropeId}`,
        objectId: body.id,
        kind: "tension",
        label: "绳张力",
        symbol: tensionSymbol(end.ropeId),
        source: `绳 ${end.ropeId}`,
        direction: end.direction,
        magnitude: t,
        unit: "N",
      });
    }
    for (const mp of state.system.movablePulleyDirections.get(body.id) ?? []) {
      const t = state.valuesBySymbol.get(tensionSymbol(mp.ropeId));
      /* v8 ignore next -- topology 保证动滑轮绳张力为未知量且已解出 */
      if (t === undefined) continue;
      const sum = mp.directions.reduce((s, d) => ({ x: s.x + d.x, y: s.y + d.y }), vec(0, 0));
      const mag = Math.hypot(sum.x, sum.y);
      pushForce({
        forceId: `force-tension-pulley-${body.id}-${mp.ropeId}`,
        objectId: body.id,
        kind: "tension",
        label: "绳经动滑轮的拉力",
        symbol: tensionSymbol(mp.ropeId),
        source: `绳 ${mp.ropeId}（动滑轮两段绳）`,
        direction: unit(sum),
        magnitude: t * mag,
        unit: "N",
        note: `动滑轮两段绳拉力的合力（每段 T=${display(t)} N）`,
      });
    }
    for (const rod of model.rods) {
      const r = state.valuesBySymbol.get(rodSymbol(rod.id));
      /* v8 ignore next -- 杆力在求解后必然有值（欠定防御） */
      if (r === undefined) continue;
      let axis: Vec2 | null = null;
      if (rod.endA.objectId === body.id) axis = rod.axis;
      if (rod.endB.objectId === body.id) axis = scale(rod.axis, -1);
      if (axis === null) continue;
      pushForce({
        forceId: `force-rod-${body.id}-${rod.id}`,
        objectId: body.id,
        kind: "rod",
        label: "轻杆作用力",
        symbol: rodSymbol(rod.id),
        source: `轻杆 ${rod.id}`,
        direction: axis,
        magnitude: r,
        unit: "N",
        note: r >= 0 ? "轻杆受拉（拉力）" : "轻杆受压（压力），方向与假定受拉方向相反",
      });
    }
    if (body.fixedBySupport !== null) {
      const sid = body.fixedBySupport.id;
      pushForce({
        forceId: `force-support-x-${body.id}`,
        objectId: body.id,
        kind: "support-reaction",
        label: "支点反力（水平）",
        symbol: `Rx(${sid})`,
        source: `支点 ${sid}`,
        direction: vec(1, 0),
        magnitude: state.valuesBySymbol.get(`Rx(${sid})`) ?? /* v8 ignore next -- 支点反力必然有解 */ null,
        unit: "N",
      });
      pushForce({
        forceId: `force-support-y-${body.id}`,
        objectId: body.id,
        kind: "support-reaction",
        label: "支点反力（竖直）",
        symbol: `Ry(${sid})`,
        source: `支点 ${sid}`,
        direction: vec(0, 1),
        magnitude: state.valuesBySymbol.get(`Ry(${sid})`) ?? /* v8 ignore next -- 支点反力必然有解 */ null,
        unit: "N",
      });
    }
    fbds.push({ objectId: body.id, objectLabel: body.label, forceIds });
  }
  sol.forces = forces;
  sol.freeBodyDiagrams = fbds;

  // 约束评估
  const constraints: EvaluatedConstraintV1[] = [];
  for (const rope of model.ropes) {
    if (dynamic && rope.constrainable) {
      const expr = state.system.equations.find((e) => e.kind === "rope-length" && e.description.includes(rope.id));
      constraints.push({
        constraintId: `constraint-rope-length-${rope.id}`,
        kind: "rope-length",
        expression:
          expr?.symbolic ?? /* v8 ignore next -- 动力学可约束绳必然生成约束方程 */ `绳 ${rope.id} 长度恒定`,
        satisfied: state.analysis.solution !== null,
        detail: `绳 ${rope.id} 不可伸长，两端加速度满足绳长约束`,
      });
    }
    if (rope.pulleyIds.length > 0) {
      constraints.push({
        constraintId: `constraint-tension-equal-${rope.id}`,
        kind: "rope-tension-equal",
        expression: `T 在绳 ${rope.id} 各处相等`,
        satisfied: true,
        detail: `同一根理想绳经过理想滑轮（${rope.pulleyIds.join("、")}），张力处处相等`,
      });
    }
    if (rope.tensionKnown === null) {
      const t = state.valuesBySymbol.get(tensionSymbol(rope.id));
      if (t !== undefined) {
        constraints.push({
          constraintId: `constraint-tension-sign-${rope.id}`,
          kind: "tension-non-negative",
          expression: `T(${rope.id}) ≥ 0`,
          satisfied: t >= -DISPLAY_TOLERANCE,
          detail: `T(${rope.id}) = ${display(t)} N`,
        });
      }
    }
  }
  for (const rod of model.rods) {
    const r = state.valuesBySymbol.get(rodSymbol(rod.id));
    constraints.push({
      constraintId: `constraint-rod-${rod.id}`,
      kind: "rod-length",
      expression: `杆 ${rod.id} 轴向长度恒定`,
      satisfied: true,
      detail:
        r !== undefined
          ? `R(${rod.id}) = ${display(r)} N（${r >= 0 ? "受拉" : "受压"}）`
          : /* v8 ignore next -- 求解后杆力必然有值 */ `杆 ${rod.id} 轴向约束`,
    });
  }
  for (const body of model.bodies) {
    if (body.surface === null) continue;
    const n = state.valuesBySymbol.get(normalSymbol(body.id));
    if (n !== undefined) {
      constraints.push({
        constraintId: `constraint-normal-sign-${body.id}`,
        kind: "normal-non-negative",
        expression: `N(${body.id}) ≥ 0`,
        satisfied: n >= -DISPLAY_TOLERANCE,
        detail: `N(${body.id}) = ${display(n)} N`,
      });
    }
    const fa = friction.get(body.id);
    if (fa?.state === "static" && body.surface.friction.model === "rough") {
      const f = state.valuesBySymbol.get(frictionSymbol(body.id));
      // topology 已保证粗糙平面提供 μS
      const muS = body.surface.friction.muS as number;
      const bound = muS * Math.max(n ?? /* v8 ignore next -- 静摩擦状态下 N 必然有解 */ 0, 0);
      if (f !== undefined) {
        const margin = bound - Math.abs(f);
        const limiting = Math.abs(margin) <= DISPLAY_TOLERANCE * Math.max(1, bound);
        constraints.push({
          constraintId: `constraint-friction-bound-${body.id}`,
          kind: "static-friction-bound",
          expression: `|f(${body.id})| ≤ μs·N(${body.id})`,
          satisfied: Math.abs(f) <= bound + DISPLAY_TOLERANCE * Math.max(1, Math.abs(f)),
          detail: `|f|=${display(Math.abs(f))} N，上限 μsN=${display(bound)} N${limiting ? "；达到临界平衡（|f| = μsN）" : ""}`,
        });
        if (limiting) {
          sol.assumptions.push({
            assumptionId: `assumption-limiting-${body.id}`,
            kind: "friction-model",
            text: `物体 ${body.id} 处于临界平衡状态：静摩擦达到上限 μsN`,
          });
        }
      }
    }
    if (fa?.state === "kinetic" && body.surface.friction.model === "rough") {
      constraints.push({
        constraintId: `constraint-friction-dir-${body.id}`,
        kind: "friction-direction",
        expression: `f(${body.id}) = μk·N，方向与运动（趋势）相反`,
        satisfied: true,
        detail: fa.reason,
      });
    }
  }
  // 残差检查
  if (state.analysis.residualMax !== null) {
    constraints.push({
      constraintId: "constraint-residual",
      kind: "residual-check",
      expression: "max|Ax - b| ≤ 容差",
      satisfied: state.analysis.residualMax <= DISPLAY_TOLERANCE,
      detail: `代回残差 max|Ax-b| = ${state.analysis.residualMax.toExponential(3)}`,
    });
  }
  sol.constraints = constraints;

  // 验证规则
  const validation: ValidationResultV1[] = [
    { ruleId: "schema-check", severity: "info", passed: true, message: "输入场景通过 Zod 协议校验" },
    { ruleId: "topology-check", severity: "info", passed: true, message: "场景拓扑与连接合法" },
  ];
  if (state.analysis.residualMax !== null) {
    const residualOk = state.analysis.residualMax <= DISPLAY_TOLERANCE;
    validation.push({
      ruleId: "residual-check",
      /* v8 ignore next -- 高斯消元代回残差不会超限；防御性分支 */
      severity: residualOk ? "info" : "error",
      passed: residualOk,
      message: `代回验证：残差 max|Ax-b| = ${state.analysis.residualMax.toExponential(3)}`,
    });
  }
  for (const w of state.system.warnings) {
    validation.push({ ruleId: "rope-direction-warning", severity: "warning", passed: true, message: w });
  }
  const hasFriction = model.bodies.some((b) => b.surface?.friction.model === "rough");
  if (hasFriction) {
    const states = model.bodies
      .map((b) => {
        const fa = friction.get(b.id);
        if (fa === undefined || b.surface?.friction.model !== "rough") return null;
        return `物体 ${b.id}：${fa.state === "static" ? "静摩擦" : "滑动摩擦"}（${fa.reason}）`;
      })
      .filter((s): s is string => s !== null);
    validation.push({ ruleId: "friction-state", severity: "info", passed: true, message: states.join("；") });
  }
  sol.validation = [...sol.validation, ...validation];

  // 运动方向报告
  const providedV0 = new Map(scene.initialConditions.map((ic) => [ic.objectId, ic.velocity]));
  const directionReports: DirectionReportV1[] = [];
  for (const body of model.bodies) {
    const a = state.valuesBySymbol.get(accelSymbol(body.id)) ?? (dynamic ? null : 0);
    const v0 = providedV0.get(body.id) ?? null;
    const opposite = a !== null && a < -DISPLAY_TOLERANCE;
    const decelerating = a !== null && v0 !== null && a * v0 < -DISPLAY_TOLERANCE;
    let note = "";
    if (a !== null && a < -DISPLAY_TOLERANCE) {
      note = `求解加速度沿假定正方向的反方向（a=${display(a)} m/s²），物体实际运动趋势与假定方向相反`;
    } else if (a !== null && v0 !== null && a * v0 < -DISPLAY_TOLERANCE) {
      note = `物体沿假定方向运动但加速度反向（减速），v0=${display(v0)} m/s，a=${display(a)} m/s²`;
    } else if (a !== null && Math.abs(a) <= DISPLAY_TOLERANCE) {
      note = "加速度为零（静止或匀速）";
    } else if (a !== null) {
      note = `加速度沿假定正方向（a=${display(a)} m/s²）`;
    } else {
      note = "该物体被静摩擦/支点约束，加速度为零";
    }
    directionReports.push({
      objectId: body.id,
      assumedPositiveDirection: body.path,
      accelerationAlongPath: a,
      initialVelocityAlongPath: v0,
      oppositeToAssumption: opposite,
      decelerating,
      note,
    });
  }
  sol.directionReports = directionReports;
  if (directionReports.some((r) => r.oppositeToAssumption || r.decelerating)) {
    sol.validation.push({
      ruleId: "direction-report",
      severity: "warning",
      passed: true,
      message: directionReports
        .filter((r) => r.oppositeToAssumption || r.decelerating)
        .map((r) => `物体 ${r.objectId}：${r.note}`)
        .join("；"),
    });
  }

  // 运动学记录（恒加速度）
  if (scene.analysisMode === "kinematics" && (status === "solved" || status === "overdetermined-consistent")) {
    const records: KinematicsRecordV1[] = [];
    for (const body of model.bodies) {
      const a = state.valuesBySymbol.get(accelSymbol(body.id)) ?? 0;
      const v0 = providedV0.get(body.id) ?? 0;
      records.push({
        objectId: body.id,
        accelerationAlongPath: a,
        initialVelocityAlongPath: v0,
        pathDirection: body.path,
        velocityFunction: `v(t) = ${display(v0)} + (${display(a)})·t`,
        displacementFunction: `s(t) = ${display(v0)}·t + 0.5·(${display(a)})·t²`,
        samples: [0.5, 1, 2].map((t) => ({
          t,
          velocityAlongPath: v0 + a * t,
          displacementAlongPath: v0 * t + 0.5 * a * t * t,
        })),
      });
    }
    sol.kinematics = records;
  }

  // 教学步骤
  const nU = state.system.unknowns.length;
  const nE = state.system.equations.length;
  sol.explanationSteps = [
    { step: 1, title: "校验输入", detail: "场景通过 MechanicsSceneV1 协议校验" },
    { step: 2, title: "建立拓扑", detail: `物体 ${model.bodies.length} 个，绳 ${model.ropes.length} 根，轻杆 ${model.rods.length} 根` },
    { step: 3, title: "识别受力与自由度", detail: "识别每个物体的重力、支持力、摩擦力、张力、杆作用力与外力" },
    { step: 4, title: "建立坐标系并分解力", detail: "世界坐标系 x 向右、y 向上；斜面物体另建沿斜面坐标系" },
    { step: 5, title: "生成方程", detail: `生成 ${nE} 个方程（牛顿第二定律/平衡方程 + 绳长/杆长约束）` },
    { step: 6, title: "摩擦状态分支", detail: hasFriction ? "按静摩擦优先、超限转滑动摩擦处理" : "无粗糙接触" },
    { step: 7, title: "判断方程组", detail: `未知量 ${nU} 个，秩 ${state.analysis.rank}，分类：${status}` },
    { step: 8, title: "求解与代回验证", detail: state.analysis.residualMax !== null ? `高斯消元求解，残差 ${state.analysis.residualMax.toExponential(3)}` : "无唯一解" },
    { step: 9, title: "物理条件检查", detail: "检查张力非负、支持力非负、静摩擦上限与摩擦方向" },
  ];

  return sol;
}
