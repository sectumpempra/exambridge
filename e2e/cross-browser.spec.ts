import { expect, test } from "@playwright/test";

const coreRoutes = ["/courses", "/knowledge-tree", "/planner", "/papers", "/statistics", "/calculator"];

for (const route of coreRoutes) {
  test(`${route} supports core navigation in this browser`, async ({ page }) => {
    await page.goto(`/#${route}`);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText("Application error");
    await expect(page.getByRole("navigation").first()).toBeVisible();
  });
}

test("reduced motion disables non-essential animation", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/#/knowledge-tree");
  const animated = await page.locator("body").evaluate((root) => {
    const nodes = [root, ...root.querySelectorAll("*")];
    return nodes.filter((node) => {
      const style = getComputedStyle(node);
      const durations = style.animationDuration.split(",").map((value) => value.trim());
      const longestMs = Math.max(...durations.map((value) => value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000));
      return longestMs > 1 && style.animationName !== "none";
    }).length;
  });
  expect(animated).toBe(0);
  await context.close();
});
