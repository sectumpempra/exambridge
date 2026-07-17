import LZString from "lz-string";
import { z } from "zod";
import type { PlannerConfig } from "../hooks/usePlanner";

const STORAGE_KEY = "planner_config";
const MAX_COMPRESSED_LENGTH = 50_000;
const MAX_JSON_LENGTH = 200_000;
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), "invalid date");
const VariantSchema = z.object({ code: z.string().min(1).max(80), component: z.string().min(1).max(80) });
const EventSchema = z.object({
  paperGroupId: z.string().min(1).max(240), board: z.string().min(1).max(80), level: z.string().min(1).max(80),
  subjectCode: z.string().min(1).max(80), qualificationId: z.string().min(1).max(160), paperLabel: z.string().min(1).max(160),
  paperName: z.string().min(1).max(240), examDate: DateSchema, variants: z.array(VariantSchema).min(1).max(20),
});
const PaperPlanSchema = z.object({
  paperGroupId: z.string().min(1).max(240), enabled: z.boolean(), targetSetsPerWeek: z.number().int().min(0).max(7),
  priority: z.enum(["low", "normal", "high"]), mode: z.enum(["timed", "untimed", "review"]),
  durationMinutes: z.number().int().min(10).max(300).optional(), reviewMinutes: z.number().int().min(0).max(180).optional(),
  allowedSeries: z.array(z.string().min(1).max(40)).max(20).optional(), allowedVariants: z.array(z.string().min(1).max(40)).max(30).optional(),
});
const PlannerConfigV2Schema = z.object({
  version: z.literal(2), startDate: DateSchema, restDays: z.array(z.number().int().min(0).max(6)).max(7),
  maxTasksPerDay: z.number().int().min(1).max(10), events: z.array(EventSchema).max(100), paperPlans: z.array(PaperPlanSchema).max(100),
}).superRefine((config, ctx) => {
  const eventIds = new Set(config.events.map((event) => event.paperGroupId));
  for (const plan of config.paperPlans) if (!eventIds.has(plan.paperGroupId)) ctx.addIssue({ code: "custom", message: "paper plan has no matching event" });
});
const LegacyPlannerConfigSchema = z.object({
  version: z.literal(1).optional(), startDate: DateSchema, restDays: z.array(z.number().int().min(0).max(6)).max(7),
  intensity: z.enum(["low", "normal", "high"]), paperOverrides: z.record(z.string(), z.string().max(240)).default({}),
  maxTasksPerDay: z.number().int().min(1).max(10).optional(), events: z.array(z.object({
    subjectCode: z.string().max(80), qualificationId: z.string().max(160), paperLabel: z.string().max(160), paperName: z.string().max(240),
    examDate: DateSchema, variants: z.array(VariantSchema).max(20), paperGroupId: z.string().max(240).optional(), board: z.string().max(80).optional(), level: z.string().max(80).optional(),
  })).max(100),
});

export function parsePlannerConfig(value: unknown): PlannerConfig | null {
  const v2 = PlannerConfigV2Schema.safeParse(value);
  if (v2.success) return v2.data;
  const legacy = LegacyPlannerConfigSchema.safeParse(value);
  if (!legacy.success) return null;
  return {
    ...legacy.data,
    events: legacy.data.events.map((event) => ({
      ...event,
      paperGroupId: event.paperGroupId ?? event.paperName,
      board: event.board ?? event.qualificationId.split("-")[0] ?? "Unknown",
      level: event.level ?? "A-Level",
    })),
  } as PlannerConfig;
}

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
    if (raw.length > MAX_JSON_LENGTH) return null;
    return parsePlannerConfig(JSON.parse(raw));
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
  if (compressed.length > MAX_COMPRESSED_LENGTH) throw new Error("规划内容过大，无法生成安全分享链接");
  const hash = window.location.hash || "#/planner";
  const hashPath = hash.split("?")[0].replace(/^#/, "") || "/planner";
  const params = new URLSearchParams(hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "");
  params.set("plan", compressed);
  return `${window.location.origin}${window.location.pathname}#${hashPath}?${params.toString()}`;
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
    if (!compressed || compressed.length > MAX_COMPRESSED_LENGTH) return null;
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json || json.length > MAX_JSON_LENGTH) return null;
    return parsePlannerConfig(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Clear plan from URL (HashRouter safe) */
export function clearPlanUrl(): void {
  const hash = window.location.hash || "";
  const qIdx = hash.indexOf("?");
  if (qIdx === -1) return;
  const params = new URLSearchParams(hash.slice(qIdx + 1));
  params.delete("plan");
  const nextHash = `${hash.slice(0, qIdx)}${params.size ? `?${params.toString()}` : ""}`;
  window.history.replaceState({}, "", `${window.location.origin}${window.location.pathname}${nextHash}`);
}
