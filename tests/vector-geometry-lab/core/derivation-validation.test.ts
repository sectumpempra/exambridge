import {
  derivationStepV1Schema,
  validationRecordV1Schema,
} from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  buildSolveOutcome,
  checkScalarResidual,
  DerivationRecorder,
  exactVectorFromInts,
  linePointResidualVector,
  planePointResidual,
  rational,
  residualScalar,
  unwrapCoreResult,
  validationRecordFromResidual,
  ValidationRecorder,
  vectorResidualComponents,
} from "@/features/vector-geometry-lab/core";

describe("DerivationRecorder", () => {
  it("collects schema-valid steps with deterministic sequential ids", () => {
    const recorder = new DerivationRecorder();
    const first = recorder.record({
      title: "Use the dot product formula",
      formula: "a·b = |a||b|cosθ",
      substitution: "(1, 2, 3)·(4, 5, 6)",
      result: "32",
    });
    const second = recorder.record({ title: "Conclude" });
    expect(first.stepId).toBe("step-1");
    expect(first.order).toBe(1);
    expect(second.stepId).toBe("step-2");
    expect(second.order).toBe(2);
    expect(second.description).toBe("");
    expect(second.formula).toBe("");
    for (const step of recorder.steps) {
      expect(derivationStepV1Schema.safeParse(step).success).toBe(true);
    }
    expect(recorder.size).toBe(2);
  });

  it("supports custom id prefixes", () => {
    const recorder = new DerivationRecorder("solve2x2-step");
    expect(recorder.record({ title: "t" }).stepId).toBe("solve2x2-step-1");
  });

  it("rejects empty prefixes and titles", () => {
    expect(() => new DerivationRecorder("")).toThrow(RangeError);
    const recorder = new DerivationRecorder();
    expect(() => recorder.record({ title: "" })).toThrow(RangeError);
  });

  it("returns a defensive copy of the steps", () => {
    const recorder = new DerivationRecorder();
    recorder.record({ title: "step" });
    const snapshot = recorder.steps;
    (snapshot as unknown[]).pop?.();
    expect(recorder.size).toBe(1);
  });
});

describe("buildSolveOutcome", () => {
  it("assembles the standard result/derivations/validation envelope", () => {
    const recorder = new DerivationRecorder();
    recorder.record({ title: "only step" });
    const outcome = buildSolveOutcome("answer", recorder.steps, []);
    expect(outcome).toEqual({
      result: "answer",
      derivations: recorder.steps,
      validation: [],
    });
  });
});

describe("checkScalarResidual — dual path", () => {
  it("passes exactly-zero residuals without any tolerance", () => {
    const check = checkScalarResidual(rational(3, 4), rational(3, 4));
    expect(check).toEqual({
      residual: rational(0),
      passed: true,
      exact: true,
    });
    expect("tolerance" in check).toBe(false);
  });

  it("fails non-zero residuals exactly", () => {
    const check = checkScalarResidual(rational(1), rational(2));
    expect(check.passed).toBe(false);
    expect(check.residual).toEqual(rational(1));
    expect(check.exact).toBe(true);
  });

  it("uses and records the tolerance on the approximate path", () => {
    const check = checkScalarResidual(rational(1000000001), rational(1000000000), {
      exact: false,
    });
    expect(check.passed).toBe(true);
    expect(check.exact).toBe(false);
    expect(check.tolerance).toEqual({ absolute: 1e-9, relative: 1e-9 });
  });

  it("fails approximate checks beyond tolerance", () => {
    const check = checkScalarResidual(rational(1), rational(2), { exact: false });
    expect(check.passed).toBe(false);
  });

  it("honors custom tolerances", () => {
    const check = checkScalarResidual(rational(3), rational(2), {
      exact: false,
      tolerance: { absolute: 5 },
    });
    expect(check.passed).toBe(true);
    expect(check.tolerance).toEqual({ absolute: 5, relative: 1e-9 });
  });
});

describe("residualScalar", () => {
  it("carries the residual magnitude with matching exactness", () => {
    const exactCheck = checkScalarResidual(rational(1, 2), rational(1));
    expect(residualScalar(exactCheck)).toMatchObject({
      numerator: "1",
      denominator: "2",
      exact: true,
    });
    const approxCheck = checkScalarResidual(rational(1, 2), rational(1), {
      exact: false,
    });
    expect(residualScalar(approxCheck).exact).toBe(false);
  });
});

describe("validationRecordFromResidual", () => {
  it("produces schema-valid records for passing exact checks", () => {
    const record = validationRecordFromResidual(
      checkScalarResidual(rational(0), rational(0)),
      { validationId: "v-1", rule: "back-substitution" },
    );
    expect(validationRecordV1Schema.safeParse(record).success).toBe(true);
    expect(record.passed).toBe(true);
    expect(record.severity).toBe("info");
    expect(record.tolerance).toBeUndefined();
    expect(record.message).toContain("0");
  });

  it("marks failing checks as errors", () => {
    const record = validationRecordFromResidual(
      checkScalarResidual(rational(1), rational(0)),
      { validationId: "v-2", rule: "back-substitution" },
    );
    expect(record.passed).toBe(false);
    expect(record.severity).toBe("error");
    expect(validationRecordV1Schema.safeParse(record).success).toBe(true);
  });

  it("attaches the tolerance string for approximate checks", () => {
    const record = validationRecordFromResidual(
      checkScalarResidual(rational(1), rational(1), { exact: false }),
      {
        validationId: "v-3",
        rule: "residual-check",
        message: "custom message",
        targetIds: ["line-1"],
        severity: "warning",
      },
    );
    expect(record.tolerance).toBe("absolute=1e-9; relative=1e-9");
    expect(record.targetIds).toEqual(["line-1"]);
    expect(record.severity).toBe("warning");
    expect(record.message).toBe("custom message");
    expect(validationRecordV1Schema.safeParse(record).success).toBe(true);
  });
});

describe("geometry residuals", () => {
  it("computes plane point residuals r·n − d", () => {
    const equation = {
      normal: exactVectorFromInts(1, 2, 2),
      d: rational(9),
    };
    expect(planePointResidual(equation, exactVectorFromInts(1, 2, 2))).toEqual(
      rational(0),
    );
    expect(planePointResidual(equation, exactVectorFromInts(0, 0, 0))).toEqual(
      rational(-9),
    );
  });

  it("computes line residual vectors (p − a) × b", () => {
    const residualOn = linePointResidualVector(
      exactVectorFromInts(3, 2, 0),
      exactVectorFromInts(1, 2, 0),
      exactVectorFromInts(1, 0, 0),
    );
    expect(residualOn).toEqual(exactVectorFromInts(0, 0, 0));
    const residualOff = linePointResidualVector(
      exactVectorFromInts(1, 3, 0),
      exactVectorFromInts(1, 2, 0),
      exactVectorFromInts(1, 0, 0),
    );
    expect(residualOff).toEqual(exactVectorFromInts(0, 0, -1));
  });

  it("computes per-component vector residuals", () => {
    expect(
      vectorResidualComponents(
        exactVectorFromInts(1, 5, -3),
        exactVectorFromInts(4, 1, -3),
      ),
    ).toEqual(exactVectorFromInts(3, 4, 0));
  });
});

describe("ValidationRecorder", () => {
  it("collects schema-valid records with sequential ids", () => {
    const recorder = new ValidationRecorder("check");
    const first = recorder.record({
      rule: "back-substitution",
      passed: true,
      message: "ok",
      residual: residualScalar(checkScalarResidual(rational(0), rational(0))),
    });
    const second = recorder.record({
      rule: "approximate-check",
      passed: false,
      message: "bad",
      tolerance: "absolute=1e-9; relative=1e-9",
    });
    expect(first.validationId).toBe("check-1");
    expect(first.severity).toBe("info");
    expect(second.validationId).toBe("check-2");
    expect(second.severity).toBe("error");
    for (const record of recorder.records) {
      expect(validationRecordV1Schema.safeParse(record).success).toBe(true);
    }
    expect(recorder.size).toBe(2);
  });

  it("omits optional fields when not provided", () => {
    const recorder = new ValidationRecorder();
    const record = recorder.record({ rule: "r", passed: true, message: "m" });
    expect("residual" in record).toBe(false);
    expect("tolerance" in record).toBe(false);
    expect(record.targetIds).toEqual([]);
  });

  it("honors explicit severity", () => {
    const recorder = new ValidationRecorder();
    const record = recorder.record({
      rule: "r",
      passed: true,
      message: "m",
      severity: "warning",
    });
    expect(record.severity).toBe("warning");
  });

  it("rejects empty prefixes and rules", () => {
    expect(() => new ValidationRecorder("")).toThrow(RangeError);
    const recorder = new ValidationRecorder();
    expect(() => recorder.record({ rule: "", passed: true, message: "m" })).toThrow(
      RangeError,
    );
  });

  it("returns a defensive copy of the records", () => {
    const recorder = new ValidationRecorder();
    recorder.record({ rule: "r", passed: true, message: "m" });
    const snapshot = recorder.records;
    (snapshot as unknown[]).pop?.();
    expect(recorder.size).toBe(1);
  });

  it("unwrapCoreResult passes values through", () => {
    expect(unwrapCoreResult({ ok: true, value: 42 })).toBe(42);
  });
});
