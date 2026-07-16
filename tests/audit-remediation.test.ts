import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getPaperById } from "@/data/papers/paperMetadata";
import { getBoundariesForPaper } from "@/data/papers/paperBoundaries";
import { getPaperMappingReadiness } from "@/data/knowledge-tree/loader-v3.2";
import type { MappingFile } from "@/data/knowledge-tree/types-v3.2";
import { MERGED_CAIE_GCSE_DATA, QUARANTINED_CAIE_LEGACY_DATA } from "@/data/official/mergedMathData";
import { getDisplayCourseCatalog } from "@/course-context/catalog";
import { getPastPaperCatalogMaturity } from "@/domain-v2/past-papers/catalog";
import type { PastPaperCatalog } from "@/domain-v2/past-papers/schema";

describe("audit remediation release invariants", () => {
  it("keeps the 2025-2027 CAIE 0580 structure aligned with official current boundaries", () => {
    const paper2 = getPaperById("CAIE-0580-P2")!;
    const paper4 = getPaperById("CAIE-0580-P4")!;
    expect(paper2).toMatchObject({ durationMinutes: 120, maxMarks: 100, weightPercent: 50, calculatorAllowed: false, effectiveFrom: 2025, effectiveTo: 2027, verificationStatus: "verified" });
    expect(paper4).toMatchObject({ durationMinutes: 120, maxMarks: 100, weightPercent: 50, calculatorAllowed: true, effectiveFrom: 2025, effectiveTo: 2027, verificationStatus: "verified" });
    for (const paper of [paper2, paper4]) {
      const currentRows = getBoundariesForPaper(paper.paperId).filter((row) => Number(row.year) >= paper.effectiveFrom);
      expect(currentRows.length).toBeGreaterThan(0);
      expect(currentRows.every((row) => row.maxMark === paper.maxMarks)).toBe(true);
      expect(paper.sourceUrl).toContain("cambridgeinternational.org");
    }
  });

  it("keeps verified CAIE 9709 metadata source-backed and versioned", () => {
    const papers = [1, 2, 3, 4, 5, 6].map((number) => getPaperById(`CAIE-9709-P${number}`)!);
    expect(papers.every((paper) => paper.syllabusVersion === "2026-2027")).toBe(true);
    expect(papers.every((paper) => paper.verificationStatus === "verified" && paper.effectiveFrom === 2026)).toBe(true);
  });

  it("does not treat null Paper references as verified Paper-level mapping", () => {
    const mapping: MappingFile = {
      board: "CAIE", subjectCode: "0580", subjectName: "Mathematics", level: "IGCSE", version: "1",
      totalTopics: 1, mappedTopics: 1, verificationStatus: "verified", paperStructure: { papers: ["P2", "P4"] },
      mappings: [{ topicId: "t", topicName: "Topic", paperReference: null, subtopicMappings: [{ subtopicId: "s", subtopicName: "Subtopic", paperReference: null, mappedNodes: [] }] }],
    };
    expect(getPaperMappingReadiness(mapping)).toMatchObject({ ready: false, coverage: 0, referencedSubtopics: 0 });
  });

  it("requires the production deployment to pass the release gate before publishing", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    expect(workflow).toContain("needs: verify");
    expect(workflow).toContain("pnpm exec tsc --noEmit --incremental false");
    expect(workflow).toContain("pnpm test:coverage");
    expect(workflow).toContain("pnpm test:e2e");
    expect(workflow.indexOf("needs: verify")).toBeLessThan(workflow.indexOf("peaceiris/actions-gh-pages"));
  });

  it("quarantines non-monotonic CAIE legacy rows outside the active data set", () => {
    expect(QUARANTINED_CAIE_LEGACY_DATA.length).toBeGreaterThan(0);
    for (const quarantined of QUARANTINED_CAIE_LEGACY_DATA) {
      expect(MERGED_CAIE_GCSE_DATA).not.toContain(quarantined);
    }
    expect(MERGED_CAIE_GCSE_DATA.every((row) => typeof row._sourceUrl === "string" && typeof row._accessedAt === "string" && typeof row._publicationStatus === "string")).toBe(true);
  });

  it("does not call a zero-asset past-paper catalog ready", () => {
    const catalog = { assets: [] } as unknown as PastPaperCatalog;
    expect(getPastPaperCatalogMaturity(catalog)).toBe("catalogued");
  });

  it("preserves capabilities when qualification aliases are deduplicated", () => {
    for (const code of ["0580", "0606", "4MA1", "1MA1"]) {
      const display = getDisplayCourseCatalog("current").find((entry) => entry.subjectCode === code);
      expect(display, code).toBeDefined();
      expect(display?.capabilities.planner.status, `${code} planner`).not.toBe("unavailable");
      expect(display?.capabilities.papers.status, `${code} papers`).not.toBe("unavailable");
    }
  });
});
