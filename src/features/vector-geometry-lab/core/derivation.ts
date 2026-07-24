import type { DerivationStepV1, ValidationRecordV1 } from "@/features/vector-geometry-lab/schema";

/**
 * DerivationRecorder — the lightweight, deterministic step collector that
 * carries the spec §4 "nine-part explanation" payload for every public
 * solver in this package (formula / substitution / result / narrative).
 *
 * Determinism: step ids are sequential (`<prefix>-1`, `<prefix>-2`, ...) —
 * no randomness, no timestamps. The produced objects satisfy
 * derivationStepV1Schema.
 */

export interface DerivationStepInput {
  readonly title: string;
  readonly description?: string;
  readonly formula?: string;
  readonly substitution?: string;
  readonly result?: string;
}

export class DerivationRecorder {
  private readonly idPrefix: string;

  private readonly collected: DerivationStepV1[] = [];

  constructor(idPrefix = "step") {
    if (idPrefix.length === 0) {
      throw new RangeError("DerivationRecorder idPrefix must be non-empty");
    }
    this.idPrefix = idPrefix;
  }

  record(input: DerivationStepInput): DerivationStepV1 {
    if (input.title.length === 0) {
      throw new RangeError("derivation step title must be non-empty");
    }
    const step: DerivationStepV1 = {
      stepId: `${this.idPrefix}-${this.collected.length + 1}`,
      order: this.collected.length + 1,
      title: input.title,
      description: input.description ?? "",
      formula: input.formula ?? "",
      substitution: input.substitution ?? "",
      result: input.result ?? "",
    };
    this.collected.push(step);
    return step;
  }

  get size(): number {
    return this.collected.length;
  }

  get steps(): readonly DerivationStepV1[] {
    return [...this.collected];
  }
}

/**
 * The standard return shape for public solvers (spec §4 nine requirements'
 * carrier): the direct result, the worked derivation, and the
 * back-substitution / residual audit trail. Stage 3/4 solvers reuse this
 * template.
 */
export interface SolveOutcome<T> {
  readonly result: T;
  readonly derivations: readonly DerivationStepV1[];
  readonly validation: readonly ValidationRecordV1[];
}

export function buildSolveOutcome<T>(
  result: T,
  derivations: readonly DerivationStepV1[],
  validation: readonly ValidationRecordV1[],
): SolveOutcome<T> {
  return { result, derivations, validation };
}
