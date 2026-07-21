import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const publicRoot = join(root, "public");
const vite = await createServer({ root, configFile: false, server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
const {
  buildDifficultyProfile,
  calculateAssessmentDemand,
  calculateKnowledgeDimensions,
} = await vite.ssrLoadModule("/src/domain-v2/academic-results/difficulty-engine.ts");
const { EXAM_OVERVIEW_CATALOG } = await vite.ssrLoadModule("/src/domain-v2/exam-overview/index.ts");

const manifest = JSON.parse(await readFile(join(publicRoot, "data/knowledge-v5/manifest.json"), "utf8"));
const generatedAt = manifest.generatedAt ?? "2026-07-21T00:00:00+08:00";
const ontology = JSON.parse(await readFile(join(publicRoot, manifest.ontologyUrl.slice(1)), "utf8"));
const byCode = new Map(manifest.mappings.map(entry => [entry.code, entry]));
const mappingCache = new Map();

const routeDefinitions = [
  {
    id: "0580-extended-to-9709-as-p1-s1",
    label: "CAIE 0580 Extended → CAIE 9709 AS (Pure 1 + Statistics 1)",
    source: { code: "CAIE-0580", routeId: "extended-p2-p4", paperIds: ["CAIE-0580-Paper-2", "CAIE-0580-Paper-4"], tiers: ["Extended"] },
    target: { code: "CAIE-9709", routeId: "as-p1-s1", paperIds: ["CAIE-9709-Paper-1", "CAIE-9709-Paper-5"] },
  },
  {
    id: "0580-extended-to-9709-al-p1-p3-m1-s1",
    label: "CAIE 0580 Extended → CAIE 9709 A Level (P1 + P3 + M1 + S1)",
    source: { code: "CAIE-0580", routeId: "extended-p2-p4", paperIds: ["CAIE-0580-Paper-2", "CAIE-0580-Paper-4"], tiers: ["Extended"] },
    target: { code: "CAIE-9709", routeId: "al-p1-p3-m1-s1", paperIds: ["CAIE-9709-Paper-1", "CAIE-9709-Paper-3", "CAIE-9709-Paper-4", "CAIE-9709-Paper-5"] },
  },
  {
    id: "4ma1-higher-to-ial-mathematics",
    label: "Pearson 4MA1 Higher → Pearson IAL Mathematics (P1–P4 + M1 + S1)",
    source: { code: "Edexcel-4MA1", routeId: "higher", paperIds: ["4MA1-1H", "4MA1-2H"], tiers: ["Higher"] },
    target: { code: "Edexcel-IAL", routeId: "ial-mathematics-p1-p4-m1-s1", paperIds: ["Edexcel-IAL-P1", "Edexcel-IAL-P2", "Edexcel-IAL-P3", "Edexcel-IAL-P4", "Edexcel-IAL-M1", "Edexcel-IAL-S1"] },
  },
  {
    id: "9709-al-to-9231-al",
    label: "CAIE 9709 A Level → CAIE 9231 A Level Further Mathematics",
    source: { code: "CAIE-9709", routeId: "al-p1-p3-m1-s1", paperIds: ["CAIE-9709-Paper-1", "CAIE-9709-Paper-3", "CAIE-9709-Paper-4", "CAIE-9709-Paper-5"] },
    target: { code: "CAIE-9231", routeId: "al-all-papers", paperIds: ["CAIE-9231-Paper-1", "CAIE-9231-Paper-2", "CAIE-9231-Paper-3", "CAIE-9231-Paper-4"] },
  },
  {
    id: "aqa-7357-to-7367-discrete-statistics",
    label: "AQA 7357 Mathematics → AQA 7367 Further Mathematics (Discrete + Statistics)",
    source: { code: "AQA-7357", routeId: "linear", paperIds: ["paper-1", "paper-2", "paper-3"] },
    target: { code: "AQA-7367", routeId: "discrete-statistics", paperIds: ["paper-1", "paper-2", "paper-3-discrete-statistics"] },
    processingPolicy: "local-only",
  },
  {
    id: "ocr-h240-to-h245",
    label: "OCR H240 Mathematics A → OCR H245 Further Mathematics A",
    source: { code: "OCR-H240", routeId: "linear", paperIds: ["H240-01", "H240-02", "H240-03"] },
    target: { code: "OCR-H245", routeId: "all-components", paperIds: ["Y540", "Y541", "Y542", "Y543", "Y544", "Y545"] },
  },
  {
    id: "ocr-h240-to-h640-mathematics-b",
    label: "OCR H240 Mathematics A → OCR H640 Mathematics B (MEI)",
    source: { code: "OCR-H240", routeId: "linear", paperIds: ["H240-01", "H240-02", "H240-03"] },
    target: { code: "OCR-H640", routeId: "linear", paperIds: ["01", "02", "03"] },
    note: "H640 is Mathematics B (MEI), not Further Mathematics B. OCR Further Mathematics B is H645 and is outside the approved scope.",
  },
];

const normalized = value => value.toUpperCase().replace(/[^A-Z0-9]+/g, "");
const loadMapping = async code => {
  if (mappingCache.has(code)) return mappingCache.get(code);
  const entry = byCode.get(code);
  if (!entry) throw new Error(`Missing Knowledge V5 mapping ${code}`);
  const mapping = JSON.parse(await readFile(join(publicRoot, entry.mappingUrl.slice(1)), "utf8"));
  if (mapping.reviewStatus !== "owner-approved") throw new Error(`${code} is not owner-approved`);
  mappingCache.set(code, mapping);
  return mapping;
};

const knowledgeSourceId = code => `knowledge-v5:${code}`;
const overviewFor = entry => EXAM_OVERVIEW_CATALOG.find(overview =>
  overview.code.split(/[\/·,|]+/).some(code => normalized(code) === normalized(entry.subjectCode)),
);

const assessmentFor = (entry, paperIds) => {
  const overview = overviewFor(entry);
  if (!overview) return null;
  const paperDefinitions = entry.paperDefinitions.filter(paper => paperIds.includes(paper.paperId));
  const components = paperDefinitions.flatMap(paper => {
    const code = normalized(paper.code);
    const name = normalized(paper.name);
    const match = overview.components.find(component => {
      const componentCode = normalized(component.code);
      return normalized(component.name) === name || componentCode === code || (code && componentCode.endsWith(code));
    });
    return match ? [match] : [];
  });
  if (components.length !== paperDefinitions.length || components.some(component => !component.durationMinutes || !component.marks)) return null;
  const totalMarks = components.reduce((sum, component) => sum + component.marks, 0);
  return {
    paperCount: components.length,
    totalMinutes: components.reduce((sum, component) => sum + component.durationMinutes, 0),
    totalMarks,
    nonCalculatorMarkShare: totalMarks ? components.filter(component => component.calculator === "forbidden").reduce((sum, component) => sum + component.marks, 0) / totalMarks : 0,
    sourceIds: [`exam-overview:${overview.id}`],
  };
};

const profiles = [];
const reports = [];
for (const definition of routeDefinitions) {
  const sourceEntry = byCode.get(definition.source.code);
  const targetEntry = byCode.get(definition.target.code);
  if (!sourceEntry || !targetEntry) throw new Error(`Unknown route mapping in ${definition.id}`);
  const [sourceMapping, targetMapping] = await Promise.all([loadMapping(sourceEntry.code), loadMapping(targetEntry.code)]);
  const sourceSelection = {
    statements: sourceMapping.statements,
    paperIds: definition.source.paperIds,
    tiers: definition.source.tiers,
    sourceIds: [knowledgeSourceId(sourceEntry.code)],
  };
  const targetSelection = {
    statements: targetMapping.statements,
    paperIds: definition.target.paperIds,
    tiers: definition.target.tiers,
    sourceIds: [knowledgeSourceId(targetEntry.code)],
  };
  const knowledge = calculateKnowledgeDimensions(sourceSelection, targetSelection, ontology.nodes);
  const assessment = calculateAssessmentDemand(
    assessmentFor(sourceEntry, definition.source.paperIds),
    assessmentFor(targetEntry, definition.target.paperIds),
  );
  const profile = buildDifficultyProfile({
    profileId: `difficulty:${definition.id}`,
    sourceQualificationVersionId: sourceEntry.qualificationVersionId,
    sourceRouteId: definition.source.routeId,
    sourcePaperIds: definition.source.paperIds,
    sourceTiers: definition.source.tiers,
    targetQualificationVersionId: targetEntry.qualificationVersionId,
    targetRouteId: definition.target.routeId,
    targetPaperIds: definition.target.paperIds,
    targetTiers: definition.target.tiers,
    dimensions: {
      contentGap: knowledge.contentGap,
      depthUplift: knowledge.depthUplift,
      assessmentDemand: assessment,
      questionComplexity: { score: null, evidenceCoverage: 0, sourceIds: [], explanation: "Question-level derived metadata has not yet passed the evidence gate." },
      empiricalDemand: { score: null, evidenceCoverage: 0, sourceIds: [], explanation: "Comparable official performance evidence has not yet passed the evidence gate." },
    },
    verificationStatus: "candidate",
  });
  profiles.push({
    ...profile,
    label: definition.label,
    sourceCode: definition.source.code,
    targetCode: definition.target.code,
    processingPolicy: definition.processingPolicy ?? "deterministic-local",
    ...(definition.note ? { note: definition.note } : {}),
  });
  reports.push({
    profileId: profile.profileId,
    label: definition.label,
    sourceConceptCount: knowledge.sourceNodeIds.length,
    targetConceptCount: knowledge.targetNodeIds.length,
    missingConceptCount: knowledge.missingNodeIds.length,
    missingNodeIds: knowledge.missingNodeIds,
    score: profile.score,
    interval: profile.interval,
    evidenceCoverage: profile.evidenceCoverage,
    assessmentEvidenceAvailable: assessment.score !== null,
    ...(definition.note ? { note: definition.note } : {}),
  });
}

const candidateDirectory = join(root, "data/candidates/academic-results-v2");
const generatedDirectory = join(root, "generated/academic-results-v2");
await mkdir(candidateDirectory, { recursive: true });
await mkdir(generatedDirectory, { recursive: true });
await writeFile(join(candidateDirectory, "difficulty-profiles.json"), `${JSON.stringify({
  schemaVersion: "1.0.0",
  generatedAt,
  sourceKnowledgeBatch: manifest.activeBatch,
  status: "candidate",
  profiles,
}, null, 2)}\n`);
await writeFile(join(generatedDirectory, "difficulty-gold-report.json"), `${JSON.stringify({
  schemaVersion: "1.0.0",
  generatedAt,
  sourceKnowledgeBatch: manifest.activeBatch,
  profileCount: reports.length,
  profiles: reports,
}, null, 2)}\n`);
await vite.close();
console.log(`Generated ${profiles.length} directional difficulty candidates from owner-approved Knowledge V5.`);
