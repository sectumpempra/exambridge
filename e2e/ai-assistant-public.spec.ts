import { expect, test } from "@playwright/test";

const enabled = process.env.AI_PUBLIC_E2E === "true";

async function waitForPwaControl(page: import("@playwright/test").Page) {
  await expect.poll(async () => {
    try { return await page.evaluate(() => Boolean(navigator.serviceWorker?.controller)); }
    catch { return false; }
  }, { timeout: 8_000 }).toBe(true);
  await page.waitForTimeout(500);
  await page.waitForLoadState("domcontentloaded");
}

test.describe("public AI assistant release surface", () => {
  test.skip(!enabled, "Runs only against an explicitly AI-enabled production build.");

  test("shows the disclosure and completes a cited streamed answer", async ({ page }) => {
    const resolvedContext = {
      qualificationIds: ["qual:caie:a-level:9709"],
      qualificationCodes: ["CAIE-9709"],
      paperIds: ["CAIE-9709-Paper-5"],
      labels: ["CAIE 9709 A-Level Mathematics"],
    };
    const source = {
      sourceId: "S1",
      title: "Cambridge International AS & A Level Mathematics 9709",
      url: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-mathematics-9709/",
      dataVersion: "2026-2027",
    };
    const requestId = "0f68f250-fbf8-4745-a830-18fca8b5cc4c";
    const answer = "## 结论\n\n**9709 的各张 Paper** 均允许使用符合规定的计算器 [S1]。\n\n- 考生须遵守具体型号规定。";
    const events = [
      { type: "meta", requestId, resolvedContext },
      { type: "delta", text: answer },
      { type: "citations", citations: [source] },
      { type: "suggestions", suggestions: ["说明各张 Paper 的区别"] },
      { type: "done", answer, requestId, resolvedContext },
    ];
    let receivedRequest: { pageContext?: { selectedPaperIds?: string[] } } | undefined;
    await page.route("**/api/ai/chat", async (route) => {
      receivedRequest = route.request().postDataJSON() as typeof receivedRequest;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        headers: { "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });
    });

    await page.goto("/#/ai-assistant");
    await waitForPwaControl(page);
    await expect(page.getByRole("heading", { level: 1, name: "全站考试事实查询" })).toBeVisible();
    await expect(page.getByText(/非 AQA 问题.*发送给 DeepSeek/)).toBeVisible();
    await expect(page.getByText(/不会发送官方 PDF、API 密钥或个人账号资料/)).toBeVisible();
    const courseSwitcher = page.getByRole("button", { name: /选择课程/ });
    await expect(courseSwitcher).toBeVisible();
    await courseSwitcher.click();
    await expect(page.getByRole("dialog", { name: "更换 AI 助手课程" })).toBeVisible();
    await page.getByPlaceholder("搜索考试局、课程名称或代码").fill("9709");
    await page.getByRole("option", { name: /CAIE 9709.*Mathematics/i }).click();
    await expect(page.getByRole("button", { name: /9709.*Mathematics.*更换课程/i })).toBeVisible();
    const paperSelector = page.getByLabel("限定 AI 回答使用的 Paper");
    await expect(paperSelector).toBeVisible();
    await paperSelector.selectOption("CAIE-9709-Paper-5");
    const input = page.getByPlaceholder("输入问题；Shift + Enter 换行");
    await input.fill("S1 考哪些知识点？");
    await page.getByRole("button", { name: "发送" }).click();
    expect(receivedRequest?.pageContext?.selectedPaperIds).toEqual(["CAIE-9709-Paper-5"]);
    await expect(page.getByRole("heading", { name: "结论" })).toBeVisible();
    await expect(page.locator("strong").filter({ hasText: "9709 的各张 Paper" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "考生须遵守具体型号规定" })).toBeVisible();
    await expect(page.getByText("**9709 的各张 Paper**", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /\[S1\].*9709/ })).toHaveAttribute("href", source.url);
    await expect(page.getByRole("button", { name: "清空对话" })).toBeEnabled();
  });

  test("keeps the course switcher usable without page overflow at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/ai-assistant");
    await waitForPwaControl(page);
    await page.getByRole("button", { name: /选择课程/ }).click();
    await expect(page.getByRole("dialog", { name: "更换 AI 助手课程" })).toBeVisible();
    await expect(page.getByPlaceholder("搜索考试局、课程名称或代码")).toBeVisible();
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(1);
    expect(overflow.document).toBeLessThanOrEqual(1);
  });

  test("supports no-course questions with selectable ambiguity choices and an expandable composer", async ({ page }) => {
    const requestId = "5edbda0c-bfb0-4d98-8b62-9a82ff12f211";
    const emptyContext = { awardQualificationIds: [], qualificationVersionIds: [], qualificationIds: [], qualificationCodes: [], paperIds: [], labels: [] };
    const selectedContext = {
      awardQualificationIds: ["award:pearson:4bi1", "award:caie:9700"],
      qualificationVersionIds: [],
      qualificationIds: ["qual:edexcel:igcse:4bi1", "qual:caie:a-level:9700"],
      qualificationCodes: ["Pearson-4BI1", "CAIE-9700"],
      paperIds: [],
      labels: ["Edexcel IGCSE Biology", "CAIE A-Level Biology"],
    };
    const clarification = {
      prompt: "你的表述对应多个资格。请在每组中选择准确的资格，我会沿用原问题继续回答。",
      submitLabel: "确认并继续",
      groups: [
        {
          groupId: "pearson-biology",
          label: "Pearson Edexcel · Biology",
          required: true,
          options: [
            { optionId: "qual:edexcel:igcse:4bi1", label: "Edexcel IGCSE Biology", description: "4BI1 · 仅部分资料可用", qualificationCode: "4BI1", availability: "partial", scope: { awardQualificationIds: [], qualificationVersionIds: [], catalogQualificationIds: ["qual:edexcel:igcse:4bi1"], source: "manual-selection" } },
            { optionId: "qual:edexcel:a-level:ybi11", label: "Edexcel International A-Level Biology", description: "YBI11 · 仅部分资料可用", qualificationCode: "YBI11", availability: "partial", scope: { awardQualificationIds: [], qualificationVersionIds: [], catalogQualificationIds: ["qual:edexcel:a-level:ybi11"], source: "manual-selection" } },
          ],
        },
        {
          groupId: "caie-biology",
          label: "Cambridge / CAIE · Biology",
          required: true,
          options: [
            { optionId: "qual:caie:igcse:0610", label: "CAIE IGCSE Biology", description: "0610 · 仅部分资料可用", qualificationCode: "0610", availability: "partial", scope: { awardQualificationIds: [], qualificationVersionIds: [], catalogQualificationIds: ["qual:caie:igcse:0610"], source: "manual-selection" } },
            { optionId: "qual:caie:a-level:9700", label: "CAIE A-Level Biology", description: "9700 · 仅部分资料可用", qualificationCode: "9700", availability: "partial", scope: { awardQualificationIds: [], qualificationVersionIds: [], catalogQualificationIds: ["qual:caie:a-level:9700"], source: "manual-selection" } },
          ],
        },
      ],
    };
    const requests: Array<{ scopes?: Array<{ catalogQualificationIds?: string[] }> }> = [];
    await page.route("**/api/ai/chat", async (route) => {
      requests.push(route.request().postDataJSON() as typeof requests[number]);
      const first = requests.length === 1;
      const answer = first ? clarification.prompt : "## 已确认范围\n\n已按你选择的 **4BI1** 与 **9700** 继续原问题。";
      const events = first
        ? [
          { type: "meta", requestId, resolvedContext: emptyContext },
          { type: "delta", text: answer },
          { type: "clarification", clarification },
          { type: "done", answer, requestId, resolvedContext: emptyContext },
        ]
        : [
          { type: "meta", requestId, resolvedContext: selectedContext },
          { type: "delta", text: answer },
          { type: "done", answer, requestId, resolvedContext: selectedContext },
        ];
      await route.fulfill({ status: 200, contentType: "text/event-stream; charset=utf-8", body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join("") });
    });

    await page.goto("/#/ai-assistant");
    await waitForPwaControl(page);
    await expect(page.getByText("未限定范围", { exact: true })).toBeVisible();
    await expect(page.getByText("团队视图", { exact: true })).toHaveCount(0);
    const input = page.getByPlaceholder("输入问题；Shift + Enter 换行");
    const initialHeight = (await input.boundingBox())?.height ?? 0;
    expect(initialHeight).toBeGreaterThanOrEqual(140);
    await page.getByRole("button", { name: "放大输入框" }).click();
    await expect(page.getByRole("button", { name: "缩小输入框" })).toBeVisible();
    expect((await input.boundingBox())?.height ?? 0).toBeGreaterThan(initialHeight);
    await input.fill("Edexcel 生物和 CAIE 生物，哪个更容易取得高分？");
    await page.getByRole("button", { name: "发送" }).click();
    await page.getByRole("radio", { name: /Edexcel IGCSE Biology/ }).check();
    await page.getByRole("radio", { name: /CAIE A-Level Biology/ }).check();
    await page.getByRole("button", { name: "确认并继续" }).click();
    await expect(page.getByRole("heading", { name: "已确认范围" })).toBeVisible();
    expect(requests[1].scopes?.flatMap(scope => scope.catalogQualificationIds ?? [])).toEqual([
      "qual:edexcel:igcse:4bi1",
      "qual:caie:a-level:9700",
    ]);
  });
});
