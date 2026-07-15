import type { ExamOverview } from "./schema";

const LOCAL = "/exam-materials";
const TIMETABLE_URL = "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-International-Advanced-Levels/ial-october2026-final.pdf";
const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: { normal: "每周一核对官方时间表", nearExam: "距离考试 60 天内每日核对", materials: "每月 1 日核对考纲、信息手册与考试资料" },
};
const region = { label: "中国大陆", note: "Pearson IAL 不按中国大陆区分试卷；仅展示 Morning / Afternoon，不推算当地钟点。" };
const series = [{ name: "January" }, { name: "Summer (May/June)" }, { name: "October" }];
const calculator = { status: "all" as const, summary: "所有单元均允许使用符合 Pearson 规定的计算器。", prohibited: ["符号代数、微分或积分", "文字、公式或资料库检索", "与其他设备或互联网通信"] };

export const PEARSON_IAL_BUSINESS_EXAM_OVERVIEWS: ExamOverview[] = [
  {
    id: "pearson-ial-economics", board: "Pearson Edexcel", qualification: "Pearson Edexcel International Advanced Level Economics", code: "YEC11 / XEC11", region, examSeries: series,
    paperCount: "IAS 由 Units 1–2 组成；完整 IAL 由 Units 1–4 组成，单元成绩可按 Pearson 规则跨考季累积。",
    nextExam: { date: "2026-10-12", session: "Morning", code: "WEC11 01", title: "Unit 1 · Markets in Action", durationMinutes: 105, group: "Unit 1" },
    components: [
      { code: "WEC11/01", name: "Unit 1 · Markets in Action", group: "Unit 1", durationMinutes: 105, marks: 80, weighting: "IAS 50% / IAL 25%", calculator: "allowed", assessmentMode: "written" },
      { code: "WEC12/01", name: "Unit 2 · Macroeconomic Performance and Policy", group: "Unit 2", durationMinutes: 105, marks: 80, weighting: "IAS 50% / IAL 25%", calculator: "allowed", assessmentMode: "written" },
      { code: "WEC13/01", name: "Unit 3 · Business Behaviour", group: "Unit 3", durationMinutes: 120, marks: 80, weighting: "IAL 25%", calculator: "allowed", assessmentMode: "written" },
      { code: "WEC14/01", name: "Unit 4 · Developments in the Global Economy", group: "Unit 4", durationMinutes: 120, marks: 80, weighting: "IAL 25%", calculator: "allowed", assessmentMode: "written" },
    ],
    routes: [
      { id: "ias", level: "IAS", label: "International AS", papers: ["WEC11/01", "WEC12/01"] },
      { id: "ial", level: "IAL", label: "International A Level", papers: ["WEC11/01", "WEC12/01", "WEC13/01", "WEC14/01"] },
    ],
    qualificationViews: [
      { key: "ial", label: "IAL", paperCount: "4 个单元：Units 1–4", componentGroups: ["Unit 1", "Unit 2", "Unit 3", "Unit 4"], routes: [{ id: "ial", level: "IAL", label: "Units 1–4", papers: ["WEC11/01", "WEC12/01", "WEC13/01", "WEC14/01"] }] },
      { key: "ias", label: "IAS", paperCount: "2 个单元：Units 1–2", componentGroups: ["Unit 1", "Unit 2"], routes: [{ id: "ias", level: "IAS", label: "Units 1–2", papers: ["WEC11/01", "WEC12/01"] }] },
    ],
    calculator,
    formula: { supplied: false, status: "not-provided", label: "公式与 Source booklet", summary: "官方考纲未列独立公式表；每个单元的数据题使用随考试提供的 Source booklet。" },
    practical: { status: "not-applicable", summary: "没有独立实践考试。", options: [] },
    upcomingSeries: "October 2026", timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-10-12", session: "Morning", code: "WEC11 01", title: "Unit 1 · Markets in Action", durationMinutes: 105, group: "Unit 1" },
      { date: "2026-10-16", session: "Morning", code: "WEC12 01", title: "Unit 2 · Macroeconomic Performance and Policy", durationMinutes: 105, group: "Unit 2" },
      { date: "2026-10-23", session: "Afternoon", code: "WEC13 01", title: "Unit 3 · Business Behaviour", durationMinutes: 120, group: "Unit 3" },
      { date: "2026-10-30", session: "Morning", code: "WEC14 01", title: "Unit 4 · Developments in the Global Economy", durationMinutes: 120, group: "Unit 4" },
    ],
    materials: [
      { id: "ial-econ-timetable", type: "timetable", title: "IAL October 2026 Timetable", version: "Final", status: "current", officialUrl: TIMETABLE_URL, previewUrl: `${LOCAL}/pearson-ial-october-2026-final.pdf` },
      { id: "ial-econ-spec", type: "syllabus", title: "IAL Economics Specification", version: "Issue 2 · June 2018", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Economics/2018/Specification-and-Sample-Assessment/International-A-Level-Economics-spec.pdf", previewUrl: `${LOCAL}/pearson-ial-economics-specification-issue2.pdf` },
      { id: "ial-econ-source", type: "data-booklet", title: "Source booklet assessment policy", version: "Specification pages 13–14", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Economics/2018/Specification-and-Sample-Assessment/International-A-Level-Economics-spec.pdf#page=13", previewUrl: `${LOCAL}/pearson-ial-economics-specification-issue2.pdf#page=13`, note: "Source booklet 是当场随考试提供的材料，不是 pre-release。" },
    ], release,
  },
  {
    id: "pearson-ial-business", board: "Pearson Edexcel", qualification: "Pearson Edexcel International Advanced Level Business", code: "YBS11 / XBS11", region, examSeries: series,
    paperCount: "IAS 由 Units 1–2 组成；完整 IAL 由 Units 1–4 组成，单元成绩可按 Pearson 规则跨考季累积。",
    nextExam: { date: "2026-10-08", session: "Morning", code: "WBS11 01", title: "Unit 1 · Marketing and People", durationMinutes: 120, group: "Unit 1" },
    components: [
      { code: "WBS11/01", name: "Unit 1 · Marketing and People", group: "Unit 1", durationMinutes: 120, marks: 80, weighting: "IAS 50% / IAL 25%", calculator: "allowed", assessmentMode: "written" },
      { code: "WBS12/01", name: "Unit 2 · Managing Business Activities", group: "Unit 2", durationMinutes: 120, marks: 80, weighting: "IAS 50% / IAL 25%", calculator: "allowed", assessmentMode: "written" },
      { code: "WBS13/01", name: "Unit 3 · Business Decisions and Strategy", group: "Unit 3", durationMinutes: 120, marks: 80, weighting: "IAL 25%", calculator: "allowed", assessmentMode: "written" },
      { code: "WBS14/01", name: "Unit 4 · Global Business", group: "Unit 4", durationMinutes: 120, marks: 80, weighting: "IAL 25%", calculator: "allowed", assessmentMode: "written" },
    ],
    routes: [
      { id: "ias", level: "IAS", label: "International AS", papers: ["WBS11/01", "WBS12/01"] },
      { id: "ial", level: "IAL", label: "International A Level", papers: ["WBS11/01", "WBS12/01", "WBS13/01", "WBS14/01"] },
    ],
    qualificationViews: [
      { key: "ial", label: "IAL", paperCount: "4 个单元：Units 1–4", componentGroups: ["Unit 1", "Unit 2", "Unit 3", "Unit 4"], routes: [{ id: "ial", level: "IAL", label: "Units 1–4", papers: ["WBS11/01", "WBS12/01", "WBS13/01", "WBS14/01"] }] },
      { key: "ias", label: "IAS", paperCount: "2 个单元：Units 1–2", componentGroups: ["Unit 1", "Unit 2"], routes: [{ id: "ias", level: "IAS", label: "Units 1–2", papers: ["WBS11/01", "WBS12/01"] }] },
    ],
    calculator,
    formula: { supplied: false, status: "not-provided", label: "财务比率与题内 sources", summary: "指定财务比率不会在考试中提供；各题使用试卷中的 sources，没有官方 pre-release 或独立公式手册。" },
    practical: { status: "not-applicable", summary: "没有独立实践考试。", options: [] },
    upcomingSeries: "October 2026", timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-10-08", session: "Morning", code: "WBS11 01", title: "Unit 1 · Marketing and People", durationMinutes: 120, group: "Unit 1" },
      { date: "2026-10-14", session: "Morning", code: "WBS12 01", title: "Unit 2 · Managing Business Activities", durationMinutes: 120, group: "Unit 2" },
      { date: "2026-10-20", session: "Morning", code: "WBS13 01", title: "Unit 3 · Business Decisions and Strategy", durationMinutes: 120, group: "Unit 3" },
      { date: "2026-10-27", session: "Morning", code: "WBS14 01", title: "Unit 4 · Global Business", durationMinutes: 120, group: "Unit 4" },
    ],
    materials: [
      { id: "ial-business-timetable", type: "timetable", title: "IAL October 2026 Timetable", version: "Final", status: "current", officialUrl: TIMETABLE_URL, previewUrl: `${LOCAL}/pearson-ial-october-2026-final.pdf` },
      { id: "ial-business-spec", type: "syllabus", title: "IAL Business Specification", version: "Issue 1 · September 2017", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Business/2018/Specification-and-Sample-Assessment/International-A-Level-Business-Spec.pdf", previewUrl: `${LOCAL}/pearson-ial-business-specification-issue1.pdf` },
      { id: "ial-business-ratios", type: "formula", title: "财务比率备考范围", version: "Specification · Units 2–3", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Business/2018/Specification-and-Sample-Assessment/International-A-Level-Business-Spec.pdf#page=22", previewUrl: `${LOCAL}/pearson-ial-business-specification-issue1.pdf#page=22`, note: "备考参考；考纲明确这些比率不会在考试中提供。" },
    ], release,
  },
  {
    id: "pearson-ial-accounting", board: "Pearson Edexcel", qualification: "Pearson Edexcel International Advanced Level Accounting", code: "YAC11 / XAC11", region, examSeries: series,
    paperCount: "IAS 由 Unit 1 组成；完整 IAL 由 Units 1–2 组成，单元成绩可按 Pearson 规则跨考季累积。",
    nextExam: { date: "2026-10-20", session: "Afternoon", code: "WAC11 01", title: "Unit 1 · The Accounting System and Costing", durationMinutes: 180, group: "Unit 1" },
    components: [
      { code: "WAC11/01", name: "Unit 1 · The Accounting System and Costing", group: "Unit 1", durationMinutes: 180, marks: 200, weighting: "IAS 100% / IAL 50%", calculator: "allowed", assessmentMode: "written", note: "随试卷提供 resource booklet。" },
      { code: "WAC12/01", name: "Unit 2 · Corporate and Management Accounting", group: "Unit 2", durationMinutes: 180, marks: 200, weighting: "IAL 50%", calculator: "allowed", assessmentMode: "written", note: "随试卷提供 resource booklet。" },
    ],
    routes: [
      { id: "ias", level: "IAS", label: "International AS", papers: ["WAC11/01"] },
      { id: "ial", level: "IAL", label: "International A Level", papers: ["WAC11/01", "WAC12/01"] },
    ],
    qualificationViews: [
      { key: "ial", label: "IAL", paperCount: "2 个单元：Units 1–2", componentGroups: ["Unit 1", "Unit 2"], routes: [{ id: "ial", level: "IAL", label: "Units 1–2", papers: ["WAC11/01", "WAC12/01"] }] },
      { key: "ias", label: "IAS", paperCount: "1 个单元：Unit 1", componentGroups: ["Unit 1"], routes: [{ id: "ias", level: "IAS", label: "Unit 1", papers: ["WAC11/01"] }] },
    ],
    calculator,
    formula: { supplied: false, status: "not-provided", label: "公式附录与 resource booklet", summary: "考纲 Appendix 7 列出必须掌握的公式，但明确不会在考试中提供；两张试卷另有当场发放的 resource booklet。" },
    practical: { status: "not-applicable", summary: "没有独立实践考试。", options: [] },
    upcomingSeries: "October 2026", timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-10-20", session: "Afternoon", code: "WAC11 01", title: "Unit 1 · The Accounting System and Costing", durationMinutes: 180, group: "Unit 1" },
      { date: "2026-10-27", session: "Afternoon", code: "WAC12 01", title: "Unit 2 · Corporate and Management Accounting", durationMinutes: 180, group: "Unit 2" },
    ],
    materials: [
      { id: "ial-accounting-timetable", type: "timetable", title: "IAL October 2026 Timetable", version: "Final", status: "current", officialUrl: TIMETABLE_URL, previewUrl: `${LOCAL}/pearson-ial-october-2026-final.pdf` },
      { id: "ial-accounting-spec", type: "syllabus", title: "IAL Accounting Specification", version: "Issue 2 · September 2018", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Accounting/2015/specification-and-sample-assessments/pearson-edexcel-ial-accounting-specification.pdf", previewUrl: `${LOCAL}/pearson-ial-accounting-specification-issue2.pdf` },
      { id: "ial-accounting-formulae", type: "formula", title: "Appendix 7 · Formulae", version: "Specification page 45", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Accounting/2015/specification-and-sample-assessments/pearson-edexcel-ial-accounting-specification.pdf#page=45", previewUrl: `${LOCAL}/pearson-ial-accounting-specification-issue2.pdf#page=45`, note: "这是备考公式清单；考纲明确不会在考试中发放。" },
      { id: "ial-accounting-resource", type: "reference-document", title: "Resource booklet policy", version: "Specification pages 12–13", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Accounting/2015/specification-and-sample-assessments/pearson-edexcel-ial-accounting-specification.pdf#page=12", previewUrl: `${LOCAL}/pearson-ial-accounting-specification-issue2.pdf#page=12`, note: "两张试卷均有当场随考卷发放的 resource booklet。" },
    ], release,
  },
];
