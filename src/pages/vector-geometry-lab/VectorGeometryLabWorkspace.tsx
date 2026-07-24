/**
 * App — the lab shell. Data flow (one direction only):
 *
 *   user input / built-in example
 *     → lab-state (zod parse via schema; invalid input → error, keep last good)
 *     → core solvers (run-analysis) — the ONLY source of mathematical truth
 *     → ① explain models → ResultsPanel (text/table, always available)
 *       ② buildSceneGraph → lazily-loaded 3d renderer (display only)
 *
 * The 3d viewport degrades to "unavailable" without WebGL; the text results
 * never depend on it.
 */

import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import type {
  BuildSceneGraphInput,
  CameraView,
  CapturePixelRatio,
  ProjectionMode,
  RendererHandle,
} from "@/features/vector-geometry-lab/three";
import { ExamplePicker } from "./components/ExamplePicker.js";
import { ExportPanel } from "./components/ExportPanel.js";
import { PropertiesPanel } from "./components/PropertiesPanel.js";
import { ResultsPanel } from "./components/ResultsPanel.js";
import { StoragePanel } from "./components/StoragePanel.js";
import { Toolbar } from "./components/Toolbar.js";
import { Viewport3D } from "./components/Viewport3D.js";
import { DEFAULT_EXAMPLE_ID, getExample } from "./examples/builtin-examples.js";
import { buildEntityMetadata } from "./analysis/scene-facts.js";
import { entitySlots, initialLabState, labReducer } from "./state/lab-state.js";
import {
  clearStore,
  deleteScene,
  emptyEnvelope,
  loadStore,
  renameScene,
  saveScene,
} from "./storage/scene-store.js";
import type {
  LoadOutcome,
  StorageLike,
  StoreError,
} from "./storage/scene-store.js";
import type { DownloadDeps } from "./export/download.js";
import type { ThreeLoader } from "./three/loader.js";
import styles from "./app.module.css";

function systemPrefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

function defaultStorage(): StorageLike | null {
  try {
    if (
      typeof window !== "undefined" &&
      window.localStorage !== undefined
    ) {
      // Probe: some environments expose localStorage but throw on access.
      const probe = "__exambridge_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {
    // fall through: storage unavailable
  }
  return null;
}

export interface VectorGeometryLabWorkspaceProps {
  readonly loader?: ThreeLoader;
  /** Injectable storage (tests); defaults to window.localStorage. */
  readonly storage?: StorageLike | null;
  readonly downloadDeps?: DownloadDeps;
  readonly printFn?: () => void;
  readonly confirmFn?: (message: string) => boolean;
  readonly nowFn?: () => string;
}

export function VectorGeometryLabWorkspace(
  props: VectorGeometryLabWorkspaceProps,
): React.JSX.Element {
  const [state, dispatch] = useReducer(
    labReducer,
    DEFAULT_EXAMPLE_ID,
    initialLabState,
  );
  const handleRef = useRef<RendererHandle | null>(null);
  const systemReduced = useMemo(() => systemPrefersReducedMotion(), []);
  const reducedMotionEffective = state.reducedMotionOverride ?? systemReduced;

  /* ---------------- Scene store (Stage 7) ---------------- */
  const storage = useMemo(
    () => (props.storage === undefined ? defaultStorage() : props.storage),
    [props.storage],
  );
  const initialStore = useMemo(() => {
    if (storage === null) {
      return {
        data: {
          envelope: emptyEnvelope(),
          droppedEntries: 0,
        } satisfies LoadOutcome,
        error: {
          code: "storage-unavailable",
          message:
            "localStorage is unavailable in this browser — saving scenes is disabled, everything else still works.",
        } satisfies StoreError,
      };
    }
    const loaded = loadStore(storage);
    return loaded.ok
      ? { data: loaded.value, error: null }
      : {
          data: {
            envelope: emptyEnvelope(),
            droppedEntries: 0,
          } satisfies LoadOutcome,
          error: loaded.error,
        };
  }, [storage]);
  const [storeData, setStoreData] = useState<LoadOutcome>(initialStore.data);
  const [storeError, setStoreError] = useState<StoreError | null>(
    initialStore.error,
  );

  const refreshStore = useCallback((): void => {
    if (storage === null) {
      setStoreError({
        code: "storage-unavailable",
        message:
          "localStorage is unavailable in this browser — saving scenes is disabled, everything else still works.",
      });
      return;
    }
    const loaded = loadStore(storage);
    if (loaded.ok) {
      setStoreData(loaded.value);
      setStoreError(null);
    } else {
      // Structured refusal: corrupted data stays on disk, the lab keeps
      // running on its current in-memory state.
      setStoreError(loaded.error);
    }
  }, [storage]);

  const runStoreOp = useCallback(
    (op: () => { readonly ok: boolean; readonly error?: StoreError }): void => {
      const result = op();
      if (result.ok) {
        refreshStore();
      } else if (result.error !== undefined) {
        setStoreError(result.error);
      }
    },
    [refreshStore],
  );

  const store = useMemo(
    () => ({
      entries: storeData.envelope.scenes,
      droppedEntries: storeData.droppedEntries,
      error: storeError,
      save: (name: string): void =>
        runStoreOp(() =>
          storage === null
            ? { ok: false, error: { code: "storage-unavailable" as const, message: "localStorage unavailable." } }
            : saveScene(storage, {
                name,
                exampleId: state.exampleId,
                scene: state.scene,
              }),
        ),
      rename: (id: string, name: string): void =>
        runStoreOp(() =>
          storage === null
            ? { ok: false, error: { code: "storage-unavailable" as const, message: "localStorage unavailable." } }
            : renameScene(storage, id, name),
        ),
      remove: (id: string): void =>
        runStoreOp(() =>
          storage === null
            ? { ok: false, error: { code: "storage-unavailable" as const, message: "localStorage unavailable." } }
            : deleteScene(storage, id),
        ),
      clear: (): void =>
        runStoreOp(() =>
          storage === null
            ? { ok: false, error: { code: "storage-unavailable" as const, message: "localStorage unavailable." } }
            : clearStore(storage),
        ),
    }),
    [storeData, storeError, runStoreOp, storage, state.exampleId, state.scene],
  );

  /* ---------------- Derived scene/analysis payloads ---------------- */
  const entityMetadata = useMemo(
    () => buildEntityMetadata(state.scene),
    [state.scene],
  );
  const sceneInput = useMemo<BuildSceneGraphInput>(
    () => ({
      points: state.scene.points,
      vectors: state.scene.vectors,
      lines: state.scene.lines,
      planes: state.scene.planes,
      displayGeometry: state.analysis.displayGeometry,
    }),
    [state.scene, state.analysis],
  );
  const pickMetadata = useMemo(
    () => [...entityMetadata, ...state.analysis.displayMetadata],
    [entityMetadata, state.analysis],
  );
  const slots = useMemo(() => entitySlots(state.scene), [state.scene]);
  const selected =
    state.selectedEntityId === null
      ? null
      : (entityMetadata.find((meta) => meta.id === state.selectedEntityId) ?? null);

  const exampleSummary = getExample(state.exampleId)?.summary;

  const setView = (view: CameraView): void => {
    handleRef.current?.setView(view);
    dispatch({ type: "set-view", view });
  };
  const resetCamera = (): void => {
    handleRef.current?.resetCamera();
    dispatch({ type: "set-view", view: "isometric" });
  };
  const setProjection = (projection: ProjectionMode): void => {
    handleRef.current?.setProjection(projection);
    dispatch({ type: "set-projection", projection });
  };
  const toggleReducedMotion = (): void => {
    dispatch({ type: "set-reduced-motion", value: !reducedMotionEffective });
  };

  const capturePng = useCallback(
    (ratio: CapturePixelRatio) => {
      const handle = handleRef.current;
      if (handle === null) {
        return {
          ok: false as const,
          error: {
            code: "capture-failed" as const,
            message:
              "三维视图尚未就绪，因此目前没有可导出的画面。",
          },
        };
      }
      return handle.capturePng({ pixelRatio: ratio });
    },
    [],
  );

  const resetLab = (): void => {
    store.clear();
    dispatch({ type: "reset-lab" });
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Vector Geometry Lab V1</h1>
        <p className={styles.tagline}>
          向量、距离、夹角、直线与平面的确定性计算和三维核验。{exampleSummary}
        </p>
      </header>

      <main className={styles.mainGrid}>
        <aside className={styles.leftPanel} aria-label="示例与对象">
          <ExamplePicker
            exampleId={state.exampleId}
            onSelect={(exampleId) => dispatch({ type: "select-example", exampleId })}
            objects={entityMetadata}
            hidden={state.hidden}
            opacity={state.opacity}
            selectedEntityId={state.selectedEntityId}
            onToggleHidden={(id) => dispatch({ type: "toggle-hidden", id })}
            onOpacityChange={(id, opacity) =>
              dispatch({ type: "set-opacity", id, opacity })
            }
            onSelectEntity={(id) => dispatch({ type: "select-entity", id })}
          />
          <StoragePanel
            entries={store.entries}
            storeError={store.error}
            droppedEntries={store.droppedEntries}
            onSave={(name) => store.save(name)}
            onLoad={(entry) =>
              dispatch({
                type: "load-scene",
                exampleId: entry.exampleId,
                scene: entry.scene,
              })
            }
            onRename={(id, name) => store.rename(id, name)}
            onDelete={(id) => store.remove(id)}
          />
        </aside>

        <section className={styles.centerPanel} aria-label="三维视图">
          <Toolbar
            view={state.view}
            projection={state.projection}
            viewportReady={state.viewportStatus === "ready"}
            reducedMotion={reducedMotionEffective}
            onSetView={setView}
            onResetCamera={resetCamera}
            onSetProjection={setProjection}
            onToggleReducedMotion={toggleReducedMotion}
          />
          <Viewport3D
            sceneInput={sceneInput}
            metadata={pickMetadata}
            planeOpacity={state.planeOpacity}
            hidden={state.hidden}
            opacity={state.opacity}
            reducedMotionOverride={state.reducedMotionOverride}
            onPick={(info) => dispatch({ type: "picked", info })}
            onHandleChange={(handle) => {
              handleRef.current = handle;
            }}
            onStatusChange={(status) =>
              dispatch({ type: "set-viewport-status", status })
            }
            {...(props.loader !== undefined ? { loader: props.loader } : {})}
          />
        </section>

        <aside className={styles.rightPanel} aria-label="属性与坐标">
          <details className={styles.mobileDrawer} open>
            <summary>属性与坐标</summary>
            <PropertiesPanel
              picked={state.picked}
              selected={selected}
              slots={slots}
              form={state.form}
              invalidSlots={state.invalidSlots}
              onCoordinateChange={(slotKey, axis, value) =>
                dispatch({ type: "set-coordinate", slotKey, axis, value })
              }
              planeOpacity={state.planeOpacity}
              onPlaneOpacityChange={(opacity) =>
                dispatch({ type: "set-plane-opacity", opacity })
              }
            />
          </details>
        </aside>

        <section className={styles.bottomPanel}>
          <div className={styles.noPrint}>
            <ExportPanel
              scene={state.scene}
              sceneTitle={state.scene.title}
              models={state.analysis.models}
              viewportReady={state.viewportStatus === "ready"}
              capturePng={capturePng}
              onImportScene={(imported) =>
                dispatch({
                  type: "load-scene",
                  exampleId: imported.exampleId,
                  scene: imported.scene,
                })
              }
              onResetLab={resetLab}
              {...(props.downloadDeps !== undefined
                ? { downloadDeps: props.downloadDeps }
                : {})}
              {...(props.printFn !== undefined ? { printFn: props.printFn } : {})}
              {...(props.confirmFn !== undefined
                ? { confirmFn: props.confirmFn }
                : {})}
              {...(props.nowFn !== undefined ? { nowFn: props.nowFn } : {})}
            />
          </div>
          <ResultsPanel models={state.analysis.models} inputError={state.inputError} />
        </section>
      </main>
    </div>
  );
}
