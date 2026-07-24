/**
 * Display-object builders: the pure "math contract → THREE object" mapping.
 *
 * Every builder consumes ONLY the math-layer payload (ScalarV1 coordinates,
 * directions, normals, labels). Float conversions go through scalars.ts and
 * are one-way, display-only. No builder touches WebGLRenderer or any other
 * GL-dependent object, so all of them run under jsdom.
 */

import * as THREE from "three";
import type { DisplayGeometryV1 } from "@/features/vector-geometry-lab/schema";
import { createArrow } from "./arrows.js";
import { attachLabel } from "./labels.js";
import type { TextSpriteOptions } from "./labels.js";
import { pointToDisplayPosition, vector3ToDisplay } from "./scalars.js";
import { DISPLAY_STYLES } from "./styles.js";
import { VG_ID_USER_DATA_KEY } from "./types.js";
import type { SceneEntityMeta, SceneObjectEntry } from "./types.js";

/** Knobs that shape the scene graph; all display-only, never mathematical. */
export interface SceneBuildOptions extends TextSpriteOptions {
  /** Half-length of the finite window used for infinite lines (default 10). */
  readonly viewExtent?: number;
  /** Extra dashed tail drawn beyond the solid window (default 5). */
  readonly lineExtensionLength?: number;
  /** Edge length of the finite translucent plane quad (default 8). */
  readonly planeSize?: number;
  /** Plane surface opacity in [0, 1] (default 0.35). */
  readonly planeOpacity?: number;
  /** Point/intersection marker radius (default 0.08). */
  readonly pointRadius?: number;
  /** Segment tube radius (default 0.045). */
  readonly segmentRadius?: number;
  /** Angle-arc radius in world units (default 1). */
  readonly arcRadius?: number;
  /** Angle-arc tessellation steps (default 48). */
  readonly arcSegments?: number;
  /**
   * Sweep used when the caller supplies no "sweepDegrees" keyParam for an
   * angle-arc payload. The math payload carries the start direction and the
   * arc-plane normal; the caller that knows the solved angle SHOULD pass it
   * through metadata.keyParams.sweepDegrees (default 90).
   */
  readonly defaultArcSweepDegrees?: number;
  /** Draw text label sprites (default true). */
  readonly labelsEnabled?: boolean;
  /** Draw the axis/grid/origin scaffold (default true). */
  readonly includeAxes?: boolean;
  readonly includeGrid?: boolean;
  readonly axisHalfLength?: number;
}

export interface ResolvedSceneBuildOptions {
  readonly viewExtent: number;
  readonly lineExtensionLength: number;
  readonly planeSize: number;
  readonly planeOpacity: number;
  readonly pointRadius: number;
  readonly segmentRadius: number;
  readonly arcRadius: number;
  readonly arcSegments: number;
  readonly defaultArcSweepDegrees: number;
  readonly labelsEnabled: boolean;
  readonly includeAxes: boolean;
  readonly includeGrid: boolean;
  readonly axisHalfLength: number;
  readonly canvasFactory?: TextSpriteOptions["canvasFactory"];
  readonly font?: string;
}

export function resolveSceneBuildOptions(
  options: SceneBuildOptions = {},
): ResolvedSceneBuildOptions {
  const base: ResolvedSceneBuildOptions = {
    viewExtent: options.viewExtent ?? 10,
    lineExtensionLength: options.lineExtensionLength ?? 5,
    planeSize: options.planeSize ?? 8,
    planeOpacity: options.planeOpacity ?? 0.35,
    pointRadius: options.pointRadius ?? 0.08,
    segmentRadius: options.segmentRadius ?? 0.045,
    arcRadius: options.arcRadius ?? 1,
    arcSegments: Math.max(4, options.arcSegments ?? 48),
    defaultArcSweepDegrees: options.defaultArcSweepDegrees ?? 90,
    labelsEnabled: options.labelsEnabled ?? true,
    includeAxes: options.includeAxes ?? true,
    includeGrid: options.includeGrid ?? true,
    axisHalfLength: options.axisHalfLength ?? 6,
  };
  return {
    ...base,
    ...(options.canvasFactory !== undefined
      ? { canvasFactory: options.canvasFactory }
      : {}),
    ...(options.font !== undefined ? { font: options.font } : {}),
  };
}

const EPSILON = 1e-9;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const PLANE_DEFAULT_NORMAL = new THREE.Vector3(0, 0, 1);

export interface BuilderContext {
  readonly options: ResolvedSceneBuildOptions;
  readonly warnings: string[];
}

function labelOptions(ctx: BuilderContext): TextSpriteOptions & {
  readonly labelsEnabled: boolean;
} {
  const { options } = ctx;
  return {
    labelsEnabled: options.labelsEnabled,
    ...(options.canvasFactory !== undefined
      ? { canvasFactory: options.canvasFactory }
      : {}),
    ...(options.font !== undefined ? { font: options.font } : {}),
  };
}

function makeEntry(
  id: string,
  kind: SceneObjectEntry["kind"],
  name: string,
  object3d: THREE.Object3D,
  meta: SceneEntityMeta | undefined,
): SceneObjectEntry {
  object3d.userData[VG_ID_USER_DATA_KEY] = id;
  return {
    id,
    kind,
    name,
    object3d,
    equationText: meta?.equationText ?? "",
    keyParams: meta?.keyParams ?? {},
  };
}

/** Point marker: small sphere + optional label (kind "point"). */
export function createPointObject(
  position: THREE.Vector3,
  color: number,
  radius: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 20),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.position.copy(position);
  mesh.name = "point-marker";
  return mesh;
}

/**
 * Infinite line as a finite view window: solid segment of half-length
 * `viewExtent` around the defining point, plus dashed tails on BOTH ends
 * (the dashed channel says "continues to infinity", not a colour).
 */
export function createLineWindowObject(
  point: THREE.Vector3,
  direction: THREE.Vector3,
  color: number,
  viewExtent: number,
  extensionLength: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "line-window";
  const dir = direction.clone().normalize();
  const windowStart = point.clone().addScaledVector(dir, -viewExtent);
  const windowEnd = point.clone().addScaledVector(dir, viewExtent);

  const solid = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([windowStart, windowEnd]),
    new THREE.LineBasicMaterial({ color }),
  );
  solid.name = "line-window-solid";
  group.add(solid);

  for (const sign of [-1, 1] as const) {
    const tailStart = point
      .clone()
      .addScaledVector(dir, sign * viewExtent);
    const tailEnd = point
      .clone()
      .addScaledVector(dir, sign * (viewExtent + extensionLength));
    const tail = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([tailStart, tailEnd]),
      new THREE.LineDashedMaterial({ color, dashSize: 0.25, gapSize: 0.15 }),
    );
    tail.computeLineDistances();
    tail.name = sign > 0 ? "line-extension-positive" : "line-extension-negative";
    group.add(tail);
  }
  return group;
}

/**
 * Translucent plane quad: double-sided, opacity-configurable, with a solid
 * boundary outline so the plane is identifiable even when the fill is
 * nearly invisible against the background.
 */
export function createPlaneObject(
  point: THREE.Vector3,
  normal: THREE.Vector3,
  color: number,
  size: number,
  opacity: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "plane-quad";
  const geometry = new THREE.PlaneGeometry(size, size);
  const surface = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  surface.name = "plane-surface";
  group.add(surface);

  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color }),
  );
  outline.name = "plane-outline";
  group.add(outline);

  const n = normal.clone().normalize();
  group.quaternion.setFromUnitVectors(PLANE_DEFAULT_NORMAL, n);
  group.position.copy(point);
  return group;
}

/**
 * Shortest-distance segment: rendered as a solid TUBE (cylinder) with end
 * caps — deliberately more salient than the thin line strokes used for
 * infinite lines, so it reads as the highlighted result.
 */
export function createSegmentObject(
  from: THREE.Vector3,
  to: THREE.Vector3,
  color: number,
  radius: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "distance-segment";
  const delta = new THREE.Vector3().subVectors(to, from);
  const length = delta.length();
  if (length < EPSILON) {
    const marker = createPointObject(from, color, Math.max(radius, 0.07));
    marker.name = "segment-degenerate-marker";
    group.add(marker);
    return group;
  }
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 12),
    new THREE.MeshBasicMaterial({ color }),
  );
  tube.name = "segment-tube";
  tube.position.copy(from).addScaledVector(delta, 0.5);
  tube.quaternion.setFromUnitVectors(WORLD_UP, delta.clone().normalize());
  group.add(tube);
  for (const [index, end] of [from, to].entries()) {
    const cap = createPointObject(end, color, radius * 2);
    cap.name = `segment-end-${index}`;
    group.add(cap);
  }
  return group;
}

export interface AngleArcBuildResult {
  readonly object3d: THREE.Group;
  /** Arc polyline points in world space (for tests/inspection). */
  readonly arcPoints: readonly THREE.Vector3[];
  readonly sweepDegrees: number;
  readonly degenerate: boolean;
}

/**
 * Angle arc/sector (spec §5 夹角圆弧或扇形). Consumes the math-layer
 * angle-arc payload: `vertex` (points[0]), `startDirection` (direction) and
 * the normal of the plane containing the arc (normal, = b1×b2). The arc is
 * built as vertex + r·(cosθ·e1 + sinθ·(n̂×e1)) for θ ∈ [0, sweep], so every
 * arc point lies in the plane through the vertex spanned by the start and
 * end directions. A sector fan fill is added at 25% opacity.
 *
 * `sweepDegrees` comes from caller metadata (the solved angle); when absent
 * `defaultSweepDegrees` is used. When the payload omits the normal (the
 * 0°/180° degenerate case) no arc can be drawn — a marker chip plus the
 * label is produced instead and `degenerate` is set.
 */
export function createAngleArcObject(
  vertex: THREE.Vector3,
  startDirection: THREE.Vector3,
  arcNormal: THREE.Vector3 | undefined,
  sweepDegrees: number,
  color: number,
  radius: number,
  segments: number,
): AngleArcBuildResult {
  const group = new THREE.Group();
  group.name = "angle-arc";
  const e1 = startDirection.clone();
  const degenerate =
    e1.length() < EPSILON ||
    arcNormal === undefined ||
    arcNormal.length() < EPSILON;

  if (degenerate) {
    const marker = createPointObject(vertex, color, 0.07);
    marker.name = "angle-arc-degenerate-marker";
    group.add(marker);
    return { object3d: group, arcPoints: [], sweepDegrees: 0, degenerate: true };
  }

  e1.normalize();
  const n = arcNormal.clone().normalize();
  const e2 = new THREE.Vector3().crossVectors(n, e1);
  if (e2.length() < EPSILON) {
    const marker = createPointObject(vertex, color, 0.07);
    marker.name = "angle-arc-degenerate-marker";
    group.add(marker);
    return { object3d: group, arcPoints: [], sweepDegrees: 0, degenerate: true };
  }
  e2.normalize();

  const clampedSweep = Math.min(360, Math.max(0.1, Math.abs(sweepDegrees)));
  const signedSweep = sweepDegrees < 0 ? -clampedSweep : clampedSweep;
  const sweepRadians = (signedSweep * Math.PI) / 180;

  const arcPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const theta = (sweepRadians * i) / segments;
    arcPoints.push(
      vertex
        .clone()
        .addScaledVector(e1, Math.cos(theta) * radius)
        .addScaledVector(e2, Math.sin(theta) * radius),
    );
  }

  const arc = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(arcPoints),
    new THREE.LineBasicMaterial({ color }),
  );
  arc.name = "angle-arc-line";
  group.add(arc);

  const fanPositions: number[] = [vertex.x, vertex.y, vertex.z];
  for (const p of arcPoints) {
    fanPositions.push(p.x, p.y, p.z);
  }
  const fanIndices: number[] = [];
  for (let i = 1; i < arcPoints.length; i += 1) {
    fanIndices.push(0, i, i + 1);
  }
  const fanGeometry = new THREE.BufferGeometry();
  fanGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(fanPositions, 3),
  );
  fanGeometry.setIndex(fanIndices);
  const sector = new THREE.Mesh(
    fanGeometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  sector.name = "angle-arc-sector";
  group.add(sector);

  return {
    object3d: group,
    arcPoints,
    sweepDegrees: signedSweep,
    degenerate: false,
  };
}

function parseSweepDegrees(meta: SceneEntityMeta | undefined): number | undefined {
  const raw = meta?.keyParams["sweepDegrees"];
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Maps one DisplayGeometryV1 payload to a registry entry. Returns null (and
 * records a warning) when the payload lacks the data its kind requires —
 * malformed display payloads must never crash the scene build.
 */
export function buildDisplayEntry(
  display: DisplayGeometryV1,
  meta: SceneEntityMeta | undefined,
  ctx: BuilderContext,
): SceneObjectEntry | null {
  const { options, warnings } = ctx;
  const name =
    meta?.name ?? (display.label.length > 0 ? display.label : display.displayId);
  const style = DISPLAY_STYLES[display.kind];
  const group = new THREE.Group();
  group.name = `display:${display.kind}:${display.displayId}`;
  const anchor = display.points[0];

  switch (display.kind) {
    case "point": {
      if (anchor === undefined) {
        warnings.push(`display ${display.displayId}: kind "point" needs points[0]`);
        return null;
      }
      group.add(
        createPointObject(
          pointToDisplayPosition(anchor),
          style.colorHex,
          options.pointRadius,
        ),
      );
      attachLabel(group, name, new THREE.Vector3(0.15, 0.3, 0), labelOptions(ctx));
      break;
    }
    case "vector-arrow":
    case "normal-arrow": {
      if (display.direction === undefined) {
        warnings.push(
          `display ${display.displayId}: kind "${display.kind}" needs direction`,
        );
        return null;
      }
      const from =
        anchor !== undefined
          ? pointToDisplayPosition(anchor)
          : new THREE.Vector3(0, 0, 0);
      const direction = vector3ToDisplay(display.direction);
      if (direction.length() < EPSILON) {
        warnings.push(
          `display ${display.displayId}: zero direction cannot be drawn as an arrow`,
        );
        return null;
      }
      group.add(
        createArrow(from, from.clone().add(direction), {
          color: style.colorHex,
          lineStyle: display.kind === "normal-arrow" ? "dashed" : "solid",
        }),
      );
      attachLabel(
        group,
        name,
        from
          .clone()
          .addScaledVector(direction, 0.5)
          .add(new THREE.Vector3(0.1, 0.25, 0)),
        labelOptions(ctx),
      );
      group.position.set(0, 0, 0);
      break;
    }
    case "line": {
      if (anchor === undefined || display.direction === undefined) {
        warnings.push(
          `display ${display.displayId}: kind "line" needs points[0] and direction`,
        );
        return null;
      }
      const point = pointToDisplayPosition(anchor);
      const direction = vector3ToDisplay(display.direction);
      if (direction.length() < EPSILON) {
        warnings.push(`display ${display.displayId}: zero line direction`);
        return null;
      }
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
        labelOptions(ctx),
      );
      break;
    }
    case "plane": {
      if (anchor === undefined || display.normal === undefined) {
        warnings.push(
          `display ${display.displayId}: kind "plane" needs points[0] and normal`,
        );
        return null;
      }
      const point = pointToDisplayPosition(anchor);
      const normal = vector3ToDisplay(display.normal);
      if (normal.length() < EPSILON) {
        warnings.push(`display ${display.displayId}: zero plane normal`);
        return null;
      }
      group.add(
        createPlaneObject(
          point,
          normal,
          style.colorHex,
          options.planeSize,
          options.planeOpacity,
        ),
      );
      attachLabel(
        group,
        name,
        point.clone().add(new THREE.Vector3(options.planeSize / 2, 0.25, 0)),
        labelOptions(ctx),
      );
      break;
    }
    case "segment": {
      const from = display.points[0];
      const to = display.points[1];
      if (from === undefined || to === undefined) {
        warnings.push(
          `display ${display.displayId}: kind "segment" needs points[0] and points[1]`,
        );
        return null;
      }
      const fromV = pointToDisplayPosition(from);
      const toV = pointToDisplayPosition(to);
      group.add(
        createSegmentObject(fromV, toV, style.colorHex, options.segmentRadius),
      );
      attachLabel(
        group,
        name,
        fromV.clone().add(toV).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.25, 0)),
        labelOptions(ctx),
      );
      break;
    }
    case "angle-arc": {
      if (anchor === undefined || display.direction === undefined) {
        warnings.push(
          `display ${display.displayId}: kind "angle-arc" needs points[0] and direction`,
        );
        return null;
      }
      const sweep =
        parseSweepDegrees(meta) ?? options.defaultArcSweepDegrees;
      const built = createAngleArcObject(
        pointToDisplayPosition(anchor),
        vector3ToDisplay(display.direction),
        display.normal !== undefined
          ? vector3ToDisplay(display.normal)
          : undefined,
        sweep,
        style.colorHex,
        options.arcRadius,
        options.arcSegments,
      );
      group.add(built.object3d);
      const vertexV = pointToDisplayPosition(anchor);
      const midArc =
        built.arcPoints.length > 0
          ? built.arcPoints[Math.floor(built.arcPoints.length / 2)] ?? vertexV
          : vertexV;
      const labelAnchor = vertexV
        .clone()
        .addScaledVector(midArc.clone().sub(vertexV), 1.15)
        .add(new THREE.Vector3(0, 0.15, 0));
      attachLabel(group, name, labelAnchor, labelOptions(ctx));
      break;
    }
  }

  return makeEntry(display.displayId, display.kind, name, group, meta);
}
