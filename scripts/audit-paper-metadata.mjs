import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/data/papers/paperMetadata.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const papers = module.ALL_PAPERS;
const failures = [];

for (const paper of papers) {
  if (!Number.isInteger(paper.effectiveFrom)) failures.push(`${paper.paperId}: missing effectiveFrom`);
  if (paper.effectiveTo !== undefined && paper.effectiveTo < paper.effectiveFrom) failures.push(`${paper.paperId}: invalid effective range`);
  if (!/^https:\/\//.test(paper.sourceUrl ?? "")) failures.push(`${paper.paperId}: missing official sourceUrl`);
  if (!["verified", "mixed", "unverified"].includes(paper.verificationStatus)) failures.push(`${paper.paperId}: invalid verificationStatus`);
  if (!(paper.maxMarks > 0) || !(paper.durationMinutes > 0)) failures.push(`${paper.paperId}: invalid duration or maxMark`);
}
if (new Set(papers.map((paper) => paper.paperId)).size !== papers.length) failures.push("duplicate Paper id");

const expectedSnapshots = {
  "CAIE-0580-P2": { durationMinutes: 120, maxMarks: 100, weightPercent: 50, calculatorAllowed: false, effectiveFrom: 2025, effectiveTo: 2027 },
  "CAIE-0580-P4": { durationMinutes: 120, maxMarks: 100, weightPercent: 50, calculatorAllowed: true, effectiveFrom: 2025, effectiveTo: 2027 },
  "CAIE-9709-P1": { maxMarks: 75, effectiveFrom: 2026, effectiveTo: 2027 },
  "CAIE-9709-P2": { maxMarks: 50, effectiveFrom: 2026, effectiveTo: 2027 },
  "CAIE-9709-P3": { maxMarks: 75, effectiveFrom: 2026, effectiveTo: 2027 },
  "CAIE-9709-P4": { maxMarks: 50, effectiveFrom: 2026, effectiveTo: 2027 },
  "CAIE-9709-P5": { maxMarks: 50, effectiveFrom: 2026, effectiveTo: 2027 },
  "CAIE-9709-P6": { maxMarks: 50, effectiveFrom: 2026, effectiveTo: 2027 },
};
for (const [id, expected] of Object.entries(expectedSnapshots)) {
  const paper = papers.find((candidate) => candidate.paperId === id);
  if (!paper) {
    failures.push(`${id}: missing current Paper snapshot`);
    continue;
  }
  for (const [field, value] of Object.entries(expected)) {
    if (paper[field] !== value) failures.push(`${id}.${field}: expected ${value}, received ${paper[field]}`);
  }
}

const boundaryFiles = [
  ["src/data/official/caie-math-grade-boundaries-2026.json", "subjectCode", "component", "maxMark"],
  ["src/data/official/caie-a-level-math-grade-boundaries-2026.json", "SubjectCode", "Component", "MaxRawMark"],
];
for (const [file, subjectField, componentField, maxField] of boundaryFiles) {
  const rows = JSON.parse(await readFile(file, "utf8"));
  for (const row of rows.filter((candidate) => ["0580", "9709"].includes(String(candidate[subjectField])))) {
    const paperNumber = String(row[componentField]).charAt(0);
    const paper = papers.find((candidate) => candidate.subjectCode === String(row[subjectField]) && candidate.paperNumber === paperNumber && candidate.verificationStatus === "verified");
    if (paper && paper.maxMarks !== Number(row[maxField])) failures.push(`${file} ${row[componentField]} max ${row[maxField]} conflicts with ${paper.paperId} max ${paper.maxMarks}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Paper metadata audit passed: ${papers.length} records and ${Object.keys(expectedSnapshots).length} official snapshots.`);
}
