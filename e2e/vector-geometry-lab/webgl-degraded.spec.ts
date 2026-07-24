/**
 * WebGL degradation (spec §5 + §10.11) — REAL browser level: this spec only
 * runs in the `chromium-no-webgl` project, whose Chromium is launched with
 * WebGL disabled, so canvas.getContext("webgl2"/"webgl") genuinely returns
 * null. The complete text/table results must remain fully usable.
 */

import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { gotoApp, saveDownload, selectExample } from "./helpers.js";

const SCREENSHOTS_DIR = join(process.cwd(), "reports", "screenshots");

test.describe("WebGL unavailable", () => {
  test("viewport degrades and the full text results keep working", async ({ page }) => {
    await gotoApp(page);

    // The browser really has no WebGL (sanity-check the premise).
    const webglAvailable = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      return canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    });
    expect(webglAvailable).toBeNull();

    // The viewport reports the degraded state with an accessible alert.
    await expect(page.getByTestId("viewport3d")).toHaveAttribute(
      "data-status",
      "unavailable",
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("viewport3d").getByRole("alert")).toContainText(
      "三维视图暂不可用（WebGL 缺失或被阻止）。下方完整文字结果仍可正常使用。",
    );

    // The mathematics is untouched: the default example is still solved.
    const article = page.getByTestId("explanation-angle-vv");
    await expect(article).toHaveAttribute("data-status", "solved");
    await expect(article).toContainText("θ = 90°");

    // View-dependent controls disable honestly instead of pretending.
    await expect(page.getByRole("button", { name: "Front" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Download PNG" })).toBeDisabled();
    await expect(
      page.getByText(/三维视图不可用或仍在加载时，PNG 导出会停用/),
    ).toBeVisible();

    // Switching examples still recomputes through the core engine.
    await selectExample(page, "skew-lines");
    await expect(page.getByTestId("explanation-dist-skew")).toContainText("distance = 2");

    // Visual-audit capture #9 (task §B): the degraded state at desktop width.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId("viewport3d")).toHaveAttribute("data-status", "unavailable");
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, "09-webgl-degraded.png"),
      fullPage: true,
    });
  });

  test("HTML handout still exports, with the explicit text fallback inside", async ({
    page,
  }) => {
    await gotoApp(page);
    await expect(page.getByTestId("viewport3d")).toHaveAttribute(
      "data-status",
      "unavailable",
      { timeout: 30_000 },
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download HTML handout" }).click();
    const saved = await saveDownload(await downloadPromise);

    expect(saved.suggestedFilename).toBe("ex-01-handout.html");
    expect(saved.text).toContain("3D snapshot unavailable (WebGL missing or blocked");
    expect(saved.text).toContain("90°");
    await expect(page.getByRole("status").first()).toContainText(
      "HTML handout downloaded (text fallback — no 3D snapshot).",
    );
  });
});
