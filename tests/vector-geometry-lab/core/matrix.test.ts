import {
  derivationStepV1Schema,
  validationRecordV1Schema,
} from "@/features/vector-geometry-lab/schema";
import { describe, expect, it } from "vitest";

import {
  determinant2x2,
  determinant3x3,
  matrix2x2,
  matrix3x3,
  matrixFromInts,
  matrixRank,
  rational,
  solveLinearSystem2x2,
  solveLinearSystem3x3,
  solveSquareSystem,
  unwrapCoreResult,
} from "@/features/vector-geometry-lab/core";
import type { ExactMatrix2x2, ExactMatrix3x3 } from "@/features/vector-geometry-lab/core";

describe("determinants", () => {
  it("computes 2×2 determinants exactly", () => {
    expect(
      determinant2x2(matrix2x2(rational(1), rational(2), rational(3), rational(4))),
    ).toEqual(rational(-2));
    expect(
      determinant2x2(matrix2x2(rational(1, 2), rational(0), rational(0), rational(2))),
    ).toEqual(rational(1));
  });

  it("computes 3×3 determinants exactly (Sarrus)", () => {
    expect(
      determinant3x3(
        matrix3x3(
          rational(1), rational(2), rational(3),
          rational(0), rational(1), rational(4),
          rational(5), rational(6), rational(0),
        ),
      ),
    ).toEqual(rational(1));
    expect(
      determinant3x3(
        matrix3x3(
          rational(1), rational(2), rational(3),
          rational(4), rational(5), rational(6),
          rational(7), rational(8), rational(9),
        ),
      ),
    ).toEqual(rational(0));
    expect(
      determinant3x3(
        matrix3x3(
          rational(2), rational(0), rational(0),
          rational(0), rational(3), rational(0),
          rational(0), rational(0), rational(5),
        ),
      ),
    ).toEqual(rational(30));
  });

  it("handles 30-digit entries exactly", () => {
    const big = rational(10n ** 30n);
    expect(determinant2x2(matrix2x2(big, rational(1), rational(1), rational(1)))).toEqual(
      rational(10n ** 30n - 1n),
    );
  });

  it("rejects wrong shapes", () => {
    const wrong2 = matrix3x3(
      rational(1), rational(0), rational(0),
      rational(0), rational(1), rational(0),
      rational(0), rational(0), rational(1),
    ) as unknown as ExactMatrix2x2;
    expect(() => determinant2x2(wrong2)).toThrow(RangeError);
    const wrong3 = matrix2x2(rational(1), rational(0), rational(0), rational(1)) as unknown as ExactMatrix3x3;
    expect(() => determinant3x3(wrong3)).toThrow(RangeError);
  });
});

describe("matrixRank — exact", () => {
  it("ranks standard cases", () => {
    expect(unwrapCoreResult(matrixRank(matrixFromInts([[0, 0], [0, 0]])))).toBe(0);
    expect(unwrapCoreResult(matrixRank(matrixFromInts([[1, 2], [2, 4]])))).toBe(1);
    expect(unwrapCoreResult(matrixRank(matrixFromInts([[1, 2], [3, 4]])))).toBe(2);
    expect(
      unwrapCoreResult(
        matrixRank(matrixFromInts([[1, 0, 0], [0, 1, 0], [0, 0, 1]])),
      ),
    ).toBe(3);
    expect(
      unwrapCoreResult(
        matrixRank(matrixFromInts([[1, 2, 3], [4, 5, 6], [7, 8, 9]])),
      ),
    ).toBe(2);
  });

  it("ranks rectangular matrices", () => {
    expect(unwrapCoreResult(matrixRank(matrixFromInts([[1, 2, 3], [4, 5, 6]])))).toBe(2);
    expect(unwrapCoreResult(matrixRank(matrixFromInts([[1, 2], [2, 4], [3, 6]])))).toBe(1);
    expect(unwrapCoreResult(matrixRank(matrixFromInts([[0, 0, 0]])))).toBe(0);
  });

  it("defines rank 0 for empty matrices", () => {
    expect(unwrapCoreResult(matrixRank([]))).toBe(0);
    expect(unwrapCoreResult(matrixRank([[], []]))).toBe(0);
  });

  it("refuses ragged matrices structurally", () => {
    const result = matrixRank(matrixFromInts([[1, 2], [3]]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("non-rectangular-matrix");
    }
  });
});

describe("solveLinearSystem2x2", () => {
  it("solves a unique system with derivations and validation", () => {
    const outcome = solveLinearSystem2x2(
      matrix2x2(rational(2), rational(1), rational(1), rational(3)),
      [rational(5), rational(10)],
    );
    expect(outcome.result.classification).toBe("unique");
    if (outcome.result.classification === "unique") {
      expect(outcome.result.solution).toEqual([rational(1), rational(3)]);
    }
    expect(outcome.derivations.length).toBeGreaterThanOrEqual(3);
    for (const step of outcome.derivations) {
      expect(derivationStepV1Schema.safeParse(step).success).toBe(true);
    }
    expect(outcome.validation).toHaveLength(2);
    for (const record of outcome.validation) {
      expect(validationRecordV1Schema.safeParse(record).success).toBe(true);
      expect(record.passed).toBe(true);
      expect(record.rule).toMatch(/^back-substitution-row-/);
      expect(record.residual).toMatchObject({ numerator: "0" });
    }
  });

  it("swaps rows when the first pivot is zero", () => {
    const outcome = solveLinearSystem2x2(
      matrix2x2(rational(0), rational(1), rational(1), rational(0)),
      [rational(2), rational(3)],
    );
    expect(outcome.result.classification).toBe("unique");
    if (outcome.result.classification === "unique") {
      expect(outcome.result.solution).toEqual([rational(3), rational(2)]);
    }
  });

  it("classifies no-solution with a consistency record", () => {
    const outcome = solveLinearSystem2x2(
      matrix2x2(rational(1), rational(1), rational(1), rational(1)),
      [rational(2), rational(3)],
    );
    expect(outcome.result.classification).toBe("no-solution");
    expect(outcome.validation[0]?.rule).toBe("consistency-check");
    // The consistency check FAILS (a contradictory row exists) — that
    // failure is exactly the evidence for the no-solution classification,
    // so the record is an honest warning, not a fabricated pass.
    expect(outcome.validation[0]?.passed).toBe(false);
    expect(outcome.validation[0]?.severity).toBe("warning");
    expect(outcome.derivations.at(-1)?.result).toBe("no-solution");
  });

  it("classifies infinite-solutions with a rank record", () => {
    const outcome = solveLinearSystem2x2(
      matrix2x2(rational(1), rational(1), rational(2), rational(2)),
      [rational(2), rational(4)],
    );
    expect(outcome.result.classification).toBe("infinite-solutions");
    expect(outcome.validation[0]?.rule).toBe("rank-deficiency-check");
  });

  it("solves fractional systems exactly", () => {
    const outcome = solveLinearSystem2x2(
      matrix2x2(rational(1, 2), rational(0), rational(0), rational(1, 3)),
      [rational(1), rational(1)],
    );
    if (outcome.result.classification === "unique") {
      expect(outcome.result.solution).toEqual([rational(2), rational(3)]);
    }
    expect(outcome.result.classification).toBe("unique");
  });

  it("solves 30-digit systems exactly", () => {
    const big = rational(10n ** 30n);
    const outcome = solveLinearSystem2x2(
      matrix2x2(big, rational(0), rational(0), rational(1)),
      [big, rational(2)],
    );
    if (outcome.result.classification === "unique") {
      expect(outcome.result.solution).toEqual([rational(1), rational(2)]);
    }
    expect(outcome.result.classification).toBe("unique");
  });
});

describe("solveLinearSystem3x3", () => {
  it("solves a unique 3×3 system", () => {
    // x + y + z = 6; 2y + 5z = -4; 2x + 5y - z = 27 → (5, 3, -2).
    const outcome = solveLinearSystem3x3(
      matrix3x3(
        rational(1), rational(1), rational(1),
        rational(0), rational(2), rational(5),
        rational(2), rational(5), rational(-1),
      ),
      [rational(6), rational(-4), rational(27)],
    );
    expect(outcome.result.classification).toBe("unique");
    if (outcome.result.classification === "unique") {
      expect(outcome.result.solution).toEqual([rational(5), rational(3), rational(-2)]);
    }
    expect(outcome.validation).toHaveLength(3);
    for (const record of outcome.validation) {
      expect(validationRecordV1Schema.safeParse(record).success).toBe(true);
      expect(record.passed).toBe(true);
    }
  });

  it("classifies a contradictory 3×3 system", () => {
    const outcome = solveLinearSystem3x3(
      matrix3x3(
        rational(1), rational(1), rational(1),
        rational(1), rational(1), rational(1),
        rational(1), rational(2), rational(3),
      ),
      [rational(1), rational(2), rational(3)],
    );
    expect(outcome.result.classification).toBe("no-solution");
  });

  it("classifies a rank-deficient consistent 3×3 system", () => {
    const outcome = solveLinearSystem3x3(
      matrix3x3(
        rational(1), rational(1), rational(1),
        rational(2), rational(2), rational(2),
        rational(3), rational(3), rational(3),
      ),
      [rational(6), rational(12), rational(18)],
    );
    expect(outcome.result.classification).toBe("infinite-solutions");
  });

  it("classifies a column-deficient system (free variable)", () => {
    // x + y = 3; 2x + 2y = 6; x + y = 3 → rank 1, infinite.
    const outcome = solveLinearSystem3x3(
      matrix3x3(
        rational(1), rational(1), rational(0),
        rational(2), rational(2), rational(0),
        rational(1), rational(1), rational(0),
      ),
      [rational(3), rational(6), rational(3)],
    );
    expect(outcome.result.classification).toBe("infinite-solutions");
  });
});

describe("solveSquareSystem guards", () => {
  it("refuses non-square input structurally", () => {
    const result = solveSquareSystem(matrixFromInts([[1, 2, 3], [4, 5, 6]]), [
      rational(1),
      rational(2),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid-input");
    }
  });

  it("refuses empty systems", () => {
    const result = solveSquareSystem([], []);
    expect(result.ok).toBe(false);
  });

  it("refuses mismatched rhs length", () => {
    const result = solveSquareSystem(matrixFromInts([[1, 0], [0, 1]]), [rational(1)]);
    expect(result.ok).toBe(false);
  });

  it("refuses ragged matrices", () => {
    const result = solveSquareSystem(matrixFromInts([[1, 2], [3]]), [
      rational(1),
      rational(2),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("non-rectangular-matrix");
    }
  });

  it("throws RangeError from the typed wrappers on wrong shapes", () => {
    const wrong = matrix3x3(
      rational(1), rational(0), rational(0),
      rational(0), rational(1), rational(0),
      rational(0), rational(0), rational(1),
    ) as unknown as ExactMatrix2x2;
    expect(() => solveLinearSystem2x2(wrong, [rational(1), rational(2)])).toThrow(
      RangeError,
    );
    const wrong3 = matrix2x2(rational(1), rational(0), rational(0), rational(1)) as unknown as ExactMatrix3x3;
    expect(() =>
      solveLinearSystem3x3(wrong3, [rational(1), rational(2), rational(3)]),
    ).toThrow(RangeError);
  });

  it("throws RangeError from the typed wrappers on mismatched rhs length", () => {
    const matrix = matrix2x2(rational(1), rational(0), rational(0), rational(1));
    const shortRhs = [rational(1)] as unknown as [
      ReturnType<typeof rational>,
      ReturnType<typeof rational>,
    ];
    expect(() => solveLinearSystem2x2(matrix, shortRhs)).toThrow(RangeError);
    const matrix3 = matrix3x3(
      rational(1), rational(0), rational(0),
      rational(0), rational(1), rational(0),
      rational(0), rational(0), rational(1),
    );
    const shortRhs3 = [rational(1)] as unknown as [
      ReturnType<typeof rational>,
      ReturnType<typeof rational>,
      ReturnType<typeof rational>,
    ];
    expect(() => solveLinearSystem3x3(matrix3, shortRhs3)).toThrow(RangeError);
  });
});

describe("determinism", () => {
  it("produces deeply identical outcomes for identical systems", () => {
    const matrix = matrix2x2(rational(2), rational(1), rational(1), rational(3));
    const rhs: [ReturnType<typeof rational>, ReturnType<typeof rational>] = [
      rational(5),
      rational(10),
    ];
    const first = solveLinearSystem2x2(matrix, rhs);
    const second = solveLinearSystem2x2(matrix, rhs);
    expect(first).toEqual(second);
  });
});
