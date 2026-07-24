/**
 * Reduced motion (spec §5 + §10.12): with prefers-reduced-motion emulated
 * the lab stays fully functional and the motion switch reflects the system
 * preference.
 */

import { expect, test } from "@playwright/test";
import { gotoApp, selectExample, waitViewportSettled } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  // Media emulation (stage-8 task §A): the app must stay fully usable.
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("prefers-reduced-motion", () => {
  test("app computes and renders normally; motion switch honours the system preference", async ({
    page,
  }) => {
    await gotoApp(page);

    // The toolbar switch reflects the emulated system preference ...
    const toggle = page.getByRole("button", { name: "Reduce motion" });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    // ... CSS transitions/animations are killed by the media query ...
    const transitionDuration = await toggle.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    );
    expect(transitionDuration).toBe("0s");

    // ... and the lab still computes, renders and switches examples.
    const viewportStatus = await waitViewportSettled(page);
    await selectExample(page, "skew-lines");
    await expect(page.getByTestId("explanation-dist-skew")).toContainText("distance = 2");

    // The user can still override the switch explicitly.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("viewport3d")).toHaveAttribute(
      "data-status",
      viewportStatus,
    );
  });
});
