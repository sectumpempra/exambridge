import { z } from "zod";
import { parseFailure, parseSuccess, safeParseContract } from "./errors.js";
import type { ParseResult } from "./errors.js";

/**
 * ScalarV1 — the foundation of every numeric value in the project.
 *
 * Design decisions:
 * - JSON-serializable discriminated shape carrying THREE pieces of information:
 *   the original user literal (`input`), the normalized exact rational value
 *   (`numerator`/`denominator` as decimal strings so a future bigint-backed
 *   exact engine can consume them losslessly), and an explicit exactness flag.
 * - `kind` records the surface form of the literal that produced the value
 *   ("integer" | "decimal" | "fraction"). For approximate carriers created via
 *   `approximateScalar` (e.g. input "sqrt(2)"), `kind` describes the
 *   approximation literal instead, because the raw input has no rational form.
 * - Normalization invariants (enforced by the schema, not by convention):
 *   fraction reduced to lowest terms, denominator strictly positive,
 *   integer kind always has denominator "1". `0` is a first-class value
 *   ("0"/"1") and is NEVER treated as missing data.
 * - `exact: false` marks values that are only an approximation of the input
 *   (irrational literals like "sqrt(2)"). Silent rounding is forbidden: any
 *   approximate carrier must be created explicitly through `approximateScalar`.
 */

const NUMERATOR_PATTERN = /^-?(0|[1-9]\d*)$/;
const DENOMINATOR_PATTERN = /^[1-9]\d*$/;

export const SCALAR_KINDS_V1 = ["integer", "decimal", "fraction"] as const;
export type ScalarKindV1 = (typeof SCALAR_KINDS_V1)[number];

function bigintAbs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function bigintGcd(a: bigint, b: bigint): bigint {
  let x = bigintAbs(a);
  let y = bigintAbs(b);
  while (y !== 0n) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

export const scalarV1Schema = z
  .object({
    input: z.string().min(1, "input literal must be preserved"),
    kind: z.enum(SCALAR_KINDS_V1),
    numerator: z
      .string()
      .regex(NUMERATOR_PATTERN, "numerator must be a canonical integer string"),
    denominator: z
      .string()
      .regex(
        DENOMINATOR_PATTERN,
        "denominator must be a canonical positive integer string",
      ),
    exact: z.boolean(),
  })
  .superRefine((scalar, ctx) => {
    const numerator = BigInt(scalar.numerator);
    const denominator = BigInt(scalar.denominator);
    if (bigintGcd(numerator, denominator) !== 1n) {
      ctx.addIssue({
        code: "custom",
        path: ["denominator"],
        message: "value must be normalized to lowest terms",
      });
    }
    if (scalar.kind === "integer" && denominator !== 1n) {
      ctx.addIssue({
        code: "custom",
        path: ["denominator"],
        message: 'integer kind must have denominator "1"',
      });
    }
  });

export type ScalarV1 = z.infer<typeof scalarV1Schema>;

export function parseScalar(input: unknown): ParseResult<ScalarV1> {
  return safeParseContract(scalarV1Schema, input, "Invalid ScalarV1 value.");
}

export function isZeroScalar(scalar: ScalarV1): boolean {
  return scalar.numerator === "0";
}

/** Exact structural equality on normalized parts. */
export function scalarEquals(a: ScalarV1, b: ScalarV1): boolean {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

export const ZERO_SCALAR_V1: ScalarV1 = Object.freeze({
  input: "0",
  kind: "integer",
  numerator: "0",
  denominator: "1",
  exact: true,
}) as ScalarV1;

export const ONE_SCALAR_V1: ScalarV1 = Object.freeze({
  input: "1",
  kind: "integer",
  numerator: "1",
  denominator: "1",
  exact: true,
}) as ScalarV1;

/* --------------------------------------------------------------------------
 * Literal parsing helpers
 * ------------------------------------------------------------------------ */

interface NormalizedParts {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/** Reduces to lowest terms and forces the denominator positive. */
function normalizeParts(numerator: bigint, denominator: bigint): NormalizedParts {
  let n = numerator;
  let d = denominator;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = bigintGcd(n, d);
  return { numerator: n / divisor, denominator: d / divisor };
}

const INTEGER_LITERAL = /^[+-]?\d+$/;
const FRACTION_LITERAL = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/;
const DECIMAL_LITERAL = /^([+-]?)(\d*)\.(\d*)$/;

function invalidScalarLiteral(message: string): ParseResult<ScalarV1> {
  return parseFailure("invalid-input", message, [
    { path: "input", message, code: "invalid-scalar-literal" },
  ]);
}

function buildExactScalar(
  input: string,
  kind: ScalarKindV1,
  parts: NormalizedParts,
): ScalarV1 {
  return {
    input,
    kind,
    numerator: parts.numerator.toString(),
    denominator: parts.denominator.toString(),
    exact: true,
  };
}

function parseDecimalParts(
  input: string,
): { readonly kind: "decimal"; readonly parts: NormalizedParts } | undefined {
  const match = DECIMAL_LITERAL.exec(input);
  if (match === null) {
    return undefined;
  }
  const sign = match[1] === "-" ? "-" : "";
  const integerDigits = match[2] ?? "";
  const fractionDigits = match[3] ?? "";
  if (integerDigits.length + fractionDigits.length === 0) {
    return undefined;
  }
  const digits = `${integerDigits}${fractionDigits}`;
  const numerator = BigInt(`${sign}${digits}`);
  const denominator = 10n ** BigInt(fractionDigits.length);
  return { kind: "decimal", parts: normalizeParts(numerator, denominator) };
}

/**
 * Parses a user literal into a normalized exact ScalarV1.
 * Accepted forms: integers ("-3", "+4"), decimals ("1.25", ".5", "2."),
 * fractions ("5/4", " 3 / -2 "). Anything else (e.g. "sqrt(2)", "1/0",
 * "1.2.3") is rejected with a structured invalid-input result — callers must
 * then use `approximateScalar` explicitly if an approximate carrier is wanted.
 */
export function scalarFromLiteral(rawInput: string): ParseResult<ScalarV1> {
  if (typeof rawInput !== "string") {
    return invalidScalarLiteral("Scalar input must be a string literal.");
  }
  const input = rawInput.trim();
  if (input.length === 0) {
    return invalidScalarLiteral("Scalar literal must not be empty.");
  }

  if (INTEGER_LITERAL.test(input)) {
    return parseSuccess(
      buildExactScalar(input, "integer", normalizeParts(BigInt(input), 1n)),
    );
  }

  const fractionMatch = FRACTION_LITERAL.exec(input);
  if (fractionMatch !== null) {
    const numerator = BigInt(fractionMatch[1] ?? "0");
    const denominator = BigInt(fractionMatch[2] ?? "0");
    if (denominator === 0n) {
      return invalidScalarLiteral(
        `Fraction literal "${input}" has a zero denominator.`,
      );
    }
    return parseSuccess(
      buildExactScalar(input, "fraction", normalizeParts(numerator, denominator)),
    );
  }

  const decimal = parseDecimalParts(input);
  if (decimal !== undefined) {
    return parseSuccess(buildExactScalar(input, decimal.kind, decimal.parts));
  }

  return invalidScalarLiteral(
    `Literal "${input}" is not an integer, decimal, or fraction. ` +
      "Use approximateScalar(input, approximation) with exact:false for irrational or symbolic literals.",
  );
}

/**
 * Creates an explicitly approximate scalar: `input` keeps the original
 * literal (e.g. "sqrt(2)"), the value is carried by a decimal/integer
 * `approximation` literal, and `exact` is forced to false. This is the ONLY
 * sanctioned way to carry an inexact value — silent rounding is forbidden.
 */
export function approximateScalar(
  rawInput: string,
  approximation: string,
): ParseResult<ScalarV1> {
  const input = rawInput.trim();
  if (input.length === 0) {
    return invalidScalarLiteral("Scalar input must not be empty.");
  }
  const approxLiteral = approximation.trim();
  let parts: NormalizedParts;
  let kind: ScalarKindV1;
  if (INTEGER_LITERAL.test(approxLiteral)) {
    parts = normalizeParts(BigInt(approxLiteral), 1n);
    kind = "integer";
  } else {
    const decimal = parseDecimalParts(approxLiteral);
    if (decimal === undefined) {
      return invalidScalarLiteral(
        `Approximation "${approxLiteral}" must be a finite integer or decimal literal.`,
      );
    }
    parts = decimal.parts;
    kind = "decimal";
  }
  return parseSuccess({
    input,
    kind,
    numerator: parts.numerator.toString(),
    denominator: parts.denominator.toString(),
    exact: false,
  });
}

const MAX_DECIMAL_DIGITS = 100;

/**
 * Deterministic decimal rendering of a scalar with `digits` fractional
 * places, rounded half away from zero. Rendering only — the stored value
 * remains the exact rational.
 */
export function scalarToDecimal(scalar: ScalarV1, digits = 6): string {
  if (!Number.isInteger(digits) || digits < 0 || digits > MAX_DECIMAL_DIGITS) {
    throw new RangeError(
      `digits must be an integer between 0 and ${MAX_DECIMAL_DIGITS}`,
    );
  }
  const numerator = BigInt(scalar.numerator);
  const denominator = BigInt(scalar.denominator);
  const scale = 10n ** BigInt(digits);
  const magnitude = bigintAbs(numerator) * scale;
  let scaled = magnitude / denominator;
  const remainder = magnitude % denominator;
  if (remainder * 2n >= denominator) {
    scaled += 1n;
  }
  const integerPart = scaled / scale;
  const fractionPart = (scaled % scale).toString().padStart(digits, "0");
  const sign = numerator < 0n && scaled !== 0n ? "-" : "";
  return digits === 0
    ? `${sign}${integerPart.toString()}`
    : `${sign}${integerPart.toString()}.${fractionPart}`;
}
