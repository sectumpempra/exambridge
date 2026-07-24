/**
 * The 16 built-in examples (spec §6 内置示例清单). Scenes are plain
 * VectorGeometrySceneV1 documents built with exact scalar literals; the
 * matching analyzer lives in analysis/run-analysis.ts keyed by example id.
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
  ScalarV1,
  VectorGeometrySceneV1,
} from "@/features/vector-geometry-lab/schema";

export interface BuiltinExample {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly scene: VectorGeometrySceneV1;
}

function s(literal: string): ScalarV1 {
  const parsed = scalarFromLiteral(literal);
  if (!parsed.ok) {
    throw new Error(`built-in example literal "${literal}" is invalid`);
  }
  return parsed.value;
}

function v(x: string, y: string, z: string) {
  return createVector3(s(x), s(y), s(z));
}

function p(id: string, label: string, x: string, y: string, z: string) {
  return createPoint3({ pointId: id, label, position: v(x, y, z) });
}

function l(
  id: string,
  label: string,
  point: readonly [string, string, string],
  direction: readonly [string, string, string],
) {
  return createLine3({
    lineId: id,
    label,
    point: p(`${id}-base`, `${label}0`, ...point),
    direction: v(...direction),
  });
}

function pl(
  id: string,
  label: string,
  point: readonly [string, string, string],
  normal: readonly [string, string, string],
) {
  return createPlane3({
    planeId: id,
    label,
    point: p(`${id}-base`, `${label}0`, ...point),
    normal: v(...normal),
  });
}

function vec(id: string, label: string, x: string, y: string, z: string) {
  return createVectorEntity({ vectorId: id, label, components: v(x, y, z) });
}

function scene(
  sceneId: string,
  title: string,
  entities: Partial<
    Pick<VectorGeometrySceneV1, "points" | "vectors" | "lines" | "planes">
  >,
): VectorGeometrySceneV1 {
  return createScene({
    sceneId,
    title,
    points: entities.points ?? [],
    vectors: entities.vectors ?? [],
    lines: entities.lines ?? [],
    planes: entities.planes ?? [],
  });
}

export const BUILTIN_EXAMPLES: readonly BuiltinExample[] = Object.freeze([
  {
    id: "angle-between-vectors",
    title: "1. Angle between two vectors",
    summary: "u·v = 0 proves the vectors are perpendicular (θ = 90°).",
    scene: scene("ex-01", "Angle between two vectors", {
      vectors: [vec("u", "u", "1", "2", "3"), vec("v", "v", "-2", "1", "0")],
    }),
  },
  {
    id: "point-point-distance",
    title: "2. Distance between two points",
    summary: "P(1, 2, 3) and Q(4, 6, 3): the connector has length 5.",
    scene: scene("ex-02", "Distance between two points", {
      points: [p("P", "P", "1", "2", "3"), p("Q", "Q", "4", "6", "3")],
    }),
  },
  {
    id: "point-line-distance",
    title: "3. Distance from a point to a line",
    summary: "P(1, 2, 3) to the x-axis: perpendicular foot at (1, 0, 0), d = √13.",
    scene: scene("ex-03", "Distance from a point to a line", {
      points: [p("P", "P", "1", "2", "3")],
      lines: [l("l", "l", ["0", "0", "0"], ["1", "0", "0"])],
    }),
  },
  {
    id: "point-plane-distance",
    title: "4. Distance from a point to a plane",
    summary: "P(1, 2, 3) to the plane z = 0: d = 3 along the normal.",
    scene: scene("ex-04", "Distance from a point to a plane", {
      points: [p("P", "P", "1", "2", "3")],
      planes: [pl("π", "π", ["0", "0", "0"], ["0", "0", "1"])],
    }),
  },
  {
    id: "intersecting-lines",
    title: "5. Intersecting lines",
    summary: "The x-axis meets r = (1, 1, 0) + t(0, 1, 0) at (1, 0, 0).",
    scene: scene("ex-05", "Intersecting lines", {
      lines: [
        l("l1", "l1", ["0", "0", "0"], ["1", "0", "0"]),
        l("l2", "l2", ["1", "1", "0"], ["0", "1", "0"]),
      ],
    }),
  },
  {
    id: "parallel-lines",
    title: "6. Parallel lines",
    summary: "Two lines with direction (1, 0, 0), offset (0, 3, 4): d = 5.",
    scene: scene("ex-06", "Parallel lines", {
      lines: [
        l("l1", "l1", ["0", "0", "0"], ["1", "0", "0"]),
        l("l2", "l2", ["0", "3", "4"], ["1", "0", "0"]),
      ],
    }),
  },
  {
    id: "skew-lines",
    title: "7. Skew lines",
    summary: "x-axis vs r = (0, 1, 2) + t(0, 1, 0): common perpendicular of length 2.",
    scene: scene("ex-07", "Skew lines", {
      lines: [
        l("l1", "l1", ["0", "0", "0"], ["1", "0", "0"]),
        l("l2", "l2", ["0", "1", "2"], ["0", "1", "0"]),
      ],
    }),
  },
  {
    id: "line-contained-in-plane",
    title: "8. Line contained in a plane",
    summary: "r = (1, 2, 0) + λ(1, 1, 0) lies entirely in the plane z = 0.",
    scene: scene("ex-08", "Line contained in a plane", {
      lines: [l("l", "l", ["1", "2", "0"], ["1", "1", "0"])],
      planes: [pl("π", "π", ["0", "0", "0"], ["0", "0", "1"])],
    }),
  },
  {
    id: "line-plane-intersection",
    title: "9. Line intersecting a plane",
    summary: "r = (0, 0, 2) + λ(1, 1, −1) pierces the plane z = 0 at (2, 2, 0).",
    scene: scene("ex-09", "Line intersecting a plane", {
      lines: [l("l", "l", ["0", "0", "2"], ["1", "1", "-1"])],
      planes: [pl("π", "π", ["0", "0", "0"], ["0", "0", "1"])],
    }),
  },
  {
    id: "line-parallel-to-plane",
    title: "10. Line parallel to a plane",
    summary: "r = (0, 0, 5) + λ(1, 0, 0) runs parallel to z = 0, never meeting it.",
    scene: scene("ex-10", "Line parallel to a plane", {
      lines: [l("l", "l", ["0", "0", "5"], ["1", "0", "0"])],
      planes: [pl("π", "π", ["0", "0", "0"], ["0", "0", "1"])],
    }),
  },
  {
    id: "parallel-planes",
    title: "11. Parallel planes",
    summary: "z = 0 and z = 4: parallel planes at distance 4.",
    scene: scene("ex-11", "Parallel planes", {
      planes: [
        pl("π1", "π1", ["0", "0", "0"], ["0", "0", "1"]),
        pl("π2", "π2", ["0", "0", "4"], ["0", "0", "1"]),
      ],
    }),
  },
  {
    id: "coincident-planes",
    title: "12. Coincident planes",
    summary: "2z = 2 and −3z = −3 are the same plane z = 1 written twice.",
    scene: scene("ex-12", "Coincident planes", {
      planes: [
        pl("π1", "π1", ["0", "0", "1"], ["0", "0", "2"]),
        pl("π2", "π2", ["1", "1", "1"], ["0", "0", "-3"]),
      ],
    }),
  },
  {
    id: "intersecting-planes",
    title: "13. Intersecting planes",
    summary: "z = 0 and y = 0 meet in the x-axis.",
    scene: scene("ex-13", "Intersecting planes", {
      planes: [
        pl("π1", "π1", ["0", "0", "0"], ["0", "0", "1"]),
        pl("π2", "π2", ["0", "0", "0"], ["0", "1", "0"]),
      ],
    }),
  },
  {
    id: "perpendicular-planes",
    title: "14. Perpendicular planes",
    summary: "Normals (0, 0, 1) and (0, 1, 0) have dot product 0: the planes are perpendicular.",
    scene: scene("ex-14", "Perpendicular planes", {
      planes: [
        pl("π1", "π1", ["0", "0", "0"], ["0", "0", "1"]),
        pl("π2", "π2", ["0", "0", "0"], ["0", "1", "0"]),
      ],
    }),
  },
  {
    id: "plane-from-three-points",
    title: "15. Plane through three points",
    summary: "P1(0,0,0), P2(1,0,0), P3(0,1,0) determine the plane z = 0.",
    scene: scene("ex-15", "Plane through three points", {
      points: [
        p("P1", "P1", "0", "0", "0"),
        p("P2", "P2", "1", "0", "0"),
        p("P3", "P3", "0", "1", "0"),
      ],
    }),
  },
  {
    id: "degenerate-input",
    title: "16. Degenerate input and error states",
    summary:
      "The angle against the ZERO vector is undefined: the solver refuses with a structured reason and no answer is fabricated.",
    scene: scene("ex-16", "Degenerate input and error states", {
      vectors: [vec("u", "u", "1", "2", "3"), vec("w", "w", "0", "0", "0")],
    }),
  },
] as const);

export const DEFAULT_EXAMPLE_ID = "angle-between-vectors";

export function getExample(id: string): BuiltinExample | undefined {
  return BUILTIN_EXAMPLES.find((example) => example.id === id);
}
