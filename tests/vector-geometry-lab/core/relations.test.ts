import type { Line3V1, Point3V1 } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  areCoincidentLines,
  areCollinearPoints,
  areOppositeDirection,
  areParallel,
  arePerpendicular,
  areSameDirection,
  classifyVector,
  DEFAULT_TOLERANCE,
  isZeroVector,
} from "@/features/vector-geometry-lab/core";
import { approx, sc, vec } from "./helpers.js";

function makeLine(
  lineId: string,
  point: ReturnType<typeof vec>,
  direction: ReturnType<typeof vec>,
): Line3V1 {
  return {
    lineId,
    label: lineId,
    point: { pointId: `${lineId}-p`, label: "P", position: point },
    direction,
  };
}

function makePoint(pointId: string, position: ReturnType<typeof vec>): Point3V1 {
  return { pointId, label: pointId, position };
}

describe("isZeroVector / classifyVector", () => {
  it("classifies exact vectors exactly", () => {
    expect(isZeroVector(vec("0", "0", "0"))).toEqual({
      classification: "zero",
      exact: true,
    });
    expect(isZeroVector(vec("0", "1/3", "0"))).toEqual({
      classification: "non-zero",
      exact: true,
    });
    expect(classifyVector(vec("0", "0", "0")).classification).toBe("zero");
    expect(classifyVector(vec("1", "0", "0")).classification).toBe("non-zero");
  });

  it("classifies approximate vectors with a recorded tolerance", () => {
    const tiny = { x: approx("eps", "0.0000000001"), y: sc("0"), z: sc("0") };
    const zero = isZeroVector(tiny);
    expect(zero).toEqual({
      classification: "zero",
      exact: false,
      tolerance: DEFAULT_TOLERANCE,
    });
    const near = classifyVector(tiny);
    expect(near.classification).toBe("near-zero");
    expect(near.exact).toBe(false);

    const big = { x: approx("x", "0.5"), y: sc("0"), z: sc("0") };
    expect(isZeroVector(big).classification).toBe("non-zero");
    expect(classifyVector(big).classification).toBe("non-zero");
  });
});

describe("areParallel", () => {
  it("detects exact parallel vectors", () => {
    expect(areParallel(vec("1", "2", "3"), vec("2", "4", "6"))).toEqual({
      classification: "parallel",
      exact: true,
    });
    expect(areParallel(vec("1", "0", "0"), vec("0", "1", "0")).classification).toBe(
      "not-parallel",
    );
  });

  it("classifies zero operands as degenerate", () => {
    expect(areParallel(vec("0", "0", "0"), vec("1", "0", "0"))).toEqual({
      classification: "degenerate",
      exact: true,
    });
    expect(areParallel(vec("1", "0", "0"), vec("0", "0", "0")).classification).toBe(
      "degenerate",
    );
  });

  it("uses the tolerance path for approximate input and records it", () => {
    const a = { x: approx("a", "1"), y: sc("0"), z: sc("0") };
    const b = { x: sc("1"), y: approx("b", "0.0000000001"), z: sc("0") };
    const result = areParallel(a, b);
    expect(result).toEqual({
      classification: "parallel",
      exact: false,
      tolerance: DEFAULT_TOLERANCE,
    });
  });

  it("never equates beyond tolerance", () => {
    const a = { x: approx("a", "1"), y: sc("0"), z: sc("0") };
    const b = { x: sc("1"), y: approx("b", "0.001"), z: sc("0") };
    expect(areParallel(a, b).classification).toBe("not-parallel");
  });

  it("classifies near-zero approximate operands as degenerate", () => {
    const tiny = { x: approx("eps", "0.0000000001"), y: sc("0"), z: sc("0") };
    expect(areParallel(tiny, vec("1", "0", "0")).classification).toBe("degenerate");
    expect(areParallel(vec("1", "0", "0"), tiny).classification).toBe("degenerate");
  });
});

describe("arePerpendicular", () => {
  it("detects exact perpendicular vectors", () => {
    expect(arePerpendicular(vec("1", "0", "0"), vec("0", "1", "0"))).toEqual({
      classification: "perpendicular",
      exact: true,
    });
    expect(
      arePerpendicular(vec("1", "0", "0"), vec("1", "1", "0")).classification,
    ).toBe("not-perpendicular");
  });

  it("classifies zero operands as degenerate", () => {
    expect(arePerpendicular(vec("0", "0", "0"), vec("0", "1", "0")).classification).toBe(
      "degenerate",
    );
  });

  it("uses the tolerance path for approximate input", () => {
    const a = { x: approx("a", "1"), y: sc("0"), z: sc("0") };
    const b = { x: approx("b", "0.0000000001"), y: sc("1"), z: sc("0") };
    const result = arePerpendicular(a, b);
    expect(result.classification).toBe("perpendicular");
    expect(result.exact).toBe(false);
    expect(result.tolerance).toEqual(DEFAULT_TOLERANCE);

    const far = { x: approx("b", "0.001"), y: sc("1"), z: sc("0") };
    expect(arePerpendicular(a, far).classification).toBe("not-perpendicular");
  });

  it("classifies near-zero approximate operands as degenerate", () => {
    const tiny = { x: approx("eps", "0.0000000001"), y: sc("0"), z: sc("0") };
    expect(arePerpendicular(tiny, vec("0", "1", "0")).classification).toBe("degenerate");
  });
});

describe("same / opposite direction", () => {
  it("detects same and opposite directions exactly", () => {
    expect(areSameDirection(vec("1", "1", "0"), vec("2", "2", "0"))).toEqual({
      classification: "same-direction",
      exact: true,
    });
    expect(areOppositeDirection(vec("1", "0", "0"), vec("-3", "0", "0"))).toEqual({
      classification: "opposite-direction",
      exact: true,
    });
  });

  it("reports mismatched senses", () => {
    expect(areSameDirection(vec("1", "1", "0"), vec("-2", "-2", "0")).classification).toBe(
      "not-same-direction",
    );
    expect(areOppositeDirection(vec("1", "1", "0"), vec("2", "2", "0")).classification).toBe(
      "not-opposite-direction",
    );
    expect(areSameDirection(vec("1", "0", "0"), vec("0", "1", "0")).classification).toBe(
      "not-same-direction",
    );
    expect(areOppositeDirection(vec("1", "0", "0"), vec("0", "1", "0")).classification).toBe(
      "not-opposite-direction",
    );
  });

  it("classifies zero operands as degenerate", () => {
    expect(areSameDirection(vec("0", "0", "0"), vec("1", "0", "0")).classification).toBe(
      "degenerate",
    );
    expect(areOppositeDirection(vec("0", "0", "0"), vec("1", "0", "0")).classification).toBe(
      "degenerate",
    );
  });

  it("uses the tolerance path for approximate input", () => {
    const a = { x: approx("a", "1"), y: sc("0"), z: sc("0") };
    const same = { x: sc("2"), y: approx("b", "0.0000000001"), z: sc("0") };
    const sameResult = areSameDirection(a, same);
    expect(sameResult.classification).toBe("same-direction");
    expect(sameResult.exact).toBe(false);
    expect(sameResult.tolerance).toEqual(DEFAULT_TOLERANCE);

    const opposite = { x: sc("-1"), y: approx("b", "0.0000000001"), z: sc("0") };
    expect(areOppositeDirection(a, opposite).classification).toBe("opposite-direction");
    expect(areSameDirection(a, opposite).classification).toBe("not-same-direction");
    expect(areOppositeDirection(a, same).classification).toBe("not-opposite-direction");
  });

  it("refuses to guess the sense when the dot product is undecidable", () => {
    // Both operands are non-zero but tiny; cross says "parallel", yet
    // a·b ≈ 1e-16 is inside the tolerance band → degenerate, not a guess.
    const a = { x: approx("a", "0.00000001"), y: sc("0"), z: sc("0") };
    const b = { x: sc("0.00000001"), y: approx("eps", "0.0000000000000001"), z: sc("0") };
    expect(areSameDirection(a, b).classification).toBe("degenerate");
    expect(areOppositeDirection(a, b).classification).toBe("degenerate");
  });

  it("classifies near-zero approximate operands as degenerate", () => {
    const tiny = { x: approx("eps", "0.0000000001"), y: sc("0"), z: sc("0") };
    expect(areSameDirection(tiny, vec("1", "0", "0")).classification).toBe("degenerate");
    expect(areOppositeDirection(vec("1", "0", "0"), tiny).classification).toBe("degenerate");
  });

  it("reports neither sense for non-parallel approximate vectors", () => {
    const a = { x: approx("a", "1"), y: sc("0"), z: sc("0") };
    const b = vec("0", "1", "0");
    expect(areSameDirection(a, b).classification).toBe("not-same-direction");
    expect(areOppositeDirection(a, b).classification).toBe("not-opposite-direction");
    expect(areSameDirection(a, b).exact).toBe(false);
  });
});

describe("areCoincidentLines", () => {
  it("detects coincident lines (same or different base point)", () => {
    const line1 = makeLine("A", vec("0", "0", "0"), vec("1", "0", "0"));
    const same = makeLine("B", vec("0", "0", "0"), vec("2", "0", "0"));
    const shifted = makeLine("C", vec("5", "0", "0"), vec("-1", "0", "0"));
    expect(areCoincidentLines(line1, same)).toEqual({
      classification: "coincident",
      exact: true,
    });
    expect(areCoincidentLines(line1, shifted).classification).toBe("coincident");
  });

  it("rejects parallel-but-offset and non-parallel lines", () => {
    const line1 = makeLine("A", vec("0", "0", "0"), vec("1", "0", "0"));
    const offset = makeLine("B", vec("0", "1", "0"), vec("1", "0", "0"));
    const crossing = makeLine("C", vec("0", "0", "0"), vec("0", "1", "0"));
    expect(areCoincidentLines(line1, offset).classification).toBe("not-coincident");
    expect(areCoincidentLines(line1, crossing).classification).toBe("not-coincident");
  });

  it("classifies zero directions as degenerate", () => {
    const line1 = makeLine("A", vec("0", "0", "0"), vec("1", "0", "0"));
    const zeroDir = makeLine("B", vec("0", "0", "0"), vec("0", "0", "0"));
    expect(areCoincidentLines(line1, zeroDir).classification).toBe("degenerate");
    expect(areCoincidentLines(zeroDir, line1).classification).toBe("degenerate");
  });

  it("uses the tolerance path for approximate input", () => {
    const line1 = makeLine("A", vec("0", "0", "0"), vec("1", "0", "0"));
    const near = makeLine("B", { x: sc("0"), y: approx("eps", "0.0000000001"), z: sc("0") }, vec("1", "0", "0"));
    const result = areCoincidentLines(line1, near);
    expect(result.classification).toBe("coincident");
    expect(result.exact).toBe(false);
    expect(result.tolerance).toEqual(DEFAULT_TOLERANCE);

    const far = makeLine("C", { x: sc("0"), y: approx("d", "0.001"), z: sc("0") }, vec("1", "0", "0"));
    expect(areCoincidentLines(line1, far).classification).toBe("not-coincident");

    const skewDir = makeLine("D", vec("0", "0", "0"), { x: approx("a", "1"), y: approx("b", "0.001"), z: sc("0") });
    expect(areCoincidentLines(line1, skewDir).classification).toBe("not-coincident");
  });

  it("treats identical approximate base points as coincident", () => {
    const line1 = makeLine("A", { x: approx("0", "0"), y: sc("0"), z: sc("0") }, vec("1", "0", "0"));
    const line2 = makeLine("B", { x: approx("0", "0"), y: sc("0"), z: sc("0") }, vec("2", "0", "0"));
    expect(areCoincidentLines(line1, line2).classification).toBe("coincident");
  });

  it("detects coincidence via a non-tiny connector within cross tolerance", () => {
    // Connector (5, 1e-12, 0) is NOT near-zero, but its cross product with
    // the direction (~1e-12) is inside the tolerance band → coincident.
    const line1 = makeLine("A", vec("0", "0", "0"), vec("1", "0", "0"));
    const line2 = makeLine(
      "B",
      { x: approx("x", "5"), y: approx("eps", "0.000000000001"), z: sc("0") },
      vec("1", "0", "0"),
    );
    const result = areCoincidentLines(line1, line2);
    expect(result.classification).toBe("coincident");
    expect(result.exact).toBe(false);
  });

  it("classifies near-zero approximate directions as degenerate", () => {
    const line1 = makeLine("A", vec("0", "0", "0"), vec("1", "0", "0"));
    const tinyDir = makeLine("B", vec("0", "0", "0"), { x: approx("eps", "0.0000000001"), y: sc("0"), z: sc("0") });
    expect(areCoincidentLines(line1, tinyDir).classification).toBe("degenerate");
  });
});

describe("areCollinearPoints", () => {
  it("detects exact collinearity", () => {
    expect(
      areCollinearPoints(vec("0", "0", "0"), vec("1", "1", "1"), vec("2", "2", "2")),
    ).toEqual({ classification: "collinear", exact: true });
    expect(
      areCollinearPoints(vec("0", "0", "0"), vec("1", "0", "0"), vec("0", "1", "0"))
        .classification,
    ).toBe("not-collinear");
  });

  it("accepts Point3V1 inputs", () => {
    expect(
      areCollinearPoints(
        makePoint("P1", vec("0", "0", "0")),
        makePoint("P2", vec("1", "1", "0")),
        makePoint("P3", vec("3", "3", "0")),
      ).classification,
    ).toBe("collinear");
  });

  it("classifies duplicate points as degenerate (no unique line)", () => {
    expect(
      areCollinearPoints(vec("1", "1", "1"), vec("1", "1", "1"), vec("2", "2", "2"))
        .classification,
    ).toBe("degenerate");
    expect(
      areCollinearPoints(vec("0", "0", "0"), vec("1", "1", "1"), vec("1", "1", "1"))
        .classification,
    ).toBe("degenerate");
    expect(
      areCollinearPoints(vec("0", "0", "0"), vec("1", "1", "1"), vec("0", "0", "0"))
        .classification,
    ).toBe("degenerate");
  });

  it("uses the tolerance path for approximate input", () => {
    const p3 = { x: sc("2"), y: approx("eps", "0.0000000001"), z: sc("0") };
    const result = areCollinearPoints(vec("0", "0", "0"), vec("1", "0", "0"), p3);
    expect(result.classification).toBe("collinear");
    expect(result.exact).toBe(false);
    expect(result.tolerance).toEqual(DEFAULT_TOLERANCE);

    const far = { x: sc("2"), y: approx("d", "0.001"), z: sc("0") };
    expect(
      areCollinearPoints(vec("0", "0", "0"), vec("1", "0", "0"), far).classification,
    ).toBe("not-collinear");
  });

  it("classifies near-duplicate approximate points as degenerate", () => {
    const nearDuplicate = { x: approx("eps", "0.0000000001"), y: sc("0"), z: sc("0") };
    expect(
      areCollinearPoints(vec("0", "0", "0"), nearDuplicate, vec("2", "2", "2"))
        .classification,
    ).toBe("degenerate");
  });
});
