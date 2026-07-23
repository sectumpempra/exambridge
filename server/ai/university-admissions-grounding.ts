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
    for (const record of records) {
      const aliases = institutionAliases(record);
      if (!containsAlias(segment, aliases)) continue;
      const unsupportedAssessments = mentionedAssessmentTokens(segment)
        .filter(token => !linkedAssessmentTokens(record).includes(token));
      if (unsupportedAssessments.length > 0 && NEGATIVE_REQUIREMENT_CLAIM.test(segment)) {
        corrections.push(`${record.institution?.institutionId ?? "unknown"}:unsupported-negative-assessment-claim:${unsupportedAssessments.join(",")}`);
        return assessmentCorrection(record, unsupportedAssessments, locale);
      }
      if (
        !record.requirement?.campus
        && !record.requirement?.college
        && COLLEGE_INFERENCE_CLAIM.test(segment)
      ) {
        corrections.push(`${record.institution?.institutionId ?? "unknown"}:unsupported-college-inference`);
        return collegeCorrection(record, locale);
      }
    }
    return segment;
  }).join("");
  return { answer: grounded, corrections };
}
