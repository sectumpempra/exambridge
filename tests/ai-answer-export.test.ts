import { describe, expect, it } from "vitest";
import {
  answerExportFileStem,
  buildAnswerPlainText,
  buildStandaloneAnswerHtml,
  calculatePngSlices,
  escapeExportHtml,
  type AIAnswerExportModel,
} from "@/components/ai/exportAIAnswer";

const model: AIAnswerExportModel = {
  messageId: "answer-1",
  markdown: "## 结论\n\n**9709** 可使用计算器。",
  renderedHtml: "<h3>结论</h3><p><strong>9709</strong> 可使用计算器。</p>",
  plainText: "结论\n9709 可使用计算器。",
  citations: [{
    sourceId: "S1",
    title: "Cambridge 9709 Specification",
    url: "https://www.cambridgeinternational.org/9709",
    dataVersion: "2026–2027",
  }],
  contextLabels: ["CAIE 9709 Mathematics"],
  exportedAt: "2026-07-23T01:02:00.000Z",
  completionState: "complete",
};

describe("AI answer exports", () => {
  it("escapes metadata and creates a script-free standalone document", () => {
    expect(escapeExportHtml('<img onerror="x">')).toBe("&lt;img onerror=&quot;x&quot;&gt;");
    const html = buildStandaloneAnswerHtml(model);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("ExamBridge AI 回答");
    expect(html).toContain("CAIE 9709 Mathematics");
    expect(html).toContain("Cambridge 9709 Specification");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("provides a plain-text equivalent with sources", () => {
    const plain = buildAnswerPlainText(model);
    expect(plain).toContain("检索范围：CAIE 9709 Mathematics");
    expect(plain).toContain("9709 可使用计算器");
    expect(plain).toContain("[S1] Cambridge 9709 Specification");
  });

  it("splits long PNG canvases without dropping pixels", () => {
    expect(calculatePngSlices(31_000, 14_000)).toEqual([
      { start: 0, height: 14_000 },
      { start: 14_000, height: 14_000 },
      { start: 28_000, height: 3_000 },
    ]);
    expect(calculatePngSlices(0)).toEqual([]);
  });

  it("uses deterministic safe filenames", () => {
    expect(answerExportFileStem("2026-07-23T01:02:00.000Z")).toMatch(/^exambridge-answer-\d{8}-\d{4}$/);
  });
});
