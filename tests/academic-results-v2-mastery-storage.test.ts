import { describe, expect, it } from "vitest";
import {
  deleteMasteryProfile,
  exportMasteryProfile,
  importMasteryProfile,
  loadMasteryProfile,
  MASTERY_STORAGE_KEY,
  saveMasteryProfile,
} from "@/domain-v2/academic-results";

const profile = {
  schemaVersion: "1.0.0" as const,
  profileVersion: 1 as const,
  knowledgeBatchId: "knowledge-v5-test",
  sourceQualificationVersionId: "source:1",
  sourceRouteId: "source-route",
  targetQualificationVersionId: "target:1",
  targetRouteId: "target-route",
  mastery: [{ nodeId: "ALG-TEST", level: "basic" as const }],
  updatedAt: "2026-07-21T12:00:00.000Z",
};

describe("mastery profile local storage", () => {
  it("round-trips a versioned anonymous profile", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    saveMasteryProfile(storage, profile);
    expect(loadMasteryProfile(storage)).toEqual(profile);
    expect(importMasteryProfile(exportMasteryProfile(profile))).toEqual(profile);
    deleteMasteryProfile(storage);
    expect(values.has(MASTERY_STORAGE_KEY)).toBe(false);
  });

  it("rejects damaged, unknown, duplicated, and oversized profiles", () => {
    expect(loadMasteryProfile({ getItem: () => "not-json" })).toBeNull();
    expect(() => importMasteryProfile(JSON.stringify({ ...profile, profileVersion: 2 }))).toThrow();
    expect(() => importMasteryProfile(JSON.stringify({ ...profile, mastery: [profile.mastery[0], profile.mastery[0]] }))).toThrow();
    expect(() => importMasteryProfile("x".repeat(250_001))).toThrowError("MASTERY_IMPORT_TOO_LARGE");
  });
});
