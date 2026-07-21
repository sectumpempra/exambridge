import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { getPaperById } from "@/data/papers/paperMetadata";
import { getBoundariesForPaper } from "@/data/papers/paperBoundaries";
import { ARCHIVED_CAIE_LEGACY_DATA, MERGED_CAIE_GCSE_DATA } from "@/data/official/mergedMathData";
import { getDisplayCourseCatalog } from "@/course-context/catalog";
import { getPastPaperCatalogMaturity } from "@/domain-v2/past-papers/catalog";
import type { PastPaperCatalog } from "@/domain-v2/past-papers/schema";
import { awardCatalog } from "@/domain-v2/awards/catalog";
import { COURSE_CATALOG } from "@/course-context/catalog-source";

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

  it("requires the production deployment to pass the release gate before publishing", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
    expect(workflow).toContain("needs: verify");
    expect(workflow).toContain("pnpm exec tsc --noEmit --incremental false");
    expect(workflow).toContain("pnpm test:coverage");
    expect(workflow).toContain("pnpm test:e2e");
    expect(workflow.indexOf("needs: verify")).toBeLessThan(workflow.indexOf("peaceiris/actions-gh-pages"));
    const packageJson = readFileSync("package.json", "utf8");
    expect(packageJson).toContain("audit-active-knowledge-v5.mjs");
    expect(packageJson).toContain("audit-knowledge-v5-only-release.mjs");
    expect(packageJson).not.toContain("prune-static-knowledge-candidates.mjs");
    expect(packageJson).not.toContain("audit-knowledge-v4.mjs &&");
    expect(readFileSync("scripts/build-release-provenance.mjs", "utf8")).toContain("trackedPdfs");
  });

  it("publishes Knowledge V5 only and retains legacy data outside the public tree", () => {
    expect(existsSync("public/data/v3.2")).toBe(false);
    expect(existsSync("public/data/v3.2-new")).toBe(false);
    expect(existsSync("data/archive/knowledge-v3.2/public-data/manifest.json")).toBe(true);
    expect(existsSync("data/archive/knowledge-v4/public-projection/manifest.json")).toBe(true);
    const page = readFileSync("src/pages/knowledge-tree/KnowledgeTreeComparePage.tsx", "utf8");
    expect(page).not.toContain("loader-v3.2");
    expect(page).not.toContain("listSubjectsV32");
    const loader = readFileSync("src/data/knowledge-tree/loader-v5.ts", "utf8");
    expect(loader).not.toContain("return null");
    const releaseAudit = readFileSync("scripts/audit-knowledge-v5-only-release.mjs", "utf8");
    expect(releaseAudit).toContain('"academic-results-v2"');
    expect(releaseAudit).toContain('allowedDataDirectories = new Set(["knowledge-v5", "past-papers"])');
    expect(releaseAudit).toContain("legacy knowledge runtime reference remains");
  });

  it("requires an active V5 projection and uses whole-release rollback", () => {
    const builder = readFileSync("scripts/build-knowledge-v5-static.mjs", "utf8");
    const audit = readFileSync("scripts/audit-active-knowledge-v5.mjs", "utf8");
    const activation = JSON.parse(readFileSync("data/active/knowledge-v5/activation.json", "utf8"));
    expect(builder).toContain("Active Knowledge V5 requires 22 mappings");
    expect(audit).toContain('rollbackStrategy !== "previous-verified-release"');
    expect(activation.rollbackStrategy).toBe("previous-verified-release");
    expect(activation).not.toHaveProperty("rollbackTarget");
  });

  it("publishes the V5 ontology and matching structural tree as one runtime snapshot", () => {
    const builder = readFileSync("scripts/build-knowledge-v5-static.mjs", "utf8");
    const loader = readFileSync("src/data/knowledge-tree/loader-v5.ts", "utf8");
    const treeBytes = readFileSync("data/active/knowledge-v5/knowledge-tree.json");
    const tree = JSON.parse(treeBytes.toString("utf8"));
    const ontology = JSON.parse(readFileSync("data/active/knowledge-v5/ontology.json", "utf8"));
    expect(tree.version).toBe(ontology.treeVersion);
    expect(tree.nodes).toHaveLength(ontology.nodes.length);
    expect(createHash("sha256").update(treeBytes).digest("hex")).toBe(ontology.treeSha256);
    expect(builder).toContain('treeUrl: "/data/knowledge-v5/knowledge-tree.json"');
    expect(builder).toContain("ontologyNodeCount: ontology.nodes.length");
    expect(builder).toContain("createHash(\"sha256\").update(treeBytes)");
    expect(loader).toContain("loadKnowledgeV5Tree");
    expect(loader).toContain("value.nodes.length !== manifest.ontologyNodeCount");
  });

  it("keeps approved mathematical-practice leaves active but outside overlap calculations", () => {
    const audit = readFileSync("scripts/audit-active-knowledge-v5.mjs", "utf8");
    const comparison = readFileSync("src/domain-v2/knowledge-tree/comparison-v5.ts", "utf8");
    expect(audit).toContain("leafNodeIds.has(link.nodeId)");
    expect(audit).not.toContain("else if (!semantic.comparisonEligible)");
    expect(comparison).toContain("semantic.comparisonEligible");
    expect(comparison).toContain('status: "non-comparable"');
  });

  it("keeps candidate research pipelines out of the GitHub-safe release branch", () => {
    const packageJson = readFileSync("package.json", "utf8");
    const schema = readFileSync("src/domain-v2/knowledge-tree/v5-schema.ts", "utf8");
    const activeAudit = readFileSync("scripts/audit-active-knowledge-v5.mjs", "utf8");
    expect(existsSync("data/candidates/knowledge-v5")).toBe(false);
    expect(packageJson).not.toContain("knowledge:v5:extraction-audit");
    expect(packageJson).not.toContain("knowledge:v5:formula-packets");
    expect(packageJson).not.toContain("knowledge:v5:ontology-gap-cross-audit");
    expect(schema).toContain('provider: z.enum(["kimi-code", "deepseek", "local"])');
    expect(schema).toContain('call.requestedModel !== "deepseek-v4-pro"');
    expect(activeAudit).toContain('mapping.board === "AQA"');
    expect(activeAudit).toContain("unresolved assessable statement is active");
  });

  it("publishes 22 owner-approved V5 mappings from the recorded approval batch", () => {
    const manifest = JSON.parse(readFileSync("public/data/knowledge-v5/manifest.json", "utf8"));
    const activation = JSON.parse(readFileSync("data/active/knowledge-v5/activation.json", "utf8"));
    const mappingFiles = readdirSync("data/active/knowledge-v5/mappings").filter((file) => file.endsWith(".json"));
    expect(manifest.schemaVersion).toBe("5.0.0");
    expect(manifest.activeBatch).toBe("knowledge-v5-20260719");
    expect(manifest.mappings).toHaveLength(22);
    expect(mappingFiles).toHaveLength(22);
    expect(activation).toMatchObject({ approvalBatch: manifest.activeBatch, mappingCount: 22, ontologyNodeCount: 1105 });
    for (const file of mappingFiles) {
      const mapping = JSON.parse(readFileSync(`data/active/knowledge-v5/mappings/${file}`, "utf8"));
      expect(mapping.reviewStatus, file).toBe("owner-approved");
      expect(mapping.review.approvalBatch, file).toBe(manifest.activeBatch);
      expect(mapping.statements.every((statement: { reviewStatus: string }) => statement.reviewStatus === "owner-approved"), file).toBe(true);
    }
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

  it("supports Pearson 8MA0 through its official two-paper A-E award route", () => {
    const route = awardCatalog.getAwardRoute("award:pearson:8ma0:linear")!;
    const boundary = awardCatalog.findOfficialBoundary({
      routeId: route.id,
      series: "2025-june",
      componentVariants: ["8MA0/01", "8MA0/02"],
    })!;
    expect(route).toMatchObject({ board: "Edexcel UK", qualificationCode: "8MA0", maximumMarkAfterWeighting: 160, grades: ["A", "B", "C", "D", "E"] });
    expect(boundary.thresholds).toEqual({ A: 108, B: 95, C: 82, D: 69, E: 57 });
    expect(boundary.thresholds).not.toHaveProperty("A*");
    const course = COURSE_CATALOG.find((entry) => entry.boardName === "Edexcel UK" && entry.subjectCode === "8MA0")!;
    expect(course.gradeCalculation).toEqual({ status: "official", routeIds: ["award:pearson:8ma0:linear"] });
    expect(course.capabilities.calculator.status).toBe("available");
  });
});
