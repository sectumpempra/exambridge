/**
 * Visual-audit captures (stage-8 task §B). Runs only in the deterministic
 * `screenshots` project (Chromium, 1440×900, reduced motion → no camera
 * damping). Every capture is paired with a functional assertion so a broken
 * render cannot silently produce a "pretty" screenshot. Capture 09 lives in
 * webgl-degraded.spec.ts (it needs the no-WebGL browser).
 */

import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { gotoApp, selectExample, waitViewportReady } from "./helpers.js";

const DIR = join(process.cwd(), "reports", "screenshots");
const SETTLE_MS = 500;

// Deterministic captures: reduced motion switches off camera damping and
// auto-rotation before the app boots.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function shoot(page: import("@playwright/test").Page, name: string): Promise<void> {
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: join(DIR, name), fullPage: true });
}

test.describe("screenshot set", () => {
  test("01 blank editor — pristine initial state", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    // Nothing selected, nothing saved: the editor as a teacher first sees it.
    await expect(page.getByTestId("object-details")).toHaveCount(0);
    await expect(page.getByText("尚未保存场景。")).toBeVisible();
    await shoot(page, "01-blank-editor.png");
  });

  test("02 angle between two vectors", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    const article = page.getByTestId("explanation-angle-vv");
    await expect(article).toContainText("θ = 90°");
    // Show the vector's equation in Properties and open the formula section.
    await page.getByRole("button", { name: "vector u", exact: true }).click();
    await expect(page.getByTestId("object-details")).toBeVisible();
    await article.getByText("5. 使用公式 / Formulas used").click();
    await shoot(page, "02-angle-between-vectors.png");
  });

  test("03 distance from a point to a plane", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    await selectExample(page, "point-plane-distance");
    await expect(page.getByTestId("explanation-dist-ppl")).toContainText("distance = 3");
    await shoot(page, "03-point-plane-distance.png");
  });

  test("04 shortest distance between skew lines", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    await selectExample(page, "skew-lines");
    await expect(page.getByTestId("explanation-dist-skew")).toContainText("distance = 2");
    await shoot(page, "04-skew-lines-shortest-distance.png");
  });

  test("05 line–plane intersection point", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    await selectExample(page, "line-plane-intersection");
    await expect(page.getByTestId("explanation-int-lp")).toContainText("(2, 2, 0)");
    await shoot(page, "05-line-plane-intersection.png");
  });

  test("06 intersection line of two planes", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    await selectExample(page, "intersecting-planes");
    await expect(page.getByTestId("explanation-int-pp")).toContainText("The planes intersect in the line");
    await shoot(page, "06-plane-plane-intersection-line.png");
  });

  test("07 angle between planes (perpendicular, n1·n2 = 0)", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    await selectExample(page, "perpendicular-planes");
    const article = page.getByTestId("explanation-rel-pp");
    await expect(article).toContainText("The planes are perpendicular.");
    await expect(article).toContainText("n1·n2");
    await shoot(page, "07-plane-angle.png");
  });

  test("08 degenerate input — refusal, no fabricated answer", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    await selectExample(page, "degenerate-input");
    const article = page.getByTestId("explanation-degenerate");
    await expect(article).toHaveAttribute("data-status", "refused");
    await expect(article.getByRole("alert")).toContainText(
      "no result is displayed for refused inputs",
    );
    await shoot(page, "08-degenerate-input.png");
  });

  test("10 mobile 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoApp(page);
    await waitViewportReady(page);
    await expect(page.getByText("属性与坐标", { exact: true })).toBeVisible();
    await shoot(page, "10-mobile-390px.png");
  });

  test("11 tablet 768px", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoApp(page);
    await waitViewportReady(page);
    await shoot(page, "11-tablet-768px.png");
  });

  test("12 desktop widescreen", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await gotoApp(page);
    await waitViewportReady(page);
    // A populated workspace: object selected, properties panel filled.
    await page.getByRole("button", { name: "vector v", exact: true }).click();
    await expect(page.getByTestId("object-details")).toBeVisible();
    await shoot(page, "12-desktop-wide.png");
  });
});
