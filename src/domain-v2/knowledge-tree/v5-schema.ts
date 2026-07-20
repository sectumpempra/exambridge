import { z } from "zod";

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IsoDateTimeSchema = z.string().datetime({ offset: true });
const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const SourceEvidenceV5Schema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  documentVersion: z.string().min(1),
  locator: z.string().min(1),
  accessedAt: IsoDateSchema,
  sha256: Sha256Schema,
  pageCount: z.number().int().positive(),
  sourceType: z.literal("official"),
});

export const ContentPageRangeV5Schema = z.object({
  firstPdfPage: z.number().int().positive(),
  lastPdfPage: z.number().int().positive(),
  basis: z.literal("official-section-boundaries"),
  startEvidence: z.string().min(1),
  endEvidence: z.string().min(1),
  reviewStatus: z.literal("codex-reviewed"),
  reviewedAt: IsoDateSchema,
}).refine((range) => range.firstPdfPage <= range.lastPdfPage, {
  message: "Official content page range must not be reversed.",
  path: ["lastPdfPage"],
});

export const KnowledgeSourceManifestEntryV5Schema = z.object({
  qualificationVersionId: z.string().min(1),
  board: z.string().min(1),
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  level: z.string().min(1),
  syllabusVersion: z.string().min(1),
  effectiveFrom: IsoDateSchema,
  effectiveTo: IsoDateSchema.optional(),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().min(1),
  source: SourceEvidenceV5Schema,
  contentPageRange: ContentPageRangeV5Schema,
  localSourceKey: z.string().min(1),
}).superRefine((entry, context) => {
  if (entry.contentPageRange.lastPdfPage > entry.source.pageCount) {
    context.addIssue({ code: "custom", path: ["contentPageRange", "lastPdfPage"], message: "Official content range exceeds the PDF page count." });
  }
  if (entry.source.url !== entry.sourceUrl || entry.source.title !== entry.sourceTitle) {
    context.addIssue({ code: "custom", path: ["source"], message: "Source evidence must match the manifest URL and title." });
  }
});

export const KnowledgeSourceManifestV5Schema = z.object({
  schemaVersion: z.literal("5.0.0"),
  generatedAt: IsoDateSchema,
  pdfPolicy: z.string().min(1),
  qualificationCount: z.literal(22),
  entries: z.array(KnowledgeSourceManifestEntryV5Schema).length(22),
}).superRefine((manifest, context) => {
  const ids = manifest.entries.map((entry) => entry.qualificationVersionId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["entries"], message: "Source manifest qualification IDs must be unique." });
  }
});

export const PaperSourceReferenceV5Schema = z.object({
  sourceSha256: Sha256Schema,
  sourceUrl: z.string().url(),
  locator: z.string().min(1),
  evidenceSummary: z.string().min(1).max(500),
});

export const PaperDefinitionV5Schema = z.object({
  paperId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/),
  code: z.string().min(1),
  name: z.string().min(1),
  componentKind: z.enum(["paper", "unit", "option", "component"]),
  assessmentRole: z.enum(["mandatory", "option"]),
  tiers: z.array(z.string().min(1)),
  routes: z.array(z.string().min(1)),
  sourceReferences: z.array(PaperSourceReferenceV5Schema).min(1),
  reviewStatus: z.enum(["candidate", "codex-reviewed", "owner-approved"]),
});

export const PaperRouteV5Schema = z.object({
  routeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/),
  name: z.string().min(1),
  tiers: z.array(z.string().min(1)),
  paperIds: z.array(z.string().min(1)).min(1),
  selectionRule: z.string().min(1),
  sourceReferences: z.array(PaperSourceReferenceV5Schema).min(1),
  reviewStatus: z.enum(["candidate", "codex-reviewed", "owner-approved"]),
});

export const QualificationPaperCatalogV5Schema = z.object({
  qualificationVersionId: z.string().min(1),
  sourceSha256: Sha256Schema,
  contentAllocation: z.enum([
    "fixed-by-paper",
    "fixed-by-unit-or-option",
    "tier-filtered-shared-syllabus",
    "qualification-wide-shared-syllabus",
    "mixed",
  ]),
  contentAllocationReferences: z.array(PaperSourceReferenceV5Schema).min(1),
  papers: z.array(PaperDefinitionV5Schema).min(1),
  routes: z.array(PaperRouteV5Schema).min(1),
  reviewStatus: z.enum(["candidate", "codex-reviewed", "owner-approved"]),
}).superRefine((qualification, context) => {
  const paperIds = qualification.papers.map((paper) => paper.paperId);
  if (qualification.contentAllocationReferences.some((reference) => reference.sourceSha256 !== qualification.sourceSha256)) {
    context.addIssue({ code: "custom", path: ["contentAllocationReferences"], message: "Content-allocation evidence must use the qualification's official source hash." });
  }
  if (new Set(paperIds).size !== paperIds.length) {
    context.addIssue({ code: "custom", path: ["papers"], message: "Paper IDs must be unique within a qualification version." });
  }
  const routeIds = qualification.routes.map((route) => route.routeId);
  if (new Set(routeIds).size !== routeIds.length) {
    context.addIssue({ code: "custom", path: ["routes"], message: "Route IDs must be unique within a qualification version." });
  }
  const knownPaperIds = new Set(paperIds);
  const knownRouteIds = new Set(routeIds);
  const referencedPaperIds = new Set<string>();
  qualification.routes.forEach((route, routeIndex) => {
    if (new Set(route.paperIds).size !== route.paperIds.length) {
      context.addIssue({ code: "custom", path: ["routes", routeIndex, "paperIds"], message: "A route cannot reference the same Paper more than once." });
    }
    route.paperIds.forEach((paperId, paperIndex) => {
      referencedPaperIds.add(paperId);
      if (!knownPaperIds.has(paperId)) {
        context.addIssue({ code: "custom", path: ["routes", routeIndex, "paperIds", paperIndex], message: "Route references an unknown Paper ID." });
      }
    });
  });
  paperIds.forEach((paperId, paperIndex) => {
    if (!referencedPaperIds.has(paperId)) {
      context.addIssue({ code: "custom", path: ["papers", paperIndex, "paperId"], message: "Every declared Paper must belong to at least one qualification route." });
    }
  });
  for (const [paperIndex, paper] of qualification.papers.entries()) {
    if (new Set(paper.routes).size !== paper.routes.length) {
      context.addIssue({ code: "custom", path: ["papers", paperIndex, "routes"], message: "Paper route membership must be unique." });
    }
    paper.routes.forEach((routeId, routeIndex) => {
      if (!knownRouteIds.has(routeId)) {
        context.addIssue({ code: "custom", path: ["papers", paperIndex, "routes", routeIndex], message: "Paper references an unknown route ID." });
      }
    });
    const expectedRoutes = qualification.routes.filter((route) => route.paperIds.includes(paper.paperId)).map((route) => route.routeId).sort();
    const declaredRoutes = [...paper.routes].sort();
    if (expectedRoutes.length !== declaredRoutes.length || expectedRoutes.some((routeId, index) => routeId !== declaredRoutes[index])) {
      context.addIssue({ code: "custom", path: ["papers", paperIndex, "routes"], message: "Paper route membership must exactly match route Paper lists." });
    }
    if (paper.sourceReferences.some((reference) => reference.sourceSha256 !== qualification.sourceSha256)) {
      context.addIssue({ code: "custom", path: ["papers", paperIndex, "sourceReferences"], message: "Paper evidence must use the qualification's official source hash." });
    }
  }
  for (const [routeIndex, route] of qualification.routes.entries()) {
    if (route.sourceReferences.some((reference) => reference.sourceSha256 !== qualification.sourceSha256)) {
      context.addIssue({ code: "custom", path: ["routes", routeIndex, "sourceReferences"], message: "Route evidence must use the qualification's official source hash." });
    }
  }
});

export const KnowledgePaperCatalogV5Schema = z.object({
  schemaVersion: z.literal("5.0.0"),
  generatedAt: IsoDateSchema,
  reviewStatus: z.enum(["candidate", "codex-reviewed", "owner-approved"]),
  qualifications: z.array(QualificationPaperCatalogV5Schema).length(22),
}).superRefine((catalog, context) => {
  const qualificationIds = catalog.qualifications.map((qualification) => qualification.qualificationVersionId);
  if (new Set(qualificationIds).size !== qualificationIds.length) {
    context.addIssue({ code: "custom", path: ["qualifications"], message: "Paper catalog qualification IDs must be unique." });
  }
  if (catalog.reviewStatus === "codex-reviewed") {
    catalog.qualifications.forEach((qualification, qualificationIndex) => {
      if (qualification.reviewStatus !== "codex-reviewed"
        || qualification.papers.some((paper) => paper.reviewStatus !== "codex-reviewed")
        || qualification.routes.some((route) => route.reviewStatus !== "codex-reviewed")) {
        context.addIssue({ code: "custom", path: ["qualifications", qualificationIndex], message: "A Codex-reviewed Paper catalog may not contain candidate Paper or route records." });
      }
    });
  }
});

export const PaperApplicabilityV5Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), papers: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal("eligible"), papers: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal("not-specified") }),
]);

export const PaperApplicabilityAssignmentV5Schema = z.object({
  statementId: z.string().min(1),
  statementType: z.enum([
    "assessable-content",
    "assessment-objective",
    "exam-rule",
    "teaching-note",
    "example",
    "placeholder",
  ]),
  applicability: PaperApplicabilityV5Schema,
  rationale: z.string().min(1),
  sourceReferences: z.array(PaperSourceReferenceV5Schema),
  reviewStatus: z.enum(["candidate", "machine-reviewed", "codex-reviewed", "owner-approved"]),
}).superRefine((assignment, context) => {
  if (assignment.statementType === "assessable-content") {
    if (["codex-reviewed", "owner-approved"].includes(assignment.reviewStatus)
      && assignment.applicability.kind === "not-specified") {
      context.addIssue({ code: "custom", path: ["applicability"], message: "Reviewed assessable content requires fixed or eligible Paper applicability." });
    }
    if (assignment.applicability.kind !== "not-specified" && assignment.sourceReferences.length === 0) {
      context.addIssue({ code: "custom", path: ["sourceReferences"], message: "Paper applicability requires official assessment evidence." });
    }
  } else if (assignment.applicability.kind !== "not-specified") {
    context.addIssue({ code: "custom", path: ["applicability"], message: "Non-content records must not be assigned to assessment Papers." });
  }
});

export const QualificationPaperApplicabilityV5Schema = z.object({
  schemaVersion: z.literal("5.0.0"),
  generatedAt: IsoDateSchema,
  qualificationVersionId: z.string().min(1),
  sourceSha256: Sha256Schema,
  extractionSha256: Sha256Schema,
  paperCatalogSha256: Sha256Schema,
  declaredPapers: z.array(z.string().min(1)).min(1),
  assignments: z.array(PaperApplicabilityAssignmentV5Schema).min(1),
  reviewStatus: z.enum(["candidate", "machine-reviewed", "codex-reviewed", "owner-approved"]),
  calls: z.array(z.lazy(() => ReviewCallV5Schema)),
}).superRefine((artifact, context) => {
  const declaredPapers = new Set(artifact.declaredPapers);
  if (declaredPapers.size !== artifact.declaredPapers.length) {
    context.addIssue({ code: "custom", path: ["declaredPapers"], message: "Declared Paper IDs must be unique." });
  }
  const statementIds = artifact.assignments.map((assignment) => assignment.statementId);
  if (new Set(statementIds).size !== statementIds.length) {
    context.addIssue({ code: "custom", path: ["assignments"], message: "Paper applicability must account for each statement exactly once." });
  }
  const referencedPapers = new Set<string>();
  artifact.assignments.forEach((assignment, assignmentIndex) => {
    if (assignment.applicability.kind === "not-specified") return;
    assignment.applicability.papers.forEach((paperId, paperIndex) => {
      referencedPapers.add(paperId);
      if (!declaredPapers.has(paperId)) {
        context.addIssue({ code: "custom", path: ["assignments", assignmentIndex, "applicability", "papers", paperIndex], message: "Paper applicability references an undeclared Paper ID." });
      }
    });
    assignment.sourceReferences.forEach((reference, referenceIndex) => {
      if (reference.sourceSha256 !== artifact.sourceSha256) {
        context.addIssue({ code: "custom", path: ["assignments", assignmentIndex, "sourceReferences", referenceIndex], message: "Paper applicability evidence must use the official qualification source hash." });
      }
    });
  });
  if (["codex-reviewed", "owner-approved"].includes(artifact.reviewStatus)) {
    artifact.declaredPapers.forEach((paperId, paperIndex) => {
      if (!referencedPapers.has(paperId)) {
        context.addIssue({ code: "custom", path: ["declaredPapers", paperIndex], message: "Every declared Paper requires at least one applicable assessable statement." });
      }
    });
    artifact.assignments.forEach((assignment, assignmentIndex) => {
      if (assignment.reviewStatus !== artifact.reviewStatus) {
        context.addIssue({ code: "custom", path: ["assignments", assignmentIndex, "reviewStatus"], message: "A reviewed applicability artifact may not contain lower-review assignments." });
      }
    });
  }
});

export const ConceptLinkV5Schema = z.object({
  nodeId: z.string().min(1),
  relation: z.enum(["exact", "broader", "narrower", "partial"]),
  assessmentDepth: z.enum(["knowledge", "application", "reasoning", "proof"]),
  evidenceSpan: z.string().min(1),
  reviewNotes: z.array(z.string().min(1)),
});

export const OfficialStatementV5Schema = z.object({
  statementId: z.string().min(1),
  sectionId: z.string().min(1),
  parentSectionId: z.string().min(1).optional(),
  topicHeading: z.string().min(1),
  statementText: z.string().min(1),
  notesText: z.array(z.string().min(1)),
  examplesText: z.array(z.string().min(1)),
  statementType: z.enum([
    "assessable-content",
    "assessment-objective",
    "exam-rule",
    "teaching-note",
    "example",
    "placeholder",
  ]),
  printedPage: z.number().int().positive(),
  pdfPage: z.number().int().positive(),
  sourceLocator: z.string().min(1),
  tiers: z.array(z.string().min(1)),
  routes: z.array(z.string().min(1)),
  paperApplicability: PaperApplicabilityV5Schema,
  conceptLinks: z.array(ConceptLinkV5Schema),
  reviewStatus: z.enum(["candidate", "machine-reviewed", "codex-reviewed", "owner-approved"]),
}).superRefine((statement, context) => {
  const nodeIds = statement.conceptLinks.map((link) => link.nodeId);
  const evidenceSources = [statement.statementText, ...statement.notesText, ...statement.examplesText];
  if (new Set(nodeIds).size !== nodeIds.length) {
    context.addIssue({ code: "custom", path: ["conceptLinks"], message: "A statement cannot link the same node more than once." });
  }
  if (statement.statementType === "assessable-content" && statement.reviewStatus === "owner-approved" && statement.conceptLinks.length === 0) {
    context.addIssue({ code: "custom", path: ["conceptLinks"], message: "Owner-approved assessable content cannot remain unmapped." });
  }
  if (statement.statementType !== "assessable-content" && statement.conceptLinks.length > 0) {
    context.addIssue({ code: "custom", path: ["conceptLinks"], message: "Non-content statements must not participate in knowledge comparison." });
  }
  statement.conceptLinks.forEach((link, index) => {
    if (!evidenceSources.some((source) => source.includes(link.evidenceSpan))) {
      context.addIssue({ code: "custom", path: ["conceptLinks", index, "evidenceSpan"], message: "Concept evidence must appear in the official statement, notes or examples." });
    }
  });
});

export const ReviewCallV5Schema = z.object({
  label: z.string().min(1),
  attempt: z.number().int().positive().optional(),
  provider: z.enum(["kimi-code", "deepseek", "local"]),
  requestedModel: z.string().min(1),
  returnedModel: z.string().min(1),
  status: z.enum(["success", "fallback-triggered", "invalid-json", "http-error", "client-timeout", "network-error", "manual-review-required", "local-only"]),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  elapsedSeconds: z.number().int().nonnegative().optional(),
  requestId: z.string().min(1).optional(),
  clientRequestId: z.string().uuid().optional(),
  timeoutMs: z.number().int().min(60_000).max(1_800_000).optional(),
  fallbackReason: z.string().min(1).optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  errorType: z.string().min(1).optional(),
  errorMessage: z.string().min(1).optional(),
}).superRefine((call, context) => {
  if (call.provider === "kimi-code") {
    if (call.requestedModel !== "k3") {
      context.addIssue({ code: "custom", path: ["requestedModel"], message: "Kimi Code calls must request k3." });
    }
    const transportFailure = ["http-error", "client-timeout", "network-error"].includes(call.status);
    const allowedReturnedModels = call.status === "fallback-triggered" ? ["none"]
      : transportFailure ? ["unknown", "k3"]
        : ["k3"];
    if (!allowedReturnedModels.includes(call.returnedModel)) {
      context.addIssue({ code: "custom", path: ["returnedModel"], message: `Kimi Code ${call.status} call returned an invalid model identifier.` });
    }
    if (call.status === "fallback-triggered" && !call.fallbackReason) {
      context.addIssue({ code: "custom", path: ["fallbackReason"], message: "Fallback-triggered calls require a reason." });
    }
  }
  const transportFailure = ["http-error", "client-timeout", "network-error"].includes(call.status);
  if (call.provider === "deepseek" && (call.requestedModel !== "deepseek-v4-pro" || !(transportFailure ? ["unknown", "deepseek-v4-pro"] : ["deepseek-v4-pro"]).includes(call.returnedModel))) {
    context.addIssue({ code: "custom", path: ["returnedModel"], message: "The unified-client fallback must request and return deepseek-v4-pro." });
  }
  if (call.status === "http-error" && !call.httpStatus) {
    context.addIssue({ code: "custom", path: ["httpStatus"], message: "HTTP error provenance requires the response status code." });
  }
  if (call.status === "client-timeout" && !call.timeoutMs) {
    context.addIssue({ code: "custom", path: ["timeoutMs"], message: "Client timeout provenance requires the configured timeout." });
  }
  if (call.provider === "local" && (call.requestedModel !== "local" || call.returnedModel !== "local" || call.status !== "local-only")) {
    context.addIssue({ code: "custom", path: ["provider"], message: "Local provenance must use local models and local-only status." });
  }
});

export const ReviewProvenanceV5Schema = z.object({
  generatedAt: IsoDateSchema,
  promptVersion: z.string().min(1),
  sourceSha256: Sha256Schema,
  extractionSha256: Sha256Schema,
  treeSha256: Sha256Schema,
  ontologySha256: Sha256Schema,
  paperCatalogSha256: Sha256Schema.optional(),
  paperApplicabilitySha256: Sha256Schema.optional(),
  batchId: z.string().min(1),
  calls: z.array(ReviewCallV5Schema),
  reviewedAt: IsoDateSchema.optional(),
  approvedAt: IsoDateSchema.optional(),
  approvalBatch: z.string().min(1).optional(),
});

export const KnowledgeMappingV5Schema = z.object({
  schemaVersion: z.literal("5.0.0"),
  qualificationVersionId: z.string().min(1),
  board: z.string().min(1),
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  level: z.string().min(1),
  syllabusVersion: z.string().min(1),
  effectiveFrom: IsoDateSchema,
  effectiveTo: IsoDateSchema.optional(),
  sources: z.array(SourceEvidenceV5Schema).min(1),
  declaredPapers: z.array(z.string().min(1)).min(1),
  statements: z.array(OfficialStatementV5Schema).min(1),
  reviewStatus: z.enum(["candidate", "machine-reviewed", "codex-reviewed", "owner-approved", "rejected"]),
  review: ReviewProvenanceV5Schema,
}).superRefine((mapping, context) => {
  if (mapping.effectiveTo && mapping.effectiveTo < mapping.effectiveFrom) {
    context.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo precedes effectiveFrom." });
  }
  const statementIds = mapping.statements.map((statement) => statement.statementId);
  if (new Set(statementIds).size !== statementIds.length) {
    context.addIssue({ code: "custom", path: ["statements"], message: "statementId values must be unique within a qualification version." });
  }
  const declaredPaperIds = new Set(mapping.declaredPapers);
  if (declaredPaperIds.size !== mapping.declaredPapers.length) {
    context.addIssue({ code: "custom", path: ["declaredPapers"], message: "declaredPapers values must be unique." });
  }
  const referencedPaperIds = new Set<string>();
  mapping.statements.forEach((statement, statementIndex) => {
    if (statement.paperApplicability.kind === "not-specified") {
      if (["codex-reviewed", "owner-approved"].includes(mapping.reviewStatus) && statement.statementType === "assessable-content") {
        context.addIssue({ code: "custom", path: ["statements", statementIndex, "paperApplicability"], message: "Reviewed assessable content requires fixed or eligible Paper applicability." });
      }
      return;
    }
    statement.paperApplicability.papers.forEach((paperId, paperIndex) => {
      referencedPaperIds.add(paperId);
      if (!declaredPaperIds.has(paperId)) {
        context.addIssue({ code: "custom", path: ["statements", statementIndex, "paperApplicability", "papers", paperIndex], message: "Paper applicability references an undeclared Paper ID." });
      }
    });
  });
  if (["codex-reviewed", "owner-approved"].includes(mapping.reviewStatus)) {
    mapping.declaredPapers.forEach((paperId, paperIndex) => {
      if (!referencedPaperIds.has(paperId)) {
        context.addIssue({ code: "custom", path: ["declaredPapers", paperIndex], message: "Every declared Paper requires at least one applicable statement." });
      }
    });
  }
  const sourceHashes = new Set(mapping.sources.map((source) => source.sha256));
  if (!sourceHashes.has(mapping.review.sourceSha256)) {
    context.addIssue({ code: "custom", path: ["review", "sourceSha256"], message: "Review source hash must match a declared official source." });
  }
  if (mapping.board === "AQA" && mapping.review.calls.some((call) => call.provider !== "local")) {
    context.addIssue({ code: "custom", path: ["review", "calls"], message: "AQA source content must remain local-only." });
  }
  if (["codex-reviewed", "owner-approved"].includes(mapping.reviewStatus) && !mapping.review.reviewedAt) {
    context.addIssue({ code: "custom", path: ["review", "reviewedAt"], message: "Codex-reviewed mappings require review provenance." });
  }
  if (mapping.reviewStatus === "owner-approved" && (!mapping.review.approvedAt || !mapping.review.approvalBatch)) {
    context.addIssue({ code: "custom", path: ["review"], message: "Owner-approved mappings require approval provenance." });
  }
});

export const CanonicalNodeSemanticsV5Schema = z.object({
  nodeId: z.string().min(1),
  definition: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  dimension: z.enum(["2d", "3d", "mixed", "not-applicable"]),
  objectScopes: z.array(z.string().min(1)),
  inclusions: z.array(z.string().min(1)),
  exclusions: z.array(z.string().min(1)),
  semanticClass: z.enum(["mathematical-knowledge", "mathematical-practice", "assessment-rule"]),
  comparisonEligible: z.boolean(),
  reviewStatus: z.enum(["candidate", "codex-reviewed", "owner-approved"]),
});

export const KnowledgeOntologyV5Schema = z.object({
  schemaVersion: z.literal("5.0.0"),
  treeVersion: z.string().min(1),
  treeSha256: Sha256Schema,
  generatedAt: IsoDateSchema,
  reviewStatus: z.enum(["candidate", "codex-reviewed", "owner-approved"]),
  nodes: z.array(CanonicalNodeSemanticsV5Schema).min(1),
});

export const ComparisonGoldPairV5Schema = z.object({
  pairId: z.string().min(1),
  semanticCase: z.enum([
    "synonymous-expression",
    "same-word-different-meaning",
    "broader-narrower",
    "partial-overlap",
    "dimension-scope",
    "tier-route-paper-scope",
    "knowledge-vs-assessment-rule",
  ]),
  qualificationVersionIdA: z.string().min(1),
  statementIdA: z.string().min(1),
  qualificationVersionIdB: z.string().min(1),
  statementIdB: z.string().min(1),
  expectedStatus: z.enum(["shared", "partial", "exclusive", "non-comparable"]),
  rationale: z.string().min(1),
  evidence: z.array(z.object({ sourceLocator: z.string().min(1), sourceSha256: Sha256Schema })).min(2),
  reviewStatus: z.enum(["candidate", "codex-reviewed", "owner-approved"]),
});

export const KnowledgeGoldSetV5Schema = z.object({
  schemaVersion: z.literal("5.0.0"),
  generatedAt: IsoDateSchema,
  reviewStatus: z.enum(["candidate", "codex-reviewed", "owner-approved"]),
  pairs: z.array(ComparisonGoldPairV5Schema).min(200),
}).superRefine((gold, context) => {
  const pairIds = new Set<string>();
  const statementPairs = new Set<string>();
  for (const [index, pair] of gold.pairs.entries()) {
    if (pairIds.has(pair.pairId)) {
      context.addIssue({ code: "custom", path: ["pairs", index, "pairId"], message: "Gold pair IDs must be unique." });
    }
    pairIds.add(pair.pairId);
    const references = [
      `${pair.qualificationVersionIdA}:${pair.statementIdA}`,
      `${pair.qualificationVersionIdB}:${pair.statementIdB}`,
    ].sort();
    const statementPairKey = references.join("<->");
    if (statementPairs.has(statementPairKey)) {
      context.addIssue({ code: "custom", path: ["pairs", index], message: "Gold statement pairs must be unique." });
    }
    statementPairs.add(statementPairKey);
  }
});

export const CodexStatementDispositionV5Schema = z.object({
  statementId: z.string().min(1),
  decision: z.enum(["approve-machine", "correct", "confirm-non-comparable"]),
  finalStatementText: z.string().min(1),
  finalNotesText: z.array(z.string().min(1)),
  finalExamplesText: z.array(z.string().min(1)),
  textFidelity: z.enum(["pending", "verified-text-layer", "verified-visual", "corrected-after-visual"]),
  finalConceptLinks: z.array(ConceptLinkV5Schema),
  reviewNotes: z.array(z.string().min(1)).min(1),
});

export const CodexMachineIssueDispositionV5Schema = z.object({
  issue: z.string().min(1),
  decision: z.enum(["pending", "resolved-in-final-disposition", "confirmed-non-issue"]),
  reviewNotes: z.array(z.string().min(1)).min(1),
});

export const CodexSourceLineDispositionV5Schema = z.object({
  lineId: z.string().regex(/^p\d+-r\d+-b\d+-l\d+$/),
  pdfPage: z.number().int().positive(),
  decision: z.enum([
    "exclude-page-furniture",
    "exclude-section-heading",
    "exclude-non-content-context",
    "requires-statement",
  ]),
  reviewNotes: z.array(z.string().min(1)).min(1),
});

export const CodexSourceAccountingV5Schema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("coordinate-lines"),
    reviewStatus: z.enum(["candidate", "codex-reviewed"]),
    sourceLineCount: z.number().int().nonnegative(),
    accountedLineCount: z.number().int().nonnegative(),
    unaccountedLineCount: z.number().int().nonnegative(),
    dispositions: z.array(CodexSourceLineDispositionV5Schema),
  }).superRefine((accounting, context) => {
    const lineIds = accounting.dispositions.map((disposition) => disposition.lineId);
    if (new Set(lineIds).size !== lineIds.length) {
      context.addIssue({ code: "custom", path: ["dispositions"], message: "Source-line dispositions must have unique line IDs." });
    }
    if (accounting.dispositions.length !== accounting.unaccountedLineCount) {
      context.addIssue({ code: "custom", path: ["dispositions"], message: "Every unaccounted source line requires a disposition." });
    }
    if (accounting.sourceLineCount !== accounting.accountedLineCount + accounting.unaccountedLineCount) {
      context.addIssue({ code: "custom", path: ["sourceLineCount"], message: "Source-line accounting counts do not balance." });
    }
    if (accounting.reviewStatus === "codex-reviewed" && accounting.dispositions.some((disposition) => disposition.decision === "requires-statement")) {
      context.addIssue({ code: "custom", path: ["dispositions"], message: "Codex-reviewed source accounting cannot retain missing statements." });
    }
  }),
  z.object({
    method: z.literal("official-references"),
    reviewStatus: z.enum(["candidate", "codex-reviewed"]),
    officialReferenceCount: z.number().int().positive(),
    accountedReferenceCount: z.number().int().nonnegative(),
    missingReferences: z.array(z.string().min(1)),
    unexpectedReferences: z.array(z.string().min(1)),
  }).superRefine((accounting, context) => {
    if (accounting.reviewStatus === "codex-reviewed"
      && (accounting.officialReferenceCount !== accounting.accountedReferenceCount
        || accounting.missingReferences.length > 0
        || accounting.unexpectedReferences.length > 0)) {
      context.addIssue({ code: "custom", path: [], message: "Codex-reviewed official-reference accounting must be complete." });
    }
  }),
]);

export const CodexQualificationReviewV5Schema = z.object({
  schemaVersion: z.literal("5.0.0"),
  qualificationVersionId: z.string().min(1),
  sourceSha256: Sha256Schema,
  reviewedAt: IsoDateSchema,
  reviewer: z.literal("codex"),
  reviewStatus: z.enum(["candidate", "codex-reviewed"]),
  sourceAccounting: CodexSourceAccountingV5Schema,
  machineIssueDispositions: z.array(CodexMachineIssueDispositionV5Schema),
  dispositions: z.array(CodexStatementDispositionV5Schema).min(1),
}).superRefine((review, context) => {
  const statementIds = review.dispositions.map((disposition) => disposition.statementId);
  if (new Set(statementIds).size !== statementIds.length) {
    context.addIssue({ code: "custom", path: ["dispositions"], message: "Codex review dispositions must have unique statement IDs." });
  }
  if (review.reviewStatus === "codex-reviewed" && review.dispositions.some((disposition) => disposition.textFidelity === "pending")) {
    context.addIssue({ code: "custom", path: ["dispositions"], message: "Codex-reviewed dispositions cannot retain pending source-text fidelity." });
  }
  if (review.reviewStatus === "codex-reviewed" && review.sourceAccounting.reviewStatus !== "codex-reviewed") {
    context.addIssue({ code: "custom", path: ["sourceAccounting"], message: "Codex-reviewed qualification requires completed source accounting." });
  }
  const machineIssues = review.machineIssueDispositions.map((disposition) => disposition.issue);
  if (new Set(machineIssues).size !== machineIssues.length) {
    context.addIssue({ code: "custom", path: ["machineIssueDispositions"], message: "Machine issue dispositions must be unique." });
  }
  if (review.reviewStatus === "codex-reviewed" && review.machineIssueDispositions.some((disposition) => disposition.decision === "pending")) {
    context.addIssue({ code: "custom", path: ["machineIssueDispositions"], message: "Codex-reviewed qualification cannot retain pending machine issues." });
  }
});

export const TextFidelityRiskV5Schema = z.enum([
  "manual-visual-required",
  "visual-review-recommended",
  "text-layer-check-eligible",
]);

const TextFidelityRiskCountsV5Schema = z.partialRecord(
  TextFidelityRiskV5Schema,
  z.number().int().nonnegative(),
);
const TEXT_FIDELITY_RISKS = TextFidelityRiskV5Schema.options;

export const TextFidelityStatementV5Schema = z.object({
  statementId: z.string().min(1),
  pdfPage: z.number().int().positive(),
  sourceLocator: z.string().min(1),
  risk: TextFidelityRiskV5Schema,
  reasons: z.array(z.string().min(1)),
  relevantFonts: z.array(z.string().min(1)),
});

export const TextFidelityQualificationV5Schema = z.object({
  qualificationVersionId: z.string().min(1),
  localSourceKey: z.string().min(1),
  sourceSha256: Sha256Schema,
  mappingSha256: Sha256Schema,
  statementCount: z.number().int().nonnegative(),
  riskCounts: TextFidelityRiskCountsV5Schema,
  statements: z.array(TextFidelityStatementV5Schema),
}).superRefine((qualification, context) => {
  const statementIds = qualification.statements.map((statement) => statement.statementId);
  if (new Set(statementIds).size !== statementIds.length) {
    context.addIssue({ code: "custom", path: ["statements"], message: "Text fidelity statement IDs must be unique." });
  }
  if (qualification.statementCount !== qualification.statements.length) {
    context.addIssue({ code: "custom", path: ["statementCount"], message: "Text fidelity statement count does not match its records." });
  }
  for (const risk of TEXT_FIDELITY_RISKS) {
    const actual = qualification.statements.filter((statement) => statement.risk === risk).length;
    if ((qualification.riskCounts[risk] ?? 0) !== actual) {
      context.addIssue({ code: "custom", path: ["riskCounts", risk], message: `Text fidelity ${risk} count does not match its records.` });
    }
  }
});

export const TextFidelityReportV5Schema = z.object({
  schemaVersion: z.literal("5.0.0"),
  generatedAt: IsoDateTimeSchema,
  method: z.literal("local-pdf-font-and-text-layer-triage"),
  policy: z.object({
    manualVisualRequired: z.string().min(1),
    visualReviewRecommended: z.string().min(1),
    textLayerCheckEligible: z.string().min(1),
  }),
  mappingCount: z.number().int().nonnegative(),
  statementCount: z.number().int().nonnegative(),
  riskCounts: TextFidelityRiskCountsV5Schema,
  failureCount: z.number().int().nonnegative(),
  failures: z.array(z.string().min(1)),
  qualifications: z.array(TextFidelityQualificationV5Schema),
}).superRefine((report, context) => {
  const qualificationIds = report.qualifications.map((qualification) => qualification.qualificationVersionId);
  if (new Set(qualificationIds).size !== qualificationIds.length) {
    context.addIssue({ code: "custom", path: ["qualifications"], message: "Text fidelity qualification IDs must be unique." });
  }
  if (report.mappingCount !== report.qualifications.length) {
    context.addIssue({ code: "custom", path: ["mappingCount"], message: "Text fidelity mapping count does not match its records." });
  }
  const statementCount = report.qualifications.reduce((sum, qualification) => sum + qualification.statementCount, 0);
  if (report.statementCount !== statementCount) {
    context.addIssue({ code: "custom", path: ["statementCount"], message: "Text fidelity statement count does not match its qualifications." });
  }
  if (report.failureCount !== report.failures.length) {
    context.addIssue({ code: "custom", path: ["failureCount"], message: "Text fidelity failure count does not match its records." });
  }
  for (const risk of TEXT_FIDELITY_RISKS) {
    const actual = report.qualifications.reduce((sum, qualification) => sum + (qualification.riskCounts[risk] ?? 0), 0);
    if ((report.riskCounts[risk] ?? 0) !== actual) {
      context.addIssue({ code: "custom", path: ["riskCounts", risk], message: `Text fidelity ${risk} total does not match its qualifications.` });
    }
  }
});

export type KnowledgeMappingV5 = z.infer<typeof KnowledgeMappingV5Schema>;
export type KnowledgeSourceManifestV5 = z.infer<typeof KnowledgeSourceManifestV5Schema>;
export type KnowledgePaperCatalogV5 = z.infer<typeof KnowledgePaperCatalogV5Schema>;
export type QualificationPaperCatalogV5 = z.infer<typeof QualificationPaperCatalogV5Schema>;
export type PaperDefinitionV5 = z.infer<typeof PaperDefinitionV5Schema>;
export type PaperApplicabilityAssignmentV5 = z.infer<typeof PaperApplicabilityAssignmentV5Schema>;
export type QualificationPaperApplicabilityV5 = z.infer<typeof QualificationPaperApplicabilityV5Schema>;
export type OfficialStatementV5 = z.infer<typeof OfficialStatementV5Schema>;
export type ConceptLinkV5 = z.infer<typeof ConceptLinkV5Schema>;
export type CanonicalNodeSemanticsV5 = z.infer<typeof CanonicalNodeSemanticsV5Schema>;
export type ComparisonGoldPairV5 = z.infer<typeof ComparisonGoldPairV5Schema>;
export type CodexStatementDispositionV5 = z.infer<typeof CodexStatementDispositionV5Schema>;
export type CodexQualificationReviewV5 = z.infer<typeof CodexQualificationReviewV5Schema>;
export type CodexSourceAccountingV5 = z.infer<typeof CodexSourceAccountingV5Schema>;
export type TextFidelityReportV5 = z.infer<typeof TextFidelityReportV5Schema>;
export type TextFidelityRiskV5 = z.infer<typeof TextFidelityRiskV5Schema>;
