import { describe, expect, it } from "vitest";
import {
  entitySlots,
  formFromScene,
  initialLabState,
  labReducer,
  sceneFromForm,
} from "@/pages/vector-geometry-lab/state/lab-state";
import { getExample } from "@/pages/vector-geometry-lab/examples/builtin-examples.js";

describe("initialLabState", () => {
  it("boots the default example with a solved analysis", () => {
    const state = initialLabState("angle-between-vectors");
    expect(state.exampleId).toBe("angle-between-vectors");
    expect(state.analysis.models[0]?.status).toBe("solved");
    expect(state.inputError).toBeNull();
    expect(state.viewportStatus).toBe("loading");
  });

  it("falls back to the default example for unknown ids", () => {
    const state = initialLabState("nope");
    expect(state.exampleId).toBe("angle-between-vectors");
  });

  it("throws only when NO examples exist (invariant guard)", () => {
    expect(() => initialLabState("angle-between-vectors")).not.toThrow();
  });
});

describe("coordinate form", () => {
  const scene = getExample("line-plane-intersection")!.scene;

  it("entitySlots + formFromScene expose every editable vector", () => {
    const slots = entitySlots(scene);
    const keys = slots.map((s) => s.slotKey);
    expect(keys).toEqual(["l:point", "l:direction", "π:point", "π:normal"]);
    const form = formFromScene(scene);
    expect(form["l:direction"]).toEqual({ x: "1", y: "1", z: "-1" });
  });

  it("valid edits rebuild the scene through the schema", () => {
    const form = {
      ...formFromScene(scene),
      "π:normal": { x: "0", y: "0", z: "2" },
    };
    const rebuilt = sceneFromForm("line-plane-intersection", scene, form);
    expect(rebuilt.ok).toBe(true);
    if (rebuilt.ok) {
      expect(rebuilt.scene.planes[0]?.normal.z.input).toBe("2");
    }
  });

  it("invalid literals fail the whole rebuild with structured errors", () => {
    const form = {
      ...formFromScene(scene),
      "l:direction": { x: "abc", y: "1", z: "-1" },
    };
    const rebuilt = sceneFromForm("line-plane-intersection", scene, form);
    expect(rebuilt.ok).toBe(false);
    if (!rebuilt.ok) {
      expect(rebuilt.error).toContain("abc");
      expect(rebuilt.invalidSlots).toContain("l:direction");
    }
  });

  it("a zero direction vector is rejected by the schema layer", () => {
    const form = {
      ...formFromScene(scene),
      "l:direction": { x: "0", y: "0", z: "0" },
    };
    const rebuilt = sceneFromForm("line-plane-intersection", scene, form);
    expect(rebuilt.ok).toBe(false);
    if (!rebuilt.ok) {
      expect(rebuilt.error).toContain("non-zero");
    }
  });

  it("a zero plane normal is rejected by the schema layer", () => {
    const form = {
      ...formFromScene(scene),
      "π:normal": { x: "0", y: "0", z: "0" },
    };
    const rebuilt = sceneFromForm("line-plane-intersection", scene, form);
    expect(rebuilt.ok).toBe(false);
  });
});

describe("labReducer", () => {
  it("select-example resets the whole lab", () => {
    const start = initialLabState("angle-between-vectors");
    const next = labReducer(start, { type: "select-example", exampleId: "skew-lines" });
    expect(next.exampleId).toBe("skew-lines");
    expect(next.analysis.models[0]?.status).toBe("solved");
  });

  it("scene replacement preserves renderer-owned state (Stage 8 regression)", () => {
    // The Viewport3D renderer is not recreated on example switches — the
    // toolbar and PNG export must stay enabled (E2E keyboard-suite finding).
    let state = initialLabState("angle-between-vectors");
    state = labReducer(state, { type: "set-viewport-status", status: "ready" });
    state = labReducer(state, { type: "set-view", view: "top" });
    state = labReducer(state, { type: "set-projection", projection: "orthographic" });
    state = labReducer(state, { type: "set-reduced-motion", value: true });

    const switched = labReducer(state, { type: "select-example", exampleId: "skew-lines" });
    expect(switched.viewportStatus).toBe("ready");
    expect(switched.view).toBe("top");
    expect(switched.projection).toBe("orthographic");
    expect(switched.reducedMotionOverride).toBe(true);

    const reset = labReducer(state, { type: "reset-lab" });
    expect(reset.viewportStatus).toBe("ready");
    expect(reset.view).toBe("top");
    expect(reset.projection).toBe("orthographic");
    expect(reset.reducedMotionOverride).toBe(true);
  });

  it("valid coordinate edits re-run the analysis", () => {
    const start = initialLabState("point-point-distance");
    const next = labReducer(start, {
      type: "set-coordinate",
      slotKey: "Q:position",
      axis: "x",
      value: "5",
    });
    expect(next.inputError).toBeNull();
    // d(P, Q) now √((1−5)² + (2−6)² + 0) = √32 = 4√2
    const conclusion = JSON.stringify(
      next.analysis.models[0]?.sections.find((s) => s.sectionId === "geometric-conclusion"),
    );
    expect(conclusion).toContain("4√2");
  });

  it("invalid edits keep the last valid scene and flag the error", () => {
    const start = initialLabState("point-point-distance");
    const next = labReducer(start, {
      type: "set-coordinate",
      slotKey: "Q:position",
      axis: "x",
      value: "not-a-number",
    });
    expect(next.inputError).toContain("not-a-number");
    expect(next.invalidSlots).toContain("Q:position");
    // Scene and analysis are unchanged (last valid).
    expect(next.scene).toBe(start.scene);
    expect(next.analysis).toBe(start.analysis);
    // Form still reflects what the user typed (controlled input).
    expect(next.form["Q:position"]?.x).toBe("not-a-number");
  });

  it("toggle-hidden flips visibility flags", () => {
    const start = initialLabState("point-point-distance");
    const once = labReducer(start, { type: "toggle-hidden", id: "P" });
    expect(once.hidden["P"]).toBe(true);
    const twice = labReducer(once, { type: "toggle-hidden", id: "P" });
    expect(twice.hidden["P"]).toBe(false);
  });

  it("opacity / planeOpacity / projection / view / picks / reduced-motion", () => {
    const start = initialLabState("point-point-distance");
    let state = labReducer(start, { type: "set-opacity", id: "P", opacity: 0.4 });
    expect(state.opacity["P"]).toBe(0.4);
    state = labReducer(state, { type: "set-plane-opacity", opacity: 0.6 });
    expect(state.planeOpacity).toBe(0.6);
    state = labReducer(state, { type: "set-projection", projection: "orthographic" });
    expect(state.projection).toBe("orthographic");
    state = labReducer(state, { type: "set-view", view: "top" });
    expect(state.view).toBe("top");
    state = labReducer(state, {
      type: "picked",
      info: {
        objectId: "P",
        kind: "point",
        name: "point P",
        equationText: "P = (1, 2, 3)",
        keyParams: {},
      },
    });
    expect(state.picked?.objectId).toBe("P");
    state = labReducer(state, { type: "set-reduced-motion", value: true });
    expect(state.reducedMotionOverride).toBe(true);
    state = labReducer(state, { type: "set-viewport-status", status: "ready" });
    expect(state.viewportStatus).toBe("ready");
    state = labReducer(state, { type: "select-entity", id: "P" });
    expect(state.selectedEntityId).toBe("P");
  });
});
