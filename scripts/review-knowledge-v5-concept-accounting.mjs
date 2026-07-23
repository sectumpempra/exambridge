import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createKimiK3Client,
  KIMI_MODEL,
  KIMI_FALLBACK_MODEL,
} from "/Users/yuzhou/Documents/Codex/2026-07-14/new-chat/work/lib/kimi-code-k3.mjs";

const root = process.cwd();
const clientRoot = "/Users/yuzhou/Documents/Codex/2026-07-14/new-chat";
const activeRoot = path.join(root, "data/active/knowledge-v5");
const candidateRoot = path.join(root, "data/candidates/knowledge-v5-concept-accounting-20260723");
const batchRoot = path.join(candidateRoot, "machine-review-batches");
const usagePath = path.join(candidateRoot, "usage.json");
const resultPath = path.join(candidateRoot, "machine-review-pass-1.json");
const chunkSize = Number(process.env.KNOWLEDGE_REVIEW_CHUNK_SIZE ?? 24);
const workerCount = Number(process.env.KNOWLEDGE_REVIEW_CONCURRENCY ?? 8);
const batchLimit = Number(process.env.KNOWLEDGE_REVIEW_BATCH_LIMIT ?? 0);
const providerPreference = process.env.KNOWLEDGE_REVIEW_PROVIDER ?? "kimi-code";

if (!Number.isInteger(chunkSize) || chunkSize < 5 || chunkSize > 40) throw new Error("KNOWLEDGE_REVIEW_CHUNK_SIZE must be 5-40");
if (!Number.isInteger(workerCount) || workerCount < 1 || workerCount > 32) throw new Error("KNOWLEDGE_REVIEW_CONCURRENCY must be 1-32");

const ontology = JSON.parse(await readFile(path.join(activeRoot, "ontology.json"), "utf8"));
const eligibleNodes = ontology.nodes
  .filter((node) => node.comparisonEligible && node.semanticClass === "mathematical-knowledge")
  .map((node) => ({
    nodeId: node.nodeId,
    definition: node.definition,
    aliases: node.aliases,
    dimension: node.dimension,
    objectScopes: node.objectScopes,
    inclusions: node.inclusions,
    exclusions: node.exclusions,
  }));
const eligibleNodeIds = new Set(eligibleNodes.map((node) => node.nodeId));
let usage = [];
try {
  const existingUsage = JSON.parse(await readFile(usagePath, "utf8"));
  if (Array.isArray(existingUsage.calls)) usage = existingUsage.calls;
} catch {
  // A new review run starts with an empty usage journal.
}

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(tempPath, filePath);
}

const callKimi = createKimiK3Client({
  root: clientRoot,
  usage,
  providerPreference,
  onUsage: async () => atomicWrite(usagePath, {
    schemaVersion: "1.0.0",
    requestedPrimaryModel: KIMI_MODEL,
    fallbackModel: KIMI_FALLBACK_MODEL,
    calls: usage,
  }),
});

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

function branchKey(nodeId) {
  return nodeId.split("-").slice(0, 2).join("-");
}

function relevantOntologyForStatements(statements) {
  const existingNodeIds = new Set(statements.flatMap((statement) => statement.conceptLinks.map((link) => link.nodeId)));
  const branches = new Set([...existingNodeIds].map(branchKey));
  return eligibleNodes.filter((node) => existingNodeIds.has(node.nodeId) || branches.has(branchKey(node.nodeId)));
}

function evidenceContains(statement, evidenceSpan) {
  return [statement.statementText, ...statement.notesText, ...statement.examplesText]
    .some((text) => text.includes(evidenceSpan));
}

function validateBatchResult(result, statements, batchId) {
  const statementById = new Map(statements.map((statement) => [statement.statementId, statement]));
  const reviewedIds = new Set(result.reviewedStatementIds ?? []);
  for (const statementId of reviewedIds) if (!statementById.has(statementId)) throw new Error(`${batchId}: reviewed unknown statement ${statementId}`);
  const additions = [];
  for (const addition of result.additions ?? []) {
    const statement = statementById.get(addition.statementId);
    if (!statement) throw new Error(`${batchId}: unknown statement ${addition.statementId}`);
    if (!eligibleNodeIds.has(addition.nodeId)) throw new Error(`${batchId}: unknown or ineligible node ${addition.nodeId}`);
    if (statement.existingConceptLinks.some((link) => link.nodeId === addition.nodeId)) continue;
    if (!["exact", "broader", "narrower", "partial"].includes(addition.relation)) throw new Error(`${batchId}: invalid relation`);
    if (!["knowledge", "application", "reasoning", "proof"].includes(addition.assessmentDepth)) throw new Error(`${batchId}: invalid assessmentDepth`);
    if (!evidenceContains(statement, addition.evidenceSpan)) throw new Error(`${batchId}: evidenceSpan is not an exact source substring`);
    reviewedIds.add(addition.statementId);
    additions.push({
      ...addition,
      reviewStatus: "machine-reviewed",
      reviewPass: 1,
    });
  }
  return {
    reviewedStatementIds: [...reviewedIds],
    omittedStatementIds: statements.map((statement) => statement.statementId).filter((statementId) => !reviewedIds.has(statementId)),
    additions,
    unresolved: Array.isArray(result.unresolved) ? result.unresolved : [],
  };
}

const mappingFiles = (await readdir(path.join(activeRoot, "mappings")))
  .filter((file) => file.endsWith(".json"))
  .sort();
const allTasks = [];
const excludedAqa = [];
for (const file of mappingFiles) {
  const mapping = JSON.parse(await readFile(path.join(activeRoot, "mappings", file), "utf8"));
  const assessable = mapping.statements.filter((statement) => statement.statementType === "assessable-content");
  if (mapping.board === "AQA") {
    excludedAqa.push({
      qualificationVersionId: mapping.qualificationVersionId,
      statementCount: assessable.length,
      provider: "local",
      reason: "AQA source wording is prohibited from external-model prompts.",
    });
    continue;
  }
  for (const [index, batchStatements] of chunks(assessable, chunkSize).entries()) {
    const batchId = `${file.replace(/\.json$/, "")}-c${chunkSize}-${String(index + 1).padStart(3, "0")}`;
    allTasks.push({
      batchId,
      mapping: {
        qualificationVersionId: mapping.qualificationVersionId,
        board: mapping.board,
        subjectCode: mapping.subjectCode,
        subjectName: mapping.subjectName,
        level: mapping.level,
        syllabusVersion: mapping.syllabusVersion,
      },
      statements: batchStatements.map((statement) => ({
        statementId: statement.statementId,
        sectionId: statement.sectionId,
        topicHeading: statement.topicHeading,
        statementText: statement.statementText,
        notesText: statement.notesText,
        examplesText: statement.examplesText,
        tiers: statement.tiers,
        routes: statement.routes,
        paperApplicability: statement.paperApplicability,
        existingConceptLinks: statement.conceptLinks,
      })),
      canonicalOntology: relevantOntologyForStatements(batchStatements),
    });
  }
}
const tasks = batchLimit > 0 ? allTasks.slice(0, batchLimit) : allTasks;

await mkdir(batchRoot, { recursive: true });
let nextTask = 0;
const completed = [];
const failures = [];

async function processTask(task) {
  const filePath = path.join(batchRoot, `${task.batchId}.json`);
  const rawPath = path.join(batchRoot, `${task.batchId}.raw.json`);
  try {
    const cached = JSON.parse(await readFile(filePath, "utf8"));
    if (
      cached.status === "success"
      && cached.statementCount === task.statements.length
      && Array.isArray(cached.omittedStatementIds)
    ) return cached;
  } catch {
    // A missing or incomplete batch is safe to run.
  }
  try {
    const cachedRaw = JSON.parse(await readFile(rawPath, "utf8"));
    const validated = validateBatchResult(cachedRaw, task.statements, task.batchId);
    const record = {
      schemaVersion: "1.0.0",
      batchId: task.batchId,
      status: "success",
      mapping: task.mapping,
      statementCount: task.statements.length,
      ...validated,
    };
    await atomicWrite(filePath, record);
    return record;
  } catch {
    // Invalid or missing raw output is rerun through the provider.
  }

  const usageStart = usage.length;
  const result = await callKimi({
    label: `knowledge-v5-concept-accounting-pass1-${task.batchId}`,
    system: [
      "You are reviewing an official mathematics specification mapping to a fixed canonical ontology.",
      "Use only the supplied official statement, notes and examples. Do not add external facts.",
      "Find every canonical leaf concept that is explicitly assessable in each record but is missing from existingConceptLinks.",
      "Notes and examples can supply explicit assessable evidence; headings alone are not sufficient evidence.",
      "Do not map incidental words, exclusions, context-only wording, or a generic term to an unrelated branch.",
      "Respect ontology inclusions and exclusions, 2D/3D scope, tier, route and Paper scope.",
      "Return additions only. evidenceSpan must be an exact, non-empty substring of statementText, notesText or examplesText.",
      "If no link is missing, list the statement only in reviewedStatementIds.",
      "Return strict JSON: {reviewedStatementIds:string[], additions:{statementId:string,nodeId:string,relation:'exact'|'broader'|'narrower'|'partial',assessmentDepth:'knowledge'|'application'|'reasoning'|'proof',evidenceSpan:string,reviewNotes:string[]}[], unresolved:{statementId:string,reason:string}[]}.",
    ].join("\n"),
    input: {
      task: "Complete concept accounting for this batch.",
      mapping: task.mapping,
      statements: task.statements,
      canonicalOntology: task.canonicalOntology,
    },
    maxTokens: 24_000,
  });
  await atomicWrite(rawPath, result);
  const validated = validateBatchResult(result, task.statements, task.batchId);
  const record = {
    schemaVersion: "1.0.0",
    batchId: task.batchId,
    status: "success",
    mapping: task.mapping,
    statementCount: task.statements.length,
    providerCalls: usage.slice(usageStart),
    ...validated,
  };
  await atomicWrite(filePath, record);
  return record;
}

async function worker() {
  while (true) {
    const index = nextTask;
    nextTask += 1;
    if (index >= tasks.length) return;
    const task = tasks[index];
    try {
      completed.push(await processTask(task));
    } catch (error) {
      failures.push({ batchId: task.batchId, error: String(error?.message ?? error) });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(workerCount, tasks.length) }, () => worker()));
const report = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  sourceBatch: JSON.parse(await readFile(path.join(activeRoot, "activation.json"), "utf8")).approvalBatch,
  requestedPrimaryModel: KIMI_MODEL,
  fallbackModel: KIMI_FALLBACK_MODEL,
  taskCount: tasks.length,
  completedTaskCount: completed.length,
  failureCount: failures.length,
  failures,
  excludedAqa,
  reviewedStatementCount: completed.reduce((total, item) => total + item.reviewedStatementIds.length, 0),
  omittedStatementCount: completed.reduce((total, item) => total + item.omittedStatementIds.length, 0),
  omittedStatements: completed.flatMap((item) => item.omittedStatementIds.map((statementId) => ({
    qualificationVersionId: item.mapping.qualificationVersionId,
    batchId: item.batchId,
    statementId,
  }))),
  proposedAdditionCount: completed.reduce((total, item) => total + item.additions.length, 0),
  unresolvedCount: completed.reduce((total, item) => total + item.unresolved.length, 0),
  additions: completed.flatMap((item) => item.additions.map((addition) => ({
    qualificationVersionId: item.mapping.qualificationVersionId,
    batchId: item.batchId,
    ...addition,
  }))),
  unresolved: completed.flatMap((item) => item.unresolved.map((unresolved) => ({
    qualificationVersionId: item.mapping.qualificationVersionId,
    batchId: item.batchId,
    ...unresolved,
  }))),
  usageSummary: {
    callCount: usage.length,
    providers: Object.fromEntries(
      [...new Set(usage.map((call) => call.provider))].map((provider) => [
        provider,
        usage.filter((call) => call.provider === provider).length,
      ]),
    ),
    returnedModels: [...new Set(usage.map((call) => call.returnedModel))],
    promptTokens: usage.reduce((total, call) => total + (call.promptTokens ?? 0), 0),
    completionTokens: usage.reduce((total, call) => total + (call.completionTokens ?? 0), 0),
    totalTokens: usage.reduce((total, call) => total + (call.totalTokens ?? 0), 0),
  },
};
await atomicWrite(resultPath, report);
await atomicWrite(usagePath, {
  schemaVersion: "1.0.0",
  requestedPrimaryModel: KIMI_MODEL,
  fallbackModel: KIMI_FALLBACK_MODEL,
  calls: usage,
});

console.log(JSON.stringify({
  taskCount: report.taskCount,
  completedTaskCount: report.completedTaskCount,
  failureCount: report.failureCount,
  reviewedStatementCount: report.reviewedStatementCount,
  proposedAdditionCount: report.proposedAdditionCount,
  unresolvedCount: report.unresolvedCount,
}));
if (failures.length) process.exitCode = 1;
