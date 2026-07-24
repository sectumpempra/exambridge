/**
 * 方程生成（求解流程第 5-11 步）：
 * 受力识别 → 坐标系 → 力分解 → 牛顿第二定律/平衡方程 → 绳长/杆长约束 → 摩擦状态建模。
 *
 * 约定：
 * - 所有方程在世界坐标 x/y 两个方向建立：Σ terms = constant；
 * - 绳方向按 V1 理想化：当绳段与物体路径方向夹角 ≤45° 时吸附到路径方向
 *   （理想滑轮切线模型，见 reports/physics-model.md 的已知近似）；
 * - 静摩擦为未知量 f（沿路径带符号）；动摩擦为 μk·N 折叠进 N 的系数，方向与运动（趋势）相反。
 */
import type { MechanicsEquationV1, MechanicsSceneV1, MechanicsUnknownV1 } from "@/features/mechanics-lab/schema";
import { ROPE_SNAP_COSINE } from "./tolerances.js";
import type { SceneModel } from "./topology.js";
import { dot, fromAngleDeg, scale, unit, vec, type Vec2 } from "./vec2.js";

/** 摩擦状态分配 */
export interface FrictionAssignment {
  state: "smooth" | "static" | "kinetic";
  /** kinetic：摩擦方向系数（+1 沿路径正方向，-1 沿路径反方向） */
  direction: 1 | -1;
  reason: string;
}

/** 已识别且大小已知的力（重力、外力、已知张力端） */
export interface KnownForce {
  label: string;
  symbol: string;
  source: string;
  kind: "gravity" | "applied" | "tension";
  direction: Vec2;
  magnitude: number;
}

export interface AssembledSystem {
  unknowns: MechanicsUnknownV1[];
  equations: MechanicsEquationV1[];
  /** 绳方向未沿路径的警告（仍按几何方向计算） */
  warnings: string[];
  /** 每个物体识别出的已知力（重力+外力+已知张力端），用于受力记录 */
  knownForces: Map<string, KnownForce[]>;
  /** 每个物体端点的绳方向（吸附后），供受力记录使用 */
  ropeEndDirections: Map<string, { ropeId: string; direction: Vec2 }[]>;
  /** 动滑轮作用方向（吸附后每段 ±path） */
  movablePulleyDirections: Map<string, { ropeId: string; directions: Vec2[] }[]>;
}

const fmt = (v: number): string => {
  const r = Math.abs(v) < 1e-12 ? 0 : v;
  return Number(r.toFixed(6)).toString();
};

function symbolic(terms: { symbol: string; coefficient: number }[], constant: number): string {
  const parts = terms.map((t) => {
    const sign = t.coefficient < 0 ? "-" : "+";
    return `${sign} ${fmt(Math.abs(t.coefficient))}·${t.symbol}`;
  });
  const lhs = parts.length === 0 ? "0" : parts.join(" ").replace(/^\+ /, "");
  return `${lhs} = ${fmt(constant)}`;
}

/** 绳方向吸附：|cos| ≥ cos45° 时理想化为 ±path；否则保留几何方向并告警 */
function snapToPath(direction: Vec2, path: Vec2, context: string, warnings: string[]): Vec2 {
  const cos = dot(direction, path);
  if (Math.abs(cos) >= ROPE_SNAP_COSINE) {
    return scale(path, cos >= 0 ? 1 : -1);
  }
  warnings.push(`${context}：绳方向与物体运动路径夹角超过 45°，按几何方向计算（V1 理想化之外）`);
  return unit(direction);
}

export function tensionSymbol(ropeId: string): string {
  return `T(${ropeId})`;
}
export function normalSymbol(objectId: string): string {
  return `N(${objectId})`;
}
export function frictionSymbol(objectId: string): string {
  return `f(${objectId})`;
}
export function rodSymbol(rodId: string): string {
  return `R(${rodId})`;
}
export function accelSymbol(objectId: string): string {
  return `a(${objectId})`;
}

/**
 * 组装线性方程组。
 * @param dynamic true=动力学/运动学（含加速度未知量与约束方程）；false=平衡类模式
 * @param friction 每个有平面接触物体的摩擦状态分配
 * @param slackRopes 按松弛处理的绳 id（不提供张力、不提供约束）
 */
export function assembleSystem(
  scene: MechanicsSceneV1,
  model: SceneModel,
  dynamic: boolean,
  friction: Map<string, FrictionAssignment>,
  slackRopes: ReadonlySet<string> = new Set<string>(),
): AssembledSystem {
  const unknowns: MechanicsUnknownV1[] = [];
  const unknownSet = new Set<string>();
  const equations: MechanicsEquationV1[] = [];
  const warnings: string[] = [];
  const knownForces: AssembledSystem["knownForces"] = new Map();
  const ropeEndDirections: AssembledSystem["ropeEndDirections"] = new Map();
  const movablePulleyDirections: AssembledSystem["movablePulleyDirections"] = new Map();

  const addUnknown = (u: MechanicsUnknownV1): void => {
    if (!unknownSet.has(u.symbol)) {
      unknownSet.add(u.symbol);
      unknowns.push(u);
    }
  };

  const bodyById = new Map(model.bodies.map((b) => [b.id, b]));
  const ropes = model.ropes.filter((r) => !slackRopes.has(r.id));

  // ---- 注册未知量 ----
  for (const rope of ropes) {
    if (rope.tensionKnown === null) {
      addUnknown({
        symbol: tensionSymbol(rope.id),
        meaning: `绳 ${rope.id} 的张力`,
        unit: "N",
        relatesTo: { kind: "rope", id: rope.id },
      });
    }
  }
  for (const rod of model.rods) {
    addUnknown({
      symbol: rodSymbol(rod.id),
      meaning: `轻杆 ${rod.id} 的轴向力（正=拉，负=压）`,
      unit: "N",
      relatesTo: { kind: "rod", id: rod.id },
    });
  }
  for (const body of model.bodies) {
    if (body.surface !== null) {
      addUnknown({
        symbol: normalSymbol(body.id),
        meaning: `物体 ${body.id} 受到的支持力`,
        unit: "N",
        relatesTo: { kind: "contact", id: body.id },
      });
      const fa = friction.get(body.id);
      if (fa?.state === "static") {
        addUnknown({
          symbol: frictionSymbol(body.id),
          meaning: `物体 ${body.id} 受到的静摩擦力（沿路径带符号）`,
          unit: "N",
          relatesTo: { kind: "contact", id: body.id },
        });
      }
    }
    if (body.fixedBySupport !== null) {
      addUnknown({
        symbol: `Rx(${body.fixedBySupport.id})`,
        meaning: `支点 ${body.fixedBySupport.id} 的水平反力`,
        unit: "N",
        relatesTo: { kind: "support", id: body.fixedBySupport.id },
      });
      addUnknown({
        symbol: `Ry(${body.fixedBySupport.id})`,
        meaning: `支点 ${body.fixedBySupport.id} 的竖直反力`,
        unit: "N",
        relatesTo: { kind: "support", id: body.fixedBySupport.id },
      });
    }
  }
  // 加速度未知量：动力学模式、未被支点固定、未被静摩擦锁定
  const accelBodies = new Set<string>();
  if (dynamic) {
    for (const body of model.bodies) {
      const fa = friction.get(body.id);
      const staticLocked = fa?.state === "static";
      if (body.fixedBySupport === null && !staticLocked) {
        accelBodies.add(body.id);
        addUnknown({
          symbol: accelSymbol(body.id),
          meaning: `物体 ${body.id} 沿路径的加速度`,
          unit: "m/s^2",
          relatesTo: { kind: "object", id: body.id },
        });
      }
    }
  }

  // ---- 每个物体的牛顿方程（x/y 两个方向） ----
  let eqCounter = 0;
  for (const body of model.bodies) {
    const known = knownForces.get(body.id) ?? [];
    // 已知力：重力
    known.push({
      label: "重力",
      symbol: `G(${body.id})`,
      source: "地球",
      kind: "gravity",
      direction: vec(0, 1),
      magnitude: -body.mass * scene.gravity,
    });
    // 已知力：外加力
    for (const f of scene.externalForces.filter((f) => f.objectId === body.id)) {
      known.push({
        label: f.label ?? `外力 ${f.id}`,
        symbol: `F(${f.id})`,
        source: `外力 ${f.id}`,
        kind: "applied",
        direction: fromAngleDeg(f.angleDeg),
        magnitude: f.magnitude,
      });
    }
    knownForces.set(body.id, known);

    const termsX: { symbol: string; coefficient: number }[] = [];
    const termsY: { symbol: string; coefficient: number }[] = [];
    let knownX = 0;
    let knownY = -body.mass * scene.gravity;
    for (const f of scene.externalForces.filter((f) => f.objectId === body.id)) {
      const d = fromAngleDeg(f.angleDeg);
      knownX += f.magnitude * d.x;
      knownY += f.magnitude * d.y;
    }

    // 支持力（+动摩擦折叠）
    if (body.surface !== null && body.normalDir !== null) {
      const fa = friction.get(body.id);
      let nx = body.normalDir.x;
      let ny = body.normalDir.y;
      if (fa?.state === "kinetic" && body.surface.friction.model === "rough") {
        const muK = body.surface.friction.muK ?? 0;
        nx += muK * fa.direction * body.path.x;
        ny += muK * fa.direction * body.path.y;
      }
      termsX.push({ symbol: normalSymbol(body.id), coefficient: nx });
      termsY.push({ symbol: normalSymbol(body.id), coefficient: ny });
      if (fa?.state === "static") {
        termsX.push({ symbol: frictionSymbol(body.id), coefficient: body.path.x });
        termsY.push({ symbol: frictionSymbol(body.id), coefficient: body.path.y });
      }
    }

    // 绳端张力
    for (const rope of ropes) {
      for (const end of rope.objectEnds.filter((e) => e.objectId === body.id)) {
        const dir = snapToPath(end.direction, body.path, `绳 ${rope.id} 在物体 ${body.id} 端`, warnings);
        const list = ropeEndDirections.get(body.id) ?? [];
        list.push({ ropeId: rope.id, direction: dir });
        ropeEndDirections.set(body.id, list);
        if (rope.tensionKnown === null) {
          termsX.push({ symbol: tensionSymbol(rope.id), coefficient: dir.x });
          termsY.push({ symbol: tensionSymbol(rope.id), coefficient: dir.y });
        } else {
          knownX += rope.tensionKnown * dir.x;
          knownY += rope.tensionKnown * dir.y;
          known.push({
            label: `绳 ${rope.id} 张力（绳端拉力已知）`,
            symbol: `T(${rope.id})`,
            source: `绳 ${rope.id}`,
            kind: "tension",
            direction: dir,
            magnitude: rope.tensionKnown,
          });
        }
      }
      // 动滑轮随动物体：受两段绳拉力（topology 已保证动滑轮绳的张力为未知量）
      for (const mp of rope.movablePulleys.filter((m) => m.attachedObjectId === body.id)) {
        const dirs = mp.segmentDirections.map((d) =>
          snapToPath(d, body.path, `绳 ${rope.id} 在动滑轮 ${mp.pulleyId} 处`, warnings),
        );
        const list = movablePulleyDirections.get(body.id) ?? [];
        list.push({ ropeId: rope.id, directions: dirs });
        movablePulleyDirections.set(body.id, list);
        const sumX = dirs.reduce((s, d) => s + d.x, 0);
        const sumY = dirs.reduce((s, d) => s + d.y, 0);
        if (rope.tensionKnown === null) {
          termsX.push({ symbol: tensionSymbol(rope.id), coefficient: sumX });
          termsY.push({ symbol: tensionSymbol(rope.id), coefficient: sumY });
        }
      }
    }

    // 轻杆轴向力
    for (const rod of model.rods) {
      let axis: Vec2 | null = null;
      if (rod.endA.objectId === body.id) axis = rod.axis; // A 端：力指向 B
      if (rod.endB.objectId === body.id) axis = scale(rod.axis, -1); // B 端：力指向 A
      if (axis !== null) {
        termsX.push({ symbol: rodSymbol(rod.id), coefficient: axis.x });
        termsY.push({ symbol: rodSymbol(rod.id), coefficient: axis.y });
      }
    }

    // 支点反力
    if (body.fixedBySupport !== null) {
      termsX.push({ symbol: `Rx(${body.fixedBySupport.id})`, coefficient: 1 });
      termsY.push({ symbol: `Ry(${body.fixedBySupport.id})`, coefficient: 1 });
    }

    // 加速度项：-m·a·path
    if (accelBodies.has(body.id)) {
      termsX.push({ symbol: accelSymbol(body.id), coefficient: -body.mass * body.path.x });
      termsY.push({ symbol: accelSymbol(body.id), coefficient: -body.mass * body.path.y });
    }

    const modeText = dynamic ? "牛顿第二定律" : "平衡方程";
    eqCounter++;
    equations.push({
      equationId: `eq-${eqCounter}`,
      kind: "newton-x",
      objectId: body.id,
      description: `物体 ${body.id} 的 x 方向${modeText}`,
      terms: termsX,
      constant: -knownX,
      symbolic: symbolic(termsX, -knownX),
    });
    eqCounter++;
    equations.push({
      equationId: `eq-${eqCounter}`,
      kind: "newton-y",
      objectId: body.id,
      description: `物体 ${body.id} 的 y 方向${modeText}`,
      terms: termsY,
      constant: -knownY,
      symbolic: symbolic(termsY, -knownY),
    });
  }

  // ---- 绳长约束（动力学模式；全部端点为物体/锚点的绳） ----
  if (dynamic) {
    for (const rope of ropes) {
      if (!rope.constrainable) continue;
      const terms: { symbol: string; coefficient: number }[] = [];
      for (const seg of rope.segments) {
        const dir = unit({ x: seg.to.position.x - seg.from.position.x, y: seg.to.position.y - seg.from.position.y });
        const addEnd = (end: typeof seg.from, sign: 1 | -1): void => {
          if (end.movingObjectId === null) return;
          if (!accelBodies.has(end.movingObjectId)) return; // 加速度固定为 0（支点/静摩擦锁定）
          const body = bodyById.get(end.movingObjectId);
          /* v8 ignore next -- movingObjectId 必为场景内物体 */
          if (body === undefined) return;
          const cos = dot(dir, body.path);
          const c = Math.abs(cos) >= ROPE_SNAP_COSINE ? (cos >= 0 ? 1 : -1) : cos;
          const existing = terms.find((t) => t.symbol === accelSymbol(body.id));
          if (existing !== undefined) existing.coefficient += sign * c;
          else terms.push({ symbol: accelSymbol(body.id), coefficient: sign * c });
        };
        addEnd(seg.to, 1);
        addEnd(seg.from, -1);
      }
      eqCounter++;
      equations.push({
        equationId: `eq-${eqCounter}`,
        kind: "rope-length",
        description: `绳 ${rope.id} 的绳长约束（不可伸长）`,
        terms,
        constant: 0,
        symbolic: symbolic(terms, 0),
      });
    }

    // ---- 杆长约束 ----
    for (const rod of model.rods) {
      const terms: { symbol: string; coefficient: number }[] = [];
      const addEnd = (objectId: string | null, sign: 1 | -1): void => {
        if (objectId === null || !accelBodies.has(objectId)) return;
        const body = bodyById.get(objectId);
        /* v8 ignore next -- objectId 必为场景内物体 */
        if (body === undefined) return;
        terms.push({ symbol: accelSymbol(objectId), coefficient: sign * dot(rod.axis, body.path) });
      };
      addEnd(rod.endB.objectId, 1);
      addEnd(rod.endA.objectId, -1);
      eqCounter++;
      equations.push({
        equationId: `eq-${eqCounter}`,
        kind: "rod-length",
        description: `轻杆 ${rod.id} 的杆长约束（轴向不可伸缩）`,
        terms,
        constant: 0,
        symbolic: symbolic(terms, 0),
      });
    }
  }

  return { unknowns, equations, warnings, knownForces, ropeEndDirections, movablePulleyDirections };
}
