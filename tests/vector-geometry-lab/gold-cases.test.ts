import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isPointInPlane,
  isPointOnLine,
  lineEquationsFromPointDirection,
  lineEquationsFromTwoPoints,
  lineLineAngle,
  lineLineIntersection,
  linePlaneAngle,
  linePlaneIntersection,
  parallelLinesDistance,
  parallelPlanesDistance,
  planeEquationsFromPointDirections,
  planeEquationsFromPointNormal,
  planeEquationsFromThreePoints,
  planePlaneAngle,
  planePlaneIntersection,
  planePlaneRelation,
  linePlaneRelation,
  vectorPlaneRelation,
  pointLineDistance,
  pointPlaneDistance,
  pointPointDistance,
  rational,
  rationalFromScalar,
  rationalsEqual,
  skewLinesDistance,
  vectorAngle,
} from "@/features/vector-geometry-lab/core";
import type {
  CoreError,
  ExactRadical,
  ExactRational,
  SolveOutcome,
} from "@/features/vector-geometry-lab/core";
import {
  approximateScalar,
  parseVectorGeometryScene,
  scalarFromLiteral,
} from "@/features/vector-geometry-lab/schema";
import type {
  Line3V1,
  Plane3V1,
  Point3V1,
  ScalarV1,
  Vector3V1,
  VectorGeometrySceneV1,
} from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

/**
 * Gold-case runner (spec §9 + Stage 3/4 task briefs).
 *
 * - Loads EVERY gold-cases/*.json (auto-discovery, sorted for determinism).
 * - Dispatches on input.solver to the matching core solver. Stage 4 adds the
 *   relation classifiers, the three intersection solvers, the equation
 *   generators, the membership predicates, and the special
 *   input.solver "schema-parse" dispatch (input.documentText is JSON.parse'd
 *   first — damaged JSON fails as "invalid-json"; input.document goes
 *   straight into parseVectorGeometryScene, so structural problems surface
 *   as "invalid-input" and unknown versions as "unsupported-schema-version").
 * - expectedStatus "solved" → the solver must succeed and every
 *   expectedResults entry must match; any other expectedStatus is a
 *   structured error code (e.g. "zero-vector", "not-parallel", "not-skew",
 *   "degenerate-input") and the solver must fail with exactly that code.
 * - Exact expectations (radical coefficient / radicand, foot points,
 *   parameters, intersection points/lines, equation normals) are compared
 *   with EXACT rational arithmetic — never floats. Equation-form strings
 *   (vector / parametric / symmetric / normal / point-normal / cartesian /
 *   parametric forms) are hand-derived and compared verbatim.
 * - Float expectations (approximate distances, cosines, degree measures)
 *   are compared under the case's own tolerance policy
 *   |a − e| ≤ max(absolute, relative · max(|a|, |e|)).
 * - Every rule id listed in validationRules must appear in the outcome's
 *   validation records; a bare string requires passed === true, while the
 *   object form { rule, passed } pins the exact outcome (negative-evidence
 *   cases where a residual rule MUST fail).
 *   (core-solver cases only)
 *
 * The expectations in the JSON files are hand-derived (each case carries
 * its independentDerivation); this runner NEVER writes expectations.
 */

/* --------------------------------------------------------------------------
 * Case file types
 * ------------------------------------------------------------------------ */

interface ToleranceJson {
  readonly absolute: number;
  readonly relative: number;
}

interface RadicalExpectation {
  readonly kind: "exact";
  readonly coefficient: string;
  readonly radicand: string;
  readonly decimal?: string;
}

interface ApproximateExpectation {
  readonly kind: "approximate";
  readonly value: number;
}

type ValueExpectation = RadicalExpectation | ApproximateExpectation;

interface CaseJson {
  readonly caseId: string;
  readonly category: string;
  readonly description: string;
  readonly input: Record<string, unknown>;
  readonly expectedStatus: string;
  readonly expectedResults: Record<string, unknown>;
  readonly tolerance: ToleranceJson;
  readonly independentDerivation: string;
  readonly validationRules: readonly (string | ValidationRuleExpectation)[];
}

/**
 * A validation-rule expectation: a bare string requires the rule to have
 * fired with passed === true; the object form pins the exact pass/fail
 * outcome (Stage 4 negative-evidence cases, where a residual rule MUST
 * fail — the failure is the evidence for "not-on-line" etc.).
 */
interface ValidationRuleExpectation {
  readonly rule: string;
  readonly passed: boolean;
}

/* --------------------------------------------------------------------------
 * Input builders (raw JSON → schema-typed values; NO schema validation on
 * purpose: core must defend itself against e.g. zero directions)
 * ------------------------------------------------------------------------ */

function buildScalar(raw: unknown): ScalarV1 {
  if (typeof raw === "string") {
    const parsed = scalarFromLiteral(raw);
    if (!parsed.ok) {
      throw new Error(`gold case scalar literal "${raw}" rejected`);
    }
    return parsed.value;
  }
  if (typeof raw === "object" && raw !== null && "approximation" in raw) {
    const carrier = raw as { readonly input: unknown; readonly approximation: unknown };
    if (typeof carrier.input !== "string" || typeof carrier.approximation !== "string") {
      throw new Error("gold case approximate scalar needs string input/approximation");
    }
    const parsed = approximateScalar(carrier.input, carrier.approximation);
    if (!parsed.ok) {
      throw new Error(`gold case approximate scalar "${carrier.input}" rejected`);
    }
    return parsed.value;
  }
  throw new Error(`unsupported gold case scalar: ${JSON.stringify(raw)}`);
}

function buildVector(raw: unknown): Vector3V1 {
  const v = raw as { x: unknown; y: unknown; z: unknown };
  return { x: buildScalar(v.x), y: buildScalar(v.y), z: buildScalar(v.z) };
}

function buildPoint(raw: unknown): Point3V1 {
  const p = raw as { pointId: string; label: string; position: unknown };
  return { pointId: p.pointId, label: p.label, position: buildVector(p.position) };
}

function buildLine(raw: unknown): Line3V1 {
  const l = raw as { lineId: string; label: string; point: unknown; direction: unknown };
  return {
    lineId: l.lineId,
    label: l.label,
    point: buildPoint(l.point),
    direction: buildVector(l.direction),
  };
}

function buildPlane(raw: unknown): Plane3V1 {
  const p = raw as { planeId: string; label: string; point: unknown; normal: unknown };
  return {
    planeId: p.planeId,
    label: p.label,
    point: buildPoint(p.point),
    normal: buildVector(p.normal),
  };
}

/* --------------------------------------------------------------------------
 * Comparisons
 * ------------------------------------------------------------------------ */

function parseRational(text: string): ExactRational {
  const parts = text.split("/");
  if (parts.length === 1) {
    return rational(BigInt(parts[0] ?? "0"));
  }
  if (parts.length === 2) {
    return rational(BigInt(parts[0] ?? "0"), BigInt(parts[1] ?? "1"));
  }
  throw new Error(`bad rational expectation "${text}"`);
}

function expectRadicalEquals(actual: ExactRadical, expected: RadicalExpectation): void {
  const coefficient = parseRational(expected.coefficient);
  expect(
    rationalsEqual(actual.coefficient, coefficient),
    `radical coefficient ${actual.coefficient.numerator}/${actual.coefficient.denominator} != ${expected.coefficient}`,
  ).toBe(true);
  expect(
    actual.radicand === BigInt(expected.radicand),
    `radicand ${actual.radicand} != ${expected.radicand}`,
  ).toBe(true);
}

function withinTolerance(actual: number, expected: number, tolerance: ToleranceJson): boolean {
  const gap = Math.abs(actual - expected);
  const scale = Math.max(Math.abs(actual), Math.abs(expected));
  return gap <= Math.max(tolerance.absolute, tolerance.relative * scale);
}

function expectPointEquals(actual: Point3V1, expected: readonly string[]): void {
  const components = [actual.position.x, actual.position.y, actual.position.z];
  expect(components.length).toBe(expected.length);
  expected.forEach((text, index) => {
    const expectedRational = parseRational(text);
    const actualRational = rationalFromScalar(components[index] as ScalarV1);
    expect(
      rationalsEqual(actualRational, expectedRational),
      `point component ${index}: ${actualRational.numerator}/${actualRational.denominator} != ${text}`,
    ).toBe(true);
  });
}

function expectScalarEquals(actual: ScalarV1, expected: string): void {
  const expectedRational = parseRational(expected);
  const actualRational = rationalFromScalar(actual);
  expect(
    rationalsEqual(actualRational, expectedRational),
    `scalar ${actualRational.numerator}/${actualRational.denominator} != ${expected}`,
  ).toBe(true);
}

/** Vector vs a 3-component rational expectation, compared exactly. */
function expectVectorEquals(actual: Vector3V1, expected: readonly string[]): void {
  const components = [actual.x, actual.y, actual.z];
  expect(components.length).toBe(expected.length);
  expected.forEach((text, index) => {
    const expectedRational = parseRational(text);
    const actualRational = rationalFromScalar(components[index] as ScalarV1);
    expect(
      rationalsEqual(actualRational, expectedRational),
      `vector component ${index}: ${actualRational.numerator}/${actualRational.denominator} != ${text}`,
    ).toBe(true);
  });
}

/** Distance or cosine/sine measurement vs its expectation (exact or float). */
function expectValueMatches(
  label: string,
  actual:
    | { kind: "exact"; radical: ExactRadical; decimalApproximation?: string }
    | { kind: "exact"; cosine: ExactRadical }
    | { kind: "exact"; sine: ExactRadical }
    | { kind: "approximate"; value?: number; cosine?: number; sine?: number },
  expected: ValueExpectation,
  tolerance: ToleranceJson,
): void {
  if (expected.kind === "exact") {
    expect(actual.kind, `${label}: expected an exact measurement`).toBe("exact");
    if (actual.kind === "exact") {
      const radical =
        "radical" in actual ? actual.radical : "cosine" in actual ? actual.cosine : actual.sine;
      expectRadicalEquals(radical, expected);
    }
    return;
  }
  expect(actual.kind, `${label}: expected an approximate measurement`).toBe("approximate");
  if (actual.kind === "approximate") {
    const value = actual.value ?? actual.cosine ?? actual.sine;
    expect(value).toBeDefined();
    expect(
      withinTolerance(value as number, expected.value, tolerance),
      `${label}: |${value} − ${expected.value}| exceeds case tolerance`,
    ).toBe(true);
  }
}

/* --------------------------------------------------------------------------
 * Dispatch
 * ------------------------------------------------------------------------ */

interface Dispatched {
  readonly outcome?: SolveOutcome<Record<string, unknown>>;
  readonly error?: CoreError;
  /** Schema-parse dispatch result (Stage 4): parse success or failure code. */
  readonly schemaParse?:
    | { readonly ok: true; readonly scene: VectorGeometrySceneV1 }
    | { readonly ok: false; readonly code: string };
}

function dispatch(caseFile: CaseJson): Dispatched {
  const input = caseFile.input;
  const solver = input["solver"];
  switch (solver) {
    case "pointPointDistance": {
      const outcome = pointPointDistance(
        buildPoint(input["point1"]),
        buildPoint(input["point2"]),
      );
      return { outcome: outcome as unknown as SolveOutcome<Record<string, unknown>> };
    }
    case "pointLineDistance": {
      const result = pointLineDistance(buildPoint(input["point"]), buildLine(input["line"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "pointPlaneDistance": {
      const result = pointPlaneDistance(buildPoint(input["point"]), buildPlane(input["plane"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "parallelLinesDistance": {
      const result = parallelLinesDistance(buildLine(input["line1"]), buildLine(input["line2"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "skewLinesDistance": {
      const result = skewLinesDistance(buildLine(input["line1"]), buildLine(input["line2"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "parallelPlanesDistance": {
      const result = parallelPlanesDistance(buildPlane(input["plane1"]), buildPlane(input["plane2"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "vectorAngle": {
      const result = vectorAngle(buildVector(input["vector1"]), buildVector(input["vector2"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "lineLineAngle": {
      const result = lineLineAngle(buildLine(input["line1"]), buildLine(input["line2"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "linePlaneAngle": {
      const result = linePlaneAngle(buildLine(input["line"]), buildPlane(input["plane"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "planePlaneAngle": {
      const result = planePlaneAngle(buildPlane(input["plane1"]), buildPlane(input["plane2"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    /* ------------------------------------------------------------------
     * Stage 4: relation classifiers
     * ---------------------------------------------------------------- */
    case "vectorPlaneRelation": {
      const result = vectorPlaneRelation(buildVector(input["vector"]), buildPlane(input["plane"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "linePlaneRelation": {
      const result = linePlaneRelation(buildLine(input["line"]), buildPlane(input["plane"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "planePlaneRelation": {
      const result = planePlaneRelation(buildPlane(input["plane1"]), buildPlane(input["plane2"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    /* ------------------------------------------------------------------
     * Stage 4: intersection solvers
     * ---------------------------------------------------------------- */
    case "lineLineIntersection": {
      const result = lineLineIntersection(buildLine(input["line1"]), buildLine(input["line2"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "linePlaneIntersection": {
      const result = linePlaneIntersection(buildLine(input["line"]), buildPlane(input["plane"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "planePlaneIntersection": {
      const result = planePlaneIntersection(buildPlane(input["plane1"]), buildPlane(input["plane2"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    /* ------------------------------------------------------------------
     * Stage 4: equation generators (points given as plain vectors)
     * ---------------------------------------------------------------- */
    case "lineEquationsFromPointDirection": {
      const result = lineEquationsFromPointDirection(
        buildVector(input["point"]),
        buildVector(input["direction"]),
      );
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "lineEquationsFromTwoPoints": {
      const result = lineEquationsFromTwoPoints(
        buildVector(input["point1"]),
        buildVector(input["point2"]),
      );
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "planeEquationsFromPointNormal": {
      const result = planeEquationsFromPointNormal(
        buildVector(input["point"]),
        buildVector(input["normal"]),
      );
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "planeEquationsFromPointDirections": {
      const result = planeEquationsFromPointDirections(
        buildVector(input["point"]),
        buildVector(input["direction1"]),
        buildVector(input["direction2"]),
      );
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "planeEquationsFromThreePoints": {
      const result = planeEquationsFromThreePoints(
        buildVector(input["point1"]),
        buildVector(input["point2"]),
        buildVector(input["point3"]),
      );
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    /* ------------------------------------------------------------------
     * Stage 4: membership predicates
     * ---------------------------------------------------------------- */
    case "isPointOnLine": {
      const result = isPointOnLine(buildVector(input["point"]), buildLine(input["line"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    case "isPointInPlane": {
      const result = isPointInPlane(buildVector(input["point"]), buildPlane(input["plane"]));
      return result.ok
        ? { outcome: result.value as unknown as SolveOutcome<Record<string, unknown>> }
        : { error: result.error };
    }
    /* ------------------------------------------------------------------
     * Stage 4: schema-parse dispatch (documentText → JSON.parse first;
     * damaged JSON is reported as "invalid-json" without touching the
     * schema parser).
     * ---------------------------------------------------------------- */
    case "schema-parse": {
      let document: unknown;
      if (typeof input["documentText"] === "string") {
        try {
          document = JSON.parse(input["documentText"]) as unknown;
        } catch {
          return { schemaParse: { ok: false, code: "invalid-json" } };
        }
      } else {
        document = input["document"];
      }
      const parsed = parseVectorGeometryScene(document);
      return parsed.ok
        ? { schemaParse: { ok: true, scene: parsed.value } }
        : { schemaParse: { ok: false, code: parsed.error.code } };
    }
    default:
      throw new Error(`gold case ${caseFile.caseId}: unknown solver "${String(solver)}"`);
  }
}

/* --------------------------------------------------------------------------
 * Expectation checking per solver family
 * ------------------------------------------------------------------------ */

function checkDistanceExpectations(
  caseFile: CaseJson,
  result: Record<string, unknown>,
): void {
  const expected = caseFile.expectedResults;
  const tolerance = caseFile.tolerance;
  if (typeof expected["relation"] === "string") {
    expect(result["relation"], `${caseFile.caseId}: relation`).toBe(expected["relation"]);
  }
  const distance = expected["distance"] as ValueExpectation | undefined;
  if (distance !== undefined) {
    expectValueMatches(
      "distance",
      result["distance"] as Parameters<typeof expectValueMatches>[1],
      distance,
      tolerance,
    );
  }
  for (const key of ["foot", "foot1", "foot2", "segmentEnd1", "segmentEnd2"] as const) {
    const expectedPoint = expected[key] as readonly string[] | undefined;
    if (expectedPoint !== undefined) {
      expectPointEquals(result[key] as Point3V1, expectedPoint);
    }
  }
  for (const key of ["parameter", "parameter1", "parameter2"] as const) {
    const expectedScalar = expected[key] as string | undefined;
    if (expectedScalar !== undefined) {
      expectScalarEquals(result[key] as ScalarV1, expectedScalar);
    }
  }
}

function checkAngleExpectations(
  caseFile: CaseJson,
  result: Record<string, unknown>,
): void {
  const expected = caseFile.expectedResults;
  const tolerance = caseFile.tolerance;
  if (typeof expected["classification"] === "string") {
    expect(result["classification"], `${caseFile.caseId}: classification`).toBe(
      expected["classification"],
    );
  }
  const angle = result["angle"] as Record<string, unknown>;
  const cosine = expected["cosine"] as ValueExpectation | undefined;
  if (cosine !== undefined) {
    expectValueMatches("cosine", angle as Parameters<typeof expectValueMatches>[1], cosine, tolerance);
  }
  const sine = expected["sine"] as ValueExpectation | undefined;
  if (sine !== undefined) {
    expectValueMatches("sine", angle as Parameters<typeof expectValueMatches>[1], sine, tolerance);
  }
  const degrees = expected["angleDegrees"] as number | undefined;
  if (degrees !== undefined) {
    const actualDegrees = angle["angleDegrees"] as number;
    expect(
      withinTolerance(actualDegrees, degrees, tolerance),
      `${caseFile.caseId}: |${actualDegrees}° − ${degrees}°| exceeds case tolerance`,
    ).toBe(true);
  }
}

/* --------------------------------------------------------------------------
 * Stage 4 checkers: relations / intersections / equations / membership
 * ------------------------------------------------------------------------ */

function checkRelationExpectations(
  caseFile: CaseJson,
  result: Record<string, unknown>,
): void {
  const expected = caseFile.expectedResults;
  if (typeof expected["classification"] === "string") {
    expect(result["classification"], `${caseFile.caseId}: classification`).toBe(
      expected["classification"],
    );
  }
  if (typeof expected["normalsRelation"] === "string") {
    expect(result["normalsRelation"], `${caseFile.caseId}: normalsRelation`).toBe(
      expected["normalsRelation"],
    );
  }
  for (const key of ["dotProduct", "basePointResidual", "normalsDotProduct"] as const) {
    const expectedScalar = expected[key] as string | undefined;
    if (expectedScalar !== undefined) {
      expectScalarEquals(result[key] as ScalarV1, expectedScalar);
    }
  }
  const point = expected["intersectionPoint"] as readonly string[] | undefined;
  if (point !== undefined) {
    expectPointEquals(result["intersectionPoint"] as Point3V1, point);
  }
  const parameter = expected["parameter"] as string | undefined;
  if (parameter !== undefined) {
    expectScalarEquals(result["parameter"] as ScalarV1, parameter);
  }
}

function checkIntersectionExpectations(
  caseFile: CaseJson,
  result: Record<string, unknown>,
): void {
  const expected = caseFile.expectedResults;
  if (typeof expected["classification"] === "string") {
    expect(result["classification"], `${caseFile.caseId}: classification`).toBe(
      expected["classification"],
    );
  }
  const point = expected["intersectionPoint"] as readonly string[] | undefined;
  if (point !== undefined) {
    expectPointEquals(result["intersectionPoint"] as Point3V1, point);
  }
  for (const key of ["parameter", "parameterOnLine1", "parameterOnLine2"] as const) {
    const expectedScalar = expected[key] as string | undefined;
    if (expectedScalar !== undefined) {
      expectScalarEquals(result[key] as ScalarV1, expectedScalar);
    }
  }
  const line = expected["intersectionLine"] as
    | { readonly point: readonly string[]; readonly direction: readonly string[] }
    | undefined;
  if (line !== undefined) {
    const actual = result["intersectionLine"] as Line3V1;
    expectPointEquals(actual.point, line.point);
    expectVectorEquals(actual.direction, line.direction);
  }
}

function checkEquationExpectations(
  caseFile: CaseJson,
  result: Record<string, unknown>,
): void {
  const expected = caseFile.expectedResults;
  // Equation strings are hand-derived expectations and compared verbatim.
  for (const key of [
    "vector",
    "parametric",
    "normalForm",
    "pointNormalForm",
    "cartesianForm",
    "parametricForm",
  ] as const) {
    const expectedString = expected[key] as string | undefined;
    if (expectedString !== undefined) {
      expect(result[key], `${caseFile.caseId}: ${key}`).toBe(expectedString);
    }
  }
  const symmetricApplicable = expected["symmetricApplicable"] as boolean | undefined;
  if (symmetricApplicable !== undefined) {
    const symmetric = result["symmetric"] as
      | { readonly applicable: true; readonly equation: string }
      | { readonly applicable: false; readonly reason: string };
    expect(symmetric.applicable, `${caseFile.caseId}: symmetric.applicable`).toBe(
      symmetricApplicable,
    );
    const expectedSymmetric = expected["symmetric"] as string | undefined;
    if (symmetricApplicable && expectedSymmetric !== undefined && symmetric.applicable) {
      expect(symmetric.equation, `${caseFile.caseId}: symmetric.equation`).toBe(expectedSymmetric);
    }
    const reasonContains = expected["symmetricReasonContains"] as string | undefined;
    if (!symmetricApplicable && reasonContains !== undefined && !symmetric.applicable) {
      expect(symmetric.reason, `${caseFile.caseId}: symmetric.reason`).toContain(reasonContains);
    }
  }
  const normal = expected["normal"] as readonly string[] | undefined;
  if (normal !== undefined) {
    const equation = result["equation"] as {
      readonly normal: {
        readonly x: ExactRational;
        readonly y: ExactRational;
        readonly z: ExactRational;
      };
      readonly d: ExactRational;
    };
    const components = [equation.normal.x, equation.normal.y, equation.normal.z];
    normal.forEach((text, index) => {
      const actual = components[index] as ExactRational;
      expect(
        rationalsEqual(actual, parseRational(text)),
        `${caseFile.caseId}: equation normal component ${index}: ${actual.numerator}/${actual.denominator} != ${text}`,
      ).toBe(true);
    });
  }
  const constantTerm = expected["d"] as string | undefined;
  if (constantTerm !== undefined) {
    const equation = result["equation"] as { readonly d: ExactRational };
    expect(
      rationalsEqual(equation.d, parseRational(constantTerm)),
      `${caseFile.caseId}: equation d: ${equation.d.numerator}/${equation.d.denominator} != ${constantTerm}`,
    ).toBe(true);
  }
}

function checkMembershipExpectations(
  caseFile: CaseJson,
  result: Record<string, unknown>,
): void {
  const expected = caseFile.expectedResults;
  if (typeof expected["classification"] === "string") {
    expect(result["classification"], `${caseFile.caseId}: classification`).toBe(
      expected["classification"],
    );
  }
  for (const key of ["onLine", "inPlane", "exact"] as const) {
    const expectedFlag = expected[key] as boolean | undefined;
    if (expectedFlag !== undefined) {
      expect(result[key], `${caseFile.caseId}: ${key}`).toBe(expectedFlag);
    }
  }
  for (const key of ["parameter", "signedValue"] as const) {
    const expectedScalar = expected[key] as string | undefined;
    if (expectedScalar !== undefined) {
      expectScalarEquals(result[key] as ScalarV1, expectedScalar);
    }
  }
}

function checkSceneExpectations(caseFile: CaseJson, scene: VectorGeometrySceneV1): void {
  const expected = caseFile.expectedResults;
  if (typeof expected["title"] === "string") {
    expect(scene.title, `${caseFile.caseId}: scene title`).toBe(expected["title"]);
  }
  const counts = expected["entityCounts"] as
    | { readonly points?: number; readonly vectors?: number; readonly lines?: number; readonly planes?: number }
    | undefined;
  if (counts !== undefined) {
    if (counts.points !== undefined) {
      expect(scene.points.length, `${caseFile.caseId}: points count`).toBe(counts.points);
    }
    if (counts.vectors !== undefined) {
      expect(scene.vectors.length, `${caseFile.caseId}: vectors count`).toBe(counts.vectors);
    }
    if (counts.lines !== undefined) {
      expect(scene.lines.length, `${caseFile.caseId}: lines count`).toBe(counts.lines);
    }
    if (counts.planes !== undefined) {
      expect(scene.planes.length, `${caseFile.caseId}: planes count`).toBe(counts.planes);
    }
  }
}

/* --------------------------------------------------------------------------
 * Suite
 * ------------------------------------------------------------------------ */

const GOLD_CASES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "vector-geometry-gold-cases");

function loadCases(): CaseJson[] {
  const files = readdirSync(GOLD_CASES_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
  return files.map((name) => {
    const text = readFileSync(join(GOLD_CASES_DIR, name), "utf8");
    const parsed = JSON.parse(text) as CaseJson;
    for (const field of [
      "caseId",
      "category",
      "description",
      "input",
      "expectedStatus",
      "expectedResults",
      "tolerance",
      "independentDerivation",
      "validationRules",
    ] as const) {
      if (parsed[field] === undefined) {
        throw new Error(`gold case file ${name} is missing required field "${field}"`);
      }
    }
    if (parsed.independentDerivation.length < 20) {
      throw new Error(`gold case ${parsed.caseId}: independentDerivation is missing or trivial`);
    }
    return parsed;
  });
}

const cases = loadCases();

describe("gold cases", () => {
  it("ships at least 74 cases with unique ids", () => {
    expect(cases.length).toBeGreaterThanOrEqual(74);
    const ids = new Set(cases.map((c) => c.caseId));
    expect(ids.size).toBe(cases.length);
  });

  describe.each(
    [...new Set(cases.map((c) => c.category))].map((category) => ({ category })),
  )("$category", ({ category }) => {
    const categoryCases = cases.filter((c) => c.category === category);
    it.each(categoryCases.map((c) => [c.caseId, c] as const))(
      "%s",
      (_caseId, caseFile) => {
        const dispatched = dispatch(caseFile);
        if (caseFile.category === "schema-parse") {
          // Schema-parse cases never reach a core solver: success yields the
          // parsed scene, failure a structured code (invalid-json /
          // invalid-input / unsupported-schema-version).
          const schemaParse = dispatched.schemaParse;
          expect(schemaParse, `${caseFile.caseId}: expected a schema-parse dispatch`).toBeDefined();
          if (schemaParse === undefined) {
            return;
          }
          if (caseFile.expectedStatus === "solved") {
            expect(
              schemaParse.ok,
              `${caseFile.caseId}: expected a valid scene, got ${schemaParse.ok ? "ok" : schemaParse.code}`,
            ).toBe(true);
            if (schemaParse.ok) {
              checkSceneExpectations(caseFile, schemaParse.scene);
            }
          } else {
            expect(schemaParse.ok, `${caseFile.caseId}: expected parse failure`).toBe(false);
            if (!schemaParse.ok) {
              expect(
                schemaParse.code,
                `${caseFile.caseId}: expected parse failure code ${caseFile.expectedStatus}`,
              ).toBe(caseFile.expectedStatus);
            }
          }
          return;
        }
        if (caseFile.expectedStatus === "solved") {
          expect(
            dispatched.error,
            `${caseFile.caseId}: expected success, got ${dispatched.error?.code ?? "none"}`,
          ).toBeUndefined();
          const outcome = dispatched.outcome;
          expect(outcome).toBeDefined();
          if (outcome === undefined) {
            return;
          }
          const result = outcome.result;
          if (caseFile.category.includes("angle")) {
            checkAngleExpectations(caseFile, result);
          } else if (caseFile.category.includes("distance")) {
            checkDistanceExpectations(caseFile, result);
          } else if (caseFile.category.includes("relation")) {
            checkRelationExpectations(caseFile, result);
          } else if (caseFile.category.includes("intersection")) {
            checkIntersectionExpectations(caseFile, result);
          } else if (caseFile.category.includes("equations")) {
            checkEquationExpectations(caseFile, result);
          } else if (caseFile.category.includes("membership")) {
            checkMembershipExpectations(caseFile, result);
          } else {
            throw new Error(`gold case ${caseFile.caseId}: unrouted category "${caseFile.category}"`);
          }
          for (const ruleEntry of caseFile.validationRules) {
            const rule = typeof ruleEntry === "string" ? ruleEntry : ruleEntry.rule;
            const expectedPassed = typeof ruleEntry === "string" ? true : ruleEntry.passed;
            const record = outcome.validation.find((entry) => entry.rule === rule);
            expect(
              record,
              `${caseFile.caseId}: validation rule "${rule}" did not fire`,
            ).toBeDefined();
            expect(
              record?.passed,
              `${caseFile.caseId}: rule "${rule}" expected passed === ${expectedPassed}`,
            ).toBe(expectedPassed);
          }
        } else {
          expect(
            dispatched.error?.code,
            `${caseFile.caseId}: expected structured failure ${caseFile.expectedStatus}`,
          ).toBe(caseFile.expectedStatus);
          expect(dispatched.outcome).toBeUndefined();
        }
      },
    );
  });
});
