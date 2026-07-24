/**
 * @/features/vector-geometry-lab/core
 *
 * Deterministic exact vector-geometry computation core (Stage 2 of
 * ExamBridge Vector Geometry Lab V1). Pure TypeScript: no React, no DOM,
 * no Three.js, no Node-specific APIs, no randomness, no clocks.
 *
 * Layer map:
 * - rational.ts    ExactRational (bigint, always reduced, denominator > 0)
 * - radical.ts     ExactRadical c·√r (square-free r; norms and distances)
 * - decimal.ts     toDecimal — the single rounding entry point
 * - tolerance.ts   DEFAULT_TOLERANCE + dual-path comparisons
 * - vectors.ts     exact vector algebra (spec §4 checklist)
 * - matrix.ts      determinants, rank, exact 2×2/3×3 linear solves
 * - line-plane.ts  line/plane normalization + scaling invariants
 * - relations.ts   structured parallel/perpendicular/coincident/degenerate
 * - derivation.ts  DerivationRecorder + SolveOutcome template
 * - validation.ts  residuals + ValidationRecorder (back-substitution audit)
 * - distances.ts   Stage 3 distance solvers (7 situations, SolveOutcome)
 * - angles.ts      Stage 3 angle solvers (4 situations, SolveOutcome)
 * - line-plane-relations.ts  Stage 4 vector/line/plane relation classifiers
 * - intersections.ts         Stage 4 line-line/line-plane/plane-plane solvers
 * - equations.ts             Stage 4 vector-equation forms + membership
 */

export * from "./errors.js";
export * from "./bigint-utils.js";
export * from "./rational.js";
export * from "./radical.js";
export * from "./decimal.js";
export * from "./tolerance.js";
export * from "./vectors.js";
export * from "./matrix.js";
export * from "./line-plane.js";
export * from "./relations.js";
export * from "./derivation.js";
export * from "./validation.js";
export * from "./distances.js";
export * from "./angles.js";
export * from "./line-plane-relations.js";
export * from "./intersections.js";
export * from "./equations.js";
