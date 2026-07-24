/**
 * Lab state: a single useReducer store. Data flow is one-way —
 * form input → schema parse (zod) → core analysis → explain models + 3d
 * scene description. Invalid input NEVER crashes the lab: the last valid
 * scene and analysis stay on screen and the error is shown (spec §6).
 */

import {
  createLine3,
  createPlane3,
  createPoint3,
  createScene,
  createVector3,
  createVectorEntity,
  scalarFromLiteral,
} from "@/features/vector-geometry-lab/schema";
import type {
  VectorGeometrySceneV1,
} from "@/features/vector-geometry-lab/schema";
import type {
  CameraView,
  PickInfo,
  ProjectionMode,
} from "@/features/vector-geometry-lab/three";
import { getExample, DEFAULT_EXAMPLE_ID } from "../examples/builtin-examples.js";
import { runExampleAnalysis } from "../analysis/run-analysis.js";
import type { AnalysisOutput } from "../analysis/run-analysis.js";

export type ViewportStatus = "loading" | "ready" | "unavailable";

export interface SlotValue {
  readonly x: string;
  readonly y: string;
  readonly z: string;
}

/** slotKey = `${entityId}:${slot}`; slot ∈ position/components/point/normal/direction */
export type CoordinateForm = Readonly<Record<string, SlotValue>>;

export interface EntitySlot {
  readonly slotKey: string;
  readonly entityId: string;
  readonly entityLabel: string;
  readonly slotLabel: string;
}

function slotKey(entityId: string, slot: string): string {
  return `${entityId}:${slot}`;
}

function slotValueOf(vector: {
  readonly x: { readonly input: string };
  readonly y: { readonly input: string };
  readonly z: { readonly input: string };
}): SlotValue {
  return { x: vector.x.input, y: vector.y.input, z: vector.z.input };
}

/** Editable coordinate slots of a scene, in stable order. */
export function entitySlots(scene: VectorGeometrySceneV1): EntitySlot[] {
  const slots: EntitySlot[] = [];
  for (const point of scene.points) {
    slots.push({
      slotKey: slotKey(point.pointId, "position"),
      entityId: point.pointId,
      entityLabel: `point ${point.label}`,
      slotLabel: "position",
    });
  }
  for (const vector of scene.vectors) {
    slots.push({
      slotKey: slotKey(vector.vectorId, "components"),
      entityId: vector.vectorId,
      entityLabel: `vector ${vector.label}`,
      slotLabel: "components",
    });
  }
  for (const line of scene.lines) {
    slots.push({
      slotKey: slotKey(line.lineId, "point"),
      entityId: line.lineId,
      entityLabel: `line ${line.label}`,
      slotLabel: "base point",
    });
    slots.push({
      slotKey: slotKey(line.lineId, "direction"),
      entityId: line.lineId,
      entityLabel: `line ${line.label}`,
      slotLabel: "direction",
    });
  }
  for (const plane of scene.planes) {
    slots.push({
      slotKey: slotKey(plane.planeId, "point"),
      entityId: plane.planeId,
      entityLabel: `plane ${plane.label}`,
      slotLabel: "base point",
    });
    slots.push({
      slotKey: slotKey(plane.planeId, "normal"),
      entityId: plane.planeId,
      entityLabel: `plane ${plane.label}`,
      slotLabel: "normal",
    });
  }
  return slots;
}

/** Initial form strings from the scene's exact input literals. */
export function formFromScene(scene: VectorGeometrySceneV1): CoordinateForm {
  const form: Record<string, SlotValue> = {};
  for (const point of scene.points) {
    form[slotKey(point.pointId, "position")] = slotValueOf(point.position);
  }
  for (const vector of scene.vectors) {
    form[slotKey(vector.vectorId, "components")] = slotValueOf(vector.components);
  }
  for (const line of scene.lines) {
    form[slotKey(line.lineId, "point")] = slotValueOf(line.point.position);
    form[slotKey(line.lineId, "direction")] = slotValueOf(line.direction);
  }
  for (const plane of scene.planes) {
    form[slotKey(plane.planeId, "point")] = slotValueOf(plane.point.position);
    form[slotKey(plane.planeId, "normal")] = slotValueOf(plane.normal);
  }
  return form;
}

export type SceneRebuild =
  | { readonly ok: true; readonly scene: VectorGeometrySceneV1 }
  | {
      readonly ok: false;
      readonly error: string;
      readonly invalidSlots: readonly string[];
    };

/**
 * Re-parses the form through the schema (scalarFromLiteral per component,
 * entity factories per entity). Any invalid literal fails the WHOLE rebuild
 * with a structured error — the lab keeps showing the last valid scene.
 */
export function sceneFromForm(
  exampleId: string,
  template: VectorGeometrySceneV1,
  form: CoordinateForm,
): SceneRebuild {
  const invalidSlots: string[] = [];
  const messages: string[] = [];

  const parseSlot = (key: string): ReturnType<typeof createVector3> | undefined => {
    const slot = form[key];
    if (slot === undefined) {
      invalidSlots.push(key);
      messages.push(`missing slot ${key}`);
      return undefined;
    }
    const parts = [slot.x, slot.y, slot.z].map((raw) => scalarFromLiteral(raw));
    const bad = parts.findIndex((part) => !part.ok);
    if (bad >= 0) {
      invalidSlots.push(key);
      const axis = ["x", "y", "z"][bad] ?? "?";
      const raw = [slot.x, slot.y, slot.z][bad] ?? "";
      messages.push(
        `"${raw}" (${key} ${axis}) is not an integer, decimal or fraction literal`,
      );
      return undefined;
    }
    const [x, y, z] = parts;
    if (x === undefined || y === undefined || z === undefined || !x.ok || !y.ok || !z.ok) {
      invalidSlots.push(key);
      messages.push(`invalid slot ${key}`);
      return undefined;
    }
    return createVector3(x.value, y.value, z.value);
  };

  const points = template.points.map((point) => {
    const position = parseSlot(slotKey(point.pointId, "position"));
    if (position === undefined) {
      return undefined;
    }
    return createPoint3({
      pointId: point.pointId,
      label: point.label,
      position,
    });
  });
  const vectors = template.vectors.map((vector) => {
    const components = parseSlot(slotKey(vector.vectorId, "components"));
    if (components === undefined) {
      return undefined;
    }
    return createVectorEntity({
      vectorId: vector.vectorId,
      label: vector.label,
      components,
      ...(vector.origin !== undefined ? { origin: vector.origin } : {}),
    });
  });
  const lines = template.lines.map((line) => {
    const point = parseSlot(slotKey(line.lineId, "point"));
    const direction = parseSlot(slotKey(line.lineId, "direction"));
    if (point === undefined || direction === undefined) {
      return undefined;
    }
    try {
      return createLine3({
        lineId: line.lineId,
        label: line.label,
        point: createPoint3({
          pointId: line.point.pointId,
          label: line.point.label,
          position: point,
        }),
        direction,
      });
    } catch (error) {
      invalidSlots.push(slotKey(line.lineId, "direction"));
      messages.push(
        error instanceof Error ? error.message : `invalid line ${line.lineId}`,
      );
      return undefined;
    }
  });
  const planes = template.planes.map((plane) => {
    const point = parseSlot(slotKey(plane.planeId, "point"));
    const normal = parseSlot(slotKey(plane.planeId, "normal"));
    if (point === undefined || normal === undefined) {
      return undefined;
    }
    try {
      return createPlane3({
        planeId: plane.planeId,
        label: plane.label,
        point: createPoint3({
          pointId: plane.point.pointId,
          label: plane.point.label,
          position: point,
        }),
        normal,
      });
    } catch (error) {
      invalidSlots.push(slotKey(plane.planeId, "normal"));
      messages.push(
        error instanceof Error ? error.message : `invalid plane ${plane.planeId}`,
      );
      return undefined;
    }
  });

  if (
    points.some((p) => p === undefined) ||
    vectors.some((v) => v === undefined) ||
    lines.some((l) => l === undefined) ||
    planes.some((p) => p === undefined)
  ) {
    return {
      ok: false,
      error: `Invalid coordinates: ${messages.join("; ")}`,
      invalidSlots,
    };
  }
  return {
    ok: true,
    scene: createScene({
      sceneId: `${exampleId}-edited`,
      title: template.title,
      points: points.filter((p) => p !== undefined),
      vectors: vectors.filter((v) => v !== undefined),
      lines: lines.filter((l) => l !== undefined),
      planes: planes.filter((p) => p !== undefined),
    }),
  };
}

/* --------------------------------------------------------------------------
 * Reducer
 * ------------------------------------------------------------------------ */

export interface LabState {
  readonly exampleId: string;
  readonly form: CoordinateForm;
  readonly scene: VectorGeometrySceneV1;
  readonly inputError: string | null;
  readonly invalidSlots: readonly string[];
  readonly analysis: AnalysisOutput;
  readonly selectedEntityId: string | null;
  readonly picked: PickInfo | null;
  readonly hidden: Readonly<Record<string, boolean>>;
  readonly opacity: Readonly<Record<string, number>>;
  readonly planeOpacity: number;
  readonly projection: ProjectionMode;
  readonly view: CameraView;
  readonly reducedMotionOverride: boolean | null;
  readonly viewportStatus: ViewportStatus;
}

export type LabAction =
  | { readonly type: "select-example"; readonly exampleId: string }
  | {
      readonly type: "set-coordinate";
      readonly slotKey: string;
      readonly axis: "x" | "y" | "z";
      readonly value: string;
    }
  | {
      readonly type: "load-scene";
      readonly exampleId: string;
      readonly scene: VectorGeometrySceneV1;
    }
  | { readonly type: "reset-lab" }
  | { readonly type: "toggle-hidden"; readonly id: string }
  | { readonly type: "set-opacity"; readonly id: string; readonly opacity: number }
  | { readonly type: "set-plane-opacity"; readonly opacity: number }
  | { readonly type: "set-projection"; readonly projection: ProjectionMode }
  | { readonly type: "set-view"; readonly view: CameraView }
  | { readonly type: "select-entity"; readonly id: string | null }
  | { readonly type: "picked"; readonly info: PickInfo | null }
  | { readonly type: "set-reduced-motion"; readonly value: boolean | null }
  | { readonly type: "set-viewport-status"; readonly status: ViewportStatus };

export function initialLabState(exampleId: string): LabState {
  const example = getExample(exampleId) ?? getExample("angle-between-vectors");
  if (example === undefined) {
    throw new RangeError("no built-in examples registered");
  }
  const form = formFromScene(example.scene);
  return {
    exampleId: example.id,
    form,
    scene: example.scene,
    inputError: null,
    invalidSlots: [],
    analysis: runExampleAnalysis(example.id, example.scene),
    selectedEntityId: null,
    picked: null,
    hidden: {},
    opacity: {},
    planeOpacity: 0.35,
    projection: "perspective",
    view: "isometric",
    reducedMotionOverride: null,
    viewportStatus: "loading",
  };
}

/**
 * Renderer-owned slice of the lab state. Viewport3D owns the renderer
 * lifecycle (it reports status via set-viewport-status) and the camera/view
 * settings live inside the renderer once created — replacing the scene must
 * not desynchronise the reducer's mirror of them.
 */
function rendererOwnedState(
  state: LabState,
): Pick<LabState, "viewportStatus" | "view" | "projection" | "reducedMotionOverride"> {
  return {
    viewportStatus: state.viewportStatus,
    view: state.view,
    projection: state.projection,
    reducedMotionOverride: state.reducedMotionOverride,
  };
}

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case "select-example": {
      // Renderer-owned state survives an example switch: the Viewport3D
      // renderer is NOT recreated (only its scene graph is swapped), so
      // resetting viewportStatus to "loading" here would leave the toolbar
      // and PNG export permanently disabled (Stage 8 E2E finding).
      const next = initialLabState(action.exampleId);
      return { ...next, ...rendererOwnedState(state) };
    }
    case "load-scene": {
      // Stage 7: a stored/imported scene replaces the lab wholesale — the
      // analysis is re-run from the core solvers (never carried over).
      const example = getExample(action.exampleId);
      if (example === undefined) {
        return state;
      }
      return {
        ...initialLabState(example.id),
        ...rendererOwnedState(state),
        exampleId: example.id,
        form: formFromScene(action.scene),
        scene: action.scene,
        analysis: runExampleAnalysis(example.id, action.scene),
      };
    }
    case "reset-lab":
      return { ...initialLabState(DEFAULT_EXAMPLE_ID), ...rendererOwnedState(state) };
    case "set-coordinate": {
      const current = state.form[action.slotKey] ?? { x: "0", y: "0", z: "0" };
      const form: CoordinateForm = {
        ...state.form,
        [action.slotKey]: { ...current, [action.axis]: action.value },
      };
      const rebuilt = sceneFromForm(state.exampleId, state.scene, form);
      if (!rebuilt.ok) {
        return {
          ...state,
          form,
          inputError: rebuilt.error,
          invalidSlots: rebuilt.invalidSlots,
        };
      }
      return {
        ...state,
        form,
        scene: rebuilt.scene,
        analysis: runExampleAnalysis(state.exampleId, rebuilt.scene),
        inputError: null,
        invalidSlots: [],
      };
    }
    case "toggle-hidden":
      return {
        ...state,
        hidden: { ...state.hidden, [action.id]: !state.hidden[action.id] },
      };
    case "set-opacity":
      return {
        ...state,
        opacity: { ...state.opacity, [action.id]: action.opacity },
      };
    case "set-plane-opacity":
      return { ...state, planeOpacity: action.opacity };
    case "set-projection":
      return { ...state, projection: action.projection };
    case "set-view":
      return { ...state, view: action.view };
    case "select-entity":
      return { ...state, selectedEntityId: action.id };
    case "picked":
      return { ...state, picked: action.info };
    case "set-reduced-motion":
      return { ...state, reducedMotionOverride: action.value };
    case "set-viewport-status":
      return { ...state, viewportStatus: action.status };
  }
}
