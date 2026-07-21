import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/Header";
import AIAssistantPage from "@/pages/AIAssistantPage";
import { CourseContextProvider } from "@/course-context/CourseContextProvider";
import { isAIAssistantEnabled } from "@/domain-v2/shared/feature-flags";

function render(element: React.ReactNode) {
  return renderToStaticMarkup(createElement(
    MemoryRouter,
    { initialEntries: ["/ai-assistant"] },
    createElement(CourseContextProvider, null, element),
  ));
}

describe("AI assistant internal-preview UI", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the top navigation entry hidden unless explicitly enabled", () => {
    expect(isAIAssistantEnabled({ DEV: false, VITE_AI_ASSISTANT_PUBLIC: "false" })).toBe(false);
    expect(isAIAssistantEnabled({ DEV: false, VITE_AI_ASSISTANT_PUBLIC: "true" })).toBe(true);
    vi.stubEnv("VITE_AI_ASSISTANT_PUBLIC", "true");
    const html = render(createElement(Header));
    expect(html).toContain("AI 问答");
    expect(html).toContain("/ai-assistant");
  });

  it("renders the complete assistant surface and evidence boundary when enabled", () => {
    vi.stubEnv("VITE_AI_ASSISTANT_PUBLIC", "true");
    const html = render(createElement(AIAssistantPage));
    expect(html).toContain("先核对资料，再解释答案");
    expect(html).toContain("仅根据 ExamBridge 已核验资料回答");
    expect(html).toContain("会发送给 DeepSeek 生成回答");
    expect(html).toContain("不会发送官方 PDF、API 密钥或个人账号资料");
    expect(html).toContain("输入问题；Shift + Enter 换行");
    expect(html).toContain("对话仅保存在当前浏览器标签页");
  });
});
