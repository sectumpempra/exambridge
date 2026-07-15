import type { ExamOverview } from "./schema";

const LOCAL = "/exam-materials";
const TIMETABLE_URL = "https://www.cambridgeinternational.org/Images/757650-november-2026-zone-5-timetable.pdf";
const HANDBOOK_URL = "https://www.cambridgeinternational.org/Images/746922-cambridge-handbook-2026.pdf";

const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: {
    normal: "每周一核对 Cambridge Zone 5 官方时间表；发现修订时先生成变更报告，等待人工确认后发布",
    nearExam: "距离考试 60 天内每日核对；最终试卷可用时复核封面与 additional materials list",
    materials: "每月 1 日核对考纲、update notice、insert 与继任课程；生效前 120 天进入替换窗口",
  },
};

const region = {
  label: "中国大陆 · Zone 5",
  note: "默认按 Cambridge Guide to Making Entries 中的 China Administrative Zone 5 展示；AM / PM / EV 是官方场次标签，不推算当地钟点。",
};

const timetableMaterial = (code: string): ExamOverview["materials"][number] => ({
  id: `${code}-timetable`,
  type: "timetable",
  title: "November 2026 Zone 5 Final Timetable",
  version: "Final · Version 1 · April 2026",
  status: "current",
  officialUrl: TIMETABLE_URL,
  previewUrl: `${LOCAL}/november-2026-zone-5-timetable.pdf`,
  note: "官方称其为 Final，但明确仍可能修订；任何变化须先生成更新报告并经人工确认后发布。",
});

const noPractical: ExamOverview["practical"] = {
  status: "not-applicable",
  summary: "资格全部通过外部书面考试评估，没有独立实践考试。",
  options: [],
};

const advancedRoutes: ExamOverview["routes"] = [
  { id: "as", level: "AS Level", label: "AS only / staged year 1", papers: ["Paper 1", "Paper 2"], note: "两张在同一考季完成。" },
  { id: "staged-year-2", level: "A Level · staged", label: "Second year after AS", papers: ["Paper 3", "Paper 4"], note: "AS 成绩结转须符合当期 Cambridge Handbook 的规则与时限。" },
  { id: "linear", level: "A Level · linear", label: "All papers in one series", papers: ["Paper 1", "Paper 2", "Paper 3", "Paper 4"] },
];

export const CAMBRIDGE_BUSINESS_EXAM_OVERVIEWS: ExamOverview[] = [
  {
    id: "cambridge-0455",
    board: "Cambridge International",
    qualification: "Cambridge IGCSE Economics",
    code: "0455",
    region,
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "2 张必考试卷；Paper 1 占 30%，Paper 2 占 70%。",
    nextExam: { date: "2026-10-20", session: "AM", code: "0455/23", title: "Paper 2 · Structured Questions", durationMinutes: 135 },
    components: [
      { code: "Paper 1", name: "Multiple Choice", durationMinutes: 45, marks: 30, weighting: "30%", calculator: "allowed", assessmentMode: "multiple-choice" },
      {
        code: "Paper 2", name: "Structured Questions", durationMinutes: 135, marks: 90, weighting: "70%", calculator: "allowed", assessmentMode: "written",
        note: "Section A 包含此前未见的 source material，Section B 题目带 stimulus material；当前考纲未说明它们使用独立 insert。",
      },
    ],
    routes: [{ id: "single", level: "IGCSE · grades A*–G", label: "Single route", papers: ["Paper 1", "Paper 2"], note: "两张均为必考。" }],
    calculator: {
      status: "all",
      summary: "当前科目考纲明确两张试卷均可使用计算器。",
      prohibited: ["图形显示", "资料库、字典或语言翻译", "文字或公式检索与操作", "QWERTY 键盘", "符号代数、微分或积分"],
    },
    formula: {
      supplied: false,
      status: "unknown",
      label: "公式与 source material",
      summary: "当前考纲未说明提供独立公式表；Paper 2 的 source / stimulus material 包装未明确为独立 insert，不作该推断。",
    },
    practical: noPractical,
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026；仍可能修订，变更须人工确认后发布",
    upcomingExams: [
      { date: "2026-10-20", session: "AM", code: "0455/23", title: "Paper 2 · Structured Questions", durationMinutes: 135 },
      { date: "2026-11-04", session: "EV", code: "0455/13", title: "Paper 1 · Multiple Choice", durationMinutes: 45 },
    ],
    materials: [
      timetableMaterial("0455"),
      { id: "0455-current", type: "syllabus", title: "0455 Syllabus 2026", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/697154-2026-syllabus.pdf", previewUrl: `${LOCAL}/0455-2026-syllabus.pdf`, note: "当前考纲未说明 pre-release 要求；这不是对未公开保密材料的断言。" },
      { id: "0455-update", type: "update-notice", title: "0455 Syllabus Update 2026", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/748848-2026-syllabus-update.pdf", previewUrl: `${LOCAL}/0455-2026-syllabus-update.pdf`, note: "仅更新网页链接；specimen materials 未更新。" },
      { id: "0455-future", type: "syllabus", title: "0455 Syllabus 2027–2029", version: "Version 1", status: "future", officialUrl: "https://www.cambridgeinternational.org/Images/718148-2027-2029-syllabus.pdf", previewUrl: `${LOCAL}/0455-2027-2029-syllabus.pdf`, note: "同一课程代码的未来考纲；已纳入生效前 120 天替换窗口监控。" },
    ],
    release,
  },
  {
    id: "cambridge-0450",
    board: "Cambridge International",
    qualification: "Cambridge IGCSE Business Studies",
    code: "0450",
    region,
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度；0450 最后考试年份为 2026" }],
    paperCount: "2 张必考试卷；每张 1 小时 30 分钟、80 marks，各占 50%。0450 在 2026 后结束，2027 起由新代码 0264 继任。",
    nextExam: { date: "2026-10-06", session: "PM", code: "0450/12", title: "Paper 1 · Short Answer and Data Response", durationMinutes: 90 },
    components: [
      { code: "Paper 1", name: "Short Answer and Data Response", durationMinutes: 90, marks: 80, weighting: "50%", calculator: "allowed", assessmentMode: "written", note: "计算器许可来自 Cambridge Handbook 默认规则；最终试卷封面仍须复核。" },
      {
        code: "Paper 2", name: "Case Study", durationMinutes: 90, marks: 80, weighting: "50%", calculator: "allowed", assessmentMode: "written",
        note: "case study 作为独立 insert 提供，appendices 可能包含表格、图表、报刊摘录和广告；计算器许可须在最终试卷封面复核。",
      },
    ],
    routes: [{ id: "single", level: "IGCSE · grades A*–G", label: "Single route", papers: ["Paper 1", "Paper 2"], note: "两张均为必考。" }],
    calculator: {
      status: "all",
      summary: "0450 科目考纲未说明计算器；按 Cambridge Handbook 2026 第 105 页默认允许，除非最终试卷封面或 additional materials list 禁止。发布前必须复核。",
      prohibited: ["图形显示", "资料库、字典或语言翻译", "文字或公式检索与操作", "QWERTY 键盘", "符号代数、微分或积分"],
    },
    formula: {
      supplied: false,
      status: "unknown",
      label: "公式与 case study insert",
      summary: "当前考纲未说明提供独立公式表；Paper 2 明确提供独立 case study insert。",
    },
    practical: noPractical,
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026；仍可能修订，变更须人工确认后发布",
    upcomingExams: [
      { date: "2026-10-06", session: "PM", code: "0450/12", title: "Paper 1 · Short Answer and Data Response", durationMinutes: 90 },
      { date: "2026-10-16", session: "PM", code: "0450/22", title: "Paper 2 · Case Study", durationMinutes: 90 },
    ],
    materials: [
      timetableMaterial("0450"),
      { id: "0450-current", type: "syllabus", title: "0450 Syllabus 2026", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/697146-2026-syllabus.pdf", previewUrl: `${LOCAL}/0450-2026-syllabus.pdf`, note: "当前考纲未说明 pre-release 要求；这不是对未公开保密材料的断言。" },
      { id: "0450-update", type: "update-notice", title: "0450 Syllabus Update 2026", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/748842-2026-syllabus-update.pdf", previewUrl: `${LOCAL}/0450-2026-syllabus-update.pdf`, note: "仅更新网页链接；specimen materials 未更新。" },
      {
        id: "0450-successor-notice", type: "update-notice", title: "0450 → 0264 qualification transition", version: "First assessment March 2027", status: "future",
        officialUrl: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-business-studies-0450/", previewUrl: `${LOCAL}/0264-2027-2029-syllabus.pdf`,
        note: "Cambridge 官方通知：Business Studies 0450 从 2027 年 3 月首次评估起改为 Business 0264。必须建模为继任代码，不能把 0264 当作 0450 的同代码未来考纲。",
      },
      { id: "0264-successor", type: "syllabus", title: "0264 Business Syllabus 2027–2029", version: "Version 2", status: "future", officialUrl: "https://www.cambridgeinternational.org/Images/718123-2027-2029-syllabus.pdf", previewUrl: `${LOCAL}/0264-2027-2029-syllabus.pdf`, note: "0450 的继任课程；已纳入生效前 120 天迁移监控窗口，并须保留独立课程代码。" },
      { id: "0264-successor-update", type: "update-notice", title: "0264 Syllabus Update 2027–2029", version: "Version 2", status: "future", officialUrl: "https://www.cambridgeinternational.org/Images/730913-2027-2029-syllabus-update.pdf", previewUrl: `${LOCAL}/0264-2027-2029-syllabus-update.pdf`, note: "用于监控继任课程考纲修订；不会覆盖 0450 的 2026 历史记录。" },
      { id: "0450-calculator-rule", type: "reference-document", title: "Cambridge Handbook 2026 · Calculator rule", version: "Section 5.1.7.1 · page 105", status: "reference", officialUrl: `${HANDBOOK_URL}#page=105`, previewUrl: `${LOCAL}/cambridge-handbook-2026.pdf`, note: "站内预览是官方手册第 105 页快照；科目考纲静默时适用默认规则，最终试卷封面仍可覆盖。" },
    ],
    release,
  },
  {
    id: "cambridge-0452",
    board: "Cambridge International",
    qualification: "Cambridge IGCSE Accounting",
    code: "0452",
    region,
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "2 张必考试卷；Paper 1 占 30%，Paper 2 占 70%。",
    nextExam: { date: "2026-10-13", session: "AM", code: "0452/23", title: "Paper 2 · Structured Written Paper", durationMinutes: 105 },
    components: [
      { code: "Paper 1", name: "Multiple Choice", durationMinutes: 75, marks: 35, weighting: "30%", calculator: "allowed", assessmentMode: "multiple-choice" },
      { code: "Paper 2", name: "Structured Written Paper", durationMinutes: 105, marks: 100, weighting: "70%", calculator: "allowed", assessmentMode: "written" },
    ],
    routes: [{ id: "single", level: "IGCSE · grades A*–G", label: "Single route", papers: ["Paper 1", "Paper 2"], note: "两张均为必考。" }],
    calculator: {
      status: "all",
      summary: "当前科目考纲明确两张试卷均可使用计算器。",
      prohibited: ["图形显示", "资料库、字典或语言翻译", "文字或公式检索与操作", "QWERTY 键盘", "符号代数、微分或积分"],
    },
    formula: {
      supplied: false,
      status: "unknown",
      label: "Accounting ratios",
      summary: "所需 accounting ratios 列在当前考纲附录第 19 页，但考纲没有说明考试时会在试卷中重印；不要显示为已确认提供的公式表。",
    },
    practical: noPractical,
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026；仍可能修订，变更须人工确认后发布",
    upcomingExams: [
      { date: "2026-10-13", session: "AM", code: "0452/23", title: "Paper 2 · Structured Written Paper", durationMinutes: 105 },
      { date: "2026-11-06", session: "AM", code: "0452/13", title: "Paper 1 · Multiple Choice", durationMinutes: 75 },
    ],
    materials: [
      timetableMaterial("0452"),
      { id: "0452-current", type: "syllabus", title: "0452 Syllabus 2026", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/697149-2026-syllabus.pdf", previewUrl: `${LOCAL}/0452-2026-syllabus.pdf`, note: "当前考纲未说明 pre-release 要求；ratio 附录是否随试卷提供仍未知。" },
      { id: "0452-update", type: "update-notice", title: "0452 Syllabus Update 2026", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/748844-2026-syllabus-update.pdf", previewUrl: `${LOCAL}/0452-2026-syllabus-update.pdf`, note: "仅更新网页链接；specimen materials 未更新。" },
      { id: "0452-ratios", type: "formula", title: "Accounting ratios appendix", version: "Current syllabus · page 19", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/697149-2026-syllabus.pdf#page=19", previewUrl: `${LOCAL}/0452-2026-syllabus.pdf#page=19`, note: "仅作为考纲中的学习参考；现有一手证据未确认考场随试卷发放。" },
      { id: "0452-future", type: "syllabus", title: "0452 Syllabus 2027–2029", version: "Version 1", status: "future", officialUrl: "https://www.cambridgeinternational.org/Images/718141-2027-2029-syllabus.pdf", previewUrl: `${LOCAL}/0452-2027-2029-syllabus.pdf`, note: "同一课程代码的未来考纲；已纳入生效前 120 天替换窗口监控。" },
    ],
    release,
  },
  {
    id: "cambridge-9708",
    board: "Cambridge International",
    qualification: "Cambridge International AS & A Level Economics",
    code: "9708",
    region,
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "AS Level 考 Papers 1–2；完整 A Level 共考 Papers 1–4，可分阶段或同一考季完成。",
    nextExam: { date: "2026-10-06", session: "PM", code: "9708/22", title: "Paper 2 · AS Level Data Response and Essays", durationMinutes: 120, group: "AS / A Level" },
    components: [
      { code: "Paper 1", name: "AS Level Multiple Choice", durationMinutes: 60, marks: 30, weighting: "AS 33% / A Level 17%", calculator: "allowed", assessmentMode: "multiple-choice" },
      { code: "Paper 2", name: "AS Level Data Response and Essays", durationMinutes: 120, marks: 60, weighting: "AS 67% / A Level 33%", calculator: "allowed", assessmentMode: "written", note: "Section A 包含 written / numerical / diagrammatic source material；考纲未说明独立 insert。" },
      { code: "Paper 3", name: "A Level Multiple Choice", durationMinutes: 75, marks: 30, weighting: "A Level 17%", calculator: "allowed", assessmentMode: "multiple-choice" },
      { code: "Paper 4", name: "A Level Data Response and Essays", durationMinutes: 120, marks: 60, weighting: "A Level 33%", calculator: "allowed", assessmentMode: "written", note: "Section A 包含 written / numerical / diagrammatic source material；考纲未说明独立 insert。" },
    ],
    routes: advancedRoutes,
    calculator: {
      status: "all",
      summary: "当前科目考纲明确所有试卷均可使用计算器。",
      prohibited: ["图形显示", "资料库、字典或语言翻译", "文字或公式检索与操作", "QWERTY 键盘", "符号代数、微分或积分"],
    },
    formula: {
      supplied: false,
      status: "not-provided",
      label: "Formulae and source material",
      summary: "考纲明确公式不会在试卷中提供；Paper 2、4 的 Section A 含 source material，但未说明独立 insert。",
    },
    practical: noPractical,
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026；仍可能修订，变更须人工确认后发布",
    upcomingExams: [
      { date: "2026-10-06", session: "PM", code: "9708/22", title: "Paper 2 · AS Level Data Response and Essays", durationMinutes: 120, group: "AS / A Level" },
      { date: "2026-10-13", session: "PM", code: "9708/42", title: "Paper 4 · A Level Data Response and Essays", durationMinutes: 120, group: "A Level" },
      { date: "2026-11-05", session: "PM", code: "9708/12", title: "Paper 1 · AS Level Multiple Choice", durationMinutes: 60, group: "AS / A Level" },
      { date: "2026-11-11", session: "PM", code: "9708/32", title: "Paper 3 · A Level Multiple Choice", durationMinutes: 75, group: "A Level" },
    ],
    materials: [
      timetableMaterial("9708"),
      { id: "9708-current", type: "syllabus", title: "9708 Syllabus 2026–2028", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf", previewUrl: `${LOCAL}/9708-2026-2028-syllabus.pdf`, note: "当前考纲未说明 pre-release 要求；这不是对未公开保密材料的断言。" },
      { id: "9708-update", type: "update-notice", title: "9708 Syllabus Update 2026–2028", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/748950-2026-2028-syllabus-update.pdf", previewUrl: `${LOCAL}/9708-2026-2028-syllabus-update.pdf`, note: "仅更新网页链接；specimen materials 未更新。截至 2026-07-15，官方课程页未列 post-2028 考纲，须继续每月监控。" },
    ],
    release,
  },
  {
    id: "cambridge-9609",
    board: "Cambridge International",
    qualification: "Cambridge International AS & A Level Business",
    code: "9609",
    region,
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "AS Level 考 Papers 1–2；完整 A Level 共考 Papers 1–4，可分阶段或同一考季完成。",
    nextExam: { date: "2026-10-05", session: "PM", code: "9609/12", title: "Paper 1 · Business Concepts 1", durationMinutes: 75, group: "AS / A Level" },
    components: [
      { code: "Paper 1", name: "Business Concepts 1", durationMinutes: 75, marks: 40, weighting: "AS 40% / A Level 20%", calculator: "allowed", assessmentMode: "written", note: "计算器许可来自 Cambridge Handbook 默认规则；最终试卷封面仍须复核。" },
      { code: "Paper 2", name: "Business Concepts 2", durationMinutes: 90, marks: 60, weighting: "AS 60% / A Level 30%", calculator: "allowed", assessmentMode: "written", note: "含 written / numerical / diagrammatic stimulus；考纲未说明独立 insert。计算器许可须在最终试卷封面复核。" },
      { code: "Paper 3", name: "Business Decision-Making", durationMinutes: 105, marks: 60, weighting: "A Level 30%", calculator: "allowed", assessmentMode: "written", note: "case study 明确作为独立 insert 提供；计算器许可须在最终试卷封面复核。" },
      { code: "Paper 4", name: "Business Strategy", durationMinutes: 75, marks: 40, weighting: "A Level 20%", calculator: "allowed", assessmentMode: "written", note: "含 case study，但考纲没有说明其包装方式，不得标为独立 insert。计算器许可须在最终试卷封面复核。" },
    ],
    routes: advancedRoutes,
    calculator: {
      status: "all",
      summary: "9609 科目考纲未说明计算器；按 Cambridge Handbook 2026 第 105 页默认允许，除非最终试卷封面或 additional materials list 禁止。发布前必须复核。",
      prohibited: ["图形显示", "资料库、字典或语言翻译", "文字或公式检索与操作", "QWERTY 键盘", "符号代数、微分或积分"],
    },
    formula: {
      supplied: false,
      status: "unknown",
      label: "Ratio formulae and case-study materials",
      summary: "ratio 公式参考列在考纲中，但考纲未说明考试时提供独立公式表。Paper 3 有独立 case-study insert；Paper 4 的 case-study 包装未说明。",
    },
    practical: noPractical,
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026；仍可能修订，变更须人工确认后发布",
    upcomingExams: [
      { date: "2026-10-05", session: "PM", code: "9609/12", title: "Paper 1 · Business Concepts 1", durationMinutes: 75, group: "AS / A Level" },
      { date: "2026-10-08", session: "PM", code: "9609/22", title: "Paper 2 · Business Concepts 2", durationMinutes: 90, group: "AS / A Level" },
      { date: "2026-10-12", session: "PM", code: "9609/32", title: "Paper 3 · Business Decision-Making", durationMinutes: 105, group: "A Level" },
      { date: "2026-10-19", session: "PM", code: "9609/42", title: "Paper 4 · Business Strategy", durationMinutes: 75, group: "A Level" },
    ],
    materials: [
      timetableMaterial("9609"),
      { id: "9609-current", type: "syllabus", title: "9609 Syllabus 2026–2028", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/697371-2026-2028-syllabus.pdf", previewUrl: `${LOCAL}/9609-2026-2028-syllabus.pdf`, note: "当前考纲未说明 pre-release 要求；这不是对未公开保密材料的断言。" },
      { id: "9609-update", type: "update-notice", title: "9609 Syllabus Update 2026–2028", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/748947-2026-2028-syllabus-update.pdf", previewUrl: `${LOCAL}/9609-2026-2028-syllabus-update.pdf`, note: "仅更新网页链接；specimen materials 未更新。截至 2026-07-15，官方课程页未列 post-2028 考纲，须继续每月监控。" },
      { id: "9609-calculator-rule", type: "reference-document", title: "Cambridge Handbook 2026 · Calculator rule", version: "Section 5.1.7.1 · page 105", status: "reference", officialUrl: `${HANDBOOK_URL}#page=105`, previewUrl: `${LOCAL}/cambridge-handbook-2026.pdf`, note: "站内预览是官方手册第 105 页快照；科目考纲静默时适用默认规则，最终试卷封面仍可覆盖。" },
    ],
    release,
  },
  {
    id: "cambridge-9706",
    board: "Cambridge International",
    qualification: "Cambridge International AS & A Level Accounting",
    code: "9706",
    region,
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "AS Level 考 Papers 1–2；完整 A Level 共考 Papers 1–4，可分阶段或同一考季完成。",
    nextExam: { date: "2026-10-15", session: "PM", code: "9706/22", title: "Paper 2 · Fundamentals of Accounting", durationMinutes: 105, group: "AS / A Level" },
    components: [
      { code: "Paper 1", name: "Multiple Choice", durationMinutes: 60, marks: 30, weighting: "AS 28% / A Level 14%", calculator: "required", assessmentMode: "multiple-choice" },
      { code: "Paper 2", name: "Fundamentals of Accounting", durationMinutes: 105, marks: 90, weighting: "AS 72% / A Level 36%", calculator: "required", assessmentMode: "written" },
      { code: "Paper 3", name: "Financial Accounting", durationMinutes: 90, marks: 75, weighting: "A Level 30%", calculator: "required", assessmentMode: "written", note: "每题的 source materials 作为独立 insert 提供；additional information 也会写在题目中。" },
      { code: "Paper 4", name: "Cost and Management Accounting", durationMinutes: 60, marks: 50, weighting: "A Level 20%", calculator: "required", assessmentMode: "written", note: "每题的 source materials 作为独立 insert 提供；additional information 也会写在题目中。" },
    ],
    routes: advancedRoutes,
    calculator: {
      status: "all",
      summary: "当前科目考纲明确所有试卷都必须使用计算器。",
      prohibited: ["图形显示", "资料库、字典或语言翻译", "文字或公式检索与操作", "QWERTY 键盘", "符号代数、微分或积分"],
    },
    formula: {
      supplied: false,
      status: "not-provided",
      label: "Accounting ratios",
      summary: "考生必须使用考纲附录中的 ratio 公式；考纲明确这些 ratios 不会在试卷中提供。Paper 3、4 的 source materials 另有独立 insert。",
    },
    practical: noPractical,
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026；仍可能修订，变更须人工确认后发布",
    upcomingExams: [
      { date: "2026-10-15", session: "PM", code: "9706/22", title: "Paper 2 · Fundamentals of Accounting", durationMinutes: 105, group: "AS / A Level" },
      { date: "2026-10-21", session: "PM", code: "9706/32", title: "Paper 3 · Financial Accounting", durationMinutes: 90, group: "A Level" },
      { date: "2026-10-28", session: "PM", code: "9706/42", title: "Paper 4 · Cost and Management Accounting", durationMinutes: 60, group: "A Level" },
      { date: "2026-11-03", session: "PM", code: "9706/12", title: "Paper 1 · Multiple Choice", durationMinutes: 60, group: "AS / A Level" },
    ],
    materials: [
      timetableMaterial("9706"),
      { id: "9706-current", type: "syllabus", title: "9706 Syllabus 2026–2028", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/697417-2026-2028-syllabus.pdf", previewUrl: `${LOCAL}/9706-2026-2028-syllabus.pdf`, note: "当前考纲未说明 pre-release 要求；这不是对未公开保密材料的断言。" },
      { id: "9706-update", type: "update-notice", title: "9706 Syllabus Update 2026–2028", version: "Version 2 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/748949-2026-2028-syllabus-update.pdf", previewUrl: `${LOCAL}/9706-2026-2028-syllabus-update.pdf`, note: "仅更新网页链接；specimen materials 未更新。截至 2026-07-15，官方课程页未列 post-2028 考纲，须继续每月监控。" },
      { id: "9706-ratios", type: "formula", title: "Summary of commonly used ratios", version: "Current syllabus · pages 28–30", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/697417-2026-2028-syllabus.pdf#page=28", previewUrl: `${LOCAL}/9706-2026-2028-syllabus.pdf#page=28`, note: "教学与备考参考；考纲明确 ratios 不会在考试试卷中提供。" },
    ],
    release,
  },
];
