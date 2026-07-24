import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  attachLabel,
  createTextSprite,
  defaultCanvas2DFactory,
  LABEL_FALLBACK_USER_DATA_KEY,
} from "@/features/vector-geometry-lab/three/labels";
import {
  createStubCanvas2DFactory,
  nullCanvas2DFactory,
  throwingCanvas2DFactory,
} from "./helpers.js";

describe("createTextSprite with an injected stub canvas factory", () => {
  it("rasterises the text and produces a textured sprite", () => {
    const { factory, recorder } = createStubCanvas2DFactory();
    const sprite = createTextSprite("P(1, 2, 3)", { canvasFactory: factory });
    expect(sprite).not.toBeNull();
    expect(sprite?.name).toBe("label:P(1, 2, 3)");
    expect(recorder.measureTextCalls).toEqual(["P(1, 2, 3)"]);
    expect(recorder.fillTextCalls).toHaveLength(1);
    expect(recorder.fillTextCalls[0]?.text).toBe("P(1, 2, 3)");
    const material = sprite?.material as THREE.SpriteMaterial;
    expect(material.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(material.transparent).toBe(true);
    // Aspect ratio is preserved through the world-height scale.
    const canvas = recorder.canvases[0];
    expect(canvas).toBeDefined();
    if (canvas !== undefined && sprite !== null) {
      expect(sprite.scale.x / sprite.scale.y).toBeCloseTo(
        canvas.width / canvas.height,
        5,
      );
    }
  });

  it("returns null for empty text (no sprite at all)", () => {
    const { factory } = createStubCanvas2DFactory();
    expect(createTextSprite("", { canvasFactory: factory })).toBeNull();
  });
});

describe("createTextSprite degradation (never crashes)", () => {
  it("falls back to an untextured chip when the factory returns null", () => {
    const sprite = createTextSprite("A", { canvasFactory: nullCanvas2DFactory });
    expect(sprite).not.toBeNull();
    expect(sprite?.name).toBe("label-fallback:A");
    expect(sprite?.userData[LABEL_FALLBACK_USER_DATA_KEY]).toBe(true);
    expect(sprite?.userData["labelText"]).toBe("A");
    const material = sprite?.material as THREE.SpriteMaterial;
    expect(material.map).toBeNull();
  });

  it("falls back when the factory throws", () => {
    const sprite = createTextSprite("B", {
      canvasFactory: throwingCanvas2DFactory,
    });
    expect(sprite?.userData[LABEL_FALLBACK_USER_DATA_KEY]).toBe(true);
  });

  it("falls back when rasterisation throws mid-draw", () => {
    const broken: typeof nullCanvas2DFactory = () => ({
      canvas: { width: 2, height: 2 },
      context: {
        font: "",
        textAlign: "left",
        textBaseline: "alphabetic",
        fillStyle: "#000",
        measureText() {
          throw new Error("measure exploded");
        },
        fillText() {},
        clearRect() {},
      },
    });
    const sprite = createTextSprite("C", { canvasFactory: broken });
    expect(sprite?.userData[LABEL_FALLBACK_USER_DATA_KEY]).toBe(true);
  });
});

describe("defaultCanvas2DFactory", () => {
  it("returns null under jsdom (no canvas 2d backend), which the sprite path degrades from", () => {
    expect(defaultCanvas2DFactory(4, 4)).toBeNull();
    // ...and the default (non-injected) sprite path therefore yields a fallback chip.
    const sprite = createTextSprite("D");
    expect(sprite?.userData[LABEL_FALLBACK_USER_DATA_KEY]).toBe(true);
  });
});

describe("attachLabel", () => {
  it("adds the sprite as a child at the requested offset", () => {
    const { factory } = createStubCanvas2DFactory();
    const parent = new THREE.Group();
    const sprite = attachLabel(parent, "l1", new THREE.Vector3(1, 2, 3), {
      canvasFactory: factory,
    });
    expect(sprite).not.toBeNull();
    expect(parent.children).toContain(sprite);
    expect(sprite?.position.equals(new THREE.Vector3(1, 2, 3))).toBe(true);
  });

  it("is a no-op when labels are disabled", () => {
    const { factory, recorder } = createStubCanvas2DFactory();
    const parent = new THREE.Group();
    const sprite = attachLabel(parent, "l1", new THREE.Vector3(), {
      canvasFactory: factory,
      labelsEnabled: false,
    });
    expect(sprite).toBeNull();
    expect(parent.children).toHaveLength(0);
    expect(recorder.measureTextCalls).toHaveLength(0);
  });
});
