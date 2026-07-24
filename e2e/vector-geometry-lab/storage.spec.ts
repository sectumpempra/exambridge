/**
 * Scene persistence (spec §7 + §10.13): versioned localStorage round-trip,
 * corrupted-data refusal, unknown-version refusal and per-entry quarantine —
 * all against the real browser localStorage.
 */

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoApp, selectExample, STORE_KEY } from "./helpers.js";

interface StoreEnvelopeProbe {
  storageVersion: number;
  scenes: Array<{
    id: string;
    name: string;
    exampleId: string;
    savedAt: string;
    scene: unknown;
  }>;
}

async function readEnvelope(page: Page): Promise<StoreEnvelopeProbe | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as StoreEnvelopeProbe);
  }, STORE_KEY);
}

test.describe("localStorage scene store", () => {
  test("save → reload → load round-trip preserves the edited scene", async ({ page }) => {
    await gotoApp(page);
    await selectExample(page, "point-point-distance");
    // Edit Q to (1, 6, 3) so the saved scene differs from the built-in one.
    await page.getByLabel("point Q position x").fill("1");
    const article = page.getByTestId("explanation-dist-pp");
    await expect(article).toContainText("distance = 4");

    await page.getByLabel("Name for the current scene").fill("E2E edited distance");
    await page.getByRole("button", { name: "Save current scene" }).click();
    await expect(page.getByText("E2E edited distance", { exact: true })).toBeVisible();

    // The on-disk envelope is version 1 and carries the edited literal.
    const envelope = await readEnvelope(page);
    expect(envelope).not.toBeNull();
    expect(envelope?.storageVersion).toBe(1);
    expect(envelope?.scenes).toHaveLength(1);
    expect(envelope?.scenes[0]?.name).toBe("E2E edited distance");
    expect(JSON.stringify(envelope?.scenes[0]?.scene)).toContain("\"1\"");

    // Reload: the entry persists, and loading it restores the edited result.
    await page.reload();
    await expect(page.getByText("E2E edited distance", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Load E2E edited distance", exact: true })
      .click();
    await expect(page.getByTestId("explanation-dist-pp")).toContainText("distance = 4");
  });

  test("corrupted store JSON is refused safely and left untouched on disk", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.evaluate(
      (key) => window.localStorage.setItem(key, "{{{ not json"),
      STORE_KEY,
    );
    await page.reload();

    const alert = page.getByRole("alert").first();
    await expect(alert).toContainText("not valid JSON");
    await expect(alert).toContainText("code: storage-corrupted");
    // The lab keeps working on its in-memory state.
    await expect(page.getByTestId("explanation-angle-vv")).toBeVisible();
    // The corrupted payload was NOT silently wiped.
    const raw = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORE_KEY,
    );
    expect(raw).toBe("{{{ not json");
  });

  test("unknown storageVersion is refused with a structured code", async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(
      (key) =>
        window.localStorage.setItem(
          key,
          JSON.stringify({ storageVersion: 999, scenes: [] }),
        ),
      STORE_KEY,
    );
    await page.reload();

    const alert = page.getByRole("alert").first();
    await expect(alert).toContainText("Unsupported storageVersion");
    await expect(alert).toContainText("code: unsupported-storage-version");
    await expect(page.getByTestId("explanation-angle-vv")).toBeVisible();
  });

  test("individually broken entries are quarantined, valid ones still load", async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByLabel("Name for the current scene").fill("E2E good entry");
    await page.getByRole("button", { name: "Save current scene" }).click();
    await expect(page.getByText("E2E good entry", { exact: true })).toBeVisible();

    // Inject one structurally broken entry next to the valid one.
    await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      if (raw === null) throw new Error("store missing");
      const envelope = JSON.parse(raw) as StoreEnvelopeProbe;
      envelope.scenes.push({
        id: "broken-entry",
        name: "broken",
        exampleId: "angle-between-vectors",
        savedAt: "2026-07-24T00:00:00.000Z",
        scene: { schemaVersion: "1.0.0", sceneId: 42 },
      });
      window.localStorage.setItem(key, JSON.stringify(envelope));
    }, STORE_KEY);
    await page.reload();

    await expect(
      page.getByText(
        "1 stored entry was skipped because their scene data failed validation.",
      ),
    ).toBeVisible();
    await expect(page.getByText("E2E good entry", { exact: true })).toBeVisible();
    // No store error: the envelope itself was valid.
    await expect(page.getByText("code: storage-corrupted")).toHaveCount(0);
  });
});
