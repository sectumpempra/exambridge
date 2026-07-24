/**
 * Coordinate editing (spec §6 坐标数值输入): typing exact literals re-runs
 * the analysis; invalid literals surface a structured error while the last
 * valid scene and its results stay on screen (never a crash, never a fake).
 */

import { expect, test } from "@playwright/test";
import { gotoApp, selectExample } from "./helpers.js";

test.describe("coordinate input", () => {
  test("editing a coordinate updates the worked result deterministically", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectExample(page, "point-point-distance");
    const article = page.getByTestId("explanation-dist-pp");
    // P(1,2,3), Q(4,6,3): |PQ| = 5.
    await expect(article).toContainText("distance = 5");

    // Move Q to (1, 6, 3): |PQ| = 4 exactly.
    const xInput = page.getByLabel("point Q position x");
    await xInput.click();
    await xInput.fill("1");
    await expect(article).toContainText("distance = 4");
    await expect(article).not.toContainText("distance = 5");

    // Fraction literals are accepted too: Q = (3/2, 6, 3) → |PQ| = (1/2)√65.
    await xInput.fill("3/2");
    await expect(article).toContainText("(1/2)√65");
  });

  test("invalid literal keeps the last valid scene and flags the slot", async ({ page }) => {
    await gotoApp(page);
    await selectExample(page, "point-point-distance");
    const article = page.getByTestId("explanation-dist-pp");
    await expect(article).toContainText("distance = 5");

    const xInput = page.getByLabel("point Q position x");
    await xInput.fill("not-a-number");

    // Structured, honest error: what is wrong + that the last valid results
    // remain on screen.
    const alert = page.getByRole("alert").filter({ hasText: "Invalid coordinates" });
    await expect(alert).toContainText("Invalid coordinates");
    await expect(alert).toContainText("showing the last valid scene and results");
    // The offending slot is flagged (aria-invalid + styling hook).
    await expect(xInput).toHaveAttribute("aria-invalid", "true");
    // The previous correct results are still there — nothing fabricated,
    // nothing crashed.
    await expect(article).toContainText("distance = 5");

    // Repairing the literal clears the error and recomputes.
    await xInput.fill("0");
    await expect(alert).toHaveCount(0);
    // Q = (0, 6, 3) → |PQ| = √17.
    await expect(article).toContainText("√17");
  });
});
