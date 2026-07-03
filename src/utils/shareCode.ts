import LZString from "lz-string";
import type { PlannerConfig } from "../hooks/usePlanner";

const STORAGE_KEY = "planner_config";

/** Save config to localStorage */
export function saveToLocal(config: PlannerConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/** Load config from localStorage */
export function loadFromLocal(): PlannerConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlannerConfig;
  } catch {
    return null;
  }
}

/** Generate share URL by compressing config.
 *  HashRouter safe: uses hash fragment for query params.
 */
export function generateShareUrl(config: PlannerConfig): string {
  const json = JSON.stringify(config);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const hash = window.location.hash || "#/planner";
  const path = hash.split("?")[0]; // preserve hash path only
  return `${window.location.origin}${window.location.pathname}#${path}?plan=${compressed}`;
}

/** Parse config from URL (HashRouter safe).
 *  Looks for ?plan=... inside the hash fragment.
 */
export function parseShareUrl(url?: string): PlannerConfig | null {
  try {
    const hash = url ? new URL(url).hash : window.location.hash;
    const qIdx = hash.indexOf("?");
    if (qIdx === -1) return null;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const compressed = params.get("plan");
    if (!compressed) return null;
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    return JSON.parse(json) as PlannerConfig;
  } catch {
    return null;
  }
}

/** Clear plan from URL (HashRouter safe) */
export function clearPlanUrl(): void {
  const hash = window.location.hash || "";
  const qIdx = hash.indexOf("?");
  if (qIdx === -1) return;
  window.history.replaceState(
    {},
    "",
    `${window.location.origin}${window.location.pathname}${hash.slice(0, qIdx)}`
  );
}
