import type { CourseContextEntry, SubjectCategory } from "@/course-context/types";
import type { AIClarification } from "@/domain-v2/ai-assistant";
import type { QualificationIdentityV2 } from "@/domain-v2/academic-results";

export type QualificationAmbiguity = {
  ambiguityClass: "generic-a-level-mathematics" | "generic-igcse-mathematics" | "pearson-route" | "catalog-qualification";
  clarification: string;
  choices?: AIClarification;
};

export type CatalogQualificationResolution = {
  matchedCourses: CourseContextEntry[];
  ambiguity?: QualificationAmbiguity;
};

const normalizeAlias = (value: string) => value
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[\s·_—–-]+/g, " ")
  .replace(/[^a-z0-9\u3400-\u9fff ]+/g, "")
  .trim();

const token = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "");

const codeIsNamed = (message: string, code: string) => {
  const normalizedCode = token(code);
  if (normalizedCode.length < 3) return false;
  if (/^[A-Z]+$/.test(normalizedCode)) {
    return new RegExp(`(?:^|[^A-Z])${normalizedCode}(?:$|[^A-Z])`, "i").test(message);
  }
  return token(message).includes(normalizedCode);
};

const boardFamily = (board: string) => {
  const normalized = board.toLowerCase();
  if (normalized.includes("cambridge") || normalized === "caie") return "caie";
  if (normalized.includes("pearson") || normalized.includes("edexcel")) return "pearson";
  if (normalized.includes("aqa")) return "aqa";
  if (normalized.includes("ocr")) return "ocr";
  if (normalized.includes("wjec") || normalized.includes("eduqas")) return "wjec";
  return normalized.replace(/[^a-z0-9]+/g, "");
};

const BOARD_PATTERNS: Array<{ family: string; label: string; pattern: RegExp }> = [
  { family: "caie", label: "Cambridge / CAIE", pattern: /cambridge|caie|剑桥/i },
  { family: "pearson", label: "Pearson Edexcel", pattern: /pearson|edexcel|培生|爱德思|edx/i },
  { family: "aqa", label: "AQA", pattern: /\baqa\b/i },
  { family: "ocr", label: "OCR", pattern: /\bocr\b/i },
  { family: "wjec", label: "WJEC / Eduqas", pattern: /wjec|eduqas|威尔士/i },
];

const SUBJECT_PATTERNS: Array<{ category: SubjectCategory; label: string; pattern: RegExp }> = [
  { category: "mathematics", label: "Mathematics", pattern: /math(?:ematic)?s?|数学/i },
  { category: "biology", label: "Biology", pattern: /biology|生物/i },
  { category: "chemistry", label: "Chemistry", pattern: /chemistry|化学/i },
  { category: "physics", label: "Physics", pattern: /physics|物理/i },
  { category: "computer-science", label: "Computer Science", pattern: /computer\s*science|计算机(?:科学)?|电脑科学/i },
  { category: "economics", label: "Economics", pattern: /economics?|经济/i },
  { category: "accounting", label: "Accounting", pattern: /accounting|会计/i },
];

const levelFilters = (message: string): string[] => {
  const result: string[] = [];
  if (/igcse|international\s+gcse|国际\s*gcse|ig数学/i.test(message)) result.push("IGCSE");
  else if (/\bgcse\b/i.test(message)) result.push("GCSE");
  if (/a[ -]?level|alevel|\bial\b|international\s+a[ -]?level|a水准|a级/i.test(message)) result.push("A-Level");
  return result;
};

const courseRank = (course: CourseContextEntry) =>
  (course.lifecycleStatus === "current" ? 100 : 0)
  + (course.level === "IGCSE" ? 5 : 0)
  + (course.capabilities.examOverview.status === "available" ? 4 : 0)
  + (course.capabilities.syllabus.status === "available" ? 3 : 0)
  + (course.capabilities.statistics.status !== "unavailable" ? 1 : 0);

function dedupeCourses(courses: CourseContextEntry[]): CourseContextEntry[] {
  const selected = new Map<string, CourseContextEntry>();
  for (const course of courses) {
    const family = boardFamily(course.boardName);
    const level = family === "caie" && ["GCSE", "IGCSE"].includes(course.level) ? "IGCSE" : course.level;
    const key = `${family}:${level}:${token(course.subjectCode)}`;
    const existing = selected.get(key);
    if (!existing || courseRank(course) > courseRank(existing)) selected.set(key, course);
  }
  return [...selected.values()].sort((a, b) => courseRank(b) - courseRank(a) || a.label.localeCompare(b.label, "en-GB", { numeric: true }));
}

const availability = (course: CourseContextEntry): "answer-ready" | "partial" | "catalogued" => {
  if (course.capabilities.examOverview.status === "available" || course.capabilities.syllabus.status === "available") return "answer-ready";
  if (Object.values(course.capabilities).some(feature => feature.status !== "unavailable")) return "partial";
  return "catalogued";
};

const optionForCourse = (course: CourseContextEntry) => {
  const status = availability(course);
  const statusLabel = status === "answer-ready" ? "可查询已核验结构/考纲" : status === "partial" ? "仅部分资料可用" : "目前仅课程目录";
  return {
    optionId: course.qualificationId,
    label: `${course.boardName} ${course.level} ${course.subjectName}`,
    description: `${course.subjectCode} · ${statusLabel}`,
    qualificationCode: course.subjectCode,
    availability: status,
    scope: {
      awardQualificationIds: [],
      qualificationVersionIds: [],
      catalogQualificationIds: [course.qualificationId],
      source: "manual-selection" as const,
    },
  };
};

export function resolveCatalogQualificationMentions(
  message: string,
  courses: CourseContextEntry[],
  locale: "zh-CN" | "en-GB" = "zh-CN",
): CatalogQualificationResolution {
  const explicit = dedupeCourses(courses.filter(course => codeIsNamed(message, course.subjectCode)));
  const normalizedEnglishMessage = ` ${message.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const dynamicSubject = [...new Map(courses
    .filter(course => course.lifecycleStatus === "current")
    .map(course => [course.subjectName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), course])).entries()]
    .filter(([name]) => name.length >= 4 && normalizedEnglishMessage.includes(` ${name} `))
    .sort((a, b) => b[0].length - a[0].length)[0];
  const staticSubject = SUBJECT_PATTERNS.find(candidate => candidate.pattern.test(message));
  const subject = dynamicSubject
    ? { category: dynamicSubject[1].subjectCategory, label: dynamicSubject[1].subjectName, nameNeedle: dynamicSubject[0] }
    : staticSubject ? { ...staticSubject, nameNeedle: undefined } : undefined;
  if (!subject) return { matchedCourses: explicit.slice(0, 4) };

  const namedBoards = BOARD_PATTERNS.filter(board => board.pattern.test(message));
  const requestedLevels = levelFilters(message);
  const groups: AIClarification["groups"] = [];
  const inferred: CourseContextEntry[] = [];

  const evaluate = (family: string | undefined, label: string, requestedLevel?: string) => {
    let candidates = courses.filter(course =>
      course.lifecycleStatus === "current"
      && course.subjectCategory === subject.category
      && (!subject.nameNeedle || course.subjectName.toLowerCase().replace(/[^a-z0-9]+/g, " ").includes(subject.nameNeedle))
      && (!family || boardFamily(course.boardName) === family)
      && (!requestedLevel || course.level === requestedLevel || (requestedLevel === "IGCSE" && course.boardName === "CAIE" && course.level === "GCSE")),
    );
    candidates = dedupeCourses(candidates).filter(course => !explicit.some(item => token(item.subjectCode) === token(course.subjectCode)));
    if (candidates.length === 1) {
      inferred.push(candidates[0]);
      return;
    }
    if (candidates.length > 1) {
      groups.push({
        groupId: `${family ?? "all"}-${subject.category}-${requestedLevel ?? "all"}`,
        label,
        required: true,
        options: candidates.slice(0, 10).map(optionForCourse),
      });
    }
  };

  if (namedBoards.length > 0) {
    for (const board of namedBoards) {
      const levels = requestedLevels.length > 0 ? requestedLevels : [undefined];
      for (const requestedLevel of levels) {
        const alreadyExplicit = explicit.some(course => boardFamily(course.boardName) === board.family
          && course.subjectCategory === subject.category
          && (!requestedLevel || course.level === requestedLevel));
        if (!alreadyExplicit) evaluate(board.family, `${board.label} · ${requestedLevel ? `${requestedLevel} ` : ""}${subject.label}`, requestedLevel);
      }
    }
  } else {
    const levels = requestedLevels.length > 0 ? requestedLevels : [undefined];
    for (const requestedLevel of levels) {
      const explicitCoversRequestedLevel = explicit.some(course => course.subjectCategory === subject.category && (!requestedLevel || course.level === requestedLevel));
      if (!explicitCoversRequestedLevel) evaluate(undefined, `${requestedLevel ?? "全部资格"} · ${subject.label}`, requestedLevel);
    }
  }

  const matchedCourses = dedupeCourses([...explicit, ...inferred]).slice(0, 4);
  if (groups.length === 0) return { matchedCourses };
  const clarification = locale === "en-GB"
    ? "I found more than one qualification matching your wording. Select the exact qualification for each group, then I will continue your original question."
    : "你的表述对应多个资格。请在每组中选择准确的资格，我会沿用原问题继续回答。";
  return {
    matchedCourses,
    ambiguity: {
      ambiguityClass: "catalog-qualification",
      clarification,
      choices: {
        prompt: clarification,
        groups,
        submitLabel: locale === "en-GB" ? "Confirm and continue" : "确认并继续",
      },
    },
  };
}

export function resolveApprovedQualificationAliases(
  message: string,
  identities: QualificationIdentityV2[],
): QualificationIdentityV2[] {
  const normalizedMessageValue = normalizeAlias(message);
  const normalizedMessage = ` ${normalizedMessageValue} `;
  const compactMessage = normalizedMessageValue.replace(/\s+/g, "");
  return identities
    .filter(identity => identity.reviewStatus === "owner-approved")
    .map(identity => ({
      identity,
      matchedLength: identity.aliases.reduce((longest, alias) => {
        const normalized = normalizeAlias(alias);
        if (!normalized) return longest;
        const exactCode = /^[a-z]*\d+[a-z\d]*$/i.test(normalized);
        const containsCjk = /[\u3400-\u9fff]/.test(normalized);
        const matches = containsCjk
          ? compactMessage.includes(normalized.replace(/\s+/g, ""))
          : exactCode
          ? new RegExp(`(?:^|\\s)${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s)`, "i").test(normalizedMessage)
          : normalizedMessage.includes(` ${normalized} `);
        return matches ? Math.max(longest, normalized.length) : longest;
      }, 0),
    }))
    .filter(result => result.matchedLength > 0)
    .sort((a, b) => b.matchedLength - a.matchedLength || a.identity.awardQualificationId.localeCompare(b.identity.awardQualificationId))
    .slice(0, 4)
    .map(result => result.identity);
}

export function detectQualificationAmbiguity(message: string, locale: "zh-CN" | "en-GB" = "zh-CN"): QualificationAmbiguity | undefined {
  const normalized = message.toLowerCase();
  const hasBoard = /cambridge|caie|剑桥|pearson|edexcel|培生|爱德思|aqa|ocr/.test(normalized);
  const asksMath = /math|数学/.test(normalized);
  const hasExactIgcseMath = /\b(?:0580|4ma1|1ma1)\b/i.test(message);
  const hasExactALevelMath = /\b(?:9709|9231|8ma0|9ma0|yma01|xfm01|yfm01|xma01|7357|7367|h240|h245|h640|6993)\b/i.test(message);
  if (asksMath && /(?:igcse|i\s*g\b|ig数学|国际gcse)/i.test(message) && !hasExactIgcseMath && !hasBoard) {
    return {
      ambiguityClass: "generic-igcse-mathematics",
      clarification: locale === "en-GB"
        ? "Do you mean Cambridge IGCSE Mathematics 0580 or Pearson Edexcel International GCSE Mathematics A 4MA1?"
        : "你指的是 Cambridge IGCSE Mathematics 0580，还是 Pearson Edexcel International GCSE Mathematics A 4MA1？",
    };
  }
  if (asksMath && /(?:a[ -]?level|\bal\b|alevel|a级|a水准)/i.test(message) && !hasExactALevelMath && !hasBoard) {
    return {
      ambiguityClass: "generic-a-level-mathematics",
      clarification: locale === "en-GB"
        ? "Which board and route do you mean—for example CAIE 9709, AQA 7357, OCR H240/H640, or Pearson International A Level Mathematics YMA01?"
        : "你指的是哪个考试局和路线，例如 CAIE 9709、AQA 7357、OCR H240/H640，还是 Pearson International A Level Mathematics YMA01？",
    };
  }
  if (asksMath && /pearson|edexcel|培生|爱德思/.test(normalized)
    && !/\b(?:4ma1|8ma0|9ma0|yma01|yfm01)\b/i.test(message)
    && !/international|ial|igcse|国际|uk|英国|as\b|a[ -]?level/.test(normalized)) {
    return {
      ambiguityClass: "pearson-route",
      clarification: locale === "en-GB"
        ? "Do you mean a Pearson UK qualification or Pearson International Mathematics? Please provide the code if possible."
        : "你指的是 Pearson UK 本土版数学资格，还是 Pearson International 国际版数学？如可以，请提供课程代码。",
    };
  }
  return undefined;
}
