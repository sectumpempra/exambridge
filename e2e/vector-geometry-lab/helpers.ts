/**
 * Shared E2E helpers (Stage 8). Every helper talks to the REAL production
 * build served by the Playwright webServer — no jsdom, no module stubs.
 */

import { expect, test } from "@playwright/test";
import type { Download, Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/** The exact localStorage key required by spec §7. */
export const STORE_KEY = "exambridge:vector-geometry-lab:v1:scenes";

/** Loads the lab and waits for the default example's worked solution. */
export async function gotoApp(page: Page): Promise<void> {
  // The production static build uses HashRouter so it can be served safely
  // from GitHub Pages and the AliCloud static release directory.
  await page.goto("/#/vector-geometry-lab");
  await expect(
    page.getByRole("heading", { level: 1, name: "空间向量实验室" }),
  ).toBeVisible();
  await expect(page.getByTestId("explanation-angle-vv")).toBeVisible();
}

/** Waits until the lazily-loaded 3D renderer reports "ready". */
export async function waitViewportReady(page: Page): Promise<void> {
  await expect(page.getByTestId("viewport3d")).toHaveAttribute("data-status", "ready", {
    timeout: 30_000,
  });
}

/** Waits for the renderer preflight to settle without assuming WebGL exists. */
export async function waitViewportSettled(
  page: Page,
): Promise<"ready" | "unavailable"> {
  const viewport = page.getByTestId("viewport3d");
  await expect
    .poll(() => viewport.getAttribute("data-status"), { timeout: 30_000 })
    .toMatch(/^(ready|unavailable)$/);
  const status = await viewport.getAttribute("data-status");
  return status === "ready" ? "ready" : "unavailable";
}

/** Skips only a 3D-specific assertion when the runner has no usable WebGL. */
export async function requireViewportReady(page: Page): Promise<void> {
  const status = await waitViewportSettled(page);
  test.skip(
    status !== "ready",
    "This runner has no usable WebGL; text and deterministic results are tested separately.",
  );
  await waitViewportReady(page);
}

/** Switches the built-in example by option value (the example id). */
export async function selectExample(page: Page, exampleId: string): Promise<void> {
  await page.getByLabel("Built-in example").selectOption(exampleId);
}

export interface OverflowMetrics {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly offenders: readonly string[];
}

/**
 * Measures whole-page horizontal overflow two ways:
 *  1. the gate metric (spec §10.8): documentElement.scrollWidth <= clientWidth
 *  2. a stricter layout audit: no rendered element's right edge may extend
 *     past the viewport (catches breakage that `overflow-x: hidden` clips).
 */
export async function measureHorizontalOverflow(page: Page): Promise<OverflowMetrics> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const style = getComputedStyle(el);
      if (
        style.display === "none"
        || style.visibility === "hidden"
        || Number(style.opacity) === 0
      ) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > window.innerWidth + 1) {
        const cls =
          typeof (el as HTMLElement).className === "string"
            ? ((el as HTMLElement).className.split(" ")[0] ?? "")
            : "";
        offenders.push(
          `${el.tagName.toLowerCase()}${cls.length > 0 ? `.${cls}` : ""} right=${String(Math.round(rect.right))}`,
        );
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      offenders: offenders.slice(0, 12),
    };
  });
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await measureHorizontalOverflow(page);
  expect(
    metrics.scrollWidth,
    `documentElement.scrollWidth ${String(metrics.scrollWidth)} must be <= clientWidth ${String(metrics.clientWidth)}`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
  expect(
    metrics.offenders,
    `elements extending past the viewport: ${metrics.offenders.join("; ")}`,
  ).toEqual([]);
}

export interface SavedDownload {
  readonly suggestedFilename: string;
  readonly bytes: Buffer;
  readonly text: string;
}

/** Persists a Playwright download to a temp path and reads it back. */
export async function saveDownload(download: Download): Promise<SavedDownload> {
  const path = await download.path();
  if (path === null) {
    throw new Error(`download ${download.suggestedFilename()} produced no file`);
  }
  const bytes = await readFile(path);
  return {
    suggestedFilename: download.suggestedFilename(),
    bytes,
    text: bytes.toString("utf8"),
  };
}

export interface FocusSnapshot {
  readonly tag: string;
  readonly type: string;
  readonly label: string;
  readonly text: string;
}

/** Reads a stable descriptor of the currently focused element. */
export async function focusedSnapshot(page: Page): Promise<FocusSnapshot> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (el === null) {
      return { tag: "", type: "", label: "", text: "" };
    }
    const html = el as HTMLElement;
    return {
      tag: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type ?? "",
      label: html.getAttribute("aria-label") ?? "",
      text: (html.textContent ?? "").trim().slice(0, 60),
    };
  });
}

/**
 * Tabs until the focused element matches `predicate` (or the budget runs
 * out). Returns the matching snapshot, or null when unreachable.
 *
 * `key` is the traversal key: plain Tab/Shift+Tab in Chromium and Firefox;
 * Alt+Tab/Alt+Shift+Tab in WebKit, mirroring Safari's Option+Tab "highlight
 * each item" navigation (see tabKey).
 */
export async function tabUntil(
  page: Page,
  predicate: (snapshot: FocusSnapshot) => boolean,
  maxTabs = 80,
  key = "Tab",
): Promise<FocusSnapshot | null> {
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press(key);
    const snapshot = await focusedSnapshot(page);
    if (predicate(snapshot)) {
      return snapshot;
    }
  }
  return null;
}

/**
 * The keyboard-traversal chord for the current engine:
 * - Chromium / Firefox: Tab / Shift+Tab.
 * - WebKit: Safari's default Tab cycle only reaches text fields and lists;
 *   Option+Tab (Alt+Tab) is the built-in chord that highlights every
 *   control — the same surface real Safari keyboard users rely on.
 */
export function tabKey(browserName: string, direction: "forward" | "backward" = "forward"): string {
  if (browserName === "webkit") {
    return direction === "forward" ? "Alt+Tab" : "Alt+Shift+Tab";
  }
  return direction === "forward" ? "Tab" : "Shift+Tab";
}
