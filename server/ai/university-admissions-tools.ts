import activeManifestJson from "../../data/active/university-admissions-v1/manifest.json";
import type { AIChatRequest } from "@/domain-v2/ai-assistant";

type VerifiedRecord = {
  verificationStatus: string;
};

type SourceLinkedRecord = VerifiedRecord & {
  sourceIds: string[];
};

type Institution = SourceLinkedRecord & {
  institutionId: string;
  name: string;
  country: string;
};

type Programme = SourceLinkedRecord & {
  programmeId: string;
  institutionId: string;
  name: string;
  subjectArea: string;
  degreeType: string;
  intakeYears: number[];
  campuses: string[];
  uncertainties: string[];
};

type Requirement = SourceLinkedRecord & {
  requirementId: string;
  programmeId: string;
  institutionId: string;
  intakeYear: number;
  campus: string | null;
  college: string | null;
  qualificationRoute: unknown;
  overallOffer: unknown;
  subjectRequirements: unknown[];
  additionalRequirements: unknown[];
  gcseOrIgcseRequirements: unknown[];
  englishLanguageRequirements: unknown[];
  mixedBoardPolicy: unknown;
  predictedGradePolicy: unknown;
  resitPolicy: unknown;
  uncertainties: string[];
};

type Assessment = SourceLinkedRecord & {
  assessmentId: string;
  name: string;
  provider: string;
  category: string;
  testFormat: string;
  testDates: string[];
  registrationWindow: string;
  registrationMethod: string;
  calculatorPolicy: string;
  scoringMethod: string;
  uncertainties: string[];
};

type AssessmentLink = SourceLinkedRecord & {
  linkId: string;
  programmeId: string;
  institutionId: string;
  assessmentId: string;
  intakeYear: number;
  requirementLevel: string;
  scoreRequirement: string | null;
  conditions: string[];
};

export type UniversityAdmissionsSource = VerifiedRecord & {
  sourceId: string;
  title: string;
  url: string;
  finalUrl: string;
  accessedAt: string;
  publishedOrUpdatedAt: string | null;
  locator: string;
};

export type UniversityAdmissionsManifestV1 = {
  schemaVersion: string;
  activationBatch: string;
  approvedAt: string;
  approvedBy: string;
  activatedAt: string;
  institutions: Institution[];
  programmes: Programme[];
  requirements: Requirement[];
  assessments: Assessment[];
  programmeAssessmentLinks: AssessmentLink[];
  sources: UniversityAdmissionsSource[];
};

export type UniversityAdmissionsToolName =
  | "lookup_university_admissions_requirement"
  | "lookup_admissions_assessment"
  | "compare_university_admissions";

export type UniversityAdmissionsToolCall = {
  name: UniversityAdmissionsToolName;
  status: "ok" | "data-unavailable" | "input-required";
  result: unknown;
  sourceIds: string[];
  requiredInputs?: string[];
};

export type UniversityAdmissionsToolContext = {
  activeBatch: string;
  dataPolicy: string;
  intakeYear: number;
  calls: UniversityAdmissionsToolCall[];
  responseTemplate: {
    sections: string[];
    comparisonPolicy: string;
    missingFieldPolicy: string;
  };
};

const activeManifest = activeManifestJson as unknown as UniversityAdmissionsManifestV1;

const INSTITUTION_ALIASES: Record<string, string[]> = {
  "inst-imperial-college-london": ["imperial college london", "imperial", "ic", "帝国理工", "帝国理工学院"],
  "inst-london-school-of-economics-and-political-science": ["london school of economics", "lse", "伦敦政治经济学院", "伦敦政经"],
  "inst-university-college-london": ["university college london", "ucl", "伦敦大学学院"],
  "inst-university-of-bath": ["university of bath", "bath", "巴斯大学"],
  "inst-university-of-bristol": ["university of bristol", "bristol", "布里斯托大学"],
  "inst-university-of-cambridge": ["university of cambridge", "cambridge", "剑桥大学", "剑桥"],
  "inst-university-of-edinburgh": ["university of edinburgh", "edinburgh", "爱丁堡大学", "爱丁堡"],
  "inst-university-of-exeter": ["university of exeter", "exeter", "埃克塞特大学", "埃克塞特"],
  "inst-university-of-glasgow": ["university of glasgow", "glasgow", "格拉斯哥大学", "格拉斯哥"],
  "inst-university-of-leeds": ["university of leeds", "leeds", "利兹大学", "利兹"],
  "inst-university-of-manchester": ["university of manchester", "manchester", "曼彻斯特大学", "曼大"],
  "inst-university-of-nottingham": ["university of nottingham", "nottingham", "诺丁汉大学", "诺丁汉"],
  "inst-university-of-oxford": ["university of oxford", "oxford", "牛津大学", "牛津"],
  "inst-university-of-sheffield": ["university of sheffield", "sheffield", "谢菲尔德大学", "谢菲尔德"],
  "inst-university-of-southampton": ["university of southampton", "southampton", "南安普顿大学", "南安普顿"],
  "inst-university-of-st-andrews": ["university of st andrews", "st andrews", "圣安德鲁斯大学", "圣安"],
  "inst-university-of-warwick": ["university of warwick", "warwick", "华威大学", "华威"],
};

const SUBJECT_ALIASES: Record<string, string[]> = {
  mathematics: ["mathematics", "maths", "math", "数学"],
  "computer science": ["computer science", "computing", "计算机科学", "计算机", "cs"],
  physics: ["physics", "物理"],
  engineering: ["engineering", "工程"],
  economics: ["economics", "经济学", "经济"],
};

const ASSESSMENT_ALIASES: Record<string, string[]> = {
  "asm-esat": ["esat", "engineering and science admissions test"],
  "asm-step": ["step", "sixth term examination paper"],
  "asm-tara": ["tara", "test of academic reasoning for admissions"],
  "asm-tmua": ["tmua", "test of mathematics for university admission"],
};

const latestUserMessage = (request: AIChatRequest) =>
  [...request.messages].reverse().find(message => message.role === "user")?.content ?? "";

const normalize = (value: string) => value.toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9\u3400-\u9fff]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const includesAlias = (message: string, alias: string) => {
  const normalizedAlias = normalize(alias);
  if (/[\u3400-\u9fff]/.test(normalizedAlias)) return message.includes(normalizedAlias);
  return new RegExp(`(?:^|\\s)${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i").test(message);
};

const unique = (values: string[]) => [...new Set(values)];
const ACTIVE_INTAKE_YEAR = 2027;

function requestedIntakeYear(message: string): number | undefined {
  const match = message.match(/(?:^|\s)(20\d{2})(?:\s|$)/);
  return match ? Number(match[1]) : undefined;
}

function assertActiveManifest(value: UniversityAdmissionsManifestV1): UniversityAdmissionsManifestV1 {
  if (value.schemaVersion !== "1.0.0" || !value.activationBatch || value.approvedBy !== "owner") {
    throw new Error("University Admissions V1 is not an owner-approved active release");
  }
  const collections: VerifiedRecord[][] = [
    value.institutions,
    value.programmes,
    value.requirements,
    value.assessments,
    value.programmeAssessmentLinks,
    value.sources,
  ];
  if (collections.some(records => records.some(record => record.verificationStatus !== "owner-approved"))) {
    throw new Error("University Admissions V1 contains a non-owner-approved active record");
  }
  return value;
}

export function detectUniversityAdmissionsIntent(request: AIChatRequest): boolean {
  const message = normalize(latestUserMessage(request));
  const assessmentNamed = Object.values(ASSESSMENT_ALIASES).some(aliases => aliases.some(alias => includesAlias(message, alias)));
  return assessmentNamed
    || /(大学|录取|入学|申请|本科|专业要求|offer|admission|entry requirement|undergraduate|predicted grade|resit policy)/i.test(message);
}

function matchedInstitutionIds(message: string, manifest: UniversityAdmissionsManifestV1): string[] {
  return manifest.institutions
    .filter(institution => {
      const aliases = [...(INSTITUTION_ALIASES[institution.institutionId] ?? []), institution.name];
      return aliases.some(alias => includesAlias(message, alias));
    })
    .map(institution => institution.institutionId);
}

function matchedSubjectAreas(message: string): string[] {
  return Object.entries(SUBJECT_ALIASES)
    .filter(([, aliases]) => aliases.some(alias => includesAlias(message, alias)))
    .map(([subject]) => subject);
}

function matchedAssessmentIds(message: string): string[] {
  return Object.entries(ASSESSMENT_ALIASES)
    .filter(([, aliases]) => aliases.some(alias => includesAlias(message, alias)))
    .map(([assessmentId]) => assessmentId);
}

function selectedProgrammeRecords(
  manifest: UniversityAdmissionsManifestV1,
  institutionIds: string[],
  subjectAreas: string[],
) {
  const selectedProgrammes = manifest.programmes.filter(programme =>
    institutionIds.includes(programme.institutionId)
    && (subjectAreas.length === 0 || subjectAreas.some(subject =>
      normalize(programme.subjectArea).includes(subject)
      || normalize(programme.name).includes(subject))));
  const selectedProgrammeIds = new Set(selectedProgrammes.map(programme => programme.programmeId));
  return selectedProgrammes.flatMap(programme => {
    const institution = manifest.institutions.find(record => record.institutionId === programme.institutionId);
    const requirement = manifest.requirements.find(record => record.programmeId === programme.programmeId);
    if (!institution || !requirement) return [];
    const assessmentLinks = manifest.programmeAssessmentLinks
      .filter(link => selectedProgrammeIds.has(link.programmeId) && link.programmeId === programme.programmeId)
      .map(link => ({
        ...link,
        assessment: manifest.assessments.find(assessment => assessment.assessmentId === link.assessmentId),
      }));
    return [{
      institution,
      programme,
      requirement,
      assessmentLinks,
    }];
  });
}

export function buildUniversityAdmissionsToolContext(
  request: AIChatRequest,
  manifestValue: unknown = activeManifest,
): UniversityAdmissionsToolContext | undefined {
  if (!detectUniversityAdmissionsIntent(request)) return undefined;
  const manifest = assertActiveManifest(manifestValue as UniversityAdmissionsManifestV1);
  const message = normalize(latestUserMessage(request));
  const institutionIds = matchedInstitutionIds(message, manifest);
  const subjectAreas = matchedSubjectAreas(message);
  const assessmentIds = matchedAssessmentIds(message);
  const requestedYear = requestedIntakeYear(message);
  const intakeYear = requestedYear ?? ACTIVE_INTAKE_YEAR;
  const requestedUnavailableYear = intakeYear !== ACTIVE_INTAKE_YEAR;
  const comparisonRequested = institutionIds.length > 1
    && /(比较|对比|区别|差异|哪个|哪所|compare|difference|versus| vs )/i.test(` ${message} `);
  const calls: UniversityAdmissionsToolCall[] = [];

  if (assessmentIds.length > 0) {
    const records = requestedUnavailableYear
      ? []
      : manifest.assessments.filter(assessment => assessmentIds.includes(assessment.assessmentId));
    const relevantLinks = requestedUnavailableYear
      ? []
      : manifest.programmeAssessmentLinks.filter(link =>
        assessmentIds.includes(link.assessmentId)
        && link.intakeYear === intakeYear
        && (institutionIds.length === 0 || institutionIds.includes(link.institutionId)));
    calls.push({
      name: "lookup_admissions_assessment",
      status: records.length > 0 ? "ok" : "data-unavailable",
      result: {
        assessments: records,
        programmeLinks: relevantLinks,
      },
      sourceIds: unique([
        ...records.flatMap(record => record.sourceIds),
        ...relevantLinks.flatMap(record => record.sourceIds),
      ]),
    });
  }

  if (institutionIds.length > 0) {
    const records = requestedUnavailableYear
      ? []
      : selectedProgrammeRecords(manifest, institutionIds, subjectAreas)
        .filter(record => record.requirement.intakeYear === intakeYear)
        .slice(0, 8);
    calls.push({
      name: comparisonRequested ? "compare_university_admissions" : "lookup_university_admissions_requirement",
      status: records.length > 0 ? "ok" : "data-unavailable",
      result: records,
      sourceIds: unique(records.flatMap(record => [
        ...record.institution.sourceIds,
        ...record.programme.sourceIds,
        ...record.requirement.sourceIds,
        ...record.assessmentLinks.flatMap(link => [
          ...link.sourceIds,
          ...(link.assessment?.sourceIds ?? []),
        ]),
      ])),
    });
  } else if (assessmentIds.length === 0) {
    calls.push({
      name: "lookup_university_admissions_requirement",
      status: "input-required",
      result: null,
      sourceIds: [],
      requiredInputs: ["institution", "programme-or-subject", "intake-year-if-not-2027"],
    });
  }

  return {
    activeBatch: manifest.activationBatch,
    dataPolicy: `Read-only owner-approved University Admissions V1 records for ${ACTIVE_INTAKE_YEAR} entry only. Candidate and quarantined records are inaccessible.`,
    intakeYear,
    calls,
    responseTemplate: {
      sections: request.locale === "en-GB"
        ? [
          "Direct conclusion",
          "Applicable institution, programme, campus and intake",
          "Overall offer",
          "Required subjects and grades",
          "Admissions assessments and conditions",
          "Explicit resit, predicted-grade and mixed-board policies",
          "Unstated fields, uncertainties and official sources",
          "Conclusion status",
        ]
        : [
          "直接结论",
          "适用大学、专业、校区与入学年份",
          "整体成绩要求",
          "必修科目及单科等级",
          "入学考试及条件",
          "重考、预估成绩、混合考试局等已明确政策",
          "未说明事项、不确定项与官方来源",
          "结论状态",
        ],
      comparisonPolicy: "Compare like-for-like fields only. Do not rank admission likelihood or call one university easier when the active evidence does not support that conclusion.",
      missingFieldPolicy: "not-stated means the official active evidence did not state the policy; it does not mean allowed, prohibited, required, or waived.",
    },
  };
}

export function universityAdmissionsSourceMap(
  manifestValue: unknown = activeManifest,
): Map<string, UniversityAdmissionsSource> {
  const manifest = assertActiveManifest(manifestValue as UniversityAdmissionsManifestV1);
  return new Map(manifest.sources.map(source => [source.sourceId, source]));
}
