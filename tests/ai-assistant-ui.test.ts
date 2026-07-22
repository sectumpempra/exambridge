import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/Header";
import AIAssistantPage from "@/pages/AIAssistantPage";
import AcademicAnalysisPage from "@/pages/AcademicAnalysisPage";
import AIAnswerCard from "@/components/ai/AIAnswerCard";
import { safeStoredSession } from "@/components/ai/AIChatPanel";
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
    expect(html).toContain("/brand/exambridge-logo-horizontal.svg");
    expect(html).toContain('alt="ExamBridge"');
  });

  it("renders the complete assistant surface and evidence boundary when enabled", () => {
    vi.stubEnv("VITE_AI_ASSISTANT_PUBLIC", "true");
    const html = render(createElement(AIAssistantPage));
    expect(html).toContain("全站考试事实查询");
    expect(html).toContain("数据、模型与隐私说明");
    expect(html).toContain("回答仅使用 ExamBridge 当前已核验的 active 数据");
    expect(html).toContain("非 AQA 问题只向 DeepSeek 发送");
    expect(html).toContain("不会发送官方 PDF、API 密钥或个人账号资料");
    expect(html).toContain("输入问题；Shift + Enter 换行");
    expect(html).toContain("对话只保存在当前浏览器标签页");
    expect(html).toContain("选择课程");
    expect(html).toContain("检索范围");
    expect(html).toContain("未限定范围");
    expect(html).toContain("全屏查看回答");
    expect(html).not.toContain("放大输入框");
    expect(html).not.toContain("resize-y");
    expect(html).toContain("min-h-[104px]");
    expect(html).not.toContain("lg:grid-cols-[210px_minmax(0,1fr)]");
    expect(html).not.toContain("团队视图");
    expect(html).not.toContain("内部数据不足时允许检索官方网页");
    expect(html).not.toContain("允许回答非官方预测分数线");
  });

  it("offers three export formats only for a completed assistant answer", () => {
    const complete = renderToStaticMarkup(createElement(AIAnswerCard, {
      messageId: "a1",
      content: "## 结论\n\n已核验回答。",
      state: "complete",
      contextLabels: ["CAIE 9709"],
    }));
    expect(complete).toContain("将此回答导出为 PNG");
    expect(complete).toContain("复制此回答的富文本");
    expect(complete).toContain("下载此回答的 HTML");

    const interrupted = renderToStaticMarkup(createElement(AIAnswerCard, {
      messageId: "a2",
      content: "未完成片段",
      state: "interrupted",
      contextLabels: [],
    }));
    expect(interrupted).toContain("连接在回答完成前中断");
    expect(interrupted).not.toContain("将此回答导出为 PNG");
  });

  it("migrates a V1 conversation only inside the current session payload", () => {
    const migrated = safeStoredSession(JSON.stringify({
      version: 1,
      messages: [{ id: "m1", role: "user", content: "9709是什么？" }],
    }));
    expect(migrated).toMatchObject({ version: 2, scopes: [] });
    expect(migrated).not.toHaveProperty("roleView");
    expect(migrated?.messages).toHaveLength(1);
  });

  it("presents qualification facts while deferred analytics stay hidden", () => {
    const html = render(createElement(AcademicAnalysisPage));
    expect(html).toContain("资格事实、合分规则与成绩证据");
    expect(html).not.toContain("方向性难度</button>");
    expect(html).not.toContain("非官方分数线预测");
  });
});
