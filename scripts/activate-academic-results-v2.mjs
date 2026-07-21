import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const batch = process.argv[2];
if (!/^academic-results-v2-launch-\d{8}$/.test(batch ?? "")) {
  throw new Error("Usage: node scripts/activate-academic-results-v2.mjs academic-results-v2-launch-YYYYMMDD");
}

const readJson = async path => JSON.parse(await readFile(join(root, path), "utf8"));
const [candidate, identityCatalog, factCatalog, gapReport, misconceptionLibrary, ruleMatrix] = await Promise.all([
  readJson("data/candidates/academic-results-v2/migration-candidate.json"),
  readJson("data/candidates/academic-results-v2/qualification-identities.json"),
  readJson("generated/academic-results-v2/qualification-fact-cards.json"),
  readJson("generated/academic-results-v2/real-gap-report.json"),
  readJson("generated/academic-results-v2/misconception-library.json"),
  readJson("generated/academic-results-v2/rule-coverage-matrix.json"),
]);

if (gapReport.counts.P0 !== 0) throw new Error(`P0 gaps must be zero before activation; found ${gapReport.counts.P0}`);
if (ruleMatrix.pendingCellCount !== 0 || ruleMatrix.blockingCellCount !== 0 || ruleMatrix.unexpectedRecordCount !== 0) {
  throw new Error("Award-rule coverage must have no pending, blocking or unexpected records before activation");
}
if (identityCatalog.identities.length !== 13 || factCatalog.cards.length !== 13) {
  throw new Error("The launch batch must contain exactly 13 qualification identities and fact cards");
}

const promote = record => ({ ...record, verificationStatus: "owner-approved" });
const awardRules = candidate.awardRules
  .filter(rule => rule.verificationStatus === "codex-reviewed" && rule.clauseEvidence.every(evidence => evidence.reviewStatus === "codex-reviewed"))
  .map(rule => ({
    ...promote(rule),
    clauseEvidence: rule.clauseEvidence.map(evidence => ({ ...evidence, reviewStatus: "owner-approved" })),
  }));
if (awardRules.length !== candidate.awardRules.length) {
  throw new Error(`Every candidate award rule must be Codex-reviewed before launch; ${awardRules.length}/${candidate.awardRules.length} eligible`);
}

const boundaries = candidate.boundaries
  .filter(record => record.verificationStatus === "codex-reviewed" && ["final", "provisional"].includes(record.publicationStatus))
  .map(promote);
const statistics = candidate.statistics
  .filter(record => record.verificationStatus === "codex-reviewed" && ["final", "provisional"].includes(record.publicationStatus))
  .map(promote);
const qualificationIdentities = identityCatalog.identities.map(identity => ({ ...identity, reviewStatus: "owner-approved" }));
const misconceptions = misconceptionLibrary.records
  .filter(record => record.reviewStatus === "codex-reviewed")
  .map(record => ({ ...record, reviewStatus: "owner-approved" }));
if (misconceptions.length !== misconceptionLibrary.records.length) {
  throw new Error("Every launch misconception must be Codex-reviewed before activation");
}

const boundaryKey = boundary => `${boundary.qualificationVersionId}|${boundary.routeId}`;
const approvedBoundaryKeys = new Set(boundaries
  .filter(boundary => boundary.boundaryScope === "overall")
  .map(boundaryKey));
const activeRuleIds = new Set(awardRules.map(rule => rule.ruleId));
const gapsByAward = Map.groupBy(gapReport.gaps, gap => gap.awardQualificationId);
const qualificationFactCards = factCatalog.cards.map(card => {
  const currentRules = awardRules.filter(rule => rule.awardQualificationId === card.awardQualificationId
    && rule.qualificationVersionId === card.currentQualificationVersionId);
  const currentCalculatorReady = currentRules.length > 0
    && currentRules.every(rule => approvedBoundaryKeys.has(`${rule.qualificationVersionId}|${rule.routeId}`));
  const reasons = currentCalculatorReady
    ? ["The current qualification rules and at least one exact official overall boundary for every current route are owner-approved."]
    : ["Rule explanation is owner-approved; formal grade calculation remains unavailable until every current route has an exact applicable owner-approved overall boundary."];
  return {
    ...card,
    routes: card.routes.map(route => {
      const ruleApproved = activeRuleIds.has(route.ruleId);
      const calculatorReady = ruleApproved && approvedBoundaryKeys.has(`${route.qualificationVersionId}|${route.routeId}`);
      return {
        ...route,
        clauseEvidence: route.clauseEvidence.map(evidence => ({ ...evidence, reviewStatus: "owner-approved" })),
        explainReady: ruleApproved,
        calculatorReady,
        reviewStatus: "owner-approved",
      };
    }),
    maturity: {
      level: currentCalculatorReady ? "calculator-ready" : "explain-ready",
      ownerApproved: true,
      calculatorAvailable: currentCalculatorReady,
      reasons,
    },
    unresolvedGapIds: (gapsByAward.get(card.awardQualificationId) ?? []).map(gap => gap.gapId),
    reviewStatus: "owner-approved",
  };
});

const referencedSourceIds = new Set();
for (const identity of qualificationIdentities) for (const sourceId of identity.sourceIds) referencedSourceIds.add(sourceId);
for (const collection of [boundaries, statistics, awardRules, misconceptions]) {
  for (const record of collection) for (const sourceId of record.sourceIds) referencedSourceIds.add(sourceId);
}
for (const rule of awardRules) for (const evidence of rule.clauseEvidence) for (const sourceId of evidence.sourceIds) referencedSourceIds.add(sourceId);
for (const card of qualificationFactCards) {
  for (const sourceId of card.sourceIds) referencedSourceIds.add(sourceId);
  for (const route of card.routes) {
    for (const sourceId of route.sourceIds) referencedSourceIds.add(sourceId);
    for (const evidence of route.clauseEvidence) for (const sourceId of evidence.sourceIds) referencedSourceIds.add(sourceId);
  }
}

const sourceMap = new Map(candidate.sources.map(source => [source.sourceId, source]));
const sources = [...referencedSourceIds].sort().map(sourceId => {
  const source = sourceMap.get(sourceId);
  if (!source) throw new Error(`Unknown referenced source ${sourceId}`);
  if (source.verificationStatus !== "codex-reviewed") throw new Error(`Source ${sourceId} is not Codex-reviewed`);
  if (!/^[a-f0-9]{64}$/.test(source.sourceDocumentHash ?? "")) throw new Error(`Source ${sourceId} has no verified document hash`);
  return promote(source);
});

const manifest = {
  schemaVersion: "2.0.0",
  activationBatch: batch,
  qualificationIdentities,
  qualificationFactCards,
  sources,
  boundaries,
  statistics,
  awardRules,
  misconceptions,
  difficultyProfiles: [],
};

const server = await createServer({ root, configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "silent" });
try {
  const { AcademicResultsManifestV2Schema } = await server.ssrLoadModule("/src/domain-v2/academic-results/schema.ts");
  AcademicResultsManifestV2Schema.parse(manifest);
} finally {
  await server.close();
}

const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
const manifestHash = createHash("sha256").update(manifestText).digest("hex");
const calculatorEnabled = qualificationFactCards.filter(card => card.maturity.calculatorAvailable).map(card => card.awardQualificationId);
const calculatorExplainOnly = qualificationFactCards.filter(card => !card.maturity.calculatorAvailable).map(card => card.awardQualificationId);
const activation = {
  schemaVersion: "1.0.0",
  approvalBatch: batch,
  approvedAt: "2026-07-22T00:00:00+08:00",
  approvalScope: "13 qualification identities, 40 versioned award rules, source-backed misconceptions, and Codex-reviewed official boundary/statistics rows",
  manifestSha256: manifestHash,
  activeCounts: {
    qualificationIdentities: qualificationIdentities.length,
    qualificationFactCards: qualificationFactCards.length,
    sources: sources.length,
    boundaries: boundaries.length,
    statistics: statistics.length,
    awardRules: awardRules.length,
    misconceptions: misconceptions.length,
  },
  ruleCoverage: {
    expected: ruleMatrix.expectedCellCount,
    satisfied: ruleMatrix.satisfiedCellCount,
    pending: ruleMatrix.pendingCellCount,
    blocking: ruleMatrix.blockingCellCount,
  },
  launchSafety: {
    p0GapCount: gapReport.counts.P0,
    calculatorEnabled,
    calculatorExplainOnly,
    gradeStatisticsBlocksRules: false,
    predictionsActivated: false,
    externalSearchActivated: false,
  },
};

const activeDirectory = join(root, "data", "active", "academic-results-v2");
const publicDirectory = join(root, "public", "data", "academic-results-v2");
const generatedDirectory = join(root, "generated", "academic-results-v2");
await Promise.all([mkdir(activeDirectory, { recursive: true }), mkdir(publicDirectory, { recursive: true }), mkdir(generatedDirectory, { recursive: true })]);
const temporaryManifest = join(publicDirectory, `.manifest.${process.pid}.tmp`);
await writeFile(temporaryManifest, manifestText);
await rename(temporaryManifest, join(publicDirectory, "manifest.json"));
await Promise.all([
  writeFile(join(activeDirectory, "activation.json"), `${JSON.stringify(activation, null, 2)}\n`),
  writeFile(join(generatedDirectory, "launch-activation-report.json"), `${JSON.stringify(activation, null, 2)}\n`),
]);

console.log(`Activated ${batch}: ${awardRules.length} rules, ${boundaries.length} boundaries, ${statistics.length} statistics rows; calculators ${calculatorEnabled.length} enabled / ${calculatorExplainOnly.length} explain-only.`);
