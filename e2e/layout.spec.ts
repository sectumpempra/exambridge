import { expect, test } from "@playwright/test";

const responsiveRoutes = ["/courses", "/exam-overview", "/knowledge-tree", "/planner", "/papers", "/results", "/calculator"];

for (const route of responsiveRoutes) {
  test(`${route} has no page-level horizontal overflow`, async ({ page }) => {
    await page.goto(`/#${route}`);
    await expect(page.locator("h1")).toHaveCount(1);
    const dimensions = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(dimensions.body, `body overflow on ${route}`).toBeLessThanOrEqual(1);
    expect(dimensions.document, `document overflow on ${route}`).toBeLessThanOrEqual(1);
  });
}
