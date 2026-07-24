/**
 * buildSceneGraph — the single pure entry point that maps a render
 * description (scene entities + DisplayGeometryV1 list) onto a THREE.Group
 * subtree. It never instantiates WebGLRenderer or any GL-dependent object,
 * so the whole graph is buildable and assertable under jsdom.
 *
 * The returned group carries a `SceneGraphMeta` (registry + legend model +
 * warnings) in `userData[SCENE_GRAPH_META_KEY]`; use `readSceneGraphMeta`
 * to access it in a typed way.
 */

import * as THREE from "three";
import type {
  DisplayGeometryV1,
  Line3V1,
  Plane3V1,
  Point3V1,
  VectorEntityV1,
} from "@/features/vector-geometry-lab/schema";
import { createArrow } from "./arrows.js";
import { createAxesGroup } from "./axes.js";
import {
  buildDisplayEntry,
  createLineWindowObject,
  createPlaneObject,
  createPointObject,
  resolveSceneBuildOptions,
} from "./display-builders.js";
import type { BuilderContext, SceneBuildOptions } from "./display-builders.js";
import { attachLabel } from "./labels.js";
import { buildLegendModel } from "./legend.js";
import type { LegendModel } from "./legend.js";
import { pointToDisplayPosition, vector3ToDisplay } from "./scalars.js";
import { DISPLAY_STYLES } from "./styles.js";
import { VG_ID_USER_DATA_KEY } from "./types.js";
import type { SceneEntityMeta, SceneObjectEntry } from "./types.js";

/** userData key holding the SceneGraphMeta on the returned group. */
export const SCENE_GRAPH_META_KEY = "exambridgeVectorGeometrySceneGraph";

/** Render description consumed by buildSceneGraph. */
export interface BuildSceneGraphInput {
  readonly points?: readonly Point3V1[];
  readonly vectors?: readonly VectorEntityV1[];
  readonly lines?: readonly Line3V1[];
  readonly planes?: readonly Plane3V1[];
  readonly displayGeometry?: readonly DisplayGeometryV1[];
  /**
   * Caller metadata (name/equationText/keyParams) keyed by entity id or
   * displayId. Equation text is produced by the math/explain layers; the
   * renderer only displays it (pick callbacks, future tooltips).
   */
  readonly metadata?: readonly SceneEntityMeta[];
}

export interface SceneGraphMeta {
  readonly registry: readonly SceneObjectEntry[];
  readonly legend: LegendModel;
  readonly warnings: readonly string[];
}

const EPSILON = 1e-9;

function entityLabel(
  explicit: string | undefined,
  fallback: string,
): string {
  return explicit !== undefined && explicit.length > 0 ? explicit : fallback;
}

function addEntityPoint(
  point: Point3V1,
  meta: SceneEntityMeta | undefined,
  ctx: BuilderContext,
  registry: SceneObjectEntry[],
  root: THREE.Group,
): void {
  const { options } = ctx;
  const style = DISPLAY_STYLES.point;
  const group = new THREE.Group();
  group.name = `entity:point:${point.pointId}`;
  group.add(
    createPointObject(
      pointToDisplayPosition(point),
      style.colorHex,
      options.pointRadius,
    ),
  );
  const name = entityLabel(meta?.name, point.label);
  attachLabel(group, name, new THREE.Vector3(0.15, 0.3, 0), {
    labelsEnabled: options.labelsEnabled,
    ...(options.canvasFactory !== undefined
      ? { canvasFactory: options.canvasFactory }
      : {}),
    ...(options.font !== undefined ? { font: options.font } : {}),
  });
  group.userData[VG_ID_USER_DATA_KEY] = point.pointId;
  registry.push({
    id: point.pointId,
    kind: "point",
    name,
    object3d: group,
    equationText: meta?.equationText ?? "",
    keyParams: meta?.keyParams ?? {},
  });
  root.add(group);
}

function addEntityVector(
  vector: VectorEntityV1,
  meta: SceneEntityMeta | undefined,
  ctx: BuilderContext,
  registry: SceneObjectEntry[],
  root: THREE.Group,
): void {
  const { options, warnings } = ctx;
  const style = DISPLAY_STYLES["vector-arrow"];
  const components = vector3ToDisplay(vector.components);
  const from =
    vector.origin !== undefined
      ? pointToDisplayPosition(vector.origin)
      : new THREE.Vector3(0, 0, 0);
  const group = new THREE.Group();
  group.name = `entity:vector:${vector.vectorId}`;
  const name = entityLabel(meta?.name, vector.label);
  if (components.length() < EPSILON) {
    // Zero free vector: legal input, refused by angle solvers. Displayed as
    // a marker chip so the scene still shows it (never silently dropped).
    const marker = createPointObject(from, style.colorHex, 0.07);
    marker.name = "vector-zero-marker";
    group.add(marker);
    warnings.push(
      `vector ${vector.vectorId}: zero components drawn as a marker, not an arrow`,
    );
  } else {
    group.add(
      createArrow(from, from.clone().add(components), {
        color: style.colorHex,
        lineStyle: "solid",
      }),
    );
  }
  attachLabel(
    group,
    name,
    from
      .clone()
      .addScaledVector(components, 0.5)
      .add(new THREE.Vector3(0.1, 0.25, 0)),
    {
      labelsEnabled: options.labelsEnabled,
      ...(options.canvasFactory !== undefined
        ? { canvasFactory: options.canvasFactory }
        : {}),
      ...(options.font !== undefined ? { font: options.font } : {}),
    },
  );
  group.userData[VG_ID_USER_DATA_KEY] = vector.vectorId;
  registry.push({
    id: vector.vectorId,
    kind: "vector-arrow",
    name,
    object3d: group,
    equationText: meta?.equationText ?? "",
    keyParams: meta?.keyParams ?? {},
  });
  root.add(group);
}

function addEntityLine(
  line: Line3V1,
  meta: SceneEntityMeta | undefined,
  ctx: BuilderContext,
  registry: SceneObjectEntry[],
  root: THREE.Group,
): void {
  const { options } = ctx;
  const style = DISPLAY_STYLES.line;
  const point = pointToDisplayPosition(line.point);
  const direction = vector3ToDisplay(line.direction);
  const group = new THREE.Group();
  group.name = `entity:line:${line.lineId}`;
  const name = entityLabel(meta?.name, line.label);
  group.add(
    createLineWindowObject(
      point,
      direction,
      style.colorHex,
      options.viewExtent,
      options.lineExtensionLength,
    ),
  );
  attachLabel(
    group,
    name,
    point
      .clone()
      .addScaledVector(direction.clone().normalize(), options.viewExtent)
      .add(new THREE.Vector3(0, 0.25, 0)),
    {
      labelsEnabled: options.labelsEnabled,
      ...(options.canvasFactory !== undefined
        ? { canvasFactory: options.canvasFactory }
        : {}),
      ...(options.font !== undefined ? { font: options.font } : {}),
    },
  );
  group.userData[VG_ID_USER_DATA_KEY] = line.lineId;
  registry.push({
    id: line.lineId,
    kind: "line",
    name,
    object3d: group,
    equationText: meta?.equationText ?? "",
    keyParams: meta?.keyParams ?? {},
  });
  root.add(group);
}

function addEntityPlane(
  plane: Plane3V1,
  meta: SceneEntityMeta | undefined,
  ctx: BuilderContext,
  registry: SceneObjectEntry[],
  root: THREE.Group,
  color: number,
): void {
  const { options } = ctx;
  const normalStyle = DISPLAY_STYLES["normal-arrow"];
  const point = pointToDisplayPosition(plane.point);
  const normal = vector3ToDisplay(plane.normal);
  const group = new THREE.Group();
  group.name = `entity:plane:${plane.planeId}`;
  const name = entityLabel(meta?.name, plane.label);
  group.add(
    createPlaneObject(
      point,
      normal,
      color,
      options.planeSize,
      options.planeOpacity,
    ),
  );
  // Plane normal is a must-display element (spec §5): dashed arrow so it
  // cannot be confused with a plain vector even in greyscale.
  const normalLength = Math.min(2, Math.max(1, normal.length()));
  group.add(
    createArrow(point, point.clone().addScaledVector(normal.clone().normalize(), normalLength), {
      color: normalStyle.colorHex,
      lineStyle: "dashed",
    }),
  );
  attachLabel(
    group,
    name,
    point.clone().add(new THREE.Vector3(options.planeSize / 2, 0.25, 0)),
    {
      labelsEnabled: options.labelsEnabled,
      ...(options.canvasFactory !== undefined
        ? { canvasFactory: options.canvasFactory }
        : {}),
      ...(options.font !== undefined ? { font: options.font } : {}),
    },
  );
  group.userData[VG_ID_USER_DATA_KEY] = plane.planeId;
  registry.push({
    id: plane.planeId,
    kind: "plane",
    name,
    object3d: group,
    equationText: meta?.equationText ?? "",
    keyParams: meta?.keyParams ?? {},
  });
  root.add(group);
}

/**
 * Builds the scene graph. Output: a THREE.Group whose direct children are
 * the orientation scaffold plus one subgroup per registry entry. The meta
 * (registry/legend/warnings) is attached to `group.userData`.
 */
export function buildSceneGraph(
  input: BuildSceneGraphInput,
  options: SceneBuildOptions = {},
): THREE.Group {
  const resolved = resolveSceneBuildOptions(options);
  const warnings: string[] = [];
  const ctx: BuilderContext = { options: resolved, warnings };
  const root = new THREE.Group();
  root.name = "vector-geometry-scene-graph";
  const registry: SceneObjectEntry[] = [];

  if (resolved.includeAxes) {
    const axes = createAxesGroup({
      halfLength: resolved.axisHalfLength,
      labelsEnabled: resolved.labelsEnabled,
      includeGrid: resolved.includeGrid,
      ...(resolved.canvasFactory !== undefined
        ? { canvasFactory: resolved.canvasFactory }
        : {}),
      ...(resolved.font !== undefined ? { font: resolved.font } : {}),
    });
    root.add(axes.object3d);
    registry.push(...axes.entries);
  }

  const metaById = new Map<string, SceneEntityMeta>();
  for (const meta of input.metadata ?? []) {
    metaById.set(meta.id, meta);
  }

  for (const point of input.points ?? []) {
    addEntityPoint(point, metaById.get(point.pointId), ctx, registry, root);
  }
  for (const vector of input.vectors ?? []) {
    addEntityVector(vector, metaById.get(vector.vectorId), ctx, registry, root);
  }
  for (const line of input.lines ?? []) {
    addEntityLine(line, metaById.get(line.lineId), ctx, registry, root);
  }
  const planeColors = [DISPLAY_STYLES.plane.colorHex, 0x6f60aa, 0x0072b2, 0xe69f00];
  for (const [index, plane] of (input.planes ?? []).entries()) {
    addEntityPlane(
      plane,
      metaById.get(plane.planeId),
      ctx,
      registry,
      root,
      planeColors[index % planeColors.length] ?? DISPLAY_STYLES.plane.colorHex,
    );
  }
  for (const display of input.displayGeometry ?? []) {
    const entry = buildDisplayEntry(display, metaById.get(display.displayId), ctx);
    if (entry !== null) {
      registry.push(entry);
      root.add(entry.object3d);
    }
  }

  const meta: SceneGraphMeta = {
    registry,
    legend: buildLegendModel(registry),
    warnings,
  };
  root.userData[SCENE_GRAPH_META_KEY] = meta;
  return root;
}

/** Typed accessor for the meta attached by buildSceneGraph. */
export function readSceneGraphMeta(
  group: THREE.Group,
): SceneGraphMeta | undefined {
  const raw = (group.userData as Record<string, unknown>)[SCENE_GRAPH_META_KEY];
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const candidate = raw as Partial<SceneGraphMeta>;
  if (!Array.isArray(candidate.registry) || !Array.isArray(candidate.warnings)) {
    return undefined;
  }
  return raw as SceneGraphMeta;
}
