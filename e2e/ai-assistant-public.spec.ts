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
      paperIds: [],
      labels: ["CAIE 9709 A-Level Mathematics"],
    };
    const source = {
      sourceId: "S1",
      title: "Cambridge International AS & A Level Mathematics 9709",
      url: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-as-and-a-level-mathematics-9709/",
      dataVersion: "2026-2027",
    };
    const requestId = "0f68f250-fbf8-4745-a830-18fca8b5cc4c";
    const events = [
      { type: "meta", requestId, resolvedContext },
      { type: "delta", text: "9709 的各张 Paper 均允许使用符合规定的计算器 [S1]。" },
      { type: "citations", citations: [source] },
      { type: "suggestions", suggestions: ["说明各张 Paper 的区别"] },
      { type: "done", answer: "9709 的各张 Paper 均允许使用符合规定的计算器 [S1]。", requestId, resolvedContext },
    ];
    await page.route("**/api/ai/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        headers: { "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });
    });

    await page.goto("/#/ai-assistant");
    await waitForPwaControl(page);
    await expect(page.getByRole("heading", { level: 1, name: "先核对资料，再解释答案" })).toBeVisible();
    await expect(page.getByText(/会发送给 DeepSeek 生成回答/)).toBeVisible();
    await expect(page.getByText(/不会发送官方 PDF、API 密钥或个人账号资料/)).toBeVisible();
    const input = page.getByPlaceholder("输入问题；Shift + Enter 换行");
    await input.fill("9709 的各张 Paper 可以使用计算器吗？");
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText("9709 的各张 Paper 均允许使用符合规定的计算器 [S1]。")).toBeVisible();
    await expect(page.getByRole("link", { name: /\[S1\].*9709/ })).toHaveAttribute("href", source.url);
    await expect(page.getByRole("button", { name: "清空对话" })).toBeEnabled();
  });
});
