/**
 * JSON transfer (spec §7 + §10.14 partial): scene-JSON download round-trips
 * through the real file import; broken JSON and unknown schemaVersion are
 * refused with structured messages; the lab state is never poisoned.
 */

import { expect, test } from "@playwright/test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gotoApp, saveDownload, selectExample } from "./helpers.js";

test.describe("JSON export / import", () => {
  test("downloaded scene JSON re-imports and restores the analysis", async ({ page }) => {
    await gotoApp(page);
    await selectExample(page, "skew-lines");
    await expect(page.getByTestId("explanation-dist-skew")).toContainText("distance = 2");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download scene JSON" }).click();
    const saved = await saveDownload(await downloadPromise);
    expect(saved.suggestedFilename).toBe("ex-07.json");

    // Round-trip through the real file input.
    const dir = await mkdtemp(join(tmpdir(), "vgl-import-"));
    const filePath = join(dir, saved.suggestedFilename);
    await writeFile(filePath, saved.bytes);

    // Move to another example first so the import visibly changes state.
    await selectExample(page, "angle-between-vectors");
    await page.getByLabel("Import scene JSON file").setInputFiles(filePath);
    await expect(page.getByRole("status").first()).toContainText(
      `Scene imported from ${saved.suggestedFilename}.`,
    );
    await expect(page.getByTestId("explanation-dist-skew")).toContainText("distance = 2");
  });

  test("broken JSON import is refused and the current scene survives", async ({ page }) => {
    await gotoApp(page);
    const dir = await mkdtemp(join(tmpdir(), "vgl-import-"));
    const filePath = join(dir, "broken.json");
    await writeFile(filePath, "{ not json at all ");
    await page.getByLabel("Import scene JSON file").setInputFiles(filePath);

    const alert = page.getByRole("alert").filter({ hasText: "not valid JSON" });
    await expect(alert).toContainText("not valid JSON");
    await expect(alert).toContainText("Nothing was imported");
    await expect(page.getByTestId("explanation-angle-vv")).toBeVisible();
  });

  test("unknown schemaVersion import is refused safely", async ({ page }) => {
    await gotoApp(page);
    const dir = await mkdtemp(join(tmpdir(), "vgl-import-"));
    const filePath = join(dir, "future.json");
    await writeFile(
      filePath,
      JSON.stringify({ schemaVersion: "99.0.0", sceneId: "future", points: [] }),
    );
    await page.getByLabel("Import scene JSON file").setInputFiles(filePath);

    const alert = page
      .getByRole("alert")
      .filter({ hasText: 'Unsupported schemaVersion "99.0.0"' });
    await expect(alert).toContainText('Unsupported schemaVersion "99.0.0"');
    await expect(page.getByTestId("explanation-angle-vv")).toBeVisible();
  });
});
