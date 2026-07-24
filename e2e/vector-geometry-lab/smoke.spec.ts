/**
 * Smoke (spec §10.7 core E2E + §10.10 text equivalence): the app loads,
 * computes through the real core engine, renders the full ten-section worked
 * solution as DOM text, and the lazily-loaded 3D viewport comes up.
 *
 * Assertion style: result values live in collapsible <details> sections
 * (sections 5–10 are collapsed by default), so they are asserted as DOM text
 * containment — exactly what assistive technology and expanding users read.
 * Genuinely visible regions (open sections, banners, badges) are asserted
 * with visibility checks.
 */

import { expect, test } from "@playwright/test";
import { gotoApp, waitViewportReady } from "./helpers.js";

test.describe("application smoke", () => {
  test("loads with the default example solved and the full text solution", async ({
    page,
  }) => {
    await gotoApp(page);

    // 16 built-in examples are all offered.
    const options = page.getByLabel("Built-in example").locator("option");
    await expect(options).toHaveCount(16);

    // The default example (u·v = 0) is solved with the exact conclusion.
    const article = page.getByTestId("explanation-angle-vv");
    await expect(article).toHaveAttribute("data-status", "solved");
    await expect(article).toContainText("θ = 90°");
    // The relation verdict sits in an always-open section — truly visible.
    await expect(page.getByTestId("section-relation-verdict")).toContainText(
      "perpendicular",
    );

    // Text equivalence (spec §10.10): the complete worked solution exists as
    // DOM text — all ten fixed sections are present ...
    await expect(article.locator("[data-testid^='section-']")).toHaveCount(10);
    for (const sectionId of [
      "known-inputs",
      "vector-equations",
      "directions-normals",
      "relation-verdict",
      "formulas",
      "substitution",
      "solving",
      "geometric-conclusion",
      "verification",
      "special-conditions",
    ]) {
      await expect(page.getByTestId(`section-${sectionId}`)).toBeAttached();
    }
    // ... and the verification section carries actual verification items
    // (back-substitution / residual records), not an empty placeholder.
    await expect(
      page.getByTestId("section-verification").locator("li").first(),
    ).toBeAttached();
  });

  test("lazy 3D viewport becomes ready with axes, legend and enabled toolbar", async ({
    page,
  }) => {
    await gotoApp(page);
    await waitViewportReady(page);

    const canvas = page.getByLabel(/3D vector geometry view/);
    await expect(canvas).toBeVisible();
    expect(await canvas.evaluate((el) => (el as HTMLCanvasElement).width)).toBeGreaterThan(0);

    // Legend = the non-color channel identifying objects (spec §5 图例).
    await expect(page.getByTestId("legend").locator("li").first()).toBeAttached();

    // Toolbar controls unlock once the viewport is ready.
    await expect(page.getByRole("button", { name: "Front" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Reset camera" })).toBeEnabled();
  });

  test("worked solution shows exact values, approximations and tolerance policy", async ({
    page,
  }) => {
    await gotoApp(page);
    // Example 3: distance from P(1,2,3) to the x-axis is exactly √13.
    await page.getByLabel("Built-in example").selectOption("point-line-distance");
    const article = page.getByTestId("explanation-dist-pl");
    await expect(article).toHaveAttribute("data-status", "solved");
    // Exact radical AND decimal approximation AND abstract units are shown.
    await expect(article).toContainText("√13");
    await expect(article).toContainText("≈");
    await expect(article).toContainText("abstract length units");
    await expect(article).toContainText("foot of perpendicular");
  });
});
