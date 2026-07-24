/**
 * 确定性线性系统分析：高斯消元（部分主元）+ 秩判定 + 残差检查。
 * 允许使用 mathjs 做矩阵运算复核，但不使用无约束最小二乘伪造唯一解。
 *
 * 实现注记：增广矩阵为稠密 number[][]（每行长度 n+1），
 * 消元后前 rank 行必有主元；据此使用显式断言而非防御性默认值。
 */
import { matrix, multiply, type Matrix } from "mathjs";
import { NUMERICAL_TOLERANCE } from "./tolerances.js";

export interface LinearSystemAnalysis {
  /** 未知数个数 n */
  unknownCount: number;
  /** 方程个数 m */
  equationCount: number;
  /** 系数矩阵秩 */
  rank: number;
  /** 增广矩阵秩 */
  augmentedRank: number;
  /** 是否相容（rank == augmentedRank） */
  consistent: boolean;
  /** rank == unknownCount 时给出唯一解；否则为 null */
  solution: number[] | null;
  /** 欠定时仍被唯一确定的未知量：列号 → 值 */
  determinedValues: Map<number, number>;
  /** 自由未知量列号 */
  freeColumns: number[];
  /** 唯一解的残差 max|Ax-b|；无解/非唯一时为 null */
  residualMax: number | null;
}

/**
 * 分析线性系统 A x = b。A 为 m×n，b 长度 m。
 * 主元阈值：NUMERICAL_TOLERANCE × max|A|（尺度不变）。
 */
export function analyzeLinearSystem(A: number[][], b: number[]): LinearSystemAnalysis {
  const m = A.length;
  const n = A[0]?.length ?? 0;
  if (b.length !== m) {
    throw new Error(`线性系统维度不匹配：A 有 ${m} 行，b 有 ${b.length} 个元素`);
  }
  let scale = 0;
  for (const row of A) {
    for (const v of row) scale = Math.max(scale, Math.abs(v));
  }
  for (const v of b) scale = Math.max(scale, Math.abs(v));
  const tol = Math.max(NUMERICAL_TOLERANCE, NUMERICAL_TOLERANCE * scale);

  // 增广矩阵副本（稠密，每行 n+1 个元素）
  const aug: number[][] = A.map((row, i) => [...row, b[i] as number]);
  const pivotColOfRow: number[] = new Array<number>(m).fill(-1);
  const pivotRowOfCol: number[] = new Array<number>(n).fill(-1);

  let rank = 0;
  for (let col = 0; col < n && rank < m; col++) {
    // 部分主元选取
    let pivotRow = -1;
    let pivotAbs = tol;
    for (let r = rank; r < m; r++) {
      const v = Math.abs((aug[r] as number[])[col] as number);
      if (v > pivotAbs) {
        pivotAbs = v;
        pivotRow = r;
      }
    }
    if (pivotRow < 0) continue;
    const tmp = aug[rank] as number[];
    aug[rank] = aug[pivotRow] as number[];
    aug[pivotRow] = tmp;
    pivotColOfRow[rank] = col;
    pivotRowOfCol[col] = rank;
    // 消元（得到行阶梯）
    const prow = aug[rank] as number[];
    const pivotVal = prow[col] as number;
    for (let r = 0; r < m; r++) {
      if (r === rank) continue;
      const rowR = aug[r] as number[];
      const factor = (rowR[col] as number) / pivotVal;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        rowR[c] = (rowR[c] as number) - factor * (prow[c] as number);
      }
    }
    rank++;
  }

  // 增广秩：检查 rank..m-1 行的 b 分量
  let augmentedRank = rank;
  for (let r = rank; r < m; r++) {
    if (Math.abs((aug[r] as number[])[n] as number) > tol) augmentedRank++;
  }
  const consistent = augmentedRank === rank;

  const freeColumns: number[] = [];
  for (let c = 0; c < n; c++) {
    if (pivotRowOfCol[c] === -1) freeColumns.push(c);
  }

  // 回代：令自由变量为 0，求主元变量（相容时）
  let solution: number[] | null = null;
  const determinedValues = new Map<number, number>();
  if (consistent) {
    const x = new Array<number>(n).fill(0);
    for (let r = rank - 1; r >= 0; r--) {
      const col = pivotColOfRow[r] as number;
      const row = aug[r] as number[];
      let sum = row[n] as number;
      for (let c = col + 1; c < n; c++) {
        sum -= (row[c] as number) * (x[c] as number);
      }
      x[col] = sum / (row[col] as number);
    }
    if (rank === n) {
      solution = x;
    } else {
      // 欠定：主元行不含自由列系数的未知量被唯一确定
      for (let r = 0; r < rank; r++) {
        const col = pivotColOfRow[r] as number;
        const row = aug[r] as number[];
        let hasFree = false;
        for (const fc of freeColumns) {
          if (Math.abs(row[fc] as number) > tol) {
            hasFree = true;
            break;
          }
        }
        if (!hasFree) determinedValues.set(col, x[col] as number);
      }
    }
  }

  // 残差检查（mathjs 复核）：仅当唯一解存在时
  let residualMax: number | null = null;
  if (solution !== null && m > 0 && n > 0) {
    const ma = matrix(A);
    const mx = matrix(solution.map((v) => [v]));
    const mb = matrix(b.map((v) => [v]));
    const residual = multiply(ma, mx) as Matrix;
    const rd = residual.toArray() as number[][];
    const bd = mb.toArray() as number[][];
    let maxR = 0;
    for (let i = 0; i < m; i++) {
      maxR = Math.max(maxR, Math.abs((rd[i] as number[])[0] as number - ((bd[i] as number[])[0] as number)));
    }
    residualMax = maxR;
  }

  return {
    unknownCount: n,
    equationCount: m,
    rank,
    augmentedRank,
    consistent,
    solution,
    determinedValues,
    freeColumns,
    residualMax,
  };
}
