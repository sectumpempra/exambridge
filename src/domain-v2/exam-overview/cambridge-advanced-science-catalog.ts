import type { ExamOverview } from "./schema";

const LOCAL = "/exam-materials";
const TIMETABLE_URL = "https://www.cambridgeinternational.org/Images/757650-november-2026-zone-5-timetable.pdf";
const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: { normal: "每周一核对官方时间表", nearExam: "距离考试 60 天内每日核对", materials: "每月 1 日核对考纲与考试资料" },
};

type ScienceCode = "9700" | "9701" | "9702";
type AdvancedScienceInput = {
  code: ScienceCode;
  subject: string;
  dates: { paper1: string; paper2: string; practical35: string; practical36: string; paper4: string; paper5: string };
  syllabusUrl: string;
  syllabusFile: string;
  futureUrl: string;
  futureFile: string;
  formula: ExamOverview["formula"];
  references?: ExamOverview["materials"];
};

const sciencePaperDetails = [
  { paper: "1", name: "Multiple Choice", durationMinutes: 75, marks: 40, weighting: "AS 31% / A Level 15.5%", assessmentMode: "multiple-choice" as const },
  { paper: "2", name: "AS Level Structured Questions", durationMinutes: 75, marks: 60, weighting: "AS 46% / A Level 23%", assessmentMode: "written" as const },
  { paper: "3", name: "Advanced Practical Skills", durationMinutes: 120, marks: 40, weighting: "AS 23% / A Level 11.5%", assessmentMode: "practical" as const },
  { paper: "4", name: "A Level Structured Questions", durationMinutes: 120, marks: 100, weighting: "A Level 38.5%", assessmentMode: "written" as const },
  { paper: "5", name: "Planning, Analysis and Evaluation", durationMinutes: 75, marks: 30, weighting: "A Level 11.5%", assessmentMode: "written" as const },
];

function makeAdvancedScience(input: AdvancedScienceInput): ExamOverview {
  const upcomingExams = [
    { date: input.dates.practical35, session: "AM", code: `${input.code}/35`, title: "Paper 3 · Advanced Practical Skills", durationMinutes: 120, group: "AS / A Level" },
    { date: input.dates.paper2, session: "AM", code: `${input.code}/23`, title: "Paper 2 · AS Level Structured Questions", durationMinutes: 75, group: "AS / A Level" },
    { date: input.dates.paper5, session: "AM", code: `${input.code}/53`, title: "Paper 5 · Planning, Analysis and Evaluation", durationMinutes: 75, group: "A Level" },
    { date: input.dates.paper4, session: "AM", code: `${input.code}/43`, title: "Paper 4 · A Level Structured Questions", durationMinutes: 120, group: "A Level" },
    { date: input.dates.practical36, session: "AM", code: `${input.code}/36`, title: "Paper 3 · Advanced Practical Skills", durationMinutes: 120, group: "AS / A Level" },
    { date: input.dates.paper1, session: "AM", code: `${input.code}/13`, title: "Paper 1 · Multiple Choice", durationMinutes: 75, group: "AS / A Level" },
  ].sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const next = upcomingExams[0];
  return {
    id: `cambridge-${input.code}`,
    board: "Cambridge International",
    qualification: `Cambridge International AS & A Level ${input.subject}`,
    code: input.code,
    region: { label: "中国大陆 · Zone 5", note: "默认按上海对应的 Cambridge Administrative Zone 5 展示；AM / PM 是官方场次标签，不推算当地钟点。" },
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "AS Level 考 3 张；完整 A Level 共考 5 张。Paper 3 在 Zone 5 有 /35 与 /36 两个等值实验变体，考生只报其中一个。",
    nextExam: next,
    components: sciencePaperDetails.map((paper) => ({
      code: `Paper ${paper.paper}`,
      name: paper.name,
      durationMinutes: paper.durationMinutes,
      marks: paper.marks,
      weighting: paper.weighting,
      calculator: "allowed" as const,
      assessmentMode: paper.assessmentMode,
    })),
    routes: [
      { id: "as", level: "AS Level", label: "AS only / staged year 1", papers: ["Paper 1", "Paper 2", "Paper 3"] },
      { id: "staged-year-2", level: "A Level · staged", label: "Second year after AS", papers: ["Paper 4", "Paper 5"], note: "AS 成绩结转须符合当期 Cambridge handbook。" },
      { id: "linear", level: "A Level · linear", label: "All papers in one series", papers: ["Paper 1", "Paper 2", "Paper 3", "Paper 4", "Paper 5"] },
    ],
    calculator: { status: "all", summary: "允许使用符合 Cambridge 规定的计算器；仍以当期试卷封面和考试规章为准。", prohibited: ["符号代数、微分或积分", "与其他设备或互联网通信", "储存文字或资料库"] },
    formula: input.formula,
    practical: {
      status: "required",
      summary: "AS 与完整 A Level 都包含 Paper 3 实验考试；没有 Alternative to Practical 路线。",
      options: [
        { label: "Zone 5 variant 35", papers: [`${input.code}/35`], note: "与 /36 难度和能力要求等值，题目及日期不同。" },
        { label: "Zone 5 variant 36", papers: [`${input.code}/36`], note: "考生只参加一个 Paper 3 变体。" },
      ],
    },
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026",
    upcomingExams,
    materials: [
      { id: `${input.code}-timetable`, type: "timetable", title: "November 2026 Zone 5 Final Timetable", version: "Version 1 · April 2026", status: "current", officialUrl: TIMETABLE_URL, previewUrl: `${LOCAL}/november-2026-zone-5-timetable-v1.pdf` },
      { id: `${input.code}-syllabus`, type: "syllabus", title: `${input.code} Syllabus 2025–2027`, version: "Version 1 · September 2022", status: "current", officialUrl: input.syllabusUrl, previewUrl: `${LOCAL}/${input.syllabusFile}` },
      { id: `${input.code}-future`, type: "syllabus", title: `${input.code} Syllabus 2028–2030`, version: "Version 1 · September 2025", status: "future", officialUrl: input.futureUrl, previewUrl: `${LOCAL}/${input.futureFile}`, note: "已纳入生效前 120 天替换窗口监控。" },
      { id: `${input.code}-practical`, type: "practical-guidance", title: `${input.subject} practical assessment and route guidance`, version: "Current syllabus", status: "reference", officialUrl: input.syllabusUrl, previewUrl: `${LOCAL}/${input.syllabusFile}#page=10` },
      ...(input.references ?? []),
    ],
    release,
  };
}

export const CAMBRIDGE_ADVANCED_SCIENCE_EXAM_OVERVIEWS: ExamOverview[] = [
  makeAdvancedScience({
    code: "9700", subject: "Biology",
    dates: { practical35: "2026-10-06", paper2: "2026-10-20", paper5: "2026-10-20", paper4: "2026-10-23", practical36: "2026-10-29", paper1: "2026-11-12" },
    syllabusUrl: "https://www.cambridgeinternational.org/Images/664560-2025-2027-syllabus.pdf",
    syllabusFile: "9700-syllabus-2025-2027-v1.pdf",
    futureUrl: "https://www.cambridgeinternational.org/Images/744622-2028-2030-syllabus.pdf",
    futureFile: "9700-syllabus-2028-2030-v1.pdf",
    formula: { supplied: true, status: "provided", label: "数学公式资料", summary: "不要求记忆 A Level 数学公式；需要的资料会在试卷中提供，考纲也列出相关公式。" },
    references: [{ id: "9700-formula", type: "formula", title: "Mathematical requirements and formulae", version: "Current syllabus · pages 65–66", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/664560-2025-2027-syllabus.pdf#page=65", previewUrl: `${LOCAL}/9700-syllabus-2025-2027-v1.pdf#page=65` }],
  }),
  makeAdvancedScience({
    code: "9701", subject: "Chemistry",
    dates: { practical35: "2026-09-29", paper2: "2026-10-16", paper5: "2026-10-16", practical36: "2026-10-27", paper4: "2026-11-03", paper1: "2026-11-11" },
    syllabusUrl: "https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf",
    syllabusFile: "9701-syllabus-2025-2027-v1.pdf",
    futureUrl: "https://www.cambridgeinternational.org/Images/744624-2028-2030-syllabus.pdf",
    futureFile: "9701-syllabus-2028-2030-v1.pdf",
    formula: { supplied: true, status: "varies", label: "数据与周期表", summary: "Papers 1、2、4 不另发独立 Data Booklet；题目提供所需数据，所有试卷附常用常数和元素周期表。" },
    references: [{ id: "9701-data", type: "data-booklet", title: "Data section and Periodic Table", version: "Current syllabus · pages 80–91", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf#page=80", previewUrl: `${LOCAL}/9701-syllabus-2025-2027-v1.pdf#page=80` }],
  }),
  makeAdvancedScience({
    code: "9702", subject: "Physics",
    dates: { practical35: "2026-10-08", paper4: "2026-10-12", paper2: "2026-10-14", paper5: "2026-10-14", practical36: "2026-10-22", paper1: "2026-11-10" },
    syllabusUrl: "https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf",
    syllabusFile: "9702-syllabus-2025-2027-v1.pdf",
    futureUrl: "https://www.cambridgeinternational.org/Images/744626-2028-2030-syllabus.pdf",
    futureFile: "9702-syllabus-2028-2030-v1.pdf",
    formula: { supplied: true, status: "provided", label: "公式与数据", summary: "公式直接印在理论试卷中：Papers 1、2 第 2 页，Paper 4 第 2–3 页；不另发独立公式册。" },
    references: [{ id: "9702-formula", type: "formula", title: "Data and formulae", version: "Current syllabus · pages 58–60", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf#page=58", previewUrl: `${LOCAL}/9702-syllabus-2025-2027-v1.pdf#page=58` }],
  }),
  {
    id: "cambridge-9618", board: "Cambridge International", qualification: "Cambridge International AS & A Level Computer Science", code: "9618",
    region: { label: "中国大陆 · Zone 5", note: "默认按上海对应的 Cambridge Administrative Zone 5 展示；Paper 4 只有官方 test window，不推算 AM / PM 或当地钟点。" },
    examSeries: [{ name: "June" }, { name: "November" }],
    paperCount: "AS Level 考 Papers 1–2；完整 A Level 共考 Papers 1–4。可分阶段或同一考季完成。",
    nextExam: { date: "2026-10-09", session: "PM", code: "9618/12", title: "Paper 1 · Theory Fundamentals", durationMinutes: 90, group: "AS / A Level" },
    components: [
      { code: "Paper 1", name: "Theory Fundamentals", durationMinutes: 90, marks: 75, weighting: "AS 50% / A Level 25%", calculator: "not-allowed", assessmentMode: "written" },
      { code: "Paper 2", name: "Fundamental Problem-solving and Programming Skills", durationMinutes: 120, marks: 75, weighting: "AS 50% / A Level 25%", calculator: "not-allowed", assessmentMode: "written" },
      { code: "Paper 3", name: "Advanced Theory", durationMinutes: 90, marks: 75, weighting: "A Level 25%", calculator: "not-allowed", assessmentMode: "written" },
      { code: "Paper 4", name: "Practical", durationMinutes: 150, marks: 75, weighting: "A Level 25%", calculator: "not-allowed", assessmentMode: "programming", note: "使用 Java、Visual Basic .NET 或 Python 的 console mode；不得联网或使用电子邮件。" },
    ],
    routes: [
      { id: "as", level: "AS Level", label: "AS only / staged year 1", papers: ["Paper 1", "Paper 2"] },
      { id: "staged-year-2", level: "A Level · staged", label: "Second year after AS", papers: ["Paper 3", "Paper 4"] },
      { id: "linear", level: "A Level · linear", label: "All papers in one series", papers: ["Paper 1", "Paper 2", "Paper 3", "Paper 4"] },
    ],
    calculator: { status: "none", summary: "所有试卷均禁止使用计算器。", prohibited: ["任何计算器"] },
    formula: { supplied: false, status: "not-applicable", label: "考试参考资料", summary: "未识别到独立公式表或数据册；官方伪代码指南是教学准备资料，不是考场内发放的公式表。" },
    practical: { status: "required", summary: "完整 A Level 必考 Paper 4 上机实践；AS Level 不考 Paper 4。", options: [{ label: "A Level practical", papers: ["9618/42"], note: "2 小时 30 分；官方只公布 2026-10-29 test window，未标 AM / PM。" }] },
    upcomingSeries: "November 2026 · Zone 5", timetableStatus: "Final · Version 1 · April 2026",
    upcomingExams: [
      { date: "2026-10-09", session: "PM", code: "9618/12", title: "Paper 1 · Theory Fundamentals", durationMinutes: 90, group: "AS / A Level" },
      { date: "2026-10-14", session: "PM", code: "9618/22", title: "Paper 2 · Problem-solving and Programming Skills", durationMinutes: 120, group: "AS / A Level" },
      { date: "2026-10-20", session: "PM", code: "9618/32", title: "Paper 3 · Advanced Theory", durationMinutes: 90, group: "A Level" },
      { date: "2026-10-29", session: "Test window", code: "9618/42", title: "Paper 4 · Practical", durationMinutes: 150, group: "A Level" },
    ],
    materials: [
      { id: "9618-timetable", type: "timetable", title: "November 2026 Zone 5 Final Timetable", version: "Version 1 · April 2026", status: "current", officialUrl: TIMETABLE_URL, previewUrl: `${LOCAL}/november-2026-zone-5-timetable-v1.pdf` },
      { id: "9618-syllabus", type: "syllabus", title: "9618 Syllabus 2026", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/697372-2026-syllabus.pdf", previewUrl: `${LOCAL}/9618-syllabus-2026-v2.pdf` },
      { id: "9618-update", type: "update-notice", title: "9618 Syllabus Update 2026", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/747145-2026-syllabus-update.pdf", previewUrl: `${LOCAL}/9618-syllabus-update-2026.pdf` },
      { id: "9618-future", type: "syllabus", title: "9618 Syllabus 2027–2029", version: "Version 2 · December 2025", status: "future", officialUrl: "https://www.cambridgeinternational.org/Images/721397-2027-2029-syllabus.pdf", previewUrl: `${LOCAL}/9618-syllabus-2027-2029-v2.pdf`, note: "已纳入生效前 120 天替换窗口监控。" },
      { id: "9618-pseudocode", type: "practical-guidance", title: "9618 Pseudocode Guide for Teachers", version: "2026", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/697401-2026-pseudocode-guide-for-teachers.pdf", previewUrl: `${LOCAL}/9618-pseudocode-guide-2026-v1.pdf`, note: "教学准备资料，不作为考场公式表展示。" },
    ],
    release,
  },
];
