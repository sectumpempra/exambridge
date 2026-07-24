import { describe, expect, it } from "vitest";
import { buildSceneGraph } from "@/features/vector-geometry-lab/three/scene-graph";
import { createVectorGeometryRenderer } from "@/features/vector-geometry-lab/three/renderer";
import type { RendererHandle } from "@/features/vector-geometry-lab/three/renderer";
import { makePoint } from "./helpers.js";
import {
  createStubCanvasElement,
  createStubControlsFactory,
  createStubRaf,
  createStubRendererFactory,
  STUB_PNG_DATA_URL,
} from "./helpers.js";

function makeGraph() {
  return buildSceneGraph(
    { points: [makePoint("p1", "A", "0", "0", "0")] },
    { includeAxes: false, labelsEnabled: false },
  );
}

function createHarness() {
  const canvas = createStubCanvasElement();
  const renderer = createStubRendererFactory();
  const controls = createStubControlsFactory();
  const raf = createStubRaf();
  const result = createVectorGeometryRenderer(canvas.canvas, {
    sceneGraph: makeGraph(),
    rendererFactory: renderer.factory,
    controlsFactory: controls.factory,
    requestAnimationFrameFn: raf.rafFn,
    cancelAnimationFrameFn: raf.cancelFn,
  });
  if (!result.ok) {
    throw new Error(`harness creation failed: ${result.error.message}`);
  }
  const handle: RendererHandle = result.value;
  return { handle, canvas, renderer, controls, raf };
}

describe("capturePng (Stage 7 PNG export)", () => {
  it("captures at 1x without touching the renderer size", () => {
    const { handle, canvas, renderer } = createHarness();
    const setSizeBefore = renderer.recorder.setSizeCalls.length;
    const renderBefore = renderer.recorder.renderCalls.length;
    const result = handle.capturePng();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.dataUrl).toBe(STUB_PNG_DATA_URL);
    expect(result.value.width).toBe(800);
    expect(result.value.height).toBe(600);
    expect(result.value.pixelRatio).toBe(1);
    // A fresh frame was rendered synchronously before readback.
    expect(renderer.recorder.renderCalls.length).toBe(renderBefore + 1);
    expect(renderer.recorder.setSizeCalls.length).toBe(setSizeBefore);
    expect(canvas.toDataUrlCalls).toEqual(["image/png"]);
  });

  it("captures at 2x/3x with a scaled render and restores the original size", () => {
    const { handle, renderer } = createHarness();
    const result = handle.capturePng({ pixelRatio: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.width).toBe(2400);
    expect(result.value.height).toBe(1800);
    expect(result.value.pixelRatio).toBe(3);
    const sizes = renderer.recorder.setSizeCalls;
    // Scale up, then restore — original size is the LAST setSize call.
    expect(sizes.at(-2)).toEqual({ width: 2400, height: 1800 });
    expect(sizes.at(-1)).toEqual({ width: 800, height: 600 });
    // And a final render brings the restored view back on screen.
    expect(renderer.recorder.renderCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("refuses an unsupported pixelRatio without touching GL", () => {
    const { handle, canvas, renderer } = createHarness();
    const setSizeBefore = renderer.recorder.setSizeCalls.length;
    const result = handle.capturePng({
      // Deliberately out of contract — must be rejected, not coerced.
      pixelRatio: 4 as unknown as 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("capture-failed");
    expect(result.error.message).toContain("pixelRatio");
    expect(renderer.recorder.setSizeCalls.length).toBe(setSizeBefore);
    expect(canvas.toDataUrlCalls).toEqual([]);
  });

  it("returns capture-failed when the canvas readback throws, and still restores size", () => {
    const { handle, canvas, renderer } = createHarness();
    canvas.toDataUrlError = new Error("readback exploded");
    const result = handle.capturePng({ pixelRatio: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("capture-failed");
    expect(result.error.cause).toContain("readback exploded");
    // Size restoration must survive the throw.
    expect(renderer.recorder.setSizeCalls.at(-1)).toEqual({ width: 800, height: 600 });
  });

  it("returns capture-failed when toDataURL does not yield a PNG data URL", () => {
    const { handle, canvas } = createHarness();
    canvas.dataUrl = "data:,";
    const result = handle.capturePng();
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("capture-failed");
  });

  it("returns capture-failed after dispose", () => {
    const { handle } = createHarness();
    handle.dispose();
    const result = handle.capturePng();
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("capture-failed");
    expect(result.error.message).toContain("disposed");
  });
});
