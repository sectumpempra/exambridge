/**
 * Right panel (spec §6 右侧：坐标、方程和属性): the picked/selected
 * object's name, equation and key parameters; the coordinate editor; and
 * the plane-transparency slider (spec §6 滑块调整).
 */

import type { PickInfo, SceneEntityMeta } from "@/features/vector-geometry-lab/three";
import { CoordinateInputs } from "./CoordinateInputs.js";
import type { CoordinateForm, EntitySlot } from "../state/lab-state.js";
import styles from "./panels.module.css";

export interface PropertiesPanelProps {
  readonly picked: PickInfo | null;
  readonly selected: SceneEntityMeta | null;
  readonly slots: readonly EntitySlot[];
  readonly form: CoordinateForm;
  readonly invalidSlots: readonly string[];
  readonly onCoordinateChange: (
    slotKey: string,
    axis: "x" | "y" | "z",
    value: string,
  ) => void;
  readonly planeOpacity: number;
  readonly onPlaneOpacityChange: (opacity: number) => void;
}

export function PropertiesPanel(props: PropertiesPanelProps): React.JSX.Element {
  const {
    picked,
    selected,
    slots,
    form,
    invalidSlots,
    onCoordinateChange,
    planeOpacity,
    onPlaneOpacityChange,
  } = props;

  const detail = picked ?? selected;

  return (
    <div className={styles.panelSection}>
      <h2 className={styles.objectsHeading}>属性</h2>
      {detail === null ? (
        <p className={styles.hint}>
          点击三维视图中的对象，或从对象列表中选择，即可查看方程和关键参数。
        </p>
      ) : (
        <dl className={styles.detailList} data-testid="object-details">
          <dt>名称</dt>
          <dd>{detail.name}</dd>
          <dt>类型</dt>
          <dd>{detail.kind}</dd>
          <dt>方程</dt>
          <dd>
            {detail.equationText.length > 0 ? (
              <code>{detail.equationText}</code>
            ) : (
              "—"
            )}
          </dd>
          {Object.entries(detail.keyParams).map(([key, value]) => (
            <div key={key} className={styles.detailParam}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <label className={styles.sliderLabel}>
        平面透明度 ({Math.round(planeOpacity * 100)}%)
        <input
          type="range"
          min={10}
          max={90}
          value={Math.round(planeOpacity * 100)}
          onChange={(event) => onPlaneOpacityChange(Number(event.target.value) / 100)}
          aria-label="Plane surface opacity"
        />
      </label>

      <details className={styles.coordinateEditor} open>
        <summary>坐标编辑</summary>
        <CoordinateInputs
          slots={slots}
          form={form}
          invalidSlots={invalidSlots}
          onChange={onCoordinateChange}
        />
      </details>
    </div>
  );
}
