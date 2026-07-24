import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { buildSceneGraph } from "@/features/vector-geometry-lab/three/scene-graph";
import {
  createVectorGeometryRenderer,
  disposeObject3DResources,
} from "@/features/vector-geometry-lab/three/renderer";
import type { RendererHandle } from "@/features/vector-geometry-lab/three/renderer";
import { findByName, makePoint } from "./helpers.js";
import {
  createStubCanvasElement,
  createStubControlsFactory,
  createStubRaf,
  createStubRendererFactory,
  throwingRendererFactory,
} from "./helpers.js";

function makeGraph() {
  return buildSceneGraph(
    { points: [makePoint("p1", "A", "0", "0", "0")] },
    { includeAxes: false, labelsEnabled: false },
  );
}

interface Harness {
  handle: RendererHandle;
  canvas: ReturnType<typeof createStubCanvasElement>;
  renderer: ReturnType<typeof createStubRendererFactory>;
  controls: ReturnType<typeof createStubControlsFactory>;
  raf: ReturnType<typeof createStubRaf>;
}

function createHarness(
  overrides: Parameters<typeof createVectorGeometryRenderer>[1] = {},
): Harness {
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
    ...overrides,
  });
  if (!result.ok) {
    throw new Error(`harness creation failed: ${result.error.message}`);
  }
  return { handle: result.value, canvas, renderer, controls, raf };
}

describe("createVectorGeometryRenderer — failure paths (structured, never raw throws)", () => {
  it("returns webgl-unavailable when the WebGLRenderer constructor throws", () => {
    const canvas = createStubCanvasElement();
    const result = createVectorGeometryRenderer(canvas.canvas, {
      rendererFactory: throwingRendererFactory,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("webgl-unavailable");
      expect(result.error.cause).toContain("Error creating WebGL context");
    }
  });

  it("returns webgl-unavailable when the injectable probe reports no context", () => {
    const canvas = createStubCanvasElement();
    const renderer = createStubRendererFactory();
    const result = createVectorGeometryRenderer(canvas.canvas, {
      webglProbe: () => null,
      rendererFactory: renderer.factory,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("webgl-unavailable");
      expect(result.error.message).toContain("no-webgl-context");
    }
    // The renderer factory was never reached.
    expect(renderer.recorder.renderCalls).toHaveLength(0);
  });

  it("proceeds when the probe reports support", () => {
    const canvas = createStubCanvasElement();
    const result = createVectorGeometryRenderer(canvas.canvas, {
      webglProbe: () => ({ gl: true }),
      rendererFactory: createStubRendererFactory().factory,
      controlsFactory: createStubControlsFactory().factory,
    });
    expect(result.ok).toBe(true);
  });

  it("returns invalid-canvas for a non-canvas argument", () => {
    const result = createVectorGeometryRenderer(
      {} as HTMLCanvasElement,
      {},
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid-canvas");
    }
  });
});

describe("renderer handle — render / resize / views / projection", () => {
  it("render() draws the scene with the active (perspective) camera", () => {
    const { handle, renderer } = createHarness();
    handle.render();
    expect(renderer.recorder.renderCalls).toHaveLength(1);
    const call = renderer.recorder.renderCalls[0]!;
    expect(call.scene).toBe(handle.scene);
    expect(call.camera).toBeInstanceOf(THREE.PerspectiveCamera);
  });

  it("setView positions the camera; resetCamera restores isometric", () => {
    const { handle, renderer } = createHarness({ cameraDistance: 14 });
    handle.setView("front");
    const front = renderer.recorder.renderCalls.at(-1)!;
    expect(front.camera.position.distanceTo(new THREE.Vector3(0, 0, 14))).toBeLessThan(1e-9);
    expect(handle.getView()).toBe("front");

    handle.setView("top");
    const top = renderer.recorder.renderCalls.at(-1)!;
    expect(top.camera.position.distanceTo(new THREE.Vector3(0, 14, 0))).toBeLessThan(1e-9);

    handle.setView("side");
    const side = renderer.recorder.renderCalls.at(-1)!;
    expect(side.camera.position.distanceTo(new THREE.Vector3(14, 0, 0))).toBeLessThan(1e-9);

    handle.resetCamera();
    const home = renderer.recorder.renderCalls.at(-1)!;
    expect(home.camera.position.distanceTo(new THREE.Vector3(14, 14, 14))).toBeLessThan(1e-9);
    expect(handle.getView()).toBe("isometric");
  });

  it("setProjection switches the active camera and rebuilds controls", () => {
    const { handle, renderer, controls } = createHarness();
    expect(controls.recorder.instances).toHaveLength(1);
    handle.setProjection("orthographic");
    expect(handle.getProjection()).toBe("orthographic");
    // Controls were rebuilt against the orthographic camera.
    expect(controls.recorder.instances).toHaveLength(2);
    expect(controls.recorder.instances[0]!.disposeMock).toHaveBeenCalledTimes(1);
    const last = renderer.recorder.renderCalls.at(-1)!;
    expect(last.camera).toBeInstanceOf(THREE.OrthographicCamera);
    // Re-selecting the same projection is a no-op.
    handle.setProjection("orthographic");
    expect(controls.recorder.instances).toHaveLength(2);
    handle.setProjection("perspective");
    expect(controls.recorder.instances).toHaveLength(3);
  });

  it("resize forwards the size and re-renders", () => {
    const { handle, renderer } = createHarness();
    handle.resize(1024, 768);
    expect(renderer.recorder.setSizeCalls).toContainEqual({
      width: 1024,
      height: 768,
    });
    // Degenerate sizes are ignored.
    const calls = renderer.recorder.setSizeCalls.length;
    handle.resize(0, 100);
    expect(renderer.recorder.setSizeCalls).toHaveLength(calls);
  });

  it("setScene swaps the displayed graph", () => {
    const { handle } = createHarness();
    const replacement = makeGraph();
    handle.setScene(replacement);
    expect(handle.scene.children).toContain(replacement);
    expect(handle.scene.children).toHaveLength(1);
  });
});

describe("renderer handle — visibility / opacity", () => {
  it("setObjectVisibility toggles the entry subtree and reports unknown ids", () => {
    const { handle } = createHarness();
    expect(handle.setObjectVisibility("p1", false)).toBe(true);
    expect(handle.setObjectVisibility("missing", false)).toBe(false);
    const graph = handle.scene.children[0]!;
    const entryRoot = graph.children.find(
      (c) => c.userData["exambridgeVectorGeometryId"] === "p1",
    );
    expect(entryRoot).toBeDefined();
    expect(entryRoot?.visible).toBe(false);
    expect(handle.setObjectVisibility("p1", true)).toBe(true);
    expect(entryRoot?.visible).toBe(true);
  });

  it("setObjectOpacity clamps and applies to entry materials", () => {
    const { handle } = createHarness();
    expect(handle.setObjectOpacity("p1", 0.5)).toBe(true);
    const graph = handle.scene.children[0]!;
    const marker = findByName(graph, "point-marker")[0] as THREE.Mesh;
    const material = marker.material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBe(0.5);
    expect(material.transparent).toBe(true);
    expect(handle.setObjectOpacity("p1", Number.NaN)).toBe(false);
    expect(handle.setObjectOpacity("missing", 0.5)).toBe(false);
    expect(handle.setObjectOpacity("p1", 2)).toBe(true);
    expect(material.opacity).toBe(1);
  });
});

describe("renderer handle — picking (raycast → caller metadata, never math)", () => {
  it("clicking an object reports id/kind/name/equation/keyParams from metadata", () => {
    const canvas = createStubCanvasElement();
    const renderer = createStubRendererFactory();
    const controls = createStubControlsFactory();
    const onPick = vi.fn();
    const result = createVectorGeometryRenderer(canvas.canvas, {
      sceneGraph: makeGraph(),
      rendererFactory: renderer.factory,
      controlsFactory: controls.factory,
      metadata: [
        {
          id: "p1",
          kind: "point",
          name: "Point A",
          equationText: "A = (0, 0, 0)",
          keyParams: { x: "0", y: "0", z: "0" },
        },
      ],
      onPick,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // Centre of an 800×600 canvas with the isometric camera → hits the origin point.
    canvas.dispatch("click", { clientX: 400, clientY: 300 } as unknown as Event);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith({
      objectId: "p1",
      kind: "point",
      name: "Point A",
      equationText: "A = (0, 0, 0)",
      keyParams: { x: "0", y: "0", z: "0" },
    });
  });

  it("pickAt returns null for empty space and for hidden objects", () => {
    const { handle } = createHarness();
    expect(handle.pickAt(790, 10)).toBeNull();
    expect(handle.pickAt(400, 300)?.objectId).toBe("p1");
    handle.setObjectVisibility("p1", false);
    expect(handle.pickAt(400, 300)).toBeNull();
  });

  it("pickAt returns null when the canvas has a zero-size rect", () => {
    const canvas = createStubCanvasElement({ left: 0, top: 0, width: 0, height: 0 });
    const result = createVectorGeometryRenderer(canvas.canvas, {
      sceneGraph: makeGraph(),
      rendererFactory: createStubRendererFactory().factory,
      controlsFactory: createStubControlsFactory().factory,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.pickAt(0, 0)).toBeNull();
    }
  });
});

describe("renderer handle — reduced motion", () => {
  it("reads prefers-reduced-motion at creation (injectable matchMedia)", () => {
    const { handle, controls } = createHarness({
      matchMediaFn: () => ({ matches: true }),
      autoRotate: true,
    });
    expect(handle.reducedMotion).toBe(true);
    const controlsInstance = controls.recorder.instances[0]!;
    expect(controlsInstance.enableDamping).toBe(false);
    // Auto-rotate is suppressed under reduced motion.
    expect(controlsInstance.autoRotate).toBe(false);
  });

  it("enables damping and auto-rotate when motion is allowed", () => {
    const { handle, controls, raf, renderer } = createHarness({
      matchMediaFn: () => ({ matches: false }),
      autoRotate: true,
    });
    expect(handle.reducedMotion).toBe(false);
    const controlsInstance = controls.recorder.instances[0]!;
    expect(controlsInstance.enableDamping).toBe(true);
    expect(controlsInstance.autoRotate).toBe(true);
    // Animation loop scheduled; one tick updates controls and renders.
    expect(raf.pending.size).toBe(1);
    const renderCallsBefore = renderer.recorder.renderCalls.length;
    raf.runNext();
    expect(controlsInstance.updateMock).toHaveBeenCalledTimes(1);
    expect(renderer.recorder.renderCalls.length).toBe(renderCallsBefore + 1);
    expect(raf.pending.size).toBe(1); // rescheduled
  });

  it("setReducedMotion(true) stops the loop and disables damping at runtime", () => {
    const { handle, controls, raf } = createHarness({
      matchMediaFn: () => ({ matches: false }),
      autoRotate: true,
    });
    handle.setReducedMotion(true);
    const controlsInstance = controls.recorder.instances[0]!;
    expect(handle.reducedMotion).toBe(true);
    expect(controlsInstance.enableDamping).toBe(false);
    expect(controlsInstance.autoRotate).toBe(false);
    expect(raf.cancelled.length).toBeGreaterThan(0);
    handle.setReducedMotion(false);
    expect(controlsInstance.enableDamping).toBe(true);
    expect(controlsInstance.autoRotate).toBe(true);
  });
});

describe("renderer handle — dispose (idempotent, full resource release)", () => {
  it("dispose releases renderer/controls/listeners and ignores further calls", () => {
    const { handle, canvas, renderer, controls } = createHarness();
    handle.render();
    const renderCalls = renderer.recorder.renderCalls.length;
    handle.dispose();
    handle.dispose();
    expect(renderer.recorder.disposeCalls).toHaveLength(1);
    expect(controls.recorder.instances[0]!.disposeMock).toHaveBeenCalledTimes(1);
    expect(canvas.listeners.get("click") ?? []).toHaveLength(0);
    handle.render();
    expect(renderer.recorder.renderCalls).toHaveLength(renderCalls);
    expect(handle.isDisposed()).toBe(true);
    expect(handle.setObjectVisibility("p1", false)).toBe(false);
    expect(handle.setObjectOpacity("p1", 0.5)).toBe(false);
    expect(handle.pickAt(400, 300)).toBeNull();
  });

  it("disposeObject3DResources disposes geometry, materials and textures", () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    );
    const texture = new THREE.Texture();
    (mesh.material as THREE.MeshBasicMaterial).map = texture;
    const geometrySpy = vi.spyOn(mesh.geometry, "dispose");
    const materialSpy = vi.spyOn(mesh.material as THREE.Material, "dispose");
    const textureSpy = vi.spyOn(texture, "dispose");
    const group = new THREE.Group();
    group.add(mesh);
    disposeObject3DResources(group);
    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
    expect(textureSpy).toHaveBeenCalledTimes(1);
  });
});
