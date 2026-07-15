import { afterEach, describe, it, expect, vi } from "vitest";
import { calculateQualification } from "@/adapters-v2/ui/calculator-facade";

describe("Calculator Facade v2 (Phase 0 stub)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("returns null result for any input (v2 not yet implemented)", () => {
    const output = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [
        { unitId: "unit:pearson:ial:wma11", series: "2025-june", rawScore: 70 },
      ],
    });
    expect(output.result).toBeNull();
  });

  it("returns v2Result as null", () => {
    const output = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [],
    });
    expect(output.v2Result).toBeNull();
  });

  it("delegates to v2 when enabled", () => {
    vi.stubEnv("VITE_CALCULATOR_ENGINE", "v2");
    const output = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [{ unitId: "unit:pearson:ial:wma11", series: "2025-june", rawScore: 60 }],
    });
    expect(output.result).toBe(output.v2Result);
    expect(output.result?.status).toBe("INCOMPLETE");
  });

  it("returns an explicit shadow report in shadow mode", () => {
    vi.stubEnv("VITE_CALCULATOR_ENGINE", "shadow");
    const output = calculateQualification({
      qualificationId: "qual:pearson:ial:yma01",
      papers: [{ unitId: "unit:pearson:ial:wma11", series: "2025-june", rawScore: 60 }],
    });
    expect(output.shadowDiff?.gradeMatch).toBe(true);
    expect(output.shadowDiff?.differences[0]).toContain("Shadow mode");
  });
});
