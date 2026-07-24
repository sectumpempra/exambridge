import { describe, expect, it } from "vitest";
import { runExampleAnalysis } from "@/pages/vector-geometry-lab/analysis/run-analysis.js";
import { getExample } from "@/pages/vector-geometry-lab/examples/builtin-examples.js";
import { buildHandoutHtml } from "@/pages/vector-geometry-lab/export/html-export.js";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function modelsOf(exampleId: string) {
  const example = getExample(exampleId)!;
  return runExampleAnalysis(exampleId, example.scene).models;
}

describe("HTML handout export (spec §7: 公式 + 三维截图 + 结论 + 验证过程)", () => {
  it("contains the teaching sections, real results and the embedded snapshot", () => {
    const html = buildHandoutHtml({
      title: "Angle between two vectors",
      models: modelsOf("angle-between-vectors"),
      pngDataUrl: PNG,
      generatedAt: "2026-07-24T00:00:00.000Z",
    });
    // Fixed teaching sections from the explain model.
    expect(html).toContain("Known inputs");
    expect(html).toContain("Formulas used");
    expect(html).toContain("Substitution");
    expect(html).toContain("Geometric conclusion");
    expect(html).toContain("Verification");
    expect(html).toContain("Conditions and limitations");
    // Real computed result — the 90° perpendicular verdict.
    expect(html).toContain("90°");
    expect(html).toContain("perpendicular");
    // The 3D screenshot is embedded as a data URL.
    expect(html).toContain(`<img alt="3D view snapshot of the scene" src="${PNG}"`);
    // Status line present and honest.
    expect(html).toContain("Status: solved");
  });

  it("embeds the explicit text fallback when WebGL was unavailable", () => {
    const html = buildHandoutHtml({
      title: "Angle between two vectors",
      models: modelsOf("angle-between-vectors"),
      pngDataUrl: null,
      generatedAt: "2026-07-24T00:00:00.000Z",
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("3D snapshot unavailable");
    expect(html).toContain("complete and independently usable");
  });

  it("exports refusals WITHOUT a fabricated answer (spec §10.20)", () => {
    const html = buildHandoutHtml({
      title: "Degenerate input and error states",
      models: modelsOf("degenerate-input"),
      pngDataUrl: null,
      generatedAt: "2026-07-24T00:00:00.000Z",
    });
    expect(html).toContain("Status: refused (zero-vector)");
    expect(html).toContain("zero vector");
    // No angle-shaped fabricated result.
    expect(html).not.toContain("θ = 90");
  });

  it("is fully self-contained — no external references anywhere", () => {
    const html = buildHandoutHtml({
      title: "Angle between two vectors",
      models: modelsOf("angle-between-vectors"),
      pngDataUrl: PNG,
      generatedAt: "2026-07-24T00:00:00.000Z",
    });
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<link");
    expect(html).toContain("<style>");
  });

  it("escapes HTML in every interpolated string", () => {
    const html = buildHandoutHtml({
      title: '<script>alert("x")</script>',
      models: modelsOf("angle-between-vectors"),
      pngDataUrl: null,
      generatedAt: "2026-07-24T00:00:00.000Z",
    });
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;alert(");
  });
});
