import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/", "/about", "/courses", "/exam-overview", "/results", "/tools", "/alevel", "/alevel/caie", "/alevel/edexcel", "/alevel/aqa", "/alevel/ocr", "/alevel/wjec",
  "/gcse", "/gcse/edexcel", "/gcse/caie", "/gcse/aqa", "/gcse/ocr", "/fsmq/ocr", "/calculator", "/planner", "/personality",
  "/statistics", "/graph", "/papers", "/knowledge-tree", "/ai-assistant",
];

async function openAwardCourse(page: Page, query: string, _courseName: RegExp) {
  void _courseName;
  await page.goto("/#/courses");
  await waitForPwaControl(page);
  await page.getByPlaceholder("搜索科目名称或代码").fill(query);
  await page.getByRole("button", { name: new RegExp(`资格代码\\s*${query}`) }).first().click();
  await page.getByRole("link", { name: /等级预测.*可用.*已核验/ }).click();
}

async function openExamOverviewCourse(page: Page, query: string, courseName: RegExp) {
  await page.goto("/#/courses");
  await waitForPwaControl(page);
  await page.getByPlaceholder("搜索科目名称或代码").fill(query);
  await page.getByRole("button", { name: courseName }).click();
  await page.getByRole("link", { name: /考试概览.*可用.*已核验/ }).click();
}

async function fillAqaEstimate(page: Page) {
  await openAwardCourse(page, "7357", /AQA.*7357 · Mathematics/i);
  await page.getByLabel("考季").selectOption("2026-june");
  await page.getByLabel("7357/1 分数").fill("75");
  await page.getByLabel("7357/2 分数").fill("75");
  await page.getByLabel("7357/3 分数").fill("75");
}

async function waitForPwaControl(page: Page) {
  await expect.poll(async () => {
    try { return await page.evaluate(() => Boolean(navigator.serviceWorker?.controller)); }
    catch { return false; }
  }, { timeout: 8_000 }).toBe(true);
  // `clients.claim()` makes the controller visible before the app's
  // controllerchange handler finishes its one-time reload. Wait through that
  // navigation so subsequent actions cannot target the retiring document.
  await page.waitForTimeout(500);
  await page.waitForLoadState("domcontentloaded");
}

for (const route of routes) {
  test(`${route} renders one h1 without serious accessibility violations`, async ({ page }) => {
    await page.goto(`/#${route}`);
    await waitForPwaControl(page);
    await page.addStyleTag({
      content: "*,*::before,*::after{animation:none!important;transition:none!important;opacity:1!important}",
    });
    await page.waitForTimeout(100);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText("Application error");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
    expect(blocking.flatMap((violation) => violation.nodes.slice(0, 10).map((node) => {
      const data = node.any[0]?.data as Record<string, unknown> | undefined;
      return `${violation.id} ${node.target.join(" ")} ${data ? JSON.stringify(data) : ""}`;
    }))).toEqual([]);
  });
}

test("unknown routes show a useful 404", async ({ page }) => {
  await page.goto("/#/route-that-does-not-exist");
  await waitForPwaControl(page);
  await expect(page.getByRole("heading", { level: 1, name: "这个页面不存在" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回首页" })).toBeVisible();
});

test("production build follows the explicit AI release flag", async ({ page }) => {
  const aiPublic = process.env.AI_PUBLIC_E2E === "true";
  await page.goto("/#/");
  await waitForPwaControl(page);
  if ((page.viewportSize()?.width ?? 1_024) < 768) {
    await page.getByRole("button", { name: "打开菜单" }).click();
  }
  await expect(page.getByRole("link", { name: "AI 问答" })).toHaveCount(aiPublic ? 1 : 0);
  await page.goto("/#/ai-assistant");
  if (aiPublic) {
    await expect(page.getByPlaceholder("输入问题；Shift + Enter 换行")).toBeVisible();
    await expect(page.getByText("AI 助手正在内部验收", { exact: true })).toHaveCount(0);
  } else {
    await expect(page.getByText("AI 助手正在内部验收", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("输入问题；Shift + Enter 换行")).toHaveCount(0);
  }
});

test("UK maths exam overviews preserve option routes and official conflicts", async ({ page }) => {
  await openExamOverviewCourse(page, "9FM0", /Edexcel UK.*9FM0.*Further Mathematics/i);
  await expect(page.getByRole("heading", { level: 1, name: /A Level Further Mathematics/i })).toBeVisible();
  await expect(page.getByText("10 条有效路线", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Further Pure Mathematics 1 + 2" })).toBeVisible();

  await openExamOverviewCourse(page, "9MA0", /Edexcel UK.*9MA0.*Mathematics/i);
  await expect(page.getByRole("heading", { name: "Pearson Large Data Set · Weather data" })).toBeVisible();
  await expect(page.getByText(/Paper 3 Statistics 会假设考生已熟悉/)).toBeVisible();

  await openExamOverviewCourse(page, "H245", /OCR.*H245.*Further Mathematics A/i);
  await expect(page.getByText("6 条有效路线", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Discrete Mathematics + Additional Pure" })).toBeVisible();

  await openExamOverviewCourse(page, "8365", /AQA.*8365.*Further Mathematics/i);
  await expect(page.getByText(/官方来源冲突/).first()).toBeVisible();
  await expect(page.getByText(/人工复核/).first()).toBeVisible();
});

test("business overviews expose successor, formula and IAL route details", async ({ page }) => {
  await openExamOverviewCourse(page, "0450", /CAIE.*0450.*Business Studies/i);
  await expect(page.getByText(/0450 的继任课程/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /0264 Business Syllabus 2027/ })).toBeVisible();

  await openExamOverviewCourse(page, "4BS1", /Edexcel.*4BS1.*Business/i);
  await expect(page.getByText(/两张试卷内的公式/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Paper 1 & 2 财务公式/ })).toBeVisible();

  await openExamOverviewCourse(page, "YAC11", /Edexcel.*YAC11.*Accounting/i);
  await expect(page.getByRole("tab", { name: "IAL" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("WAC11/01", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("WAC12/01", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "IAS" }).click();
  await expect(page.getByText("1 个单元：Unit 1", { exact: false })).toBeVisible();
});

test("course context survives feature navigation and a share URL", async ({ page, context }) => {
  await page.goto("/#/courses");
  await waitForPwaControl(page);
  await page.getByPlaceholder("搜索科目名称或代码").fill("WMA");
  await page.getByRole("button", { name: /Edexcel.*WMA.*International A-Level Mathematics/i }).click();
  await expect(page).toHaveURL(/course=qual%3Aedexcel%3Aa-level%3Awma/);
  await expect(page.getByText(/Edexcel · WMA/).first()).toBeVisible();

  await page.getByRole("link", { name: /Paper 查询 可用/ }).click();
  await expect(page).toHaveURL(/#\/papers\?.*course=/);
  await expect(page.getByText(/EDX-WMA-P1|Pure Mathematics 1/).first()).toBeVisible();

  if ((page.viewportSize()?.width ?? 1024) < 768) {
    await page.getByRole("button", { name: "打开菜单" }).click();
    await page.getByRole("link", { name: "考纲对比", exact: true }).filter({ visible: true }).click();
  } else {
    await page.getByRole("button", { name: "试卷与考纲" }).hover();
    await page.getByRole("menuitem", { name: /^考纲对比/ }).click();
  }
  await expect(page).toHaveURL(/#\/knowledge-tree\?.*course=/);
  await expect(page.getByText(/Edexcel · WMA/).first()).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#\/papers\?.*course=/);
  await expect(page.getByText(/Edexcel · WMA/).first()).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/#\/knowledge-tree\?.*course=/);

  const sharedUrl = page.url();
  const secondPage = await context.newPage();
  await secondPage.goto(sharedUrl);
  await waitForPwaControl(secondPage);
  await expect(secondPage.getByText(/Edexcel · WMA/).first()).toBeVisible();
  await secondPage.close();
});

test("verified past-paper links and October IAL series appear in the course overview", async ({ page }) => {
  await openExamOverviewCourse(page, "WMA", /Edexcel.*WMA.*International A-Level Mathematics/i);
  await expect(page.getByRole("heading", { name: "历年真题与材料" })).toBeVisible();
  await page.getByLabel("筛选真题年份").selectOption("2024");
  await page.getByLabel("筛选真题考季").selectOption("october");
  await expect(page.getByLabel("2024 年逐考季可用状态")).toContainText("October");
  const firstPaper = page.getByRole("link", { name: "下载试卷" }).first();
  await expect(firstPaper).toBeVisible();
  await expect(firstPaper).toHaveAttribute("href", /^https:\/\/qualifications\.pearson\.com\/content\/dam\/pdf\//);
  await expect(page.getByRole("link", { name: "评分标准" }).first()).toBeVisible();

  await page.getByLabel("筛选真题年份").selectOption("2025");
  await page.getByLabel("筛选真题考季").selectOption("june");
  const restrictedSet = page.locator("article").filter({ hasText: "2025 June · 组件 WDM11" });
  await expect(restrictedSet).toContainText("需官方账号");
  await expect(restrictedSet).toContainText("官方账号材料");
  await expect(restrictedSet).not.toContainText("官方公开");
  await expect(restrictedSet).not.toContainText("本站授权文件");
});

test("WJEC course exposes statistics but not boundary or calculator actions", async ({ page }) => {
  await page.goto("/#/courses");
  await waitForPwaControl(page);
  await page.getByPlaceholder("搜索科目名称或代码").fill("WJEC");
  const candidate = page.locator("button").filter({ hasText: "WJEC/Eduqas" }).first();
  await expect(candidate).toBeVisible();
  await candidate.click();
  const current = page.locator("section").filter({ hasText: "当前课程" }).first();
  await expect(current.getByRole("link", { name: /成绩统计 可用/ })).toBeVisible();
  await expect(current.getByText("当前仅提供成绩统计", { exact: false }).first()).toBeVisible();
  await expect(current.getByRole("link", { name: /等级预测/ })).toHaveCount(0);
});

test("AQA 7357 calculates an official overall grade", async ({ page }) => {
  await openAwardCourse(page, "7357", /AQA.*7357 · Mathematics/i);
  await page.getByLabel("考季").selectOption("2025-june");
  await page.getByLabel("7357/1 分数").fill("90");
  await page.getByLabel("7357/2 分数").fill("85");
  await page.getByLabel("7357/3 分数").fill("85");
  await page.getByRole("button", { name: "计算等级" }).click();
  await expect(page.getByText("官方整体边界 · 已核验", { exact: true })).toBeVisible();
  await expect(page.getByText("260 / 300", { exact: true })).toBeVisible();
  await expect(page.getByText("A*", { exact: true }).first()).toBeVisible();
});

test("estimated calculation requires consent, shares, exports and prints", async ({ page, context }) => {
  await fillAqaEstimate(page);
  await expect(page.getByRole("button", { name: "计算等级" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "我理解这是非官方预估" }).check();
  await page.getByRole("button", { name: "计算等级" }).click();
  await expect(page.getByText("非官方预估等级", { exact: true })).toBeVisible();
  await expect(page.getByText(/不是考试局正式成绩/)).toBeVisible();

  const shared = await page.getByLabel("分享链接").inputValue();
  expect(shared).toContain("award=");
  expect(shared).not.toContain("thresholds");
  const restored = await context.newPage();
  await restored.goto(shared);
  await waitForPwaControl(restored);
  await expect(restored.getByText("非官方预估等级", { exact: true })).toBeVisible();
  await expect(restored.getByText("225 / 300", { exact: true })).toBeVisible();
  await expect(restored.getByText(/置信度：/)).toBeVisible();
  await expect(restored.getByText(/样本考季：/)).toBeVisible();

  const [csv] = await Promise.all([
    restored.waitForEvent("download"),
    restored.getByRole("button", { name: "下载 CSV" }).click(),
  ]);
  expect(csv.suggestedFilename()).toContain("非官方预估");
  const csvPath = await csv.path();
  expect(csvPath).toBeTruthy();
  expect(await readFile(csvPath!, "utf8")).toContain("非官方预估等级");

  const [excel] = await Promise.all([
    restored.waitForEvent("download"),
    restored.getByRole("button", { name: "下载 Excel" }).click(),
  ]);
  expect(excel.suggestedFilename()).toContain("非官方预估");

  await restored.evaluate(() => Object.defineProperty(window, "print", {
    configurable: true,
    value: () => { document.body.dataset.printCalled = "yes"; },
  }));
  await restored.getByRole("button", { name: "打印结果" }).click();
  await expect(restored.locator("body")).toHaveAttribute("data-print-called", "yes");
  await restored.close();
});

test("OCR H240 uses the official Overall threshold", async ({ page }) => {
  await openAwardCourse(page, "H240", /OCR.*H240 · Mathematics A/i);
  await page.getByLabel("考季").selectOption("2025-june");
  await page.getByLabel("H240/01 分数").fill("82");
  await page.getByLabel("H240/02 分数").fill("80");
  await page.getByLabel("H240/03 分数").fill("80");
  await page.getByRole("button", { name: "计算等级" }).click();
  await expect(page.getByRole("heading", { name: "OCR H240 Overall" })).toBeVisible();
  await expect(page.getByText("A*", { exact: true }).first()).toBeVisible();
});

test("CAIE 9709 uses the exact AX option and variants", async ({ page }) => {
  await openAwardCourse(page, "9709", /CAIE.*9709 · Mathematics/i);
  await page.getByLabel("路线").selectOption("award:caie:9709:2023-2025:al:same-series:AX");
  await page.getByLabel("考季").selectOption("2025-june");
  await expect(page.getByLabel("Option code")).toHaveValue("AX");
  for (const [component, mark] of [["11", "70"], ["31", "70"], ["41", "50"], ["51", "34"]] as const) {
    await page.getByLabel(`9709/${component} 分数`).fill(mark);
  }
  await page.getByRole("button", { name: "计算等级" }).click();
  await expect(page.getByText("224 / 250", { exact: true })).toBeVisible();
  await expect(page.getByText("9709/11, 9709/31, 9709/41, 9709/51", { exact: true })).toBeVisible();
  await expect(page.getByText("A*", { exact: true }).first()).toBeVisible();
});

test("an old estimated link upgrades to an official result", async ({ page }) => {
  const state = {
    version: 1,
    displayedSource: "estimated",
    input: {
      routeId: "award:aqa:7357:linear",
      series: "2025-june",
      estimateConsent: true,
      scores: [
        { componentCode: "7357/1", series: "2025-june", rawScore: 90, inputKind: "raw" },
        { componentCode: "7357/2", series: "2025-june", rawScore: 85, inputKind: "raw" },
        { componentCode: "7357/3", series: "2025-june", rawScore: 85, inputKind: "raw" },
      ],
    },
  };
  const award = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  await page.goto(`/#/calculator?award=${award}`);
  await waitForPwaControl(page);
  await expect(page.getByText("官方边界现已发布", { exact: true })).toBeVisible();
  await expect(page.getByText("官方整体边界 · 已核验", { exact: true })).toBeVisible();
  await expect(page.getByText("260 / 300", { exact: true })).toBeVisible();
});

test("award URL state follows history, refresh, mobile keyboard and Axe", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await fillAqaEstimate(page);
  await page.getByRole("checkbox", { name: "我理解这是非官方预估" }).check();
  await page.getByRole("button", { name: "计算等级" }).click();
  await expect(page).toHaveURL(/award=/);
  await page.reload();
  await expect(page.getByText("非官方预估等级", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/award=/);
  await expect(page.getByLabel("考季")).toHaveValue("2025-june");
  await page.goForward();
  await expect(page.getByLabel("考季")).toHaveValue("2026-june");
  await expect(page.getByText("225 / 300", { exact: true })).toBeVisible();
  await page.getByLabel("考季").focus();
  await page.keyboard.press("Tab");
  expect(["INPUT", "BUTTON"]).toContain(await page.evaluate(() => document.activeElement?.tagName));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(item => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
});

test("course center filters by subject category and explains internal AQA codes", async ({ page }) => {
  await page.goto("/#/courses");
  await waitForPwaControl(page);
  await page.getByRole("button", { name: "数学类", exact: true }).click();
  await expect(page.getByRole("button", { name: /7357 Mathematics/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /7127 Accounting/ })).toHaveCount(0);
  await page.getByRole("button", { name: "会计类", exact: true }).click();
  await page.getByPlaceholder("搜索科目名称或代码").fill("AC");
  await expect(page.getByRole("button", { name: /AQA.*7127.*Accounting/ })).toBeVisible();
});

test("primary navigation is keyboard reachable", async ({ page }) => {
  await page.goto("/#/");
  await waitForPwaControl(page);
  await page.getByRole("link", { name: "ExamBridge" }).focus();
  await page.keyboard.press("Tab");
  expect(["A", "BUTTON"]).toContain(await page.evaluate(() => document.activeElement?.tagName));
});

test("table filters follow browser back navigation", async ({ page }) => {
  await page.goto("/#/alevel/edexcel");
  await waitForPwaControl(page);
  const year = page.getByLabel("年份");
  const value = await year.locator("option").nth(1).getAttribute("value");
  expect(value).toBeTruthy();
  await year.selectOption(value!);
  await expect(page).toHaveURL(/edexcel-al_filter_year=/);
  await page.goBack();
  await expect(year).toHaveValue("");
});

test("knowledge tree expand all changes the visible node set and restores it", async ({ page }) => {
  await page.goto("/#/knowledge-tree");
  await waitForPwaControl(page);
  const expand = page.getByRole("button", { name: "展开全部" });
  await expect(expand).toBeVisible();
  const treeButtons = page.locator('button[aria-expanded]');
  const before = await treeButtons.count();
  await expand.click();
  await expect(page.getByRole("button", { name: "收起全部" })).toBeVisible();
  expect(await treeButtons.count()).toBeGreaterThan(before);
  await page.getByRole("button", { name: "收起全部" }).click();
  await expect(page.getByRole("button", { name: "展开全部" })).toBeVisible();
  expect(await treeButtons.count()).toBe(before);
});

test("active Knowledge V5 renders audited overlap and complete exclusive statements", async ({ page }) => {
  await page.goto("/#/knowledge-tree?subjectA=CAIE-0580&subjectB=Edexcel-4MA1");
  await waitForPwaControl(page);

  await expect(page.locator("main")).toContainText("EXAMBRIDGE v5 知识树驱动");
  await expect(page.locator("main")).toContainText("1105 节点");
  await expect(page.getByRole("heading", { name: "考纲相似度概览" })).toBeVisible();
  await expect(page.getByText(/部分重合陈述：\d+/)).toBeVisible();
  await expect(page.getByLabel("Paper")).toHaveCount(2);
  await expect(page.locator("body")).not.toContainText("考纲数据完整性校验失败");

  await page.getByRole("button", { name: "独有知识点" }).click();
  await expect(page.getByRole("heading", { name: "独有、部分重合与待核验考纲原文" })).toBeVisible();
  const exclusiveSections = page.locator('section[aria-label="确定独有"]');
  await expect(exclusiveSections.first()).toBeVisible();
  await expect.poll(async () => exclusiveSections.locator("p.text-sm").evaluateAll((rows) =>
    Math.max(0, ...rows.map((row) => row.textContent?.trim().length ?? 0))
  )).toBeGreaterThan(30);
  await expect(exclusiveSections.getByText("Source Ref：", { exact: false }).first()).toBeVisible();
  await expect(exclusiveSections.getByRole("link", { name: "官方来源" }).first()).toBeVisible();
});

test("core pages do not overflow the viewport at supported widths", async ({ page }) => {
  for (const width of [320, 360, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/exam-overview", "/gcse/caie", "/papers/compare"]) {
      await page.goto(`/#${route}`);
      await waitForPwaControl(page);
      await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth)).toBe(true);
    }
  }
});

test("precache supports an offline refresh after the first visit", async ({ page, context }) => {
  await page.goto("/#/courses");
  await waitForPwaControl(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");
});

test("personality progress is versioned and can be resumed", async ({ page }) => {
  await page.goto("/#/personality/test?mode=student");
  await waitForPwaControl(page);
  await page.getByRole("button", { name: "开始诊断" }).click();
  await page.getByRole("button").filter({ hasText: /^A/ }).first().click();
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.getByRole("button", { name: /继续上次（第 2 题）/ })).toBeVisible();
  await page.getByRole("button", { name: /继续上次/ }).click();
  await expect(page.getByText("第 2 / 20 题", { exact: true })).toBeVisible();
});
