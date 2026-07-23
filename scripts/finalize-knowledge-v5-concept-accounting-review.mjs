import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
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
const batchRoot = path.join(candidateRoot, "final-review-batches");
const pass1Path = path.join(candidateRoot, "machine-review-pass-1.json");
const lexicalAuditPath = path.join(root, "generated/knowledge-v5-concept-accounting-audit.json");
const usagePath = path.join(candidateRoot, "final-review-usage.json");
const resultPath = path.join(candidateRoot, "final-machine-review.json");
const chunkSize = Number(process.env.KNOWLEDGE_FINAL_REVIEW_CHUNK_SIZE ?? 3);
const workerCount = Number(process.env.KNOWLEDGE_FINAL_REVIEW_CONCURRENCY ?? 24);
const batchLimit = Number(process.env.KNOWLEDGE_FINAL_REVIEW_BATCH_LIMIT ?? 0);

if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 4) throw new Error("KNOWLEDGE_FINAL_REVIEW_CHUNK_SIZE must be 1-4");
if (!Number.isInteger(workerCount) || workerCount < 1 || workerCount > 32) throw new Error("KNOWLEDGE_FINAL_REVIEW_CONCURRENCY must be 1-32");

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
const pass1 = JSON.parse(await readFile(pass1Path, "utf8"));
const lexicalAudit = JSON.parse(await readFile(lexicalAuditPath, "utf8"));
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
  providerPreference: "deepseek",
  onUsage: async () => atomicWrite(usagePath, {
    schemaVersion: "1.0.0",
    requestedPrimaryModel: KIMI_MODEL,
    reviewProvider: KIMI_FALLBACK_MODEL,
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

function evidenceContains(statement, evidenceSpan) {
  return [statement.statementText, ...statement.notesText, ...statement.examplesText]
    .some((text) => text.includes(evidenceSpan));
}

const mappingFiles = (await readdir(path.join(activeRoot, "mappings"))).filter((file) => file.endsWith(".json")).sort();
const mappings = await Promise.all(mappingFiles.map(async (file) => JSON.parse(await readFile(path.join(activeRoot, "mappings", file), "utf8"))));
const statementIndex = new Map();
for (const mapping of mappings) {
  for (const statement of mapping.statements) statementIndex.set(`${mapping.qualificationVersionId}|${statement.statementId}`, { mapping, statement });
}

const pass1AdditionsByStatement = new Map();
for (const addition of pass1.additions ?? []) {
  const key = `${addition.qualificationVersionId}|${addition.statementId}`;
  const values = pass1AdditionsByStatement.get(key) ?? [];
  values.push(addition);
  pass1AdditionsByStatement.set(key, values);
}
const exclusionConflictsByStatement = new Map();
for (const conflict of lexicalAudit.exclusionConflicts ?? []) {
  if (conflict.board === "AQA") continue;
  const key = `${conflict.qualificationVersionId}|${conflict.statementId}`;
  const values = exclusionConflictsByStatement.get(key) ?? [];
  values.push(conflict);
  exclusionConflictsByStatement.set(key, values);
}
const crossBranchCandidatesByStatement = new Map();
for (const issue of lexicalAudit.issues ?? []) {
  if (
    issue.board === "AQA"
    || issue.matchKind !== "normalized-phrase"
    || issue.score < 7
    || issue.sameKnowledgeBranch !== false
  ) continue;
  const key = `${issue.qualificationVersionId}|${issue.statementId}`;
  const values = crossBranchCandidatesByStatement.get(key) ?? [];
  values.push({
    evidenceField: issue.evidenceField,
    evidenceText: issue.evidenceText,
    suggestedNodeId: issue.suggestedNodeId,
    suggestedNodeDefinition: issue.suggestedNodeDefinition,
    cueText: issue.cueText,
  });
  crossBranchCandidatesByStatement.set(key, values);
}
const targetKeys = new Set([
  ...pass1AdditionsByStatement.keys(),
  ...(pass1.omittedStatements ?? []).map((item) => `${item.qualificationVersionId}|${item.statementId}`),
  ...(pass1.unresolved ?? []).map((item) => `${item.qualificationVersionId}|${item.statementId}`),
  ...exclusionConflictsByStatement.keys(),
  ...crossBranchCandidatesByStatement.keys(),
]);

const targetItems = [...targetKeys].map((key) => {
  const indexed = statementIndex.get(key);
  if (!indexed) throw new Error(`Missing target statement ${key}`);
  if (indexed.mapping.board === "AQA") return null;
  const currentNodeIds = indexed.statement.conceptLinks.map((link) => link.nodeId);
  const branches = new Set(currentNodeIds.map(branchKey));
  for (const addition of pass1AdditionsByStatement.get(key) ?? []) branches.add(branchKey(addition.nodeId));
  for (const candidate of crossBranchCandidatesByStatement.get(key) ?? []) {
    branches.add(branchKey(candidate.suggestedNodeId));
  }
  return {
    qualificationVersionId: indexed.mapping.qualificationVersionId,
    board: indexed.mapping.board,
    subjectCode: indexed.mapping.subjectCode,
    syllabusVersion: indexed.mapping.syllabusVersion,
    statement: indexed.statement,
    pass1Additions: pass1AdditionsByStatement.get(key) ?? [],
    pass1Unresolved: (pass1.unresolved ?? []).filter(
      (item) => `${item.qualificationVersionId}|${item.statementId}` === key,
    ),
    exclusionConflicts: exclusionConflictsByStatement.get(key) ?? [],
    crossBranchCandidates: crossBranchCandidatesByStatement.get(key) ?? [],
    canonicalOntology: eligibleNodes.filter((node) => branches.has(branchKey(node.nodeId))),
  };
}).filter(Boolean);

const allTasks = chunks(targetItems, chunkSize).map((items, index) => ({
  batchId: `final-c${chunkSize}-${String(index + 1).padStart(4, "0")}`,
  items,
}));
const tasks = batchLimit > 0 ? allTasks.slice(0, batchLimit) : allTasks;

function validate(result, task) {
  const itemByStatementId = new Map(task.items.map((item) => [item.statement.statementId, item]));
  const reviewedIds = new Set(result.reviewedStatementIds ?? []);
  for (const item of task.items) {
    if (!reviewedIds.has(item.statement.statementId)) throw new Error(`${task.batchId}: omitted ${item.statement.statementId}`);
  }
  const additions = [];
  for (const addition of result.additions ?? []) {
    const item = itemByStatementId.get(addition.statementId);
    if (!item) throw new Error(`${task.batchId}: unknown addition statement`);
    if (!eligibleNodeIds.has(addition.nodeId)) throw new Error(`${task.batchId}: unknown node ${addition.nodeId}`);
    if (item.statement.conceptLinks.some((link) => link.nodeId === addition.nodeId)) continue;
    if (!evidenceContains(item.statement, addition.evidenceSpan)) throw new Error(`${task.batchId}: invalid addition evidence`);
    additions.push({ ...addition, reviewStatus: "machine-reviewed", reviewPass: 2 });
  }
  const removals = [];
  for (const removal of result.removals ?? []) {
    const item = itemByStatementId.get(removal.statementId);
    if (!item) throw new Error(`${task.batchId}: unknown removal statement`);
    if (!item.statement.conceptLinks.some((link) => link.nodeId === removal.nodeId)) throw new Error(`${task.batchId}: removal is not an existing link`);
    removals.push({ ...removal, reviewStatus: "machine-reviewed", reviewPass: 2 });
  }
  return {
    reviewedStatementIds: [...reviewedIds],
    additions,
    removals,
    unresolved: Array.isArray(result.unresolved) ? result.unresolved : [],
  };
}

await mkdir(batchRoot, { recursive: true });
let nextTask = 0;
const completed = [];
const failures = [];

async function processTask(task) {
  const filePath = path.join(batchRoot, `${task.batchId}.json`);
  const rawPath = path.join(batchRoot, `${task.batchId}.raw.json`);
  try {
    const cached = JSON.parse(await readFile(filePath, "utf8"));
    if (cached.status === "success" && cached.statementCount === task.items.length) return cached;
  } catch {
    // Missing batch.
  }
  try {
    const raw = JSON.parse(await readFile(rawPath, "utf8"));
    const validated = validate(raw, task);
    const record = { schemaVersion: "1.0.0", batchId: task.batchId, status: "success", statementCount: task.items.length, ...validated };
    await atomicWrite(filePath, record);
    return record;
  } catch {
    // Missing or invalid raw output is rerun.
  }

  const usageStart = usage.length;
  const result = await callKimi({
    label: `knowledge-v5-concept-accounting-final-${task.batchId}`,
    system: [
      "You are the final conservative reviewer of official mathematics specification concept accounting.",
      "Use only supplied evidence and the fixed canonical ontology. Do not use external facts.",
      "For every statement, decide the complete final set of concept-link changes.",
      "Confirm a concept only when the statement, note, or example explicitly assesses it. Do not add prerequisites, incidental words, generic contexts, taxonomy ancestors, or a sibling concept merely because it is related.",
      "Repeated section-level notes may appear on several atomic statements; attach their concept only to the most semantically direct atomic statement in this batch, otherwise leave unresolved rather than duplicate blindly.",
      "Check pass1Additions independently; reject false positives silently by omitting them.",
      "Re-evaluate pass1Unresolved. Resolve it with an existing supplied leaf when possible; otherwise return a precise ontology-gap reason for Codex to disposition locally.",
      "Check exclusionConflicts. An exclusion phrase can coexist with a valid linked concept in a multi-concept statement, so remove a link only when its own definition does not match any assessable requirement.",
      "Check crossBranchCandidates independently. They are exact lexical cues that may expose a wrong existing branch, but they are not presumed correct; accept only when the supplied official evidence explicitly assesses the candidate definition.",
      "Find any additional missing leaf in canonicalOntology, even if pass 1 did not propose it.",
      "evidenceSpan for an addition must be an exact source substring. A removal must name an existing node and include a precise reason.",
      "Return strict JSON: {reviewedStatementIds:string[], additions:{statementId:string,nodeId:string,relation:'exact'|'broader'|'narrower'|'partial',assessmentDepth:'knowledge'|'application'|'reasoning'|'proof',evidenceSpan:string,reviewNotes:string[]}[], removals:{statementId:string,nodeId:string,reason:string}[], unresolved:{statementId:string,reason:string}[]}.",
    ].join("\n"),
    input: { task: "Produce final concept-link corrections for every supplied statement.", items: task.items },
    maxTokens: 24_000,
  });
  await atomicWrite(rawPath, result);
  const validated = validate(result, task);
  const record = {
    schemaVersion: "1.0.0",
    batchId: task.batchId,
    status: "success",
    statementCount: task.items.length,
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
  sourceBatch: pass1.sourceBatch,
  requestedPrimaryModel: KIMI_MODEL,
  reviewProvider: KIMI_FALLBACK_MODEL,
  targetStatementCount: targetItems.length,
  taskCount: tasks.length,
  completedTaskCount: completed.length,
  failureCount: failures.length,
  failures,
  reviewedStatementCount: completed.reduce((total, item) => total + item.reviewedStatementIds.length, 0),
  additionCount: completed.reduce((total, item) => total + item.additions.length, 0),
  removalCount: completed.reduce((total, item) => total + item.removals.length, 0),
  unresolvedCount: completed.reduce((total, item) => total + item.unresolved.length, 0),
  additions: completed.flatMap((item) => item.additions),
  removals: completed.flatMap((item) => item.removals),
  unresolved: completed.flatMap((item) => item.unresolved),
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
  reviewProvider: KIMI_FALLBACK_MODEL,
  calls: usage,
});
console.log(JSON.stringify({
  targetStatementCount: report.targetStatementCount,
  completedTaskCount: report.completedTaskCount,
  failureCount: report.failureCount,
  additionCount: report.additionCount,
  removalCount: report.removalCount,
  unresolvedCount: report.unresolvedCount,
}));
if (failures.length || report.unresolvedCount) process.exitCode = 1;
