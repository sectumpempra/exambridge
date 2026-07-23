/**
 * Gold case 运行器：加载 gold-cases/*.json，走「schema 解析 → core 求解 → 多维断言」。
 * 断言维度：状态分类、数值（容差）、受力（方向+带符号大小）、方程结构、约束评估、验证规则触发。
 * 求解器为通用求解，case 预期数值均来自各 case 文件 derivationNotes 中的独立手工推导。
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSceneJson, type MechanicsSolutionV1 } from "@/features/mechanics-lab/schema";
import { solveMechanicsScene } from "@/features/mechanics-lab/core";

const here = dirname(fileURLToPath(import.meta.url));
const goldDir = join(here, "fixtures", "mechanics");

/** 本阶段启用的 case（阶段3：全部 35 个） */
const ENABLED_CASES = new Set([
  "gc-01-smooth-horizontal-equilibrium",
  "gc-02-rough-horizontal-dynamics",
  "gc-03-static-friction-sufficient",
  "gc-04-static-friction-insufficient",
  "gc-05-smooth-incline-dynamics",
  "gc-06-rough-incline-dynamics",
  "gc-07-incline-limiting-equilibrium",
  "gc-08-force-up-incline",
  "gc-09-angled-pull-rough-horizontal",
  "gc-10-two-objects-horizontal-rope",
  "gc-11-atwood-two-hanging",
  "gc-12-table-plus-hanging",
  "gc-13-incline-plus-hanging",
  "gc-14-simple-movable-pulley",
  "gc-15-rod-tension",
  "gc-16-rod-compression",
  "gc-17-multiple-external-forces",
  "gc-18-object-leaves-plane",
  "gc-19-deceleration-direction-report",
  "gc-20-negative-tension",
  "gc-21-rope-slack",
  "gc-22-underdetermined-two-ropes",
  "gc-23-inconsistent-equilibrium",
  "gc-24-broken-rope",
  "gc-25-illegal-pulley-connection",
  "gc-26-negative-mass",
  "gc-27-illegal-friction-coefficient",
  "gc-28-zero-angle-incline",
  "gc-29-kinematics-constant-acceleration",
  "gc-30-corrupted-json",
  "gc-31-unknown-version-json",
  "gc-32-massive-pulley-unsupported",
  "gc-33-spring-connector-unsupported",
  "gc-34-overdetermined-consistent-atwood",
  "gc-35-free-fall",
]);

interface ExpectedTerm {
  symbol: string;
  coefficient: number;
}

interface GoldCase {
  caseId: string;
  title: string;
  expectParse: "ok" | "error";
  expectedParseErrorKind?: "invalid-json" | "unsupported-version" | "schema-violation";
  scene?: unknown;
  sceneJson?: string;
  expected?: {
    status: string;
    statusReasonContains?: string;
    values?: { symbol: string; value: number; tolerance: number }[];
    forces?: {
      objectId: string;
      kind: string;
      magnitude: number;
      direction: { x: number; y: number };
      tolerance: number;
    }[];
    equations?: { objectId?: string; kind: string; termsContain: ExpectedTerm[] }[];
    constraints?: { kind: string; satisfied: boolean }[];
    validationRules?: string[];
    kinematics?: {
      objectId: string;
      accelerationAlongPath: number;
      tolerance: number;
      sampleAt: { t: number; velocityAlongPath: number; displacementAlongPath: number };
    }[];
    assertions?: string[];
  };
  numericTolerance: number;
}

function loadCases(): GoldCase[] {
  return readdirSync(goldDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(goldDir, f), "utf8")) as GoldCase);
}

function assertSolution(gc: GoldCase, solution: MechanicsSolutionV1): void {
  const exp = gc.expected;
  if (exp === undefined) throw new Error(`${gc.caseId} 缺少 expected 字段`);
  expect(solution.status, `${gc.caseId} 状态分类`).toBe(exp.status);
  if (exp.statusReasonContains !== undefined) {
    expect(solution.statusReason).toContain(exp.statusReasonContains);
  }
  for (const v of exp.values ?? []) {
    const found = solution.values.find((sv) => sv.symbol === v.symbol);
    expect(found !== undefined, `${gc.caseId} 应解出 ${v.symbol}`).toBe(true);
    expect(
      Math.abs((found?.value ?? Number.NaN) - v.value),
      `${gc.caseId} ${v.symbol} 数值`,
    ).toBeLessThanOrEqual(v.tolerance);
  }
  for (const f of exp.forces ?? []) {
    const candidates = solution.forces.filter(
      (fr) => fr.objectId === f.objectId && fr.kind === f.kind,
    );
    const hit = candidates.find(
      (fr) =>
        fr.magnitude !== null &&
        Math.abs(fr.magnitude - f.magnitude) <= f.tolerance &&
        Math.abs(fr.direction.x - f.direction.x) <= 1e-6 &&
        Math.abs(fr.direction.y - f.direction.y) <= 1e-6,
    );
    expect(
      hit !== undefined,
      `${gc.caseId} 物体 ${f.objectId} 应有 ${f.kind} 力：大小 ${f.magnitude}，方向 (${f.direction.x}, ${f.direction.y})`,
    ).toBe(true);
  }
  for (const eq of exp.equations ?? []) {
    const candidates = solution.equations.filter(
      (e) => e.kind === eq.kind && (eq.objectId === undefined || e.objectId === eq.objectId),
    );
    const hit = candidates.find((e) =>
      eq.termsContain.every((t) =>
        e.terms.some(
          (et) => et.symbol === t.symbol && Math.abs(et.coefficient - t.coefficient) <= 1e-6,
        ),
      ),
    );
    expect(
      hit !== undefined,
      `${gc.caseId} 应存在方程 kind=${eq.kind} 含项 ${JSON.stringify(eq.termsContain)}`,
    ).toBe(true);
  }
  for (const c of exp.constraints ?? []) {
    const hit = solution.constraints.find((ec) => ec.kind === c.kind && ec.satisfied === c.satisfied);
    expect(hit !== undefined, `${gc.caseId} 应有约束 ${c.kind} satisfied=${c.satisfied}`).toBe(true);
  }
  for (const ruleId of exp.validationRules ?? []) {
    expect(
      solution.validation.some((v) => v.ruleId === ruleId),
      `${gc.caseId} 应触发验证规则 ${ruleId}`,
    ).toBe(true);
  }
  for (const k of exp.kinematics ?? []) {
    const record = solution.kinematics.find((kr) => kr.objectId === k.objectId);
    expect(record !== undefined, `${gc.caseId} 应有物体 ${k.objectId} 的运动学记录`).toBe(true);
    expect(
      Math.abs((record?.accelerationAlongPath ?? Number.NaN) - k.accelerationAlongPath),
      `${gc.caseId} 运动学加速度`,
    ).toBeLessThanOrEqual(k.tolerance);
    const sample = record?.samples.find((s) => Math.abs(s.t - k.sampleAt.t) <= 1e-9);
    expect(sample !== undefined, `${gc.caseId} 应有 t=${k.sampleAt.t} 的采样`).toBe(true);
    expect(
      Math.abs((sample?.velocityAlongPath ?? Number.NaN) - k.sampleAt.velocityAlongPath),
      `${gc.caseId} t=${k.sampleAt.t} 速度`,
    ).toBeLessThanOrEqual(k.tolerance);
    expect(
      Math.abs((sample?.displacementAlongPath ?? Number.NaN) - k.sampleAt.displacementAlongPath),
      `${gc.caseId} t=${k.sampleAt.t} 位移`,
    ).toBeLessThanOrEqual(k.tolerance);
  }
}

describe("gold cases（求解器）", () => {
  const cases = loadCases();
  const enabled = cases.filter((c) => ENABLED_CASES.has(c.caseId));

  it("启用清单中的 case 文件都存在", () => {
    const ids = new Set(cases.map((c) => c.caseId));
    for (const id of ENABLED_CASES) {
      expect(ids.has(id), `缺少 case 文件：${id}`).toBe(true);
    }
  });

  for (const gc of enabled) {
    it(`${gc.caseId}：${gc.title}`, () => {
      const text = gc.sceneJson ?? JSON.stringify(gc.scene);
      const parsed = parseSceneJson(text);
      if (gc.expectParse === "error") {
        expect(parsed.ok, `${gc.caseId} 应被拒绝`).toBe(false);
        if (!parsed.ok && gc.expectedParseErrorKind !== undefined) {
          expect(parsed.kind).toBe(gc.expectedParseErrorKind);
        }
        return;
      }
      expect(parsed.ok, `${gc.caseId} 场景应解析成功`).toBe(true);
      if (!parsed.ok) return;
      const solution = solveMechanicsScene(parsed.scene);
      assertSolution(gc, solution);
    });
  }
});
