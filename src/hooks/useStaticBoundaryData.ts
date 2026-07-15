import { useEffect, useState } from "react";

export function useStaticBoundaryData(url?: string) {
  const [data, setData] = useState<Record<string, string | number>[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Boundary data request failed: ${response.status}`);
        return response.json() as Promise<Record<string, string | number>[]>;
      })
      .then(setData)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(true);
      });
    return () => controller.abort();
  }, [url]);

  return { data, error, loading: Boolean(url) && !error && data.length === 0 };
}
