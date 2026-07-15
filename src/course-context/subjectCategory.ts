import type { SubjectCategory } from "./types";

export const SUBJECT_CATEGORY_LABELS: Record<SubjectCategory, string> = {
  mathematics: "数学类",
  physics: "物理类",
  chemistry: "化学类",
  biology: "生物类",
  "computer-science": "计算机类",
  economics: "经济与商科",
  accounting: "会计类",
  humanities: "人文与社会科学",
  languages: "语言与文学",
  creative: "艺术与创意",
  other: "其他",
};

const AQA_PREFIX_NAMES: Record<string, string> = {
  AC: "Accounting",
  BL: "Biology",
  BU: "Business",
  CH: "Chemistry",
  CS: "Computer Science",
  EC: "Economics",
  EN: "English Language",
  FM: "Further Mathematics",
  GG: "Geography",
  LT: "English Literature",
  MA: "Mathematics",
  PH: "Physics",
  PS: "Psychology",
};

export function normalizeCourseSubjectName(board: string, code: string, name: string): string {
  if (board === "AQA" && AQA_PREFIX_NAMES[code] && (!name || name === code)) return AQA_PREFIX_NAMES[code];
  return name || code;
}

export function classifySubject(subjectName: string, subjectCode: string): SubjectCategory {
  const name = subjectName.toLowerCase();
  const code = subjectCode.toUpperCase();
  const has = (pattern: RegExp) => pattern.test(name);

  if (/^(WMA|WFM|WME|WST|WDM|MA|FM)/.test(code) || has(/mathemat|further math|pure math|mechanic|statistics|decision math|numerical math/)) return "mathematics";
  if (/^(WPH|PH$|PHYS$)/.test(code) || has(/physics|physical science/)) return "physics";
  if (/^(WCH|CH)/.test(code) || has(/chemistry|chemical science/)) return "chemistry";
  if (/^(WBI|BL)/.test(code) || has(/biology|biological|human biology/)) return "biology";
  if (/^(CS)/.test(code) || has(/computer science|computing|information technology|digital technology|informatics/)) return "computer-science";
  if (/^(WAC|AC)/.test(code) || has(/accounting|accountancy/)) return "accounting";
  if (/^(WEC|WBS|EC|BU)/.test(code) || has(/economics|business|commerce|enterprise|marketing/)) return "economics";
  if (has(/english|literature|language|french|german|spanish|arabic|chinese|mandarin|urdu|italian|portuguese|japanese|latin|greek|linguistic/)) return "languages";
  if (has(/art|design|music|drama|theatre|media|film|photograph|dance|fashion/)) return "creative";
  if (has(/geography|history|psychology|sociology|politic|law|anthropology|archaeology|religious|philosophy|citizenship|classical|social science|government/)) return "humanities";
  return "other";
}
