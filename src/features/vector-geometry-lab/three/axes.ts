/**
 * Axes, grid and origin marker — the always-present orientation scaffold
 * (spec §5 必含元素). Each axis encodes polarity WITHOUT relying on colour:
 * the positive arm is a solid line, the negative arm is dashed, and the
 * positive end carries an axis label sprite ("x" / "y" / "z").
 */

import * as THREE from "three";
import { AXIS_COLORS } from "./styles.js";
import type { AxisName } from "./styles.js";
import { attachLabel } from "./labels.js";
import type { TextSpriteOptions } from "./labels.js";
import { VG_ID_USER_DATA_KEY } from "./types.js";
import type { SceneObjectEntry } from "./types.js";

export interface AxesBuildOptions extends TextSpriteOptions {
  readonly halfLength?: number;
  readonly gridSize?: number;
  readonly gridDivisions?: number;
  readonly labelsEnabled?: boolean;
  readonly includeGrid?: boolean;
}

const AXIS_DIRECTIONS: Readonly<Record<AxisName, THREE.Vector3>> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

function axisEntry(
  id: string,
  name: string,
  object3d: THREE.Object3D,
): SceneObjectEntry {
  object3d.userData[VG_ID_USER_DATA_KEY] = id;
  return {
    id,
    kind: "axis",
    name,
    object3d,
    equationText: "",
    keyParams: {},
  };
}

function buildAxisArm(
  direction: THREE.Vector3,
  from: number,
  to: number,
  color: number,
  dashed: boolean,
  name: string,
): THREE.Line {
  const points = [
    direction.clone().multiplyScalar(from),
    direction.clone().multiplyScalar(to),
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  if (dashed) {
    const material = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.2,
      gapSize: 0.12,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.name = name;
    return line;
  }
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color }),
  );
  line.name = name;
  return line;
}

/**
 * Builds the orientation scaffold and its registry entries
 * ("axis-x" / "axis-y" / "axis-z" / "grid" / "origin").
 */
export function createAxesGroup(options: AxesBuildOptions = {}): {
  readonly object3d: THREE.Group;
  readonly entries: readonly SceneObjectEntry[];
} {
  const halfLength = options.halfLength ?? 6;
  const group = new THREE.Group();
  group.name = "orientation-scaffold";
  const entries: SceneObjectEntry[] = [];

  for (const axisName of ["x", "y", "z"] as const) {
    const axisGroup = new THREE.Group();
    axisGroup.name = `axis-${axisName}`;
    const colors = AXIS_COLORS[axisName];
    const direction = AXIS_DIRECTIONS[axisName];
    axisGroup.add(
      buildAxisArm(direction, 0, halfLength, colors.colorHex, false, "axis-arm-positive"),
    );
    axisGroup.add(
      buildAxisArm(direction, -halfLength, 0, colors.colorHex, true, "axis-arm-negative"),
    );
    attachLabel(
      axisGroup,
      colors.label,
      direction.clone().multiplyScalar(halfLength * 1.08),
      options,
    );
    entries.push(axisEntry(`axis-${axisName}`, `${axisName} axis`, axisGroup));
    group.add(axisGroup);
  }

  if (options.includeGrid !== false) {
    const gridSize = options.gridSize ?? halfLength * 2;
    const grid = new THREE.GridHelper(
      gridSize,
      options.gridDivisions ?? Math.max(2, Math.round(gridSize)),
      0x666666,
      0xbbbbbb,
    );
    grid.name = "grid";
    grid.userData[VG_ID_USER_DATA_KEY] = "grid";
    entries.push({
      id: "grid",
      kind: "grid",
      name: "grid (xz plane)",
      object3d: grid,
      equationText: "",
      keyParams: {},
    });
    group.add(grid);
  }

  const origin = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  origin.name = "origin-marker";
  origin.userData[VG_ID_USER_DATA_KEY] = "origin";
  // Keep the origin label away from vectors and lines that commonly start
  // at O, avoiding the label cluster visible in dense teaching scenes.
  attachLabel(origin, "O", new THREE.Vector3(-0.55, -0.32, 0.18), options);
  entries.push({
    id: "origin",
    kind: "origin-marker",
    name: "origin O = (0, 0, 0)",
    object3d: origin,
    equationText: "",
    keyParams: {},
  });
  group.add(origin);

  return { object3d: group, entries };
}
