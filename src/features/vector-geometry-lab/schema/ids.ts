/**
 * Stable, serializable entity identifiers.
 *
 * Strategy: callers may always pass their own id (e.g. derived from a saved
 * scene) for full stability; otherwise a purely local id is generated from
 * Web Crypto `randomUUID` (Node >= 19 and all modern browsers), with a
 * Math.random-based RFC4122-v4-shaped fallback for exotic runtimes.
 * No network, no external dependency.
 */
function randomUuid(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  // Fallback: RFC4122 v4-shaped id from Math.random (local, non-cryptographic).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (slot) => {
    const r = Math.floor(Math.random() * 16);
    const v = slot === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createId(prefix = "id"): string {
  return `${prefix}_${randomUuid()}`;
}
