import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

async function correctEdexcel9MA0() {
  const candidatePath = resolve(root, "data/candidates/knowledge-v4/Edexcel-9MA0.json");
  const reviewPath = resolve(root, "data/candidates/knowledge-v4-reviews/Edexcel-9MA0.json");
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  const review = JSON.parse(await readFile(reviewPath, "utf8"));
  const source = candidate.sources[0];
  const evidence = (locator) => [{ ...source, locator }];
  const mechanicsPoints = [
    ["6.1", "p.40, Topic 6 Quantities and units in mechanics, 6.1", [], "No dedicated canonical leaf represents the full SI quantities-and-units requirement for mechanics."],
    ["7.1", "p.41, Topic 7 Kinematics, 7.1", ["MECH-KIN-LINE-DIST", "MECH-KIN-LINE-SPED", "MECH-KIN-LINE-ACCL"]],
    ["7.2", "p.41, Topic 7 Kinematics, 7.2", ["MECH-KIN-LINE-STGR", "MECH-KIN-LINE-VTGR", "MECH-KIN-LINE-AREA"]],
    ["7.3", "p.41, Topic 7 Kinematics, 7.3", ["MECH-KIN-LINE-CONST", "VECT-BASIC-NOTN-ADDS", "VECT-BASIC-NOTN-SCAL"]],
    ["7.4", "p.41, Topic 7 Kinematics, 7.4", ["CALC-KIN-SVAT-DSDT", "CALC-KIN-SVAT-DVDT", "CALC-KIN-SVAT-INTV", "CALC-KIN-SVAT-INTS"]],
    ["7.5", "p.41, Topic 7 Kinematics, 7.5", ["MECH-DYN-NEWT-VERT", "MECH-FURT-PROJ-MODEL", "MECH-FURT-PROJ-HV"]],
    ["8.1", "p.41, Topic 8 Forces and Newton's laws, 8.1", ["MECH-FORC-FORC-VECN"], "The force concept is represented broadly; the ontology has no dedicated Newton's first-law leaf."],
    ["8.2", "p.41, Topic 8 Forces and Newton's laws, 8.2", ["MECH-DYN-NEWT-N2L", "MECH-FORC-EQUI-RESV"]],
    ["8.3", "p.41, Topic 8 Forces and Newton's laws, 8.3", ["MECH-DYN-NEWT-MASS", "MECH-DYN-NEWT-VERT"]],
    ["8.4", "p.42, Topic 8 Forces and Newton's laws, 8.4", ["MECH-FORC-EQUI-N3L", "MECH-FORC-EQUI-PRIN", "MECH-DYN-NEWT-CONP", "MECH-FORC-EQUI-RESV"]],
    ["8.5", "p.42, Topic 8 Forces and Newton's laws, 8.5", ["MECH-FORC-FORC-COMP", "MECH-FORC-FORC-RESL", "MECH-DYN-NEWT-N2L"]],
    ["8.6", "p.42, Topic 8 Forces and Newton's laws, 8.6", ["MECH-FORC-EQUI-FRIC", "MECH-FORC-EQUI-LIMF", "MECH-FORC-EQUI-COEF"]],
    ["9.1", "p.42, Topic 9 Moments, 9.1", ["MECH-FURT-RIGD-MOMT", "MECH-FURT-RIGD-RBAL"]],
  ];

  const parametric = candidate.syllabusPoints.find((point) => point.syllabusPointId === "OFFICIAL-9MA0-3.4");
  if (parametric) {
    parametric.paperApplicability = { kind: "eligible", papers: ["Paper 1", "Paper 2", "Paper 3"], evidence: evidence(parametric.sourceReference) };
    parametric.reviewNotes = [...new Set([...(parametric.reviewNotes ?? []), "Paper 3 eligibility added for the explicit kinematics cross-reference."])];
  }

  const existingPointIds = new Set(candidate.syllabusPoints.map((point) => point.syllabusPointId));
  for (const [code, sourceReference, canonicalNodeIds, unmappedReason] of mechanicsPoints) {
    const syllabusPointId = `OFFICIAL-Edexcel-9MA0-P3-M${code}`;
    if (existingPointIds.has(syllabusPointId)) continue;
    candidate.syllabusPoints.push({
      syllabusPointId,
      sourceReference,
      canonicalNodeIds,
      ...(canonicalNodeIds.length ? {} : { unmappedReason }),
      relation: "partial",
      assessmentDepth: code === "8.1" ? "knowledge" : "application",
      paperApplicability: { kind: "fixed", papers: ["Paper 3"], evidence: evidence(sourceReference) },
      reviewNotes: [unmappedReason ?? "Codex restored the omitted official Mechanics point using the page-cited specification and existing canonical nodes."],
    });
  }

  const parametricReview = review.pointReviews.find((row) => row.syllabusPointId === "OFFICIAL-9MA0-3.4");
  if (parametricReview) Object.assign(parametricReview, {
    status: "pass", nodeFit: "exact", paperAllocationSupported: true, issues: [],
    recommendation: "Retain corrected eligible allocation across Papers 1, 2 and 3.",
  });
  const existingReviewIds = new Set(review.pointReviews.map((row) => row.syllabusPointId));
  for (const [code, , canonicalNodeIds] of mechanicsPoints) {
    const syllabusPointId = `OFFICIAL-Edexcel-9MA0-P3-M${code}`;
    if (existingReviewIds.has(syllabusPointId)) continue;
    const weak = canonicalNodeIds.length === 0 || code === "8.1";
    review.pointReviews.push({
      syllabusPointId,
      status: weak ? "warning" : "pass",
      sourceSupported: true,
      nodeFit: canonicalNodeIds.length ? (weak ? "weak" : "acceptable") : "unmapped",
      paperAllocationSupported: true,
      issues: weak ? ["Ontology granularity is broader than this official point; the limitation is explicitly recorded."] : [],
      recommendation: weak ? "Retain as a documented partial/unmapped representation." : "Retain restored mapping.",
    });
  }
  review.missingOfficialPoints = (review.missingOfficialPoints ?? []).filter((entry) => !/Topic (6|7|8|9)\b/.test(entry.sourceReference));
  review.overallIssues = (review.overallIssues ?? []).filter((issue) => issue.severity !== "high");
  review.codexCorrections = [
    ...(review.codexCorrections ?? []),
    {
      action: "restored-omitted-mechanics-and-fixed-paper-allocation",
      affectedPointIds: ["OFFICIAL-9MA0-3.4", ...mechanicsPoints.map(([code]) => `OFFICIAL-Edexcel-9MA0-P3-M${code}`)],
      reason: "Independent completeness review identified the omitted Paper 3 Mechanics section and unsupported P1/P2-only parametric allocation.",
    },
  ];
  await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
}

async function correctEdexcel9FM0() {
  const candidatePath = resolve(root, "data/candidates/knowledge-v4/Edexcel-9FM0.json");
  const reviewPath = resolve(root, "data/candidates/knowledge-v4-reviews/Edexcel-9FM0.json");
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  const review = JSON.parse(await readFile(reviewPath, "utf8"));
  const missingFp2 = [
    ["3.2", "p.27 3.2", ["ALGF-MATR-EIG-DIAG"]],
    ["3.3", "p.27 3.3", ["ALGF-MATR-CAYL-THEO", "ALGF-MATR-CAYL-APPL"]],
    ["4.1", "p.28 4.1", ["ALGF-CPLX-ROOT-LOCI"]],
    ["4.2", "p.28 4.2", [], "No canonical leaf represents elementary z-plane to w-plane transformations."],
    ["5.1", "p.28 5.1", ["NUM-SYS-TYPE-FACT"], "Division and the Euclidean algorithm are represented only by the broader factors concept; congruences have no dedicated leaf."],
    ["5.2", "p.28 5.2", [], "No canonical leaf represents Bezout's identity."],
    ["5.3", "p.28 5.3", [], "No canonical leaf represents modular arithmetic and congruence properties."],
    ["5.4", "p.28 5.4", [], "No canonical leaf represents Fermat's Little Theorem."],
    ["5.5", "p.29 5.5", ["NUM-SYS-TYPE-FACT"], "Divisibility tests are represented by the broader factors concept."],
    ["5.6", "p.29 5.6", [], "No canonical leaf represents congruence equations."],
    ["5.7", "p.29 5.7", ["PROB-COMB-COUNT-PERM", "PROB-COMB-COUNT-COMB"]],
    ["6.1", "p.29 6.1", ["ALGF-SEQ-SEQU-TERM"], "First- and second-order recurrence relations are represented by the broader term-to-term sequence rule."],
    ["6.2", "p.29 6.2", ["ALGF-SEQ-SEQU-NTH"], "Closed forms for recurrences are represented by the broader nth-term concept."],
    ["6.3", "p.29 6.3", ["REAS-PROF-PROF-DEDU"], "Proof by induction is represented only by the broader proof-by-deduction concept."],
  ];
  const source = candidate.sources[0];
  const existingPointIds = new Set(candidate.syllabusPoints.map((point) => point.syllabusPointId));
  for (const [code, sourceReference, canonicalNodeIds, granularityNote] of missingFp2) {
    const syllabusPointId = `OFFICIAL-Edexcel-9FM0-FP2-${code}`;
    if (existingPointIds.has(syllabusPointId)) continue;
    candidate.syllabusPoints.push({
      syllabusPointId,
      sourceReference,
      canonicalNodeIds,
      ...(canonicalNodeIds.length ? {} : { unmappedReason: granularityNote }),
      relation: "partial",
      assessmentDepth: code === "6.3" ? "proof" : "application",
      paperApplicability: { kind: "not-specified" },
      reviewNotes: [granularityNote ?? "Codex restored the omitted page-cited Further Pure Mathematics 2 point using existing canonical nodes."],
    });
  }

  for (const point of candidate.syllabusPoints) {
    const isFs1 = point.syllabusPointId.includes("-FS1-");
    const isFm1 = point.syllabusPointId.includes("-FM1-");
    if (!isFs1 && !isFm1) continue;
    if (point.paperApplicability?.kind === "eligible") {
      point.paperApplicability.papers = point.paperApplicability.papers.filter((paper) => isFs1
        ? !/Further Statistics 2/.test(paper)
        : !/Further Mechanics 2/.test(paper));
      point.paperApplicability.evidence = [{ ...source, locator: point.sourceReference }];
    }
  }

  for (const row of review.pointReviews) {
    if (row.status === "fail" && (row.syllabusPointId.includes("-FS1-") || row.syllabusPointId.includes("-FM1-"))) {
      Object.assign(row, {
        status: "warning", paperAllocationSupported: true,
        issues: ["Option-paper allocation was corrected; any remaining warning concerns ontology granularity only."],
        recommendation: "Retain corrected option allocation.",
      });
    }
  }
  const existingReviewIds = new Set(review.pointReviews.map((row) => row.syllabusPointId));
  for (const [code, , canonicalNodeIds, granularityNote] of missingFp2) {
    const syllabusPointId = `OFFICIAL-Edexcel-9FM0-FP2-${code}`;
    if (existingReviewIds.has(syllabusPointId)) continue;
    const weak = Boolean(granularityNote);
    review.pointReviews.push({
      syllabusPointId,
      status: weak ? "warning" : "pass",
      sourceSupported: true,
      nodeFit: canonicalNodeIds.length ? (weak ? "weak" : "acceptable") : "unmapped",
      paperAllocationSupported: true,
      issues: weak ? [granularityNote] : [],
      recommendation: weak ? "Retain as a documented partial/unmapped representation." : "Retain restored mapping.",
    });
  }
  review.missingOfficialPoints = [];
  review.overallIssues = (review.overallIssues ?? []).filter((issue) => issue.severity !== "high");
  review.codexCorrections = [
    ...(review.codexCorrections ?? []),
    {
      action: "restored-fp2-and-corrected-option-papers",
      affectedPointIds: [
        ...missingFp2.map(([code]) => `OFFICIAL-Edexcel-9FM0-FP2-${code}`),
        ...candidate.syllabusPoints.filter((point) => point.syllabusPointId.includes("-FS1-") || point.syllabusPointId.includes("-FM1-")).map((point) => point.syllabusPointId),
      ],
      reason: "Completeness review identified omitted FP2 pages 27-29 and FS1/FM1 allocations that incorrectly included the second option.",
    },
    {
      action: "excluded-formula-sheet-repetitions",
      sourceReference: "pp.61-62",
      reason: "The formula list repeats supporting formulae and is not a separate set of assessable syllabus points.",
    },
  ];
  await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
}

await correctEdexcel9MA0();
await correctEdexcel9FM0();
console.log("Applied Codex-reviewed knowledge mapping corrections.");
