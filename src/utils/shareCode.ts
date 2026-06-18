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

/** Generate share URL by compressing config */
export function generateShareUrl(config: PlannerConfig): string {
  const json = JSON.stringify(config);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const url = new URL(window.location.href);
  url.searchParams.set("plan", compressed);
  return url.toString();
}

/** Parse config from URL */
export function parseShareUrl(url?: string): PlannerConfig | null {
  try {
    const u = new URL(url || window.location.href);
    const compressed = u.searchParams.get("plan");
    if (!compressed) return null;
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    return JSON.parse(json) as PlannerConfig;
  } catch {
    return null;
  }
}

/** Clear plan from URL */
export function clearPlanUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("plan");
  window.history.replaceState({}, "", url.toString());
}
