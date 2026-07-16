import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", testMatch: /routes\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-390", testMatch: /routes\.spec\.ts/, use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "firefox-core", testMatch: /cross-browser\.spec\.ts/, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-core", testMatch: /cross-browser\.spec\.ts/, use: { ...devices["Desktop Safari"] } },
    ...[320, 360, 390, 768, 1024].map((width) => ({
      name: `layout-${width}`,
      testMatch: /layout\.spec\.ts/,
      use: { browserName: "chromium" as const, viewport: { width, height: width < 700 ? 844 : 900 } },
    })),
  ],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
