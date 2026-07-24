import { describe, expect, it } from "vitest";
import {
  defaultMatchMedia,
  defaultWebGLContextProbe,
  detectPrefersReducedMotion,
  detectWebGLSupport,
  REDUCED_MOTION_QUERY,
} from "@/features/vector-geometry-lab/three/environment";

describe("detectPrefersReducedMotion", () => {
  it("returns true when the media query matches", () => {
    expect(detectPrefersReducedMotion(() => ({ matches: true }))).toBe(true);
  });

  it("returns false when the media query does not match", () => {
    expect(detectPrefersReducedMotion(() => ({ matches: false }))).toBe(false);
  });

  it("never throws: a broken probe degrades to false", () => {
    expect(
      detectPrefersReducedMotion(() => {
        throw new Error("no media layer");
      }),
    ).toBe(false);
  });

  it("passes the exact reduced-motion query to matchMedia", () => {
    const queries: string[] = [];
    detectPrefersReducedMotion((query) => {
      queries.push(query);
      return { matches: true };
    });
    expect(queries).toEqual([REDUCED_MOTION_QUERY]);
  });
});

describe("defaultMatchMedia", () => {
  it("falls back to no-preference when window.matchMedia is absent", () => {
    // jsdom does not implement window.matchMedia.
    expect(defaultMatchMedia(REDUCED_MOTION_QUERY).matches).toBe(false);
  });

  it("delegates to window.matchMedia when present", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === REDUCED_MOTION_QUERY,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      expect(defaultMatchMedia(REDUCED_MOTION_QUERY).matches).toBe(true);
      expect(defaultMatchMedia("(min-width: 100px)").matches).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("detectWebGLSupport", () => {
  it("reports support when the probe yields a context", () => {
    const result = detectWebGLSupport(() => ({ fake: "context" }));
    expect(result.supported).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("reports no support when the probe yields null", () => {
    const result = detectWebGLSupport(() => null);
    expect(result.supported).toBe(false);
    expect(result.reason).toBe("no-webgl-context");
  });

  it("reports no support when the probe throws", () => {
    const result = detectWebGLSupport(() => {
      throw new Error("driver blocked");
    });
    expect(result.supported).toBe(false);
    expect(result.reason).toContain("webgl-probe-threw");
    expect(result.reason).toContain("driver blocked");
  });
});

describe("defaultWebGLContextProbe", () => {
  it("returns null under jsdom (no real GL), which detection maps to unsupported", () => {
    const context = defaultWebGLContextProbe();
    expect(context).toBeNull();
    expect(detectWebGLSupport(() => context).supported).toBe(false);
  });
});
