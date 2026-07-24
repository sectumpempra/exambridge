import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  isFiniteDisplayVector,
  pointToDisplayPosition,
  scalarToDisplayNumber,
  vector3ToDisplay,
} from "@/features/vector-geometry-lab/three/scalars";
import { makePoint, makeScalar, makeVector3 } from "./helpers.js";

describe("scalarToDisplayNumber (one-way display conversion)", () => {
  it("converts exact rationals to floats", () => {
    expect(scalarToDisplayNumber(makeScalar("3/2"))).toBe(1.5);
    expect(scalarToDisplayNumber(makeScalar("-7/4"))).toBe(-1.75);
    expect(scalarToDisplayNumber(makeScalar("0"))).toBe(0);
    expect(scalarToDisplayNumber(makeScalar("2.5"))).toBe(2.5);
  });

  it("keeps zero as a first-class value (never treated as missing)", () => {
    expect(scalarToDisplayNumber(makeScalar("0"))).toBe(0);
  });
});

describe("vector3ToDisplay / pointToDisplayPosition", () => {
  it("maps components in order", () => {
    const v = vector3ToDisplay(makeVector3("1", "-2", "3/2"));
    expect(v.x).toBe(1);
    expect(v.y).toBe(-2);
    expect(v.z).toBe(1.5);
  });

  it("maps a point position", () => {
    const p = pointToDisplayPosition(makePoint("p1", "P", "4", "5", "6"));
    expect(p.equals(new THREE.Vector3(4, 5, 6))).toBe(true);
  });
});

describe("isFiniteDisplayVector", () => {
  it("accepts finite vectors", () => {
    expect(isFiniteDisplayVector(new THREE.Vector3(1, 2, 3))).toBe(true);
  });

  it("rejects non-finite display vectors", () => {
    expect(isFiniteDisplayVector(new THREE.Vector3(Infinity, 0, 0))).toBe(false);
    expect(isFiniteDisplayVector(new THREE.Vector3(0, Number.NaN, 0))).toBe(false);
  });
});
