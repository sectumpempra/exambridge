/**
 * Scene facts — the caller-supplied subject of every explanation: known
 * inputs, the objects' vector equations, and direction vectors / normals.
 * Equations come from the core equation solvers (math truth stays in core).
 */

import type {
  Vector3V1,
  VectorGeometrySceneV1,
} from "@/features/vector-geometry-lab/schema";
import {
  lineEquationsFromLine3,
  planeEquationsFromPlane3,
} from "@/features/vector-geometry-lab/core";
import type { SceneEntityMeta } from "@/features/vector-geometry-lab/three";
import type {
  EquationRef,
  ExplanationSubject,
  KeyValuePair,
} from "@/features/vector-geometry-lab/explain";
import { formatScalar, formatVector } from "./format.js";

/** knownInputs / equations / directionVectors shared by all analyzers. */
export function describeScene(scene: VectorGeometrySceneV1): ExplanationSubject {
  const knownInputs: KeyValuePair[] = [];
  const equations: EquationRef[] = [];
  const directionVectors: KeyValuePair[] = [];

  for (const point of scene.points) {
    knownInputs.push({
      key: `point ${point.label}`,
      value: formatVector(point.position),
    });
  }
  for (const vector of scene.vectors) {
    const origin =
      vector.origin !== undefined
        ? ` from ${formatVector(vector.origin.position)}`
        : " (free vector)";
    knownInputs.push({
      key: `vector ${vector.label}`,
      value: `${formatVector(vector.components)}${origin}`,
    });
    directionVectors.push({
      key: `components of ${vector.label}`,
      value: formatVector(vector.components),
    });
  }
  for (const line of scene.lines) {
    knownInputs.push({
      key: `line ${line.label}`,
      value: `through ${formatVector(line.point.position)} with direction ${formatVector(line.direction)}`,
    });
    const forms = lineEquationsFromLine3(line);
    if (forms.ok) {
      equations.push({
        label: `line ${line.label}`,
        equation: forms.value.result.vector,
      });
      equations.push({
        label: `line ${line.label} (parametric)`,
        equation: forms.value.result.parametric,
      });
    }
    directionVectors.push({
      key: `direction of line ${line.label}`,
      value: formatVector(line.direction),
    });
  }
  for (const plane of scene.planes) {
    knownInputs.push({
      key: `plane ${plane.label}`,
      value: `through ${formatVector(plane.point.position)} with normal ${formatVector(plane.normal)}`,
    });
    const forms = planeEquationsFromPlane3(plane);
    if (forms.ok) {
      equations.push({
        label: `plane ${plane.label} (normal form)`,
        equation: forms.value.result.normalForm,
      });
      equations.push({
        label: `plane ${plane.label} (Cartesian)`,
        equation: forms.value.result.cartesianForm,
      });
    }
    directionVectors.push({
      key: `normal of plane ${plane.label}`,
      value: formatVector(plane.normal),
    });
  }
  return { knownInputs, equations, directionVectors };
}

function coordinateParams(prefix: string, vector: Vector3V1): Record<string, string> {
  return {
    [`${prefix} x`]: formatScalar(vector.x),
    [`${prefix} y`]: formatScalar(vector.y),
    [`${prefix} z`]: formatScalar(vector.z),
  };
}

/**
 * Pick/right-panel metadata for every scene entity (name, equation text,
 * key parameters). Equation text is produced by core; the renderer only
 * displays it.
 */
export function buildEntityMetadata(
  scene: VectorGeometrySceneV1,
): SceneEntityMeta[] {
  const metadata: SceneEntityMeta[] = [];
  for (const point of scene.points) {
    metadata.push({
      id: point.pointId,
      kind: "point",
      name: `point ${point.label}`,
      equationText: `${point.label} = ${formatVector(point.position)}`,
      keyParams: coordinateParams("coordinate", point.position),
    });
  }
  for (const vector of scene.vectors) {
    metadata.push({
      id: vector.vectorId,
      kind: "vector-arrow",
      name: `vector ${vector.label}`,
      equationText: `${vector.label} = ${formatVector(vector.components)}`,
      keyParams: coordinateParams("component", vector.components),
    });
  }
  for (const line of scene.lines) {
    const forms = lineEquationsFromLine3(line);
    metadata.push({
      id: line.lineId,
      kind: "line",
      name: `line ${line.label}`,
      equationText: forms.ok
        ? forms.value.result.vector
        : `${line.label}: equation unavailable`,
      keyParams: {
        ...coordinateParams("point", line.point.position),
        ...coordinateParams("direction", line.direction),
      },
    });
  }
  for (const plane of scene.planes) {
    const forms = planeEquationsFromPlane3(plane);
    metadata.push({
      id: plane.planeId,
      kind: "plane",
      name: `plane ${plane.label}`,
      equationText: forms.ok
        ? `${forms.value.result.cartesianForm}   (${forms.value.result.normalForm})`
        : `${plane.label}: equation unavailable`,
      keyParams: {
        ...coordinateParams("point", plane.point.position),
        ...coordinateParams("normal", plane.normal),
      },
    });
  }
  return metadata;
}
