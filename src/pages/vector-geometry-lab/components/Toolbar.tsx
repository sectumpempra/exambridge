/**
 * Toolbar — view presets, camera reset, projection toggle and the
 * reduced-motion switch (spec §6 交互). Commands go to the renderer handle;
 * every control is a real <button>, so the whole toolbar is keyboard
 * operable.
 */

import type { CameraView, ProjectionMode } from "@/features/vector-geometry-lab/three";
import styles from "./toolbar.module.css";

export interface ToolbarProps {
  readonly view: CameraView;
  readonly projection: ProjectionMode;
  readonly viewportReady: boolean;
  readonly reducedMotion: boolean;
  readonly onSetView: (view: CameraView) => void;
  readonly onResetCamera: () => void;
  readonly onSetProjection: (projection: ProjectionMode) => void;
  readonly onToggleReducedMotion: () => void;
}

const VIEWS: readonly { id: CameraView; label: string; ariaLabel: string }[] = [
  { id: "front", label: "前视图", ariaLabel: "Front" },
  { id: "top", label: "俯视图", ariaLabel: "Top" },
  { id: "side", label: "侧视图", ariaLabel: "Side" },
  { id: "isometric", label: "等轴视图", ariaLabel: "Isometric" },
];

export function Toolbar(props: ToolbarProps): React.JSX.Element {
  const {
    view,
    projection,
    viewportReady,
    reducedMotion,
    onSetView,
    onResetCamera,
    onSetProjection,
    onToggleReducedMotion,
  } = props;
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="3D view controls">
      {VIEWS.map(({ id, label, ariaLabel }) => (
        <button
          key={id}
          type="button"
          className={styles.button}
          aria-pressed={view === id}
          aria-label={ariaLabel}
          disabled={!viewportReady}
          onClick={() => onSetView(id)}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        className={styles.button}
        disabled={!viewportReady}
        aria-label="Reset camera"
        onClick={onResetCamera}
      >
        重置视角
      </button>
      <button
        type="button"
        className={styles.button}
        aria-pressed={projection === "orthographic"}
        aria-label={projection === "perspective" ? "Perspective" : "Orthographic"}
        disabled={!viewportReady}
        onClick={() =>
          onSetProjection(
            projection === "perspective" ? "orthographic" : "perspective",
          )
        }
      >
        {projection === "perspective" ? "透视投影" : "正交投影"}
      </button>
      <button
        type="button"
        className={styles.button}
        aria-pressed={reducedMotion}
        aria-label="Reduce motion"
        onClick={onToggleReducedMotion}
        title="Disable camera damping and auto-rotation"
      >
        减少动画
      </button>
    </div>
  );
}
