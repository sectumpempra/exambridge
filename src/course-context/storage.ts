import { CourseContextSchema, StoredCourseContextSchema, type CourseContext, type StoredCourseContext } from "./types";
import { getCourseEntry } from "./catalog";

export const COURSE_CONTEXT_STORAGE_KEY = "exambridge.course-context.v1";

export function parseContextFromSearch(search: string): CourseContext | null {
  const params = new URLSearchParams(search);
  const course = params.get("course");
  if (!course) return null;
  const parsed = CourseContextSchema.safeParse({
    qualificationId: course,
    specificationId: params.get("spec") || undefined,
  });
  if (!parsed.success || !getCourseEntry(parsed.data)) return null;
  return parsed.data;
}

export function readStoredContext(storage: Pick<Storage, "getItem"> | undefined): StoredCourseContext | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(COURSE_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    const parsed = StoredCourseContextSchema.safeParse(value);
    if (parsed.success && getCourseEntry(parsed.data.current)) {
      return { ...parsed.data, recent: parsed.data.recent.filter((item) => Boolean(getCourseEntry(item))) };
    }
    // Early private builds stored the same context without a recent list.
    if (value && typeof value === "object" && (value as { version?: unknown }).version === 0) {
      const legacy = CourseContextSchema.safeParse((value as { current?: unknown }).current);
      if (legacy.success && getCourseEntry(legacy.data)) return { version: 1, current: legacy.data, recent: [legacy.data] };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildStoredContext(current: CourseContext, previous: StoredCourseContext | null): StoredCourseContext {
  const recent = [current, ...(previous?.recent ?? [])]
    .filter((item) => Boolean(getCourseEntry(item)))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.qualificationId === item.qualificationId && candidate.specificationId === item.specificationId) === index)
    .slice(0, 5);
  return { version: 1, current, recent };
}

export function writeStoredContext(storage: Pick<Storage, "setItem"> | undefined, value: StoredCourseContext): void {
  if (!storage) return;
  try { storage.setItem(COURSE_CONTEXT_STORAGE_KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
