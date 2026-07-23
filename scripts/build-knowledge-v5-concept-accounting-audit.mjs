import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  auditMappingConceptAccounting,
  buildConceptCueIndex,
  normalizedTokens,
  summarizeConceptAccountingIssues,
} from "./lib/knowledge-concept-accounting.mjs";

const root = process.cwd();
const activeRoot = path.join(root, "data/active/knowledge-v5");
const mappingRoot = process.env.KNOWLEDGE_V5_MAPPING_ROOT
  ? path.resolve(root, process.env.KNOWLEDGE_V5_MAPPING_ROOT)
  : path.join(activeRoot, "mappings");
const ontologyPath = process.env.KNOWLEDGE_V5_ONTOLOGY_PATH
  ? path.resolve(root, process.env.KNOWLEDGE_V5_ONTOLOGY_PATH)
  : path.join(activeRoot, "ontology.json");
const outputPath = process.env.KNOWLEDGE_V5_CONCEPT_AUDIT_OUTPUT
  ? path.resolve(root, process.env.KNOWLEDGE_V5_CONCEPT_AUDIT_OUTPUT)
  : path.join(root, "generated/knowledge-v5-concept-accounting-audit.json");

const ontology = JSON.parse(await readFile(ontologyPath, "utf8"));
const mappingFiles = (await readdir(mappingRoot))
  .filter((file) => file.endsWith(".json"))
  .sort();
const cueIndex = buildConceptCueIndex(ontology);
const issues = [];
const exclusionConflicts = [];
const branchKey = (nodeId) => nodeId.split("-").slice(0, 2).join("-");
let statementCount = 0;
let assessableStatementCount = 0;
let evidenceItemCount = 0;

for (const file of mappingFiles) {
  const mapping = JSON.parse(await readFile(path.join(mappingRoot, file), "utf8"));
  statementCount += mapping.statements.length;
  assessableStatementCount += mapping.statements.filter((statement) => statement.statementType === "assessable-content").length;
  evidenceItemCount += mapping.statements.reduce((total, statement) => (
    total + 1 + statement.notesText.length + statement.examplesText.length
  ), 0);
  issues.push(...auditMappingConceptAccounting(mapping, ontology, cueIndex));
  const semanticById = new Map(ontology.nodes.map((node) => [node.nodeId, node]));
  for (const statement of mapping.statements) {
    const evidence = [statement.statementText, ...statement.notesText, ...statement.examplesText];
    const normalizedEvidence = evidence.map((text) => normalizedTokens(text).join(" "));
    for (const link of statement.conceptLinks) {
      const node = semanticById.get(link.nodeId);
      if (!node) continue;
      for (const exclusion of node.exclusions) {
        const normalizedExclusion = normalizedTokens(exclusion).join(" ");
        if (normalizedExclusion.length < 5) continue;
        const evidenceIndex = normalizedEvidence.findIndex((text) => text.includes(normalizedExclusion));
        if (evidenceIndex < 0) continue;
        const findResolutionCandidates = (sameBranchOnly) => ontology.nodes.filter((candidate) => {
          if (
            candidate.nodeId === link.nodeId
            || !candidate.comparisonEligible
            || candidate.semanticClass !== "mathematical-knowledge"
            || (sameBranchOnly && branchKey(candidate.nodeId) !== branchKey(link.nodeId))
          ) return false;
          const positiveSemantics = [
            candidate.definition,
            ...candidate.aliases,
            ...candidate.objectScopes,
            ...candidate.inclusions,
          ].map((text) => normalizedTokens(text).join(" "));
          return positiveSemantics.some((text) => text.includes(normalizedExclusion));
        }).map((candidate) => ({
          nodeId: candidate.nodeId,
          definition: candidate.definition,
          sameKnowledgeBranch: branchKey(candidate.nodeId) === branchKey(link.nodeId),
        }));
        const sameBranchResolutionCandidates = findResolutionCandidates(true);
        const resolutionCandidates = sameBranchResolutionCandidates.length > 0
          ? sameBranchResolutionCandidates
          : findResolutionCandidates(false);
        exclusionConflicts.push({
          qualificationVersionId: mapping.qualificationVersionId,
          board: mapping.board,
          subjectCode: mapping.subjectCode,
          statementId: statement.statementId,
          sectionId: statement.sectionId,
          linkedNodeId: link.nodeId,
          linkedNodeDefinition: node.definition,
          exclusion,
          evidenceText: evidence[evidenceIndex],
          evidenceField: evidenceIndex === 0 ? "statementText" : evidenceIndex <= statement.notesText.length ? "notesText" : "examplesText",
          resolutionCandidates,
          reviewStatus: "candidate",
        });
      }
    }
  }
}

const report = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  sourceBatch: JSON.parse(await readFile(path.join(activeRoot, "activation.json"), "utf8")).approvalBatch,
  scope: {
    mappingCount: mappingFiles.length,
    ontologyNodeCount: ontology.nodes.length,
    cueCount: cueIndex.cues.length,
    statementCount,
    assessableStatementCount,
    evidenceItemCount,
  },
  methodology: {
    purpose: "Candidate generator for official statement, note and example evidence that may require additional concept links.",
    automaticMutation: false,
    matching: "Unique normalized aliases, object scopes and inclusion phrases from owner-approved comparison-eligible ontology nodes.",
    reviewRequirement: "Every candidate requires source-aware Codex review; owner approval is required before active mappings change.",
  },
  mappingRoot: path.relative(root, mappingRoot),
  ontologyPath: path.relative(root, ontologyPath),
  summary: summarizeConceptAccountingIssues(issues),
  exclusionConflictCount: exclusionConflicts.length,
  issues,
  exclusionConflicts,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Knowledge V5 concept-accounting candidate audit: ${issues.length} candidates across ${mappingFiles.length} mappings.`);
