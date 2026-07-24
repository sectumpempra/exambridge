import { describe, expect, it } from "vitest";
import { scalarFromLiteral } from "@/features/vector-geometry-lab/schema";
import type {
  DerivationStepV1,
  ValidationRecordV1,
} from "@/features/vector-geometry-lab/schema";
import { vectorAngle } from "@/features/vector-geometry-lab/core";
import type { SolveOutcome } from "@/features/vector-geometry-lab/core";
import {
  buildExplanationModel,
  EXPLANATION_MODEL_VERSION,
  EXPLANATION_SECTION_IDS,
  EXPLANATION_SECTION_TITLES,
  explanationToPlainText,
} from "@/features/vector-geometry-lab/explain";
import type {
  ExplanationItem,
  ExplanationResultSummary,
} from "@/features/vector-geometry-lab/explain";

function makeScalar(literal: string) {
  const parsed = scalarFromLiteral(literal);
  if (!parsed.ok) {
    throw new Error("bad test literal");
  }
  return parsed.value;
}

function vec(x: string, y: string, z: string) {
  return { x: makeScalar(x), y: makeScalar(y), z: makeScalar(z) };
}

function step(partial: Partial<DerivationStepV1> & { title: string }): DerivationStepV1 {
  return {
    stepId: `s-${partial.title}`,
    order: 1,
    description: "",
    formula: "",
    substitution: "",
    result: "",
    ...partial,
  };
}

function solvedAnalysis(
  summary: ExplanationResultSummary,
  derivations: readonly DerivationStepV1[],
  validation: readonly ValidationRecordV1[],
): SolveOutcome<ExplanationResultSummary> {
  return { result: summary, derivations, validation };
}

const SUBJECT = {
  knownInputs: [
    { key: "u", value: "(1, 2, 3)" },
    { key: "v", value: "(-2, 1, 0)" },
  ],
  equations: [{ label: "free vectors", equation: "u, v (no anchor point)" }],
  directionVectors: [
    { key: "direction of u", value: "(1, 2, 3)" },
    { key: "direction of v", value: "(-2, 1, 0)" },
  ],
} as const;

function sectionItems(
  model: ReturnType<typeof buildExplanationModel>,
  sectionId: (typeof EXPLANATION_SECTION_IDS)[number],
): readonly ExplanationItem[] {
  const section = model.sections.find((s) => s.sectionId === sectionId);
  if (section === undefined) {
    throw new Error(`missing section ${sectionId}`);
  }
  return section.items;
}

describe("buildExplanationModel — structure and fixed order", () => {
  const model = buildExplanationModel({
    analysisId: "a1",
    title: "Angle between two vectors",
    subject: SUBJECT,
    analysis: {
      kind: "solved",
      outcome: solvedAnalysis(
        { conclusion: "θ = 90°", relationVerdict: "perpendicular" },
        [],
        [],
      ),
    },
  });

  it("carries the model version, id, title and status", () => {
    expect(model.modelVersion).toBe(EXPLANATION_MODEL_VERSION);
    expect(model.analysisId).toBe("a1");
    expect(model.title).toBe("Angle between two vectors");
    expect(model.status).toBe("solved");
    expect(model.refusal).toBeUndefined();
  });

  it("always contains all ten sections in the spec-fixed order", () => {
    expect(model.sections.map((s) => s.sectionId)).toEqual([
      ...EXPLANATION_SECTION_IDS,
    ]);
    expect(model.sections.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const section of model.sections) {
      expect(section.title).toBe(EXPLANATION_SECTION_TITLES[section.sectionId]);
    }
  });

  it("is JSON-serializable (structured clone for Stage 7 HTML export)", () => {
    const roundTripped = JSON.parse(JSON.stringify(model)) as typeof model;
    expect(roundTripped).toEqual(model);
  });
});

describe("buildExplanationModel — section assembly", () => {
  const derivations = [
    step({
      title: "Write down the known quantities",
      substitution: "u = (1, 2, 3), v = (-2, 1, 0)",
      order: 1,
    }),
    step({
      title: "State the formula",
      formula: "cos θ = (u·v) / (|u||v|)",
      order: 2,
    }),
    step({
      title: "Evaluate",
      result: "θ = 90°",
      order: 3,
    }),
    step({
      title: "Note",
      description: "narrative only",
      order: 4,
    }),
  ];
  const validation: ValidationRecordV1[] = [
    {
      validationId: "v1",
      rule: "cosine-within-bounds",
      severity: "info",
      passed: true,
      message: "cos θ = 0 lies in [-1, 1]",
      targetIds: ["u", "v"],
      residual: makeScalar("0"),
      tolerance: "1e-9",
    },
    {
      validationId: "v2",
      rule: "perpendicular-dot-zero",
      severity: "error",
      passed: false,
      message: "deliberately failing record",
      targetIds: ["u"],
    },
  ];
  const model = buildExplanationModel({
    analysisId: "a2",
    title: "Angle",
    subject: SUBJECT,
    analysis: {
      kind: "solved",
      outcome: solvedAnalysis(
        {
          conclusion: "θ = 90° (perpendicular)",
          geometricConclusion: "The vectors meet at a right angle.",
          relationVerdict: "perpendicular",
          keyResults: [{ key: "dot product", value: "0 (dimensionless)" }],
          specialNotes: ["Angle between lines is capped at 90° by definition."],
        },
        derivations,
        validation,
      ),
    },
  });

  it("routes subject facts to the first three sections", () => {
    expect(sectionItems(model, "known-inputs")).toEqual([
      { kind: "key-value", key: "u", value: "(1, 2, 3)" },
      { kind: "key-value", key: "v", value: "(-2, 1, 0)" },
    ]);
    expect(sectionItems(model, "vector-equations")).toEqual([
      { kind: "formula", formula: "u, v (no anchor point)", note: "free vectors" },
    ]);
    expect(sectionItems(model, "directions-normals")).toHaveLength(2);
  });

  it("splits derivation steps into formulas / substitution / solving", () => {
    const formulas = sectionItems(model, "formulas");
    expect(formulas).toEqual([
      {
        kind: "formula",
        formula: "cos θ = (u·v) / (|u||v|)",
      },
    ]);
    const substitution = sectionItems(model, "substitution");
    expect(substitution[0]).toEqual({
      kind: "key-value",
      key: "1. Write down the known quantities",
      value: "u = (1, 2, 3), v = (-2, 1, 0)",
    });
    // Narrative-only steps are preserved, not dropped.
    expect(
      substitution.some(
        (item) => item.kind === "text" && item.text.includes("narrative only"),
      ),
    ).toBe(true);
    expect(sectionItems(model, "solving")[0]).toEqual({
      kind: "key-value",
      key: "3. Evaluate",
      value: "θ = 90°",
    });
  });

  it("renders validation records with pass/fail markers, residual and tolerance", () => {
    const items = sectionItems(model, "verification");
    expect(items[0]).toEqual({
      kind: "key-value",
      key: "✓ cosine-within-bounds",
      value: "cos θ = 0 lies in [-1, 1]; residual 0.000000; tolerance 1e-9",
    });
    expect(items[1]).toEqual({
      kind: "key-value",
      key: "✗ perpendicular-dot-zero",
      value: "deliberately failing record",
    });
  });

  it("places verdict, key results, conclusion and special notes", () => {
    expect(sectionItems(model, "relation-verdict")).toEqual([
      { kind: "text", text: "perpendicular" },
    ]);
    const solving = sectionItems(model, "solving");
    expect(solving.some(
      (item) => item.kind === "key-value" && item.key === "dot product",
    )).toBe(true);
    expect(sectionItems(model, "geometric-conclusion")).toEqual([
      { kind: "text", text: "θ = 90° (perpendicular)" },
      { kind: "text", text: "The vectors meet at a right angle." },
    ]);
    expect(sectionItems(model, "special-conditions")).toEqual([
      { kind: "text", text: "Angle between lines is capped at 90° by definition." },
    ]);
  });
});

describe("buildExplanationModel — refused analyses (spec §10.20)", () => {
  const model = buildExplanationModel({
    analysisId: "a3",
    title: "Angle between two vectors",
    subject: SUBJECT,
    analysis: {
      kind: "refused",
      code: "zero-vector",
      message:
        "vector2 is the zero vector; the angle involving a zero vector is undefined",
      details: { operand: "vector2" },
      derivations: [step({ title: "Partial work", formula: "cos θ = ...", order: 1 })],
    },
  });

  it("produces a complete model with status refused and no fabricated answer", () => {
    expect(model.status).toBe("refused");
    expect(model.refusal?.code).toBe("zero-vector");
    expect(model.sections).toHaveLength(10);
    // The geometric conclusion states the refusal — never a fake angle.
    const conclusion = sectionItems(model, "geometric-conclusion");
    expect(conclusion).toHaveLength(1);
    expect(conclusion[0]).toEqual({
      kind: "text",
      text: "No result is displayed: vector2 is the zero vector; the angle involving a zero vector is undefined",
    });
    const text = explanationToPlainText(model);
    expect(text).not.toMatch(/θ = \d/);
  });

  it("records the refusal reason, details and applicability guidance", () => {
    const special = sectionItems(model, "special-conditions");
    expect(special[0]).toEqual({
      kind: "text",
      text: "Refusal reason (zero-vector): vector2 is the zero vector; the angle involving a zero vector is undefined",
    });
    expect(special).toContainEqual({
      kind: "key-value",
      key: "refusal detail: operand",
      value: "vector2",
    });
    expect(
      special.some((item) => item.kind === "text" && item.text.includes("fabricated")),
    ).toBe(true);
    // Partial derivations are still shown for transparency.
    expect(sectionItems(model, "formulas")).toHaveLength(1);
    expect(sectionItems(model, "relation-verdict")[0]).toEqual({
      kind: "text",
      text: "No verdict: the analysis was refused before any relation was classified.",
    });
  });

  it("plain text marks the refusal in the status line", () => {
    const text = explanationToPlainText(model);
    expect(text).toContain("Status: refused (zero-vector)");
    expect(text).toContain("Refusal: vector2 is the zero vector");
  });
});

describe("explanationToPlainText", () => {
  it("renders every section with headers, items and (none) placeholders", () => {
    const model = buildExplanationModel({
      analysisId: "a4",
      title: "T",
      subject: { knownInputs: [], equations: [], directionVectors: [] },
      analysis: {
        kind: "solved",
        outcome: solvedAnalysis({ conclusion: "done" }, [], []),
      },
    });
    const text = explanationToPlainText(model);
    expect(text.startsWith("T\nStatus: solved")).toBe(true);
    expect(text).toContain("== 1. 已知条件 / Known inputs ==");
    expect(text).toContain(
      "== 10. 特殊情形与适用限制 / Conditions and limitations ==",
    );
    expect(text).toContain("- (none)");
    expect(text).toContain("- done");
    // Deterministic: same model ⇒ same text.
    expect(explanationToPlainText(model)).toBe(text);
  });

  it("keeps equation labels but omits derivation scaffold from formula rows", () => {
    const model = buildExplanationModel({
      analysisId: "a5",
      title: "T",
      subject: SUBJECT,
      analysis: {
        kind: "solved",
        outcome: solvedAnalysis(
          { conclusion: "c" },
          [step({ title: "F", formula: "a = b", order: 1 })],
          [],
        ),
      },
    });
    const text = explanationToPlainText(model);
    expect(text).toContain("- a = b");
    expect(text).not.toContain("[1. F]");
    expect(text).toContain("- u, v (no anchor point)   [free vectors]");
  });
});

describe("integration: a real core SolveOutcome flows through the builder", () => {
  it("vectorAngle(90° case) produces a solved model with real derivations", () => {
    const outcome = vectorAngle(vec("1", "2", "3"), vec("-2", "1", "0"));
    if (!outcome.ok) {
      throw new Error("expected a solved outcome");
    }
    const summary: ExplanationResultSummary = {
      conclusion: `θ = ${outcome.value.result.angle.angleDegrees}°`,
      relationVerdict: outcome.value.result.classification,
    };
    const model = buildExplanationModel({
      analysisId: "real-1",
      title: "Angle between two vectors",
      subject: SUBJECT,
      analysis: { kind: "solved", outcome: { ...outcome.value, result: summary } },
    });
    expect(model.status).toBe("solved");
    const formulas = sectionItems(model, "formulas");
    expect(formulas.length).toBeGreaterThan(0);
    const verification = sectionItems(model, "verification");
    expect(verification.length).toBeGreaterThan(0);
    expect(sectionItems(model, "relation-verdict")).toEqual([
      { kind: "text", text: "perpendicular" },
    ]);
  });

  it("a refused core call produces a refused model (zero vector operand)", () => {
    const outcome = vectorAngle(vec("1", "2", "3"), vec("0", "0", "0"));
    if (outcome.ok) {
      throw new Error("expected a refusal");
    }
    const model = buildExplanationModel({
      analysisId: "real-2",
      title: "Angle between two vectors",
      subject: SUBJECT,
      analysis: {
        kind: "refused",
        code: outcome.error.code,
        message: outcome.error.message,
        ...(outcome.error.details !== undefined
          ? { details: outcome.error.details }
          : {}),
      },
    });
    expect(model.status).toBe("refused");
    expect(model.refusal?.code).toBe("zero-vector");
  });
});
