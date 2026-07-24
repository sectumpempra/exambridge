import type { Line3V1, Plane3V1, Point3V1 } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  addVectors,
  dotProduct,
  exactVectorFromVector3,
  isZeroRational,
  lineLineAngle,
  linePlaneAngle,
  parallelLinesDistance,
  parallelPlanesDistance,
  planePlaneAngle,
  pointLineDistance,
  pointPlaneDistance,
  pointPointDistance,
  radicalSign,
  radicalsEqual,
  rational,
  scaleVector,
  skewLinesDistance,
  squaredNorm,
  subtractVectors,
  unwrapCoreResult,
  vector3FromExactVector,
  vectorAngle,
} from "@/features/vector-geometry-lab/core";
import type {
  DistanceMeasurement,
  ExactRational,
  ExactVector3,
} from "@/features/vector-geometry-lab/core";
import { mulberry32, randomRational, randomVector } from "./helpers.js";

/**
 * Stage 3 invariant tests (spec §9): distance non-negativity, point–point
 * symmetry, angle ranges, translation invariance, exact rational rotation /
 * reflection invariance, line-direction scaling invariance, plane-equation
 * scaling invariance, and the perpendicularity of nearest-point connectors.
 * All inputs are exact rationals from a seeded mulberry32 PRNG, so every run
 * is reproducible.
 */

const SEED = 20260717;
const ITERATIONS = 24;
/**
 * Rotation/reflection sweeps multiply the iteration count by the number of
 * orthogonal transforms and run the heaviest exact-radical solvers, so they
 * get a smaller (still seeded and deterministic) sample size plus an explicit
 * timeout to stay stable under machine load.
 */
const ROTATION_ITERATIONS = 10;
const ROTATION_TEST_TIMEOUT_MS = 30000;

function nonZeroVector(rand: () => number): ExactVector3 {
  for (;;) {
    const candidate = randomVector(rand);
    if (!isZeroRational(squaredNorm(candidate))) {
      return candidate;
    }
  }
}

function toPoint(pointId: string, position: ExactVector3): Point3V1 {
  return { pointId, label: pointId, position: vector3FromExactVector(position) };
}

function toLine(lineId: string, point: ExactVector3, direction: ExactVector3): Line3V1 {
  return {
    lineId,
    label: lineId,
    point: toPoint(`${lineId}-p`, point),
    direction: vector3FromExactVector(direction),
  };
}

function toPlane(planeId: string, point: ExactVector3, normal: ExactVector3): Plane3V1 {
  return {
    planeId,
    label: planeId,
    point: toPoint(`${planeId}-p`, point),
    normal: vector3FromExactVector(normal),
  };
}

function randomLine(rand: () => number, lineId = "l"): Line3V1 {
  return toLine(lineId, randomVector(rand), nonZeroVector(rand));
}

function randomPlane(rand: () => number, planeId = "pl"): Plane3V1 {
  return toPlane(planeId, randomVector(rand), nonZeroVector(rand));
}

function randomParallelLines(
  rand: () => number,
): { line1: Line3V1; line2: Line3V1 } {
  const direction = nonZeroVector(rand);
  return {
    line1: toLine("l1", randomVector(rand), direction),
    line2: toLine("l2", randomVector(rand), scaleVector(direction, nonZeroRational(rand))),
  };
}

function randomSkewLines(rand: () => number): { line1: Line3V1; line2: Line3V1 } {
  for (;;) {
    const line1 = randomLine(rand, "l1");
    const line2 = randomLine(rand, "l2");
    const outcome = skewLinesDistance(line1, line2);
    if (outcome.ok) {
      return { line1, line2 };
    }
  }
}

function randomParallelPlanes(
  rand: () => number,
): { plane1: Plane3V1; plane2: Plane3V1 } {
  const normal = nonZeroVector(rand);
  return {
    plane1: toPlane("p1", randomVector(rand), normal),
    plane2: toPlane("p2", randomVector(rand), scaleVector(normal, nonZeroRational(rand))),
  };
}

function nonZeroRational(rand: () => number): ExactRational {
  for (;;) {
    const candidate = randomRational(rand);
    if (!isZeroRational(candidate)) {
      return candidate;
    }
  }
}

function exactRadicalOf(measurement: DistanceMeasurement) {
  if (measurement.kind !== "exact") {
    throw new Error("invariant tests use exact inputs only");
  }
  return measurement.radical;
}

/* Exact rational orthogonal maps: 90° rotations and a reflection. */
function rotateZ90(v: ExactVector3): ExactVector3 {
  // (x, y, z) → (−y, x, z): exact 90° rotation about the z-axis.
  return { x: rational(-v.y.numerator, v.y.denominator), y: v.x, z: v.z };
}

function rotateX90(v: ExactVector3): ExactVector3 {
  // (x, y, z) → (x, −z, y): exact 90° rotation about the x-axis.
  return { x: v.x, y: rational(-v.z.numerator, v.z.denominator), z: v.y };
}

function reflectX(v: ExactVector3): ExactVector3 {
  // (x, y, z) → (−x, y, z): exact reflection in the yz-plane.
  return { x: rational(-v.x.numerator, v.x.denominator), y: v.y, z: v.z };
}

const ORTHOGONAL_TRANSFORMS = [rotateZ90, rotateX90, reflectX] as const;

function mapPoint(point: Point3V1, f: (v: ExactVector3) => ExactVector3): Point3V1 {
  return toPoint(point.pointId, f(exactVectorFromVector3(point.position).vector));
}

/** Applies f to BOTH the base point and the direction (rotations/reflections). */
function mapLine(line: Line3V1, f: (v: ExactVector3) => ExactVector3): Line3V1 {
  return toLine(
    line.lineId,
    f(exactVectorFromVector3(line.point.position).vector),
    f(exactVectorFromVector3(line.direction).vector),
  );
}

/** Applies f to BOTH the base point and the normal (rotations/reflections). */
function mapPlane(plane: Plane3V1, f: (v: ExactVector3) => ExactVector3): Plane3V1 {
  return toPlane(
    plane.planeId,
    f(exactVectorFromVector3(plane.point.position).vector),
    f(exactVectorFromVector3(plane.normal).vector),
  );
}

function translate(v: ExactVector3, t: ExactVector3): ExactVector3 {
  return addVectors(v, t);
}

/** Translation moves base points only; directions and normals are free vectors. */
function translateLine(line: Line3V1, t: ExactVector3): Line3V1 {
  return { ...line, point: mapPoint(line.point, (v) => translate(v, t)) };
}

function translatePlane(plane: Plane3V1, t: ExactVector3): Plane3V1 {
  return { ...plane, point: mapPoint(plane.point, (v) => translate(v, t)) };
}

describe("distance invariants", () => {
  it("distances are non-negative for random configurations", () => {
    const rand = mulberry32(SEED);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const p1 = toPoint("A", randomVector(rand));
      const p2 = toPoint("B", randomVector(rand));
      const pp = pointPointDistance(p1, p2);
      expect(radicalSign(exactRadicalOf(pp.result.distance))).toBeGreaterThanOrEqual(0);

      const line = randomLine(rand);
      const pl = unwrapCoreResult(pointLineDistance(p1, line));
      expect(radicalSign(exactRadicalOf(pl.result.distance))).toBeGreaterThanOrEqual(0);

      const plane = randomPlane(rand);
      const ppl = unwrapCoreResult(pointPlaneDistance(p1, plane));
      expect(radicalSign(exactRadicalOf(ppl.result.distance))).toBeGreaterThanOrEqual(0);

      const { line1, line2 } = randomParallelLines(rand);
      const pll = unwrapCoreResult(parallelLinesDistance(line1, line2));
      expect(radicalSign(exactRadicalOf(pll.result.distance))).toBeGreaterThanOrEqual(0);

      const skew = randomSkewLines(rand);
      const sk = unwrapCoreResult(skewLinesDistance(skew.line1, skew.line2));
      expect(radicalSign(exactRadicalOf(sk.result.distance))).toBeGreaterThanOrEqual(0);

      const { plane1, plane2 } = randomParallelPlanes(rand);
      const ppl2 = unwrapCoreResult(parallelPlanesDistance(plane1, plane2));
      expect(radicalSign(exactRadicalOf(ppl2.result.distance))).toBeGreaterThanOrEqual(0);
    }
  });

  it("point-point distance is symmetric", () => {
    const rand = mulberry32(SEED + 1);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const p1 = toPoint("A", randomVector(rand));
      const p2 = toPoint("B", randomVector(rand));
      const forward = pointPointDistance(p1, p2);
      const backward = pointPointDistance(p2, p1);
      expect(
        radicalsEqual(
          exactRadicalOf(forward.result.distance),
          exactRadicalOf(backward.result.distance),
        ),
      ).toBe(true);
      expect(forward.result.relation).toBe(backward.result.relation);
    }
  });

  it("translation by any rational vector leaves every distance unchanged", () => {
    const rand = mulberry32(SEED + 2);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const t = randomVector(rand);
      const p1 = toPoint("A", randomVector(rand));
      const p2 = toPoint("B", randomVector(rand));
      const line = randomLine(rand);
      const plane = randomPlane(rand);
      const parallels = randomParallelLines(rand);
      const skew = randomSkewLines(rand);
      const planes = randomParallelPlanes(rand);

      const ppA = pointPointDistance(p1, p2);
      const ppB = pointPointDistance(mapPoint(p1, (v) => translate(v, t)), mapPoint(p2, (v) => translate(v, t)));
      expect(radicalsEqual(exactRadicalOf(ppA.result.distance), exactRadicalOf(ppB.result.distance))).toBe(true);

      const plA = unwrapCoreResult(pointLineDistance(p1, line));
      const plB = unwrapCoreResult(pointLineDistance(mapPoint(p1, (v) => translate(v, t)), translateLine(line, t)));
      expect(radicalsEqual(exactRadicalOf(plA.result.distance), exactRadicalOf(plB.result.distance))).toBe(true);

      const pplA = unwrapCoreResult(pointPlaneDistance(p1, plane));
      const pplB = unwrapCoreResult(pointPlaneDistance(mapPoint(p1, (v) => translate(v, t)), translatePlane(plane, t)));
      expect(radicalsEqual(exactRadicalOf(pplA.result.distance), exactRadicalOf(pplB.result.distance))).toBe(true);

      const pllA = unwrapCoreResult(parallelLinesDistance(parallels.line1, parallels.line2));
      const pllB = unwrapCoreResult(
        parallelLinesDistance(
          translateLine(parallels.line1, t),
          translateLine(parallels.line2, t),
        ),
      );
      expect(radicalsEqual(exactRadicalOf(pllA.result.distance), exactRadicalOf(pllB.result.distance))).toBe(true);

      const skA = unwrapCoreResult(skewLinesDistance(skew.line1, skew.line2));
      const skB = unwrapCoreResult(
        skewLinesDistance(
          translateLine(skew.line1, t),
          translateLine(skew.line2, t),
        ),
      );
      expect(radicalsEqual(exactRadicalOf(skA.result.distance), exactRadicalOf(skB.result.distance))).toBe(true);

      const ppl2A = unwrapCoreResult(parallelPlanesDistance(planes.plane1, planes.plane2));
      const ppl2B = unwrapCoreResult(
        parallelPlanesDistance(
          translatePlane(planes.plane1, t),
          translatePlane(planes.plane2, t),
        ),
      );
      expect(radicalsEqual(exactRadicalOf(ppl2A.result.distance), exactRadicalOf(ppl2B.result.distance))).toBe(true);
    }
  });

  it("exact rational rotations and reflections leave every distance unchanged", () => {
    const rand = mulberry32(SEED + 3);
    for (const transform of ORTHOGONAL_TRANSFORMS) {
      for (let i = 0; i < ROTATION_ITERATIONS; i += 1) {
        const p1 = toPoint("A", randomVector(rand));
        const p2 = toPoint("B", randomVector(rand));
        const line = randomLine(rand);
        const plane = randomPlane(rand);
        const parallels = randomParallelLines(rand);
        const skew = randomSkewLines(rand);
        const planes = randomParallelPlanes(rand);

        const ppA = pointPointDistance(p1, p2);
        const ppB = pointPointDistance(mapPoint(p1, transform), mapPoint(p2, transform));
        expect(radicalsEqual(exactRadicalOf(ppA.result.distance), exactRadicalOf(ppB.result.distance))).toBe(true);

        const plA = unwrapCoreResult(pointLineDistance(p1, line));
        const plB = unwrapCoreResult(pointLineDistance(mapPoint(p1, transform), mapLine(line, transform)));
        expect(radicalsEqual(exactRadicalOf(plA.result.distance), exactRadicalOf(plB.result.distance))).toBe(true);

        const pplA = unwrapCoreResult(pointPlaneDistance(p1, plane));
        const pplB = unwrapCoreResult(pointPlaneDistance(mapPoint(p1, transform), mapPlane(plane, transform)));
        expect(radicalsEqual(exactRadicalOf(pplA.result.distance), exactRadicalOf(pplB.result.distance))).toBe(true);

        const pllA = unwrapCoreResult(parallelLinesDistance(parallels.line1, parallels.line2));
        const pllB = unwrapCoreResult(
          parallelLinesDistance(mapLine(parallels.line1, transform), mapLine(parallels.line2, transform)),
        );
        expect(radicalsEqual(exactRadicalOf(pllA.result.distance), exactRadicalOf(pllB.result.distance))).toBe(true);

        const skA = unwrapCoreResult(skewLinesDistance(skew.line1, skew.line2));
        const skB = unwrapCoreResult(
          skewLinesDistance(mapLine(skew.line1, transform), mapLine(skew.line2, transform)),
        );
        expect(radicalsEqual(exactRadicalOf(skA.result.distance), exactRadicalOf(skB.result.distance))).toBe(true);

        const ppl2A = unwrapCoreResult(parallelPlanesDistance(planes.plane1, planes.plane2));
        const ppl2B = unwrapCoreResult(
          parallelPlanesDistance(mapPlane(planes.plane1, transform), mapPlane(planes.plane2, transform)),
        );
        expect(radicalsEqual(exactRadicalOf(ppl2A.result.distance), exactRadicalOf(ppl2B.result.distance))).toBe(true);
      }
    }
  }, ROTATION_TEST_TIMEOUT_MS);

  it("scaling a line direction by a non-zero rational leaves distances unchanged", () => {
    const rand = mulberry32(SEED + 4);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const k = nonZeroRational(rand);
      const point = toPoint("P", randomVector(rand));
      const line = randomLine(rand);
      const scaledLine: Line3V1 = {
        ...line,
        direction: vector3FromExactVector(
          scaleVector(exactVectorFromVector3(line.direction).vector, k),
        ),
      };
      const plA = unwrapCoreResult(pointLineDistance(point, line));
      const plB = unwrapCoreResult(pointLineDistance(point, scaledLine));
      expect(radicalsEqual(exactRadicalOf(plA.result.distance), exactRadicalOf(plB.result.distance))).toBe(true);

      const parallels = randomParallelLines(rand);
      const pllA = unwrapCoreResult(parallelLinesDistance(parallels.line1, parallels.line2));
      const pllB = unwrapCoreResult(
        parallelLinesDistance(parallels.line1, {
          ...parallels.line2,
          direction: vector3FromExactVector(
            scaleVector(exactVectorFromVector3(parallels.line2.direction).vector, k),
          ),
        }),
      );
      expect(radicalsEqual(exactRadicalOf(pllA.result.distance), exactRadicalOf(pllB.result.distance))).toBe(true);

      const skew = randomSkewLines(rand);
      const skA = unwrapCoreResult(skewLinesDistance(skew.line1, skew.line2));
      const skB = unwrapCoreResult(
        skewLinesDistance(skew.line1, {
          ...skew.line2,
          direction: vector3FromExactVector(
            scaleVector(exactVectorFromVector3(skew.line2.direction).vector, k),
          ),
        }),
      );
      expect(radicalsEqual(exactRadicalOf(skA.result.distance), exactRadicalOf(skB.result.distance))).toBe(true);
    }
  });

  it("scaling a plane normal by a non-zero rational leaves distances unchanged", () => {
    const rand = mulberry32(SEED + 5);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const k = nonZeroRational(rand);
      const point = toPoint("P", randomVector(rand));
      const plane = randomPlane(rand);
      const scaledPlane: Plane3V1 = {
        ...plane,
        normal: vector3FromExactVector(
          scaleVector(exactVectorFromVector3(plane.normal).vector, k),
        ),
      };
      const pplA = unwrapCoreResult(pointPlaneDistance(point, plane));
      const pplB = unwrapCoreResult(pointPlaneDistance(point, scaledPlane));
      expect(radicalsEqual(exactRadicalOf(pplA.result.distance), exactRadicalOf(pplB.result.distance))).toBe(true);

      const planes = randomParallelPlanes(rand);
      const ppl2A = unwrapCoreResult(parallelPlanesDistance(planes.plane1, planes.plane2));
      const ppl2B = unwrapCoreResult(
        parallelPlanesDistance(planes.plane1, {
          ...planes.plane2,
          normal: vector3FromExactVector(
            scaleVector(exactVectorFromVector3(planes.plane2.normal).vector, k),
          ),
        }),
      );
      expect(radicalsEqual(exactRadicalOf(ppl2A.result.distance), exactRadicalOf(ppl2B.result.distance))).toBe(true);
    }
  });

  it("nearest-point connectors are exactly perpendicular to the line direction(s)", () => {
    const rand = mulberry32(SEED + 6);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const point = toPoint("P", randomVector(rand));
      const line = randomLine(rand);
      const pl = unwrapCoreResult(pointLineDistance(point, line));
      const connector = subtractVectors(
        exactVectorFromVector3(point.position).vector,
        exactVectorFromVector3(pl.result.foot.position).vector,
      );
      expect(
        isZeroRational(dotProduct(connector, exactVectorFromVector3(line.direction).vector)),
      ).toBe(true);
      expect(
        pl.validation.find((record) => record.rule === "connector-perpendicular-to-direction")
          ?.passed,
      ).toBe(true);

      const skew = randomSkewLines(rand);
      const sk = unwrapCoreResult(skewLinesDistance(skew.line1, skew.line2));
      const commonPerpendicular = subtractVectors(
        exactVectorFromVector3(sk.result.foot2.position).vector,
        exactVectorFromVector3(sk.result.foot1.position).vector,
      );
      expect(
        isZeroRational(
          dotProduct(commonPerpendicular, exactVectorFromVector3(skew.line1.direction).vector),
        ),
      ).toBe(true);
      expect(
        isZeroRational(
          dotProduct(commonPerpendicular, exactVectorFromVector3(skew.line2.direction).vector),
        ),
      ).toBe(true);
    }
  });
});

describe("angle invariants", () => {
  it("vector angles lie in [0°, 180°]; line/plane angles in [0°, 90°]", () => {
    const rand = mulberry32(SEED + 7);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const v1 = vector3FromExactVector(nonZeroVector(rand));
      const v2 = vector3FromExactVector(nonZeroVector(rand));
      const vv = unwrapCoreResult(vectorAngle(v1, v2));
      if (vv.result.angle.kind === "exact") {
        expect(vv.result.angle.angleDegrees).toBeGreaterThanOrEqual(-1e-9);
        expect(vv.result.angle.angleDegrees).toBeLessThanOrEqual(180 + 1e-9);
      }
      expect(vv.validation.find((record) => record.rule === "angle-range")?.passed).toBe(true);

      const line1 = randomLine(rand, "l1");
      const line2 = randomLine(rand, "l2");
      const ll = unwrapCoreResult(lineLineAngle(line1, line2));
      if (ll.result.angle.kind === "exact") {
        expect(ll.result.angle.angleDegrees).toBeGreaterThanOrEqual(-1e-9);
        expect(ll.result.angle.angleDegrees).toBeLessThanOrEqual(90 + 1e-9);
      }

      const plane1 = randomPlane(rand, "p1");
      const plane2 = randomPlane(rand, "p2");
      const pp = unwrapCoreResult(planePlaneAngle(plane1, plane2));
      if (pp.result.angle.kind === "exact") {
        expect(pp.result.angle.angleDegrees).toBeGreaterThanOrEqual(-1e-9);
        expect(pp.result.angle.angleDegrees).toBeLessThanOrEqual(90 + 1e-9);
      }

      const lp = unwrapCoreResult(linePlaneAngle(line1, plane1));
      if (lp.result.angle.kind === "exact") {
        expect(lp.result.angle.angleDegrees).toBeGreaterThanOrEqual(-1e-9);
        expect(lp.result.angle.angleDegrees).toBeLessThanOrEqual(90 + 1e-9);
      }
      expect(lp.validation.find((record) => record.rule === "angle-range")?.passed).toBe(true);
    }
  });

  it("translation leaves line and plane angles unchanged", () => {
    const rand = mulberry32(SEED + 8);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const t = randomVector(rand);
      const line1 = randomLine(rand, "l1");
      const line2 = randomLine(rand, "l2");
      const plane1 = randomPlane(rand, "p1");
      const plane2 = randomPlane(rand, "p2");

      const llA = unwrapCoreResult(lineLineAngle(line1, line2));
      const llB = unwrapCoreResult(
        lineLineAngle(
          translateLine(line1, t),
          translateLine(line2, t),
        ),
      );
      if (llA.result.angle.kind === "exact" && llB.result.angle.kind === "exact") {
        expect(radicalsEqual(llA.result.angle.cosine, llB.result.angle.cosine)).toBe(true);
      }

      const ppA = unwrapCoreResult(planePlaneAngle(plane1, plane2));
      const ppB = unwrapCoreResult(
        planePlaneAngle(
          translatePlane(plane1, t),
          translatePlane(plane2, t),
        ),
      );
      if (ppA.result.angle.kind === "exact" && ppB.result.angle.kind === "exact") {
        expect(radicalsEqual(ppA.result.angle.cosine, ppB.result.angle.cosine)).toBe(true);
      }

      const lpA = unwrapCoreResult(linePlaneAngle(line1, plane1));
      const lpB = unwrapCoreResult(
        linePlaneAngle(
          translateLine(line1, t),
          translatePlane(plane1, t),
        ),
      );
      if (lpA.result.angle.kind === "exact" && lpB.result.angle.kind === "exact") {
        expect(radicalsEqual(lpA.result.angle.sine, lpB.result.angle.sine)).toBe(true);
      }
    }
  });

  it("exact rational rotations and reflections leave every angle unchanged", () => {
    const rand = mulberry32(SEED + 9);
    for (const transform of ORTHOGONAL_TRANSFORMS) {
      for (let i = 0; i < ROTATION_ITERATIONS; i += 1) {
        const v1 = vector3FromExactVector(nonZeroVector(rand));
        const v2 = vector3FromExactVector(nonZeroVector(rand));
        const line1 = randomLine(rand, "l1");
        const line2 = randomLine(rand, "l2");
        const plane1 = randomPlane(rand, "p1");
        const plane2 = randomPlane(rand, "p2");

        const vvA = unwrapCoreResult(vectorAngle(v1, v2));
        const vvB = unwrapCoreResult(
          vectorAngle(
            vector3FromExactVector(transform(exactVectorFromVector3(v1).vector)),
            vector3FromExactVector(transform(exactVectorFromVector3(v2).vector)),
          ),
        );
        if (vvA.result.angle.kind === "exact" && vvB.result.angle.kind === "exact") {
          expect(radicalsEqual(vvA.result.angle.cosine, vvB.result.angle.cosine)).toBe(true);
          expect(vvA.result.angle.angleDegrees).toBeCloseTo(vvB.result.angle.angleDegrees, 9);
        }
        expect(vvA.result.classification).toBe(vvB.result.classification);

        const llA = unwrapCoreResult(lineLineAngle(line1, line2));
        const llB = unwrapCoreResult(lineLineAngle(mapLine(line1, transform), mapLine(line2, transform)));
        if (llA.result.angle.kind === "exact" && llB.result.angle.kind === "exact") {
          expect(radicalsEqual(llA.result.angle.cosine, llB.result.angle.cosine)).toBe(true);
        }

        const lpA = unwrapCoreResult(linePlaneAngle(line1, plane1));
        const lpB = unwrapCoreResult(linePlaneAngle(mapLine(line1, transform), mapPlane(plane1, transform)));
        if (lpA.result.angle.kind === "exact" && lpB.result.angle.kind === "exact") {
          expect(radicalsEqual(lpA.result.angle.sine, lpB.result.angle.sine)).toBe(true);
        }

        const ppA = unwrapCoreResult(planePlaneAngle(plane1, plane2));
        const ppB = unwrapCoreResult(planePlaneAngle(mapPlane(plane1, transform), mapPlane(plane2, transform)));
        if (ppA.result.angle.kind === "exact" && ppB.result.angle.kind === "exact") {
          expect(radicalsEqual(ppA.result.angle.cosine, ppB.result.angle.cosine)).toBe(true);
        }
      }
    }
  }, ROTATION_TEST_TIMEOUT_MS);

  it("scaling directions and normals by non-zero rationals leaves angles unchanged", () => {
    const rand = mulberry32(SEED + 10);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const k = nonZeroRational(rand);
      const line1 = randomLine(rand, "l1");
      const line2 = randomLine(rand, "l2");
      const plane1 = randomPlane(rand, "p1");
      const plane2 = randomPlane(rand, "p2");
      const scaledLine1: Line3V1 = {
        ...line1,
        direction: vector3FromExactVector(
          scaleVector(exactVectorFromVector3(line1.direction).vector, k),
        ),
      };
      const scaledPlane1: Plane3V1 = {
        ...plane1,
        normal: vector3FromExactVector(
          scaleVector(exactVectorFromVector3(plane1.normal).vector, k),
        ),
      };

      const llA = unwrapCoreResult(lineLineAngle(line1, line2));
      const llB = unwrapCoreResult(lineLineAngle(scaledLine1, line2));
      if (llA.result.angle.kind === "exact" && llB.result.angle.kind === "exact") {
        expect(radicalsEqual(llA.result.angle.cosine, llB.result.angle.cosine)).toBe(true);
      }

      const lpA = unwrapCoreResult(linePlaneAngle(line1, plane1));
      const lpB = unwrapCoreResult(linePlaneAngle(scaledLine1, plane1));
      const lpC = unwrapCoreResult(linePlaneAngle(line1, scaledPlane1));
      if (
        lpA.result.angle.kind === "exact" &&
        lpB.result.angle.kind === "exact" &&
        lpC.result.angle.kind === "exact"
      ) {
        expect(radicalsEqual(lpA.result.angle.sine, lpB.result.angle.sine)).toBe(true);
        expect(radicalsEqual(lpA.result.angle.sine, lpC.result.angle.sine)).toBe(true);
      }

      const ppA = unwrapCoreResult(planePlaneAngle(plane1, plane2));
      const ppB = unwrapCoreResult(planePlaneAngle(scaledPlane1, plane2));
      if (ppA.result.angle.kind === "exact" && ppB.result.angle.kind === "exact") {
        expect(radicalsEqual(ppA.result.angle.cosine, ppB.result.angle.cosine)).toBe(true);
      }
    }
  });

  it("vector-angle cosine satisfies the Pythagorean identity against the line angle", () => {
    // Cross-check between two solvers: for directions d1, d2 the LINE angle
    // cosine equals |vector-angle cosine|.
    const rand = mulberry32(SEED + 11);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const d1 = nonZeroVector(rand);
      const d2 = nonZeroVector(rand);
      const vv = unwrapCoreResult(
        vectorAngle(vector3FromExactVector(d1), vector3FromExactVector(d2)),
      );
      const ll = unwrapCoreResult(
        lineLineAngle(toLine("l1", randomVector(rand), d1), toLine("l2", randomVector(rand), d2)),
      );
      if (vv.result.angle.kind === "exact" && ll.result.angle.kind === "exact") {
        const vectorCosine = vv.result.angle.cosine;
        const lineCosine = ll.result.angle.cosine;
        expect(
          radicalsEqual(
            radicalSign(vectorCosine) < 0
              ? { coefficient: rational(-vectorCosine.coefficient.numerator, vectorCosine.coefficient.denominator), radicand: vectorCosine.radicand }
              : vectorCosine,
            lineCosine,
          ),
        ).toBe(true);
      }
    }
  });
});
