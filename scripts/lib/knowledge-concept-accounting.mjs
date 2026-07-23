const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into",
  "is", "it", "of", "on", "or", "that", "the", "their", "these", "this", "to",
  "use", "using", "with", "within", "without",
]);

const TOKEN_EQUIVALENTS = new Map([
  ["axes", "axis"],
  ["collinearity", "collinear"],
  ["collinearity", "collinear"],
  ["collinear", "collinear"],
  ["parallelism", "parallel"],
  ["similarity", "similar"],
  ["symmetrical", "symmetry"],
  ["symmetric", "symmetry"],
  ["vertices", "vertex"],
]);

function canonicalToken(token) {
  const explicit = TOKEN_EQUIVALENTS.get(token);
  if (explicit) return explicit;
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ves")) return `${token.slice(0, -3)}f`;
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function normalizedTokens(value) {
  return String(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalToken);
}

function significantTokens(value) {
  return normalizedTokens(value).filter((token) => !STOP_WORDS.has(token));
}

function cueKey(tokens) {
  return [...new Set(tokens)].sort().join(" ");
}

function evidenceFields(statement) {
  return [
    { field: "statementText", index: 0, text: statement.statementText },
    ...statement.notesText.map((text, index) => ({ field: "notesText", index, text })),
    ...statement.examplesText.map((text, index) => ({ field: "examplesText", index, text })),
  ].filter((item) => significantTokens(item.text).length > 0);
}

function cueCandidates(node) {
  return [
    ...node.aliases.map((text) => ({ cueSource: "alias", text, sourceWeight: 4 })),
    ...node.objectScopes.map((text) => ({ cueSource: "objectScope", text, sourceWeight: 3 })),
    ...node.inclusions.map((text) => ({ cueSource: "inclusion", text, sourceWeight: 3 })),
  ];
}

export function buildConceptCueIndex(ontology) {
  const raw = [];
  for (const node of ontology.nodes) {
    if (!node.comparisonEligible || node.semanticClass !== "mathematical-knowledge") continue;
    for (const cue of cueCandidates(node)) {
      const tokens = significantTokens(cue.text);
      if (tokens.length === 0) continue;
      raw.push({
        nodeId: node.nodeId,
        definition: node.definition,
        ...cue,
        tokens,
        key: cueKey(tokens),
      });
    }
  }

  const nodesByKey = new Map();
  const nodesByToken = new Map();
  for (const cue of raw) {
    const nodeIds = nodesByKey.get(cue.key) ?? new Set();
    nodeIds.add(cue.nodeId);
    nodesByKey.set(cue.key, nodeIds);
    for (const token of new Set(cue.tokens)) {
      const tokenNodeIds = nodesByToken.get(token) ?? new Set();
      tokenNodeIds.add(cue.nodeId);
      nodesByToken.set(token, tokenNodeIds);
    }
  }

  const cues = raw.filter((cue) => {
    if (cue.tokens.length >= 2) return true;
    const token = cue.tokens[0];
    return token.length >= 7 && !/^\d+$/.test(token) && nodesByKey.get(cue.key)?.size === 1;
  });
  for (const [token, nodeIds] of nodesByToken) {
    if (token.length < 7 || /^\d+$/.test(token) || nodeIds.size !== 1) continue;
    const nodeId = [...nodeIds][0];
    const node = ontology.nodes.find((candidate) => candidate.nodeId === nodeId);
    if (!node) continue;
    cues.push({
      nodeId,
      definition: node.definition,
      cueSource: "uniqueSemanticToken",
      text: token,
      sourceWeight: 4,
      tokens: [token],
      key: token,
    });
  }
  const cuesByToken = new Map();
  cues.forEach((cue, cueIndex) => {
    for (const token of new Set(cue.tokens)) {
      const indexes = cuesByToken.get(token) ?? [];
      indexes.push(cueIndex);
      cuesByToken.set(token, indexes);
    }
  });
  return { cues, cuesByToken };
}

function matchCue(evidenceText, cue) {
  const evidenceTokens = significantTokens(evidenceText);
  const evidenceSet = new Set(evidenceTokens);
  if (!cue.tokens.every((token) => evidenceSet.has(token))) return null;

  const normalizedEvidence = evidenceTokens.join(" ");
  const normalizedCue = cue.tokens.join(" ");
  const exactPhrase = normalizedEvidence.includes(normalizedCue);
  const distinctiveSingleToken = cue.tokens.length === 1;
  const score = cue.sourceWeight + (exactPhrase ? 2 : 0) + (distinctiveSingleToken ? 0 : 1);
  return {
    score,
    matchKind: exactPhrase ? "normalized-phrase" : distinctiveSingleToken ? "distinctive-token" : "token-set",
  };
}

function branchKey(nodeId) {
  return nodeId.split("-").slice(0, 2).join("-");
}

export function auditMappingConceptAccounting(mapping, ontology, cueIndex = buildConceptCueIndex(ontology)) {
  const issues = [];
  for (const statement of mapping.statements) {
    if (statement.statementType !== "assessable-content") continue;
    const linkedNodeIds = new Set(statement.conceptLinks.map((link) => link.nodeId));
    const bestByNodeAndEvidence = new Map();

    for (const evidence of evidenceFields(statement)) {
      const evidenceTokenSet = new Set(significantTokens(evidence.text));
      const candidateCueIndexes = new Set();
      for (const token of evidenceTokenSet) {
        for (const cueIndexValue of cueIndex.cuesByToken.get(token) ?? []) candidateCueIndexes.add(cueIndexValue);
      }
      for (const cueIndexValue of candidateCueIndexes) {
        const cue = cueIndex.cues[cueIndexValue];
        if (linkedNodeIds.has(cue.nodeId)) continue;
        const match = matchCue(evidence.text, cue);
        if (!match) continue;
        const key = `${cue.nodeId}|${evidence.field}|${evidence.index}`;
        const candidate = {
          qualificationVersionId: mapping.qualificationVersionId,
          board: mapping.board,
          subjectCode: mapping.subjectCode,
          statementId: statement.statementId,
          sectionId: statement.sectionId,
          topicHeading: statement.topicHeading,
          evidenceField: evidence.field,
          evidenceIndex: evidence.index,
          evidenceText: evidence.text,
          suggestedNodeId: cue.nodeId,
          suggestedNodeDefinition: cue.definition,
          cueText: cue.text,
          cueSource: cue.cueSource,
          matchKind: match.matchKind,
          score: match.score,
          existingNodeIds: [...linkedNodeIds],
          sameKnowledgeBranch: [...linkedNodeIds].some((nodeId) => branchKey(nodeId) === branchKey(cue.nodeId)),
          reviewStatus: "candidate",
        };
        const existing = bestByNodeAndEvidence.get(key);
        if (!existing || candidate.score > existing.score) bestByNodeAndEvidence.set(key, candidate);
      }
    }

    issues.push(...bestByNodeAndEvidence.values());
  }
  return issues.sort((left, right) => (
    right.score - left.score
    || left.statementId.localeCompare(right.statementId)
    || left.suggestedNodeId.localeCompare(right.suggestedNodeId)
  ));
}

export function summarizeConceptAccountingIssues(issues) {
  const byQualification = {};
  const byEvidenceField = {};
  const byMatchKind = {};
  for (const issue of issues) {
    byQualification[issue.qualificationVersionId] = (byQualification[issue.qualificationVersionId] ?? 0) + 1;
    byEvidenceField[issue.evidenceField] = (byEvidenceField[issue.evidenceField] ?? 0) + 1;
    byMatchKind[issue.matchKind] = (byMatchKind[issue.matchKind] ?? 0) + 1;
  }
  return {
    issueCount: issues.length,
    byQualification,
    byEvidenceField,
    byMatchKind,
  };
}
