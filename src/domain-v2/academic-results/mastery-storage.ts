import { StudentMasteryProfileV1Schema, type StudentMasteryProfileV1 } from "./schema";

export const MASTERY_STORAGE_KEY = "exambridge:transition-mastery:v1";

export function loadMasteryProfile(storage: Pick<Storage, "getItem"> | undefined): StudentMasteryProfileV1 | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(MASTERY_STORAGE_KEY);
    if (!value || value.length > 250_000) return null;
    return StudentMasteryProfileV1Schema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

export function saveMasteryProfile(storage: Pick<Storage, "setItem"> | undefined, value: unknown): StudentMasteryProfileV1 {
  const profile = StudentMasteryProfileV1Schema.parse(value);
  storage?.setItem(MASTERY_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export function deleteMasteryProfile(storage: Pick<Storage, "removeItem"> | undefined) {
  storage?.removeItem(MASTERY_STORAGE_KEY);
}

export function exportMasteryProfile(value: unknown): string {
  return `${JSON.stringify(StudentMasteryProfileV1Schema.parse(value), null, 2)}\n`;
}

export function importMasteryProfile(value: string): StudentMasteryProfileV1 {
  if (value.length > 250_000) throw new Error("MASTERY_IMPORT_TOO_LARGE");
  return StudentMasteryProfileV1Schema.parse(JSON.parse(value));
}
