import { z } from "zod";
import { calculateEstimatedAward } from "./estimate-engine";
import {
  calculateOfficialAward,
  componentVariantsForRoute,
  type AwardCatalog,
} from "./official-engine";
import { AwardCalculationInputSchema, type AwardCalculationResult } from "./schema";

export const MAX_AWARD_SHARE_LENGTH = 4096;
export const AWARD_SHARE_STORAGE_KEY = "exambridge:award-calculator:v1";

export const AwardShareStateSchema = z.strictObject({
  version: z.literal(1),
  input: AwardCalculationInputSchema,
  displayedSource: z.enum(["official", "estimated"]),
});

export type AwardShareState = z.infer<typeof AwardShareStateSchema>;
export type ResolvedSharedAward = { result: AwardCalculationResult; notice?: string };

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

const fromBase64Url = (value: string): Uint8Array => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
};

export function encodeAwardShareState(value: AwardShareState): string {
  const parsed = AwardShareStateSchema.parse(value);
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(parsed)));
  if (encoded.length > MAX_AWARD_SHARE_LENGTH) throw new RangeError("AWARD_SHARE_STATE_TOO_LARGE");
  return encoded;
}

export function decodeAwardShareState(value: string | null | undefined): AwardShareState | null {
  if (!value || value.length > MAX_AWARD_SHARE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(value));
    const parsed = AwardShareStateSchema.safeParse(JSON.parse(decoded) as unknown);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function getAwardShareParam(hash: string): string | null {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const queryIndex = normalized.indexOf("?");
  if (queryIndex === -1) return null;
  return new URLSearchParams(normalized.slice(queryIndex + 1)).get("award");
}

export function withAwardShareParam(hash: string, encoded: string): string {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const queryIndex = normalized.indexOf("?");
  const path = queryIndex === -1 ? (normalized || "/calculator") : normalized.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? "" : normalized.slice(queryIndex + 1));
  params.set("award", encoded);
  return `#${path}?${params.toString()}`;
}

export function readStoredAwardShare(storage: Pick<Storage, "getItem"> | undefined): string | null {
  if (!storage) return null;
  try {
    const encoded = storage.getItem(AWARD_SHARE_STORAGE_KEY);
    return decodeAwardShareState(encoded) ? encoded : null;
  } catch {
    return null;
  }
}

export function writeStoredAwardShare(storage: Pick<Storage, "setItem"> | undefined, encoded: string): void {
  if (!storage || !decodeAwardShareState(encoded)) return;
  try { storage.setItem(AWARD_SHARE_STORAGE_KEY, encoded); } catch { /* storage unavailable */ }
}

export function resolveSharedAward(stateValue: AwardShareState, catalog: AwardCatalog): ResolvedSharedAward {
  const state = AwardShareStateSchema.parse(stateValue);
  const route = catalog.getAwardRoute(state.input.routeId);
  if (!route) return { result: calculateOfficialAward(state.input, catalog) };
  const query = {
    routeId: route.id,
    series: state.input.series,
    optionCode: state.input.optionCode,
    componentVariants: componentVariantsForRoute(route),
  };
  if (catalog.findOfficialBoundary(query)) {
    return {
      result: calculateOfficialAward(state.input, catalog),
      ...(state.displayedSource === "estimated" ? { notice: "官方边界现已发布" } : {}),
    };
  }
  if (state.displayedSource === "estimated") return { result: calculateEstimatedAward(state.input, catalog) };
  return { result: calculateOfficialAward(state.input, catalog) };
}
