import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getPaperById } from "@/data/papers/paperMetadata";
import { getBoundariesForPaper } from "@/data/papers/paperBoundaries";
import { getPaperMappingReadiness } from "@/data/knowledge-tree/loader-v3.2";
import type { MappingFile } from "@/data/knowledge-tree/types-v3.2";
import { ARCHIVED_CAIE_LEGACY_DATA, MERGED_CAIE_GCSE_DATA } from "@/data/official/mergedMathData";
import { getDisplayCourseCatalog } from "@/course-context/catalog";
import { getPastPaperCatalogMaturity } from "@/domain-v2/past-papers/catalog";
import type { PastPaperCatalog } from "@/domain-v2/past-papers/schema";
import { awardCatalog } from "@/domain-v2/awards/catalog";
import { COURSE_CATALOG } from "@/course-context/catalog-source";
import { KnowledgeMappingV4Schema } from "@/domain-v2/knowledge-tree/v4-schema";

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
    expect(readFileSync("package.json", "utf8")).toContain("prune-static-knowledge-candidates.mjs");
    expect(readFileSync("scripts/build-release-provenance.mjs", "utf8")).toContain("trackedPdfs");
  });

  it("does not publish candidate knowledge mappings in a static release", () => {
    const pruning = readFileSync("scripts/prune-static-knowledge-candidates.mjs", "utf8");
    expect(pruning).toContain('verificationStatus === "verified"');
    expect(pruning).toContain('publicationPolicy: "owner-approved-only"');
  });

  it("audits all 812 canonical knowledge nodes and records an explicit zero-migration decision", () => {
    const ontology = JSON.parse(readFileSync("generated/knowledge-ontology-audit-report.json", "utf8"));
    const semantics = JSON.parse(readFileSync("generated/knowledge-node-semantics-v4.json", "utf8"));
    const migration = JSON.parse(readFileSync("generated/knowledge-node-migration-v4.json", "utf8"));
    expect(ontology.tree.nodeCount).toBe(812);
    expect(ontology.failureCount).toBe(0);
    expect(ontology.unresolvedSemanticCandidateCount).toBe(0);
    expect(ontology.checks).toMatchObject({
      uniqueIds: true, parentIntegrity: true, acyclic: true, levelAndPathConsistency: true,
      leafConsistency: true, normalizedSiblingUniqueness: true, stageValidity: true, semanticDomainReview: true,
    });
    expect(semantics.nodes).toHaveLength(812);
    expect(semantics.nodes.filter((node: { comparisonEligible: boolean }) => node.comparisonEligible)).toHaveLength(576);
    expect(migration).toMatchObject({ migrationRequired: false, migrations: [], pendingCandidates: [] });
  });

  it("keeps all 21 point-reviewed mappings complete and candidate-only until owner approval", () => {
    const report = JSON.parse(readFileSync("generated/knowledge-point-review-report.json", "utf8"));
    expect(report).toMatchObject({
      expectedCourseCount: 21,
      reviewedCourseCount: 21,
      approvalEligibleCourseCount: 21,
      failureCount: 0,
    });
    for (const summary of report.summaries) {
      expect(summary.reviewedPoints, `${summary.id} reviewed points`).toBe(summary.candidatePoints);
      expect(summary.sourcePageReferenceRate, `${summary.id} source page references`).toBe(1);
      expect(summary.failCount, `${summary.id} failed reviews`).toBe(0);
      expect(summary.missingOfficialPointCount, `${summary.id} missing official points`).toBe(0);
      expect(summary.highIssueCount, `${summary.id} high-severity review issues`).toBe(0);
      expect(summary.duplicatePointCount, `${summary.id} duplicate reviews`).toBe(0);
      const mapping = JSON.parse(readFileSync(`data/candidates/knowledge-v4/${summary.id}.json`, "utf8"));
      expect(KnowledgeMappingV4Schema.safeParse(mapping).success, `${summary.id} V4 schema`).toBe(true);
      expect(mapping.reviewStatus, `${summary.id} activation status`).toBe("candidate");
    }
  });

  it("requires explicit approval provenance before a V4 mapping can become owner-approved", () => {
    const mapping = JSON.parse(readFileSync("data/candidates/knowledge-v4/CAIE-0580.json", "utf8"));
    mapping.reviewStatus = "owner-approved";
    expect(KnowledgeMappingV4Schema.safeParse(mapping).success).toBe(false);
    mapping.review.approvedAt = "2026-07-16";
    mapping.review.approvalBatch = "owner-review-20260716";
    expect(KnowledgeMappingV4Schema.safeParse(mapping).success).toBe(true);
  });

  it("rejects contradictory V4 point state, dates and Kimi provenance", () => {
    const original = JSON.parse(readFileSync("data/candidates/knowledge-v4/CAIE-0580.json", "utf8"));

    const missingReason = structuredClone(original);
    missingReason.syllabusPoints[0].canonicalNodeIds = [];
    delete missingReason.syllabusPoints[0].unmappedReason;
    expect(KnowledgeMappingV4Schema.safeParse(missingReason).success).toBe(false);

    const mappedAndUnmapped = structuredClone(original);
    mappedAndUnmapped.syllabusPoints[0].unmappedReason = "contradictory";
    expect(KnowledgeMappingV4Schema.safeParse(mappedAndUnmapped).success).toBe(false);

    const reversedDates = structuredClone(original);
    reversedDates.effectiveTo = "2024-12-31";
    expect(KnowledgeMappingV4Schema.safeParse(reversedDates).success).toBe(false);

    const wrongModel = structuredClone(original);
    wrongModel.review.responseModelId = "unexpected-model";
    expect(KnowledgeMappingV4Schema.safeParse(wrongModel).success).toBe(false);
  });

  it("permanently archives non-monotonic CAIE legacy rows outside the active data set", () => {
    expect(ARCHIVED_CAIE_LEGACY_DATA.length).toBeGreaterThan(0);
    for (const archived of ARCHIVED_CAIE_LEGACY_DATA) {
      expect(MERGED_CAIE_GCSE_DATA).not.toContain(archived);
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

  it("supports OCR 6993 through its official single-paper A-E award route", () => {
    const route = awardCatalog.getAwardRoute("award:ocr:6993:linear")!;
    const boundary = awardCatalog.findOfficialBoundary({
      routeId: route.id,
      series: "2025-june",
      componentVariants: ["6993/01"],
    })!;
    expect(route).toMatchObject({ qualificationCode: "6993", maximumMarkAfterWeighting: 100, grades: ["A", "B", "C", "D", "E"] });
    expect(boundary.thresholds).toEqual({ A: 67, B: 60, C: 53, D: 47, E: 41 });
    expect(boundary.thresholds).not.toHaveProperty("A*");
    const course = COURSE_CATALOG.find((entry) => entry.boardName === "OCR" && entry.subjectCode === "6993")!;
    expect(course.gradeCalculation).toEqual({ status: "official", routeIds: ["award:ocr:6993:linear"] });
    expect(course.capabilities.calculator.status).toBe("available");
  });
});
