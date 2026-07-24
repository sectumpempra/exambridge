/**
 * Analysis dispatch: example id + scene → solver calls → explanation models
 * + display geometry + pick metadata. All mathematical truth comes from the
 * core solvers; this module only adapts their outputs into the explain
 * package's input shape.
 */

import type {
  DisplayGeometryV1,
  Point3V1,
  VectorGeometrySceneV1,
} from "@/features/vector-geometry-lab/schema";
import {
  lineLineIntersection,
  linePlaneIntersection,
  linePlaneRelation,
  parallelLinesDistance,
  parallelPlanesDistance,
  planeEquationsFromThreePoints,
  planePlaneIntersection,
  planePlaneRelation,
  pointLineDistance,
  pointPlaneDistance,
  pointPointDistance,
  skewLinesDistance,
  vectorAngle,
} from "@/features/vector-geometry-lab/core";
import type {
  CoreError,
  CoreResult,
  DistanceMeasurement,
  SolveOutcome,
} from "@/features/vector-geometry-lab/core";
import type { SceneEntityMeta } from "@/features/vector-geometry-lab/three";
import {
  buildExplanationModel,
  EXPLANATION_MODEL_VERSION,
} from "@/features/vector-geometry-lab/explain";
import type {
  ExplanationModel,
  ExplanationResultSummary,
  ExplanationSubject,
  KeyValuePair,
} from "@/features/vector-geometry-lab/explain";
import {
  formatAngle,
  formatDistance,
  formatScalar,
  formatVector,
  sweepDegreesOf,
} from "./format.js";
import { describeScene } from "./scene-facts.js";

export interface AnalysisOutput {
  readonly models: readonly ExplanationModel[];
  readonly displayGeometry: readonly DisplayGeometryV1[];
  /** displayId-keyed metadata (labels, angle-arc sweepDegrees). */
  readonly displayMetadata: readonly SceneEntityMeta[];
}

type Analyzer = (scene: VectorGeometrySceneV1) => AnalysisOutput;

/* --------------------------------------------------------------------------
 * Shared adapters
 * ------------------------------------------------------------------------ */

function solvedModel<T>(
  analysisId: string,
  title: string,
  subject: ExplanationSubject,
  outcome: SolveOutcome<T>,
  summary: ExplanationResultSummary,
): ExplanationModel {
  return buildExplanationModel({
    analysisId,
    title,
    subject,
    analysis: {
      kind: "solved",
      outcome: {
        result: summary,
        derivations: outcome.derivations,
        validation: outcome.validation,
      },
    },
  });
}

function refusedModel(
  analysisId: string,
  title: string,
  subject: ExplanationSubject,
  error: CoreError,
): ExplanationModel {
  return buildExplanationModel({
    analysisId,
    title,
    subject,
    analysis: {
      kind: "refused",
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  });
}

function setupRefusal(
  analysisId: string,
  title: string,
  subject: ExplanationSubject,
  message: string,
): AnalysisOutput {
  return {
    models: [
      buildExplanationModel({
        analysisId,
        title,
        subject,
        analysis: {
          kind: "refused",
          code: "demo-setup-error",
          message,
        },
      }),
    ],
    displayGeometry: [],
    displayMetadata: [],
  };
}

/** Adapt a CoreResult-bearing solver call into a model + display payload. */
function adapt<T extends { readonly displayGeometry: readonly DisplayGeometryV1[] }>(
  analysisId: string,
  title: string,
  subject: ExplanationSubject,
  outcome: CoreResult<SolveOutcome<T>>,
  summarize: (result: T) => ExplanationResultSummary,
): { model: ExplanationModel; displayGeometry: readonly DisplayGeometryV1[] } {
  if (!outcome.ok) {
    return {
      model: refusedModel(analysisId, title, subject, outcome.error),
      displayGeometry: [],
    };
  }
  return {
    model: solvedModel(
      analysisId,
      title,
      subject,
      outcome.value,
      summarize(outcome.value.result),
    ),
    displayGeometry: outcome.value.result.displayGeometry,
  };
}

function pointText(point: Point3V1): string {
  return `${point.label} = ${formatVector(point.position)}`;
}

function distanceResults(
  measurement: DistanceMeasurement,
  relation: string,
): { conclusion: string; verdict: string; results: KeyValuePair[] } {
  return {
    conclusion: `distance = ${formatDistance(measurement)}`,
    verdict: relation,
    results: [
      { key: "distance", value: `${formatDistance(measurement)} (abstract length units)` },
    ],
  };
}

function displayMetadataFor(
  displayGeometry: readonly DisplayGeometryV1[],
  sweepByDisplayId: Readonly<Record<string, string>> = {},
): SceneEntityMeta[] {
  return displayGeometry.map((display) => {
    const sweep = sweepByDisplayId[display.displayId];
    const keyParams: Record<string, string> =
      sweep !== undefined ? { sweepDegrees: sweep } : {};
    return {
      id: display.displayId,
      kind: display.kind,
      name: display.label.length > 0 ? display.label : display.displayId,
      equationText: "",
      keyParams,
    };
  });
}

function finish(
  adapted: readonly { model: ExplanationModel; displayGeometry: readonly DisplayGeometryV1[] }[],
  sweeps: Readonly<Record<string, string>> = {},
): AnalysisOutput {
  const displayGeometry = adapted.flatMap((a) => a.displayGeometry);
  return {
    models: adapted.map((a) => a.model),
    displayGeometry,
    displayMetadata: displayMetadataFor(displayGeometry, sweeps),
  };
}

function angleSweeps(
  displayGeometry: readonly DisplayGeometryV1[],
  sweep: string,
): Record<string, string> {
  const sweeps: Record<string, string> = {};
  for (const display of displayGeometry) {
    if (display.kind === "angle-arc") {
      sweeps[display.displayId] = sweep;
    }
  }
  return sweeps;
}

/* --------------------------------------------------------------------------
 * Entity extraction (never throws — a malformed example scene produces a
 * structured setup refusal instead)
 * ------------------------------------------------------------------------ */

function at<T>(items: readonly T[], index: number): T | undefined {
  return items[index];
}

/* --------------------------------------------------------------------------
 * Per-example analyzers
 * ------------------------------------------------------------------------ */

function analyzeVectorAngle(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Angle between two vectors";
  const v1 = at(scene.vectors, 0);
  const v2 = at(scene.vectors, 1);
  if (v1 === undefined || v2 === undefined) {
    return setupRefusal("angle-vv", title, subject, "example needs two vectors");
  }
  const outcome = vectorAngle(v1.components, v2.components);
  const adapted = adapt("angle-vv", title, subject, outcome, (result) => ({
    conclusion: `θ = ${formatAngle(result.angle)}`,
    geometricConclusion:
      "The angle between two free vectors lies in [0°, 180°] and is computed from the dot product.",
    relationVerdict: result.classification,
    keyResults: [
      { key: "θ", value: formatAngle(result.angle) },
      { key: "u·v", value: `${formatScalar(result.dotProduct)} (dimensionless)` },
    ],
  }));
  if (!outcome.ok) {
    return finish([adapted]);
  }
  return finish(
    [adapted],
    angleSweeps(
      outcome.value.result.displayGeometry,
      sweepDegreesOf(outcome.value.result.angle),
    ),
  );
}

function analyzePointPointDistance(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Distance between two points";
  const p1 = at(scene.points, 0);
  const p2 = at(scene.points, 1);
  if (p1 === undefined || p2 === undefined) {
    return setupRefusal("dist-pp", title, subject, "example needs two points");
  }
  // pointPointDistance cannot refuse (no preconditions): SolveOutcome directly.
  const outcome = pointPointDistance(p1, p2);
  const { conclusion, verdict, results } = distanceResults(
    outcome.result.distance,
    outcome.result.relation,
  );
  const model = solvedModel("dist-pp", title, subject, outcome, {
    conclusion,
    geometricConclusion:
      outcome.result.relation === "same-point"
        ? "The two points coincide, so the distance is exactly 0."
        : "The distance is the length of the connector segment P1P2.",
    relationVerdict: verdict,
    keyResults: results,
  });
  return finish([{ model, displayGeometry: outcome.result.displayGeometry }]);
}

function analyzePointLineDistance(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Distance from a point to a line";
  const point = at(scene.points, 0);
  const line = at(scene.lines, 0);
  if (point === undefined || line === undefined) {
    return setupRefusal("dist-pl", title, subject, "example needs a point and a line");
  }
  const adapted = adapt("dist-pl", title, subject, pointLineDistance(point, line), (result) => {
    const { conclusion, verdict, results } = distanceResults(result.distance, result.relation);
    return {
      conclusion,
      geometricConclusion:
        result.relation === "point-on-line"
          ? "The point lies on the line, so the shortest distance is 0."
          : "The shortest distance is the length of the perpendicular segment from the point to its foot on the line.",
      relationVerdict: verdict,
      keyResults: [
        ...results,
        { key: "foot of perpendicular", value: pointText(result.foot) },
        { key: "parameter λ of the foot", value: formatScalar(result.parameter) },
      ],
    };
  });
  return finish([adapted]);
}

function analyzePointPlaneDistance(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Distance from a point to a plane";
  const point = at(scene.points, 0);
  const plane = at(scene.planes, 0);
  if (point === undefined || plane === undefined) {
    return setupRefusal("dist-ppl", title, subject, "example needs a point and a plane");
  }
  const adapted = adapt("dist-ppl", title, subject, pointPlaneDistance(point, plane), (result) => {
    const { conclusion, verdict, results } = distanceResults(result.distance, result.relation);
    return {
      conclusion,
      geometricConclusion:
        result.relation === "point-in-plane"
          ? "The point lies in the plane, so the shortest distance is 0."
          : "The shortest distance is measured along the plane normal from the point to its foot.",
      relationVerdict: verdict,
      keyResults: [
        ...results,
        { key: "foot of perpendicular", value: pointText(result.foot) },
        { key: "signed value r·n − d", value: formatScalar(result.signedValue) },
      ],
    };
  });
  return finish([adapted]);
}

function analyzeIntersectingLines(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Intersection of two lines";
  const l1 = at(scene.lines, 0);
  const l2 = at(scene.lines, 1);
  if (l1 === undefined || l2 === undefined) {
    return setupRefusal("int-ll", title, subject, "example needs two lines");
  }
  const adapted = adapt("int-ll", title, subject, lineLineIntersection(l1, l2), (result) => ({
    conclusion:
      result.classification === "unique" && result.intersectionPoint !== undefined
        ? `The lines intersect at the unique point ${pointText(result.intersectionPoint)}.`
        : `Classification: ${result.classification}.`,
    geometricConclusion:
      "The candidate parameters are back-substituted into BOTH line equations; only a coincident pair of feet proves intersection.",
    relationVerdict: result.classification,
    keyResults: [
      ...(result.intersectionPoint !== undefined
        ? [{ key: "intersection point", value: pointText(result.intersectionPoint) }]
        : []),
      ...(result.parameterOnLine1 !== undefined
        ? [{ key: "parameter s on line 1", value: formatScalar(result.parameterOnLine1) }]
        : []),
      ...(result.parameterOnLine2 !== undefined
        ? [{ key: "parameter t on line 2", value: formatScalar(result.parameterOnLine2) }]
        : []),
    ],
  }));
  return finish([adapted]);
}

function analyzeParallelLines(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Distance between two parallel lines";
  const l1 = at(scene.lines, 0);
  const l2 = at(scene.lines, 1);
  if (l1 === undefined || l2 === undefined) {
    return setupRefusal("dist-pll", title, subject, "example needs two lines");
  }
  const adapted = adapt("dist-pll", title, subject, parallelLinesDistance(l1, l2), (result) => {
    const { conclusion, verdict, results } = distanceResults(result.distance, result.relation);
    return {
      conclusion,
      geometricConclusion:
        result.relation === "lines-coincident"
          ? "The lines are coincident: every point of one lies on the other, so the distance is 0."
          : "The distance is the length of the perpendicular dropped from any point of one line onto the other.",
      relationVerdict: verdict,
      keyResults: [
        ...results,
        { key: "segment end on line 1", value: pointText(result.segmentEnd1) },
        { key: "segment end on line 2", value: pointText(result.segmentEnd2) },
      ],
    };
  });
  return finish([adapted]);
}

function analyzeSkewLines(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Shortest distance between two skew lines";
  const l1 = at(scene.lines, 0);
  const l2 = at(scene.lines, 1);
  if (l1 === undefined || l2 === undefined) {
    return setupRefusal("dist-skew", title, subject, "example needs two lines");
  }
  const adapted = adapt("dist-skew", title, subject, skewLinesDistance(l1, l2), (result) => {
    const { conclusion, verdict, results } = distanceResults(result.distance, result.relation);
    return {
      conclusion,
      geometricConclusion:
        result.relation === "lines-intersect"
          ? "The lines actually intersect, so the shortest distance is 0."
          : "The shortest distance is the length of the common perpendicular between the two nearest points.",
      relationVerdict: verdict,
      keyResults: [
        ...results,
        { key: "nearest point on line 1", value: pointText(result.foot1) },
        { key: "nearest point on line 2", value: pointText(result.foot2) },
        { key: "parameter s on line 1", value: formatScalar(result.parameter1) },
        { key: "parameter t on line 2", value: formatScalar(result.parameter2) },
      ],
    };
  });
  return finish([adapted]);
}

function analyzeLinePlaneRelation(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Relation between a line and a plane";
  const line = at(scene.lines, 0);
  const plane = at(scene.planes, 0);
  if (line === undefined || plane === undefined) {
    return setupRefusal("rel-lp", title, subject, "example needs a line and a plane");
  }
  const adapted = adapt("rel-lp", title, subject, linePlaneRelation(line, plane), (result) => ({
    conclusion: `The line is ${result.classification.replaceAll("-", " ")}.`,
    geometricConclusion:
      "The verdict rests on b·n (direction against the normal) and on substituting the base point into the plane equation.",
    relationVerdict: result.classification,
    keyResults: [
      { key: "b·n", value: `${formatScalar(result.dotProduct)} (dimensionless)` },
      { key: "base-point residual a·n − d", value: formatScalar(result.basePointResidual) },
    ],
  }));
  return finish([adapted]);
}

function analyzeLinePlaneIntersection(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Intersection of a line and a plane";
  const line = at(scene.lines, 0);
  const plane = at(scene.planes, 0);
  if (line === undefined || plane === undefined) {
    return setupRefusal("int-lp", title, subject, "example needs a line and a plane");
  }
  const adapted = adapt("int-lp", title, subject, linePlaneIntersection(line, plane), (result) => ({
    conclusion:
      result.classification === "unique" && result.intersectionPoint !== undefined
        ? `The line meets the plane at ${pointText(result.intersectionPoint)}.`
        : `Classification: ${result.classification}.`,
    geometricConclusion:
      "With b·n ≠ 0 the parameter λ = (d − a·n)/(b·n) is substituted back into both the line and the plane equation.",
    relationVerdict: result.classification,
    keyResults: [
      ...(result.intersectionPoint !== undefined
        ? [{ key: "intersection point", value: pointText(result.intersectionPoint) }]
        : []),
      ...(result.parameter !== undefined
        ? [{ key: "parameter λ", value: formatScalar(result.parameter) }]
        : []),
    ],
  }));
  return finish([adapted]);
}

function analyzeParallelPlanes(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Distance between two parallel planes";
  const p1 = at(scene.planes, 0);
  const p2 = at(scene.planes, 1);
  if (p1 === undefined || p2 === undefined) {
    return setupRefusal("dist-ppl2", title, subject, "example needs two planes");
  }
  const adapted = adapt("dist-ppl2", title, subject, parallelPlanesDistance(p1, p2), (result) => {
    const { conclusion, verdict, results } = distanceResults(result.distance, result.relation);
    return {
      conclusion,
      geometricConclusion:
        result.relation === "planes-coincident"
          ? "The planes coincide, so the distance is 0."
          : "The distance is the perpendicular gap measured along the common normal.",
      relationVerdict: verdict,
      keyResults: [
        ...results,
        { key: "segment end in plane 1", value: pointText(result.segmentEnd1) },
        { key: "segment end in plane 2", value: pointText(result.segmentEnd2) },
      ],
    };
  });
  return finish([adapted]);
}

function analyzePlanePlaneRelation(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Relation between two planes";
  const p1 = at(scene.planes, 0);
  const p2 = at(scene.planes, 1);
  if (p1 === undefined || p2 === undefined) {
    return setupRefusal("rel-pp", title, subject, "example needs two planes");
  }
  const adapted = adapt("rel-pp", title, subject, planePlaneRelation(p1, p2), (result) => ({
    conclusion: `The planes are ${result.classification.replaceAll("-", " ")}.`,
    geometricConclusion:
      "The verdict is decided by the two normals: parallel normals split coincident vs parallel-distinct; a zero dot product proves perpendicularity.",
    relationVerdict: result.classification,
    keyResults: [
      { key: "normals relation", value: result.normalsRelation },
      { key: "n1·n2", value: `${formatScalar(result.normalsDotProduct)} (dimensionless)` },
    ],
  }));
  return finish([adapted]);
}

function analyzePlanePlaneIntersection(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Intersection of two planes";
  const p1 = at(scene.planes, 0);
  const p2 = at(scene.planes, 1);
  if (p1 === undefined || p2 === undefined) {
    return setupRefusal("int-pp", title, subject, "example needs two planes");
  }
  const adapted = adapt("int-pp", title, subject, planePlaneIntersection(p1, p2), (result) => ({
    conclusion:
      result.classification === "intersecting-in-line" && result.intersectionLine !== undefined
        ? `The planes intersect in the line r = ${formatVector(result.intersectionLine.point.position)} + λ${formatVector(result.intersectionLine.direction)}.`
        : `Classification: ${result.classification}.`,
    geometricConclusion:
      "The intersection line's direction n1×n2 is perpendicular to both normals; the base point is substituted back into BOTH plane equations.",
    relationVerdict: result.classification,
    keyResults: [
      ...(result.intersectionLine !== undefined
        ? [
            {
              key: "intersection line",
              value: `r = ${formatVector(result.intersectionLine.point.position)} + λ${formatVector(result.intersectionLine.direction)}`,
            },
          ]
        : []),
    ],
  }));
  return finish([adapted]);
}

function analyzePlaneFromThreePoints(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Plane through three points";
  const p1 = at(scene.points, 0);
  const p2 = at(scene.points, 1);
  const p3 = at(scene.points, 2);
  if (p1 === undefined || p2 === undefined || p3 === undefined) {
    return setupRefusal("eq-plane-3pt", title, subject, "example needs three points");
  }
  const outcome = planeEquationsFromThreePoints(p1, p2, p3);
  // planeEquationsFromThreePoints returns a PlaneEquationSet, which carries
  // NO displayGeometry — so the shared adapt() helper does not apply; build
  // the model and the auxiliary plane display directly.
  if (!outcome.ok) {
    return {
      models: [refusedModel("eq-plane-3pt", title, subject, outcome.error)],
      displayGeometry: [],
      displayMetadata: [],
    };
  }
  const result = outcome.value.result;
  const model = solvedModel("eq-plane-3pt", title, subject, outcome.value, {
    conclusion: `The unique plane is ${result.cartesianForm}.`,
    geometricConclusion:
      "The connectors P2−P1 and P3−P1 span the plane; their cross product is the normal.",
    keyResults: [
      { key: "normal form", value: result.normalForm },
      { key: "Cartesian form", value: result.cartesianForm },
      { key: "parametric form", value: result.parametricForm },
    ],
    specialNotes: [
      "Collinear (or coincident) points do NOT determine a unique plane and would be refused.",
    ],
  });
  // Show the generated plane as auxiliary display geometry.
  const generatedPlaneDisplay: DisplayGeometryV1 = {
    displayId: "eq-plane-3pt-plane",
    kind: "plane",
    label: "generated plane",
    relatedEntityIds: [p1.pointId, p2.pointId, p3.pointId],
    points: [p1],
    normal: result.normal,
  };
  const displayGeometry = [generatedPlaneDisplay];
  return {
    models: [model],
    displayGeometry,
    displayMetadata: displayMetadataFor(displayGeometry),
  };
}

function analyzeDegenerate(scene: VectorGeometrySceneV1): AnalysisOutput {
  const subject = describeScene(scene);
  const title = "Degenerate input and error states";
  const v1 = at(scene.vectors, 0);
  const v2 = at(scene.vectors, 1);
  if (v1 === undefined || v2 === undefined) {
    return setupRefusal("degenerate", title, subject, "example needs two vectors");
  }
  // vectorAngle refuses the zero operand — the refusal IS the lesson.
  const outcome = vectorAngle(v1.components, v2.components);
  const adapted = adapt("degenerate", title, subject, outcome, (result) => ({
    conclusion: `θ = ${formatAngle(result.angle)}`,
    relationVerdict: result.classification,
    keyResults: [{ key: "θ", value: formatAngle(result.angle) }],
  }));
  return finish([adapted]);
}

/* --------------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------------ */

export const ANALYZERS: Readonly<Record<string, Analyzer>> = Object.freeze({
  "angle-between-vectors": analyzeVectorAngle,
  "point-point-distance": analyzePointPointDistance,
  "point-line-distance": analyzePointLineDistance,
  "point-plane-distance": analyzePointPlaneDistance,
  "intersecting-lines": analyzeIntersectingLines,
  "parallel-lines": analyzeParallelLines,
  "skew-lines": analyzeSkewLines,
  "line-contained-in-plane": analyzeLinePlaneRelation,
  "line-plane-intersection": analyzeLinePlaneIntersection,
  "line-parallel-to-plane": analyzeLinePlaneRelation,
  "parallel-planes": analyzeParallelPlanes,
  "coincident-planes": analyzePlanePlaneRelation,
  "intersecting-planes": analyzePlanePlaneIntersection,
  "perpendicular-planes": analyzePlanePlaneRelation,
  "plane-from-three-points": analyzePlaneFromThreePoints,
  "degenerate-input": analyzeDegenerate,
});

/** Runs the analysis for an example. Unknown ids produce a refused model. */
export function runExampleAnalysis(
  exampleId: string,
  scene: VectorGeometrySceneV1,
): AnalysisOutput {
  const analyzer = ANALYZERS[exampleId];
  if (analyzer === undefined) {
    return setupRefusal(
      "unknown-analysis",
      "Unknown analysis",
      describeScene(scene),
      `no analyzer registered for example id "${exampleId}"`,
    );
  }
  return analyzer(scene);
}

export { EXPLANATION_MODEL_VERSION };
