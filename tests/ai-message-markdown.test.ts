import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AIMessageMarkdown from "@/components/ai/AIMessageMarkdown";

describe("AI message Markdown", () => {
  it("renders common Markdown without exposing raw HTML", () => {
    const html = renderToStaticMarkup(createElement(AIMessageMarkdown, {
      content: "## 结论\n\n**Paper 1**\n\n- 第一项\n- 第二项\n\n<script>alert(1)</script>",
    }));
    expect(html).toContain("<h3");
    expect(html).toContain("<strong>Paper 1</strong>");
    expect(html).toContain("<ul");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(1)");
  });

  it("does not turn unsafe link schemes into clickable links", () => {
    const html = renderToStaticMarkup(createElement(AIMessageMarkdown, {
      content: "[不安全链接](javascript:alert(1)) 与 [官方来源](https://example.com/specification.pdf)",
    }));
    expect(html).not.toContain("href=\"javascript:");
    expect(html).toContain("href=\"https://example.com/specification.pdf\"");
    expect(html).toContain("target=\"_blank\"");
  });
});
