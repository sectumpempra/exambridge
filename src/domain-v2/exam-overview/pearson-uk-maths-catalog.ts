import type { ExamOverview } from "./schema";

const LOCAL = "/exam-materials";

const GCSE_NOVEMBER_2026_TIMETABLE =
  "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-UK-Edexcel-GCSE/gcse-nov2026-final.pdf";
const GCE_SUMMER_2027_TIMETABLE =
  "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables/gce-summer-2027-final.pdf";
const LEVEL_2_EXTENDED_SUMMER_2027_TIMETABLE =
  "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables/l2-extended-maths-summer-2027-final.pdf";
const LEVEL_3_FORMULAE_BOOK =
  "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Mathematics/2017/specification-and-sample-assesment/pearson-edexcel-a-level-gce-in-mathematics-formulae-book.pdf";

const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: {
    normal: "每周一核对 Pearson UK final timetable 与 timetable correction log",
    nearExam: "距离考试 60 天内每日核对；官方修订先生成报告，经人工确认后发布",
    materials: "每月 1 日核对规格与公式资料；1MA1、7M20 的 2027 专用公式资料发布前保持更新窗口",
  },
};

export const PEARSON_UK_MATHS_EXAM_OVERVIEWS: ExamOverview[] = [
  {
    id: "pearson-uk-1ma1",
    board: "Pearson Edexcel",
    qualification: "Pearson Edexcel GCSE (9–1) Mathematics",
    code: "1MA1",
    region: {
      label: "英国本土资格",
      note: "按 Pearson Edexcel UK GCSE 规则展示；November 系列仅限在此前 8 月 31 日已满 16 岁的考生。仅展示官方 Morning / Afternoon，不推算当地钟点。",
    },
    examSeries: [
      { name: "May/June" },
      { name: "November", note: "考生须在此前 8 月 31 日已满 16 岁" },
    ],
    paperCount: "线性资格共 3 张必考试卷；Foundation 或 Higher 三张均须选择同一 tier，并在同一考季完成。",
    nextExam: {
      date: "2026-11-04",
      session: "Morning",
      code: "1MA1/1F · 1MA1/1H",
      title: "Paper 1 · Non-Calculator",
      durationMinutes: 90,
    },
    components: [
      { code: "1MA1/1F", name: "Paper 1 · Non-Calculator", group: "Foundation", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "not-allowed", assessmentMode: "written" },
      { code: "1MA1/2F", name: "Paper 2 · Calculator", group: "Foundation", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "allowed", assessmentMode: "written" },
      { code: "1MA1/3F", name: "Paper 3 · Calculator", group: "Foundation", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "allowed", assessmentMode: "written" },
      { code: "1MA1/1H", name: "Paper 1 · Non-Calculator", group: "Higher", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "not-allowed", assessmentMode: "written" },
      { code: "1MA1/2H", name: "Paper 2 · Calculator", group: "Higher", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "allowed", assessmentMode: "written" },
      { code: "1MA1/3H", name: "Paper 3 · Calculator", group: "Higher", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "allowed", assessmentMode: "written" },
    ],
    routes: [
      { id: "foundation", level: "Foundation · grades 1–5", label: "Foundation route", papers: ["1MA1/1F", "1MA1/2F", "1MA1/3F"], note: "三张均为必考。" },
      { id: "higher", level: "Higher · grades 4–9（允许 grade 3）", label: "Higher route", papers: ["1MA1/1H", "1MA1/2H", "1MA1/3H"], note: "三张均为必考。" },
    ],
    calculator: {
      status: "mixed",
      summary: "Paper 1 禁止计算器；Paper 2、Paper 3 允许使用符合考试规定的计算器。",
      prohibited: ["符号代数、微分或积分", "文字、资料库或预存公式检索", "与其他设备或互联网通信"],
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "2026 Foundation / Higher formula sheets",
      summary: "最近的 November 2026 考试使用 Pearson 2026 exam aid：Foundation 与 Higher 各有公式表，考试当天随试卷作为 insert 发放，考生不能自带。2027 专用文件尚未发布，发布前不得把 2026 文件改标为 2027。",
    },
    upcomingSeries: "November 2026",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-11-04", session: "Morning", code: "1MA1/1F", title: "Paper 1 · Non-Calculator", durationMinutes: 90, group: "Foundation" },
      { date: "2026-11-04", session: "Morning", code: "1MA1/1H", title: "Paper 1 · Non-Calculator", durationMinutes: 90, group: "Higher" },
      { date: "2026-11-06", session: "Morning", code: "1MA1/2F", title: "Paper 2 · Calculator", durationMinutes: 90, group: "Foundation" },
      { date: "2026-11-06", session: "Morning", code: "1MA1/2H", title: "Paper 2 · Calculator", durationMinutes: 90, group: "Higher" },
      { date: "2026-11-09", session: "Morning", code: "1MA1/3F", title: "Paper 3 · Calculator", durationMinutes: 90, group: "Foundation" },
      { date: "2026-11-09", session: "Morning", code: "1MA1/3H", title: "Paper 3 · Calculator", durationMinutes: 90, group: "Higher" },
    ],
    materials: [
      { id: "1ma1-timetable", type: "timetable", title: "GCSE November 2026 Final Timetable", version: "Final", status: "current", officialUrl: GCSE_NOVEMBER_2026_TIMETABLE, previewUrl: `${LOCAL}/pearson-uk-gcse-november-2026-final.pdf` },
      { id: "1ma1-spec", type: "syllabus", title: "GCSE Mathematics Specification", version: "Issue 2 · June 2015", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/GCSE/mathematics/2015/specification-and-sample-assesment/gcse-maths-2015-specification.pdf", previewUrl: `${LOCAL}/pearson-uk-1ma1-spec-issue2.pdf` },
      { id: "1ma1-formula-foundation-2026", type: "formula", title: "Foundation Tier Formulae Sheet", version: "2026 assessment window", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/GCSE/mathematics/2015/exam-materials/2026-exam-aid-foundation.pdf", previewUrl: `${LOCAL}/pearson-uk-1ma1-exam-aid-foundation-2026.pdf`, note: "适用于最近的 November 2026 考试；2027 专用文件待 Pearson 发布后另行审核。" },
      { id: "1ma1-formula-higher-2026", type: "formula", title: "Higher Tier Formulae Sheet", version: "2026 assessment window", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/GCSE/mathematics/2015/exam-materials/2026-exam-aid-higher.pdf", previewUrl: `${LOCAL}/pearson-uk-1ma1-exam-aid-higher-2026.pdf`, note: "适用于最近的 November 2026 考试；2027 专用文件待 Pearson 发布后另行审核。" },
    ],
    release,
  },
  {
    id: "pearson-uk-7m20",
    board: "Pearson Edexcel",
    qualification: "Pearson Edexcel Level 2 Extended Mathematics Certificate",
    code: "7M20",
    region: {
      label: "英国本土资格",
      note: "这是 Pearson UK 当前的 Level 2 Extended Mathematics Certificate，不是 Pearson International GCSE Further Pure Mathematics，也不应写成 Level 2 Further Mathematics。",
    },
    examSeries: [{ name: "May/June", note: "每年一个考季；两张须在同一考季完成" }],
    paperCount: "2 张必考试卷，各占 50%；两张须在同一 May/June 考季完成。",
    nextExam: { date: "2027-06-15", session: "Afternoon", code: "7M20/01", title: "Paper 1 · Non-Calculator", durationMinutes: 75 },
    components: [
      { code: "7M20/01", name: "Paper 1 · Non-Calculator", durationMinutes: 75, marks: 60, weighting: "50%", calculator: "not-allowed", assessmentMode: "written" },
      { code: "7M20/02", name: "Paper 2 · Calculator", durationMinutes: 75, marks: 60, weighting: "50%", calculator: "allowed", assessmentMode: "written" },
    ],
    routes: [{ id: "linear", level: "Level 2 · Pass / Merit / Distinction / Distinction*", label: "Linear route", papers: ["7M20/01", "7M20/02"], note: "两张均为必考，以两张总分定等级。" }],
    calculator: {
      status: "mixed",
      summary: "Paper 1 禁止计算器；Paper 2 允许使用符合 Pearson 规定的计算器。",
      prohibited: ["符号代数、微分或积分", "文字、资料库或预存公式检索", "与其他设备或互联网通信"],
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "Relevant-question formulae",
      summary: "Issue 2 Appendix 1 列出的公式会在相关考试题目中提供。2027 考季专用的独立公式 insert 尚未发布；若 Pearson 后续发布，须通过更新报告和人工确认后再加入。",
    },
    upcomingSeries: "Summer 2027",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2027-06-15", session: "Afternoon", code: "7M20/01", title: "Paper 1 · Non-Calculator", durationMinutes: 75 },
      { date: "2027-06-17", session: "Morning", code: "7M20/02", title: "Paper 2 · Calculator", durationMinutes: 75 },
    ],
    materials: [
      { id: "7m20-timetable", type: "timetable", title: "Level 2 Extended Mathematics Summer 2027 Final Timetable", version: "Final", status: "future", officialUrl: LEVEL_2_EXTENDED_SUMMER_2027_TIMETABLE, previewUrl: `${LOCAL}/pearson-uk-7m20-summer-2027-final.pdf` },
      { id: "7m20-spec", type: "syllabus", title: "Level 2 Extended Mathematics Certificate Specification", version: "Issue 2 · September 2025", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/level-2-extended-maths-certificate/specification-and-sample-assessments/level-2-extended-mathematics-certificate-specification.pdf", previewUrl: `${LOCAL}/pearson-uk-7m20-spec-issue2.pdf` },
      { id: "7m20-formula-reference", type: "formula", title: "Appendix 1 · Mathematical formulae", version: "Issue 2 · PDF page 26", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/level-2-extended-maths-certificate/specification-and-sample-assessments/level-2-extended-mathematics-certificate-specification.pdf#page=26", previewUrl: `${LOCAL}/pearson-uk-7m20-spec-issue2.pdf#page=26`, note: "这些公式在相关题目中提供；2027 专用独立 insert 尚未发布，保留月度检查窗口。" },
    ],
    release,
  },
  {
    id: "pearson-uk-8ma0",
    board: "Pearson Edexcel",
    qualification: "Pearson Edexcel AS Level Mathematics",
    code: "8MA0",
    region: {
      label: "英格兰 AS Level",
      note: "线性资格；两张试卷须在同一 May/June 考季完成。AS 等级为 A–E，不设 A*。仅展示官方 Morning / Afternoon。",
    },
    examSeries: [{ name: "May/June", note: "全部 assessment 在同一年完成" }],
    paperCount: "2 张必考试卷；Pure Mathematics 占 62.5%，Statistics and Mechanics 占 37.5%。",
    nextExam: { date: "2027-05-13", session: "Afternoon", code: "8MA0/01", title: "Paper 1 · Pure Mathematics", durationMinutes: 120 },
    components: [
      { code: "8MA0/01", name: "Paper 1 · Pure Mathematics", durationMinutes: 120, marks: 100, weighting: "62.5%", calculator: "allowed", assessmentMode: "written" },
      { code: "8MA0/02", name: "Paper 2 · Statistics and Mechanics", durationMinutes: 75, marks: 60, weighting: "37.5%", calculator: "allowed", assessmentMode: "written", note: "Statistics 部分会考查 Pearson Large Data Set；考生须提前熟悉，但考试时不需要携带数据集副本。" },
    ],
    routes: [{ id: "linear", level: "AS Level · grades A–E", label: "Linear route", papers: ["8MA0/01", "8MA0/02"], note: "两张均为必考；AS 不设 A*。" }],
    calculator: {
      status: "all",
      summary: "两张考试均允许计算器；计算器须具备迭代、汇总统计及标准统计分布概率功能。",
      prohibited: ["符号代数、微分或积分", "文字、资料库或预存公式检索", "与其他设备或互联网通信"],
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "Mathematical Formulae and Statistical Tables",
      summary: "两张考试均提供干净的 Pearson Level 3 Mathematical Formulae and Statistical Tables；考生不能携带自己的副本。规格 Appendix 1 另列出必须记忆、不会出现在公式册中的公式。",
    },
    upcomingSeries: "Summer 2027",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2027-05-13", session: "Afternoon", code: "8MA0/01", title: "Paper 1 · Pure Mathematics", durationMinutes: 120 },
      { date: "2027-05-21", session: "Afternoon", code: "8MA0/02", title: "Paper 2 · Statistics and Mechanics", durationMinutes: 75 },
    ],
    materials: [
      { id: "8ma0-timetable", type: "timetable", title: "GCE Summer 2027 Final Timetable", version: "Final", status: "future", officialUrl: GCE_SUMMER_2027_TIMETABLE, previewUrl: `${LOCAL}/pearson-uk-gce-summer-2027-final.pdf` },
      { id: "8ma0-spec", type: "syllabus", title: "AS Level Mathematics Specification", version: "Issue 3 · October 2025", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Mathematics/2017/specification-and-sample-assesment/as-l3-mathematics-specification.pdf", previewUrl: `${LOCAL}/pearson-uk-8ma0-spec-issue3.pdf` },
      { id: "8ma0-formulae", type: "formula", title: "Mathematical Formulae and Statistical Tables", version: "Issue 1 · July 2017", status: "reference", officialUrl: LEVEL_3_FORMULAE_BOOK, previewUrl: `${LOCAL}/pearson-uk-as-a-level-formulae-book-issue1.pdf` },
      { id: "8ma0-large-data-set", type: "data-booklet", title: "Pearson Large Data Set · Weather data", version: "Issue 1 · qualification-lifetime dataset", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Mathematics/2017/specification-and-sample-assesment/Pearson%20Edexcel%20GCE%20AS%20and%20AL%20Mathematics%20data%20set%20-%20Issue%201%20(1).xls", previewUrl: `${LOCAL}/pearson-uk-9ma0-assessment-guide.pdf`, note: "Paper 2 Statistics 会假设考生已熟悉该数据集。官方链接下载原始 Excel；站内预览为 Pearson assessment guide 的官方说明快照。" },
    ],
    release: { ...release, approvedAt: "2026-07-18", verifiedAt: "2026-07-18" },
  },
  {
    id: "pearson-uk-9ma0",
    board: "Pearson Edexcel",
    qualification: "Pearson Edexcel A Level Mathematics",
    code: "9MA0",
    region: { label: "英格兰 A Level", note: "线性资格；全部 assessment 在同一 May/June 考季完成。仅展示官方 Morning / Afternoon。" },
    examSeries: [{ name: "May/June", note: "全部 assessment 在同一年完成" }],
    paperCount: "3 张必考试卷；两张 Pure Mathematics 加一张 Statistics and Mechanics，各占 33⅓%。",
    nextExam: { date: "2027-05-26", session: "Afternoon", code: "9MA0/01", title: "Paper 1 · Pure Mathematics 1", durationMinutes: 120 },
    components: [
      { code: "9MA0/01", name: "Paper 1 · Pure Mathematics 1", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "allowed", assessmentMode: "written" },
      { code: "9MA0/02", name: "Paper 2 · Pure Mathematics 2", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "allowed", assessmentMode: "written" },
      { code: "9MA0/03", name: "Paper 3 · Statistics and Mechanics", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "allowed", assessmentMode: "written", note: "Statistics 部分会考查 Pearson Large Data Set；考生须提前熟悉，但考试时不需要携带数据集副本。" },
    ],
    routes: [{ id: "linear", level: "A Level", label: "Linear route", papers: ["9MA0/01", "9MA0/02", "9MA0/03"], note: "三张均为必考。" }],
    calculator: {
      status: "all",
      summary: "三张考试均允许计算器；计算器须具备迭代、汇总统计及标准统计分布概率功能。",
      prohibited: ["符号代数、微分或积分", "文字、资料库或预存公式检索", "与其他设备或互联网通信"],
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "Mathematical Formulae and Statistical Tables",
      summary: "全部考试提供干净的 Pearson Level 3 Mathematical Formulae and Statistical Tables；考生不能携带自己的副本。规格 Appendix 1 另列出必须记忆、不会出现在公式册中的公式。",
    },
    upcomingSeries: "Summer 2027",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2027-05-26", session: "Afternoon", code: "9MA0/01", title: "Paper 1 · Pure Mathematics 1", durationMinutes: 120 },
      { date: "2027-06-09", session: "Afternoon", code: "9MA0/02", title: "Paper 2 · Pure Mathematics 2", durationMinutes: 120 },
      { date: "2027-06-16", session: "Afternoon", code: "9MA0/03", title: "Paper 3 · Statistics and Mechanics", durationMinutes: 120 },
    ],
    materials: [
      { id: "9ma0-timetable", type: "timetable", title: "GCE Summer 2027 Final Timetable", version: "Final", status: "future", officialUrl: GCE_SUMMER_2027_TIMETABLE, previewUrl: `${LOCAL}/pearson-uk-gce-summer-2027-final.pdf` },
      { id: "9ma0-spec", type: "syllabus", title: "A Level Mathematics Specification", version: "Issue 4 · February 2020", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Mathematics/2017/specification-and-sample-assesment/a-level-l3-mathematics-specification-issue4.pdf", previewUrl: `${LOCAL}/pearson-uk-9ma0-spec-issue4.pdf` },
      { id: "9ma0-formulae", type: "formula", title: "Mathematical Formulae and Statistical Tables", version: "Issue 1 · July 2017", status: "reference", officialUrl: LEVEL_3_FORMULAE_BOOK, previewUrl: `${LOCAL}/pearson-uk-as-a-level-formulae-book-issue1.pdf` },
      { id: "9ma0-large-data-set", type: "data-booklet", title: "Pearson Large Data Set · Weather data", version: "Issue 1 · qualification-lifetime dataset", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Mathematics/2017/specification-and-sample-assesment/Pearson%20Edexcel%20GCE%20AS%20and%20AL%20Mathematics%20data%20set%20-%20Issue%201%20(1).xls", previewUrl: `${LOCAL}/pearson-uk-9ma0-assessment-guide.pdf`, note: "Paper 3 Statistics 会假设考生已熟悉该数据集。官方链接下载原始 Excel；站内预览为 Pearson assessment guide 第 9 页的官方单页快照，说明数据范围与教学要求。考场无需携带数据集副本。" },
    ],
    release,
  },
  {
    id: "pearson-uk-9fm0",
    board: "Pearson Edexcel",
    qualification: "Pearson Edexcel A Level Further Mathematics",
    code: "9FM0",
    region: { label: "英格兰 A Level", note: "线性资格；全部 assessment 在同一 May/June 考季完成。仅展示官方 Morning / Afternoon。" },
    examSeries: [{ name: "May/June", note: "全部 assessment 在同一年完成" }],
    paperCount: "计分结构为 4 张：2 张必考 Core Pure + 2 张选考。选考只能按 Pearson 规定的十种合法组合选择；下列 10 个组件不是要求全部参加的 10 张试卷。",
    nextExam: { date: "2027-05-12", session: "Afternoon", code: "9FM0/01", title: "Paper 1 · Core Pure Mathematics 1", durationMinutes: 90 },
    components: [
      { code: "9FM0/01", name: "Paper 1 · Core Pure Mathematics 1", group: "Mandatory", durationMinutes: 90, marks: 75, weighting: "25%", calculator: "allowed", assessmentMode: "written" },
      { code: "9FM0/02", name: "Paper 2 · Core Pure Mathematics 2", group: "Mandatory", durationMinutes: 90, marks: 75, weighting: "25%", calculator: "allowed", assessmentMode: "written" },
      { code: "9FM0/3A", name: "Paper 3A · Further Pure Mathematics 1", group: "Option 1", durationMinutes: 90, marks: 75, weighting: "25% when selected", calculator: "allowed", assessmentMode: "written" },
      { code: "9FM0/3B", name: "Paper 3B · Further Statistics 1", group: "Option 1", durationMinutes: 90, marks: 75, weighting: "25% when selected", calculator: "allowed", assessmentMode: "written" },
      { code: "9FM0/3C", name: "Paper 3C · Further Mechanics 1", group: "Option 1", durationMinutes: 90, marks: 75, weighting: "25% when selected", calculator: "allowed", assessmentMode: "written" },
      { code: "9FM0/3D", name: "Paper 3D · Decision Mathematics 1", group: "Option 1", durationMinutes: 90, marks: 75, weighting: "25% when selected", calculator: "allowed", assessmentMode: "written" },
      { code: "9FM0/4A", name: "Paper 4A · Further Pure Mathematics 2", group: "Option 2", durationMinutes: 90, marks: 75, weighting: "25% when selected", calculator: "allowed", assessmentMode: "written" },
      { code: "9FM0/4B", name: "Paper 4B · Further Statistics 2", group: "Option 2", durationMinutes: 90, marks: 75, weighting: "25% when selected", calculator: "allowed", assessmentMode: "written" },
      { code: "9FM0/4C", name: "Paper 4C · Further Mechanics 2", group: "Option 2", durationMinutes: 90, marks: 75, weighting: "25% when selected", calculator: "allowed", assessmentMode: "written" },
      { code: "9FM0/4D", name: "Paper 4D · Decision Mathematics 2", group: "Option 2", durationMinutes: 90, marks: 75, weighting: "25% when selected", calculator: "allowed", assessmentMode: "written" },
    ],
    routes: [
      { id: "fp1-fs1", level: "A Level", label: "Further Pure 1 + Further Statistics 1", papers: ["9FM0/01", "9FM0/02", "9FM0/3A", "9FM0/3B"], note: "两张必考 + 任意两张 Option 1。" },
      { id: "fp1-fm1", level: "A Level", label: "Further Pure 1 + Further Mechanics 1", papers: ["9FM0/01", "9FM0/02", "9FM0/3A", "9FM0/3C"], note: "两张必考 + 任意两张 Option 1。" },
      { id: "fp1-dm1", level: "A Level", label: "Further Pure 1 + Decision Mathematics 1", papers: ["9FM0/01", "9FM0/02", "9FM0/3A", "9FM0/3D"], note: "两张必考 + 任意两张 Option 1。" },
      { id: "fs1-fm1", level: "A Level", label: "Further Statistics 1 + Further Mechanics 1", papers: ["9FM0/01", "9FM0/02", "9FM0/3B", "9FM0/3C"], note: "两张必考 + 任意两张 Option 1。" },
      { id: "fs1-dm1", level: "A Level", label: "Further Statistics 1 + Decision Mathematics 1", papers: ["9FM0/01", "9FM0/02", "9FM0/3B", "9FM0/3D"], note: "两张必考 + 任意两张 Option 1。" },
      { id: "fm1-dm1", level: "A Level", label: "Further Mechanics 1 + Decision Mathematics 1", papers: ["9FM0/01", "9FM0/02", "9FM0/3C", "9FM0/3D"], note: "两张必考 + 任意两张 Option 1。" },
      { id: "fp1-fp2", level: "A Level", label: "Further Pure Mathematics 1 + 2", papers: ["9FM0/01", "9FM0/02", "9FM0/3A", "9FM0/4A"], note: "两张必考 + 同学科匹配的 Option 1 / Option 2。" },
      { id: "fs1-fs2", level: "A Level", label: "Further Statistics 1 + 2", papers: ["9FM0/01", "9FM0/02", "9FM0/3B", "9FM0/4B"], note: "两张必考 + 同学科匹配的 Option 1 / Option 2。" },
      { id: "fm1-fm2", level: "A Level", label: "Further Mechanics 1 + 2", papers: ["9FM0/01", "9FM0/02", "9FM0/3C", "9FM0/4C"], note: "两张必考 + 同学科匹配的 Option 1 / Option 2。" },
      { id: "dm1-dm2", level: "A Level", label: "Decision Mathematics 1 + 2", papers: ["9FM0/01", "9FM0/02", "9FM0/3D", "9FM0/4D"], note: "两张必考 + 同学科匹配的 Option 1 / Option 2。" },
    ],
    calculator: {
      status: "all",
      summary: "全部必考和选考组件均允许计算器；计算器须具备迭代、至少 3×3 矩阵运算及标准统计功能。",
      prohibited: ["符号代数、微分或积分", "文字、资料库或预存公式检索", "与其他设备或互联网通信"],
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "Mathematical Formulae and Statistical Tables",
      summary: "全部必考和选考组件均提供干净的 Pearson Level 3 Mathematical Formulae and Statistical Tables；考生不能携带自己的副本。",
    },
    upcomingSeries: "Summer 2027",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2027-05-12", session: "Afternoon", code: "9FM0/01", title: "Paper 1 · Core Pure Mathematics 1", durationMinutes: 90, group: "Mandatory" },
      { date: "2027-05-20", session: "Afternoon", code: "9FM0/02", title: "Paper 2 · Core Pure Mathematics 2", durationMinutes: 90, group: "Mandatory" },
      { date: "2027-05-25", session: "Afternoon", code: "9FM0/3C", title: "Paper 3C · Further Mechanics 1", durationMinutes: 90, group: "Option 1" },
      { date: "2027-06-10", session: "Afternoon", code: "9FM0/3B", title: "Paper 3B · Further Statistics 1", durationMinutes: 90, group: "Option 1" },
      { date: "2027-06-15", session: "Afternoon", code: "9FM0/3D", title: "Paper 3D · Decision Mathematics 1", durationMinutes: 90, group: "Option 1" },
      { date: "2027-06-18", session: "Afternoon", code: "9FM0/3A", title: "Paper 3A · Further Pure Mathematics 1", durationMinutes: 90, group: "Option 1" },
      { date: "2027-06-21", session: "Afternoon", code: "9FM0/4A", title: "Paper 4A · Further Pure Mathematics 2", durationMinutes: 90, group: "Option 2" },
      { date: "2027-06-21", session: "Afternoon", code: "9FM0/4B", title: "Paper 4B · Further Statistics 2", durationMinutes: 90, group: "Option 2" },
      { date: "2027-06-21", session: "Afternoon", code: "9FM0/4C", title: "Paper 4C · Further Mechanics 2", durationMinutes: 90, group: "Option 2" },
      { date: "2027-06-21", session: "Afternoon", code: "9FM0/4D", title: "Paper 4D · Decision Mathematics 2", durationMinutes: 90, group: "Option 2" },
    ],
    materials: [
      { id: "9fm0-timetable", type: "timetable", title: "GCE Summer 2027 Final Timetable", version: "Final", status: "future", officialUrl: GCE_SUMMER_2027_TIMETABLE, previewUrl: `${LOCAL}/pearson-uk-gce-summer-2027-final.pdf` },
      { id: "9fm0-spec", type: "syllabus", title: "A Level Further Mathematics Specification", version: "Issue 4 · June 2023", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Mathematics/2017/specification-and-sample-assesment/a-level-l3-further-mathematics-specification.pdf", previewUrl: `${LOCAL}/pearson-uk-9fm0-spec-issue4.pdf` },
      { id: "9fm0-formulae", type: "formula", title: "Mathematical Formulae and Statistical Tables", version: "Issue 1 · July 2017", status: "reference", officialUrl: LEVEL_3_FORMULAE_BOOK, previewUrl: `${LOCAL}/pearson-uk-as-a-level-formulae-book-issue1.pdf` },
    ],
    release,
  },
];
