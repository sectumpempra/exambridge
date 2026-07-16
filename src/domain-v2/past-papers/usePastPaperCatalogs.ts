import { useEffect, useMemo, useState } from "react";
import { loadPastPaperCatalog } from "./catalog";
import type { PastPaperCatalog } from "./schema";

export function usePastPaperCatalogs(keys: readonly (string | undefined)[]) {
  const signature = keys.filter((key): key is string => Boolean(key)).sort().join("|");
  const stableKeys = useMemo(() => signature ? signature.split("|") : [], [signature]);
  const [state, setState] = useState<{ signature: string; catalogs: Map<string, PastPaperCatalog>; error?: string }>({
    signature: "",
    catalogs: new Map(),
  });

  useEffect(() => {
    let cancelled = false;
    if (stableKeys.length === 0) return () => { cancelled = true; };
    Promise.all(stableKeys.map(async (key) => [key, await loadPastPaperCatalog(key)] as const))
      .then((entries) => {
        if (!cancelled) setState({ signature, catalogs: new Map(entries) });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ signature, catalogs: new Map(), error: error instanceof Error ? error.message : "目录加载失败" });
      });
    return () => { cancelled = true; };
  }, [signature, stableKeys]);

  return {
    catalogs: state.signature === signature ? state.catalogs : new Map<string, PastPaperCatalog>(),
    loading: stableKeys.length > 0 && state.signature !== signature,
    error: state.signature === signature ? state.error : undefined,
  };
}
