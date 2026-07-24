/**
 * ExplanationModel — the structured, JSON-serializable teaching explanation
 * (spec §6). Section order is FIXED by the spec and always present (empty
 * item lists allowed) so renderers — React now, HTML export in Stage 7 —
 * can rely on a stable shape.
 */

import type { DerivationStepV1, ValidationRecordV1 } from "@/features/vector-geometry-lab/schema";
import type { SolveOutcome } from "@/features/vector-geometry-lab/core";

export const EXPLANATION_MODEL_VERSION = "1.0.0" as const;

/** Fixed section order (spec §6 解释顺序固定). */
export const EXPLANATION_SECTION_IDS = [
  "known-inputs",
  "vector-equations",
  "directions-normals",
  "relation-verdict",
  "formulas",
  "substitution",
  "solving",
  "geometric-conclusion",
  "verification",
  "special-conditions",
] as const;

export type ExplanationSectionId = (typeof EXPLANATION_SECTION_IDS)[number];

export const EXPLANATION_SECTION_TITLES: Readonly<
  Record<ExplanationSectionId, string>
> = Object.freeze({
  "known-inputs": "已知条件 / Known inputs",
  "vector-equations": "对象的向量方程 / Vector equations",
  "directions-normals": "方向向量与法向量 / Directions and normals",
  "relation-verdict": "几何关系判定 / Relation verdict",
  formulas: "使用公式 / Formulas used",
  substitution: "代入 / Substitution",
  solving: "求解 / Solving",
  "geometric-conclusion": "几何结论 / Geometric conclusion",
  verification: "结果核验 / Verification",
  "special-conditions": "特殊情形与适用限制 / Conditions and limitations",
});

export type ExplanationItem =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "formula"; readonly formula: string; readonly note?: string }
  | { readonly kind: "key-value"; readonly key: string; readonly value: string };

export interface ExplanationSection {
  readonly sectionId: ExplanationSectionId;
  /** 1-based position in the fixed order. */
  readonly order: number;
  readonly title: string;
  readonly items: readonly ExplanationItem[];
}

export interface ExplanationRefusal {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>>;
}

export interface ExplanationModel {
  readonly modelVersion: typeof EXPLANATION_MODEL_VERSION;
  readonly analysisId: string;
  readonly title: string;
  /** "refused" models NEVER carry a result — no fabricated answers. */
  readonly status: "solved" | "refused";
  readonly refusal?: ExplanationRefusal;
  readonly sections: readonly ExplanationSection[];
}

/* --------------------------------------------------------------------------
 * Builder input types
 * ------------------------------------------------------------------------ */

export interface KeyValuePair {
  readonly key: string;
  readonly value: string;
}

export interface EquationRef {
  readonly label: string;
  readonly equation: string;
}

/** What the analysis is ABOUT — scene-side facts, supplied by the caller. */
export interface ExplanationSubject {
  readonly knownInputs: readonly KeyValuePair[];
  readonly equations: readonly EquationRef[];
  readonly directionVectors: readonly KeyValuePair[];
}

/** Solver-agnostic summary of a successful SolveOutcome.result payload. */
export interface ExplanationResultSummary {
  /** The direct conclusion (spec §4.1). */
  readonly conclusion: string;
  /** Geometric interpretation (spec §4.6). */
  readonly geometricConclusion?: string;
  /** Relation classification, when the analysis classifies a relation. */
  readonly relationVerdict?: string;
  /** Headline numeric results (value strings carry their unit). */
  readonly keyResults?: readonly KeyValuePair[];
  /** Degenerate / special-case notes (spec §4.9). */
  readonly specialNotes?: readonly string[];
}

export type ExplanationAnalysisInput =
  | {
      readonly kind: "solved";
      readonly outcome: SolveOutcome<ExplanationResultSummary>;
    }
  | {
      readonly kind: "refused";
      readonly code: string;
      readonly message: string;
      readonly details?: Readonly<Record<string, string>>;
      readonly derivations?: readonly DerivationStepV1[];
      readonly validation?: readonly ValidationRecordV1[];
    };

export interface BuildExplanationInput {
  readonly analysisId: string;
  readonly title: string;
  readonly subject: ExplanationSubject;
  readonly analysis: ExplanationAnalysisInput;
}
