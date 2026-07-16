import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const desktop = "/Users/yuzhou/Desktop/数学考纲";
const python = "/Users/yuzhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const outputDirectory = resolve(root, "data/candidates/knowledge-v4");
const reviewDirectory = resolve(root, "data/candidates/knowledge-v4-reviews");
const generatedAt = "2026-07-16";
const configs = {
  "AQA-7357": { file: "AQA-7357-A-Level-Mathematics.pdf", version: "1.3", effectiveFrom: "2017-09-01", pages: [11, 25], pattern: "(?:OT[123]\\.\\d+|[A-S]\\d+)", url: "https://www.aqa.org.uk/subjects/mathematics/a-level/mathematics-7357/specification/subject-content", title: "AQA A-level Mathematics 7357 specification" },
  "AQA-7367": { file: "AQA-7367-A-Level-Further-Mathematics.pdf", version: "1.1", effectiveFrom: "2017-09-01", pages: [11, 32], pattern: "(?:OT[123]\\.\\d+|[A-J]\\d+|M[A-E]\\d+|S[A-H]\\d+|D[A-G]\\d+)", url: "https://www.aqa.org.uk/subjects/mathematics/a-level/mathematics-7367/specification/subject-content/compulsory-content", title: "AQA A-level Further Mathematics 7367 specification" },
  "AQA-8300": { file: "AQA-8300-GCSE-Mathematics.pdf", version: "1.0", effectiveFrom: "2015-09-01", pages: [9, 36], pattern: "(?:N|A|R|G|P|S)\\d+", url: "https://www.aqa.org.uk/subjects/mathematics/gcse/mathematics-8300/specification", title: "AQA GCSE Mathematics 8300 specification" },
  "AQA-8365": { file: "AQA-8365-GCSE-Further-Mathematics.pdf", version: "1.4", effectiveFrom: "2018-09-01", pages: [6, 14], pattern: "[1-6]\\.\\d+", url: "https://www.aqa.org.uk/subjects/mathematics/aqa-certificate/mathematics-8365/specification", title: "AQA Level 2 Further Mathematics 8365 specification" },
};

const stopWords = new Set("a an and are as at be by content find for from given in including into is it know of on or the their to understand use using where which with work".split(" "));
const synonyms = new Map(Object.entries({
  quadratics: "quadratic", equations: "equation", inequalities: "inequality", functions: "function", transformations: "transformation",
  fractions: "fraction", decimals: "decimal", percentages: "percentage", coordinates: "coordinate", gradients: "gradient",
  matrices: "matrix", vectors: "vector", logarithms: "logarithm", exponentials: "exponential", distributions: "distribution",
  probabilities: "probability", sequences: "sequence", series: "series", circles: "circle", tangents: "tangent", normals: "normal",
  derivatives: "derivative", integrals: "integral", graphs: "graph", roots: "root", polynomials: "polynomial", angles: "angle",
}));
function tokens(value) {
  return new Set((String(value).toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) ?? [])
    .map((token) => synonyms.get(token) ?? token.replace(/s$/, ""))
    .filter((token) => !stopWords.has(token)));
}
function overlap(left, right) {
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / Math.min(left.size, right.size);
}

const rootIds = {
  "Number": "NUM", "Algebra and Functions": "ALGF", "Geometry and Mensuration": "GEOM", Trigonometry: "TRIG",
  Calculus: "CALC", Vectors: "VECT", "Probability and Distributions": "PROB", Statistics: "STAT",
  Mechanics: "MECH", "Discrete and Decision Mathematics": "DISC", "Numerical Methods": "NUMM", "Mathematical Reasoning and Modelling": "REAS",
};
function expectedDomains(id, reference) {
  if (reference.startsWith("OT")) return ["Mathematical Reasoning and Modelling"];
  if (id === "AQA-8300") return ({ N: ["Number"], A: ["Algebra and Functions"], R: ["Number"], G: ["Geometry and Mensuration", "Trigonometry"], P: ["Probability and Distributions"], S: ["Statistics"] })[reference[0]] ?? [];
  if (id === "AQA-8365") return ({ "1": ["Number"], "2": ["Algebra and Functions"], "3": ["Geometry and Mensuration"], "4": ["Calculus"], "5": ["Algebra and Functions", "Vectors"], "6": ["Trigonometry"] })[reference[0]] ?? [];
  if (id === "AQA-7357") return ({ A: ["Mathematical Reasoning and Modelling"], B: ["Algebra and Functions"], C: ["Geometry and Mensuration"], D: ["Algebra and Functions"], E: ["Trigonometry"], F: ["Algebra and Functions"], G: ["Calculus"], H: ["Calculus"], I: ["Numerical Methods"], J: ["Vectors"], K: ["Statistics"], L: ["Statistics"], M: ["Probability and Distributions"], N: ["Probability and Distributions"], O: ["Statistics"], P: ["Mechanics"], Q: ["Mechanics"], R: ["Mechanics"], S: ["Mechanics"] })[reference[0]] ?? [];
  if (/^M[A-E]/.test(reference)) return ["Mechanics"];
  if (/^S[A-H]/.test(reference)) return ["Probability and Distributions", "Statistics"];
  if (/^D[A-G]/.test(reference)) return ["Discrete and Decision Mathematics"];
  return ({ A: ["Mathematical Reasoning and Modelling"], B: ["Algebra and Functions"], C: ["Algebra and Functions", "Vectors"], D: ["Algebra and Functions"], E: ["Calculus"], F: ["Vectors"], G: ["Geometry and Mensuration"], H: ["Calculus"], I: ["Calculus"], J: ["Numerical Methods"] })[reference[0]] ?? [];
}

async function extractPages(file, start, end) {
  const program = [
    "import json,sys",
    "from pypdf import PdfReader",
    "r=PdfReader(sys.argv[1])",
    "a=int(sys.argv[2]); b=int(sys.argv[3])",
    "pages=[{'page':i+1,'text':(r.pages[i].extract_text() or '')} for i in range(a-1,min(b,len(r.pages)))]",
    "sys.stdout.buffer.write(json.dumps(pages,ensure_ascii=True).encode('utf-8'))",
  ].join("\n");
  const { stdout } = await execFileAsync(python, ["-c", program, file, String(start), String(end)], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 240_000 });
  return JSON.parse(stdout);
}

function parseOfficialPoints(pages, pattern) {
  const reference = new RegExp(`^(${pattern})(?:\\s+(.*))?$`);
  const found = [];
  let current = null;
  for (const page of pages) {
    const lines = page.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(reference);
      if (match) {
        if (current) found.push(current);
        current = { reference: match[1], page: page.page, lines: match[2] ? [match[2]] : [] };
      } else if (current) {
        if (/^(Content|Notes|Basic foundation content|Additional foundation|Higher content only|Ref Content Notes)$/.test(line)) continue;
        if (/^(AQA |Visit |\d+\s+Visit )/.test(line)) continue;
        current.lines.push(line);
      }
    }
  }
  if (current) found.push(current);
  const seen = new Set();
  return found.flatMap((point) => {
    if (seen.has(point.reference)) return [];
    seen.add(point.reference);
    // Some PDF fonts expose isolated UTF-16 surrogate code units. Replace them
    // before JSON serialization so strict non-JavaScript parsers can consume
    // the candidate and review files as well.
    const description = point.lines.join(" ").replace(/[\uD800-\uDFFF]/g, "�").replace(/\s+/g, " ").trim().slice(0, 1800);
    return description.length >= 8 ? [{ ...point, description }] : [];
  });
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(reviewDirectory, { recursive: true });
const tree = JSON.parse(await readFile(resolve(root, "src/data/knowledge-tree/knowledge-tree.json"), "utf8"));
const leaves = tree.nodes.filter((node) => node.isLeaf).map((node) => ({ ...node, searchTokens: tokens(`${node.name} ${node.path.join(" ")}`) }));

for (const [id, config] of Object.entries(configs)) {
  const filePath = resolve(desktop, config.file);
  const bytes = await readFile(filePath);
  const pages = await extractPages(filePath, ...config.pages);
  const officialPoints = parseOfficialPoints(pages, config.pattern);
  if (officialPoints.length < 20) throw new Error(`${id}: extracted only ${officialPoints.length} official points`);
  const legacy = JSON.parse(await readFile(resolve(root, `public/data/v3.2-new/mapping-${id}.json`), "utf8"));
  const legacyPoints = legacy.mappings.flatMap((topic) => topic.subtopicMappings.map((point) => ({
    id: point.subtopicId,
    text: `${point.subtopicName} ${point.description ?? ""}`,
    searchTokens: tokens(`${point.subtopicName} ${point.description ?? ""}`),
    nodes: point.mappedNodes.map((node) => node.nodeId),
  })));
  const source = {
    url: config.url,
    title: config.title,
    documentVersion: config.version,
    locator: `official subject-content pages ${config.pages[0]}-${config.pages[1]}`,
    accessedAt: generatedAt,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sourceType: "official",
  };
  const pointReviews = [];
  const syllabusPoints = officialPoints.map((point) => {
    const wanted = tokens(point.description);
    const domains = expectedDomains(id, point.reference);
    const domainLeaves = domains.length ? leaves.filter((node) => domains.includes(node.path[1])) : leaves;
    const leafScores = domainLeaves.map((node) => ({ id: node.nodeId, score: overlap(wanted, node.searchTokens) })).filter((entry) => entry.score >= 0.24).sort((a, b) => b.score - a.score);
    const bestLeaf = leafScores[0]?.score ?? 0;
    const lexicalNodes = leafScores.filter((entry) => entry.score >= Math.max(0.24, bestLeaf * 0.72)).slice(0, 6).map((entry) => entry.id);
    const legacyScores = legacyPoints.map((entry) => ({ ...entry, score: overlap(wanted, entry.searchTokens) })).filter((entry) => entry.score >= 0.28).sort((a, b) => b.score - a.score);
    const hintedNodes = legacyScores.slice(0, 2).flatMap((entry) => entry.nodes).filter((nodeId) => leaves.some((node) => node.nodeId === nodeId));
    const fallbackNodes = lexicalNodes.length || hintedNodes.length ? [] : domains.map((domain) => rootIds[domain]).filter(Boolean).slice(0, 2);
    const canonicalNodeIds = [...new Set([...lexicalNodes, ...hintedNodes, ...fallbackNodes])].slice(0, 8);
    const confidence = Math.max(bestLeaf, legacyScores[0]?.score ?? 0);
    const status = canonicalNodeIds.length === 0 ? "fail" : confidence >= 0.55 ? "pass" : "warning";
    pointReviews.push({
      syllabusPointId: `${id}-${point.reference}`,
      status,
      sourceSupported: true,
      nodeFit: canonicalNodeIds.length === 0 ? "unmapped" : confidence >= 0.55 ? "acceptable" : "weak",
      paperAllocationSupported: true,
      sourcePage: point.page,
      officialTextPreview: point.description.slice(0, 320),
      expectedDomains: domains,
      lexicalConfidence: Number(confidence.toFixed(3)),
      issues: status === "pass" ? [] : [canonicalNodeIds.length ? "Canonical node fit requires owner inspection." : "No defensible canonical leaf node was identified."],
      recommendation: status === "pass" ? "Retain candidate mapping." : "Inspect official point and candidate nodes before approval.",
    });
    const lower = point.description.toLowerCase();
    const assessmentDepth = /proof|prove|deduc|argument/.test(lower) ? "proof" : /reason|justify|interpret|critique/.test(lower) ? "reasoning" : /apply|solve|model|calculate|construct|draw|use/.test(lower) ? "application" : "knowledge";
    return {
      syllabusPointId: `${id}-${point.reference}`,
      sourceReference: `Official specification page ${point.page} · ${point.reference}`,
      canonicalNodeIds,
      ...(canonicalNodeIds.length ? {} : { unmappedReason: "Local semantic matcher found no defensible canonical leaf; owner review required." }),
      relation: canonicalNodeIds.length === 1 && confidence >= 0.7 ? "exact" : "partial",
      assessmentDepth,
      paperApplicability: { kind: "not-specified" },
      reviewNotes: [`Locally extracted from official AQA reference ${point.reference}.`, `Local lexical/legacy-hint confidence ${confidence.toFixed(3)}; no source content was sent to an external AI.`],
    };
  });
  const candidate = {
    schemaVersion: "4.0.0",
    qualificationVersionId: `${id}:${config.version}`,
    board: legacy.board,
    subjectCode: legacy.subjectCode,
    subjectName: legacy.subjectName,
    level: legacy.level,
    syllabusVersion: config.version,
    effectiveFrom: config.effectiveFrom,
    sources: [source],
    reviewStatus: "candidate",
    review: { generatedAt, promptVersion: "aqa-local-official-reference-v1", reviewedAt: generatedAt },
    declaredPapers: legacy.paperStructure?.papers ?? [],
    syllabusPoints,
  };
  await writeFile(resolve(outputDirectory, `${id}.json`), `${JSON.stringify(candidate, null, 2)}\n`);
  await writeFile(resolve(reviewDirectory, `${id}.json`), `${JSON.stringify({
    schemaVersion: "1.0.0",
    qualificationVersionId: candidate.qualificationVersionId,
    reviewMethod: "local-only-policy-review",
    reviewedAt: generatedAt,
    sourceSha256: source.sha256,
    pointReviews,
    missingOfficialPoints: [],
    duplicatePointIds: [],
    overallIssues: pointReviews.some((entry) => entry.status === "fail") ? [{ severity: "high", issue: "One or more official points remain unmapped.", affectedPointIds: pointReviews.filter((entry) => entry.status === "fail").map((entry) => entry.syllabusPointId) }] : [],
    summary: { total: pointReviews.length, pass: pointReviews.filter((entry) => entry.status === "pass").length, warning: pointReviews.filter((entry) => entry.status === "warning").length, fail: pointReviews.filter((entry) => entry.status === "fail").length },
  }, null, 2)}\n`);
  console.log(`${id}: ${officialPoints.length} official points; ${pointReviews.filter((entry) => entry.status === "pass").length} pass, ${pointReviews.filter((entry) => entry.status === "warning").length} warning, ${pointReviews.filter((entry) => entry.status === "fail").length} fail.`);
}
