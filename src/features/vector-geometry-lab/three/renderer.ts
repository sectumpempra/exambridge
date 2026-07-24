/**
 * Renderer + camera + interaction layer. This is the ONLY module that
 * touches GL-dependent objects (WebGLRenderer, OrbitControls), and both are
 * behind injectable factories so the module is fully testable under jsdom:
 * - WebGL creation failure → structured `{ ok:false, code:"webgl-unavailable" }`
 *   (never a thrown raw error), so the Stage 6 demo can render the complete
 *   text/table fallback instead (spec §5, §10.11).
 * - prefers-reduced-motion is read through an injectable matchMedia and
 *   disables damping/auto-rotate; animation never feeds back into solving.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { detectPrefersReducedMotion, detectWebGLSupport } from "./environment.js";
import type { MatchMediaFn, WebGLContextProbe } from "./environment.js";
import { readSceneGraphMeta, SCENE_GRAPH_META_KEY } from "./scene-graph.js";
import { findOwningEntryId } from "./types.js";
import type {
  CapturedPng,
  CapturePngOptions,
  PickInfo,
  Result,
  RendererError,
  SceneEntityMeta,
  SceneObjectEntry,
} from "./types.js";

export const CAMERA_VIEWS = ["front", "top", "side", "isometric"] as const;
export type CameraView = (typeof CAMERA_VIEWS)[number];

export const PROJECTION_MODES = ["perspective", "orthographic"] as const;
export type ProjectionMode = (typeof PROJECTION_MODES)[number];

/* --------------------------------------------------------------------------
 * Injectable GL factories
 * ------------------------------------------------------------------------ */

/** Structural slice of THREE.WebGLRenderer used by this package. */
export interface WebGLRendererLike {
  readonly domElement: HTMLCanvasElement;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio?(ratio: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export type WebGLRendererFactory = (
  canvas: HTMLCanvasElement,
  options: { readonly antialias: boolean },
) => WebGLRendererLike;

/** Default factory: real THREE.WebGLRenderer (throws when GL is missing). */
export function defaultWebGLRendererFactory(
  canvas: HTMLCanvasElement,
  options: { readonly antialias: boolean },
): WebGLRendererLike {
  return new THREE.WebGLRenderer({
    canvas,
    antialias: options.antialias,
  });
}

/** Structural slice of OrbitControls used by this package. */
export interface OrbitControlsLike {
  enableDamping: boolean;
  autoRotate: boolean;
  update(): unknown;
  dispose(): void;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export type OrbitControlsFactory = (
  camera: THREE.Camera,
  domElement: HTMLCanvasElement,
) => OrbitControlsLike;

/** Default factory: real OrbitControls from three/addons. */
export function defaultOrbitControlsFactory(
  camera: THREE.Camera,
  domElement: HTMLCanvasElement,
): OrbitControlsLike {
  return new OrbitControls(camera, domElement) as unknown as OrbitControlsLike;
}

export type RafFn = (callback: () => void) => number;
export type CancelRafFn = (handle: number) => void;

/* --------------------------------------------------------------------------
 * Options + handle
 * ------------------------------------------------------------------------ */

export interface VectorGeometryRendererOptions {
  /** Scene graph from buildSceneGraph; an empty scene is created otherwise. */
  readonly sceneGraph?: THREE.Group;
  /** Extra pick metadata (equation text / key params) keyed by object id. */
  readonly metadata?: readonly SceneEntityMeta[];
  readonly onPick?: (info: PickInfo) => void;
  readonly antialias?: boolean;
  readonly backgroundColor?: number;
  /** Initial camera distance from the origin (default 14). */
  readonly cameraDistance?: number;
  /** Orthographic half-height of the view volume (default 8). */
  readonly viewSize?: number;
  /** Auto-rotate the camera (ignored when reduced motion is preferred). */
  readonly autoRotate?: boolean;
  readonly rendererFactory?: WebGLRendererFactory;
  readonly controlsFactory?: OrbitControlsFactory;
  readonly matchMediaFn?: MatchMediaFn;
  readonly webglProbe?: WebGLContextProbe;
  readonly requestAnimationFrameFn?: RafFn;
  readonly cancelAnimationFrameFn?: CancelRafFn;
}

export interface RendererHandle {
  readonly canvas: HTMLCanvasElement;
  readonly scene: THREE.Scene;
  /** Live value: reflects detectPrefersReducedMotion + setReducedMotion. */
  readonly reducedMotion: boolean;
  /** Replaces the displayed scene graph (old graph resources NOT disposed). */
  setScene(graph: THREE.Group): void;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
  isDisposed(): boolean;
  setView(view: CameraView): void;
  resetCamera(): void;
  setProjection(projection: ProjectionMode): void;
  getProjection(): ProjectionMode;
  getView(): CameraView;
  setObjectVisibility(id: string, visible: boolean): boolean;
  setObjectOpacity(id: string, opacity: number): boolean;
  setReducedMotion(reduced: boolean): void;
  /**
   * Raycasts from canvas client coordinates. Returns the topmost visible
   * registry entry's pick info, or null. Pure geometry: never derives math.
   */
  pickAt(clientX: number, clientY: number): PickInfo | null;
  /**
   * Captures the current view as a PNG data URL (Stage 7 export). The scene
   * is rendered synchronously right before reading the canvas, so no
   * preserveDrawingBuffer is needed. pixelRatio 2/3 renders at 2×/3× the
   * canvas size for high-resolution export and restores the original size
   * afterwards. Failures (disposed, invalid ratio, canvas readback errors)
   * come back as structured "capture-failed" results — never thrown.
   */
  capturePng(options?: CapturePngOptions): Result<CapturedPng, RendererError>;
}

function rendererFailure(
  code: RendererError["code"],
  message: string,
  cause?: string,
): Result<never, RendererError> {
  return {
    ok: false,
    error: { code, message, ...(cause !== undefined ? { cause } : {}) },
  };
}

/** Disposes geometry/material/texture resources below `root` (memory rule). */
export function disposeObject3DResources(root: THREE.Object3D): void {
  root.traverse((object) => {
    const holder = object as unknown as {
      geometry?: { dispose(): void };
      material?: THREE.Material | readonly THREE.Material[];
    };
    holder.geometry?.dispose();
    const material = holder.material;
    const disposeMaterial = (m: THREE.Material): void => {
      const withMap = m as THREE.Material & { map?: THREE.Texture | null };
      withMap.map?.dispose();
      m.dispose();
    };
    if (material !== undefined) {
      const list: readonly THREE.Material[] = Array.isArray(material)
        ? (material as readonly THREE.Material[])
        : [material as THREE.Material];
      for (const m of list) {
        disposeMaterial(m);
      }
    }
  });
}

interface CanvasSize {
  readonly width: number;
  readonly height: number;
}

function readCanvasSize(canvas: HTMLCanvasElement): CanvasSize {
  try {
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
  } catch {
    // fall through to attribute-based size
  }
  const width = canvas.width > 0 ? canvas.width : 800;
  const height = canvas.height > 0 ? canvas.height : 600;
  return { width, height };
}

function isCanvasLike(canvas: unknown): canvas is HTMLCanvasElement {
  if (typeof canvas !== "object" || canvas === null) {
    return false;
  }
  const candidate = canvas as Record<string, unknown>;
  return (
    typeof candidate["addEventListener"] === "function" &&
    typeof candidate["removeEventListener"] === "function" &&
    typeof candidate["getBoundingClientRect"] === "function"
  );
}

function isEffectivelyHidden(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;
  while (current !== null) {
    if (!current.visible) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function positionForView(view: CameraView, distance: number): THREE.Vector3 {
  switch (view) {
    case "front":
      return new THREE.Vector3(0, 0, distance);
    case "top":
      return new THREE.Vector3(0, distance, 0);
    case "side":
      return new THREE.Vector3(distance, 0, 0);
    case "isometric":
      return new THREE.Vector3(distance, distance, distance);
  }
}

function upForView(view: CameraView): THREE.Vector3 {
  // For the top view the conventional up on screen is -z (north on the grid).
  return view === "top"
    ? new THREE.Vector3(0, 0, -1)
    : new THREE.Vector3(0, 1, 0);
}

/**
 * Creates the renderer. Never throws raw GL errors: any WebGL failure comes
 * back as `{ ok:false, error:{ code:"webgl-unavailable", ... } }`.
 */
export function createVectorGeometryRenderer(
  canvas: HTMLCanvasElement,
  options: VectorGeometryRendererOptions = {},
): Result<RendererHandle, RendererError> {
  if (!isCanvasLike(canvas)) {
    return rendererFailure(
      "invalid-canvas",
      "createVectorGeometryRenderer needs a canvas-like element (addEventListener / getBoundingClientRect).",
    );
  }

  const reducedAtStart = detectPrefersReducedMotion(options.matchMediaFn);

  if (options.webglProbe !== undefined) {
    const support = detectWebGLSupport(options.webglProbe);
    if (!support.supported) {
      return rendererFailure(
        "webgl-unavailable",
        `WebGL is not available (${support.reason ?? "unknown reason"}). Show the text/table fallback.`,
      );
    }
  }

  const antialias = options.antialias ?? true;
  const rendererFactory = options.rendererFactory ?? defaultWebGLRendererFactory;
  let renderer: WebGLRendererLike;
  try {
    renderer = rendererFactory(canvas, { antialias });
  } catch (error) {
    return rendererFailure(
      "webgl-unavailable",
      "THREE.WebGLRenderer could not be created. Show the text/table fallback.",
      error instanceof Error ? error.message : String(error),
    );
  }

  const size = readCanvasSize(canvas);
  const aspect = size.width / size.height;
  const cameraDistance = options.cameraDistance ?? 14;
  const viewSize = options.viewSize ?? 8;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(options.backgroundColor ?? 0xffffff);

  const perspectiveCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  const orthographicCamera = new THREE.OrthographicCamera(
    -viewSize * aspect,
    viewSize * aspect,
    viewSize,
    -viewSize,
    0.1,
    1000,
  );

  let currentGraph: THREE.Group | undefined;
  if (options.sceneGraph !== undefined) {
    currentGraph = options.sceneGraph;
    scene.add(currentGraph);
  }

  // Pick metadata: scene-graph registry entries + caller metadata override.
  const pickMetadata = new Map<string, PickInfo>();
  const rebuildPickMetadata = (): void => {
    pickMetadata.clear();
    const registerEntry = (entry: SceneObjectEntry): void => {
      pickMetadata.set(entry.id, {
        objectId: entry.id,
        kind: entry.kind,
        name: entry.name,
        equationText: entry.equationText,
        keyParams: entry.keyParams,
      });
    };
    if (currentGraph !== undefined) {
      const meta = readSceneGraphMeta(currentGraph);
      for (const entry of meta?.registry ?? []) {
        registerEntry(entry);
      }
    }
    for (const meta of options.metadata ?? []) {
      pickMetadata.set(meta.id, {
        objectId: meta.id,
        kind: meta.kind,
        name: meta.name,
        equationText: meta.equationText,
        keyParams: meta.keyParams,
      });
    }
  };
  rebuildPickMetadata();

  const state = {
    projection: "perspective" as ProjectionMode,
    view: "isometric" as CameraView,
    reducedMotion: reducedAtStart,
    disposed: false,
    rafHandle: undefined as number | undefined,
  };

  let activeCamera: THREE.Camera = perspectiveCamera;

  const applyView = (view: CameraView): void => {
    state.view = view;
    const position = positionForView(view, cameraDistance);
    for (const camera of [perspectiveCamera, orthographicCamera]) {
      camera.up.copy(upForView(view));
      camera.position.copy(position);
      camera.lookAt(0, 0, 0);
      // Raycasting reads matrixWorld; keep it in sync even when the render
      // loop is stubbed or hasn't run yet.
      camera.updateMatrixWorld();
    }
  };
  applyView("isometric");

  const rafFn: RafFn | undefined =
    options.requestAnimationFrameFn ??
    (typeof globalThis.requestAnimationFrame === "function"
      ? (cb) => globalThis.requestAnimationFrame(cb)
      : undefined);
  const cancelRafFn: CancelRafFn | undefined =
    options.cancelAnimationFrameFn ??
    (typeof globalThis.cancelAnimationFrame === "function"
      ? (handle) => globalThis.cancelAnimationFrame(handle)
      : undefined);

  const renderOnce = (): void => {
    if (state.disposed) {
      return;
    }
    renderer.render(scene, activeCamera);
  };

  const controlsFactory = options.controlsFactory ?? defaultOrbitControlsFactory;
  let controls: OrbitControlsLike | undefined;

  const stopAnimationLoop = (): void => {
    if (state.rafHandle !== undefined && cancelRafFn !== undefined) {
      cancelRafFn(state.rafHandle);
    }
    state.rafHandle = undefined;
  };

  const startAnimationLoop = (): void => {
    if (rafFn === undefined || state.rafHandle !== undefined) {
      return;
    }
    const tick = (): void => {
      if (state.disposed || controls === undefined) {
        return;
      }
      controls.update();
      renderOnce();
      state.rafHandle = rafFn(tick);
    };
    state.rafHandle = rafFn(tick);
  };

  const applyMotionPreferences = (): void => {
    if (controls === undefined) {
      return;
    }
    // Reduced motion: no damping, no auto-rotate (spec §5). Animation is a
    // view/teaching aid only; it never participates in solving.
    controls.enableDamping = !state.reducedMotion;
    controls.autoRotate = (options.autoRotate ?? false) && !state.reducedMotion;
    if (controls.autoRotate) {
      startAnimationLoop();
    } else {
      stopAnimationLoop();
    }
  };

  const createControls = (): void => {
    controls = controlsFactory(activeCamera, canvas);
    controls.addEventListener("change", renderOnce);
    applyMotionPreferences();
  };
  createControls();

  const clickHandler = (event: Event): void => {
    const mouse = event as Partial<Pick<MouseEvent, "clientX" | "clientY">>;
    if (
      typeof mouse.clientX !== "number" ||
      typeof mouse.clientY !== "number" ||
      options.onPick === undefined
    ) {
      return;
    }
    const info = handle.pickAt(mouse.clientX, mouse.clientY);
    if (info !== null) {
      options.onPick(info);
    }
  };
  canvas.addEventListener("click", clickHandler);

  const raycaster = new THREE.Raycaster();
  const registryIndex = (): Map<string, SceneObjectEntry> => {
    const index = new Map<string, SceneObjectEntry>();
    if (currentGraph !== undefined) {
      const meta = readSceneGraphMeta(currentGraph);
      for (const entry of meta?.registry ?? []) {
        index.set(entry.id, entry);
      }
    }
    return index;
  };

  const handle: RendererHandle = {
    canvas,
    scene,
    get reducedMotion(): boolean {
      return state.reducedMotion;
    },

    setScene(graph: THREE.Group): void {
      if (state.disposed) {
        return;
      }
      if (currentGraph !== undefined) {
        scene.remove(currentGraph);
      }
      currentGraph = graph;
      scene.add(graph);
      rebuildPickMetadata();
      renderOnce();
    },

    render: renderOnce,

    resize(width: number, height: number): void {
      if (state.disposed || width <= 0 || height <= 0) {
        return;
      }
      const nextAspect = width / height;
      perspectiveCamera.aspect = nextAspect;
      perspectiveCamera.updateProjectionMatrix();
      orthographicCamera.left = -viewSize * nextAspect;
      orthographicCamera.right = viewSize * nextAspect;
      orthographicCamera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderOnce();
    },

    dispose(): void {
      if (state.disposed) {
        return; // dispose is idempotent
      }
      state.disposed = true;
      stopAnimationLoop();
      canvas.removeEventListener("click", clickHandler);
      controls?.removeEventListener("change", renderOnce);
      controls?.dispose();
      disposeObject3DResources(scene);
      scene.clear();
      renderer.dispose();
    },

    isDisposed(): boolean {
      return state.disposed;
    },

    setView(view: CameraView): void {
      if (state.disposed) {
        return;
      }
      applyView(view);
      renderOnce();
    },

    resetCamera(): void {
      if (state.disposed) {
        return;
      }
      applyView("isometric");
      renderOnce();
    },

    setProjection(projection: ProjectionMode): void {
      if (state.disposed || projection === state.projection) {
        return;
      }
      state.projection = projection;
      activeCamera =
        projection === "perspective" ? perspectiveCamera : orthographicCamera;
      // OrbitControls binds to one camera: rebuild against the new camera.
      controls?.removeEventListener("change", renderOnce);
      controls?.dispose();
      createControls();
      renderOnce();
    },

    getProjection(): ProjectionMode {
      return state.projection;
    },

    getView(): CameraView {
      return state.view;
    },

    setObjectVisibility(id: string, visible: boolean): boolean {
      if (state.disposed) {
        return false;
      }
      const entry = registryIndex().get(id);
      if (entry === undefined) {
        return false;
      }
      entry.object3d.visible = visible;
      renderOnce();
      return true;
    },

    setObjectOpacity(id: string, opacity: number): boolean {
      if (state.disposed || !Number.isFinite(opacity)) {
        return false;
      }
      const entry = registryIndex().get(id);
      if (entry === undefined) {
        return false;
      }
      const clamped = Math.min(1, Math.max(0, opacity));
      entry.object3d.traverse((object) => {
        const holder = object as unknown as {
          material?: THREE.Material | readonly THREE.Material[];
        };
        const apply = (m: THREE.Material): void => {
          m.opacity = clamped;
          if (clamped < 1) {
            m.transparent = true;
          }
        };
        const material = holder.material;
        if (material !== undefined) {
          const list: readonly THREE.Material[] = Array.isArray(material)
            ? (material as readonly THREE.Material[])
            : [material as THREE.Material];
          for (const m of list) {
            apply(m);
          }
        }
      });
      renderOnce();
      return true;
    },

    setReducedMotion(reduced: boolean): void {
      if (state.disposed) {
        return;
      }
      state.reducedMotion = reduced;
      applyMotionPreferences();
      renderOnce();
    },

    pickAt(clientX: number, clientY: number): PickInfo | null {
      if (state.disposed) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      activeCamera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, activeCamera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      for (const hit of intersects) {
        if (isEffectivelyHidden(hit.object)) {
          continue;
        }
        const id = findOwningEntryId(hit.object);
        if (id === undefined) {
          continue;
        }
        const info = pickMetadata.get(id);
        if (info !== undefined) {
          return info;
        }
      }
      return null;
    },

    capturePng(captureOptions: CapturePngOptions = {}): Result<CapturedPng, RendererError> {
      if (state.disposed) {
        return rendererFailure(
          "capture-failed",
          "Cannot capture a PNG: the renderer has been disposed.",
        );
      }
      const ratio = captureOptions.pixelRatio ?? 1;
      if (ratio !== 1 && ratio !== 2 && ratio !== 3) {
        return rendererFailure(
          "capture-failed",
          `pixelRatio must be 1, 2 or 3; got ${String(ratio)}.`,
        );
      }
      const base = readCanvasSize(canvas);
      try {
        if (ratio !== 1) {
          // Aspect is unchanged by uniform scaling, so cameras stay valid.
          renderer.setSize(base.width * ratio, base.height * ratio);
        }
        renderOnce();
        const dataUrl = canvas.toDataURL("image/png");
        if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png")) {
          return rendererFailure(
            "capture-failed",
            "canvas.toDataURL did not return a PNG data URL.",
          );
        }
        return {
          ok: true,
          value: {
            dataUrl,
            width: base.width * ratio,
            height: base.height * ratio,
            pixelRatio: ratio,
          },
        };
      } catch (error) {
        return rendererFailure(
          "capture-failed",
          "Canvas capture failed (readback unsupported or canvas tainted).",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        if (ratio !== 1) {
          renderer.setSize(base.width, base.height);
          renderOnce();
        }
      }
    },
  };

  return { ok: true, value: handle };
}

/** Re-export so integrators can find the meta key without importing scene-graph. */
export { SCENE_GRAPH_META_KEY };
