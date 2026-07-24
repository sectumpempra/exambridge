/**
 * Responsive layout (spec §10.8): 320 / 360 / 390 / 768 / 1024 / desktop —
 * no whole-page horizontal overflow, verified by BOTH the gate metric
 * (documentElement.scrollWidth <= clientWidth) and a stricter per-element
 * scan that overflow-x: hidden would otherwise mask.
 */

import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, gotoApp } from "./helpers.js";

const WIDTHS = [
  { width: 320, height: 700 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 800 },
  { width: 1440, height: 900 },
] as const;

test.describe("responsive widths", () => {
  for (const { width, height } of WIDTHS) {
    test(`${String(width)}px: no horizontal overflow, key regions usable`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await gotoApp(page);
      // Exercise a richer scene too (two planes + auxiliary display geometry).
      await page.getByLabel("Built-in example").selectOption("intersecting-planes");
      await expect(page.getByTestId("explanation-int-pp")).toBeVisible();

      await expectNoHorizontalOverflow(page);

      // The header and the worked results stay reachable at every width.
      await expect(
        page.getByRole("heading", { level: 1, name: "空间向量实验室" }),
      ).toBeVisible();
      await expect(page.getByLabel("Built-in example")).toBeVisible();

      if (width <= 767) {
        // Mobile layout: the properties area collapses into a drawer.
        await expect(
          page.getByText("属性与坐标", { exact: true }),
        ).toBeVisible();
      }
      test.info().annotations.push({ type: "viewport", description: `${String(width)}x${String(height)}` });
    });
  }
});
