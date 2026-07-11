import { describe, it, expect } from "vitest";
import { calculateQualification } from "@/adapters-v2/ui/calculator-facade";

describe("Calculator Facade v2 (Phase 0 stub)", () => {
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
});
