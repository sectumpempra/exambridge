/**
 * Playwright E2E：规格书第十四节 16 项全覆盖。
 * 每项独立通过 ExamBridge 主站的懒加载 Mechanics Lab 路由验证。
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(here, "..", "test-results", "mechanics-lab-downloads");
mkdirSync(tmpDir, { recursive: true });

async function openApp(page: Page): Promise<void> {
  await page.goto("/#/mechanics-lab");
  await expect(page.getByRole("heading", { name: "Mechanics Lab V1" })).toBeVisible();
  await expect(page.getByText("35 个基准场景已验证")).toBeVisible();
}

/** 选择示例场景 */
async function loadExample(page: Page, label: string): Promise<void> {
  await page.getByLabel(/示例场景/).selectOption({ label });
  await page.waitForTimeout(300);
}

/** 在画布指定相对位置点击 */
async function clickCanvas(page: Page, xRatio = 0.5, yRatio = 0.5): Promise<void> {
  const box = await page.locator(".mech-canvas").boundingBox();
  if (box === null) throw new Error("canvas not found");
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
}

const canvasText = (page: Page, text: string | RegExp) => page.locator(".mech-canvas").getByText(text).first();

test("01 添加物体", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "一键重置" }).click();
  await page.getByRole("button", { name: "水平面", exact: true }).click();
  await clickCanvas(page, 0.5, 0.7);
  await page.getByRole("button", { name: "物体", exact: true }).click();
  await clickCanvas(page, 0.5, 0.55);
  await expect(canvasText(page, "2kg")).toBeVisible();
  await expect(page.locator('g[data-entity-id^="m-obj-"]').first()).toBeVisible();
});

test("02 添加斜面", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "一键重置" }).click();
  await page.getByRole("button", { name: "斜面", exact: true }).click();
  await clickCanvas(page);
  await expect(canvasText(page, /斜面 30°/)).toBeVisible();
});

test("03 修改质量", async ({ page }) => {
  await openApp(page);
  await loadExample(page, "光滑水平面（静力平衡）");
  await page.locator('g[data-entity-id="m-obj-1"]').click();
  await page.getByLabel(/质量（kg）/).fill("5");
  await expect(canvasText(page, "5kg")).toBeVisible();
  await expect(page.getByText(/N\(m-obj-1\) = 50/).first()).toBeVisible();
});

test("04 修改角度", async ({ page }) => {
  await openApp(page);
  await loadExample(page, "粗糙斜面（下滑）");
  // 点击平面线远离物体的端部（物体覆盖处不可点，用原始 mouse 事件）
  const lineBox = await page.locator('g[data-entity-id="surf-1"] line').first().boundingBox();
  if (lineBox === null) throw new Error("surface line not found");
  await page.mouse.click(lineBox.x + 6, lineBox.y + lineBox.height - 6);
  await expect(page.locator(".mech-canvas-status")).toContainText("surf-1");
  await page.getByLabel(/平面角度/).fill("45");
  await expect(canvasText(page, /斜面 45°/)).toBeVisible();
});

test("05 添加固定滑轮", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "一键重置" }).click();
  await page.getByRole("button", { name: "固定滑轮", exact: true }).click();
  await clickCanvas(page, 0.5, 0.4);
  await expect(canvasText(page, "定滑轮")).toBeVisible();
});

test("06 连接绳", async ({ page }) => {
  await openApp(page);
  await loadExample(page, "固定滑轮 + 悬挂（桌面物体）");
  await expect(page.locator('g[data-entity-id="rope-1"]')).toBeVisible();
  // 用绳工具在 m-obj-2 与空白锚点之间再建一条绳
  await page.getByRole("button", { name: "绳", exact: true }).click();
  await page.locator('g[data-entity-id="m-obj-2"]').click();
  await clickCanvas(page, 0.62, 0.2); // 空白处放锚点
  await page.getByRole("button", { name: /完成连接/ }).click();
  await expect(page.locator('g[data-entity-id^="rope-"]')).toHaveCount(2);
});

test("07 运行求解并显示结果", async ({ page }) => {
  await openApp(page);
  await loadExample(page, "固定滑轮 + 悬挂（桌面物体）");
  await expect(page.locator(".status-badge")).toHaveText("已求解");
  await expect(page.getByText(/T\(rope-1\) = 13.333333/).first()).toBeVisible();
});

test("08 切换自由体图", async ({ page }) => {
  await openApp(page);
  await loadExample(page, "固定滑轮 + 悬挂（桌面物体）");
  await expect(page.locator(".fbd-card")).toHaveCount(2);
  await page.getByLabel("单个物体").check();
  await expect(page.locator(".fbd-card")).toHaveCount(1);
  await page.getByLabel("显示分量").check();
  await page.getByLabel("局部坐标轴").check();
  await page.getByLabel("全部物体").check();
  await expect(page.locator(".fbd-card")).toHaveCount(2);
});

test("09 播放和暂停动画", async ({ page }) => {
  await openApp(page);
  await loadExample(page, "固定滑轮 + 悬挂（桌面物体）");
  const timeText = page.locator(".time-slider span");
  await expect(timeText).toContainText("0.00");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  const t = await timeText.textContent();
  expect(t).not.toContain("0.00 /");
  await expect(page.locator(".motion-table td").nth(1)).not.toHaveText("0.000 m");
});

test("10 保存与载入", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => window.localStorage.clear());
  await loadExample(page, "光滑水平面（静力平衡）");
  await page.getByRole("button", { name: "保存场景" }).click();
  await expect(page.locator(".message-bar")).toContainText("已保存场景");
  await loadExample(page, "粗糙斜面（下滑）");
  await page.getByRole("button", { name: "读取场景" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "载入" }).first().click();
  await expect(page.locator(".message-bar")).toContainText("已载入场景");
  // Escape 关闭对话框
  await page.getByRole("button", { name: "读取场景" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("11 SVG 导出", async ({ page }) => {
  await openApp(page);
  await loadExample(page, "固定滑轮 + 悬挂（桌面物体）");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 SVG" }).click();
  const download = await downloadPromise;
  const path = join(tmpDir, "scene.svg");
  await download.saveAs(path);
  const content = readFileSync(path, "utf8");
  expect(content).toContain("<svg");
  expect(content).toContain('"sceneId":"scene-gc-12"');
  expect(content).toContain("T(rope-1)=");
});

test("12 PNG 导出", async ({ page }) => {
  await openApp(page);
  await loadExample(page, "光滑水平面（静力平衡）");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 PNG" }).click();
  const download = await downloadPromise;
  const path = join(tmpDir, "scene.png");
  await download.saveAs(path);
  const buf = readFileSync(path);
  expect(buf.length).toBeGreaterThan(1000);
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
});

test("13 非法场景导入被拒绝", async ({ page }) => {
  await openApp(page);
  const badPath = join(tmpDir, "bad.json");
  writeFileSync(badPath, JSON.stringify({ schemaVersion: "2.0.0", note: "未来版本" }));
  await page.getByRole("button", { name: "导入 JSON" }).click();
  await page.locator('input[type="file"]').setInputFiles(badPath);
  await expect(page.locator(".message-bar")).toContainText("导入失败");
  // 损坏 JSON
  writeFileSync(badPath, '{"schemaVersion": "1.0.0", "objects": [');
  await page.locator('input[type="file"]').setInputFiles(badPath);
  await expect(page.locator(".message-bar")).toContainText("损坏");
});

test("14 移动端 390px 无横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await loadExample(page, "固定滑轮 + 悬挂（桌面物体）");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator(".drawer-handle")).toBeVisible();
  await page.locator(".drawer-handle").click();
  await expect(page.locator(".drawer").getByLabel(/重力加速度/)).toBeVisible();
});

test("15 键盘操作", async ({ page }) => {
  await openApp(page);
  await loadExample(page, "光滑水平面（静力平衡）");
  const obj = page.getByRole("button", { name: /物体 m-obj-1/ });
  await obj.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".mech-canvas-status")).toContainText("m-obj-1");
  // 方向键移动
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  // Delete 删除
  await page.keyboard.press("Delete");
  await expect(page.locator(".mech-canvas-status")).toContainText("已选：无");
  // Ctrl+Z 撤销
  await page.keyboard.press("Control+z");
  await expect(canvasText(page, "2kg")).toBeVisible();
  // Escape 取消选择
  await page.keyboard.press("Escape");
});

test("16 prefers-reduced-motion 静态降级", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/#/mechanics-lab");
  await loadExample(page, "固定滑轮 + 悬挂（桌面物体）");
  await expect(page.getByText(/已开启减少动画，显示静态数值/)).toBeVisible();
  await expect(page.getByRole("button", { name: "播放" })).not.toBeVisible();
  await expect(page.locator(".motion-table")).toContainText("v(t)=");
  await context.close();
});
