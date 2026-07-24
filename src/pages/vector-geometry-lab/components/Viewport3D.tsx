/**
 * Viewport3D — hosts the lazily-loaded 3d renderer.
 *
 * Lifecycle: dynamic-import the 3d module → detectWebGLSupport() preflight
 * → buildSceneGraph + createVectorGeometryRenderer. Any failure along this
 * chain degrades to the "unavailable" status and the app shows the FULL
 * text/table results instead (spec §5, §10.11) — the text results never
 * depend on this component.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BuildSceneGraphInput,
  PickInfo,
  RendererHandle,
  SceneEntityMeta,
} from "@/features/vector-geometry-lab/three";
import { loadVectorGeometry3D } from "../three/loader.js";
import type { ThreeLoader, VectorGeometry3DModule } from "../three/loader.js";
import type { ViewportStatus } from "../state/lab-state.js";
import styles from "./viewport.module.css";

export interface Viewport3DProps {
  readonly sceneInput: BuildSceneGraphInput;
  readonly metadata: readonly SceneEntityMeta[];
  readonly planeOpacity: number;
  readonly hidden: Readonly<Record<string, boolean>>;
  readonly opacity: Readonly<Record<string, number>>;
  /** null = follow the system preference (matchMedia inside the 3d package). */
  readonly reducedMotionOverride: boolean | null;
  readonly onPick: (info: PickInfo) => void;
  readonly onHandleChange: (handle: RendererHandle | null) => void;
  readonly onStatusChange: (status: ViewportStatus) => void;
  readonly loader?: ThreeLoader;
}

export function Viewport3D(props: Viewport3DProps): React.JSX.Element {
  const {
    sceneInput,
    metadata,
    planeOpacity,
    hidden,
    opacity,
    reducedMotionOverride,
    onPick,
    onHandleChange,
    onStatusChange,
    loader = loadVectorGeometry3D,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const [module3d, setModule3d] = useState<VectorGeometry3DModule | null>(null);
  const [status, setStatus] = useState<ViewportStatus>("loading");
  const handleRef = useRef<RendererHandle | null>(null);
  const callbacksRef = useRef({ onPick, onHandleChange, onStatusChange });
  const sceneRef = useRef({ sceneInput, metadata, planeOpacity });

  useEffect(() => {
    callbacksRef.current = { onPick, onHandleChange, onStatusChange };
  }, [onPick, onHandleChange, onStatusChange]);

  useEffect(() => {
    sceneRef.current = { sceneInput, metadata, planeOpacity };
  }, [sceneInput, metadata, planeOpacity]);

  const updateStatus = useCallback((nextStatus: ViewportStatus): void => {
    setStatus(nextStatus);
    callbacksRef.current.onStatusChange(nextStatus);
  }, []);

  const renderLegend = (
    module: VectorGeometry3DModule,
    graph: Parameters<VectorGeometry3DModule["readSceneGraphMeta"]>[0],
  ): void => {
    const container = legendRef.current;
    if (container === null) {
      return;
    }
    const meta = module.readSceneGraphMeta(graph);
    if (meta === undefined) {
      container.replaceChildren();
      return;
    }
    container.replaceChildren(module.createLegendElement(meta.legend));
  };

  // 1. Lazy-load the 3d module once per loader.
  useEffect(() => {
    let cancelled = false;
    loader()
      .then((module) => {
        if (!cancelled) {
          setModule3d(module);
        }
      })
      .catch(() => {
        if (!cancelled) {
          updateStatus("unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loader, updateStatus]);

  // 2. Create the renderer once the module and canvas exist (and whenever
  //    the reduced-motion override changes, since it is read at creation).
  useEffect(() => {
    if (module3d === null || canvasRef.current === null) {
      return;
    }
    const support = module3d.detectWebGLSupport();
    if (!support.supported) {
      // This effect synchronizes React with an external WebGL renderer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      updateStatus("unavailable");
      return;
    }
    const currentScene = sceneRef.current;
    const graph = module3d.buildSceneGraph(
      { ...currentScene.sceneInput, metadata: currentScene.metadata },
      { planeOpacity: currentScene.planeOpacity },
    );
    const result = module3d.createVectorGeometryRenderer(canvasRef.current, {
      sceneGraph: graph,
      onPick: (info) => callbacksRef.current.onPick(info),
      ...(reducedMotionOverride !== null
        ? { matchMediaFn: () => ({ matches: reducedMotionOverride }) }
        : {}),
    });
    if (!result.ok) {
      updateStatus("unavailable");
      callbacksRef.current.onHandleChange(null);
      return;
    }
    handleRef.current = result.value;
    updateStatus("ready");
    callbacksRef.current.onHandleChange(result.value);
    renderLegend(module3d, graph);
    const handle = result.value;
    return () => {
      handle.dispose();
      if (handleRef.current === handle) {
        handleRef.current = null;
      }
      callbacksRef.current.onHandleChange(null);
    };
    // Scene-graph inputs are applied by effect 3; this effect only owns the
    // renderer lifecycle.
  }, [module3d, reducedMotionOverride, updateStatus]);

  // 3. Rebuild + swap the scene graph when the math description changes.
  useEffect(() => {
    if (module3d === null || handleRef.current === null || status !== "ready") {
      return;
    }
    const graph = module3d.buildSceneGraph(
      { ...sceneInput, metadata },
      { planeOpacity },
    );
    handleRef.current.setScene(graph);
    renderLegend(module3d, graph);
  }, [module3d, status, sceneInput, metadata, planeOpacity]);

  // 4. Apply per-object visibility / opacity overlays.
  useEffect(() => {
    const handle = handleRef.current;
    if (handle === null || status !== "ready") {
      return;
    }
    for (const [id, isHidden] of Object.entries(hidden)) {
      handle.setObjectVisibility(id, !isHidden);
    }
    for (const [id, value] of Object.entries(opacity)) {
      handle.setObjectOpacity(id, value);
    }
  }, [hidden, opacity, status]);

  return (
    <div className={styles.viewport} data-testid="viewport3d" data-status={status}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={800}
        height={600}
        tabIndex={0}
        aria-label="3D vector geometry view. Use the toolbar buttons to change view, projection, or reset the camera."
      />
      {status === "loading" && (
        <p className={styles.overlay} role="status">
          正在加载三维视图…
        </p>
      )}
      {status === "unavailable" && (
        <p className={styles.overlay} role="alert">
          三维视图暂不可用（WebGL 缺失或被阻止）。下方完整文字结果仍可正常使用。
        </p>
      )}
      <div
        ref={legendRef}
        className={styles.legend}
        data-testid="legend"
        aria-label="Object legend"
      />
    </div>
  );
}
