import type { ExamOverview } from "./schema";

const LOCAL = "/exam-materials";
const TIMETABLE_URL = "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-Edexcel-International-GCSE/intgcse-nov-2026-final.pdf";
const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: { normal: "每周一核对官方时间表", nearExam: "距离考试 60 天内每日核对", materials: "每月 1 日核对考纲、信息手册与考试资料" },
};

const commonRegion = {
  label: "中国大陆",
  note: "November 2026 使用标准试卷；Summer 中国大陆使用 R regional papers。仅展示 Morning / Afternoon，不推算当地钟点。",
};

export const PEARSON_IGCSE_BUSINESS_EXAM_OVERVIEWS: ExamOverview[] = [
  {
    id: "pearson-igcse-4ec1",
    board: "Pearson Edexcel",
    qualification: "Pearson Edexcel International GCSE Economics",
    code: "4EC1",
    region: commonRegion,
    examSeries: [{ name: "June", note: "中国大陆使用 R papers" }, { name: "November", note: "使用标准试卷" }],
    paperCount: "线性资格共 2 张必考试卷；不分 tier，可选择纸笔或 onscreen assessment。",
    nextExam: { date: "2026-11-11", session: "Morning", code: "4EC1/01", title: "Microeconomics and Business Economics", durationMinutes: 90 },
    components: [
      { code: "4EC1/01", name: "Paper 1 · Microeconomics and Business Economics", durationMinutes: 90, marks: 80, weighting: "50%", calculator: "allowed", assessmentMode: "written", note: "4 道必答题；含选择、简答、data response 与开放题。" },
      { code: "4EC1/02", name: "Paper 2 · Macroeconomics and the Global Economy", durationMinutes: 90, marks: 80, weighting: "50%", calculator: "allowed", assessmentMode: "written", note: "4 道必答题；含选择、简答、data response 与开放题。" },
    ],
    routes: [
      { id: "paper", level: "International GCSE", label: "Paper-based linear", papers: ["4EC1/01", "4EC1/02"] },
      { id: "onscreen", level: "International GCSE", label: "Onscreen linear", papers: ["4EC1/01", "4EC1/02"], note: "题目与考试时间相同；报名选项由考点确认。" },
    ],
    calculator: { status: "all", summary: "现行 Issue 3 考纲明确两张试卷均可使用符合 Pearson 规定的计算器。", prohibited: ["符号代数、微分或积分", "文字、公式或资料库检索", "与其他设备或互联网通信"] },
    formula: { supplied: false, status: "not-provided", label: "公式资料", summary: "没有独立公式表；考纲中的经济公式属于课程内容，不代表考试发放公式资料。" },
    practical: { status: "not-applicable", summary: "没有独立实践考试。", options: [] },
    upcomingSeries: "November 2026",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-11-11", session: "Morning", code: "4EC1/01", title: "Microeconomics and Business Economics", durationMinutes: 90 },
      { date: "2026-11-19", session: "Morning", code: "4EC1/02", title: "Macroeconomics and the Global Economy", durationMinutes: 90 },
    ],
    materials: [
      { id: "4ec1-timetable", type: "timetable", title: "International GCSE November 2026 Timetable", version: "Final", status: "current", officialUrl: TIMETABLE_URL, previewUrl: `${LOCAL}/pearson-intgcse-november-2026-final.pdf` },
      { id: "4ec1-spec", type: "syllabus", title: "International GCSE Economics Specification", version: "Issue 3 · February 2026", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Economics/2017/Specification%20and%20SAMS/international-gcse-spec-9781446942789.pdf", previewUrl: `${LOCAL}/pearson-4ec1-specification-issue3.pdf` },
    ],
    release,
  },
  {
    id: "pearson-igcse-4bs1",
    board: "Pearson Edexcel",
    qualification: "Pearson Edexcel International GCSE Business",
    code: "4BS1",
    region: commonRegion,
    examSeries: [{ name: "June", note: "中国大陆使用 R papers" }, { name: "November", note: "使用标准试卷" }],
    paperCount: "线性资格共 2 张必考试卷；不分 tier，可选择纸笔或 onscreen assessment。",
    nextExam: { date: "2026-11-10", session: "Morning", code: "4BS1/01", title: "Investigating small businesses", durationMinutes: 90 },
    components: [
      { code: "4BS1/01", name: "Paper 1 · Investigating small businesses", durationMinutes: 90, marks: 80, weighting: "50%", calculator: "allowed", assessmentMode: "written", note: "使用不超过 49 名员工的小企业情境。" },
      { code: "4BS1/02", name: "Paper 2 · Investigating large businesses", durationMinutes: 90, marks: 80, weighting: "50%", calculator: "allowed", assessmentMode: "written", note: "使用超过 250 名员工的大型企业情境。" },
    ],
    routes: [
      { id: "paper", level: "International GCSE", label: "Paper-based linear", papers: ["4BS1/01", "4BS1/02"] },
      { id: "onscreen", level: "International GCSE", label: "Onscreen linear", papers: ["4BS1/01", "4BS1/02"], note: "题目与考试时间相同；报名选项由考点确认。" },
    ],
    calculator: { status: "all", summary: "现行 Issue 2 考纲明确两张试卷均可使用符合 Pearson 规定的计算器。", prohibited: ["符号代数、微分或积分", "文字、公式或资料库检索", "与其他设备或互联网通信"] },
    formula: { supplied: true, status: "provided", label: "试卷内公式", summary: "Paper 1 与 Paper 2 都会在试卷内提供指定财务公式；不是单独的公式手册。" },
    practical: { status: "not-applicable", summary: "没有独立实践考试。", options: [] },
    upcomingSeries: "November 2026",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-11-10", session: "Morning", code: "4BS1/01", title: "Investigating small businesses", durationMinutes: 90 },
      { date: "2026-11-17", session: "Morning", code: "4BS1/02", title: "Investigating large businesses", durationMinutes: 90 },
    ],
    materials: [
      { id: "4bs1-timetable", type: "timetable", title: "International GCSE November 2026 Timetable", version: "Final", status: "current", officialUrl: TIMETABLE_URL, previewUrl: `${LOCAL}/pearson-intgcse-november-2026-final.pdf` },
      { id: "4bs1-spec", type: "syllabus", title: "International GCSE Business Specification", version: "Issue 2 · February 2026", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Business%20Studies/2017/specification-and-sample-assessment/9781446942765-international-gcse-business-specification.pdf", previewUrl: `${LOCAL}/pearson-4bs1-specification-issue2.pdf` },
      { id: "4bs1-formula", type: "formula", title: "Paper 1 & 2 财务公式", version: "Specification Appendix 4 · page 34", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Business%20Studies/2017/specification-and-sample-assessment/9781446942765-international-gcse-business-specification.pdf#page=34", previewUrl: `${LOCAL}/pearson-4bs1-specification-issue2.pdf#page=34`, note: "该页列出会印在两张试卷内的公式。" },
    ],
    release,
  },
  {
    id: "pearson-igcse-4ac1",
    board: "Pearson Edexcel",
    qualification: "Pearson Edexcel International GCSE Accounting",
    code: "4AC1",
    region: commonRegion,
    examSeries: [{ name: "June", note: "中国大陆使用 R papers" }, { name: "November", note: "较新 information manual 已以 November 取代 January；旧考纲文字尚未更新" }],
    paperCount: "线性资格共 2 张必考试卷；两张须在 terminal series 完成。",
    nextExam: { date: "2026-10-28", session: "Morning", code: "4AC1/01", title: "Introduction to Bookkeeping and Accounting", durationMinutes: 120 },
    components: [
      { code: "4AC1/01", name: "Paper 1 · Introduction to Bookkeeping and Accounting", durationMinutes: 120, marks: 100, weighting: "66.6%", calculator: "allowed", assessmentMode: "written", note: "计算器结论来自官方 SAM 与历史正式题面；当届题面仍需复核。" },
      { code: "4AC1/02", name: "Paper 2 · Financial Statements", durationMinutes: 75, marks: 50, weighting: "33.3%", calculator: "allowed", assessmentMode: "written", note: "两道必答 multi-part questions；计算器规则需按当届题面复核。" },
    ],
    routes: [{ id: "linear", level: "International GCSE", label: "Linear", papers: ["4AC1/01", "4AC1/02"], note: "4WAC1 modular 是另一资格路线，不并入本组。" }],
    calculator: { status: "all", summary: "官方 SAM、2021 Paper 1 与 2024 Paper 2 均允许计算器；现行考纲本身沉默，因此每个未来考季仍要核对正式题面。", prohibited: ["以当届题面及 Pearson 通用考试规则为准"] },
    formula: { supplied: false, status: "not-provided", label: "公式资料", summary: "现行考纲未指定公式表；官方样卷和历史正式题面均写明无需其他材料。" },
    practical: { status: "not-applicable", summary: "没有独立实践考试。", options: [] },
    upcomingSeries: "November 2026",
    timetableStatus: "Final · stale-spec conflict monitored",
    upcomingExams: [
      { date: "2026-10-28", session: "Morning", code: "4AC1/01", title: "Introduction to Bookkeeping and Accounting", durationMinutes: 120 },
      { date: "2026-11-05", session: "Morning", code: "4AC1/02", title: "Financial Statements", durationMinutes: 75 },
    ],
    materials: [
      { id: "4ac1-timetable", type: "timetable", title: "International GCSE November 2026 Timetable", version: "Final", status: "current", officialUrl: TIMETABLE_URL, previewUrl: `${LOCAL}/pearson-intgcse-november-2026-final.pdf`, note: "较新的 FINAL timetable 与 information manual 共同作为运营日期依据。" },
      { id: "4ac1-spec", type: "syllabus", title: "International GCSE Accounting Specification", version: "Issue 1 · October 2016", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Accounting/2017/Specification-and-sample-assessments/ig-accountancy-spec.pdf", previewUrl: `${LOCAL}/pearson-4ac1-specification-issue1.pdf`, note: "规格仍写 January/June；官方手册说明 January 2023 为最后一届并由 November 取代，需持续监控修订。" },
    ],
    release,
  },
];
