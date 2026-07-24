import { DerivationRecorder } from "./derivation.js";
import type { SolveOutcome } from "./derivation.js";
import { buildSolveOutcome } from "./derivation.js";
import type { CoreResult } from "./errors.js";
import { coreFail, coreOk } from "./errors.js";
import type { ExactRational } from "./rational.js";
import {
  addRationals,
  divideRationalsUnsafe,
  formatRational,
  isZeroRational,
  multiplyRationals,
  rational,
  subtractRationals,
  ZERO_RATIONAL,
} from "./rational.js";
import { checkScalarResidual, validationRecordFromResidual } from "./validation.js";

/**
 * Exact rational matrix algebra (spec §4): determinants, rank, and 2×2/3×3
 * linear solves. All elimination is exact bigint rational arithmetic —
 * no floating point, no pivoting heuristics: the first non-zero entry in a
 * column is the pivot (any non-zero pivot is exact), which keeps the whole
 * process deterministic.
 */

export type ExactMatrix = readonly (readonly ExactRational[])[];

export type ExactMatrix2x2 = readonly [
  readonly [ExactRational, ExactRational],
  readonly [ExactRational, ExactRational],
];

export type ExactMatrix3x3 = readonly [
  readonly [ExactRational, ExactRational, ExactRational],
  readonly [ExactRational, ExactRational, ExactRational],
  readonly [ExactRational, ExactRational, ExactRational],
];

export function matrix2x2(
  a11: ExactRational,
  a12: ExactRational,
  a21: ExactRational,
  a22: ExactRational,
): ExactMatrix2x2 {
  return [
    [a11, a12],
    [a21, a22],
  ];
}

export function matrix3x3(
  a11: ExactRational,
  a12: ExactRational,
  a13: ExactRational,
  a21: ExactRational,
  a22: ExactRational,
  a23: ExactRational,
  a31: ExactRational,
  a32: ExactRational,
  a33: ExactRational,
): ExactMatrix3x3 {
  return [
    [a11, a12, a13],
    [a21, a22, a23],
    [a31, a32, a33],
  ];
}

/** Integer-shorthand builder for tests and derivations. */
export function matrixFromInts(rows: readonly (readonly (number | bigint)[])[]): ExactMatrix {
  return rows.map((row) => row.map((value) => rational(value)));
}

function requireRectangular(matrix: ExactMatrix): CoreResult<{
  readonly rowCount: number;
  readonly columnCount: number;
}> {
  const rowCount = matrix.length;
  const first = matrix[0];
  const columnCount = first === undefined ? 0 : first.length;
  for (let row = 0; row < rowCount; row += 1) {
    if (matrix[row]?.length !== columnCount) {
      return coreFail(
        "non-rectangular-matrix",
        `matrix rows must all have the same length (row 0 has ${columnCount}, row ${row} has ${matrix[row]?.length ?? 0})`,
      );
    }
  }
  return coreOk({ rowCount, columnCount });
}

function requireSquare(matrix: ExactMatrix, size: 2 | 3, caller: string): void {
  if (
    matrix.length !== size ||
    matrix.some((row) => row.length !== size)
  ) {
    throw new RangeError(`${caller} requires a ${size}×${size} matrix`);
  }
}

export function determinant2x2(matrix: ExactMatrix2x2): ExactRational {
  requireSquare(matrix, 2, "determinant2x2");
  const [[a, b], [c, d]] = matrix;
  return subtractRationals(multiplyRationals(a, d), multiplyRationals(b, c));
}

export function determinant3x3(matrix: ExactMatrix3x3): ExactRational {
  requireSquare(matrix, 3, "determinant3x3");
  const [r1, r2, r3] = matrix;
  const term = (
    a: ExactRational,
    b: ExactRational,
    c: ExactRational,
  ): ExactRational => multiplyRationals(multiplyRationals(a, b), c);
  // Rule of Sarrus: aei + bfg + cdh − ceg − bdi − afh.
  const positive = addAll([
    term(r1[0], r2[1], r3[2]),
    term(r1[1], r2[2], r3[0]),
    term(r1[2], r2[0], r3[1]),
  ]);
  const negative = addAll([
    term(r1[2], r2[1], r3[0]),
    term(r1[1], r2[0], r3[2]),
    term(r1[0], r2[2], r3[1]),
  ]);
  return subtractRationals(positive, negative);
}

function addAll(values: readonly ExactRational[]): ExactRational {
  let acc = ZERO_RATIONAL;
  for (const value of values) {
    acc = addRationals(acc, value);
  }
  return acc;
}

interface EchelonForm {
  readonly matrix: ExactRational[][];
  readonly rank: number;
  /** Pivot column of each rank row, in order. */
  readonly pivotColumns: readonly number[];
}

/**
 * Forward elimination to row-echelon form. Rows are swapped so that the
 * first row (from the current rank downward) with a non-zero entry in the
 * pivot column becomes the pivot row — deterministic and exact.
 *
 * `pivotColumnCount` limits which columns may host pivots; elimination
 * still sweeps every column. Solvers pass the coefficient width so the
 * augmented rhs column can never be mistaken for a pivot.
 */
function toRowEchelon(
  input: ExactRational[][],
  pivotColumnCount?: number,
): EchelonForm {
  const matrix = input.map((row) => [...row]);
  const rowCount = matrix.length;
  const columnCount = matrix[0]?.length ?? 0;
  const pivotLimit = Math.min(pivotColumnCount ?? columnCount, columnCount);
  const pivotColumns: number[] = [];
  let rank = 0;
  for (let column = 0; column < pivotLimit && rank < rowCount; column += 1) {
    let pivotRow = -1;
    for (let row = rank; row < rowCount; row += 1) {
      const candidate = matrix[row]?.[column];
      if (candidate !== undefined && !isZeroRational(candidate)) {
        pivotRow = row;
        break;
      }
    }
    if (pivotRow === -1) {
      continue;
    }
    if (pivotRow !== rank) {
      const tmpRow = matrix[rank];
      matrix[rank] = matrix[pivotRow] ?? [];
      matrix[pivotRow] = tmpRow ?? [];
    }
    const pivotRowValues = matrix[rank] ?? [];
    const pivotValue = pivotRowValues[column] ?? ZERO_RATIONAL;
    for (let row = rank + 1; row < rowCount; row += 1) {
      const rowValues = matrix[row];
      if (rowValues === undefined) {
        continue;
      }
      const entry = rowValues[column];
      if (entry === undefined || isZeroRational(entry)) {
        continue;
      }
      const factor = divideRationalsUnsafe(entry, pivotValue);
      for (let c = column; c < columnCount; c += 1) {
        const pivotEntry = pivotRowValues[c] ?? ZERO_RATIONAL;
        const current = rowValues[c] ?? ZERO_RATIONAL;
        rowValues[c] = subtractRationals(
          current,
          multiplyRationals(factor, pivotEntry),
        );
      }
    }
    pivotColumns.push(column);
    rank += 1;
  }
  return { matrix, rank, pivotColumns };
}

/**
 * Exact rank of any rectangular matrix (the number of pivot rows in exact
 * row-echelon form). Empty matrices have rank 0; ragged input is a
 * structured failure.
 */
export function matrixRank(matrix: ExactMatrix): CoreResult<number> {
  const shape = requireRectangular(matrix);
  if (!shape.ok) {
    return shape;
  }
  if (shape.value.rowCount === 0 || shape.value.columnCount === 0) {
    return coreOk(0);
  }
  const echelon = toRowEchelon(matrix.map((row) => [...row]));
  return coreOk(echelon.rank);
}

export type LinearSolution =
  | {
      readonly classification: "unique";
      readonly solution: readonly ExactRational[];
    }
  | { readonly classification: "no-solution" }
  | { readonly classification: "infinite-solutions" };

function formatSystem(matrix: ExactRational[][], rhs: ExactRational[]): string {
  return matrix
    .map((row, index) => {
      const terms = row
        .map((coefficient, c) => `${formatRational(coefficient)}·x${c + 1}`)
        .join(" + ");
      return `${terms} = ${formatRational(rhs[index] ?? ZERO_RATIONAL)}`;
    })
    .join("; ");
}

/**
 * Exact Gaussian elimination for small square systems (2×2 / 3×3), in the
 * standard SolveOutcome envelope: result + derivations + validation.
 *
 * Classification (spec §4 / §5): "unique" | "no-solution" | "infinite-solutions".
 * A unique solution is validated by exact back-substitution (per-row
 * residuals must be exactly zero); the no-solution / infinite-solutions
 * classifications are validated by recording the contradictory row or the
 * rank deficiency that proves them.
 */
export function solveSquareSystem(
  matrix: ExactMatrix,
  rhs: readonly ExactRational[],
  idPrefix = "solve",
): CoreResult<SolveOutcome<LinearSolution>> {
  const shape = requireRectangular(matrix);
  if (!shape.ok) {
    return shape;
  }
  const n = shape.value.rowCount;
  if (n === 0 || shape.value.columnCount !== n || rhs.length !== n) {
    return coreFail(
      "invalid-input",
      `solveSquareSystem requires an n×n matrix and an n-entry rhs (got ${n}×${shape.value.columnCount}, rhs ${rhs.length})`,
    );
  }

  const recorder = new DerivationRecorder(`${idPrefix}-step`);
  recorder.record({
    title: "Set up the linear system",
    description: "Solve the square system A·x = b exactly.",
    formula: "A·x = b",
    substitution: formatSystem(
      matrix.map((row) => [...row]),
      [...rhs],
    ),
  });

  // Augmented matrix [A | b], eliminated exactly; pivots are restricted to
  // the n coefficient columns so the rhs column cannot become a pivot.
  const augmented = matrix.map((row, index) => [
    ...row,
    rhs[index] ?? ZERO_RATIONAL,
  ]);
  const echelon = toRowEchelon(augmented, n);
  recorder.record({
    title: "Forward elimination",
    description:
      "Exact rational Gaussian elimination; first non-zero entry in each column is the pivot.",
    formula: "row_i ← row_i − (a_ik / a_kk)·row_k",
    result: `rank ${echelon.rank} of ${n}; pivot columns [${echelon.pivotColumns.join(", ")}]`,
  });

  // Consistency: any row below the rank with a non-zero augmented part is a
  // contradiction 0 = b' ≠ 0.
  for (let row = echelon.rank; row < n; row += 1) {
    const augmentedEntry = echelon.matrix[row]?.[n] ?? ZERO_RATIONAL;
    if (!isZeroRational(augmentedEntry)) {
      recorder.record({
        title: "Classify the system",
        description: "A contradictory row 0 = b′ (b′ ≠ 0) remains after elimination.",
        result: "no-solution",
      });
      return coreOk(
        buildSolveOutcome<LinearSolution>(
          { classification: "no-solution" },
          recorder.steps,
          [
            validationRecordFromResidual(
              checkScalarResidual(augmentedEntry, ZERO_RATIONAL),
              {
                validationId: `${idPrefix}-validation-1`,
                rule: "consistency-check",
                message: `eliminated row ${row + 1} gives the contradiction 0 = ${formatRational(augmentedEntry)}`,
                severity: "warning",
              },
            ),
          ],
        ),
      );
    }
  }

  if (echelon.rank < n) {
    recorder.record({
      title: "Classify the system",
      description: `rank ${echelon.rank} < ${n} with no contradictory row: ${n - echelon.rank} free variable(s).`,
      result: "infinite-solutions",
    });
    return coreOk(
      buildSolveOutcome<LinearSolution>(
        { classification: "infinite-solutions" },
        recorder.steps,
        [
          {
            validationId: `${idPrefix}-validation-1`,
            rule: "rank-deficiency-check",
            severity: "info",
            passed: true,
            message: `rank ${echelon.rank} is less than the ${n} unknowns; solutions form a ${n - echelon.rank}-parameter family`,
            targetIds: [],
          },
        ],
      ),
    );
  }

  // Back substitution on the triangular echelon form.
  const solution: ExactRational[] = Array.from({ length: n }, () => ZERO_RATIONAL);
  for (let row = n - 1; row >= 0; row -= 1) {
    const rowValues = echelon.matrix[row] ?? [];
    let accumulator = rowValues[n] ?? ZERO_RATIONAL;
    for (let c = row + 1; c < n; c += 1) {
      accumulator = subtractRationals(
        accumulator,
        multiplyRationals(rowValues[c] ?? ZERO_RATIONAL, solution[c] ?? ZERO_RATIONAL),
      );
    }
    solution[row] = divideRationalsUnsafe(
      accumulator,
      rowValues[row] ?? rational(1n),
    );
  }
  recorder.record({
    title: "Back substitution",
    description: "Solve the triangular system from the last row upward.",
    formula: "x_i = (b′_i − Σ_{j>i} a′_ij·x_j) / a′_ii",
    result: solution
      .map((value, index) => `x${index + 1} = ${formatRational(value)}`)
      .join(", "),
  });

  // Exact back-substitution validation: every row residual must be exactly 0.
  const validation = matrix.map((row, index) => {
    let lhs = ZERO_RATIONAL;
    row.forEach((coefficient, c) => {
      lhs = addRationals(
        lhs,
        multiplyRationals(coefficient, solution[c] ?? ZERO_RATIONAL),
      );
    });
    return validationRecordFromResidual(
      checkScalarResidual(lhs, rhs[index] ?? ZERO_RATIONAL),
      {
        validationId: `${idPrefix}-validation-${index + 1}`,
        rule: `back-substitution-row-${index + 1}`,
        targetIds: [],
      },
    );
  });

  recorder.record({
    title: "Classify the system",
    description: "Full rank with no contradictory row: exactly one solution.",
    result: "unique",
  });

  return coreOk(
    buildSolveOutcome<LinearSolution>(
      { classification: "unique", solution },
      recorder.steps,
      validation,
    ),
  );
}

/** 2×2 convenience wrapper (spec §4 checklist). */
export function solveLinearSystem2x2(
  matrix: ExactMatrix2x2,
  rhs: readonly [ExactRational, ExactRational],
): SolveOutcome<LinearSolution> {
  requireSquare(matrix, 2, "solveLinearSystem2x2");
  const outcome = solveSquareSystem(matrix, rhs, "solve2x2");
  if (!outcome.ok) {
    throw new RangeError(outcome.error.message);
  }
  return outcome.value;
}

/** 3×3 convenience wrapper (spec §4 checklist). */
export function solveLinearSystem3x3(
  matrix: ExactMatrix3x3,
  rhs: readonly [ExactRational, ExactRational, ExactRational],
): SolveOutcome<LinearSolution> {
  requireSquare(matrix, 3, "solveLinearSystem3x3");
  const outcome = solveSquareSystem(matrix, rhs, "solve3x3");
  if (!outcome.ok) {
    throw new RangeError(outcome.error.message);
  }
  return outcome.value;
}
