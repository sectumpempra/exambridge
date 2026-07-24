/**
 * Browser download helpers (spec §7 导出). Thin side-effect layer — all
 * dependencies injectable so the export buttons are testable under jsdom.
 */

export interface DownloadDeps {
  readonly createObjectURL?: (blob: Blob) => string;
  readonly revokeObjectURL?: (url: string) => void;
  /** Injectable anchor click (tests observe the download). */
  readonly clickAnchor?: (anchor: HTMLAnchorElement) => void;
}

export type DownloadResult =
  | { readonly ok: true; readonly filename: string; readonly blob: Blob }
  | { readonly ok: false; readonly message: string };

/**
 * Triggers a client-side file download. Never throws: environments without
 * URL.createObjectURL (older/embedded browsers) get a structured failure.
 */
export function downloadBlob(
  filename: string,
  blob: Blob,
  deps: DownloadDeps = {},
): DownloadResult {
  const createObjectURL =
    deps.createObjectURL ??
    (typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? (b: Blob) => URL.createObjectURL(b)
      : undefined);
  if (createObjectURL === undefined) {
    return {
      ok: false,
      message: "This browser cannot create downloads (URL.createObjectURL is missing).",
    };
  }
  const revokeObjectURL =
    deps.revokeObjectURL ??
    (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function"
      ? (url: string) => URL.revokeObjectURL(url)
      : () => undefined);
  const clickAnchor = deps.clickAnchor ?? ((anchor: HTMLAnchorElement) => anchor.click());
  try {
    const url = createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    clickAnchor(anchor);
    revokeObjectURL(url);
    return { ok: true, filename, blob };
  } catch (error) {
    return {
      ok: false,
      message: `Download failed (${error instanceof Error ? error.message : String(error)}).`,
    };
  }
}

/** Downloads a text payload (JSON / HTML) as a file. */
export function downloadText(
  filename: string,
  text: string,
  mimeType: string,
  deps: DownloadDeps = {},
): DownloadResult {
  return downloadBlob(filename, new Blob([text], { type: mimeType }), deps);
}

/**
 * Downloads a data URL (e.g. a captured PNG) directly — no Blob round-trip
 * and no createObjectURL requirement, so this works even in restrictive
 * environments. Returns the same result shape for uniform UI handling.
 */
export function downloadDataUrl(
  filename: string,
  dataUrl: string,
  deps: DownloadDeps = {},
): DownloadResult {
  const clickAnchor = deps.clickAnchor ?? ((anchor: HTMLAnchorElement) => anchor.click());
  try {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    clickAnchor(anchor);
    return { ok: true, filename, blob: new Blob([dataUrl]) };
  } catch (error) {
    return {
      ok: false,
      message: `Download failed (${error instanceof Error ? error.message : String(error)}).`,
    };
  }
}
