import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export default function PWAUpdateHandler() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production" ||
      import.meta.env.VITE_DISABLE_PWA === "true"
    ) return;

    let active = true;
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => {
      if (!active) return;
      if (registration.waiting) setWaitingWorker(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(worker);
          }
        });
      });
      void registration.update();
    }).catch((error) => console.warn("Service worker registration failed", error));

    let alreadyControlled = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (alreadyControlled) window.location.reload();
      else alreadyControlled = true;
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const update = useCallback(() => {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }, [waitingWorker]);

  if (!waitingWorker || dismissed) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-[#2C3E50] to-[#3D566E] p-4 shadow-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F39C12]/20">
          <RefreshCw size={20} className="text-[#F39C12]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-white">发现新版本</p>
          <p className="m-0 mt-0.5 text-xs text-white/70">刷新页面以获取最新内容</p>
        </div>
        <button type="button" onClick={update} className="rounded-lg bg-[#F39C12] px-3 py-2 text-xs font-semibold text-white hover:bg-[#E67E22]">立即刷新</button>
        <button type="button" onClick={() => setDismissed(true)} aria-label="关闭更新提示" className="rounded-lg p-1.5 text-white/60 hover:text-white"><X size={16} /></button>
      </div>
    </div>
  );
}
