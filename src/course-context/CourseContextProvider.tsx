import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { getCourseEntry } from "./catalog";
import { buildStoredContext, parseContextFromSearch, readStoredContext, writeStoredContext } from "./storage";
import type { CourseContext, CourseContextEntry, StoredCourseContext } from "./types";

type CourseContextValue = {
  context: CourseContext | null;
  entry: CourseContextEntry | undefined;
  recent: CourseContext[];
  setCourse: (context: CourseContext) => void;
  clearCourse: () => void;
};

const Context = createContext<CourseContextValue | null>(null);

export function CourseContextProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStored = useMemo(() => readStoredContext(typeof window === "undefined" ? undefined : window.localStorage), []);
  const [context, setContext] = useState<CourseContext | null>(() => parseContextFromSearch(location.search) ?? initialStored?.current ?? null);
  const [stored, setStored] = useState<StoredCourseContext | null>(initialStored);

  useEffect(() => {
    const fromUrl = parseContextFromSearch(location.search);
    if (!fromUrl) return;
    queueMicrotask(() => setContext((current) => current?.qualificationId === fromUrl.qualificationId && current.specificationId === fromUrl.specificationId ? current : fromUrl));
  }, [location.search]);

  const persist = useCallback((next: CourseContext) => {
    const value = buildStoredContext(next, stored);
    setStored(value);
    writeStoredContext(typeof window === "undefined" ? undefined : window.localStorage, value);
  }, [stored]);

  const setCourse = useCallback((next: CourseContext) => {
    if (!getCourseEntry(next)) return;
    setContext(next);
    persist(next);
    const params = new URLSearchParams(searchParams);
    params.set("course", next.qualificationId);
    if (next.specificationId) params.set("spec", next.specificationId); else params.delete("spec");
    setSearchParams(params);
  }, [persist, searchParams, setSearchParams]);

  const clearCourse = useCallback(() => {
    setContext(null);
    const params = new URLSearchParams(searchParams);
    params.delete("course"); params.delete("spec");
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const value = useMemo<CourseContextValue>(() => ({
    context,
    entry: getCourseEntry(context),
    recent: stored?.recent ?? [],
    setCourse,
    clearCourse,
  }), [context, stored, setCourse, clearCourse]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCourseContext(): CourseContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useCourseContext must be used inside CourseContextProvider");
  return value;
}
