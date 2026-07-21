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
});
