import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom emits noisy "not implemented" errors before returning null. Returning
// null directly models the same no-canvas/no-WebGL environment and keeps the
// intentional degradation tests readable.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

// vitest runs with globals:false, so @testing-library/react's automatic
// cleanup never registers — without this every render() accumulates trees in
// document.body and later tests see multiple copies of every element.
afterEach(() => {
  cleanup();
});
