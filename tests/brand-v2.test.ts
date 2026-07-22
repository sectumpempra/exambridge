import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const SVG_ASSETS = [
  "public/brand/exambridge-logo-horizontal.svg",
  "public/brand/exambridge-mark.svg",
  "public/favicon.svg",
  "public/icons/pwa-icon.svg",
  "public/icons/pwa-icon-maskable.svg",
];

const PNG_ASSETS: Array<[string, number, number]> = [
  ["public/favicon-16x16.png", 16, 16],
  ["public/favicon-32x32.png", 32, 32],
  ["public/apple-touch-icon.png", 180, 180],
  ["public/icons/icon-192x192.png", 192, 192],
  ["public/icons/icon-512x512.png", 512, 512],
  ["public/icons/maskable-icon-512x512.png", 512, 512],
];

describe("ExamBridge brand V2 release assets", () => {
  it.each(SVG_ASSETS)("keeps %s flat and path-based", (path) => {
    const svg = readFileSync(path, "utf8");
    expect(svg).toMatch(/^<svg\b/);
    expect(svg).toContain("<path");
    expect(svg).not.toMatch(/<(?:text|image|filter|linearGradient|radialGradient|mask)\b/);
  });

  it.each(PNG_ASSETS)("keeps %s at its declared dimensions", (path, width, height) => {
    const png = readFileSync(path);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(width);
    expect(png.readUInt32BE(20)).toBe(height);
  });

  it("wires favicons, touch icon and PWA variants to the release shell", () => {
    const html = readFileSync("index.html", "utf8");
    const manifest = readFileSync("public/manifest.webmanifest", "utf8");
    expect(html).toContain('/favicon.svg');
    expect(html).toContain('/favicon-32x32.png');
    expect(html).toContain('/favicon-16x16.png');
    expect(html).toContain('/apple-touch-icon.png');
    expect(manifest).toContain('/icons/pwa-icon.svg');
    expect(manifest).toContain('/icons/pwa-icon-maskable.svg');
    expect(manifest).toContain('/icons/maskable-icon-512x512.png');
  });

  it("keeps the generated precache manifest compatible with multiline source assets", () => {
    const builder = readFileSync("scripts/build-sw-precache.mjs", "utf8");
    expect(builder).toContain("const corePattern");
    expect(builder).toContain("Could not replace the service worker CORE precache manifest");
  });
});
