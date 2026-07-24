/**
 * @/features/vector-geometry-lab/explain
 *
 * Stage 6: explanation model for ExamBridge Vector Geometry Lab V1.
 * Pure TypeScript — no React, no DOM, no Three.js. Consumes solver
 * outcomes (SolveOutcome) plus caller-supplied scene facts and produces
 * the fixed-order teaching explanation (spec §6) as structured data and
 * as plain text. Refused analyses produce complete models that state the
 * refusal — they never display a fabricated answer (spec §10.20).
 */

export * from "./model.js";
export * from "./build.js";
export * from "./plain-text.js";
