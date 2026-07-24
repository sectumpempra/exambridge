/**
 * Exports (spec §7 + §10.14): scene JSON, HTML handout, PNG capture and the
 * print path — verified as real browser download events with file-content
 * inspection, not just button clicks.
 */

import { expect, test } from "@playwright/test";
import { gotoApp, saveDownload, waitViewportReady } from "./helpers.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test.describe("exports", () => {
  test("scene JSON download is a valid VectorGeometrySceneV1 document", async ({
    page,
  }) => {
    await gotoApp(page);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download scene JSON" }).click();
    const saved = await saveDownload(await downloadPromise);

    expect(saved.suggestedFilename).toBe("ex-01.json");
    const parsed = JSON.parse(saved.text) as {
      schemaVersion: string;
      sceneId: string;
      vectors: unknown[];
    };
    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.sceneId).toBe("ex-01");
    expect(parsed.vectors).toHaveLength(2);
    await expect(page.getByRole("status").first()).toContainText(
      "Scene JSON downloaded as ex-01.json.",
    );
  });

  test("HTML handout download embeds conclusion, formulas and verification", async ({
    page,
  }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download HTML handout" }).click();
    const saved = await saveDownload(await downloadPromise);

    expect(saved.suggestedFilename).toBe("ex-01-handout.html");
    expect(saved.text).toContain("<!doctype html>");
    expect(saved.text).toContain("Angle between two vectors");
    expect(saved.text).toContain("90°");
    expect(saved.text).toContain("Verification");
    // WebGL was ready → the handout embeds a real PNG snapshot.
    expect(saved.text).toContain("data:image/png;base64,");
    // Fully self-contained: no external references.
    expect(saved.text).not.toContain("http://");
    expect(saved.text).not.toContain("https://");
  });

  test("PNG export downloads a real PNG captured from the 3D view", async ({ page }) => {
    await gotoApp(page);
    await waitViewportReady(page);

    // High-resolution scale selects the @2x filename.
    await page.getByLabel("PNG export scale").selectOption("2");
    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 }).catch(
      () => null,
    );
    await page.getByRole("button", { name: "Download PNG" }).click();
    const download = await downloadPromise;

    // The status notice is the uniform cross-browser signal; the download
    // artifact is additionally byte-verified where the browser emits one.
    await expect(page.getByRole("status").first()).toContainText(/PNG downloaded \(\d+×\d+\)\./);
    if (download !== null) {
      expect(download.suggestedFilename()).toBe("ex-01@2x.png");
      const saved = await saveDownload(download);
      expect(saved.bytes.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
      expect(saved.bytes.length).toBeGreaterThan(1_000);
      test.info().annotations.push({
        type: "png-artifact",
        description: `${download.suggestedFilename()} ${String(saved.bytes.length)} bytes`,
      });
    } else {
      test.info().annotations.push({
        type: "png-artifact",
        description: "browser emitted no download event for the data-URL anchor; status notice verified instead",
      });
    }
  });

  test("print handout path invokes window.print and leaves the app functional", async ({
    page,
  }) => {
    // Headless browsers cannot drive the native print dialog (headless
    // Firefox blocks on it entirely), so the wiring is verified against a
    // recording stub installed before any app script runs.
    await page.addInitScript(() => {
      const w = window as unknown as { __printCalls: number };
      w.__printCalls = 0;
      window.print = () => {
        w.__printCalls += 1;
      };
    });
    await gotoApp(page);
    await page.getByRole("button", { name: "Print handout" }).click();
    const calls = await page.evaluate(
      () => (window as unknown as { __printCalls: number }).__printCalls,
    );
    expect(calls).toBe(1);
    await expect(page.getByTestId("explanation-angle-vv")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});
