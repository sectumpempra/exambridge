/**
 * CoordinateInputs — controlled numeric inputs for every editable slot
 * (spec §6 坐标数值输入). Fractions ("3/2") and decimals are both accepted;
 * invalid literals flag the slot and surface a schema-level error without
 * crashing the lab.
 */

import type { CoordinateForm, EntitySlot } from "../state/lab-state.js";
import styles from "./coordinate-inputs.module.css";

export interface CoordinateInputsProps {
  readonly slots: readonly EntitySlot[];
  readonly form: CoordinateForm;
  readonly invalidSlots: readonly string[];
  readonly onChange: (slotKey: string, axis: "x" | "y" | "z", value: string) => void;
}

const AXES = ["x", "y", "z"] as const;

export function CoordinateInputs(props: CoordinateInputsProps): React.JSX.Element {
  const { slots, form, invalidSlots, onChange } = props;
  return (
    <div className={styles.groups}>
      {slots.map((slot) => {
        const value = form[slot.slotKey] ?? { x: "0", y: "0", z: "0" };
        const invalid = invalidSlots.includes(slot.slotKey);
        return (
          <fieldset
            key={slot.slotKey}
            className={invalid ? styles.slotInvalid : styles.slot}
            data-testid={`slot-${slot.slotKey}`}
          >
            <legend>
              {slot.entityLabel} — {slot.slotLabel}
            </legend>
            <div className={styles.axisRow}>
              {AXES.map((axis) => (
                <label key={axis} className={styles.axisLabel}>
                  <span>{axis}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={`${slot.entityLabel} ${slot.slotLabel} ${axis}`}
                    aria-invalid={invalid}
                    value={value[axis]}
                    onChange={(event) =>
                      onChange(slot.slotKey, axis, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
