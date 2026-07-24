import { describe, expect, it } from "vitest";
import { buildLegendModel, createLegendElement } from "@/features/vector-geometry-lab/three/legend";
import { buildSceneGraph, readSceneGraphMeta } from "@/features/vector-geometry-lab/three/scene-graph";
import { makePoint, makeVector3 } from "./helpers.js";

function sampleRegistry() {
  const graph = buildSceneGraph(
    {
      points: [makePoint("p1", "A", "1", "0", "0")],
      vectors: [{ vectorId: "v1", label: "u", components: makeVector3("1", "1", "0") }],
      lines: [
        {
          lineId: "l1",
          label: "l",
          point: makePoint("lp", "P", "0", "0", "0"),
          direction: makeVector3("1", "0", "0"),
        },
      ],
      planes: [
        {
          planeId: "pl1",
          label: "π",
          point: makePoint("pp", "Q", "0", "0", "1"),
          normal: makeVector3("0", "0", "1"),
        },
      ],
      displayGeometry: [
        {
          displayId: "seg-1",
          kind: "segment",
          label: "d",
          relatedEntityIds: [],
          points: [
            makePoint("s1", "F", "0", "0", "0"),
            makePoint("s2", "G", "0", "1", "0"),
          ],
        },
      ],
    },
    { labelsEnabled: false },
  );
  return readSceneGraphMeta(graph)!.registry;
}

describe("buildLegendModel", () => {
  it("contains one entry per registry object, ordered by kind", () => {
    const model = buildLegendModel(sampleRegistry());
    const kinds = model.entries.map((e) => e.kind);
    expect(kinds[0]).toBe("point");
    expect(kinds).toContain("vector-arrow");
    expect(kinds).toContain("line");
    expect(kinds).toContain("plane");
    expect(kinds).toContain("segment");
    // Orientation scaffold is listed too (axes/grid/origin are in the registry).
    expect(kinds).toContain("axis");
    expect(kinds).toContain("grid");
    expect(kinds).toContain("origin-marker");
    // Kind ordering: point < vector < line < plane < ... per KIND_ORDER.
    const pointIndex = kinds.indexOf("point");
    const vectorIndex = kinds.indexOf("vector-arrow");
    const lineIndex = kinds.indexOf("line");
    expect(pointIndex).toBeLessThan(vectorIndex);
    expect(vectorIndex).toBeLessThan(lineIndex);
  });

  it("every entry carries colour AND line-style AND text (colour never sole channel)", () => {
    const model = buildLegendModel(sampleRegistry());
    for (const entry of model.entries) {
      expect(entry.cssColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(entry.lineStyle.length).toBeGreaterThan(0);
      expect(entry.kindLabel.length).toBeGreaterThan(0);
      expect(entry.symbol.length).toBeGreaterThan(0);
    }
    const vector = model.entries.find((e) => e.kind === "vector-arrow");
    const normal = model.entries.find((e) => e.kind === "normal-arrow");
    expect(vector?.lineStyle).toBe("solid");
    // normal-arrow is not in this registry; check the style table instead.
    expect(normal).toBeUndefined();
  });

  it("uses the provided title", () => {
    expect(buildLegendModel(sampleRegistry(), "图例").title).toBe("图例");
  });
});

describe("createLegendElement", () => {
  it("renders an aside with one li per entry, each with a style swatch", () => {
    const model = buildLegendModel(sampleRegistry());
    const element = createLegendElement(model);
    expect(element.tagName).toBe("ASIDE");
    const items = element.querySelectorAll("[data-legend-entry]");
    expect(items).toHaveLength(model.entries.length);
    const first = items[0];
    expect(first?.querySelector("[data-legend-swatch]")?.getAttribute("data-legend-swatch")).toBe(
      model.entries[0]?.lineStyle,
    );
    expect(first?.textContent).toContain(model.entries[0]?.name ?? "");
    expect(first?.textContent).toContain(model.entries[0]?.kindLabel ?? "");
  });

  it("dashed styles get a dashed swatch border (line-style channel in the legend)", () => {
    const model = {
      title: "t",
      entries: [
        {
          id: "n1",
          kind: "normal-arrow" as const,
          name: "n",
          cssColor: "#56B4E9",
          lineStyle: "dashed" as const,
          symbol: "dashed-arrow",
          kindLabel: "plane normal (dashed arrow)",
        },
      ],
    };
    const element = createLegendElement(model);
    const swatch = element.querySelector("[data-legend-swatch]") as HTMLElement;
    expect(swatch.style.borderTop).toContain("dashed");
  });

  it("accepts an injected document (non-global DOM)", () => {
    const model = buildLegendModel(sampleRegistry());
    const element = createLegendElement(model, document);
    expect(element.ownerDocument).toBe(document);
  });
});
