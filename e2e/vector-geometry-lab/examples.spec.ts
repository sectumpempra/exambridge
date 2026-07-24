/**
 * Built-in examples (spec §6 list + §10.20 no fabricated answers): a
 * representative six of the sixteen examples, including the degenerate one
 * that must show a structured refusal instead of an answer.
 */

import { expect, test } from "@playwright/test";
import { gotoApp, selectExample } from "./helpers.js";

test.describe("representative built-in examples", () => {
  test("1. angle between two vectors — perpendicular via u·v = 0", async ({ page }) => {
    await gotoApp(page); // default example IS example 1
    const article = page.getByTestId("explanation-angle-vv");
    await expect(article).toHaveAttribute("data-status", "solved");
    await expect(article).toContainText("θ = 90°");
    await expect(article).toContainText("perpendicular");
  });

  test("4. distance from a point to a plane — d = 3 along the normal", async ({ page }) => {
    await gotoApp(page);
    await selectExample(page, "point-plane-distance");
    const article = page.getByTestId("explanation-dist-ppl");
    await expect(article).toHaveAttribute("data-status", "solved");
    await expect(article).toContainText("distance = 3");
    await expect(article).toContainText("foot of perpendicular");
  });

  test("7. skew lines — common perpendicular of length 2", async ({ page }) => {
    await gotoApp(page);
    await selectExample(page, "skew-lines");
    const article = page.getByTestId("explanation-dist-skew");
    await expect(article).toHaveAttribute("data-status", "solved");
    await expect(article).toContainText("distance = 2");
    await expect(article).toContainText("nearest point on line 1");
    await expect(article).toContainText("nearest point on line 2");
  });

  test("9. line meets plane at the unique point (2, 2, 0)", async ({ page }) => {
    await gotoApp(page);
    await selectExample(page, "line-plane-intersection");
    const article = page.getByTestId("explanation-int-lp");
    await expect(article).toHaveAttribute("data-status", "solved");
    await expect(article).toContainText("The line meets the plane at");
    await expect(article).toContainText("(2, 2, 0)");
  });

  test("13. two planes intersect in a line", async ({ page }) => {
    await gotoApp(page);
    await selectExample(page, "intersecting-planes");
    const article = page.getByTestId("explanation-int-pp");
    await expect(article).toHaveAttribute("data-status", "solved");
    await expect(article).toContainText("The planes intersect in the line");
  });

  test("16. degenerate input — structured refusal, NO fabricated answer", async ({ page }) => {
    await gotoApp(page);
    await selectExample(page, "degenerate-input");
    const article = page.getByTestId("explanation-degenerate");
    await expect(article).toBeVisible();
    await expect(article).toHaveAttribute("data-status", "refused");
    // The refusal is explained as a visible alert banner ...
    await expect(article.getByRole("alert")).toContainText(
      "no result is displayed for refused inputs",
    );
    await expect(article.getByText("refused (zero-vector)", { exact: false })).toBeVisible();
    // ... and no numeric angle is invented anywhere in the article (§10.20).
    await expect(article.getByText(/θ = [\d.]+°/)).toHaveCount(0);
    await expect(article.getByText("solved", { exact: true })).toHaveCount(0);
    // The refusal itself is explained in the text (code + reason + fix path).
    await expect(article).toContainText("zero-vector");
    await expect(article).toContainText("No answer is fabricated for refused inputs");
  });
});
