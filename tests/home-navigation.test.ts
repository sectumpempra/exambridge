import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Home from "../src/pages/Home";
import Header from "../src/components/Header";
import { CourseContextProvider } from "../src/course-context/CourseContextProvider";
import { MORE_NAV, NAV_GROUPS, PRIMARY_NAV } from "../src/data/navLinks";

describe("teacher-first navigation", () => {
  it("groups every working route by a teacher task without duplicates", () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual([
      "课程与考试",
      "数据分析",
      "试卷与考纲",
      "教学工具",
    ]);

    const routes = [...PRIMARY_NAV, ...MORE_NAV].map((item) => item.to);
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes).toEqual(expect.arrayContaining([
      "/courses",
      "/exam-overview",
      "/results",
      "/statistics",
      "/calculator",
      "/papers",
      "/knowledge-tree",
      "/tools",
      "/planner",
      "/graph",
      "/mechanics-lab",
      "/personality",
      "/about",
    ]));
    expect(PRIMARY_NAV.every((item) => item.preserveCourse)).toBe(true);
  });

  it("renders a course-first home page with the five approved teacher tasks", () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ["/"] },
        createElement(CourseContextProvider, null, createElement(Home)),
      ),
    );

    expect(html).toContain("从一门课程开始");
    expect(html).toContain("先选择一门课程");
    expect(html).toContain("了解考试安排");
    expect(html).toContain("比较两份考纲");
    expect(html).toContain("查看分数线与 A* 率");
    expect(html).toContain("查找和比较 Paper");
    expect(html).toContain("备课与练习工具");
    expect(html).toContain("官方尚未发布");
    expect(html).not.toContain("热门扩科路径");
    expect(html).not.toContain("EXAMBRIDGE 国际课程数据与教学工具");
  });

  it("keeps a hover bridge between every desktop trigger and dropdown panel", () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(CourseContextProvider, null, createElement(Header)),
      ),
    );

    expect(html.match(/data-nav-dropdown-bridge/g)).toHaveLength(NAV_GROUPS.length + 1);
    expect(html).toContain("top-full z-20");
    expect(html).toContain("pt-2 opacity-0");
    expect(html).not.toContain("translate-y-2");
  });
});
