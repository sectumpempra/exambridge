import { describe, expect, it } from "vitest";
import {
  createLine3,
  createPlane3,
  createPoint3,
  createVector3,
  createVectorEntity,
  isZeroVector3,
  parseLine3,
  parsePlane3,
  parsePoint3,
  parseVector3,
  parseVectorEntity,
  scalarFromLiteral,
  ZERO_SCALAR_V1,
  ONE_SCALAR_V1,
} from "@/features/vector-geometry-lab/schema";
import type { ScalarV1, Vector3V1 } from "@/features/vector-geometry-lab/schema";

function scalar(literal: string): ScalarV1 {
  const result = scalarFromLiteral(literal);
  if (!result.ok) throw new Error(`bad literal ${literal}`);
  return result.value;
}

function vec(x: string, y: string, z: string): Vector3V1 {
  return createVector3(scalar(x), scalar(y), scalar(z));
}

const samplePoint = createPoint3({
  label: "A",
  position: vec("1", "2", "3"),
  pointId: "point_A",
});

describe("Vector3V1", () => {
  it("accepts a valid vector", () => {
    const result = parseVector3({ x: scalar("1"), y: scalar("2"), z: scalar("3") });
    expect(result.ok).toBe(true);
  });

  it("rejects missing components", () => {
    expect(parseVector3({ x: scalar("1"), y: scalar("2") }).ok).toBe(false);
  });

  it("rejects non-scalar components", () => {
    expect(parseVector3({ x: 1, y: 2, z: 3 }).ok).toBe(false);
  });

  it("detects the zero vector", () => {
    expect(isZeroVector3(vec("0", "0", "0"))).toBe(true);
    expect(isZeroVector3(vec("0", "1", "0"))).toBe(false);
  });

  it("treats normalized zero forms as zero", () => {
    expect(isZeroVector3(vec("0.0", "0/7", "-0"))).toBe(true);
  });
});

describe("Point3V1", () => {
  it("accepts a valid point and round-trips through JSON", () => {
    const revived: unknown = JSON.parse(JSON.stringify(samplePoint));
    const result = parsePoint3(revived);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual(samplePoint);
  });

  it("rejects an empty label", () => {
    expect(parsePoint3({ ...samplePoint, label: "" }).ok).toBe(false);
  });

  it("rejects an empty id", () => {
    expect(parsePoint3({ ...samplePoint, pointId: "" }).ok).toBe(false);
  });

  it("generates an id when none is given", () => {
    const point = createPoint3({ label: "B", position: vec("0", "0", "0") });
    expect(point.pointId.length).toBeGreaterThan(0);
    expect(point.pointId.startsWith("point_")).toBe(true);
  });

  it("keeps caller-provided ids stable", () => {
    const point = createPoint3({
      label: "B",
      position: vec("0", "0", "0"),
      pointId: "stable-id-1",
    });
    expect(point.pointId).toBe("stable-id-1");
  });

  it("supports extreme coordinates exactly", () => {
    const point = createPoint3({
      label: "FAR",
      position: vec("123456789012345678901234567890", "-0.0000000001", "0"),
    });
    expect(point.position.x.numerator).toBe("123456789012345678901234567890");
    expect(point.position.y.denominator).toBe("10000000000");
  });
});

describe("Line3V1 — zero direction rejection", () => {
  it("accepts a line with a non-zero direction", () => {
    const line = createLine3({
      label: "l1",
      point: samplePoint,
      direction: vec("1", "0", "0"),
      lineId: "line_l1",
    });
    expect(line.direction.x.numerator).toBe("1");
  });

  it("rejects a zero direction vector with a structured result", () => {
    const result = parseLine3({
      lineId: "line_bad",
      label: "bad",
      point: samplePoint,
      direction: vec("0", "0", "0"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid-input");
    expect(
      result.error.issues.some((issue) => issue.path === "direction"),
    ).toBe(true);
  });

  it("factory throws on a zero direction vector", () => {
    expect(() =>
      createLine3({
        label: "bad",
        point: samplePoint,
        direction: vec("0", "0", "0"),
      }),
    ).toThrow();
  });

  it("accepts directions with a single non-zero component", () => {
    const result = parseLine3({
      lineId: "line_ok",
      label: "ok",
      point: samplePoint,
      direction: vec("0", "0", "-5/2"),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a zero direction even in normalized disguises", () => {
    const result = parseLine3({
      lineId: "line_bad2",
      label: "bad2",
      point: samplePoint,
      direction: vec("0.000", "0/9", "0"),
    });
    expect(result.ok).toBe(false);
  });
});

describe("Plane3V1 — zero normal rejection", () => {
  it("accepts a plane with a non-zero normal", () => {
    const plane = createPlane3({
      label: "π1",
      point: samplePoint,
      normal: vec("0", "0", "1"),
      planeId: "plane_p1",
    });
    expect(plane.normal.z.numerator).toBe("1");
  });

  it("rejects a zero normal vector with a structured result", () => {
    const result = parsePlane3({
      planeId: "plane_bad",
      label: "bad",
      point: samplePoint,
      normal: vec("0", "0", "0"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid-input");
    expect(result.error.issues.some((issue) => issue.path === "normal")).toBe(
      true,
    );
  });

  it("factory throws on a zero normal vector", () => {
    expect(() =>
      createPlane3({
        label: "bad",
        point: samplePoint,
        normal: vec("0", "0", "0"),
      }),
    ).toThrow();
  });
});

describe("VectorEntityV1", () => {
  it("accepts a free vector without an origin", () => {
    const entity = createVectorEntity({
      label: "v",
      components: vec("1", "2", "2"),
      vectorId: "vector_v",
    });
    expect(entity.origin).toBeUndefined();
    const revived: unknown = JSON.parse(JSON.stringify(entity));
    expect(parseVectorEntity(revived).ok).toBe(true);
  });

  it("accepts a bound vector with an origin", () => {
    const entity = createVectorEntity({
      label: "AB",
      components: vec("1", "0", "0"),
      origin: samplePoint,
    });
    expect(entity.origin?.pointId).toBe("point_A");
  });

  it("allows zero vectors so the core engine can reject angle math explicitly", () => {
    const result = parseVectorEntity({
      vectorId: "vector_zero",
      label: "zero",
      components: vec("0", "0", "0"),
    });
    expect(result.ok).toBe(true);
  });

  it("rejects malformed components", () => {
    expect(
      parseVectorEntity({
        vectorId: "vector_bad",
        label: "bad",
        components: { x: ZERO_SCALAR_V1, y: ONE_SCALAR_V1 },
      }).ok,
    ).toBe(false);
  });
});
