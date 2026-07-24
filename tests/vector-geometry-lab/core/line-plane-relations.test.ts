import type { Line3V1, Plane3V1, Vector3V1 } from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOLERANCE,
  linePlaneRelation,
  planePlaneRelation,
  unwrapCoreResult,
  vectorPlaneRelation,
} from "@/features/vector-geometry-lab/core";
import { approxVec, vec } from "./helpers.js";

function makeLine(lineId: string, point: Vector3V1, direction: Vector3V1): Line3V1 {
  return {
    lineId,
    label: lineId,
    point: { pointId: `${lineId}-p`, label: "P", position: point },
    direction,
  };
}

function makePlane(planeId: string, point: Vector3V1, normal: Vector3V1): Plane3V1 {
  return {
    planeId,
    label: planeId,
    point: { pointId: `${planeId}-p`, label: "P", position: point },
    normal,
  };
}

describe("vectorPlaneRelation", () => {
  it("classifies a vector parallel to the plane (v·n = 0)", () => {
    const outcome = unwrapCoreResult(
      vectorPlaneRelation(vec("1", "2", "3"), makePlane("pl", vec("0", "0", "0"), vec("1", "1", "-1"))),
    );
    expect(outcome.result.classification).toBe("parallel-to-plane");
    expect(outcome.result.dotProduct.numerator).toBe("0");
    expect(outcome.result.exact).toBe(true);
    expect(outcome.result.displayGeometry[0]?.kind).toBe("normal-arrow");
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("dot-product-evidence");
    expect(rules).toContain("relation-classification");
    expect(outcome.derivations.length).toBeGreaterThanOrEqual(4);
  });

  it("classifies a vector perpendicular to the plane (v ∥ n)", () => {
    const outcome = unwrapCoreResult(
      vectorPlaneRelation(vec("2", "4", "6"), makePlane("pl", vec("0", "0", "0"), vec("1", "2", "3"))),
    );
    expect(outcome.result.classification).toBe("perpendicular-to-plane");
    expect(outcome.result.dotProduct.numerator).toBe("28");
  });

  it("classifies an oblique vector", () => {
    const outcome = unwrapCoreResult(
      vectorPlaneRelation(vec("1", "0", "0"), makePlane("pl", vec("0", "0", "0"), vec("1", "1", "1"))),
    );
    expect(outcome.result.classification).toBe("oblique");
    expect(outcome.result.dotProduct.numerator).toBe("1");
  });

  it("refuses a zero vector with a structured failure", () => {
    const result = vectorPlaneRelation(
      vec("0", "0", "0"),
      makePlane("pl", vec("0", "0", "0"), vec("1", "1", "1")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("refuses a zero plane normal with a structured failure", () => {
    const result = vectorPlaneRelation(
      vec("1", "0", "0"),
      makePlane("pl", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("takes the tolerance path for approximate input and records the tolerance", () => {
    const outcome = unwrapCoreResult(
      vectorPlaneRelation(
        approxVec("1", "2", "3"),
        makePlane("pl", vec("0", "0", "0"), vec("1", "1", "-1")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-to-plane");
    expect(outcome.result.exact).toBe(false);
    expect(outcome.result.tolerance).toEqual(DEFAULT_TOLERANCE);
  });
});

describe("linePlaneRelation", () => {
  const planeZ2 = makePlane("pl", vec("0", "0", "2"), vec("0", "0", "1"));

  it("classifies a line contained in the plane", () => {
    const outcome = unwrapCoreResult(
      linePlaneRelation(makeLine("l", vec("1", "1", "2"), vec("1", "1", "0")), planeZ2),
    );
    expect(outcome.result.classification).toBe("contained-in-plane");
    expect(outcome.result.dotProduct.numerator).toBe("0");
    expect(outcome.result.basePointResidual.numerator).toBe("0");
    expect(outcome.result.intersectionPoint).toBeUndefined();
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("dot-product-evidence");
    expect(rules).toContain("base-point-substitution");
    expect(rules).toContain("relation-classification");
  });

  it("classifies a line parallel to but not in the plane", () => {
    const outcome = unwrapCoreResult(
      linePlaneRelation(makeLine("l", vec("1", "1", "3"), vec("1", "1", "0")), planeZ2),
    );
    expect(outcome.result.classification).toBe("parallel-not-in-plane");
    expect(outcome.result.basePointResidual.numerator).toBe("1");
  });

  it("classifies an intersecting line with λ and the point", () => {
    const outcome = unwrapCoreResult(
      linePlaneRelation(
        makeLine("l", vec("0", "0", "1"), vec("1", "1", "1")),
        makePlane("pl", vec("0", "0", "0"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("intersecting-at-point");
    expect(outcome.result.parameter?.numerator).toBe("-1");
    expect(outcome.result.intersectionPoint?.position.x.numerator).toBe("-1");
    expect(outcome.result.intersectionPoint?.position.y.numerator).toBe("-1");
    expect(outcome.result.intersectionPoint?.position.z.numerator).toBe("0");
    expect(outcome.result.displayGeometry.map((d) => d.kind)).toContain("point");
  });

  it("classifies a line perpendicular to the plane and still gives the point", () => {
    const outcome = unwrapCoreResult(
      linePlaneRelation(
        makeLine("l", vec("1", "2", "3"), vec("0", "0", "7")),
        makePlane("pl", vec("0", "0", "0"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("perpendicular-to-plane");
    expect(outcome.result.parameter?.numerator).toBe("-3");
    expect(outcome.result.parameter?.denominator).toBe("7");
    expect(outcome.result.intersectionPoint?.position.x.numerator).toBe("1");
    expect(outcome.result.intersectionPoint?.position.y.numerator).toBe("2");
    expect(outcome.result.intersectionPoint?.position.z.numerator).toBe("0");
  });

  it("refuses a zero line direction with a structured failure", () => {
    const result = linePlaneRelation(makeLine("l", vec("0", "0", "0"), vec("0", "0", "0")), planeZ2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });
});

describe("planePlaneRelation", () => {
  it("classifies coincident planes (equations are scalar multiples)", () => {
    const outcome = unwrapCoreResult(
      planePlaneRelation(
        makePlane("pl1", vec("1", "2", "3"), vec("1", "1", "1")),
        makePlane("pl2", vec("0", "0", "6"), vec("2", "2", "2")),
      ),
    );
    expect(outcome.result.classification).toBe("coincident");
    expect(outcome.result.normalsRelation).toBe("parallel");
    expect(outcome.result.displayGeometry).toHaveLength(2);
    const rules = outcome.validation.map((record) => record.rule);
    expect(rules).toContain("normals-relation");
    expect(rules).toContain("relation-classification");
  });

  it("classifies parallel-not-coincident planes", () => {
    const outcome = unwrapCoreResult(
      planePlaneRelation(
        makePlane("pl1", vec("0", "0", "0"), vec("0", "0", "1")),
        makePlane("pl2", vec("0", "0", "5"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-not-coincident");
    expect(outcome.result.normalsRelation).toBe("parallel");
  });

  it("classifies intersecting-in-line planes with general normals", () => {
    const outcome = unwrapCoreResult(
      planePlaneRelation(
        makePlane("pl1", vec("0", "0", "0"), vec("0", "0", "1")),
        makePlane("pl2", vec("0", "0", "0"), vec("0", "1", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("intersecting-in-line");
    expect(outcome.result.normalsRelation).toBe("general");
    expect(outcome.result.normalsDotProduct.numerator).toBe("1");
  });

  it("classifies perpendicular planes (n1·n2 = 0)", () => {
    const outcome = unwrapCoreResult(
      planePlaneRelation(
        makePlane("pl1", vec("0", "0", "0"), vec("1", "0", "0")),
        makePlane("pl2", vec("0", "0", "0"), vec("0", "1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("perpendicular");
    expect(outcome.result.normalsRelation).toBe("perpendicular");
  });

  it("classifies intersecting planes whose normals are not perpendicular", () => {
    const outcome = unwrapCoreResult(
      planePlaneRelation(
        makePlane("pl1", vec("0", "0", "0"), vec("1", "0", "0")),
        makePlane("pl2", vec("0", "0", "0"), vec("1", "1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("intersecting-in-line");
    expect(outcome.result.normalsRelation).toBe("general");
  });

  it("refuses a zero normal with a structured failure", () => {
    const result = planePlaneRelation(
      makePlane("pl1", vec("0", "0", "0"), vec("0", "0", "0")),
      makePlane("pl2", vec("0", "0", "0"), vec("1", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("takes the tolerance path for approximate coincident planes", () => {
    const outcome = unwrapCoreResult(
      planePlaneRelation(
        makePlane("pl1", approxVec("0", "0", "0"), approxVec("0", "0", "1")),
        makePlane("pl2", approxVec("0", "0", "0.0000000001"), approxVec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("coincident");
    const classification = outcome.validation.find(
      (record) => record.rule === "relation-classification",
    );
    expect(classification?.message).toContain("approximate path");
  });
});

describe("line-plane-relations approximate paths and remaining refusals", () => {
  const planeZ2 = makePlane("pl", vec("0", "0", "2"), vec("0", "0", "1"));

  it("linePlaneRelation refuses a zero plane normal", () => {
    const result = linePlaneRelation(
      makeLine("l", vec("0", "0", "0"), vec("1", "0", "0")),
      makePlane("plz", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("planePlaneRelation refuses a zero second normal", () => {
    const result = planePlaneRelation(
      makePlane("pl1", vec("0", "0", "0"), vec("1", "0", "0")),
      makePlane("pl2", vec("0", "0", "0"), vec("0", "0", "0")),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("zero-vector");
    }
  });

  it("linePlaneRelation classifies an approximate contained line with recorded tolerances", () => {
    const outcome = unwrapCoreResult(
      linePlaneRelation(makeLine("l", approxVec("1", "1", "2"), vec("1", "1", "0")), planeZ2),
    );
    expect(outcome.result.classification).toBe("contained-in-plane");
    const dotRecord = outcome.validation.find((record) => record.rule === "dot-product-evidence");
    expect(dotRecord?.message).toContain("approximate path");
    const subRecord = outcome.validation.find((record) => record.rule === "base-point-substitution");
    expect(subRecord?.message).toContain("approximate path");
  });

  it("linePlaneRelation classifies an approximate intersection with λ and tolerance", () => {
    const outcome = unwrapCoreResult(
      linePlaneRelation(
        makeLine("l", approxVec("0", "0", "1"), vec("1", "1", "1")),
        makePlane("pl0", vec("0", "0", "0"), vec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("intersecting-at-point");
    expect(outcome.result.intersectionPoint?.position.z.numerator).toBe("0");
  });

  it("planePlaneRelation classifies approximate parallel-not-coincident planes", () => {
    const outcome = unwrapCoreResult(
      planePlaneRelation(
        makePlane("pl1", approxVec("0", "0", "0"), approxVec("0", "0", "1")),
        makePlane("pl2", approxVec("0", "0", "0.5"), approxVec("0", "0", "1")),
      ),
    );
    expect(outcome.result.classification).toBe("parallel-not-coincident");
  });

  it("planePlaneRelation classifies approximate intersecting planes", () => {
    const outcome = unwrapCoreResult(
      planePlaneRelation(
        makePlane("pl1", approxVec("0", "0", "0"), approxVec("1", "0", "0")),
        makePlane("pl2", approxVec("0", "0", "0"), approxVec("1", "1", "0")),
      ),
    );
    expect(outcome.result.classification).toBe("intersecting-in-line");
    expect(outcome.result.normalsRelation).toBe("general");
  });

  it("honours an explicit tolerance override", () => {
    const outcome = unwrapCoreResult(
      vectorPlaneRelation(
        vec("1", "2", "3"),
        makePlane("pl", vec("0", "0", "0"), vec("1", "1", "-1")),
        { tolerance: { absolute: 0.001, relative: 0.001 } },
      ),
    );
    expect(outcome.result.classification).toBe("parallel-to-plane");
  });
});

describe("line-plane-relations approximate paths with tolerance overrides", () => {
  const OVERRIDE = { tolerance: { absolute: 0.001, relative: 0.001 } } as const;

  it("vectorPlaneRelation records the overridden tolerance on the approximate path", () => {
    const outcome = unwrapCoreResult(
      vectorPlaneRelation(
        approxVec("1", "2", "3"),
        makePlane("pl", vec("0", "0", "0"), vec("1", "1", "-1")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("parallel-to-plane");
    expect(outcome.result.exact).toBe(false);
    expect(outcome.result.tolerance).toEqual({ absolute: 0.001, relative: 0.001 });
  });

  it("linePlaneRelation classifies with the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      linePlaneRelation(
        makeLine("l", approxVec("1", "1", "2"), vec("1", "1", "0")),
        makePlane("pl", vec("0", "0", "2"), vec("0", "0", "1")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("contained-in-plane");
  });

  it("planePlaneRelation classifies with the overridden tolerance", () => {
    const outcome = unwrapCoreResult(
      planePlaneRelation(
        makePlane("pl1", approxVec("0", "0", "0"), approxVec("0", "0", "1")),
        makePlane("pl2", approxVec("0", "0", "0.0000000001"), approxVec("0", "0", "1")),
        OVERRIDE,
      ),
    );
    expect(outcome.result.classification).toBe("coincident");
  });
});
