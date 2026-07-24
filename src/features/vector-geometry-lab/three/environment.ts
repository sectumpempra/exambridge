/**
 * Environment detection, every probe injectable so jsdom tests can stub
 * them without a real browser:
 * - prefers-reduced-motion via an injectable matchMedia
 * - WebGL availability via an injectable context probe
 * Detection failures degrade safely (never throw).
 */

/** Minimal structural slice of MediaQueryList used by this package. */
export interface MediaQueryLike {
  readonly matches: boolean;
}

export type MatchMediaFn = (query: string) => MediaQueryLike;

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Default probe: window.matchMedia when present, otherwise "no preference". */
export function defaultMatchMedia(query: string): MediaQueryLike {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    return window.matchMedia(query);
  }
  return { matches: false };
}

/**
 * Reads prefers-reduced-motion (spec §5). A broken/absent media layer is
 * treated as "no preference" — animation stays available but optional.
 */
export function detectPrefersReducedMotion(
  matchMediaFn: MatchMediaFn = defaultMatchMedia,
): boolean {
  try {
    return matchMediaFn(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

/** Anything truthy-looking returned by canvas.getContext counts as support. */
export type WebGLContextProbe = () => unknown;

export interface WebGLSupportResult {
  readonly supported: boolean;
  readonly reason?: string;
}

/**
 * Default probe: create a throwaway canvas and ask for webgl2 then webgl.
 * Returns null when no DOM or no context is available.
 */
export function defaultWebGLContextProbe(): unknown {
  if (typeof document === "undefined") {
    return null;
  }
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  } catch {
    return null;
  }
}

/**
 * Structured WebGL capability check (spec §5: WebGL 不可用时必须降级).
 * Never throws; `supported:false` carries a machine-readable reason so the
 * demo can show the full text/table fallback instead.
 */
export function detectWebGLSupport(
  probe: WebGLContextProbe = defaultWebGLContextProbe,
): WebGLSupportResult {
  let context: unknown;
  try {
    context = probe();
  } catch (error) {
    return {
      supported: false,
      reason: `webgl-probe-threw: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (context === null || context === undefined || context === false) {
    return { supported: false, reason: "no-webgl-context" };
  }
  return { supported: true };
}
