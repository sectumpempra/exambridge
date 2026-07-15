import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CourseContextProvider } from "../src/course-context/CourseContextProvider";
import { getPaperById } from "../src/data/papers/paperMetadata";
import { buildKnowledgeComparisonHref, getKnowledgeSelectionForPaper } from "../src/data/papers/knowledgeComparison";
import { getKnowledgeComparisonPrompt, isKnowledgeComparisonValid } from "../src/data/knowledge-tree/comparison-selection";
import PaperComparePage from "../src/pages/papers/PaperComparePage";
import PaperDetailPage from "../src/pages/papers/PaperDetailPage";

function withApp(element: React.ReactNode, initialEntry: string) {
  return createElement(
    MemoryRouter,
    { initialEntries: [initialEntry] },
    createElement(CourseContextProvider, null, element),
  );
}

describe("Paper structure and knowledge comparison responsibilities", () => {
  it("maps Paper metadata to canonical knowledge-tree selections", () => {
    const p1 = getPaperById("CAIE-9709-P1")!;
    const p3 = getPaperById("CAIE-9709-P3")!;
    expect(getKnowledgeSelectionForPaper(p1)).toEqual({ subjectCode: "CAIE-9709", paper: "P1" });
    expect(buildKnowledgeComparisonHref(p1, p3)).toBe(
      "/knowledge-tree?subjectA=CAIE-9709&paperA=P1&subjectB=CAIE-9709&paperB=P3",
    );
  });

  it("allows different Papers from the same course but rejects the same Paper", () => {
    expect(isKnowledgeComparisonValid("CAIE-9709", "CAIE-9709", "P1", "P3")).toBe(true);
    expect(isKnowledgeComparisonValid("CAIE-9709", "CAIE-9709", "P1", "P1")).toBe(false);
    expect(getKnowledgeComparisonPrompt("CAIE-9709", "CAIE-9709", "P1", "P1")).toContain("两张不同 Paper");
  });

  it("renders Paper compare as structure comparison without the legacy overlap report", () => {
    const html = renderToStaticMarkup(withApp(
      createElement(PaperComparePage),
      "/papers/compare?a=CAIE-9709-P1&b=CAIE-9709-P3",
    ));
    expect(html).toContain("Paper 结构对比");
    expect(html).toContain("考试时长");
    expect(html).toContain("比较知识内容");
    expect(html).not.toContain("完全重合");
    expect(html).not.toContain("Paper A 独有");
  });

  it("offers separate structure and knowledge actions from Paper detail", () => {
    const html = renderToStaticMarkup(withApp(
      createElement(Routes, null,
        createElement(Route, { path: "/papers/:paperId", element: createElement(PaperDetailPage) }),
      ),
      "/papers/CAIE-9709-P1",
    ));
    expect(html).toContain("比较考试结构");
    expect(html).toContain("比较知识内容");
    expect(html).toContain("考纲知识点");
  });
});
