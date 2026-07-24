/**
 * ExamBridge Mechanics Lab V1 主站工作区。
 * 桌面：左工具栏｜中央画布｜右属性面板｜下方结果区。
 * 移动端（≤768px）：顶部工具栏｜中央画布｜底部抽屉。
 */
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { solveMechanicsScene } from "@/features/mechanics-lab/core";
import { UI_COPY_V1, type MechanicsSceneV1 } from "@/features/mechanics-lab/schema";
import {
  MechanicsCanvas,
  buildMotionTimeline,
  createEditorState,
  createPlayback,
  editorReducer,
  motionStateAt,
  playbackReducer,
  type PlaybackState,
} from "@/features/mechanics-lab/svg";
import { EXAMPLE_SCENES } from "./examples.js";
import { ExportBar } from "./ExportBar.js";
import { PlaybackBar } from "./PlaybackBar.js";
import { PropertyPanel } from "./PropertyPanel.js";
import { ResultsPanel } from "./ResultsPanel.js";
import { SceneSummary } from "./SceneSummary.js";
import { Toolbar } from "./Toolbar.js";
import { createEmptyScene } from "@/features/mechanics-lab/svg";
import { useReducedMotion } from "./useReducedMotion.js";

export function MechanicsLabWorkspace(): React.JSX.Element {
  const [state, dispatch] = useReducer(editorReducer, undefined, () =>
    createEditorState(EXAMPLE_SCENES[0]?.scene),
  );
  const [exampleId, setExampleId] = useState(EXAMPLE_SCENES[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [playback, dispatchPlayback] = useReducer(playbackReducer, 8, createPlayback);
  const reducedMotion = useReducedMotion();

  const solution = useMemo(() => {
    // 空白场景：不调用求解器，显示友好空态（schema 要求至少一个物体）
    if (state.scene.objects.length === 0) return null;
    try {
      return solveMechanicsScene(state.scene);
    } catch {
      return null;
    }
  }, [state.scene]);

  const timeline = useMemo(
    () => (solution !== null ? buildMotionTimeline(solution, state.scene) : null),
    [solution, state.scene],
  );

  // 时间线变化时复位播放状态
  useEffect(() => {
    dispatchPlayback({ type: "reset" });
  }, [timeline]);

  // requestAnimationFrame 播放循环（动画不反向参与求解：只推进 playback.time）
  useEffect(() => {
    if (!playback.playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      dispatchPlayback({ type: "tick", dt });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playback.playing]);

  const animatedPositions = useMemo(() => {
    if (timeline === null || reducedMotion) return undefined;
    const states = motionStateAt(timeline, playback.time);
    return new Map(states.map((s) => [s.objectId, s.position]));
  }, [timeline, playback.time, reducedMotion]);

  const handleLoadScene = useCallback((scene: MechanicsSceneV1) => {
    dispatch({ type: "replace-scene", scene });
    setExampleId("");
  }, []);

  const handleResetScene = useCallback(() => {
    dispatch({ type: "replace-scene", scene: createEmptyScene() });
    setExampleId("");
  }, []);

  // 消息自动淡出
  useEffect(() => {
    if (message === "") return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  const playbackValue: PlaybackState = timeline !== null && timeline.duration !== playback.duration
    ? { ...playback, duration: timeline.duration }
    : playback;

  return (
    <section className="mechanics-lab app" aria-label="二维力学实验室工作区">
      <header className="app-header">
        <h2>力学实验室 <span>二维受力、约束与恒加速度运动</span></h2>
        <label className="example-picker">
          示例场景：
          <select
            value={exampleId}
            onChange={(e) => {
              const ex = EXAMPLE_SCENES.find((x) => x.id === e.target.value);
              setExampleId(e.target.value);
              if (ex !== undefined) dispatch({ type: "replace-scene", scene: ex.scene });
            }}
          >
            <option value="">（自定义场景）</option>
            {EXAMPLE_SCENES.map((ex) => (
              <option key={ex.id} value={ex.id} title={ex.description}>
                {ex.title}
              </option>
            ))}
          </select>
        </label>
      </header>
      <ExportBar
        scene={state.scene}
        solution={solution}
        onLoadScene={handleLoadScene}
        onResetScene={handleResetScene}
        onMessage={setMessage}
      />
      <div className="message-bar" role="status" aria-live="polite">
        {message}
      </div>
      <div className="app-body">
        <Toolbar
          tool={state.tool}
          dispatch={dispatch}
          canUndo={state.past.length > 0}
          canRedo={state.future.length > 0}
          hasSelection={state.selection.length > 0}
        />
        <section className="canvas-area" aria-label="场景画布">
          <MechanicsCanvas
            state={state}
            dispatch={dispatch}
            ariaLabel="力学场景编辑画布"
            {...(animatedPositions !== undefined ? { animatedPositions } : {})}
          />
          <SceneSummary scene={state.scene} />
        </section>
        <div className={`drawer ${drawerOpen ? "open" : ""}`}>
          <button
            type="button"
            className="drawer-handle"
            aria-expanded={drawerOpen}
            aria-controls="drawer-body"
            onClick={() => setDrawerOpen((v) => !v)}
          >
            {drawerOpen ? "▾ 收起属性面板" : "▴ 属性面板"}
          </button>
          <div id="drawer-body" className="drawer-body">
            <PropertyPanel scene={state.scene} selection={state.selection} dispatch={dispatch} />
          </div>
        </div>
      </div>
      <section className="results-area" aria-label="分析结果">
        {timeline !== null && (
          <PlaybackBar
            timeline={timeline}
            playback={playbackValue}
            dispatch={dispatchPlayback}
            reducedMotion={reducedMotion}
          />
        )}
        {solution !== null ? (
          <ResultsPanel solution={solution} />
        ) : state.scene.objects.length === 0 ? (
          <p className="empty-hint">
            空白场景。使用左侧工具栏添加水平面、斜面、物体、滑轮、绳、杆与外力，或从右上角选择示例场景开始。
          </p>
        ) : (
          <p role="alert">求解器内部错误（不应发生；确定性求解器设计上不抛异常）。</p>
        )}
        <details className="unsupported-note">
          <summary>当前版本不支持的能力（{UI_COPY_V1.unsupportedCapabilities.length} 项）</summary>
          <ul>
            {UI_COPY_V1.unsupportedCapabilities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      </section>
    </section>
  );
}
