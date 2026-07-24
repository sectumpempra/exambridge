/**
 * Structured failure surface for the deterministic core engine.
 *
 * Mirrors the schema package philosophy: math-level failures (zero vector,
 * division by zero, negative radicand, ...) are returned as structured
 * `CoreResult` values — never thrown, never silently repaired. Thrown
 * errors are reserved for programmer-contract violations (e.g. a zero
 * denominator passed to the assertive `rational()` factory), following the
 * schema package precedent (ZodError in factories, RangeError for bad args).
 */

export const CORE_ERROR_CODES = [
  "zero-vector",
  "division-by-zero",
  "negative-radicand",
  "radical-reduction-overflow",
  "invalid-input",
  "non-rectangular-matrix",
  "not-parallel",
  "not-skew",
  "degenerate-input",
] as const;

export type CoreErrorCode = (typeof CORE_ERROR_CODES)[number];

export interface CoreError {
  readonly code: CoreErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>>;
}

export type CoreResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CoreError };

export function coreOk<T>(value: T): CoreResult<T> {
  return { ok: true, value };
}

export function coreFail<T>(
  code: CoreErrorCode,
  message: string,
  details?: Readonly<Record<string, string>>,
): CoreResult<T> {
  return {
    ok: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

/**
 * Unwraps a CoreResult whose failure is provably unreachable by construction
 * (e.g. a denominator that is a non-zero norm). A failure here indicates an
 * internal invariant breach, so it throws — callers must use this only when
 * the failing branch is logically impossible for valid inputs.
 */
export function unwrapCoreResult<T>(result: CoreResult<T>): T {
  if (!result.ok) {
    throw new RangeError(
      `internal invariant breached: ${result.error.code} — ${result.error.message}`,
    );
  }
  return result.value;
}
