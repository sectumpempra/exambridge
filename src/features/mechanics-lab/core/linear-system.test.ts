import { describe, expect, it } from "vitest";
import { analyzeLinearSystem } from "./linear-system.js";

describe("analyzeLinearSystem", () => {
  it("满秩方阵：唯一解且残差为 0", () => {
    const r = analyzeLinearSystem(
      [
        [2, 1],
        [1, -1],
      ],
      [5, 1],
    );
    expect(r.consistent).toBe(true);
    expect(r.rank).toBe(2);
    expect(r.solution?.[0]).toBeCloseTo(2, 9);
    expect(r.solution?.[1]).toBeCloseTo(1, 9);
    expect(r.residualMax).toBeLessThan(1e-9);
  });

  it("欠定系统：报告自由列并给出被确定的未知量", () => {
    // x + y = 2；z = 5（z 被确定，x/y 自由）
    const r = analyzeLinearSystem(
      [
        [1, 1, 0],
        [0, 0, 1],
      ],
      [2, 5],
    );
    expect(r.consistent).toBe(true);
    expect(r.rank).toBe(2);
    expect(r.solution).toBeNull();
    expect(r.freeColumns.length).toBe(1);
    expect(r.determinedValues.get(2)).toBeCloseTo(5, 9);
    expect(r.determinedValues.has(0)).toBe(false);
  });

  it("矛盾系统：增广秩大于系数秩", () => {
    const r = analyzeLinearSystem(
      [
        [1, 0],
        [0, 0],
      ],
      [3, 10],
    );
    expect(r.consistent).toBe(false);
    expect(r.rank).toBe(1);
    expect(r.augmentedRank).toBe(2);
    expect(r.solution).toBeNull();
  });

  it("超定一致系统：返回解", () => {
    const r = analyzeLinearSystem([[1], [1]], [20, 20]);
    expect(r.consistent).toBe(true);
    expect(r.solution?.[0]).toBeCloseTo(20, 9);
    expect(r.residualMax).toBeLessThan(1e-9);
  });

  it("奇异方阵：不满秩", () => {
    const r = analyzeLinearSystem(
      [
        [1, 2],
        [2, 4],
      ],
      [3, 6],
    );
    expect(r.rank).toBe(1);
    expect(r.consistent).toBe(true);
    expect(r.solution).toBeNull();
  });

  it("空系统：零未知量零方程，视为可解", () => {
    const r = analyzeLinearSystem([], []);
    expect(r.unknownCount).toBe(0);
    expect(r.rank).toBe(0);
    expect(r.consistent).toBe(true);
    expect(r.solution).toEqual([]);
  });

  it("维度不匹配抛出错误", () => {
    expect(() => analyzeLinearSystem([[1, 2]], [1, 2])).toThrow("维度不匹配");
  });

  it("大尺度系统使用相对容差", () => {
    const r = analyzeLinearSystem([[1e9]], [2e9]);
    expect(r.solution?.[0]).toBeCloseTo(2, 6);
  });
});
