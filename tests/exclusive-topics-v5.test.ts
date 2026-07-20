import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ExclusiveTopicsView from "@/pages/knowledge-tree/components/ExclusiveTopicsView";
import PaperSelector from "@/pages/knowledge-tree/components/PaperSelector";
import { buildComparisonSummaryRows, buildExclusiveTopicExportRows } from "@/utils/exportExclusiveTopics";
import type { ExclusiveSubtopicItem } from "@/data/knowledge-tree/types-v3.2";

const item: ExclusiveSubtopicItem = {
  subtopicId: "CAIE-0580-E4.5.2",
  subtopicName: "Recognise symmetry properties of prisms, cylinders, pyramids and cones.",
  topicName: "Geometry and mensuration",
  paperRef: null,
  comparisonStatus: "exclusive",
  syllabusVersion: "2025-2027",
  sectionId: "E4.5.2",
  printedPage: 41,
  pdfPage: 47,
  sourceUrl: "https://example.com/0580.pdf",
  sourceLocator: "PDF page 47, E4.5.2",
  notesText: ["Includes planes and axes of symmetry."],
  examplesText: ["Prisms and cones."],
  tiers: ["Extended"],
  conceptLabels: ["Axes of symmetry of 3D solids"],
  dimensionLabels: ["3d"],
  decisionReason: "No approved counterpart exists in the comparison selection.",
};

describe("Knowledge V5 statement presentation", () => {
  it("shows official Paper codes and names while retaining the stable Paper ID as the value", () => {
    const html = renderToStaticMarkup(React.createElement(PaperSelector, {
      label: "Paper",
      papers: [{ id: "CAIE-0580-Paper-2", code: "2", name: "Paper 2 Non-calculator (Extended)", tiers: ["Extended"] }],
      value: "CAIE-0580-Paper-2",
      onChange: () => undefined,
    }));
    expect(html).toContain('value="CAIE-0580-Paper-2"');
    expect(html).toContain("2 · Paper 2 Non-calculator (Extended) · Extended");
  });

  it("renders the full statement, provenance, status and collapsed notes", () => {
    const html = renderToStaticMarkup(React.createElement(ExclusiveTopicsView, {
      aName: "0580",
      bName: "4MA1",
      aExclusive: [item],
      bExclusive: [],
    }));
    expect(html).toContain(item.subtopicName);
    expect(html).toContain("确定独有");
    expect(html).toContain("E4.5.2");
    expect(html).toContain("印刷页 41");
    expect(html).toContain("PDF 页 47");
    expect(html).toContain("Source Ref：");
    expect(html).toContain("PDF page 47, E4.5.2");
    expect(html).toContain("Notes / examples");
    expect(html).toContain("Includes planes and axes of symmetry.");
    expect(html).toContain("官方来源");
  });

  it("exports the same full statement and real source reference", () => {
    const rows = buildExclusiveTopicExportRows([item], "0580");
    expect(rows[0].考纲原文).toBe(item.subtopicName);
    expect(rows[0].状态).toBe("确定独有");
    expect(rows[0]["Source Ref"]).toBe("PDF page 47, E4.5.2");
    expect(rows[0]["Printed Page"]).toBe(41);
    expect(rows[0]["PDF Page"]).toBe(47);
    expect(rows[0]["Canonical Concepts"]).toContain("Axes of symmetry of 3D solids");
  });

  it("counts V5 comparison states separately instead of labelling every exported row exclusive", () => {
    const partial = { ...item, subtopicId: "partial", comparisonStatus: "partial" as const };
    const unresolved = { ...item, subtopicId: "unresolved", comparisonStatus: "unresolved" as const };
    const summary = buildComparisonSummaryRows({
      aName: "0580",
      bName: "4MA1",
      aExclusive: [item, partial],
      bExclusive: [unresolved],
    });
    expect(summary).toContainEqual({ 项目: "A 确定独有数量", 内容: 1 });
    expect(summary).toContainEqual({ 项目: "A 部分重合数量", 内容: 1 });
    expect(summary).toContainEqual({ 项目: "B 待核验数量", 内容: 1 });
  });

  it("renders exclusive, partial and unresolved statements in separate labelled sections", () => {
    const html = renderToStaticMarkup(React.createElement(ExclusiveTopicsView, {
      aName: "0580",
      bName: "4MA1",
      aExclusive: [
        item,
        { ...item, subtopicId: "partial", comparisonStatus: "partial" },
        { ...item, subtopicId: "unresolved", comparisonStatus: "unresolved" },
      ],
      bExclusive: [],
    }));
    expect(html).toContain('aria-label="确定独有"');
    expect(html).toContain('aria-label="部分重合"');
    expect(html).toContain('aria-label="待核验"');
  });
});
