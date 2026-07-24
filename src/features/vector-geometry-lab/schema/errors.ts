import { z } from "zod";

/**
 * Structured, JSON-serializable failure surface for every contract entry point.
 *
 * Design decision: parsing never throws naked errors. Callers receive a
 * discriminated `ParseResult` so that downstream stages (core engine, UI,
 * storage import) can render structured rejection states instead of crashing.
 */
export const CONTRACT_ERROR_CODES = [
  "invalid-input",
  "unsupported-schema-version",
] as const;

export type ContractErrorCode = (typeof CONTRACT_ERROR_CODES)[number];

export interface ContractIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export interface ContractError {
  readonly code: ContractErrorCode;
  readonly message: string;
  readonly issues: readonly ContractIssue[];
}

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ContractError };

export function contractError(
  code: ContractErrorCode,
  message: string,
  issues: readonly ContractIssue[] = [],
): ContractError {
  return { code, message, issues };
}

export function parseFailure<T>(
  code: ContractErrorCode,
  message: string,
  issues: readonly ContractIssue[] = [],
): ParseResult<T> {
  return { ok: false, error: contractError(code, message, issues) };
}

export function parseSuccess<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}

export function invalidInputFromZod(
  error: z.ZodError,
  message = "Input failed contract validation.",
): ContractError {
  return contractError(
    "invalid-input",
    message,
    error.issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join("."),
      message: issue.message,
      code: issue.code,
    })),
  );
}

/**
 * Runs a Zod schema and converts the outcome into a structured ParseResult.
 * This is the single choke point through which every public parse helper goes.
 */
export function safeParseContract<S extends z.ZodType>(
  schema: S,
  input: unknown,
  message?: string,
): ParseResult<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) {
    return parseSuccess(result.data);
  }
  return { ok: false, error: invalidInputFromZod(result.error, message) };
}
