import type { AIChatRequest } from "@/domain-v2/ai-assistant";
import type { UniversityAdmissionsToolContext } from "./university-admissions-tools";

type ProgrammeRecord = {
  institution?: {
    institutionId?: string;
    name?: string;
  };
  requirement?: {
    campus?: string | null;
    college?: string | null;
    sourceIds?: string[];
  };
  assessmentLinks?: Array<{
    assessmentId?: string;
    requirementLevel?: string;
    sourceIds?: string[];
    assessment?: {
      name?: string;
      sourceIds?: string[];
    };
  }>;
};

export type UniversityAdmissionsGroundingResult = {
  answer: string;
  corrections: string[];
};

const INSTITUTION_SHORT_NAMES: Record<string, string[]> = {
  "inst-imperial-college-london": ["Imperial", "帝国理工"],
  "inst-london-school-of-economics-and-political-science": ["LSE", "伦敦政经"],
  "inst-university-college-london": ["UCL", "伦敦大学学院"],
  "inst-university-of-bath": ["Bath", "巴斯"],
  "inst-university-of-bristol": ["Bristol", "布里斯托"],
  "inst-university-of-cambridge": ["Cambridge", "剑桥"],
  "inst-university-of-edinburgh": ["Edinburgh", "爱丁堡"],
  "inst-university-of-exeter": ["Exeter", "埃克塞特"],
  "inst-university-of-glasgow": ["Glasgow", "格拉斯哥"],
  "inst-university-of-leeds": ["Leeds", "利兹"],
  "inst-university-of-manchester": ["Manchester", "曼彻斯特", "曼大"],
  "inst-university-of-nottingham": ["Nottingham", "诺丁汉"],
  "inst-university-of-oxford": ["Oxford", "牛津"],
  "inst-university-of-sheffield": ["Sheffield", "谢菲尔德"],
  "inst-university-of-southampton": ["Southampton", "南安普顿"],
  "inst-university-of-st-andrews": ["St Andrews", "圣安德鲁斯"],
  "inst-university-of-warwick": ["Warwick", "华威"],
};

const ASSESSMENT_LABELS: Record<string, string> = {
  "asm-esat": "ESAT",
  "asm-step": "STEP",
  "asm-tara": "TARA",
  "asm-tmua": "TMUA",
};

const ALL_ASSESSMENT_TOKENS = ["TMUA", "STEP", "ESAT", "TARA", "MAT"];
const NEGATIVE_REQUIREMENT_CLAIM = /(不要求|无需|不需要|不再(?:使用|沿用|要求)|仅要求|只要求|does not require|doesn't require|not required|only requires?|no longer requires?)/i;
const EXCLUSIVE_ASSESSMENT_CLAIM = /(仅需|只需|只要|only needs?|solely requires?)/i;
const UNIVERSAL_ASSESSMENT_CLAIM = /(所有申请人|均须|必须.*(?:同时|参加|准备)|需同时|几乎确定|all applicants|must.*(?:take|sit|prepare)|definitely|almost certain)/i;
const COLLEGE_INFERENCE_CLAIM = /(学院.*(?:不作限制|不受限制|不限)|(?:未限定|不限).*学院|(?:统一招生|开放申请)|all colleges|open application|college.*unrestricted)/i;

function programmeRecords(context: UniversityAdmissionsToolContext): ProgrammeRecord[] {
  return context.calls.flatMap(call => {
    if (!Array.isArray(call.result)) return [];
    return call.result.filter((record): record is ProgrammeRecord =>
      Boolean(record) && typeof record === "object" && "institution" in record);
  });
}

function institutionAliases(record: ProgrammeRecord): string[] {
  const institutionId = record.institution?.institutionId ?? "";
  return [
    record.institution?.name ?? "",
    ...(INSTITUTION_SHORT_NAMES[institutionId] ?? []),
  ].filter(Boolean);
}

function containsAlias(segment: string, aliases: string[]): boolean {
  return aliases.some(alias => segment.toLowerCase().includes(alias.toLowerCase()));
}

function mentionedAssessmentTokens(segment: string): string[] {
  return ALL_ASSESSMENT_TOKENS.filter(token =>
    new RegExp(`(?:^|[^A-Z])${token}(?:[^A-Z]|$)`, "i").test(segment));
}

function linkedAssessmentTokens(record: ProgrammeRecord): string[] {
  return [...new Set((record.assessmentLinks ?? []).flatMap(link => {
    const byId = link.assessmentId ? ASSESSMENT_LABELS[link.assessmentId] : undefined;
    const byName = ALL_ASSESSMENT_TOKENS.find(token =>
      link.assessment?.name?.toUpperCase().includes(token));
    return [byId, byName].filter((value): value is string => Boolean(value));
  }))];
}

function institutionLabel(record: ProgrammeRecord, locale: AIChatRequest["locale"]): string {
  const shortNames = INSTITUTION_SHORT_NAMES[record.institution?.institutionId ?? ""] ?? [];
  if (locale === "zh-CN") return shortNames.find(name => /[\u3400-\u9fff]/.test(name))
    ?? record.institution?.name
    ?? "该大学";
  return record.institution?.name ?? shortNames[0] ?? "This university";
}

function citationSuffix(sourceIds: Array<string | undefined>): string {
  return [...new Set(sourceIds.filter((sourceId): sourceId is string => /^S\d+$/.test(sourceId ?? "")))]
    .map(sourceId => `[${sourceId}]`)
    .join("");
}

function assessmentCorrection(
  record: ProgrammeRecord,
  unsupported: string[],
  locale: AIChatRequest["locale"],
): string {
  const institution = institutionLabel(record, locale);
  const linked = linkedAssessmentTokens(record);
  const citations = citationSuffix((record.assessmentLinks ?? []).flatMap(link => [
    ...(link.sourceIds ?? []),
    ...(link.assessment?.sourceIds ?? []),
  ]));
  if (locale === "zh-CN") {
    const recorded = linked.length > 0 ? `当前 active 记录列出的入学考试为 ${linked.join("、")}` : "当前 active 记录未列出入学考试";
    return `${institution}：${recorded}${citations}；对 ${unsupported.join("、")} 没有明确记录，因此不能据此断定“不要求”。`;
  }
  const recorded = linked.length > 0
    ? `the active record lists ${linked.join(", ")}`
    : "the active record does not list an admissions assessment";
  return `${institution}: ${recorded}${citations}; it has no explicit record for ${unsupported.join(", ")}, so absence cannot be reported as “not required”.`;
}

function assessmentScopeCorrection(
  record: ProgrammeRecord,
  locale: AIChatRequest["locale"],
): string {
  const institution = institutionLabel(record, locale);
  const links = record.assessmentLinks ?? [];
  const details = links.map(link => {
    const token = (link.assessmentId && ASSESSMENT_LABELS[link.assessmentId])
      ?? ALL_ASSESSMENT_TOKENS.find(item => link.assessment?.name?.toUpperCase().includes(item))
      ?? link.assessment?.name
      ?? "assessment";
    const scope = link.requirementLevel === "required"
      ? (locale === "zh-CN" ? "当前记录明确为所有申请人必须参加" : "the active record marks it as required")
      : link.requirementLevel === "required-for-some-applicants"
        ? (locale === "zh-CN" ? "仅对部分申请人或特定条件适用" : "it applies only to some applicants or conditions")
        : (locale === "zh-CN"
          ? `当前记录状态为 ${link.requirementLevel ?? "未说明"}`
          : `the active record status is ${link.requirementLevel ?? "not stated"}`);
    return `${token}（${scope}）`;
  });
  const citations = citationSuffix(links.flatMap(link => [
    ...(link.sourceIds ?? []),
    ...(link.assessment?.sourceIds ?? []),
  ]));
  if (locale === "zh-CN") {
    return `${institution}：当前 active 记录列出 ${details.join("、")}${citations}；不能把“部分适用”扩大为所有申请人，也不能因其他考试未列出就断定“仅需”这些考试。`;
  }
  return `${institution}: the active record lists ${details.join(", ")}${citations}; a condition for some applicants cannot be expanded to everyone, and an unlisted assessment cannot be treated as proof that these are the only assessments needed.`;
}

function collegeCorrection(record: ProgrammeRecord, locale: AIChatRequest["locale"]): string {
  const institution = institutionLabel(record, locale);
  const citations = citationSuffix(record.requirement?.sourceIds ?? []);
  return locale === "zh-CN"
    ? `${institution}：当前 active 记录未说明具体校区或学院${citations}，不能据此推断学院范围或申请安排。`
    : `${institution}: the active record does not state a specific campus or college${citations}, so no collegiate scope or application arrangement can be inferred.`;
}

export function groundUniversityAdmissionsAnswer(
  answer: string,
  context: UniversityAdmissionsToolContext | undefined,
  locale: AIChatRequest["locale"],
): UniversityAdmissionsGroundingResult {
  if (!context) return { answer, corrections: [] };
  const records = programmeRecords(context);
  if (records.length === 0) return { answer, corrections: [] };
  const corrections: string[] = [];
  const segments = answer.split(/([；;。！？!?\n]+)/);
  const grounded = segments.map(segment => {
    if (!segment.trim()) return segment;
    const replacements: string[] = [];
    for (const record of records) {
      const aliases = institutionAliases(record);
      if (!containsAlias(segment, aliases)) continue;
      const mentionedAssessments = mentionedAssessmentTokens(segment);
      const linkedAssessments = linkedAssessmentTokens(record);
      const unsupportedAssessments = mentionedAssessments
        .filter(token => !linkedAssessmentTokens(record).includes(token));
      if (unsupportedAssessments.length > 0 && NEGATIVE_REQUIREMENT_CLAIM.test(segment)) {
        corrections.push(`${record.institution?.institutionId ?? "unknown"}:unsupported-negative-assessment-claim:${unsupportedAssessments.join(",")}`);
        replacements.push(assessmentCorrection(record, unsupportedAssessments, locale));
        continue;
      }
      const overstatesLimitedAssessment = mentionedAssessments.some(token => {
        const link = (record.assessmentLinks ?? []).find(item => {
          const linkedToken = (item.assessmentId && ASSESSMENT_LABELS[item.assessmentId])
            ?? ALL_ASSESSMENT_TOKENS.find(candidate => item.assessment?.name?.toUpperCase().includes(candidate));
          return linkedToken === token;
        });
        return link?.requirementLevel && link.requirementLevel !== "required";
      }) && UNIVERSAL_ASSESSMENT_CLAIM.test(segment);
      const makesExclusiveClaim = mentionedAssessments.some(token => linkedAssessments.includes(token))
        && EXCLUSIVE_ASSESSMENT_CLAIM.test(segment);
      if (overstatesLimitedAssessment || makesExclusiveClaim) {
        corrections.push(`${record.institution?.institutionId ?? "unknown"}:${overstatesLimitedAssessment ? "overstated-assessment-scope" : "unsupported-exclusive-assessment-claim"}`);
        replacements.push(assessmentScopeCorrection(record, locale));
        continue;
      }
      if (
        !record.requirement?.campus
        && !record.requirement?.college
        && COLLEGE_INFERENCE_CLAIM.test(segment)
      ) {
        corrections.push(`${record.institution?.institutionId ?? "unknown"}:unsupported-college-inference`);
        replacements.push(collegeCorrection(record, locale));
      }
    }
    return replacements.length > 0 ? [...new Set(replacements)].join(locale === "zh-CN" ? "；" : "; ") : segment;
  }).join("");
  return { answer: grounded, corrections };
}
