/**
 * buildExplanationModel — assembles the fixed-order ExplanationModel from a
 * solver outcome. The builder is deterministic and total: a refused
 * analysis still yields a COMPLETE model that states the refusal reason and
 * applicability limits, and never invents a formal-looking answer
 * (spec §10.20).
 */

import { scalarToDecimal } from "@/features/vector-geometry-lab/schema";
import type {
  DerivationStepV1,
  ValidationRecordV1,
} from "@/features/vector-geometry-lab/schema";
import {
  EXPLANATION_MODEL_VERSION,
  EXPLANATION_SECTION_IDS,
  EXPLANATION_SECTION_TITLES,
} from "./model.js";
import type {
  BuildExplanationInput,
  ExplanationItem,
  ExplanationModel,
  ExplanationResultSummary,
  ExplanationSection,
  ExplanationSectionId,
} from "./model.js";

type AddItem = (section: ExplanationSectionId, item: ExplanationItem) => void;

function makeAddText(add: AddItem) {
  return (section: ExplanationSectionId, text: string): void => {
    if (text.length > 0) {
      add(section, { kind: "text", text });
    }
  };
}
type AddText = ReturnType<typeof makeAddText>;

function collectDerivations(
  add: AddItem,
  addText: AddText,
  derivations: readonly DerivationStepV1[],
): void {
  for (const step of derivations) {
    if (step.formula.length > 0) {
      add("formulas", {
        kind: "formula",
        formula: step.formula,
      });
    }
    if (step.substitution.length > 0) {
      add("substitution", {
        kind: "key-value",
        key: `${step.order}. ${step.title}`,
        value: step.substitution,
      });
    }
    if (step.result.length > 0) {
      add("solving", {
        kind: "key-value",
        key: `${step.order}. ${step.title}`,
        value: step.result,
      });
    }
    // Narrative descriptions enrich the substitution section when the step
    // has no other payload, so no derivation content is silently dropped.
    if (
      step.formula.length === 0 &&
      step.substitution.length === 0 &&
      step.result.length === 0 &&
      step.description.length > 0
    ) {
      addText(
        "substitution",
        `${step.order}. ${step.title} — ${step.description}`,
      );
    }
  }
}

function collectValidation(
  add: AddItem,
  validation: readonly ValidationRecordV1[],
): void {
  for (const record of validation) {
    const marker = record.passed ? "✓" : "✗";
    const parts: string[] = [record.message];
    if (record.residual !== undefined) {
      parts.push(`residual ${scalarToDecimal(record.residual, 6)}`);
    }
    if (record.tolerance !== undefined) {
      parts.push(`tolerance ${record.tolerance}`);
    }
    add("verification", {
      kind: "key-value",
      key: `${marker} ${record.rule}`,
      value: parts.join("; "),
    });
  }
}

function collectSummary(
  add: AddItem,
  addText: AddText,
  summary: ExplanationResultSummary,
): void {
  if (summary.relationVerdict !== undefined && summary.relationVerdict.length > 0) {
    addText("relation-verdict", summary.relationVerdict);
  }
  for (const result of summary.keyResults ?? []) {
    add("solving", { kind: "key-value", key: result.key, value: result.value });
  }
  addText("geometric-conclusion", summary.conclusion);
  if (summary.geometricConclusion !== undefined) {
    addText("geometric-conclusion", summary.geometricConclusion);
  }
  for (const note of summary.specialNotes ?? []) {
    addText("special-conditions", note);
  }
}

/**
 * Builds the model. Never throws for well-typed input; unknown/extra data
 * is ignored rather than guessed at.
 */
export function buildExplanationModel(
  input: BuildExplanationInput,
): ExplanationModel {
  const buckets = new Map<ExplanationSectionId, ExplanationItem[]>(
    EXPLANATION_SECTION_IDS.map((id) => [id, []]),
  );
  const add: AddItem = (section, item) => {
    buckets.get(section)?.push(item);
  };
  const addText = makeAddText(add);

  for (const pair of input.subject.knownInputs) {
    add("known-inputs", { kind: "key-value", key: pair.key, value: pair.value });
  }
  for (const equation of input.subject.equations) {
    add("vector-equations", {
      kind: "formula",
      formula: equation.equation,
      note: equation.label,
    });
  }
  for (const pair of input.subject.directionVectors) {
    add("directions-normals", {
      kind: "key-value",
      key: pair.key,
      value: pair.value,
    });
  }

  if (input.analysis.kind === "solved") {
    collectDerivations(add, addText, input.analysis.outcome.derivations);
    collectValidation(add, input.analysis.outcome.validation);
    collectSummary(add, addText, input.analysis.outcome.result);
  } else {
    const { code, message, details } = input.analysis;
    collectDerivations(add, addText, input.analysis.derivations ?? []);
    collectValidation(add, input.analysis.validation ?? []);
    addText(
      "relation-verdict",
      "No verdict: the analysis was refused before any relation was classified.",
    );
    addText("geometric-conclusion", `No result is displayed: ${message}`);
    addText(
      "special-conditions",
      `Refusal reason (${code}): ${message}`,
    );
    for (const [key, value] of Object.entries(details ?? {})) {
      add("special-conditions", {
        kind: "key-value",
        key: `refusal detail: ${key}`,
        value,
      });
    }
    addText(
      "special-conditions",
      "No answer is fabricated for refused inputs; fix the flagged input and re-run the analysis.",
    );
  }

  const sections: ExplanationSection[] = EXPLANATION_SECTION_IDS.map(
    (sectionId, index) => ({
      sectionId,
      order: index + 1,
      title: EXPLANATION_SECTION_TITLES[sectionId],
      items: buckets.get(sectionId) ?? [],
    }),
  );

  const base = {
    modelVersion: EXPLANATION_MODEL_VERSION,
    analysisId: input.analysisId,
    title: input.title,
    sections,
  } as const;

  if (input.analysis.kind === "solved") {
    return { ...base, status: "solved" };
  }
  const { code, message, details } = input.analysis;
  return {
    ...base,
    status: "refused",
    refusal: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}
