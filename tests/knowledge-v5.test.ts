import { describe, expect, it } from "vitest";
import {
  CodexQualificationReviewV5Schema,
  CodexSourceAccountingV5Schema,
  KnowledgeMappingV5Schema,
  KnowledgePaperCatalogV5Schema,
  QualificationPaperApplicabilityV5Schema,
  KnowledgeSourceManifestEntryV5Schema,
  OfficialStatementV5Schema,
  ReviewCallV5Schema,
  TextFidelityReportV5Schema,
  KnowledgeGoldSetV5Schema,
  compareKnowledgeMappingsV5,
  type CanonicalNodeSemanticsV5,
  type KnowledgeMappingV5,
  type OfficialStatementV5,
} from "@/domain-v2/knowledge-tree";
import { clearKnowledgeV5Cache, loadKnowledgeV5Manifest } from "@/data/knowledge-tree/loader-v5";

const sourceHash = "a".repeat(64);

describe("KnowledgeMappingV5 required static manifest", () => {
  it("rejects an SPA HTML fallback instead of silently loading legacy knowledge data", async () => {
    clearKnowledgeV5Cache();
    const priorFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("<!doctype html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    try {
      await expect(loadKnowledgeV5Manifest()).rejects.toThrow("Unexpected content type");
    } finally {
      globalThis.fetch = priorFetch;
      clearKnowledgeV5Cache();
    }
  });

  it("rejects a missing V5 manifest instead of silently loading legacy knowledge data", async () => {
    clearKnowledgeV5Cache();
    const priorFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("not found", { status: 404 });
    try {
      await expect(loadKnowledgeV5Manifest()).rejects.toThrow("404 /data/knowledge-v5/manifest.json");
    } finally {
      globalThis.fetch = priorFetch;
      clearKnowledgeV5Cache();
    }
  });

  it("still rejects an unexpected non-JSON manifest response", async () => {
    clearKnowledgeV5Cache();
    const priorFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("plain text", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
    try {
      await expect(loadKnowledgeV5Manifest()).rejects.toThrow("Unexpected content type");
    } finally {
      globalThis.fetch = priorFetch;
      clearKnowledgeV5Cache();
    }
  });
});

function paperCatalogQualification(index: number) {
  const sourceReference = {
    sourceSha256: sourceHash,
    sourceUrl: "https://example.com/specification.pdf",
    locator: "Official PDF page 8, assessment overview",
    evidenceSummary: "Paper 1 is a required written assessment.",
  };
  return {
    qualificationVersionId: `BOARD-${index}:v1`,
    sourceSha256: sourceHash,
    contentAllocation: "qualification-wide-shared-syllabus" as const,
    contentAllocationReferences: [sourceReference],
    papers: [{
      paperId: "paper-1",
      code: `${index}/1`,
      name: "Paper 1",
      componentKind: "paper" as const,
      assessmentRole: "mandatory" as const,
      tiers: [],
      routes: ["linear"],
      sourceReferences: [sourceReference],
      reviewStatus: "codex-reviewed" as const,
    }],
    routes: [{
      routeId: "linear",
      name: "Linear route",
      tiers: [],
      paperIds: ["paper-1"],
      selectionRule: "Take Paper 1.",
      sourceReferences: [sourceReference],
      reviewStatus: "codex-reviewed" as const,
    }],
    reviewStatus: "codex-reviewed" as const,
  };
}

describe("KnowledgeMappingV5 Paper catalog schema", () => {
  it("accepts 22 fully evidenced qualification Paper catalogs", () => {
    const catalog = {
      schemaVersion: "5.0.0",
      generatedAt: "2026-07-19",
      reviewStatus: "codex-reviewed",
      qualifications: Array.from({ length: 22 }, (_, index) => paperCatalogQualification(index)),
    };
    expect(KnowledgePaperCatalogV5Schema.safeParse(catalog).success).toBe(true);
  });

  it("rejects routes that reference an unknown Paper", () => {
    const catalog = {
      schemaVersion: "5.0.0",
      generatedAt: "2026-07-19",
      reviewStatus: "codex-reviewed",
      qualifications: Array.from({ length: 22 }, (_, index) => paperCatalogQualification(index)),
    };
    catalog.qualifications[0].routes[0].paperIds = ["paper-2"];
    expect(KnowledgePaperCatalogV5Schema.safeParse(catalog).success).toBe(false);
  });

  it("rejects inconsistent bidirectional Paper route membership", () => {
    const catalog = {
      schemaVersion: "5.0.0",
      generatedAt: "2026-07-19",
      reviewStatus: "codex-reviewed" as const,
      qualifications: Array.from({ length: 22 }, (_, index) => paperCatalogQualification(index)),
    };
    catalog.qualifications[0].papers[0].routes = ["unknown-route"];
    expect(KnowledgePaperCatalogV5Schema.safeParse(catalog).success).toBe(false);
  });
});

function paperApplicabilityArtifact() {
  const sourceReference = {
    sourceSha256: sourceHash,
    sourceUrl: "https://example.com/specification.pdf",
    locator: "Official assessment table",
    evidenceSummary: "The subject content may be assessed on Paper 1.",
  };
  return {
    schemaVersion: "5.0.0" as const,
    generatedAt: "2026-07-19",
    qualificationVersionId: "BOARD-1:v1",
    sourceSha256: sourceHash,
    extractionSha256: "b".repeat(64),
    paperCatalogSha256: "c".repeat(64),
    declaredPapers: ["paper-1"],
    assignments: [{
      statementId: "S1",
      statementType: "assessable-content" as const,
      applicability: { kind: "eligible" as const, papers: ["paper-1"] },
      rationale: "The official assessment table permits this content on Paper 1.",
      sourceReferences: [sourceReference],
      reviewStatus: "codex-reviewed" as const,
    }, {
      statementId: "RULE-1",
      statementType: "exam-rule" as const,
      applicability: { kind: "not-specified" as const },
      rationale: "Exam rules do not participate in knowledge-to-Paper mapping.",
      sourceReferences: [],
      reviewStatus: "codex-reviewed" as const,
    }],
    reviewStatus: "codex-reviewed" as const,
    calls: [{
      label: "local-paper-applicability",
      provider: "local" as const,
      requestedModel: "local",
      returnedModel: "local",
      status: "local-only" as const,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    }],
  };
}

describe("KnowledgeMappingV5 Paper applicability schema", () => {
  it("accepts one-to-one reviewed statement accounting with official evidence", () => {
    expect(QualificationPaperApplicabilityV5Schema.safeParse(paperApplicabilityArtifact()).success).toBe(true);
  });

  it("rejects an assessable statement assigned to an undeclared Paper", () => {
    const invalid = paperApplicabilityArtifact();
    invalid.assignments[0].applicability.papers = ["paper-2"];
    expect(QualificationPaperApplicabilityV5Schema.safeParse(invalid).success).toBe(false);
  });

  it("rejects reviewed Paper coverage without official assessment evidence", () => {
    const invalid = paperApplicabilityArtifact();
    invalid.assignments[0].sourceReferences = [];
    expect(QualificationPaperApplicabilityV5Schema.safeParse(invalid).success).toBe(false);
  });

  it("rejects non-content records assigned to a Paper", () => {
    const invalid = paperApplicabilityArtifact();
    invalid.assignments[1].applicability = { kind: "eligible", papers: ["paper-1"] };
    expect(QualificationPaperApplicabilityV5Schema.safeParse(invalid).success).toBe(false);
  });
});

function statement(
  id: string,
  nodeId: string | null,
  overrides: Partial<OfficialStatementV5> = {},
): OfficialStatementV5 {
  return {
    statementId: id,
    sectionId: id,
    topicHeading: "Geometry",
    statementText: `Official statement ${id}`,
    notesText: [],
    examplesText: [],
    statementType: "assessable-content",
    printedPage: 10,
    pdfPage: 16,
    sourceLocator: `p.10 ${id}`,
    tiers: [],
    routes: [],
    paperApplicability: { kind: "eligible", papers: ["paper-1"] },
    conceptLinks: nodeId ? [{
      nodeId,
      relation: "exact",
      assessmentDepth: "knowledge",
      evidenceSpan: `Official statement ${id}`,
      reviewNotes: [],
    }] : [],
    reviewStatus: "owner-approved",
    ...overrides,
  };
}

function mapping(
  id: string,
  statements: OfficialStatementV5[],
  overrides: Partial<KnowledgeMappingV5> = {},
): KnowledgeMappingV5 {
  const referencedPapers = [...new Set(statements.flatMap((item) => item.paperApplicability.kind === "not-specified" ? [] : item.paperApplicability.papers))];
  return {
    schemaVersion: "5.0.0",
    qualificationVersionId: `${id}:test`,
    board: id.split("-")[0],
    subjectCode: id.split("-")[1],
    subjectName: id,
    level: "IGCSE",
    syllabusVersion: "test",
    effectiveFrom: "2025-01-01",
    sources: [{
      url: "https://example.com/specification.pdf",
      title: "Official specification",
      documentVersion: "test",
      locator: "subject content",
      accessedAt: "2026-07-17",
      sha256: sourceHash,
      pageCount: 20,
      sourceType: "official",
    }],
    declaredPapers: referencedPapers.length ? referencedPapers : ["paper-1"],
    statements,
    reviewStatus: "owner-approved",
    review: {
      generatedAt: "2026-07-17",
      promptVersion: "knowledge-v5-test",
      sourceSha256: sourceHash,
      extractionSha256: "b".repeat(64),
      treeSha256: "c".repeat(64),
      ontologySha256: "d".repeat(64),
      batchId: "test-batch",
      calls: [{
        label: "test",
        provider: "local",
        requestedModel: "local",
        returnedModel: "local",
        status: "local-only",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }],
      reviewedAt: "2026-07-17",
      approvedAt: "2026-07-17",
      approvalBatch: "test-approval",
    },
    ...overrides,
  };
}

function semantic(nodeId: string, overrides: Partial<CanonicalNodeSemanticsV5> = {}): CanonicalNodeSemanticsV5 {
  return {
    nodeId,
    definition: `Definition for ${nodeId}`,
    aliases: [],
    dimension: "not-applicable",
    objectScopes: [],
    inclusions: [],
    exclusions: [],
    semanticClass: "mathematical-knowledge",
    comparisonEligible: true,
    reviewStatus: "owner-approved",
    ...overrides,
  };
}

describe("KnowledgeMappingV5 schema", () => {
  it("accepts a complete versioned mapping", () => {
    expect(KnowledgeMappingV5Schema.safeParse(mapping("CAIE-0580", [statement("E4.5.1", "GEOM-SYMM-LINE")])).success).toBe(true);
  });

  it("rejects reviewed mappings with no declared Papers", () => {
    const invalid = mapping("CAIE-0580", [statement("E4.5.1", "GEOM-SYMM-LINE")]);
    invalid.declaredPapers = [];
    expect(KnowledgeMappingV5Schema.safeParse(invalid).success).toBe(false);
  });

  it("rejects Paper applicability that references an undeclared Paper", () => {
    const invalid = mapping("CAIE-0580", [statement("E4.5.1", "GEOM-SYMM-LINE", {
      paperApplicability: { kind: "eligible", papers: ["paper-2"] },
    })]);
    invalid.declaredPapers = ["paper-1"];
    expect(KnowledgeMappingV5Schema.safeParse(invalid).success).toBe(false);
  });

  it("rejects reviewed assessable content with unspecified Paper scope", () => {
    const invalid = mapping("CAIE-0580", [statement("E4.5.1", "GEOM-SYMM-LINE", {
      paperApplicability: { kind: "not-specified" },
    })]);
    expect(KnowledgeMappingV5Schema.safeParse(invalid).success).toBe(false);
  });

  it("rejects non-content statements that participate in comparison", () => {
    const invalid = statement("RULE", "CALCULATOR", { statementType: "exam-rule" });
    expect(OfficialStatementV5Schema.safeParse(invalid).success).toBe(false);
  });

  it("allows concept evidence from separately stored official notes", () => {
    const withNoteEvidence = statement("E4.5.2", "GEOM-SHAP-SYMM-PLANE", {
      statementText: "Recognise symmetry properties of prisms, cylinders, pyramids and cones.",
      notesText: ["e.g. identify planes and axes of symmetry."],
      conceptLinks: [{
        nodeId: "GEOM-SHAP-SYMM-PLANE",
        relation: "exact",
        assessmentDepth: "knowledge",
        evidenceSpan: "planes and axes of symmetry",
        reviewNotes: ["The official note specifies the three-dimensional symmetry scope."],
      }],
    });
    expect(OfficialStatementV5Schema.safeParse(withNoteEvidence).success).toBe(true);
  });

  it("rejects AQA provenance that sends source content to Kimi", () => {
    const invalid = mapping("AQA-8300", [statement("N1", "NUMBER")]);
    invalid.review.calls = [{
      label: "invalid-aqa",
      provider: "kimi-code",
      requestedModel: "k3",
      returnedModel: "k3",
      status: "success",
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    }];
    expect(KnowledgeMappingV5Schema.safeParse(invalid).success).toBe(false);
  });

  it("accepts the explicit no-model result recorded when Kimi Code triggers fallback", () => {
    expect(ReviewCallV5Schema.safeParse({
      label: "fallback-event",
      provider: "kimi-code",
      requestedModel: "k3",
      returnedModel: "none",
      status: "fallback-triggered",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      fallbackReason: "kimi-code-http-403",
    }).success).toBe(true);
  });

  it("accepts a successful DeepSeek V4 Pro completion after Kimi quota fallback", () => {
    expect(ReviewCallV5Schema.safeParse({
      label: "fallback-completion",
      provider: "deepseek",
      requestedModel: "deepseek-v4-pro",
      returnedModel: "deepseek-v4-pro",
      status: "success",
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      fallbackReason: "kimi-code-http-403-quota",
    }).success).toBe(true);
  });

  it("rejects a completed Kimi call with a mismatched returned model", () => {
    expect(ReviewCallV5Schema.safeParse({
      label: "wrong-model",
      provider: "kimi-code",
      requestedModel: "k3",
      returnedModel: "none",
      status: "success",
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    }).success).toBe(false);
  });

  it("accepts an explicitly recorded provider HTTP error without treating it as a model response", () => {
    expect(ReviewCallV5Schema.safeParse({
      label: "provider-error",
      provider: "deepseek",
      requestedModel: "deepseek-v4-pro",
      returnedModel: "unknown",
      status: "http-error",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      fallbackReason: "kimi-code-http-403",
      httpStatus: 499,
      errorType: "request_cancelled",
      errorMessage: "request failed",
    }).success).toBe(true);
  });

  it("rejects HTTP error provenance without a status code", () => {
    expect(ReviewCallV5Schema.safeParse({
      label: "provider-error",
      provider: "deepseek",
      requestedModel: "deepseek-v4-pro",
      returnedModel: "unknown",
      status: "http-error",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      errorMessage: "request failed",
    }).success).toBe(false);
  });

  it("accepts a client timeout with request correlation and configured timeout", () => {
    expect(ReviewCallV5Schema.safeParse({
      label: "provider-timeout",
      attempt: 1,
      provider: "kimi-code",
      requestedModel: "k3",
      returnedModel: "unknown",
      status: "client-timeout",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      elapsedSeconds: 1200,
      clientRequestId: "d9428888-122b-11e1-b85c-61cd3cbb3210",
      timeoutMs: 1_200_000,
      errorType: "TimeoutError",
      errorMessage: "request timed out",
    }).success).toBe(true);
  });

  it("rejects client timeout provenance without the configured timeout", () => {
    expect(ReviewCallV5Schema.safeParse({
      label: "provider-timeout",
      provider: "kimi-code",
      requestedModel: "k3",
      returnedModel: "unknown",
      status: "client-timeout",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      errorType: "TimeoutError",
      errorMessage: "request timed out",
    }).success).toBe(false);
  });

  it("rejects a claimed Codex review without a review date", () => {
    const invalid = mapping("CAIE-0580", [statement("E4.5.1", "GEOM-SHAP-SYMM-LINE")], {
      reviewStatus: "codex-reviewed",
    });
    invalid.review.reviewedAt = undefined;
    expect(KnowledgeMappingV5Schema.safeParse(invalid).success).toBe(false);
  });

  it("rejects duplicate statement dispositions in a Codex review", () => {
    const disposition = {
      statementId: "E4.5.1",
      decision: "correct" as const,
      finalStatementText: "recognise axes of symmetry in two dimensions",
      finalNotesText: [],
      finalExamplesText: [],
      textFidelity: "verified-visual" as const,
      finalConceptLinks: [],
      reviewNotes: ["Checked against the official statement."],
    };
    expect(CodexQualificationReviewV5Schema.safeParse({
      schemaVersion: "5.0.0",
      qualificationVersionId: "CAIE-0580:2025-2027",
      sourceSha256: sourceHash,
      reviewedAt: "2026-07-18",
      reviewer: "codex",
      reviewStatus: "codex-reviewed",
      sourceAccounting: {
        method: "coordinate-lines",
        reviewStatus: "codex-reviewed",
        sourceLineCount: 0,
        accountedLineCount: 0,
        unaccountedLineCount: 0,
        dispositions: [],
      },
      machineIssueDispositions: [],
      dispositions: [disposition, disposition],
    }).success).toBe(false);
  });

  it("rejects a Codex-reviewed disposition with pending source-text fidelity", () => {
    expect(CodexQualificationReviewV5Schema.safeParse({
      schemaVersion: "5.0.0",
      qualificationVersionId: "CAIE-0580:2025-2027",
      sourceSha256: sourceHash,
      reviewedAt: "2026-07-18",
      reviewer: "codex",
      reviewStatus: "codex-reviewed",
      sourceAccounting: {
        method: "coordinate-lines",
        reviewStatus: "codex-reviewed",
        sourceLineCount: 0,
        accountedLineCount: 0,
        unaccountedLineCount: 0,
        dispositions: [],
      },
      machineIssueDispositions: [],
      dispositions: [{
        statementId: "E4.5.1",
        decision: "correct",
        finalStatementText: "recognise axes of symmetry in two dimensions",
        finalNotesText: [],
        finalExamplesText: [],
        textFidelity: "pending",
        finalConceptLinks: [],
        reviewNotes: ["Source review has not been completed."],
      }],
    }).success).toBe(false);
  });

  it("rejects a Codex-reviewed qualification with an unresolved machine issue", () => {
    expect(CodexQualificationReviewV5Schema.safeParse({
      schemaVersion: "5.0.0",
      qualificationVersionId: "CAIE-0580:2025-2027",
      sourceSha256: sourceHash,
      reviewedAt: "2026-07-18",
      reviewer: "codex",
      reviewStatus: "codex-reviewed",
      sourceAccounting: {
        method: "coordinate-lines",
        reviewStatus: "codex-reviewed",
        sourceLineCount: 0,
        accountedLineCount: 0,
        unaccountedLineCount: 0,
        dispositions: [],
      },
      machineIssueDispositions: [{
        issue: "Connector line p20-r3-b0-l0 is excluded from a following atomic statement",
        decision: "pending",
        reviewNotes: ["The source connector has not yet been restored."],
      }],
      dispositions: [{
        statementId: "E4.5.1",
        decision: "correct",
        finalStatementText: "Recognise line symmetry in two dimensions.",
        finalNotesText: [],
        finalExamplesText: [],
        textFidelity: "verified-visual",
        finalConceptLinks: [],
        reviewNotes: ["Checked against the official statement."],
      }],
    }).success).toBe(false);
  });

  it("rejects incomplete source-text fidelity accounting", () => {
    expect(TextFidelityReportV5Schema.safeParse({
      schemaVersion: "5.0.0",
      generatedAt: "2026-07-18T03:00:00+00:00",
      method: "local-pdf-font-and-text-layer-triage",
      policy: {
        manualVisualRequired: "Visual check required.",
        visualReviewRecommended: "Visual check recommended.",
        textLayerCheckEligible: "Text-layer check required.",
      },
      mappingCount: 1,
      statementCount: 2,
      riskCounts: { "manual-visual-required": 1 },
      failureCount: 0,
      failures: [],
      qualifications: [{
        qualificationVersionId: "CAIE-9231:2026-2027",
        localSourceKey: "CAIE-9231",
        sourceSha256: sourceHash,
        mappingSha256: "b".repeat(64),
        statementCount: 1,
        riskCounts: { "manual-visual-required": 1 },
        statements: [{
          statementId: "1.1",
          pdfPage: 18,
          sourceLocator: "Official PDF page 18",
          risk: "manual-visual-required",
          reasons: ["source-page-uses-legacy-equation-font"],
          relevantFonts: ["MMGreekItalic"],
        }],
      }],
    }).success).toBe(false);
  });

  it("rejects a gold set that repeats pair IDs or statement pairs", () => {
    const pair = {
      pairId: "duplicate",
      semanticCase: "synonymous-expression" as const,
      qualificationVersionIdA: "CAIE-0580:2025-2027",
      statementIdA: "E4.5.1",
      qualificationVersionIdB: "Edexcel-4MA1:Issue 2",
      statementIdB: "4.3A",
      expectedStatus: "shared" as const,
      rationale: "Both statements assess line symmetry in two-dimensional figures.",
      evidence: [
        { sourceLocator: "p.30 E4.5.1", sourceSha256: sourceHash },
        { sourceLocator: "p.27 4.3A", sourceSha256: "b".repeat(64) },
      ],
      reviewStatus: "codex-reviewed" as const,
    };
    expect(KnowledgeGoldSetV5Schema.safeParse({
      schemaVersion: "5.0.0",
      generatedAt: "2026-07-18",
      reviewStatus: "codex-reviewed",
      pairs: Array.from({ length: 200 }, () => pair),
    }).success).toBe(false);
  });

  it("rejects a reviewed content range outside the official PDF", () => {
    expect(KnowledgeSourceManifestEntryV5Schema.safeParse({
      qualificationVersionId: "CAIE-9709:2026-2027",
      board: "CAIE",
      subjectCode: "9709",
      subjectName: "A-Level Mathematics",
      level: "A-Level",
      syllabusVersion: "2026-2027",
      effectiveFrom: "2026-01-01",
      sourceUrl: "https://example.com/specification.pdf",
      sourceTitle: "Official specification",
      source: {
        url: "https://example.com/specification.pdf",
        title: "Official specification",
        documentVersion: "2026-2027",
        locator: "subject content",
        accessedAt: "2026-07-18",
        sha256: sourceHash,
        pageCount: 62,
        sourceType: "official",
      },
      contentPageRange: {
        firstPdfPage: 18,
        lastPdfPage: 63,
        basis: "official-section-boundaries",
        startEvidence: "3 Subject content",
        endEvidence: "4 Details of the assessment",
        reviewStatus: "codex-reviewed",
        reviewedAt: "2026-07-18",
      },
      localSourceKey: "CAIE-9709",
    }).success).toBe(false);
  });

  it("does not allow a Codex-reviewed source account to hide a missing statement", () => {
    expect(CodexSourceAccountingV5Schema.safeParse({
      method: "coordinate-lines",
      reviewStatus: "codex-reviewed",
      sourceLineCount: 1,
      accountedLineCount: 0,
      unaccountedLineCount: 1,
      dispositions: [{
        lineId: "p18-r1-b2-l3",
        pdfPage: 18,
        decision: "requires-statement",
        reviewNotes: ["This source line still needs an atomic statement."],
      }],
    }).success).toBe(false);
  });
});

describe("KnowledgeMappingV5 comparison", () => {
  it("treats the complete official 0580 E4.5.1 and 4MA1 4.3A symmetry cells as the same 2D concepts", () => {
    const caie = statement("E4.5.1", "GEOM-SHAP-SYMM-LINE", {
      statementText: "Recognise line symmetry and order of rotational symmetry in two dimensions.",
      conceptLinks: [
        { nodeId: "GEOM-SHAP-SYMM-LINE", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "line symmetry", reviewNotes: [] },
        { nodeId: "GEOM-SHAP-SYMM-ROTA", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "order of rotational symmetry", reviewNotes: [] },
      ],
    });
    const edexcel = statement("4.3A", "GEOM-SHAP-SYMM-LINE", {
      statementText: "identify any lines of symmetry and the order of rotational symmetry of a given two-dimensional figure",
      conceptLinks: [
        { nodeId: "GEOM-SHAP-SYMM-LINE", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "lines of symmetry", reviewNotes: [] },
        { nodeId: "GEOM-SHAP-SYMM-ROTA", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "order of rotational symmetry", reviewNotes: [] },
      ],
    });
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [caie]),
      mapping("Edexcel-4MA1", [edexcel]),
      [
        semantic("GEOM-SHAP-SYMM-LINE", { dimension: "2d", aliases: ["axis of symmetry", "line of symmetry"] }),
        semantic("GEOM-SHAP-SYMM-ROTA", { dimension: "2d", aliases: ["order of rotational symmetry"] }),
      ],
    );
    expect(result.exact.sharedNodeIds).toEqual(["GEOM-SHAP-SYMM-LINE", "GEOM-SHAP-SYMM-ROTA"]);
    expect(result.exact.jaccard).toBe(100);
    expect(result.aStatements[0].status).toBe("shared");
    expect(result.bStatements[0].status).toBe("shared");
  });

  it("keeps 0580 E4.5.2 three-dimensional planes and axes separate from 4MA1 two-dimensional symmetry", () => {
    const threeDimensional = statement("E4.5.2", "GEOM-SHAP-SYMM-PLANE", {
      statementText: "Recognise symmetry properties of prisms, cylinders, pyramids and cones.",
      notesText: ["e.g. identify planes and axes of symmetry."],
      conceptLinks: [
        { nodeId: "GEOM-SHAP-SYMM-PLANE", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "planes", reviewNotes: [] },
        { nodeId: "GEOM-SHAP-SYMM-AXIS", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "axes of symmetry", reviewNotes: [] },
      ],
    });
    const twoDimensional = statement("4.3A", "GEOM-SHAP-SYMM-LINE", {
      statementText: "identify any lines of symmetry and the order of rotational symmetry of a given two-dimensional figure",
      conceptLinks: [
        { nodeId: "GEOM-SHAP-SYMM-LINE", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "lines of symmetry", reviewNotes: [] },
        { nodeId: "GEOM-SHAP-SYMM-ROTA", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "order of rotational symmetry", reviewNotes: [] },
      ],
    });
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [threeDimensional]),
      mapping("Edexcel-4MA1", [twoDimensional]),
      [
        semantic("GEOM-SHAP-SYMM-PLANE", { dimension: "3d" }),
        semantic("GEOM-SHAP-SYMM-AXIS", { dimension: "3d" }),
        semantic("GEOM-SHAP-SYMM-LINE", { dimension: "2d" }),
        semantic("GEOM-SHAP-SYMM-ROTA", { dimension: "2d" }),
      ],
    );
    expect(result.exact.sharedNodeIds).toEqual([]);
    expect(result.exact.unionCount).toBe(4);
    expect(result.aStatements[0].status).toBe("exclusive");
    expect(result.bStatements[0].status).toBe("exclusive");
  });

  it("uses approved leaf concepts without adding taxonomy ancestors", () => {
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [statement("A", "LINE"), statement("B", "AXIS-3D")]),
      mapping("Edexcel-4MA1", [statement("C", "LINE")]),
      [semantic("LINE"), semantic("AXIS-3D"), semantic("SYMMETRY", { comparisonEligible: false })],
    );
    expect(result.exact.sharedNodeIds).toEqual(["LINE"]);
    expect(result.exact.unionCount).toBe(2);
    expect(result.exact.jaccard).toBe(50);
    expect(result.exact.coverageA).toBe(50);
    expect(result.exact.coverageB).toBe(100);
  });

  it("never classifies an empty mapping as exclusive", () => {
    const unresolved = statement("EMPTY", null, { reviewStatus: "candidate" });
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [unresolved]),
      mapping("Edexcel-4MA1", [statement("LINE", "LINE")]),
      [semantic("LINE")],
    );
    expect(result.aStatements[0].status).toBe("unresolved");
    expect(result.counts.exclusive).toBe(0);
  });

  it("keeps broader, narrower and partial links out of exact percentages", () => {
    const partial = statement("PARTIAL", "LINE", {
      conceptLinks: [{
        nodeId: "LINE",
        relation: "partial",
        assessmentDepth: "application",
        evidenceSpan: "identify a line of symmetry",
        reviewNotes: [],
      }],
    });
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [partial]),
      mapping("Edexcel-4MA1", [statement("EXACT", "LINE")]),
      [semantic("LINE")],
    );
    expect(result.exact.unionCount).toBe(1);
    expect(result.exact.sharedNodeIds).toEqual([]);
    expect(result.exact.bOnlyNodeIds).toEqual(["LINE"]);
    expect(result.aStatements[0].status).toBe("partial");
  });

  it("keeps tier coverage directional when one qualification covers both lower and higher tiers", () => {
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [statement("EXTENDED", "LINE", {
        tiers: ["Extended"],
        paperApplicability: { kind: "fixed", papers: ["Paper 4"] },
      })]),
      mapping("Edexcel-4MA1", [statement("ALL", "LINE", {
        tiers: ["Foundation", "Higher"],
        paperApplicability: { kind: "eligible", papers: ["Paper 1", "Paper 2"] },
      })]),
      [semantic("LINE")],
    );
    expect(result.exact.sharedNodeIds).toEqual(["LINE"]);
    expect(result.exact.unionCount).toBe(1);
    expect(result.exact.aOnlyNodeIds).toEqual([]);
    expect(result.exact.bOnlyNodeIds).toEqual([]);
    expect(result.exact.jaccard).toBe(100);
    expect(result.aStatements[0].status).toBe("shared");
    expect(result.bStatements[0].status).toBe("partial");
  });

  it("treats equivalent board-specific tiers as shared and ignores qualification-local Paper IDs", () => {
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [statement("CORE", "LINE", {
        tiers: ["Core"],
        paperApplicability: { kind: "eligible", papers: ["CAIE-0580-Paper-1", "CAIE-0580-Paper-3"] },
      })]),
      mapping("Edexcel-4MA1", [statement("FOUNDATION", "LINE", {
        tiers: ["Foundation"],
        paperApplicability: { kind: "eligible", papers: ["4MA1-1F", "4MA1-2F"] },
      })]),
      [semantic("LINE")],
    );
    expect(result.aStatements[0].status).toBe("shared");
    expect(result.bStatements[0].status).toBe("shared");
  });

  it("classifies a concept subset against a broader counterpart statement as partial", () => {
    const narrower = statement("PRIMES", "NUM-SYS-TYPE-PRIM");
    const broader = statement("NUMBER-TYPES", "NUM-SYS-TYPE-PRIM", {
      conceptLinks: [
        { nodeId: "NUM-SYS-TYPE-PRIM", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "Official statement NUMBER-TYPES", reviewNotes: [] },
        { nodeId: "NUM-SYS-TYPE-RATL", relation: "exact", assessmentDepth: "knowledge", evidenceSpan: "Official statement NUMBER-TYPES", reviewNotes: [] },
      ],
    });
    const result = compareKnowledgeMappingsV5(
      mapping("AQA-8300", [narrower]),
      mapping("Edexcel-4MA1", [broader]),
      [semantic("NUM-SYS-TYPE-PRIM"), semantic("NUM-SYS-TYPE-RATL")],
    );
    expect(result.aStatements[0].status).toBe("partial");
    expect(result.bStatements[0].status).toBe("partial");
  });

  it("does not mark a node fully shared when one qualification has an unmatched exact scope", () => {
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [
        statement("CORE", "LINE", { tiers: ["Core"], paperApplicability: { kind: "eligible", papers: ["Paper 1", "Paper 3"] } }),
        statement("EXTENDED", "LINE", { tiers: ["Extended"], paperApplicability: { kind: "eligible", papers: ["Paper 2", "Paper 4"] } }),
      ]),
      mapping("Edexcel-4MA1", [
        statement("HIGHER", "LINE", { tiers: ["Higher"], paperApplicability: { kind: "eligible", papers: ["Paper 1H", "Paper 2H"] } }),
      ]),
      [semantic("LINE")],
    );
    expect(result.exact.sharedNodeIds).toEqual(["LINE"]);
    expect(result.exact.unionCount).toBe(1);
    expect(result.aStatements.find((item) => item.statement.statementId === "CORE")?.status).toBe("partial");
    expect(result.aStatements.find((item) => item.statement.statementId === "EXTENDED")?.status).toBe("shared");
  });

  it("marks placeholders and exam rules as non-comparable", () => {
    const placeholder = statement("PLACEHOLDER", null, {
      statementType: "placeholder",
      statementText: "Extended content only",
      reviewStatus: "owner-approved",
    });
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [placeholder]),
      mapping("Edexcel-4MA1", [statement("LINE", "LINE")]),
      [semantic("LINE")],
    );
    expect(result.aStatements[0].status).toBe("non-comparable");
  });

  it("marks approved practice-only assessable statements as non-comparable", () => {
    const proofPractice = statement("PROOF", "REAS-PROOF");
    const result = compareKnowledgeMappingsV5(
      mapping("CAIE-0580", [proofPractice]),
      mapping("Edexcel-4MA1", [statement("LINE", "LINE")]),
      [
        semantic("REAS-PROOF", {
          semanticClass: "mathematical-practice",
          comparisonEligible: false,
        }),
        semantic("LINE"),
      ],
    );
    expect(result.aStatements[0].status).toBe("non-comparable");
    expect(result.counts.unresolved).toBe(0);
  });
});
