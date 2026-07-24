/**
 * Shared stub for the lazily-loaded 3d module. The demo only ever talks to
 * the 3d package through the loader interface, so a structural stub is
 * faithful (Stage 5 injection points).
 */

import { vi } from "vitest";
import type { VectorGeometry3DModule } from "@/pages/vector-geometry-lab/three/loader.js";

export const STUB_CAPTURE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export interface StubRendererHandle {
  readonly render: ReturnType<typeof vi.fn>;
  readonly resize: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
  readonly isDisposed: ReturnType<typeof vi.fn>;
  readonly setScene: ReturnType<typeof vi.fn>;
  readonly setView: ReturnType<typeof vi.fn>;
  readonly resetCamera: ReturnType<typeof vi.fn>;
  readonly setProjection: ReturnType<typeof vi.fn>;
  readonly getProjection: ReturnType<typeof vi.fn>;
  readonly getView: ReturnType<typeof vi.fn>;
  readonly setObjectVisibility: ReturnType<typeof vi.fn>;
  readonly setObjectOpacity: ReturnType<typeof vi.fn>;
  readonly setReducedMotion: ReturnType<typeof vi.fn>;
  readonly pickAt: ReturnType<typeof vi.fn>;
  readonly capturePng: ReturnType<typeof vi.fn>;
  readonly reducedMotion: boolean;
}

export interface StubThree {
  readonly module: VectorGeometry3DModule;
  readonly handle: StubRendererHandle;
  readonly buildSceneGraph: ReturnType<typeof vi.fn>;
  readonly createVectorGeometryRenderer: ReturnType<typeof vi.fn>;
  readonly detectWebGLSupport: ReturnType<typeof vi.fn>;
  readonly loaderCalls: number[];
  loader: () => Promise<VectorGeometry3DModule>;
}

export function createStubThree(options?: {
  readonly webglSupported?: boolean;
  readonly rendererOk?: boolean;
}): StubThree {
  const webglSupported = options?.webglSupported ?? true;
  const rendererOk = options?.rendererOk ?? true;
  const handle: StubRendererHandle = {
    render: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
    setScene: vi.fn(),
    setView: vi.fn(),
    resetCamera: vi.fn(),
    setProjection: vi.fn(),
    getProjection: vi.fn(() => "perspective"),
    getView: vi.fn(() => "isometric"),
    setObjectVisibility: vi.fn(() => true),
    setObjectOpacity: vi.fn(() => true),
    setReducedMotion: vi.fn(),
    pickAt: vi.fn(() => null),
    capturePng: vi.fn((options?: { pixelRatio?: number }) => {
      const ratio = options?.pixelRatio ?? 1;
      return {
        ok: true as const,
        value: {
          dataUrl: STUB_CAPTURE_DATA_URL,
          width: 800 * ratio,
          height: 600 * ratio,
          pixelRatio: ratio,
        },
      };
    }),
    reducedMotion: false,
  };
  const buildSceneGraph = vi.fn(() => ({ userData: {} }));
  const createVectorGeometryRenderer = vi.fn(() =>
    rendererOk
      ? { ok: true as const, value: handle }
      : {
          ok: false as const,
          error: { code: "webgl-unavailable" as const, message: "no GL" },
        },
  );
  const detectWebGLSupport = vi.fn(() => ({ supported: webglSupported }));
  const vectorModule = {
    buildSceneGraph,
    createVectorGeometryRenderer,
    detectWebGLSupport,
    readSceneGraphMeta: vi.fn(() => ({
      registry: [],
      legend: { title: "Legend", entries: [] },
      warnings: [],
    })),
    createLegendElement: vi.fn(() => document.createElement("aside")),
  } as unknown as VectorGeometry3DModule;
  const loaderCalls: number[] = [];
  return {
    module: vectorModule,
    handle,
    buildSceneGraph,
    createVectorGeometryRenderer,
    detectWebGLSupport,
    loaderCalls,
    loader: () => {
      loaderCalls.push(Date.now());
      return Promise.resolve(vectorModule);
    },
  };
}
