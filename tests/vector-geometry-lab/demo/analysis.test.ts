import { describe, expect, it } from "vitest";
import { BUILTIN_EXAMPLES } from "@/pages/vector-geometry-lab/examples/builtin-examples.js";
import { runExampleAnalysis } from "@/pages/vector-geometry-lab/analysis/run-analysis.js";
import { buildEntityMetadata, describeScene } from "@/pages/vector-geometry-lab/analysis/scene-facts.js";
import { formatDistance, formatVector } from "@/pages/vector-geometry-lab/analysis/format.js";
import { scalarFromLiteral } from "@/features/vector-geometry-lab/schema";

function example(id: string) {
  const found = BUILTIN_EXAMPLES.find((e) => e.id === id);
  if (found === undefined) {
    throw new Error(`missing example ${id}`);
  }
  return found;
}

function conclusionOf(id: string): string {
  const output = runExampleAnalysis(id, example(id).scene);
  const model = output.models[0];
  expect(model).toBeDefined();
  const section = model?.sections.find((s) => s.sectionId === "geometric-conclusion");
  const first = section?.items[0];
  if (first === undefined || first.kind !== "text") {
    throw new Error(`no conclusion for ${id}`);
  }
  return first.text;
}

describe("built-in examples registry", () => {
  it("contains exactly the 16 spec-listed examples", () => {
    expect(BUILTIN_EXAMPLES).toHaveLength(16);
    const ids = BUILTIN_EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(16);
  });
});

describe("runExampleAnalysis — solved examples (real core results)", () => {
  it("1. angle between two vectors: 90° perpendicular + arc sweep metadata", () => {
    const output = runExampleAnalysis("angle-between-vectors", example("angle-between-vectors").scene);
    expect(output.models[0]?.status).toBe("solved");
    expect(conclusionOf("angle-between-vectors")).toContain("90°");
    const arc = output.displayMetadata.find((m) => m.kind === "angle-arc");
    expect(arc?.keyParams["sweepDegrees"]).toBe("90");
    expect(output.displayGeometry.length).toBeGreaterThan(0);
  });

  it("2. point-point distance = 5", () => {
    expect(conclusionOf("point-point-distance")).toContain("5");
  });

  it("3. point-line distance = √13 with foot (1, 0, 0)", () => {
    const output = runExampleAnalysis("point-line-distance", example("point-line-distance").scene);
    const model = output.models[0];
    const solving = model?.sections.find((s) => s.sectionId === "solving");
    const text = JSON.stringify(solving?.items);
    expect(conclusionOf("point-line-distance")).toContain("√13");
    expect(text).toContain("(1, 0, 0)");
  });

  it("4. point-plane distance = 3", () => {
    expect(conclusionOf("point-plane-distance")).toContain("3");
  });

  it("5. intersecting lines meet at (1, 0, 0)", () => {
    expect(conclusionOf("intersecting-lines")).toContain("(1, 0, 0)");
  });

  it("6. parallel lines distance = 5", () => {
    expect(conclusionOf("parallel-lines")).toContain("5");
  });

  it("7. skew lines shortest distance = 2", () => {
    const output = runExampleAnalysis("skew-lines", example("skew-lines").scene);
    expect(conclusionOf("skew-lines")).toContain("2");
    // The common-perpendicular segment is highlighted as display geometry.
    expect(output.displayGeometry.some((d) => d.kind === "segment")).toBe(true);
  });

  it("8. line contained in plane", () => {
    expect(conclusionOf("line-contained-in-plane")).toContain("contained in plane");
  });

  it("9. line-plane intersection at (2, 2, 0)", () => {
    expect(conclusionOf("line-plane-intersection")).toContain("(2, 2, 0)");
  });

  it("10. line parallel to plane (not contained)", () => {
    expect(conclusionOf("line-parallel-to-plane")).toContain("parallel not in plane");
  });

  it("11. parallel planes distance = 4", () => {
    expect(conclusionOf("parallel-planes")).toContain("4");
  });

  it("12. coincident planes", () => {
    expect(conclusionOf("coincident-planes")).toContain("coincident");
  });

  it("13. intersecting planes share the x-axis line", () => {
    const conclusion = conclusionOf("intersecting-planes");
    expect(conclusion).toContain("intersect in the line");
    // Direction is the x-axis; the sign depends on n1×n2 ordering.
    expect(conclusion).toMatch(/λ\(-?1, 0, 0\)/);
  });

  it("14. perpendicular planes", () => {
    expect(conclusionOf("perpendicular-planes")).toContain("perpendicular");
  });

  it("15. plane from three points: z = 0 + generated plane display", () => {
    const output = runExampleAnalysis("plane-from-three-points", example("plane-from-three-points").scene);
    expect(conclusionOf("plane-from-three-points")).toContain("z = 0");
    expect(output.displayGeometry.some((d) => d.kind === "plane")).toBe(true);
  });
});

describe("runExampleAnalysis — degenerate example (spec §10.20)", () => {
  it("16. zero-vector angle is refused with a structured reason and NO answer", () => {
    const output = runExampleAnalysis("degenerate-input", example("degenerate-input").scene);
    const model = output.models[0];
    expect(model?.status).toBe("refused");
    expect(model?.refusal?.code).toBe("zero-vector");
    const text = JSON.stringify(model);
    expect(text).not.toContain("θ = 90");
  });

  it("unknown example ids produce a setup refusal, not a crash", () => {
    const output = runExampleAnalysis("does-not-exist", example("skew-lines").scene);
    expect(output.models[0]?.status).toBe("refused");
    expect(output.models[0]?.refusal?.code).toBe("demo-setup-error");
  });
});

describe("scene facts and metadata", () => {
  it("describeScene lists known inputs, equations and direction vectors", () => {
    const scene = example("line-plane-intersection").scene;
    const subject = describeScene(scene);
    expect(subject.knownInputs.length).toBe(2);
    expect(subject.equations.some((e) => e.equation.includes("λ"))).toBe(true);
    expect(subject.directionVectors.some((d) => d.key.includes("normal"))).toBe(true);
  });

  it("buildEntityMetadata carries equations and key params for picking", () => {
    const scene = example("point-point-distance").scene;
    const metadata = buildEntityMetadata(scene);
    expect(metadata).toHaveLength(2);
    expect(metadata[0]?.equationText).toBe("P = (1, 2, 3)");
    expect(metadata[0]?.keyParams["coordinate x"]).toBe("1");
  });

  it("line and plane metadata use the core equation forms", () => {
    const scene = example("line-plane-intersection").scene;
    const metadata = buildEntityMetadata(scene);
    const line = metadata.find((m) => m.kind === "line");
    const plane = metadata.find((m) => m.kind === "plane");
    expect(line?.equationText).toContain("λ");
    expect(plane?.equationText).toContain("z = 0");
  });
});

describe("format helpers", () => {
  it("formatVector uses exact literals", () => {
    const sx = scalarFromLiteral("3/2");
    const sy = scalarFromLiteral("-7");
    const sz = scalarFromLiteral("0");
    if (!sx.ok || !sy.ok || !sz.ok) {
      throw new Error("bad literal");
    }
    expect(formatVector({ x: sx.value, y: sy.value, z: sz.value })).toBe("(3/2, -7, 0)");
  });

  it("formatDistance renders exact radical with decimal approximation", () => {
    const output = runExampleAnalysis("point-line-distance", example("point-line-distance").scene);
    const model = output.models[0];
    const solving = model?.sections.find((s) => s.sectionId === "solving");
    const distanceItem = solving?.items.find(
      (item) => item.kind === "key-value" && item.key === "distance",
    );
    expect(distanceItem && "value" in distanceItem ? distanceItem.value : "").toContain("√13");
    expect(distanceItem && "value" in distanceItem ? distanceItem.value : "").toContain("≈");
  });

  it("formatDistance approximate path shows the recorded tolerance", () => {
    const text = formatDistance({
      kind: "approximate",
      value: 1.5,
      tolerance: { absolute: 1e-9, relative: 1e-9 },
    });
    expect(text).toContain("approximate");
    expect(text).toContain("tolerance");
  });
});
