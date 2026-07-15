"use client";

import { HashRouter } from "react-router-dom";
import { useSyncExternalStore } from "react";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import "@/index.css";

export default function Home() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F0EDE8] text-[#625C54]" aria-label="正在加载 ExamBridge">
        <div className="text-center">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[#D9D4CE] border-t-[#675A4D]" />
          <p className="m-0 text-sm">正在加载 ExamBridge…</p>
        </div>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  );
}
