import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("brand V2 browser and PWA icons", () => {
  it("uses cache-busted V2 favicon references", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain('/favicon.svg?v=2');
    expect(html).toContain('/favicon-32x32.png?v=2');
    expect(html).toContain('/apple-touch-icon.png?v=2');
  });

  it("uses the open-book bridge mark in the favicon and PWA manifest", () => {
    const favicon = readFileSync("public/favicon.svg", "utf8");
    const mark = readFileSync("public/brand/exambridge-mark.svg", "utf8");
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as { icons: Array<{ src: string }> };
    expect(favicon).toContain("M0 1C34 -1 68 10 99 32");
    expect(mark).toContain("M0 1C34 -1 68 10 99 32");
    expect(manifest.icons.every((icon) => icon.src.endsWith("?v=2"))).toBe(true);
  });
});
