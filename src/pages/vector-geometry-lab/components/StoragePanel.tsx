/**
 * StoragePanel — named multi-scene persistence UI (spec §7). Purely
 * props-driven: the App owns the store hook; this component only renders
 * entries and forwards intents. All failure states arrive as structured
 * StoreError values and are shown, never thrown.
 */

import { useState } from "react";
import type { StoreError, StoredSceneEntry } from "../storage/scene-store.js";
import styles from "./storage.module.css";

export interface StoragePanelProps {
  readonly entries: readonly StoredSceneEntry[];
  readonly storeError: StoreError | null;
  /** Entries skipped while loading (individually corrupted payloads). */
  readonly droppedEntries: number;
  readonly onSave: (name: string) => void;
  readonly onLoad: (entry: StoredSceneEntry) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
}

export function StoragePanel(props: StoragePanelProps): React.JSX.Element {
  const { entries, storeError, droppedEntries, onSave, onLoad, onRename, onDelete } =
    props;
  const [saveName, setSaveName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const submitSave = (): void => {
    const name = saveName.trim();
    if (name === "") {
      return;
    }
    onSave(name);
    setSaveName("");
  };

  const submitRename = (id: string): void => {
    const name = renameValue.trim();
    if (name !== "") {
      onRename(id, name);
    }
    setRenamingId(null);
  };

  return (
    <section className={styles.storage} aria-label="Saved scenes">
      <h2 className={styles.heading}>已保存场景</h2>
      <div className={styles.saveRow}>
        <label className={styles.saveLabel}>
          <span className={styles.visuallyHidden}>Name for the current scene</span>
          <input
            type="text"
            value={saveName}
            placeholder="为当前场景命名…"
            aria-label="Name for the current scene"
            onChange={(event) => setSaveName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitSave();
              }
            }}
          />
        </label>
        <button
          type="button"
          aria-label="Save current scene"
          onClick={submitSave}
          disabled={saveName.trim() === ""}
        >
          保存当前场景
        </button>
      </div>

      {storeError !== null && (
        <p role="alert" className={styles.error}>
          {storeError.message} (code: {storeError.code})
        </p>
      )}
      {droppedEntries > 0 && (
        <p role="status" className={styles.warning}>
          {droppedEntries} stored {droppedEntries === 1 ? "entry was" : "entries were"}{" "}
          skipped because their scene data failed validation.
        </p>
      )}

      {entries.length === 0 ? (
        <p className={styles.empty}>尚未保存场景。</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.row}>
              {renamingId === entry.id ? (
                <span className={styles.renameRow}>
                  <input
                    type="text"
                    value={renameValue}
                    aria-label={`Rename ${entry.name}`}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        submitRename(entry.id);
                      }
                      if (event.key === "Escape") {
                        setRenamingId(null);
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label="OK"
                    onClick={() => submitRename(entry.id)}
                  >
                    确定
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel"
                    onClick={() => setRenamingId(null)}
                  >
                    取消
                  </button>
                </span>
              ) : (
                <>
                  <span className={styles.name} title={`Saved at ${entry.savedAt}`}>
                    {entry.name}
                  </span>
                  <span className={styles.actions}>
                    <button
                      type="button"
                      aria-label={`Load ${entry.name}`}
                      onClick={() => onLoad(entry)}
                    >
                      加载
                    </button>
                    <button
                      type="button"
                      aria-label={`Rename ${entry.name}`}
                      onClick={() => {
                        setRenamingId(entry.id);
                        setRenameValue(entry.name);
                      }}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${entry.name}`}
                      onClick={() => onDelete(entry.id)}
                    >
                      删除
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
