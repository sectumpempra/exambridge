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
const candidateRoot = path.join(root, "data/candidates/knowledge-v5-concept-accounting-20260723");
const mappingRoot = path.join(candidateRoot, "mappings");
const ontologyPath = path.join(candidateRoot, "ontology.json");
const auditPath = path.join(candidateRoot, "post-correction-concept-audit.json");
const batchRoot = path.join(candidateRoot, "residual-review-batches");
const usagePath = path.join(candidateRoot, "residual-review-usage.json");
const outputPath = path.join(candidateRoot, "residual-cue-review.json");
const chunkSize = Number(process.env.KNOWLEDGE_RESIDUAL_REVIEW_CHUNK_SIZE ?? 3);
const workerCount = Number(process.env.KNOWLEDGE_RESIDUAL_REVIEW_CONCURRENCY ?? 24);

async function atomicWrite(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, filePath);
}

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

function candidateKey(issue) {
  return [
    issue.qualificationVersionId,
    issue.statementId,
    issue.suggestedNodeId,
    issue.evidenceField,
    issue.evidenceIndex,
  ].join("|");
}

const ontology = JSON.parse(await readFile(ontologyPath, "utf8"));
const ontologyById = new Map(ontology.nodes.map((node) => [node.nodeId, node]));
const mappingFiles = (await readdir(mappingRoot)).filter((file) => file.endsWith(".json")).sort();
const mappings = await Promise.all(mappingFiles.map(async (file) => (
  JSON.parse(await readFile(path.join(mappingRoot, file), "utf8"))
)));
const statementIndex = new Map();
for (const mapping of mappings) {
  for (const statement of mapping.statements) {
    statementIndex.set(`${mapping.qualificationVersionId}|${statement.statementId}`, { mapping, statement });
  }
}
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const residualIssues = audit.issues.filter((issue) => (
  issue.board !== "AQA"
  && issue.matchKind === "normalized-phrase"
  && issue.score >= 7
));
const byStatement = new Map();
for (const issue of residualIssues) {
  const key = `${issue.qualificationVersionId}|${issue.statementId}`;
  const indexed = statementIndex.get(key);
  if (!indexed) throw new Error(`Missing residual statement ${key}`);
  const entries = byStatement.get(key) ?? {
    qualificationVersionId: issue.qualificationVersionId,
    board: issue.board,
    subjectCode: issue.subjectCode,
    statement: indexed.statement,
    candidates: [],
  };
  const node = ontologyById.get(issue.suggestedNodeId);
  if (!node) throw new Error(`Unknown residual node ${issue.suggestedNodeId}`);
  entries.candidates.push({
    candidateKey: candidateKey(issue),
    nodeId: issue.suggestedNodeId,
    nodeDefinition: node.definition,
    nodeAliases: node.aliases,
    nodeInclusions: node.inclusions,
    nodeExclusions: node.exclusions,
    evidenceField: issue.evidenceField,
    evidenceIndex: issue.evidenceIndex,
    evidenceText: issue.evidenceText,
    cueText: issue.cueText,
    existingNodeIds: issue.existingNodeIds,
  });
  byStatement.set(key, entries);
}
const statementItems = [...byStatement.values()];
const tasks = chunks(statementItems, chunkSize).map((items, index) => ({
  batchId: `residual-c${chunkSize}-${String(index + 1).padStart(4, "0")}`,
  items,
}));

let usage = [];
try {
  const existing = JSON.parse(await readFile(usagePath, "utf8"));
  if (Array.isArray(existing.calls)) usage = existing.calls;
} catch {
  // A new residual review starts with an empty usage journal.
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

function validate(result, task) {
  const candidateByKey = new Map(task.items.flatMap((item) => item.candidates).map((item) => [item.candidateKey, item]));
  const acceptedKeys = new Set();
  const rejectedKeys = new Set();
  const additions = [];
  for (const accepted of result.accepted ?? []) {
    const candidate = candidateByKey.get(accepted.candidateKey);
    if (!candidate) throw new Error(`${task.batchId}: accepted unknown candidate`);
    if (acceptedKeys.has(accepted.candidateKey) || rejectedKeys.has(accepted.candidateKey)) {
      throw new Error(`${task.batchId}: duplicate candidate disposition`);
    }
    if (!["exact", "broader", "narrower", "partial"].includes(accepted.relation)) {
      throw new Error(`${task.batchId}: invalid relation`);
    }
    if (!["knowledge", "application", "reasoning", "proof"].includes(accepted.assessmentDepth)) {
      throw new Error(`${task.batchId}: invalid assessment depth`);
    }
    acceptedKeys.add(accepted.candidateKey);
    const item = task.items.find((entry) => entry.candidates.some((entryCandidate) => entryCandidate.candidateKey === accepted.candidateKey));
    additions.push({
      qualificationVersionId: item.qualificationVersionId,
      statementId: item.statement.statementId,
      nodeId: candidate.nodeId,
      relation: accepted.relation,
      assessmentDepth: accepted.assessmentDepth,
      evidenceSpan: candidate.evidenceText,
      reviewNotes: [accepted.reason],
      reviewStatus: "machine-reviewed",
      reviewPass: 4,
      candidateKey: accepted.candidateKey,
    });
  }
  const rejections = [];
  for (const rejected of result.rejected ?? []) {
    if (!candidateByKey.has(rejected.candidateKey)) throw new Error(`${task.batchId}: rejected unknown candidate`);
    if (acceptedKeys.has(rejected.candidateKey) || rejectedKeys.has(rejected.candidateKey)) {
      throw new Error(`${task.batchId}: duplicate candidate disposition`);
    }
    rejectedKeys.add(rejected.candidateKey);
    rejections.push(rejected);
  }
  const unresolved = Array.isArray(result.unresolved) ? result.unresolved : [];
  const unresolvedKeys = new Set(unresolved.map((item) => item.candidateKey));
  for (const key of unresolvedKeys) {
    if (!candidateByKey.has(key)) throw new Error(`${task.batchId}: unresolved unknown candidate`);
    if (acceptedKeys.has(key) || rejectedKeys.has(key)) throw new Error(`${task.batchId}: duplicate unresolved disposition`);
  }
  const covered = new Set([...acceptedKeys, ...rejectedKeys, ...unresolvedKeys]);
  const missing = [...candidateByKey.keys()].filter((key) => !covered.has(key));
  if (missing.length) throw new Error(`${task.batchId}: omitted ${missing[0]}`);
  return { additions, rejections, unresolved };
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
    // Missing cache.
  }
  try {
    const raw = JSON.parse(await readFile(rawPath, "utf8"));
    const validated = validate(raw, task);
    const record = { schemaVersion: "1.0.0", batchId: task.batchId, status: "success", statementCount: task.items.length, ...validated };
    await atomicWrite(filePath, record);
    return record;
  } catch {
    // Invalid raw output is rerun.
  }
  const usageStart = usage.length;
  const result = await callKimi({
    label: `knowledge-v5-residual-cue-review-${task.batchId}`,
    system: [
      "You are the final high-precision reviewer of lexical concept cues in official mathematics specifications.",
      "Use only the supplied complete statement, notes, examples and candidate node semantics.",
      "Each candidate is only a lexical cue, not a presumed mapping.",
      "Accept only when the evidence explicitly assesses the candidate node definition in this exact statement.",
      "Reject prerequisites, incidental wording, examples that explicitly exclude the skill, wrong dimensions or objects, generic words, and related-but-different sibling concepts.",
      "Every candidateKey must appear exactly once in accepted, rejected or unresolved.",
      "Return strict JSON: {accepted:{candidateKey:string,relation:'exact'|'broader'|'narrower'|'partial',assessmentDepth:'knowledge'|'application'|'reasoning'|'proof',reason:string}[],rejected:{candidateKey:string,reason:string}[],unresolved:{candidateKey:string,reason:string}[]}.",
    ].join("\n"),
    input: { task: "Adjudicate every residual exact-phrase candidate.", items: task.items },
    maxTokens: 18_000,
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
  reviewStatus: "machine-reviewed",
  candidateAudit: "post-correction-concept-audit.json",
  criteria: { matchKind: "normalized-phrase", minimumScore: 7, aqaExternallyExcluded: true },
  aqaExcludedCandidateCount: audit.issues.filter((issue) => (
    issue.board === "AQA" && issue.matchKind === "normalized-phrase" && issue.score >= 7
  )).length,
  candidateCount: residualIssues.length,
  statementCount: statementItems.length,
  taskCount: tasks.length,
  completedTaskCount: completed.length,
  failureCount: failures.length,
  failures,
  additionCount: completed.reduce((total, batch) => total + batch.additions.length, 0),
  rejectionCount: completed.reduce((total, batch) => total + batch.rejections.length, 0),
  unresolvedCount: completed.reduce((total, batch) => total + batch.unresolved.length, 0),
  additions: completed.flatMap((batch) => batch.additions),
  rejections: completed.flatMap((batch) => batch.rejections),
  unresolved: completed.flatMap((batch) => batch.unresolved),
  usageSummary: {
    callCount: usage.length,
    providers: Object.fromEntries([...new Set(usage.map((call) => call.provider))].map((provider) => [
      provider,
      usage.filter((call) => call.provider === provider).length,
    ])),
    returnedModels: [...new Set(usage.map((call) => call.returnedModel))],
    promptTokens: usage.reduce((total, call) => total + (call.promptTokens ?? 0), 0),
    completionTokens: usage.reduce((total, call) => total + (call.completionTokens ?? 0), 0),
    totalTokens: usage.reduce((total, call) => total + (call.totalTokens ?? 0), 0),
  },
};
await atomicWrite(outputPath, report);
await atomicWrite(usagePath, {
  schemaVersion: "1.0.0",
  requestedPrimaryModel: KIMI_MODEL,
  reviewProvider: KIMI_FALLBACK_MODEL,
  calls: usage,
});
console.log(JSON.stringify({
  candidateCount: report.candidateCount,
  statementCount: report.statementCount,
  taskCount: report.taskCount,
  completedTaskCount: report.completedTaskCount,
  failureCount: report.failureCount,
  additionCount: report.additionCount,
  rejectionCount: report.rejectionCount,
  unresolvedCount: report.unresolvedCount,
}));
if (report.failureCount || report.unresolvedCount) process.exitCode = 1;
