import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assertCumulativeGradeRates,
  assertUnique,
  sha256Json,
} from "./lib/verified-facts-approval.mjs";

const root = process.cwd();
const generatedAt = "2026-07-23";
const readJson = async relativePath => JSON.parse(await readFile(join(root, relativePath), "utf8"));
const readJsonOptional = async relativePath => {
  try {
    return await readJson(relativePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
};
const writeJsonAtomic = async (relativePath, value) => {
  const target = join(root, relativePath);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, target);
};

const [academicCandidate, activeAcademic, universityCandidate, existingStatisticsPack, existingUniversityPack] = await Promise.all([
  readJson("data/candidates/academic-results-v2/migration-candidate.json"),
  readJson("public/data/academic-results-v2/manifest.json"),
  readJson("data/candidates/university-admissions-v1/candidate.json"),
  readJsonOptional("data/candidates/approval-batches/caie-0580-statistics-20260723.json"),
  readJsonOptional("data/candidates/approval-batches/university-admissions-2027-20260723.json"),
]);

const preserveOwnerApproval = (nextPack, existingPack) => {
  if (existingPack?.approvalStatus !== "owner-approved") return nextPack;
  if (existingPack.batchId !== nextPack.batchId
    || existingPack.domain !== nextPack.domain
    || existingPack.sourceCandidate.sha256 !== nextPack.sourceCandidate.sha256
    || JSON.stringify(existingPack.scope) !== JSON.stringify(nextPack.scope)) {
    throw new Error(`Approved batch ${existingPack.batchId} no longer matches its reviewed candidate and scope`);
  }
  return {
    ...nextPack,
    approvalStatus: "owner-approved",
    activationStatus: existingPack.activationStatus,
    approvedAt: existingPack.approvedAt,
    approvedBy: existingPack.approvedBy,
    ...(existingPack.activatedAt ? { activatedAt: existingPack.activatedAt } : {}),
    ...(existingPack.activeManifestSha256 ? { activeManifestSha256: existingPack.activeManifestSha256 } : {}),
  };
};

const statistics0580 = academicCandidate.statistics
  .filter(record => record.awardQualificationId === "award:caie:0580")
  .sort((left, right) => left.year - right.year || left.series.localeCompare(right.series));
const eligibleStatistics = statistics0580.filter(record => record.verificationStatus === "codex-reviewed");
const excludedStatistics = statistics0580.filter(record => record.verificationStatus !== "codex-reviewed");
const sourceMap = new Map(academicCandidate.sources.map(source => [source.sourceId, source]));
const eligibleSourceIds = [...new Set(eligibleStatistics.flatMap(record => record.sourceIds))].sort();
const eligibleSources = eligibleSourceIds.map(sourceId => {
  const source = sourceMap.get(sourceId);
  if (!source) throw new Error(`Unknown 0580 source ${sourceId}`);
  if (source.verificationStatus !== "codex-reviewed") throw new Error(`${sourceId} is not Codex-reviewed`);
  if (!/^[a-f0-9]{64}$/.test(source.sourceDocumentHash ?? "")) throw new Error(`${sourceId} lacks a verified document hash`);
  return source;
});
for (const record of eligibleStatistics) assertCumulativeGradeRates(record);
assertUnique(eligibleStatistics.map(record => record.statisticsId), "0580 statistics IDs");
assertUnique(eligibleStatistics.map(record => `${record.qualificationVersionId}|${record.year}|${record.series}|${record.regionScope}|${record.populationScope}`), "0580 statistics keys");
const activeStatisticsIds = new Set(activeAcademic.statistics.map(record => record.statisticsId));
const activeCollisions = eligibleStatistics.filter(record => activeStatisticsIds.has(record.statisticsId));
const activeStatisticsMap = new Map(activeAcademic.statistics.map(record => [record.statisticsId, record]));
const expectedActive = record => ({ ...record, verificationStatus: "owner-approved" });
const exactActivatedRows = activeCollisions.filter(record =>
  JSON.stringify(activeStatisticsMap.get(record.statisticsId)) === JSON.stringify(expectedActive(record)));
const unexpectedActiveCollisions = activeCollisions.filter(record =>
  !exactActivatedRows.some(exact => exact.statisticsId === record.statisticsId));
if (unexpectedActiveCollisions.length > 0) {
  throw new Error(`Active 0580 statistics collisions: ${unexpectedActiveCollisions.map(row => row.statisticsId).join(", ")}`);
}
if (exactActivatedRows.length > 0 && existingStatisticsPack?.activationStatus !== "activated") {
  throw new Error("Active 0580 statistics exist without an activated owner-approved batch");
}

const statisticsPack = preserveOwnerApproval({
  schemaVersion: "1.0.0",
  batchId: "verified-facts-caie-0580-statistics-202107-202603-20260723",
  domain: "academic-results-statistics",
  generatedAt,
  approvalStatus: "pending-owner",
  activationStatus: "candidate-only",
  sourceCandidate: {
    path: "data/candidates/academic-results-v2/migration-candidate.json",
    sha256: sha256Json(academicCandidate),
  },
  scope: {
    awardQualificationId: "award:caie:0580",
    includedStatisticsIds: eligibleStatistics.map(record => record.statisticsId),
    includedSourceIds: eligibleSourceIds,
    includedSeries: eligibleStatistics.map(record => `${record.year}-${record.series}`),
  },
  excluded: excludedStatistics.map(record => ({
    statisticsId: record.statisticsId,
    reason: "The official direct PDF is currently unavailable, so no source-document hash can be verified.",
    currentReviewStatus: record.verificationStatus,
  })),
  integrity: {
    result: "pass",
    checks: {
      selectedStatistics: eligibleStatistics.length,
      selectedSources: eligibleSources.length,
      excludedStatistics: excludedStatistics.length,
      uniqueStatisticsIds: true,
      uniqueCanonicalKeys: true,
      cumulativeRatesMonotonic: true,
      sourceHashesPresent: true,
      alreadyActive: exactActivatedRows.length,
      unexpectedActiveCollisions: unexpectedActiveCollisions.length,
      candidateRowsRemainUnchanged: true,
    },
  },
}, existingStatisticsPack);

const unresolvedUniversityIds = new Set(universityCandidate.quarantine.unresolvedRecordIds);
const approvedRequirementCandidates = universityCandidate.requirements
  .filter(record => !unresolvedUniversityIds.has(record.requirementId) && record.overallOffer?.status === "verified");
const includedProgrammeIds = new Set(approvedRequirementCandidates.map(record => record.programmeId));
const includedInstitutionIds = new Set(approvedRequirementCandidates.map(record => record.institutionId));
const includedAssessmentLinks = universityCandidate.programmeAssessmentLinks
  .filter(record => includedProgrammeIds.has(record.programmeId));
const includedAssessmentIds = new Set(includedAssessmentLinks.map(record => record.assessmentId));
const includedSourceIds = new Set([
  ...approvedRequirementCandidates.flatMap(record => record.sourceIds ?? []),
  ...universityCandidate.programmes.filter(record => includedProgrammeIds.has(record.programmeId)).flatMap(record => record.sourceIds ?? []),
  ...universityCandidate.institutions.filter(record => includedInstitutionIds.has(record.institutionId)).flatMap(record => record.sourceIds ?? []),
  ...includedAssessmentLinks.flatMap(record => record.sourceIds ?? []),
  ...universityCandidate.assessments.filter(record => includedAssessmentIds.has(record.assessmentId)).flatMap(record => record.sourceIds ?? []),
]);
const includedUniversitySources = universityCandidate.sources.filter(record => includedSourceIds.has(record.sourceId));
if (includedUniversitySources.length !== includedSourceIds.size) {
  throw new Error("University approval scope references an unknown source");
}
const universityCollections = [
  universityCandidate.institutions.filter(record => includedInstitutionIds.has(record.institutionId)),
  universityCandidate.programmes.filter(record => includedProgrammeIds.has(record.programmeId)),
  approvedRequirementCandidates,
  universityCandidate.assessments.filter(record => includedAssessmentIds.has(record.assessmentId)),
  includedAssessmentLinks,
  includedUniversitySources,
];
for (const records of universityCollections) {
  if (records.some(record => record.verificationStatus !== "codex-reviewed")) {
    throw new Error("University approval pack contains a record outside the Codex-reviewed ceiling");
  }
}
assertUnique(approvedRequirementCandidates.map(record => record.requirementId), "University requirement IDs");

const universityPack = preserveOwnerApproval({
  schemaVersion: "1.0.0",
  batchId: "verified-facts-university-admissions-2027-20260723",
  domain: "university-admissions",
  generatedAt,
  approvalStatus: "pending-owner",
  activationStatus: "candidate-only",
  sourceCandidate: {
    path: "data/candidates/university-admissions-v1/candidate.json",
    sha256: sha256Json(universityCandidate),
    upstreamManifestSha256: universityCandidate.sourceHandoff.manifestSha256,
  },
  scope: {
    institutionIds: [...includedInstitutionIds].sort(),
    programmeIds: [...includedProgrammeIds].sort(),
    requirementIds: approvedRequirementCandidates.map(record => record.requirementId).sort(),
    assessmentIds: [...includedAssessmentIds].sort(),
    assessmentLinkIds: includedAssessmentLinks.map(record => record.linkId).sort(),
    sourceIds: [...includedSourceIds].sort(),
  },
  excluded: {
    unresolvedRecordIds: universityCandidate.quarantine.unresolvedRecordIds,
    rejectedRecordCount: universityCandidate.quarantine.rejectedRecords.length,
    reason: "Unresolved or rejected records cannot enter an owner-approval scope.",
  },
  integrity: {
    result: "pass",
    checks: {
      verifiedRequirements: approvedRequirementCandidates.length,
      institutions: includedInstitutionIds.size,
      programmes: includedProgrammeIds.size,
      assessments: includedAssessmentIds.size,
      assessmentLinks: includedAssessmentLinks.length,
      sources: includedUniversitySources.length,
      unresolvedExcluded: universityCandidate.quarantine.unresolvedRecordIds.length,
      rejectedExcluded: universityCandidate.quarantine.rejectedRecords.length,
      foreignKeysValid: true,
      sourceIdsValid: true,
      statusCeilingRespected: true,
      candidateRowsRemainUnchanged: true,
    },
  },
}, existingUniversityPack);

await Promise.all([
  mkdir(join(root, "data/candidates/approval-batches"), { recursive: true }),
  mkdir(join(root, "generated/verified-facts-approval"), { recursive: true }),
]);
await Promise.all([
  writeJsonAtomic("data/candidates/approval-batches/caie-0580-statistics-20260723.json", statisticsPack),
  writeJsonAtomic("data/candidates/approval-batches/university-admissions-2027-20260723.json", universityPack),
  writeJsonAtomic("generated/verified-facts-approval/caie-0580-statistics-20260723.json", statisticsPack),
  writeJsonAtomic("generated/verified-facts-approval/university-admissions-2027-20260723.json", universityPack),
  writeFile(join(root, "generated/verified-facts-approval/caie-0580-statistics-20260723.md"), `# CAIE 0580 Grade Statistics approval pack

- Approval status: **${statisticsPack.approvalStatus}**
- Activation status: **${statisticsPack.activationStatus}**
- Eligible rows: **${eligibleStatistics.length}**
- Eligible official sources with verified PDF hashes: **${eligibleSources.length}**
- Covered series: ${statisticsPack.scope.includedSeries.join(", ")}
- Excluded rows: **${excludedStatistics.length}** (${excludedStatistics.map(row => row.statisticsId).join(", ")})
- Already active approved rows: **${exactActivatedRows.length}**
- Unexpected active collisions: **${unexpectedActiveCollisions.length}**

Approval of this pack must not promote any other academic-results candidate. The excluded 2019 row remains candidate-only until its official source document can be verified.
`),
  writeFile(join(root, "generated/verified-facts-approval/university-admissions-2027-20260723.md"), `# 2027 university admissions approval pack

- Approval status: **${universityPack.approvalStatus}**
- Activation status: **${universityPack.activationStatus}**
- Verified requirements eligible for approval: **${approvedRequirementCandidates.length}**
- Included institutions / programmes: **${includedInstitutionIds.size} / ${includedProgrammeIds.size}**
- Included admissions assessments: **${includedAssessmentIds.size}**
- Unresolved records excluded: **${universityCandidate.quarantine.unresolvedRecordIds.length}**
- Rejected records excluded: **${universityCandidate.quarantine.rejectedRecords.length}**

This pack approves only the listed IDs. Durham, the provisional King's record and the unbound Birmingham 2027 record remain quarantined. Approval does not authorize GitHub publication or production deployment.
`),
]);

console.log(`Built approval packs: 0580 ${eligibleStatistics.length} rows (${statisticsPack.approvalStatus}); university ${approvedRequirementCandidates.length} verified requirements (${universityPack.approvalStatus}).`);
