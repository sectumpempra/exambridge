/**
 * Text labels as CanvasTexture sprites.
 *
 * The canvas-2d context is created through an INJECTABLE factory
 * (`Canvas2DFactory`): production uses a real <canvas>, jsdom tests inject a
 * stub. Sprite creation NEVER throws — any factory/texture failure degrades
 * to an untextured fallback sprite (a small coloured chip carrying the text
 * in its `name`/`userData`) so scenes stay inspectable without crashing.
 */

import * as THREE from "three";

/** Structural minimum of a 2d canvas context used for label rasterisation. */
export interface Canvas2DContextLike {
  font: string;
  textAlign: string;
  textBaseline: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  measureText(text: string): { readonly width: number };
  fillText(text: string, x: number, y: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
}

/** Structural minimum of the backing canvas element. */
export interface TextCanvasLike {
  width: number;
  height: number;
}

export interface TextCanvas2D {
  readonly canvas: TextCanvasLike;
  readonly context: Canvas2DContextLike;
}

export type Canvas2DFactory = (
  width: number,
  height: number,
) => TextCanvas2D | null;

/**
 * Generic (non-CJK-only) font stack with CJK fallbacks so axis labels and
 * entity labels render for zh/en/ja content alike (spec §5 标签要求).
 */
export const LABEL_FONT_STACK =
  '"Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

export const DEFAULT_LABEL_FONT = `600 42px ${LABEL_FONT_STACK}`;

/** Default factory: real canvas. Returns null when unavailable (SSR/tests). */
export function defaultCanvas2DFactory(
  width: number,
  height: number,
): TextCanvas2D | null {
  if (typeof document === "undefined") {
    return null;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) {
      return null;
    }
    return { canvas, context };
  } catch {
    return null;
  }
}

export interface TextSpriteOptions {
  readonly canvasFactory?: Canvas2DFactory;
  readonly font?: string;
  readonly textColor?: string;
  /** Sprite height in world units (default 0.4). */
  readonly worldHeight?: number;
  readonly paddingPx?: number;
}

/** userData flag set on fallback (textureless) label sprites. */
export const LABEL_FALLBACK_USER_DATA_KEY = "exambridgeLabelFallback";

interface RasterisedLabel {
  readonly texture: THREE.CanvasTexture;
  readonly aspect: number;
}

function tryRasterise(
  text: string,
  factory: Canvas2DFactory,
  options: TextSpriteOptions,
): RasterisedLabel | null {
  const font = options.font ?? DEFAULT_LABEL_FONT;
  const padding = options.paddingPx ?? 12;
  let surface: TextCanvas2D | null = null;
  try {
    surface = factory(2, 2);
  } catch {
    return null;
  }
  if (surface === null) {
    return null;
  }
  try {
    const { canvas, context } = surface;
    context.font = font;
    const measured = context.measureText(text);
    const width = Math.max(2, Math.ceil(measured.width + padding * 2));
    const height = Math.max(2, Math.ceil(42 + padding * 2));
    canvas.width = width;
    canvas.height = height;
    // Resizing resets context state on real canvases: re-apply before drawing.
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = options.textColor ?? "#111111";
    context.clearRect(0, 0, width, height);
    context.fillText(text, width / 2, height / 2);
    const texture = new THREE.CanvasTexture(
      canvas as unknown as HTMLCanvasElement,
    );
    return { texture, aspect: width / height };
  } catch {
    return null;
  }
}

/**
 * Creates a text sprite, or null when `text` is empty. Any rasterisation
 * failure yields the untextured fallback chip (never throws).
 */
export function createTextSprite(
  text: string,
  options: TextSpriteOptions = {},
): THREE.Sprite | null {
  if (text.length === 0) {
    return null;
  }
  const worldHeight = options.worldHeight ?? 0.4;
  const factory = options.canvasFactory ?? defaultCanvas2DFactory;
  const rasterised = tryRasterise(text, factory, options);
  if (rasterised === null) {
    const material = new THREE.SpriteMaterial({ color: 0xdddddd });
    const fallback = new THREE.Sprite(material);
    fallback.scale.set(worldHeight, worldHeight * 0.5, 1);
    fallback.name = `label-fallback:${text}`;
    fallback.userData[LABEL_FALLBACK_USER_DATA_KEY] = true;
    fallback.userData["labelText"] = text;
    return fallback;
  }
  const material = new THREE.SpriteMaterial({
    map: rasterised.texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(rasterised.aspect * worldHeight, worldHeight, 1);
  sprite.name = `label:${text}`;
  sprite.userData["labelText"] = text;
  return sprite;
}

/**
 * Adds a label sprite as a child of `parent` at a local offset. When labels
 * are disabled this is a no-op; sprite failure still leaves the fallback
 * chip (see createTextSprite).
 */
export function attachLabel(
  parent: THREE.Object3D,
  text: string,
  offset: THREE.Vector3,
  options: TextSpriteOptions & { readonly labelsEnabled?: boolean } = {},
): THREE.Sprite | null {
  if (options.labelsEnabled === false) {
    return null;
  }
  const sprite = createTextSprite(text, options);
  if (sprite === null) {
    return null;
  }
  sprite.position.copy(offset);
  parent.add(sprite);
  return sprite;
}
