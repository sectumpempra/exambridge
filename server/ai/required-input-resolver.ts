import type { AIChatRequest } from "@/domain-v2/ai-assistant";

type MissingInputKind =
  | "boundary-lookup"
  | "award-calculation"
  | "carry-forward-eligibility";

export type RequiredInputClarification = {
  kind: MissingInputKind;
  missing: string[];
  clarification: string;
};

const allUserText = (request: AIChatRequest) => request.messages
  .filter(message => message.role === "user")
  .slice(-4)
  .map(message => message.content)
  .join("\n");

const hasYear = (value: string) => /\b20\d{2}\b/.test(value);
const hasSeries = (value: string) => /january|jan(?:uary)?|一月|1月|march|mar(?:ch)?|三月|3月|june|may\s*\/\s*june|夏季|六月|6月|5\s*\/\s*6\s*月|october|oct(?:ober)?|十月|10月|november|nov(?:ember)?|冬季|十一月|11月/i.test(value);
const hasAsAlRoute = (value: string) => /\bas\b|a[ -]?level|alevel|完整\s*al|分阶段|staged/i.test(value);
const has0580Tier = (value: string) => /\bcore\b|\bextended\b|核心|扩展/i.test(value);
const has4ma1Tier = (value: string) => /\bfoundation\b|\bhigher\b|基础|高阶/i.test(value);
const hasCaieOption = (value: string) => /\b(?:a[xyz]|b[xyz])\b|option\s*[a-z0-9]+|选项\s*[a-z0-9]+/i.test(value);

function qualificationSpecificBoundaryInputs(awardQualificationIds: string[], text: string): string[] {
  const missing: string[] = [];
  if (awardQualificationIds.includes("award:caie:0580")) {
    if (!has0580Tier(text)) missing.push("Core 或 Extended");
    if (!hasCaieOption(text)) missing.push("官方 option（例如 AX/BX）");
  }
  if (awardQualificationIds.includes("award:pearson:4ma1") && !has4ma1Tier(text)) {
    missing.push("Foundation 或 Higher");
  }
  if (awardQualificationIds.some(id => id === "award:caie:9709" || id === "award:caie:9231") && !hasAsAlRoute(text)) {
    missing.push("AS、同考季完整 A Level 或 staged route");
  }
  return missing;
}

function zhClarification(kind: MissingInputKind, missing: string[]) {
  const prefix = kind === "boundary-lookup"
    ? "要核验这次分数线"
    : kind === "award-calculation"
      ? "要执行正式合分计算"
      : "要判断这次 carry-forward 是否有效";
  return `${prefix}，请一次补充：${missing.join("、")}。信息齐全后我会按对应资格版本和官方规则查询，不会用其他考季或路线代替。`;
}

function enClarification(kind: MissingInputKind, missing: string[]) {
  const prefix = kind === "boundary-lookup"
    ? "To verify this grade boundary"
    : kind === "award-calculation"
      ? "To calculate the qualification award"
      : "To determine whether this carry-forward is valid";
  return `${prefix}, please provide all of the following: ${missing.join(", ")}. I will then use the matching qualification version and official rule rather than substitute another series or route.`;
}

export function detectRequiredInputClarification(
  request: AIChatRequest,
  awardQualificationIds: string[],
): RequiredInputClarification | undefined {
  const text = allUserText(request);
  const locale = request.locale;
  const qualificationMissing = awardQualificationIds.length === 0;

  const asksStatistics = /grade\s*statistics?|成绩统计|等级统计|a\s*\*\s*率|通过率|达标率|比例|percentage/i.test(text);
  const asksSpecificBoundary = !asksStatistics
    && /分数线|等级线|grade\s*boundar|threshold/i.test(text)
    && (/多少|查询|查一下|具体|哪一条|what|lookup|\b20\d{2}\b/i.test(text));
  if (asksSpecificBoundary) {
    const missing = [
      ...(qualificationMissing ? [locale === "en-GB" ? "the exact qualification code" : "准确资格代码"] : []),
      ...(!hasYear(text) ? [locale === "en-GB" ? "year" : "年份"] : []),
      ...(!hasSeries(text) ? [locale === "en-GB" ? "exam series" : "考季"] : []),
      ...qualificationSpecificBoundaryInputs(awardQualificationIds, text),
    ];
    if (missing.length > 0) {
      return {
        kind: "boundary-lookup",
        missing,
        clarification: locale === "en-GB" ? enClarification("boundary-lookup", missing) : zhClarification("boundary-lookup", missing),
      };
    }
  }

  const asksConcreteCalculation = /帮我算|替我算|计算.*(?:最终|等级|合分)|我的.*(?:成绩|分数).*(?:等级|合分)|calculate.*(?:award|grade)/i.test(text);
  if (asksConcreteCalculation && request.academicQuery?.type !== "award-calculation") {
    const missing = [
      ...(qualificationMissing ? [locale === "en-GB" ? "the exact qualification code and version" : "准确资格代码及版本"] : []),
      locale === "en-GB" ? "route and valid component combination" : "route 和有效组件组合",
      locale === "en-GB" ? "exam series for every component" : "每个组件的考季",
      locale === "en-GB" ? "every score and whether it is raw, scaled, UMS or PUM" : "每项分数及其类型（raw、scaled、UMS 或 PUM）",
    ];
    if (awardQualificationIds.some(id => id.includes("ial-mathematics") || id.includes("ial-further-mathematics"))) {
      missing.push(locale === "en-GB" ? "cash-in and resit/locking history" : "cash-in 以及重考/locking 历史");
    }
    return {
      kind: "award-calculation",
      missing,
      clarification: locale === "en-GB" ? enClarification("award-calculation", missing) : zhClarification("award-calculation", missing),
    };
  }

  const asksCarryEligibility = /(?:我|这个|这些|\bmy\b|\bthis\b|\bthese\b).{0,30}carry[ -]?forward|carry[ -]?forward.{0,30}(?:可以|能否|有效|到\s*20\d{2}|\bvalid\b|\beligible\b|\bcan\b|\bmay\b)/i.test(text);
  if (asksCarryEligibility) {
    const missing = [
      ...(qualificationMissing ? [locale === "en-GB" ? "the exact qualification code and version" : "准确资格代码及版本"] : []),
      ...(!hasYear(text) || !hasSeries(text) ? [locale === "en-GB" ? "the original and target exam series" : "原考季和目标考季"] : []),
      ...(!hasAsAlRoute(text) ? [locale === "en-GB" ? "the complete AS route/component combination" : "完整 AS route/组件组合"] : []),
    ];
    if (missing.length > 0) {
      return {
        kind: "carry-forward-eligibility",
        missing,
        clarification: locale === "en-GB" ? enClarification("carry-forward-eligibility", missing) : zhClarification("carry-forward-eligibility", missing),
      };
    }
  }

  return undefined;
}
