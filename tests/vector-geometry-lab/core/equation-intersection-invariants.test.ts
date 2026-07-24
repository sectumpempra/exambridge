import type { Line3V1, Plane3V1 } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  addVectors,
  crossProduct,
  dotProduct,
  exactVectorFromVector3,
  exactVectorsEqual,
  isPointInPlane,
  isPointOnLine,
  isZeroExactVector,
  isZeroRational,
  line3FromEquationSet,
  lineEquationsFromLine3,
  lineLineIntersection,
  linePlaneIntersection,
  linePointResidualVector,
  plane3FromEquationSet,
  planeEquationsFromPlane3,
  planeEquationsFromPointDirections,
  planeEquationsFromPointNormal,
  planeEquationsFromThreePoints,
  planeEquationsEquivalent,
  planePlaneIntersection,
  planePointResidual,
  planeEquationFromPointNormal,
  rationalFromScalar,
  rationalsEqual,
  scaleVector,
  subtractVectors,
  unwrapCoreResult,
  vector3FromExactVector,
} from "@/features/vector-geometry-lab/core";
import type { ExactVector3 } from "@/features/vector-geometry-lab/core";
import { mulberry32, randomRational, randomVector } from "./helpers.js";

const SEED = 20260716;

function line3FromExact(lineId: string, point: ExactVector3, direction: ExactVector3): Line3V1 {
  return {
    lineId,
    label: lineId,
    point: {
      pointId: `${lineId}-p`,
      label: "P",
      position: vector3FromExactVector(point, { exact: true }),
    },
    direction: vector3FromExactVector(direction, { exact: true }),
  };
}

function plane3FromExact(planeId: string, point: ExactVector3, normal: ExactVector3): Plane3V1 {
  return {
    planeId,
    label: planeId,
    point: {
      pointId: `${planeId}-p`,
      label: "P",
      position: vector3FromExactVector(point, { exact: true }),
    },
    normal: vector3FromExactVector(normal, { exact: true }),
  };
}

describe("invariant: intersection points satisfy ALL original equations", () => {
  it("line-line: the unique intersection lies on both lines (random constructed pairs)", () => {
    const rand = mulberry32(SEED);
    let checked = 0;
    for (let i = 0; i < 40 && checked < 12; i += 1) {
      const a1 = randomVector(rand);
      const b1 = randomVector(rand);
      const b2 = randomVector(rand);
      if (isZeroExactVector(b1) || isZeroExactVector(b2)) {
        continue;
      }
      if (!isZeroExactVector(crossProduct(b1, b2))) {
        // Construct lines that provably meet: a2 = a1 + s*·b1 − t*·b2.
        const sStar = randomRational(rand);
        const tStar = randomRational(rand);
        const a2 = subtractVectors(
          addVectors(a1, scaleVector(b1, sStar)),
          scaleVector(b2, tStar),
        );
        const outcome = unwrapCoreResult(
          lineLineIntersection(
            line3FromExact("l1", a1, b1),
            line3FromExact("l2", a2, b2),
          ),
        );
        expect(outcome.result.classification).toBe("unique");
        const hit = outcome.result.intersectionPoint;
        expect(hit).toBeDefined();
        if (hit !== undefined) {
          const p = exactVectorFromVector3(hit.position).vector;
          // Back-substitution into BOTH original line equations.
          expect(isZeroExactVector(linePointResidualVector(p, a1, b1))).toBe(true);
          expect(isZeroExactVector(linePointResidualVector(p, a2, b2))).toBe(true);
        }
        if (outcome.result.parameterOnLine1 !== undefined) {
          expect(rationalsEqual(rationalFromScalar(outcome.result.parameterOnLine1), sStar)).toBe(true);
        }
        if (outcome.result.parameterOnLine2 !== undefined) {
          expect(rationalsEqual(rationalFromScalar(outcome.result.parameterOnLine2), tStar)).toBe(true);
        }
        expect(outcome.validation.every((record) => record.passed)).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it("line-plane: the unique intersection lies on the line AND in the plane (random)", () => {
    const rand = mulberry32(SEED + 1);
    let checked = 0;
    for (let i = 0; i < 40 && checked < 12; i += 1) {
      const aPlane = randomVector(rand);
      const n = randomVector(rand);
      const aLine = randomVector(rand);
      const b = randomVector(rand);
      if (isZeroExactVector(n) || isZeroExactVector(b)) {
        continue;
      }
      if (isZeroRational(dotProduct(b, n))) {
        continue;
      }
      const outcome = unwrapCoreResult(
        linePlaneIntersection(
          line3FromExact("l", aLine, b),
          plane3FromExact("pl", aPlane, n),
        ),
      );
      expect(outcome.result.classification).toBe("unique");
      const hit = outcome.result.intersectionPoint;
      expect(hit).toBeDefined();
      if (hit !== undefined) {
        const p = exactVectorFromVector3(hit.position).vector;
        const equation = unwrapCoreResult(planeEquationFromPointNormal(aPlane, n));
        // Back-substitution into the plane equation AND the line equation.
        expect(isZeroRational(planePointResidual(equation, p))).toBe(true);
        expect(isZeroExactVector(linePointResidualVector(p, aLine, b))).toBe(true);
      }
      expect(outcome.validation.every((record) => record.passed)).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });
});

describe("invariant: the plane-plane intersection line is consistent", () => {
  it("the direction is ⊥ BOTH normals and the point lies in BOTH planes (random)", () => {
    const rand = mulberry32(SEED + 2);
    let checked = 0;
    for (let i = 0; i < 40 && checked < 12; i += 1) {
      const a1 = randomVector(rand);
      const a2 = randomVector(rand);
      const n1 = randomVector(rand);
      const n2 = randomVector(rand);
      if (isZeroExactVector(n1) || isZeroExactVector(n2)) {
        continue;
      }
      if (isZeroExactVector(crossProduct(n1, n2))) {
        continue;
      }
      const outcome = unwrapCoreResult(
        planePlaneIntersection(
          plane3FromExact("pl1", a1, n1),
          plane3FromExact("pl2", a2, n2),
        ),
      );
      expect(outcome.result.classification).toBe("intersecting-in-line");
      const line = outcome.result.intersectionLine;
      expect(line).toBeDefined();
      if (line !== undefined) {
        const direction = exactVectorFromVector3(line.direction).vector;
        const r0 = exactVectorFromVector3(line.point.position).vector;
        // Direction perpendicular to BOTH normals.
        expect(isZeroRational(dotProduct(direction, n1))).toBe(true);
        expect(isZeroRational(dotProduct(direction, n2))).toBe(true);
        // Point back-substituted into BOTH plane equations.
        const eq1 = unwrapCoreResult(planeEquationFromPointNormal(a1, n1));
        const eq2 = unwrapCoreResult(planeEquationFromPointNormal(a2, n2));
        expect(isZeroRational(planePointResidual(eq1, r0))).toBe(true);
        expect(isZeroRational(planePointResidual(eq2, r0))).toBe(true);
        // The whole line then lies in both planes: check r0 + direction too.
        const r1 = addVectors(r0, direction);
        expect(isZeroRational(planePointResidual(eq1, r1))).toBe(true);
        expect(isZeroRational(planePointResidual(eq2, r1))).toBe(true);
      }
      expect(outcome.validation.every((record) => record.passed)).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });
});

describe("invariant: the three-points plane passes through all three points", () => {
  it("random non-collinear triples produce a plane containing every point", () => {
    const rand = mulberry32(SEED + 3);
    let checked = 0;
    for (let i = 0; i < 40 && checked < 12; i += 1) {
      const p1 = randomVector(rand);
      const u = randomVector(rand);
      const v = randomVector(rand);
      if (isZeroExactVector(crossProduct(u, v))) {
        continue;
      }
      const p2 = addVectors(p1, u);
      const p3 = addVectors(p1, v);
      const outcome = unwrapCoreResult(
        planeEquationsFromThreePoints(
          vector3FromExactVector(p1, { exact: true }),
          vector3FromExactVector(p2, { exact: true }),
          vector3FromExactVector(p3, { exact: true }),
        ),
      );
      const equation = outcome.result.equation;
      expect(isZeroRational(planePointResidual(equation, p1))).toBe(true);
      expect(isZeroRational(planePointResidual(equation, p2))).toBe(true);
      expect(isZeroRational(planePointResidual(equation, p3))).toBe(true);
      const rules = outcome.validation.map((record) => record.rule);
      expect(rules).toContain("point1-on-plane");
      expect(rules).toContain("point2-on-plane");
      expect(rules).toContain("point3-on-plane");
      expect(outcome.validation.every((record) => record.passed)).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });
});

describe("invariant: form inter-conversion round-trips", () => {
  it("line entity → forms → entity preserves the point and direction exactly", () => {
    const rand = mulberry32(SEED + 4);
    let checked = 0;
    for (let i = 0; i < 20 && checked < 8; i += 1) {
      const a = randomVector(rand);
      const b = randomVector(rand);
      if (isZeroExactVector(b)) {
        continue;
      }
      const set1 = unwrapCoreResult(
        lineEquationsFromLine3(line3FromExact("l", a, b)),
      ).result;
      const rebuilt = line3FromEquationSet(set1, "l2", "rebuilt");
      expect(
        exactVectorsEqual(exactVectorFromVector3(rebuilt.point.position).vector, a),
      ).toBe(true);
      expect(
        exactVectorsEqual(exactVectorFromVector3(rebuilt.direction).vector, b),
      ).toBe(true);
      const set2 = unwrapCoreResult(lineEquationsFromLine3(rebuilt)).result;
      expect(set2.vector).toBe(set1.vector);
      expect(set2.parametric).toBe(set1.parametric);
      expect(set2.symmetric).toEqual(set1.symmetric);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  it("plane entity → forms → entity keeps an equivalent equation (planeEquationsEquivalent)", () => {
    const rand = mulberry32(SEED + 5);
    let checked = 0;
    for (let i = 0; i < 20 && checked < 8; i += 1) {
      const a = randomVector(rand);
      const n = randomVector(rand);
      if (isZeroExactVector(n)) {
        continue;
      }
      const set1 = unwrapCoreResult(
        planeEquationsFromPlane3(plane3FromExact("pl", a, n)),
      ).result;
      const rebuilt = plane3FromEquationSet(set1, "pl2", "rebuilt");
      const set2 = unwrapCoreResult(planeEquationsFromPlane3(rebuilt)).result;
      expect(unwrapCoreResult(planeEquationsEquivalent(set1.equation, set2.equation))).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  it("parametric → normal reconstruction via u × v stays equivalent (random)", () => {
    const rand = mulberry32(SEED + 6);
    let checked = 0;
    for (let i = 0; i < 20 && checked < 8; i += 1) {
      const a = randomVector(rand);
      const u = randomVector(rand);
      const v = randomVector(rand);
      if (isZeroExactVector(crossProduct(u, v))) {
        continue;
      }
      const fromDirections = unwrapCoreResult(
        planeEquationsFromPointDirections(
          vector3FromExactVector(a, { exact: true }),
          vector3FromExactVector(u, { exact: true }),
          vector3FromExactVector(v, { exact: true }),
        ),
      ).result;
      const fromNormal = unwrapCoreResult(
        planeEquationsFromPointNormal(
          vector3FromExactVector(a, { exact: true }),
          fromDirections.normal,
        ),
      ).result;
      expect(
        unwrapCoreResult(planeEquationsEquivalent(fromDirections.equation, fromNormal.equation)),
      ).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });
});

describe("invariant: membership predicates agree with construction", () => {
  it("points generated ON the line are accepted with the exact λ (random)", () => {
    const rand = mulberry32(SEED + 7);
    let checked = 0;
    for (let i = 0; i < 20 && checked < 8; i += 1) {
      const a = randomVector(rand);
      const b = randomVector(rand);
      const lambda = randomRational(rand);
      if (isZeroExactVector(b)) {
        continue;
      }
      const p = addVectors(a, scaleVector(b, lambda));
      const outcome = unwrapCoreResult(
        isPointOnLine(
          vector3FromExactVector(p, { exact: true }),
          line3FromExact("l", a, b),
        ),
      );
      expect(outcome.result.classification).toBe("on-line");
      expect(rationalsEqual(rationalFromScalar(outcome.result.parameter), lambda)).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  it("points perturbed OFF the line are rejected (random)", () => {
    const rand = mulberry32(SEED + 8);
    let checked = 0;
    for (let i = 0; i < 20 && checked < 8; i += 1) {
      const a = randomVector(rand);
      const b = randomVector(rand);
      const w = randomVector(rand);
      if (isZeroExactVector(b)) {
        continue;
      }
      const perturbation = crossProduct(b, w);
      if (isZeroExactVector(perturbation)) {
        continue;
      }
      const p = addVectors(a, perturbation);
      const outcome = unwrapCoreResult(
        isPointOnLine(
          vector3FromExactVector(p, { exact: true }),
          line3FromExact("l", a, b),
        ),
      );
      expect(outcome.result.classification).toBe("not-on-line");
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });

  it("points in the plane are accepted; normal offsets are rejected (random)", () => {
    const rand = mulberry32(SEED + 9);
    let checked = 0;
    for (let i = 0; i < 20 && checked < 8; i += 1) {
      const a = randomVector(rand);
      const n = randomVector(rand);
      if (isZeroExactVector(n)) {
        continue;
      }
      const u = crossProduct(n, randomVector(rand));
      if (isZeroExactVector(u)) {
        continue;
      }
      const inPlane = addVectors(a, u);
      const offset = addVectors(inPlane, n);
      const plane = plane3FromExact("pl", a, n);
      const inOutcome = unwrapCoreResult(
        isPointInPlane(vector3FromExactVector(inPlane, { exact: true }), plane),
      );
      expect(inOutcome.result.classification).toBe("in-plane");
      const outOutcome = unwrapCoreResult(
        isPointInPlane(vector3FromExactVector(offset, { exact: true }), plane),
      );
      expect(outOutcome.result.classification).toBe("not-in-plane");
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(5);
  });
});
