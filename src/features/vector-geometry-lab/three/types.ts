/**
 * Shared types for the 3d display package. This package is a PURE DISPLAY
 * layer: it maps math-layer contracts (VectorGeometrySceneV1 entities and
 * DisplayGeometryV1 payloads) onto THREE objects. It never derives
 * mathematical results from THREE objects, screen coordinates, or raycasts.
 */

import type * as THREE from "three";

/** Discriminated result used by the renderer factory (never throws raw). */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const RENDERER_ERROR_CODES = [
  "webgl-unavailable",
  "invalid-canvas",
  "capture-failed",
] as const;
export type RendererErrorCode = (typeof RENDERER_ERROR_CODES)[number];

/** Structured renderer failure consumed by the Stage 6 demo fallback UI. */
export interface RendererError {
  readonly code: RendererErrorCode;
  readonly message: string;
  readonly cause?: string;
}

/**
 * Kind tags carried by scene-graph registry entries. Display kinds are
 * unified with entity kinds where they coincide ("point", "line", "plane");
 * "vector-arrow" and "normal-arrow" are kept distinct because their line
 * styles differ (solid vs dashed) and that distinction is load-bearing for
 * the "colour is never the only differentiator" rule.
 */
export const SCENE_OBJECT_KINDS = [
  "point",
  "vector-arrow",
  "line",
  "plane",
  "segment",
  "angle-arc",
  "normal-arrow",
  "axis",
  "grid",
  "origin-marker",
] as const;
export type SceneObjectKind = (typeof SCENE_OBJECT_KINDS)[number];

/**
 * Caller-supplied metadata for one entity or display entry. `equationText`
 * and `keyParams` are produced by the math/explain layers and are displayed
 * verbatim on picking — the renderer never computes them.
 */
export interface SceneEntityMeta {
  readonly id: string;
  readonly kind: SceneObjectKind;
  readonly name: string;
  readonly equationText: string;
  readonly keyParams: Readonly<Record<string, string>>;
}

/** Registry entry linking a stable math-layer id to its THREE subtree. */
export interface SceneObjectEntry {
  readonly id: string;
  readonly kind: SceneObjectKind;
  readonly name: string;
  readonly object3d: THREE.Object3D;
  readonly equationText: string;
  readonly keyParams: Readonly<Record<string, string>>;
}

/** Pick callback payload (spec §5 交互: name, equation, key parameters). */
export interface PickInfo {
  readonly objectId: string;
  readonly kind: SceneObjectKind;
  readonly name: string;
  readonly equationText: string;
  readonly keyParams: Readonly<Record<string, string>>;
}

/** `userData` key under which each entry root stores its stable id. */
export const VG_ID_USER_DATA_KEY = "exambridgeVectorGeometryId";

/* ------------------------------------------------------------------------
 * PNG capture (Stage 7: storage & exports) — additive API.
 * --------------------------------------------------------------------- */

/** Capture scale factors: 1 = canvas pixels, 2/3 = high-resolution export. */
export type CapturePixelRatio = 1 | 2 | 3;

export interface CapturePngOptions {
  /** Defaults to 1. Any other value is refused with "capture-failed". */
  readonly pixelRatio?: CapturePixelRatio;
}

export interface CapturedPng {
  /** "data:image/png;base64,…" straight from the canvas. */
  readonly dataUrl: string;
  /** Pixel dimensions of the captured image (canvas size × pixelRatio). */
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: CapturePixelRatio;
}

/** Walks up the ancestor chain to find the owning registry id, if any. */
export function findOwningEntryId(object: THREE.Object3D): string | undefined {
  let current: THREE.Object3D | null = object;
  while (current !== null) {
    const id = (current.userData as Record<string, unknown>)[
      VG_ID_USER_DATA_KEY
    ];
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
    current = current.parent;
  }
  return undefined;
}
