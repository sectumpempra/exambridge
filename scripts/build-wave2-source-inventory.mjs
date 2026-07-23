import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const targetCodes = [
  "9700", "9701", "9702", "9618", "9708", "9609",
  "YBI11", "YCH11", "YPH11", "YEC11", "YBS11",
  "7402", "7405", "7408", "7136", "7132", "7517",
  "H420", "H432", "H556", "H443",
];
const localOnlyCodes = new Set(["7402", "7405", "7408", "7136", "7132", "7517"]);
const server = await createServer({
  root,
  configFile: false,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
  resolve: { alias: { "@": resolve(root, "src") } },
});

try {
  const [{ EXAM_OVERVIEW_CATALOG }, { getDisplayCourseCatalog }] = await Promise.all([
    server.ssrLoadModule("/src/domain-v2/exam-overview/catalog.ts"),
    server.ssrLoadModule("/src/course-context/catalog.ts"),
  ]);
  const courses = getDisplayCourseCatalog("current");
  const records = targetCodes.map(subjectCode => {
    const matchingCourses = courses.filter(course => course.subjectCode.toUpperCase() === subjectCode);
    const overview = EXAM_OVERVIEW_CATALOG.find(item =>
      item.code.toUpperCase().split(/\s*\/\s*/).includes(subjectCode)
      || item.code.toUpperCase() === subjectCode);
    const specificationSources = (overview?.materials ?? [])
      .filter(material => material.type === "syllabus" && material.status === "current")
      .map(material => ({
        materialId: material.id,
        title: material.title,
        version: material.version,
        officialUrl: material.officialUrl,
        evidenceStatus: "catalogued-official-source-not-yet-rule-adjudicated",
      }));
    const processingPolicy = localOnlyCodes.has(subjectCode) ? "codex-local-only" : "deepseek-candidate-eligible";
    return {
      subjectCode,
      courseIdentities: matchingCourses.map(course => ({
        qualificationId: course.qualificationId,
        board: course.boardName,
        level: course.level,
        subjectName: course.subjectName,
      })),
      examOverviewId: overview?.id ?? null,
      currentSpecificationSources: specificationSources,
      existingStructureInventory: overview ? {
        components: overview.components.length,
        routes: overview.routes.length,
        structureStatus: "display-reviewed-not-canonical-rule-evidence",
      } : null,
      processingPolicy,
      externalModelProhibitionReason: localOnlyCodes.has(subjectCode)
        ? "AQA source text and rows must remain local-only."
        : null,
      gaps: {
        qualificationVersionIdentity: specificationSources.length > 0 ? "source-inventory-ready" : "official-source-required",
        paperOrUnitStructure: overview ? "display-inventory-ready-canonicalization-required" : "official-source-required",
        validAwardCombinations: "official-rule-evidence-required",
        resitPolicy: "official-rule-evidence-required",
        carryForward: subjectCode.startsWith("97") || subjectCode === "9618" || subjectCode === "9609"
          ? "official-rule-evidence-required"
          : "not-yet-classified",
        cashInAndLocking: subjectCode.startsWith("Y") ? "official-rule-evidence-required" : "not-applicable-or-unclassified",
        aStarRule: "official-rule-evidence-required",
        gradeBoundaries: "canonical-migration-and-source-audit-required",
        gradeStatistics: "auxiliary-canonical-migration-and-source-audit-required",
      },
      recommendedNextAction: specificationSources.length > 0
        ? "Extract the version, route and rule clauses from the catalogued official specification; independently verify resit/award policies against board regulations."
        : "Locate and hash the current official specification locally before any rule extraction.",
    };
  });
  const summary = {
    schemaVersion: "1.0.0",
    generatedAt: "2026-07-23",
    wave: 2,
    status: "source-inventory-only",
    interpretation: "Exam-overview display data is useful inventory but is not canonical evidence for award, resit or boundary calculations.",
    counts: {
      qualifications: records.length,
      nonAqaDeepSeekEligible: records.filter(record => record.processingPolicy === "deepseek-candidate-eligible").length,
      aqaLocalOnly: records.filter(record => record.processingPolicy === "codex-local-only").length,
      withCurrentSpecificationSource: records.filter(record => record.currentSpecificationSources.length > 0).length,
      withDisplayStructureInventory: records.filter(record => record.existingStructureInventory).length,
    },
    records,
  };
  const outputDirectory = join(root, "generated/all-subject-facts-v1");
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(outputDirectory, "wave2-source-inventory.json"), `${JSON.stringify(summary, null, 2)}\n`),
    writeFile(join(outputDirectory, "wave2-source-inventory.md"), `# Wave 2 official-source inventory

- Qualifications: **${summary.counts.qualifications}**
- Non-AQA qualifications eligible for candidate assistance: **${summary.counts.nonAqaDeepSeekEligible}**
- AQA qualifications restricted to local processing: **${summary.counts.aqaLocalOnly}**
- Current official specifications already catalogued: **${summary.counts.withCurrentSpecificationSource}**
- Existing display structure inventories: **${summary.counts.withDisplayStructureInventory}**

## Interpretation

This inventory does not approve any resit, award, boundary or Grade Statistics fact. Existing exam-overview records are starting evidence only. The next research batches must separately verify qualification versions, valid combinations, resit and carry-forward rules, Pearson cash-in/locking where applicable, A* rules, boundary granularity and statistics publication scope.

The first non-AQA extraction batch should use the 11 qualifications with current official specification links. OCR requires official source collection first. All six AQA qualifications remain Codex-local-only.
`),
  ]);
  console.log(`Wave 2 source inventory: ${records.length} qualifications; ${summary.counts.withCurrentSpecificationSource} have a catalogued current specification; ${summary.counts.aqaLocalOnly} AQA local-only.`);
} finally {
  await server.close();
}
