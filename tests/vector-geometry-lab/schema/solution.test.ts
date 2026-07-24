import { describe, expect, it } from "vitest";
import {
  createPoint3,
  createVector3,
  DISPLAY_GEOMETRY_KINDS_V1,
  parseVectorGeometrySolution,
  scalarFromLiteral,
  SOLUTION_STATUSES_V1,
  vectorGeometrySolutionV1Schema,
  VECTOR_GEOMETRY_SCHEMA_VERSION_V1,
} from "@/features/vector-geometry-lab/schema";
import type {
  ScalarV1,
  Vector3V1,
  VectorGeometrySolutionV1,
} from "@/features/vector-geometry-lab/schema";

function scalar(literal: string): ScalarV1 {
  const result = scalarFromLiteral(literal);
  if (!result.ok) throw new Error(`bad literal ${literal}`);
  return result.value;
}

function vec(x: string, y: string, z: string): Vector3V1 {
  return createVector3(scalar(x), scalar(y), scalar(z));
}

const footPoint = createPoint3({
  label: "F",
  position: vec("1", "1", "0"),
  pointId: "point_F",
});

function buildSolution(): VectorGeometrySolutionV1 {
  return {
    schemaVersion: VECTOR_GEOMETRY_SCHEMA_VERSION_V1,
    status: "solved",
    results: [
      {
        kind: "scalar",
        resultId: "result_d",
        label: "distance",
        formula: "d = |(P - A) · n| / |n|",
        interpretation: "shortest distance from point to plane",
        value: scalar("3/2"),
        decimalApproximation: "1.500000",
        unit: "units",
      },
      {
        kind: "vector",
        resultId: "result_n",
        label: "normal",
        formula: "n",
        interpretation: "plane normal",
        value: vec("0", "0", "1"),
        unit: "dimensionless",
      },
      {
        kind: "point",
        resultId: "result_f",
        label: "foot",
        formula: "F = P - ((P-A)·n/|n|²) n",
        interpretation: "perpendicular foot on the plane",
        value: footPoint,
      },
      {
        kind: "boolean",
        resultId: "result_on",
        label: "on-plane",
        formula: "(P - A) · n = 0",
        interpretation: "point lies on the plane",
        value: false,
      },
      {
        kind: "text",
        resultId: "result_note",
        label: "note",
        formula: "",
        interpretation: "all values exact",
        value: "distance is non-zero; the point is not on the plane",
      },
    ],
    derivations: [
      {
        stepId: "step_1",
        order: 0,
        title: "Substitute into the distance formula",
        description: "compute the scalar projection",
        formula: "d = |(P - A) · n| / |n|",
        substitution: "d = |(1,2,3)·(0,0,1)| / 1",
        result: "d = 3/2",
      },
    ],
    validation: [
      {
        validationId: "validation_1",
        rule: "back-substitution",
        severity: "info",
        passed: true,
        message: "foot point satisfies the plane equation",
        targetIds: ["point_F", "plane_p1"],
        residual: scalar("0"),
        tolerance: "1e-9",
      },
      {
        validationId: "validation_2",
        rule: "sanity",
        severity: "warning",
        passed: false,
        message: "no residual check needed for boolean results",
        targetIds: [],
      },
    ],
    displayGeometry: [
      {
        displayId: "display_1",
        kind: "segment",
        label: "perpendicular segment",
        relatedEntityIds: ["point_A", "plane_p1"],
        points: [footPoint],
      },
      {
        displayId: "display_2",
        kind: "normal-arrow",
        label: "",
        relatedEntityIds: [],
        points: [],
        direction: vec("0", "0", "1"),
        normal: vec("0", "0", "1"),
      },
    ],
  };
}

describe("VectorGeometrySolutionV1", () => {
  it("exposes exactly the 9 spec statuses", () => {
    expect(SOLUTION_STATUSES_V1).toEqual([
      "solved",
      "input-required",
      "degenerate",
      "parallel",
      "coincident",
      "no-intersection",
      "infinite-solutions",
      "unsupported",
      "invalid-input",
    ]);
  });

  it.each(SOLUTION_STATUSES_V1)("accepts status %s", (status) => {
    const solution = { ...buildSolution(), status };
    expect(parseVectorGeometrySolution(solution).ok).toBe(true);
  });

  it("rejects an unknown status", () => {
    const solution = { ...buildSolution(), status: "half-solved" };
    expect(parseVectorGeometrySolution(solution).ok).toBe(false);
  });

  it("accepts a full valid solution", () => {
    const result = parseVectorGeometrySolution(buildSolution());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.results).toHaveLength(5);
    expect(result.value.validation[0]?.tolerance).toBe("1e-9");
  });

  it("round-trips through JSON unchanged", () => {
    const solution = buildSolution();
    const revived: unknown = JSON.parse(JSON.stringify(solution));
    const result = parseVectorGeometrySolution(revived);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual(solution);
  });

  it("accepts an empty solved shell", () => {
    const result = parseVectorGeometrySolution({
      schemaVersion: VECTOR_GEOMETRY_SCHEMA_VERSION_V1,
      status: "input-required",
      results: [],
      derivations: [],
      validation: [],
      displayGeometry: [],
    });
    expect(result.ok).toBe(true);
  });

  it("safely rejects an unknown schemaVersion", () => {
    const result = parseVectorGeometrySolution({
      ...buildSolution(),
      schemaVersion: "9.9.9",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("unsupported-schema-version");
  });

  it("rejects invalid payloads as invalid-input", () => {
    const result = parseVectorGeometrySolution({ status: "solved" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("invalid-input");
  });

  it("rejects non-object input without throwing", () => {
    expect(parseVectorGeometrySolution(42).ok).toBe(false);
  });
});

describe("GeometryResultV1 discriminated union", () => {
  it("rejects an unknown kind", () => {
    const solution = buildSolution();
    solution.results[0] = { ...solution.results[0]!, kind: "matrix" } as never;
    expect(parseVectorGeometrySolution(solution).ok).toBe(false);
  });

  it("rejects a scalar result without a decimal approximation", () => {
    const solution = buildSolution();
    const scalarResult = solution.results[0];
    if (scalarResult?.kind !== "scalar") throw new Error("wrong fixture");
    const { decimalApproximation: _omit, ...rest } = scalarResult;
    solution.results[0] = rest as never;
    expect(parseVectorGeometrySolution(solution).ok).toBe(false);
  });

  it("rejects a vector result with a zero-denominator scalar inside", () => {
    const solution = buildSolution();
    const vectorResult = solution.results[1];
    if (vectorResult?.kind !== "vector") throw new Error("wrong fixture");
    vectorResult.value.x = { ...vectorResult.value.x, denominator: "0" };
    expect(parseVectorGeometrySolution(solution).ok).toBe(false);
  });
});

describe("DerivationStepV1 / ValidationRecordV1 / DisplayGeometryV1", () => {
  it("rejects a negative derivation order", () => {
    const solution = buildSolution();
    solution.derivations[0] = { ...solution.derivations[0]!, order: -1 };
    expect(parseVectorGeometrySolution(solution).ok).toBe(false);
  });

  it("rejects a non-integer derivation order", () => {
    const solution = buildSolution();
    solution.derivations[0] = { ...solution.derivations[0]!, order: 0.5 };
    expect(parseVectorGeometrySolution(solution).ok).toBe(false);
  });

  it("rejects an unknown validation severity", () => {
    const solution = buildSolution();
    solution.validation[0] = {
      ...solution.validation[0]!,
      severity: "fatal",
    } as never;
    expect(parseVectorGeometrySolution(solution).ok).toBe(false);
  });

  it("allows validation records without residual/tolerance", () => {
    const solution = buildSolution();
    expect(
      vectorGeometrySolutionV1Schema.safeParse(solution).success,
    ).toBe(true);
  });

  it("rejects an unknown display geometry kind", () => {
    const solution = buildSolution();
    solution.displayGeometry[0] = {
      ...solution.displayGeometry[0]!,
      kind: "hologram",
    } as never;
    expect(parseVectorGeometrySolution(solution).ok).toBe(false);
  });

  it("exposes the display kind list for renderers", () => {
    expect(DISPLAY_GEOMETRY_KINDS_V1).toContain("angle-arc");
    expect(DISPLAY_GEOMETRY_KINDS_V1).toContain("normal-arrow");
    expect(DISPLAY_GEOMETRY_KINDS_V1).toHaveLength(7);
  });
});
