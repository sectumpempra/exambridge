import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MisconceptionLibraryV1Schema } from "@/domain-v2/academic-results";

const library = MisconceptionLibraryV1Schema.parse(JSON.parse(
  readFileSync("generated/academic-results-v2/misconception-library.json", "utf8"),
));
const candidate = JSON.parse(readFileSync("data/candidates/academic-results-v2/migration-candidate.json", "utf8"));

describe("Academic Results misconception library", () => {
  it("keeps all launch misconceptions source-backed and candidate-only", () => {
    expect(library.records).toHaveLength(12);
    expect(library.activationDecision).toBe("candidate-only");
    const sourceIds = new Set(candidate.sources.map((source: { sourceId: string }) => source.sourceId));
    expect(library.records.every(record => record.sourceIds.every(sourceId => sourceIds.has(sourceId)))).toBe(true);
    expect(library.records.every(record => record.reviewStatus !== "owner-approved")).toBe(true);
  });

  it("contains the high-risk route and metric distinctions required by the fact-checking product", () => {
    const ids = new Set(library.records.map(record => record.misconceptionId));
    expect([...ids]).toEqual(expect.arrayContaining([
      "misconception:component-boundary-is-award-boundary",
      "misconception:statistics-is-boundary",
      "misconception:average-paper-pum",
      "misconception:mix-staged-as-papers",
      "misconception:ial-unit-is-cashed-in-award",
      "misconception:mix-0580-core-extended",
      "misconception:mix-4ma1-tiers",
    ]));
  });

  it("uses award identity in addition to qualification version identity", () => {
    const ial = library.records.find(record => record.misconceptionId === "misconception:ial-unit-is-cashed-in-award");
    expect(ial?.qualificationVersionIds).toEqual(["Edexcel-IAL:2018"]);
    expect(ial?.awardQualificationIds.sort()).toEqual([
      "award:pearson:ial-further-mathematics",
      "award:pearson:ial-mathematics",
    ]);
  });
});
