/**
 * Left panel (spec §6 左侧：对象与分析类型): the built-in example picker
 * plus the object list with per-object visibility checkboxes and opacity
 * sliders — all plain buttons/inputs, fully keyboard-operable.
 */

import { BUILTIN_EXAMPLES } from "../examples/builtin-examples.js";
import type { SceneEntityMeta } from "@/features/vector-geometry-lab/three";
import styles from "./panels.module.css";

export interface ExamplePickerProps {
  readonly exampleId: string;
  readonly onSelect: (exampleId: string) => void;
  readonly objects: readonly SceneEntityMeta[];
  readonly hidden: Readonly<Record<string, boolean>>;
  readonly opacity: Readonly<Record<string, number>>;
  readonly selectedEntityId: string | null;
  readonly onToggleHidden: (id: string) => void;
  readonly onOpacityChange: (id: string, opacity: number) => void;
  readonly onSelectEntity: (id: string | null) => void;
}

export function ExamplePicker(props: ExamplePickerProps): React.JSX.Element {
  const {
    exampleId,
    onSelect,
    objects,
    hidden,
    opacity,
    selectedEntityId,
    onToggleHidden,
    onOpacityChange,
    onSelectEntity,
  } = props;
  const current = BUILTIN_EXAMPLES.find((example) => example.id === exampleId);

  return (
    <div className={styles.panelSection}>
      <label className={styles.selectLabel}>
        内置示例
        <select
          value={exampleId}
          onChange={(event) => onSelect(event.target.value)}
          aria-label="Built-in example"
        >
          {BUILTIN_EXAMPLES.map((example) => (
            <option key={example.id} value={example.id}>
              {example.title}
            </option>
          ))}
        </select>
      </label>
      {current !== undefined && (
        <p className={styles.exampleSummary}>{current.summary}</p>
      )}

      <h2 className={styles.objectsHeading}>场景对象</h2>
      {objects.length === 0 && <p>当前场景没有对象。</p>}
      <ul className={styles.objectList}>
        {objects.map((object) => {
          const isHidden = hidden[object.id] === true;
          const opacityPercent = Math.round((opacity[object.id] ?? 1) * 100);
          return (
            <li
              key={object.id}
              className={
                selectedEntityId === object.id
                  ? styles.objectRowSelected
                  : styles.objectRow
              }
            >
              <button
                type="button"
                className={styles.objectName}
                aria-pressed={selectedEntityId === object.id}
                onClick={() =>
                  onSelectEntity(selectedEntityId === object.id ? null : object.id)
                }
                title={`${object.name} (${object.kind})`}
              >
                {object.name}
              </button>
              <label className={styles.visibilityLabel}>
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => onToggleHidden(object.id)}
                  aria-label={`Show ${object.name}`}
                />
                显示
              </label>
              <label className={styles.opacityLabel}>
                <span>透明度</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacityPercent}
                  onChange={(event) =>
                    onOpacityChange(object.id, Number(event.target.value) / 100)
                  }
                  aria-label={`Opacity of ${object.name}`}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
