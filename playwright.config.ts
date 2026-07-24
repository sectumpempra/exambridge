import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.EXAMBRIDGE_E2E_PORT ?? 3000);
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: e2eBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", testMatch: /routes\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-390", testMatch: /routes\.spec\.ts/, use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "mechanics-lab-chromium", testMatch: /mechanics-lab\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "vector-geometry-chromium",
      testMatch: /vector-geometry-lab\/.*\.spec\.ts/,
      testIgnore: [/webgl-degraded\.spec\.ts/, /screenshots\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "vector-geometry-firefox",
      testMatch: /vector-geometry-lab\/.*\.spec\.ts/,
      testIgnore: [/webgl-degraded\.spec\.ts/, /screenshots\.spec\.ts/],
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "vector-geometry-webkit",
      testMatch: /vector-geometry-lab\/.*\.spec\.ts/,
      testIgnore: [/webgl-degraded\.spec\.ts/, /screenshots\.spec\.ts/],
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "vector-geometry-no-webgl",
      testMatch: /vector-geometry-lab\/webgl-degraded\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"],
        },
      },
    },
    {
      name: "vector-geometry-screenshots",
      testMatch: /vector-geometry-lab\/screenshots\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    { name: "firefox-core", testMatch: /cross-browser\.spec\.ts/, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-core", testMatch: /cross-browser\.spec\.ts/, use: { ...devices["Desktop Safari"] } },
    { name: "ai-public-chromium", testMatch: /ai-assistant-public\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    ...[320, 360, 390, 768, 1024].map((width) => ({
      name: `layout-${width}`,
      testMatch: /layout\.spec\.ts/,
      use: { browserName: "chromium" as const, viewport: { width, height: width < 700 ? 844 : 900 } },
    })),
  ],
  webServer: {
    command: `PORT=${e2ePort} node scripts/serve-static.mjs`,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
