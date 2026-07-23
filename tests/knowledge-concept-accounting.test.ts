import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  auditMappingConceptAccounting,
  buildConceptCueIndex,
} from "../scripts/lib/knowledge-concept-accounting.mjs";

const ontology = {
  nodes: [
    {
      nodeId: "VECT-GEOM-PROB-APPL",
      definition: "Solve multi-step vector geometry problems.",
      aliases: ["vector applications"],
      objectScopes: ["geometric configurations"],
      inclusions: ["vector equations"],
      exclusions: [],
      semanticClass: "mathematical-knowledge",
      comparisonEligible: true,
    },
    {
      nodeId: "VECT-GEOM-PROB-COLL",
      definition: "Prove that points lie on one straight line.",
      aliases: ["vector collinearity"],
      objectScopes: ["2D points"],
      inclusions: ["collinearity test"],
      exclusions: ["parallelism alone"],
      semanticClass: "mathematical-knowledge",
      comparisonEligible: true,
    },
    {
      nodeId: "GEOM-SHAP-TERM-LINE",
      definition: "A straight one-dimensional figure.",
      aliases: ["straight line"],
      objectScopes: ["lines"],
      inclusions: ["line terminology"],
      exclusions: ["motion"],
      semanticClass: "mathematical-knowledge",
      comparisonEligible: true,
    },
  ],
};

function mapping(examplesText: string[]) {
  return {
    qualificationVersionId: "CAIE-0580:2025-2027",
    board: "CAIE",
    subjectCode: "0580",
    statements: [{
      statementId: "CAIE-0580-E7.4-4",
      sectionId: "E7.4",
      topicHeading: "Vector geometry",
      statementType: "assessable-content",
      statementText: "Use vectors to reason and to solve geometric problems.",
      notesText: [],
      examplesText,
      conceptLinks: [{ nodeId: "VECT-GEOM-PROB-APPL" }],
    }],
  };
}

describe("Knowledge V5 concept-accounting candidate audit", () => {
  it("finds a missing collinearity leaf from an official example and keeps it in the vector branch", () => {
    const issues = auditMappingConceptAccounting(
      mapping(["show that 3 points are collinear"]),
      ontology,
      buildConceptCueIndex(ontology),
    );
    expect(issues).toContainEqual(expect.objectContaining({
      statementId: "CAIE-0580-E7.4-4",
      evidenceField: "examplesText",
      evidenceText: "show that 3 points are collinear",
      suggestedNodeId: "VECT-GEOM-PROB-COLL",
      sameKnowledgeBranch: true,
      reviewStatus: "candidate",
    }));
  });

  it("marks an incidental cross-branch phrase as unsafe for automatic correction", () => {
    const issues = auditMappingConceptAccounting(
      mapping(["motion in a straight line"]),
      ontology,
      buildConceptCueIndex(ontology),
    );
    expect(issues).toContainEqual(expect.objectContaining({
      suggestedNodeId: "GEOM-SHAP-TERM-LINE",
      sameKnowledgeBranch: false,
    }));
  });

  it("routes high-confidence cross-branch cues through the independent final review", () => {
    const finalReviewer = readFileSync(
      "scripts/finalize-knowledge-v5-concept-accounting-review.mjs",
      "utf8",
    );
    expect(finalReviewer).toContain("crossBranchCandidatesByStatement");
    expect(finalReviewer).toContain('issue.matchKind !== "normalized-phrase"');
    expect(finalReviewer).toContain("issue.score < 7");
    expect(finalReviewer).toContain("Check crossBranchCandidates independently");
  });

  it("keeps every AQA official statement out of external-model review", () => {
    const reviewer = readFileSync("scripts/review-knowledge-v5-concept-accounting.mjs", "utf8");
    const finalReviewer = readFileSync("scripts/finalize-knowledge-v5-concept-accounting-review.mjs", "utf8");
    const localReport = JSON.parse(
      readFileSync(
        "data/candidates/knowledge-v5-concept-accounting-20260723/aqa-local-review.json",
        "utf8",
      ),
    ) as {
      provider: string;
      requestedModel: string;
      returnedModel: string;
      externalSourceTransmissionCount: number;
      reviewedAssessableStatementCount: number;
    };

    expect(reviewer).toContain('if (mapping.board === "AQA")');
    expect(finalReviewer).toContain('if (indexed.mapping.board === "AQA") return null');
    expect(localReport).toMatchObject({
      provider: "local",
      requestedModel: "local",
      returnedModel: "local",
      externalSourceTransmissionCount: 0,
      reviewedAssessableStatementCount: 591,
    });
  });

  it("makes the reported 0580 vector examples mandatory in the candidate batch", () => {
    const builder = readFileSync("scripts/build-knowledge-v5-concept-correction-batch.mjs", "utf8");
    expect(builder).toContain('"VECT-GEOM-PROB-PARA"');
    expect(builder).toContain('"VECT-GEOM-PROB-COLL"');
    expect(builder).toContain('"VECT-GEOM-PROB-RATI"');
    expect(builder).toContain('"CAIE-0580-E7.4-4"');
    expect(builder).toContain("is still missing");
  });

  it("keeps ordinary Euler and improved Euler as distinct ontology leaves", () => {
    const localReport = JSON.parse(
      readFileSync(
        "data/candidates/knowledge-v5-concept-accounting-20260723/aqa-local-review.json",
        "utf8",
      ),
    ) as {
      ontologyAdditions: Array<{ nodeId: string; exclusions: string[] }>;
      additions: Array<{ statementId: string; nodeId: string }>;
      removals: Array<{ statementId: string; nodeId: string }>;
    };

    expect(localReport.ontologyAdditions).toContainEqual(expect.objectContaining({
      nodeId: "NUMM-ODE-EULR-EXPL",
      exclusions: expect.arrayContaining(["improved Euler method"]),
    }));
    expect(localReport.additions).toContainEqual(expect.objectContaining({
      statementId: "AQA-7367-J2",
      nodeId: "NUMM-ODE-EULR-EXPL",
    }));
    expect(localReport.removals).toContainEqual(expect.objectContaining({
      statementId: "AQA-7367-J2",
      nodeId: "NUMM-ODE-EULR-IMPR",
    }));
  });

  it("activates each approved ontology leaf beneath its existing parent", () => {
    const localReport = JSON.parse(
      readFileSync(
        "data/candidates/knowledge-v5-concept-accounting-20260723/aqa-local-review.json",
        "utf8",
      ),
    ) as {
      ontologyAdditions: Array<{ nodeId: string; parentNodeId: string }>;
    };
    const activeOntology = JSON.parse(
      readFileSync("data/active/knowledge-v5/ontology.json", "utf8"),
    ) as { nodes: Array<{ nodeId: string; reviewStatus: string }> };
    const activeTree = JSON.parse(
      readFileSync("data/active/knowledge-v5/knowledge-tree.json", "utf8"),
    ) as { nodes: Array<{ nodeId: string }> };
    const activeNodeIds = new Set(activeOntology.nodes.map((node) => node.nodeId));
    const activeTreeIds = new Set(activeTree.nodes.map((node) => node.nodeId));

    expect(localReport.ontologyAdditions.length).toBeGreaterThan(0);
    for (const addition of localReport.ontologyAdditions) {
      expect(activeNodeIds.has(addition.nodeId)).toBe(true);
      expect(activeTreeIds.has(addition.parentNodeId)).toBe(true);
      expect(activeOntology.nodes.find((node) => node.nodeId === addition.nodeId)?.reviewStatus)
        .toBe("owner-approved");
    }
  });

  it("preserves the verified 2D line-symmetry equivalence between 0580 and 4MA1", () => {
    const caie = JSON.parse(
      readFileSync("data/active/knowledge-v5/mappings/CAIE-0580.json", "utf8"),
    ) as {
      statements: Array<{ statementId: string; conceptLinks: Array<{ nodeId: string }> }>;
    };
    const pearson = JSON.parse(
      readFileSync("data/active/knowledge-v5/mappings/Edexcel-4MA1.json", "utf8"),
    ) as {
      statements: Array<{ statementId: string; conceptLinks: Array<{ nodeId: string }> }>;
    };
    const caieStatement = caie.statements.find((item) => item.statementId === "CAIE-0580-E4.5.1");
    const pearsonStatement = pearson.statements.find((item) => item.statementId === "Edexcel-4MA1-4.3A");

    expect(caieStatement?.conceptLinks.map((link) => link.nodeId)).toContain("GEOM-SHAP-SYMM-LINE");
    expect(pearsonStatement?.conceptLinks.map((link) => link.nodeId)).toContain("GEOM-SHAP-SYMM-LINE");
  });

  it("closes every machine-review and residual high-confidence candidate before approval", () => {
    const candidateRoot = "data/candidates/knowledge-v5-concept-accounting-20260723";
    const audit = JSON.parse(
      readFileSync(`${candidateRoot}/candidate-audit-report.json`, "utf8"),
    ) as {
      status: string;
      finalMachineUnresolvedEntryCount: number;
      localDispositionStatementCount: number;
      unresolvedAfterLocalDisposition: number;
      residualCandidateCount: number;
      residualAcceptedCount: number;
      residualRejectedCount: number;
      residualUnresolvedCount: number;
      finalNonAqaReviewedRejectionCount: number;
      finalAqaLocallyCoveredResidualCount: number;
      unmappedAssessableStatementCount: number;
      failures: string[];
    };

    expect(audit).toMatchObject({
      status: "passed",
      finalMachineUnresolvedEntryCount: 56,
      localDispositionStatementCount: 52,
      unresolvedAfterLocalDisposition: 0,
      residualCandidateCount: 465,
      residualAcceptedCount: 47,
      residualRejectedCount: 418,
      residualUnresolvedCount: 0,
      finalNonAqaReviewedRejectionCount: 418,
      finalAqaLocallyCoveredResidualCount: 58,
      unmappedAssessableStatementCount: 0,
      failures: [],
    });
  });

  it("places all reported 0580 vector concepts in the approved active mapping", () => {
    const active = JSON.parse(
      readFileSync(
        "data/active/knowledge-v5/mappings/CAIE-0580.json",
        "utf8",
      ),
    ) as {
      statements: Array<{ statementId: string; conceptLinks: Array<{ nodeId: string }> }>;
    };
    const statement = active.statements.find((item) => item.statementId === "CAIE-0580-E7.4-4");
    expect(statement?.conceptLinks.map((link) => link.nodeId)).toEqual(expect.arrayContaining([
      "VECT-GEOM-PROB-APPL",
      "VECT-GEOM-PROB-PARA",
      "VECT-GEOM-PROB-COLL",
      "VECT-GEOM-PROB-RATI",
    ]));
  });

  it("activates approved semantic leaves while preserving the previous release pointer", () => {
    const activation = JSON.parse(
      readFileSync("data/active/knowledge-v5/activation.json", "utf8"),
    ) as { approvalBatch: string; previousApprovalBatch: string };
    const activeOntology = JSON.parse(
      readFileSync("data/active/knowledge-v5/ontology.json", "utf8"),
    ) as { nodes: Array<{ nodeId: string; reviewStatus: string }> };
    const activeIds = new Set(activeOntology.nodes.map((node) => node.nodeId));

    for (const nodeId of [
      "STAT-SUMM-CENT-VARI",
      "NUM-SYS-TYPE-PARI",
      "PROB-DRVD-DRVB-CDF",
      "ALGF-SEQ-SEQU-SEC2",
      "ALGF-LOG-LOGR-INEQ",
      "GEOM-SHAP-TERM-VERT",
    ]) {
      expect(activeIds.has(nodeId)).toBe(true);
      expect(activeOntology.nodes.find((node) => node.nodeId === nodeId)?.reviewStatus)
        .toBe("owner-approved");
    }
    expect(activation).toMatchObject({
      approvalBatch: "knowledge-v5-concept-accounting-20260723",
      previousApprovalBatch: "knowledge-v5-20260719",
    });
  });
});
