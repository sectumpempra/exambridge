/**
 * Test helpers: exact-scalar makers, injectable stubs (canvas 2d, canvas
 * element, WebGL renderer, orbit controls, raf). No native canvas, no real
 * GL — everything structural.
 */

import * as THREE from "three";
import { vi } from "vitest";
import { scalarFromLiteral } from "@/features/vector-geometry-lab/schema";
import type {
  Point3V1,
  ScalarV1,
  Vector3V1,
} from "@/features/vector-geometry-lab/schema";
import type {
  Canvas2DContextLike,
  Canvas2DFactory,
  TextCanvas2D,
} from "@/features/vector-geometry-lab/three/labels";
import type {
  OrbitControlsFactory,
  OrbitControlsLike,
  WebGLRendererFactory,
  WebGLRendererLike,
} from "@/features/vector-geometry-lab/three/renderer";

/* ------------------------------------------------------------------------
 * Math-contract makers (exact scalars via the schema parser)
 * --------------------------------------------------------------------- */

export function makeScalar(literal: string): ScalarV1 {
  const parsed = scalarFromLiteral(literal);
  if (!parsed.ok) {
    throw new Error(`test literal "${literal}" is not a valid scalar`);
  }
  return parsed.value;
}

export function makeVector3(x: string, y: string, z: string): Vector3V1 {
  return { x: makeScalar(x), y: makeScalar(y), z: makeScalar(z) };
}

export function makePoint(
  pointId: string,
  label: string,
  x: string,
  y: string,
  z: string,
): Point3V1 {
  return { pointId, label, position: makeVector3(x, y, z) };
}

/* ------------------------------------------------------------------------
 * Canvas 2d stubs
 * --------------------------------------------------------------------- */

export interface Canvas2DRecorder {
  readonly fillTextCalls: Array<{ text: string; x: number; y: number }>;
  readonly measureTextCalls: string[];
  readonly canvases: Array<{ width: number; height: number }>;
}

export function createStubCanvas2DFactory(): {
  factory: Canvas2DFactory;
  recorder: Canvas2DRecorder;
} {
  const fillTextCalls: Array<{ text: string; x: number; y: number }> = [];
  const measureTextCalls: string[] = [];
  const canvases: Array<{ width: number; height: number }> = [];
  const factory: Canvas2DFactory = (width, height): TextCanvas2D => {
    const canvas = { width, height };
    canvases.push(canvas);
    const context: Canvas2DContextLike = {
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      fillStyle: "#000000",
      measureText(text: string) {
        measureTextCalls.push(text);
        return { width: text.length * 20 };
      },
      fillText(text: string, x: number, y: number) {
        fillTextCalls.push({ text, x, y });
      },
      clearRect() {
        // no-op
      },
    };
    return { canvas, context };
  };
  return { factory, recorder: { fillTextCalls, measureTextCalls, canvases } };
}

export const nullCanvas2DFactory: Canvas2DFactory = () => null;

export const throwingCanvas2DFactory: Canvas2DFactory = () => {
  throw new Error("canvas exploded");
};

/* ------------------------------------------------------------------------
 * Canvas element stub (for the renderer factory tests)
 * --------------------------------------------------------------------- */

export type StubEventListener = (event: Event) => void;

export interface StubCanvasElement {
  canvas: HTMLCanvasElement;
  readonly listeners: Map<string, StubEventListener[]>;
  readonly rect: { left: number; top: number; width: number; height: number };
  dispatch(type: string, event: Event): void;
  /** Controls what canvas.toDataURL returns (or throws when set). */
  dataUrl: string;
  toDataUrlError: Error | null;
  readonly toDataUrlCalls: string[];
}

export const STUB_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function createStubCanvasElement(
  rect = { left: 0, top: 0, width: 800, height: 600 },
): StubCanvasElement {
  const listeners = new Map<string, StubEventListener[]>();
  const toDataUrlCalls: string[] = [];
  const stub: StubCanvasElement = {
    canvas: undefined as unknown as HTMLCanvasElement,
    listeners,
    rect,
    dataUrl: STUB_PNG_DATA_URL,
    toDataUrlError: null,
    toDataUrlCalls,
    dispatch(type: string, event: Event) {
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
    },
  };
  const canvas = {
    width: rect.width,
    height: rect.height,
    style: {},
    addEventListener(type: string, listener: EventListener) {
      const list = listeners.get(type) ?? [];
      list.push(listener as StubEventListener);
      listeners.set(type, list);
    },
    removeEventListener(type: string, listener: EventListener) {
      const list = listeners.get(type) ?? [];
      listeners.set(
        type,
        list.filter((l) => l !== (listener as StubEventListener)),
      );
    },
    getBoundingClientRect() {
      return { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height };
    },
    toDataURL(type = "image/png") {
      toDataUrlCalls.push(type);
      if (stub.toDataUrlError !== null) {
        throw stub.toDataUrlError;
      }
      return stub.dataUrl;
    },
  } as unknown as HTMLCanvasElement;
  stub.canvas = canvas;
  return stub;
}

/* ------------------------------------------------------------------------
 * WebGL renderer / controls stubs
 * --------------------------------------------------------------------- */

export interface StubRendererRecorder {
  readonly renderCalls: Array<{ scene: THREE.Scene; camera: THREE.Camera }>;
  readonly setSizeCalls: Array<{ width: number; height: number }>;
  readonly disposeCalls: number[];
}

export function createStubRendererFactory(): {
  factory: WebGLRendererFactory;
  recorder: StubRendererRecorder;
} {
  const renderCalls: Array<{ scene: THREE.Scene; camera: THREE.Camera }> = [];
  const setSizeCalls: Array<{ width: number; height: number }> = [];
  const disposeCalls: number[] = [];
  const factory: WebGLRendererFactory = (canvas): WebGLRendererLike => ({
    domElement: canvas,
    setSize(width: number, height: number) {
      setSizeCalls.push({ width, height });
    },
    render(scene: THREE.Scene, camera: THREE.Camera) {
      renderCalls.push({ scene, camera });
    },
    dispose() {
      disposeCalls.push(Date.now());
    },
  });
  return { factory, recorder: { renderCalls, setSizeCalls, disposeCalls } };
}

export const throwingRendererFactory: WebGLRendererFactory = () => {
  throw new Error("Error creating WebGL context.");
};

export interface StubControls extends OrbitControlsLike {
  readonly updateMock: ReturnType<typeof vi.fn>;
  readonly disposeMock: ReturnType<typeof vi.fn>;
  readonly changeListeners: Array<() => void>;
}

export interface StubControlsRecorder {
  readonly instances: StubControls[];
  readonly cameras: THREE.Camera[];
}

export function createStubControlsFactory(): {
  factory: OrbitControlsFactory;
  recorder: StubControlsRecorder;
} {
  const instances: StubControls[] = [];
  const cameras: THREE.Camera[] = [];
  const factory: OrbitControlsFactory = (camera): OrbitControlsLike => {
    cameras.push(camera);
    const changeListeners: Array<() => void> = [];
    const updateMock = vi.fn();
    const disposeMock = vi.fn();
    const controls: StubControls = {
      enableDamping: false,
      autoRotate: false,
      update: updateMock as unknown as () => unknown,
      dispose: disposeMock as unknown as () => void,
      updateMock,
      disposeMock,
      changeListeners,
      addEventListener(_type: "change", listener: () => void) {
        changeListeners.push(listener);
      },
      removeEventListener(_type: "change", listener: () => void) {
        const index = changeListeners.indexOf(listener);
        if (index >= 0) {
          changeListeners.splice(index, 1);
        }
      },
    };
    instances.push(controls);
    return controls;
  };
  return { factory, recorder: { instances, cameras } };
}

/** Records raf callbacks without ever invoking them spontaneously. */
export function createStubRaf(): {
  rafFn: (callback: () => void) => number;
  cancelFn: (handle: number) => void;
  pending: Map<number, () => void>;
  cancelled: number[];
  runNext(): void;
} {
  const pending = new Map<number, () => void>();
  const cancelled: number[] = [];
  let nextHandle = 1;
  return {
    rafFn(callback: () => void) {
      const handle = nextHandle;
      nextHandle += 1;
      pending.set(handle, callback);
      return handle;
    },
    cancelFn(handle: number) {
      cancelled.push(handle);
      pending.delete(handle);
    },
    pending,
    cancelled,
    runNext() {
      const first = pending.keys().next();
      if (first.done) {
        return;
      }
      const handle = first.value;
      const callback = pending.get(handle);
      pending.delete(handle);
      callback?.();
    },
  };
}

/** Returns all descendants (including root) with a matching `name`. */
export function findByName(root: THREE.Object3D, name: string): THREE.Object3D[] {
  const matches: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (object.name === name) {
      matches.push(object);
    }
  });
  return matches;
}

/** Reads the Float32 positions of a Line/LineSegments geometry. */
export function linePositions(line: THREE.Object3D): THREE.Vector3[] {
  const geometry = (line as THREE.Line).geometry as THREE.BufferGeometry;
  const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < attribute.count; i += 1) {
    points.push(
      new THREE.Vector3(attribute.getX(i), attribute.getY(i), attribute.getZ(i)),
    );
  }
  return points;
}
