/**
 * Arrow objects. A self-built arrow (cylinder/cone for solid shafts, dashed
 * Line + cone for dashed shafts) instead of ArrowHelper so the line-style
 * channel is explicit and testable: plain vectors are SOLID, plane normals
 * are DASHED — colour is never the only differentiator.
 */

import * as THREE from "three";

export interface ArrowOptions {
  readonly color: number;
  readonly lineStyle: "solid" | "dashed";
  readonly shaftRadius?: number;
  readonly headRadius?: number;
  readonly headLength?: number;
  readonly dashSize?: number;
  readonly gapSize?: number;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const EPSILON = 1e-9;

/**
 * Builds an arrow from `from` to `to`. A degenerate (zero-length) arrow is
 * replaced by a small sphere so a malformed payload can never crash the
 * build — it stays visible and inspectable instead.
 */
export function createArrow(
  from: THREE.Vector3,
  to: THREE.Vector3,
  options: ArrowOptions,
): THREE.Group {
  const group = new THREE.Group();
  const delta = new THREE.Vector3().subVectors(to, from);
  const length = delta.length();

  if (length < EPSILON) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshBasicMaterial({ color: options.color }),
    );
    marker.name = "arrow-degenerate-marker";
    group.add(marker);
    group.position.copy(from);
    return group;
  }

  const shaftRadius = options.shaftRadius ?? 0.035;
  const headRadius = options.headRadius ?? 0.1;
  const headLength = Math.min(options.headLength ?? 0.3, length * 0.5);
  const shaftLength = length - headLength;

  if (options.lineStyle === "solid") {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 12),
      new THREE.MeshBasicMaterial({ color: options.color }),
    );
    shaft.position.set(0, shaftLength / 2, 0);
    shaft.name = "arrow-shaft-solid";
    group.add(shaft);
  } else {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, shaftLength, 0),
    ]);
    const material = new THREE.LineDashedMaterial({
      color: options.color,
      dashSize: options.dashSize ?? 0.16,
      gapSize: options.gapSize ?? 0.1,
    });
    const shaft = new THREE.Line(geometry, material);
    shaft.computeLineDistances();
    shaft.name = "arrow-shaft-dashed";
    group.add(shaft);
  }

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(headRadius, headLength, 16),
    new THREE.MeshBasicMaterial({ color: options.color }),
  );
  head.position.set(0, shaftLength + headLength / 2, 0);
  head.name = "arrow-head";
  group.add(head);

  const direction = delta.clone().normalize();
  group.quaternion.setFromUnitVectors(WORLD_UP, direction);
  group.position.copy(from);
  return group;
}
