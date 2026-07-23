import inventory from "../generated/all-subject-facts-v1/wave2-source-inventory.json";
import { describe, expect, it } from "vitest";

describe("Wave 2 official-source inventory", () => {
  it("keeps the 21 high-demand qualification codes distinct", () => {
    expect(inventory.records).toHaveLength(21);
    expect(new Set(inventory.records.map(record => record.subjectCode)).size).toBe(21);
  });

  it("keeps all six AQA subjects local-only", () => {
    const aqa = inventory.records.filter(record => record.processingPolicy === "codex-local-only");
    expect(aqa.map(record => record.subjectCode).sort()).toEqual(["7132", "7136", "7402", "7405", "7408", "7517"]);
    expect(aqa.every(record => record.externalModelProhibitionReason?.includes("AQA"))).toBe(true);
  });

  it("does not treat display overviews as canonical rule evidence", () => {
    expect(inventory.status).toBe("source-inventory-only");
    const candidateCodes = inventory.records
      .filter(record => record.qualificationFactsCandidate?.reviewStatus === "codex-reviewed")
      .map(record => record.subjectCode)
      .sort();
    expect(candidateCodes).toEqual(["9700", "9701", "9702"]);
    expect(inventory.records.every(record => record.qualificationFactsCandidate === null
      ? record.gaps.resitPolicy === "official-rule-evidence-required"
      : record.qualificationFactsCandidate.activationStatus === "candidate-only")).toBe(true);
  });
});
