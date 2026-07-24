/**
 * Display controls (spec §5 交互): per-object visibility, opacity, camera
 * views, projection switch, camera reset and object selection details.
 */

import { expect, test } from "@playwright/test";
import { gotoApp, waitViewportReady } from "./helpers.js";

test.describe("display controls", () => {
  test("per-object visibility and opacity controls respond", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);

    const showU = page.getByLabel("Show vector u");
    await expect(showU).toBeChecked();
    await showU.uncheck();
    await expect(showU).not.toBeChecked();
    await showU.check();
    await expect(showU).toBeChecked();

    const opacity = page.getByLabel("Opacity of vector u");
    await opacity.fill("40");
    await expect(opacity).toHaveValue("40");

    const planeOpacity = page.getByLabel("Plane surface opacity");
    await planeOpacity.fill("60");
    await expect(planeOpacity).toHaveValue("60");

    // The renderer survived all overlays.
    await expect(page.getByTestId("viewport3d")).toHaveAttribute("data-status", "ready");
  });

  test("view presets, projection switch and camera reset update toolbar state", async ({
    page,
  }) => {
    await gotoApp(page);
    await waitViewportReady(page);

    const top = page.getByRole("button", { name: "Top", exact: true });
    await top.click();
    await expect(top).toHaveAttribute("aria-pressed", "true");

    const projection = page.getByRole("button", { name: "Perspective" });
    await projection.click();
    const orthographic = page.getByRole("button", { name: "Orthographic" });
    await expect(orthographic).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Side" }).click();
    await expect(page.getByRole("button", { name: "Side" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect(page.getByRole("button", { name: "Isometric" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("selecting an object shows its name, kind, equation and parameters", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByRole("button", { name: "vector u", exact: true }).click();
    const details = page.getByTestId("object-details");
    await expect(details).toBeVisible();
    await expect(details).toContainText("vector-arrow");
    // The equation comes from the core engine: u = (1, 2, 3).
    await expect(details.locator("code").first()).toBeVisible();
    await expect(details).toContainText("u = (1, 2, 3)");
    await expect(details).toContainText("component x");

    // Selecting a different object replaces the detail panel.
    await page.getByRole("button", { name: "vector v", exact: true }).click();
    await expect(details).toContainText("v = (-2, 1, 0)");

    // Clicking the same object again clears the selection.
    await page.getByRole("button", { name: "vector v", exact: true }).click();
    await expect(page.getByTestId("object-details")).toHaveCount(0);
  });
});
