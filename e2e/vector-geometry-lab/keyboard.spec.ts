/**
 * Keyboard operability (spec §10.9): every primary control is reachable by
 * keyboard and activatable by Enter/Space/typing — example switching, object
 * visibility, view controls, coordinate editing, saving and exporting.
 *
 * Engine notes (recorded in the accessibility audit):
 * - WebKit mirrors Safari: the plain-Tab cycle only reaches text fields, so
 *   traversal uses Option+Tab (Alt+Tab), Safari's built-in "highlight every
 *   control" chord.
 * - Headless Firefox does not wrap focus past the last page element, so one
 *   leg of the journey is verified with Shift+Tab (backward traversal).
 */

import { expect, test } from "@playwright/test";
import { gotoApp, tabKey, tabUntil, waitViewportReady } from "./helpers.js";

test.describe("keyboard operation", () => {
  test("main controls are reachable by keyboard", async ({ page, browserName }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    await page.locator("body").click({ position: { x: 1, y: 1 } });

    const key = tabKey(browserName);
    const wanted: Array<{ name: string; found: boolean }> = [
      { name: "example select", found: false },
      { name: "object show checkbox", found: false },
      { name: "toolbar view button", found: false },
      { name: "coordinate input", found: false },
      { name: "save-name input", found: false },
      { name: "export button", found: false },
    ];
    const mark = (name: string): void => {
      const entry = wanted.find((w) => w.name === name);
      if (entry !== undefined) entry.found = true;
    };

    await page.keyboard.press(key);
    for (let i = 0; i < 120; i += 1) {
      const snapshot = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (el === null) return { tag: "", label: "", text: "" };
        return {
          tag: el.tagName.toLowerCase(),
          label: el.getAttribute("aria-label") ?? "",
          text: (el.textContent ?? "").trim().slice(0, 40),
        };
      });
      if (snapshot.tag === "select" && snapshot.label === "Built-in example") mark("example select");
      if (snapshot.tag === "input" && snapshot.label.startsWith("Show ")) mark("object show checkbox");
      if (snapshot.tag === "button" && ["Front", "Top", "Side", "Isometric"].includes(snapshot.label)) mark("toolbar view button");
      if (snapshot.tag === "input" && snapshot.label === "vector u components x") mark("coordinate input");
      if (snapshot.tag === "input" && snapshot.label === "Name for the current scene") mark("save-name input");
      if (snapshot.tag === "button" && snapshot.label === "Download scene JSON") mark("export button");
      if (wanted.every((w) => w.found)) break;
      await page.keyboard.press(key);
    }
    for (const entry of wanted) {
      expect(entry.found, `${entry.name} must be reachable by keyboard`).toBe(true);
    }
  });

  test("primary actions complete from the keyboard alone", async ({ page, browserName }) => {
    await gotoApp(page);
    await waitViewportReady(page);
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    const forward = tabKey(browserName);
    const backward = tabKey(browserName, "backward");

    // 1. Switch the built-in example with the keyboard: native-select
    //    typeahead — pressing "2" jumps to the option whose label starts
    //    with "2" ("2. Distance between two points") in every engine.
    const onSelect = await tabUntil(
      page,
      (s) => s.tag === "select" && s.label === "Built-in example",
      80,
      forward,
    );
    expect(onSelect, "example select reachable").not.toBeNull();
    await page.keyboard.press("2");
    await expect(page.getByLabel("Built-in example")).toHaveValue("point-point-distance");
    await expect(page.getByTestId("explanation-dist-pp")).toContainText("distance = 5");

    // 2. Toggle an object's visibility with Space.
    const onCheckbox = await tabUntil(
      page,
      (s) => s.tag === "input" && s.label === "Show point P",
      80,
      forward,
    );
    expect(onCheckbox, "visibility checkbox reachable").not.toBeNull();
    await page.keyboard.press("Space");
    await expect(page.getByLabel("Show point P")).not.toBeChecked();
    await page.keyboard.press("Space");
    await expect(page.getByLabel("Show point P")).toBeChecked();

    // 3. Change a camera view with Enter.
    const onTop = await tabUntil(
      page,
      (s) => s.tag === "button" && s.label === "Top",
      80,
      forward,
    );
    expect(onTop, "view button reachable").not.toBeNull();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Top", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // 4. Edit a coordinate by typing: Q x 4 → 1 gives |PQ| = 4.
    const onCoord = await tabUntil(
      page,
      (s) => s.tag === "input" && s.label === "point Q position x",
      80,
      forward,
    );
    expect(onCoord, "coordinate input reachable").not.toBeNull();
    await page.keyboard.press("Meta+A");
    await page.keyboard.type("1");
    await expect(page.getByTestId("explanation-dist-pp")).toContainText("distance = 4");

    // 5. Save the scene: Shift+Tab BACK to the name field (also proves
    //    backward traversal), type the name, submit with Enter.
    const onSaveName = await tabUntil(
      page,
      (s) => s.tag === "input" && s.label === "Name for the current scene",
      80,
      backward,
    );
    expect(onSaveName, "save-name input reachable").not.toBeNull();
    await page.keyboard.type("keyboard scene");
    await page.keyboard.press("Enter"); // Enter inside the input submits the save
    await expect(page.getByText("keyboard scene", { exact: true })).toBeVisible();
  });
});
