import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const batch = process.argv[2];
const approvedAt = process.argv[3];
if (!batch || !/^knowledge-v4-\d{8}$/.test(batch)) {
  throw new Error("Usage: node scripts/activate-knowledge-v4.mjs knowledge-v4-YYYYMMDD YYYY-MM-DD");
}
if (!approvedAt || !/^\d{4}-\d{2}-\d{2}$/.test(approvedAt)) {
  throw new Error("An explicit ISO approval date is required.");
}

const candidateDirectory = resolve(root, "data/candidates/knowledge-v4");
const activeDirectory = resolve(root, "data/active/knowledge-v4");
const publicDirectory = resolve(root, "public/data/v3.2-new");
const reviewReport = JSON.parse(await readFile(resolve(root, "generated/knowledge-point-review-report.json"), "utf8"));
if (reviewReport.failureCount !== 0 || reviewReport.expectedCourseCount !== 21 || reviewReport.approvalEligibleCourseCount !== 21) {
  throw new Error("Point-review report is not eligible for 21-course activation.");
}

const sourceDirectory = await readdir(candidateDirectory).then(() => candidateDirectory).catch(() => activeDirectory);
const files = (await readdir(sourceDirectory)).filter((file) => file.endsWith(".json")).sort();
if (files.length !== 21) throw new Error(`Expected 21 V4 mappings, found ${files.length}.`);

const strengthByRelation = { exact: "exact", broader: "strong", narrower: "strong", partial: "partial" };
const domainNames = {
  NUM: "Number", ALGF: "Algebra and Functions", GEOM: "Geometry and Mensuration",
  CALC: "Calculus", STAT: "Statistics", PROB: "Probability", MECH: "Mechanics",
  VECT: "Vectors", DISC: "Discrete Mathematics", UNMAPPED: "Explicitly Unmapped",
};

const activeWrites = [];
const projectionWrites = [];
for (const file of files) {
  const mapping = JSON.parse(await readFile(resolve(sourceDirectory, file), "utf8"));
  if (mapping.schemaVersion !== "4.0.0") throw new Error(`${file}: unsupported schema version`);
  if (!mapping.syllabusPoints?.length || !mapping.sources?.length) throw new Error(`${file}: incomplete mapping`);
  if (mapping.reviewStatus === "owner-approved" && mapping.review?.approvalBatch !== batch) {
    throw new Error(`${file}: already approved under a different batch`);
  }
  mapping.reviewStatus = "owner-approved";
  mapping.review = {
    ...mapping.review,
    reviewedAt: mapping.review.reviewedAt ?? approvedAt,
    approvedAt,
    approvalBatch: batch,
  };
  activeWrites.push([resolve(activeDirectory, file), `${JSON.stringify(mapping, null, 2)}\n`]);

  const grouped = new Map();
  for (const point of mapping.syllabusPoints) {
    const domain = point.canonicalNodeIds[0]?.split("-")[0] ?? "UNMAPPED";
    if (!grouped.has(domain)) grouped.set(domain, []);
    const fixedPapers = point.paperApplicability.kind === "fixed" ? point.paperApplicability.papers : null;
    const eligiblePapers = point.paperApplicability.kind === "eligible" ? point.paperApplicability.papers : undefined;
    grouped.get(domain).push({
      subtopicId: point.syllabusPointId,
      subtopicName: point.sourceReference,
      description: point.unmappedReason ?? `Assessment depth: ${point.assessmentDepth}`,
      paperReference: fixedPapers,
      paperApplicabilityKind: point.paperApplicability.kind,
      ...(eligiblePapers ? { eligiblePaperReference: eligiblePapers } : {}),
      mappedNodes: point.canonicalNodeIds.map((nodeId) => ({
        nodeId,
        matchStrength: strengthByRelation[point.relation],
        matchReason: `Owner-approved V4 ${point.relation} relation; ${point.sourceReference}`,
      })),
    });
  }
  const mappings = [...grouped.entries()].map(([domain, subtopicMappings]) => ({
    topicId: `${mapping.board}-${mapping.subjectCode}-${domain}`,
    topicName: domainNames[domain] ?? domain,
    paperReference: null,
    subtopicMappings,
  }));
  const projection = {
    board: mapping.board,
    subjectCode: mapping.subjectCode,
    subjectName: mapping.subjectName,
    level: mapping.level,
    version: `4.0.0-${batch}`,
    sourceSchemaVersion: "4.0.0",
    qualificationVersionId: mapping.qualificationVersionId,
    syllabusVersion: mapping.syllabusVersion,
    effectiveFrom: mapping.effectiveFrom,
    ...(mapping.effectiveTo ? { effectiveTo: mapping.effectiveTo } : {}),
    sourceUrl: mapping.sources[0].url,
    sources: mapping.sources,
    approval: { approvedAt, approvalBatch: batch },
    verificationStatus: "verified",
    totalTopics: mappings.length,
    mappedTopics: mappings.filter((topic) => topic.subtopicMappings.some((point) => point.mappedNodes.length)).length,
    ...(mapping.declaredPapers.length ? { paperStructure: { papers: mapping.declaredPapers } } : {}),
    mappings,
  };
  projectionWrites.push([
    resolve(publicDirectory, `mapping-${mapping.board}-${mapping.subjectCode}.json`),
    `${JSON.stringify(projection, null, 2)}\n`,
  ]);
}

await mkdir(activeDirectory, { recursive: true });
for (const [path, content] of activeWrites) await writeFile(path, content);
for (const [path, content] of projectionWrites) await writeFile(path, content);
if (sourceDirectory === candidateDirectory) await rm(candidateDirectory, { recursive: true });
console.log(`Activated ${files.length} KnowledgeMappingV4 records under approval batch ${batch}.`);
