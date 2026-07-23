/**
 * 恒加速度动画播放条（规格书第十节）。
 * 只消费 buildMotionTimeline/motionStateAt 的确定性结果；动画不反向参与求解。
 * prefers-reduced-motion：显示静态位置与数值摘要，不播放动画。
 */
import {
  motionStateAt,
  type MotionObjectState,
  type MotionTimeline,
  type PlaybackAction,
  type PlaybackSpeed,
  type PlaybackState,
} from "@/features/mechanics-lab/svg";

export interface PlaybackBarProps {
  timeline: MotionTimeline;
  playback: PlaybackState;
  dispatch: (a: PlaybackAction) => void;
  reducedMotion: boolean;
}

const SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 1, 2];

const fmt = (v: number): string => v.toFixed(3);

function ObjectStateRow({ s }: { s: MotionObjectState }): React.JSX.Element {
  return (
    <tr>
      <td>{s.objectId}</td>
      <td>{fmt(s.displacementAlongPath)} m</td>
      <td>{fmt(s.velocityAlongPath)} m/s</td>
      <td>{fmt(s.accelerationAlongPath)} m/s²</td>
    </tr>
  );
}

export function PlaybackBar({ timeline, playback, dispatch, reducedMotion }: PlaybackBarProps): React.JSX.Element {
  const states = motionStateAt(timeline, playback.time);

  if (reducedMotion) {
    return (
      <section className="playback reduced" aria-label="运动摘要（减少动画模式）">
        <h3>恒加速度运动摘要（已开启减少动画，显示静态数值）</h3>
        <table className="motion-table">
          <thead>
            <tr><th>物体</th><th>加速度</th><th>初速度</th><th>运动函数</th></tr>
          </thead>
          <tbody>
            {timeline.objects.map((o) => (
              <tr key={o.objectId}>
                <td>{o.objectId}</td>
                <td>{fmt(o.accelerationAlongPath)} m/s²</td>
                <td>{fmt(o.initialVelocityAlongPath)} m/s</td>
                <td>
                  v(t)={fmt(o.initialVelocityAlongPath)}+({fmt(o.accelerationAlongPath)})t；s(t)={fmt(o.initialVelocityAlongPath)}t+½({fmt(o.accelerationAlongPath)})t²
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  return (
    <section className="playback" aria-label="恒加速度动画">
      <div className="playback-controls" role="group" aria-label="动画控制">
        <button type="button" onClick={() => dispatch({ type: "toggle" })} aria-label={playback.playing ? "暂停" : "播放"}>
          {playback.playing ? "⏸ 暂停" : "▶ 播放"}
        </button>
        <button type="button" onClick={() => dispatch({ type: "step" })} disabled={playback.playing}>
          单步
        </button>
        <button type="button" onClick={() => dispatch({ type: "reset" })}>复位</button>
        <label>
          速度
          <select
            value={playback.speed}
            onChange={(e) => dispatch({ type: "set-speed", speed: Number(e.target.value) as PlaybackSpeed })}
            aria-label="播放速度"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <label className="time-slider">
          时间
          <input
            type="range"
            min={0}
            max={timeline.duration}
            step={0.01}
            value={playback.time}
            onChange={(e) => dispatch({ type: "seek", time: Number(e.target.value) })}
            aria-label="时间滑块"
          />
          <span>{playback.time.toFixed(2)} / {timeline.duration.toFixed(1)} s</span>
        </label>
      </div>
      <table className="motion-table" aria-label="位移速度加速度实时数值">
        <thead>
          <tr><th>物体</th><th>位移 s</th><th>速度 v</th><th>加速度 a</th></tr>
        </thead>
        <tbody>
          {states.map((s) => (
            <ObjectStateRow key={s.objectId} s={s} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
