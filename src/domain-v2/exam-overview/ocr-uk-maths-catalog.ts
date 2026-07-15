import type { ExamOverview } from "./schema";

const LOCAL = "/exam-materials";
const NOVEMBER_2026_TIMETABLE = "https://www.ocr.org.uk/Images/748823-november-2026-final-exam-timetable-gcse.pdf";
const JUNE_2027_TIMETABLE = "https://www.ocr.org.uk/Images/758622-june-2027-final-exam-timetable-as-a-level-core-maths-and-fsmq.pdf";
const FORMULA_UPDATE_2026 = "https://www.ocr.org.uk/administration/support-and-tools/subject-updates/formulae-equation-sheets-742053/";

const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: {
    normal: "每周一核对官方最终时间表及修订公告",
    nearExam: "距离考试 60 天内每日核对",
    materials: "每月 1 日核对考纲与公式资料；2026-09-01 前重点跟踪 J560 / 6993 的 2027 公式表",
  },
};

const region = {
  label: "英国本土",
  note: "按 Cambridge OCR 英国本土资格展示；AM / PM 是官方场次标签，不推算考点当地钟点。",
};

const calculatorProhibited = [
  "具备符号代数、符号微分或符号积分功能的设备",
  "可连接互联网或与其他设备通信的设备",
];

export const OCR_UK_MATHS_EXAM_OVERVIEWS: ExamOverview[] = [
  {
    id: "ocr-j560",
    board: "Cambridge OCR",
    qualification: "GCSE Mathematics (9–1)",
    code: "J560",
    region,
    examSeries: [
      { name: "May/June" },
      { name: "November", note: "仅限当年 8 月 31 日或之前已满 16 岁的考生" },
    ],
    paperCount: "每位考生考同一层级的 3 张试卷：Foundation 01–03 或 Higher 04–06。",
    nextExam: {
      date: "2026-11-04",
      session: "AM",
      code: "J560/01 · J560/04",
      title: "Paper 1 Foundation / Paper 4 Higher · Calculator",
      durationMinutes: 90,
      group: "按报考层级",
    },
    components: [
      { code: "J560/01", name: "Paper 1 · Foundation · Calculator", group: "Foundation", durationMinutes: 90, marks: 100, weighting: "33⅓%", calculator: "allowed" },
      { code: "J560/02", name: "Paper 2 · Foundation · Non-calculator", group: "Foundation", durationMinutes: 90, marks: 100, weighting: "33⅓%", calculator: "not-allowed" },
      { code: "J560/03", name: "Paper 3 · Foundation · Calculator", group: "Foundation", durationMinutes: 90, marks: 100, weighting: "33⅓%", calculator: "allowed" },
      { code: "J560/04", name: "Paper 4 · Higher · Calculator", group: "Higher", durationMinutes: 90, marks: 100, weighting: "33⅓%", calculator: "allowed" },
      { code: "J560/05", name: "Paper 5 · Higher · Non-calculator", group: "Higher", durationMinutes: 90, marks: 100, weighting: "33⅓%", calculator: "not-allowed" },
      { code: "J560/06", name: "Paper 6 · Higher · Calculator", group: "Higher", durationMinutes: 90, marks: 100, weighting: "33⅓%", calculator: "allowed" },
    ],
    routes: [
      { id: "foundation", level: "Foundation · grades 1–5", label: "Foundation route", papers: ["J560/01", "J560/02", "J560/03"], note: "三张必须在同一考季完成。" },
      { id: "higher", level: "Higher · grades 4–9", label: "Higher route", papers: ["J560/04", "J560/05", "J560/06"], note: "三张必须在同一考季完成。" },
    ],
    calculator: {
      status: "mixed",
      summary: "Foundation Paper 2 与 Higher Paper 5 禁止计算器；其余四张允许使用符合 JCQ 规则的科学或图形计算器。",
      prohibited: calculatorProhibited,
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "分层公式表",
      summary: "November 2026 每张试卷均随卷提供对应层级的 2026 公式表。2027 仍会提供公式表，但 2027 PDF 截至 2026-07-15 尚未发布；OCR 计划于 2026-09-01 提供链接，不能把下方 2026 文件当作 2027 文件。",
    },
    upcomingSeries: "November 2026",
    timetableStatus: "Final · edition dated December 2025",
    upcomingExams: [
      { date: "2026-11-04", session: "AM", code: "J560/01", title: "Paper 1 · Foundation · Calculator", durationMinutes: 90, group: "Foundation" },
      { date: "2026-11-04", session: "AM", code: "J560/04", title: "Paper 4 · Higher · Calculator", durationMinutes: 90, group: "Higher" },
      { date: "2026-11-06", session: "AM", code: "J560/02", title: "Paper 2 · Foundation · Non-calculator", durationMinutes: 90, group: "Foundation" },
      { date: "2026-11-06", session: "AM", code: "J560/05", title: "Paper 5 · Higher · Non-calculator", durationMinutes: 90, group: "Higher" },
      { date: "2026-11-09", session: "AM", code: "J560/03", title: "Paper 3 · Foundation · Calculator", durationMinutes: 90, group: "Foundation" },
      { date: "2026-11-09", session: "AM", code: "J560/06", title: "Paper 6 · Higher · Calculator", durationMinutes: 90, group: "Higher" },
    ],
    materials: [
      { id: "ocr-j560-timetable", type: "timetable", title: "GCSE November 2026 Final Timetable", version: "Final · December 2025 edition", status: "current", officialUrl: NOVEMBER_2026_TIMETABLE, previewUrl: `${LOCAL}/ocr-gcse-november-2026-final.pdf` },
      { id: "ocr-j560-spec", type: "syllabus", title: "J560 GCSE Mathematics Specification", version: "Version 2.0 · May 2026", status: "current", officialUrl: "https://www.ocr.org.uk/Images/168982-specification-gcse-mathematics.pdf", previewUrl: `${LOCAL}/ocr-j560-spec-v2.0.pdf` },
      { id: "ocr-j560-foundation-formula-2026", type: "formula", title: "J560 Foundation Tier Formulae Sheet · 2026 only", version: "June and November 2026", status: "current", officialUrl: "https://www.ocr.org.uk/Images/742416-foundation-tier-formulae-sheet.pdf", previewUrl: `${LOCAL}/ocr-j560-foundation-formulae-2026.pdf`, note: "仅适用于 2026；不是 2027 公式表。" },
      { id: "ocr-j560-higher-formula-2026", type: "formula", title: "J560 Higher Tier Formulae Sheet · 2026 only", version: "June and November 2026", status: "current", officialUrl: "https://www.ocr.org.uk/Images/742417-higher-tier-formulae-sheet.pdf", previewUrl: `${LOCAL}/ocr-j560-higher-formulae-2026.pdf`, note: "仅适用于 2026；不是 2027 公式表。" },
      { id: "ocr-j560-formula-2027-window", type: "update-notice", title: "J560 2027 公式表发布窗口", version: "Expected 1 September 2026", status: "future", officialUrl: FORMULA_UPDATE_2026, previewUrl: `${LOCAL}/ocr-j560-spec-v2.0.pdf`, note: "2027 PDF 尚未发布；此预览仅为当前考纲，绝非 2027 公式表。发布后须替换为官方 2027 文件并重新核验。" },
    ],
    release,
  },
  {
    id: "ocr-6993",
    board: "Cambridge OCR",
    qualification: "Level 3 FSMQ: Additional Mathematics",
    code: "6993",
    region,
    examSeries: [{ name: "May/June", note: "每年一个考试系列" }],
    paperCount: "1 张必考试卷；100 marks，占资格总分的 100%。",
    nextExam: {
      date: "2027-06-18",
      session: "PM",
      code: "6993/01",
      title: "Additional Mathematics",
      durationMinutes: 120,
    },
    components: [
      { code: "6993/01", name: "Paper 1 · Additional Mathematics", durationMinutes: 120, marks: 100, weighting: "100%", calculator: "allowed", note: "允许使用符合 JCQ 规则的科学或图形计算器" },
    ],
    routes: [
      { id: "single", level: "Level 3 FSMQ", label: "Single paper route", papers: ["6993/01"], note: "终结性考试；每年 May/June 一次。" },
    ],
    calculator: {
      status: "all",
      summary: "唯一试卷允许使用符合 JCQ 规则的科学或图形计算器，并须写出适当过程。",
      prohibited: calculatorProhibited,
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "卷内公式 + 年度附加公式表",
      summary: "标准公式印在答题册开头；2027 还会随卷提供附加公式表。但 2027 PDF 截至 2026-07-15 尚未发布，预计最迟于 2026-09-01 发布，不能把下方 2026 文件描述为 2027 文件。",
    },
    upcomingSeries: "June 2027",
    timetableStatus: "Final · published June 2026",
    upcomingExams: [
      { date: "2027-06-18", session: "PM", code: "6993/01", title: "Additional Mathematics", durationMinutes: 120 },
    ],
    materials: [
      { id: "ocr-6993-timetable", type: "timetable", title: "June 2027 AS, A Level and FSMQ Final Timetable", version: "Final · June 2026", status: "current", officialUrl: JUNE_2027_TIMETABLE, previewUrl: `${LOCAL}/ocr-june-2027-as-a-level-fsmq-final.pdf` },
      { id: "ocr-6993-spec", type: "syllabus", title: "6993 Level 3 FSMQ Additional Mathematics Specification", version: "Version 2.0 · June 2026", status: "current", officialUrl: "https://www.ocr.org.uk/Images/457916-specification-from-2018-.pdf", previewUrl: `${LOCAL}/ocr-6993-spec-v2.0.pdf` },
      { id: "ocr-6993-extra-formula-2026", type: "formula", title: "6993 Extra Formulae Sheet · June 2026 only", version: "June 2026", status: "reference", officialUrl: "https://www.ocr.org.uk/Images/742418-formulae-sheet.pdf", previewUrl: `${LOCAL}/ocr-6993-extra-formulae-2026.pdf`, note: "仅用于说明 2026 的附加资料；不是 2027 公式表。" },
      { id: "ocr-6993-formula-2027-window", type: "update-notice", title: "6993 2027 附加公式表发布窗口", version: "Expected by 1 September 2026", status: "future", officialUrl: FORMULA_UPDATE_2026, previewUrl: `${LOCAL}/ocr-6993-spec-v2.0.pdf#page=32`, note: "2027 PDF 尚未发布；此预览是当前考纲中的标准卷内公式，不是 2027 附加公式表。发布后须替换并重新核验。" },
    ],
    release,
  },
  {
    id: "ocr-h240",
    board: "Cambridge OCR",
    qualification: "A Level Mathematics A",
    code: "H240",
    region,
    examSeries: [{ name: "May/June", note: "三张试卷必须在同一终结性考试系列完成" }],
    paperCount: "3 张必考试卷；每张 100 marks、2 小时、各占 33⅓%。",
    nextExam: {
      date: "2027-05-26",
      session: "PM",
      code: "H240/01",
      title: "Pure Mathematics",
      durationMinutes: 120,
    },
    components: [
      { code: "H240/01", name: "Paper 1 · Pure Mathematics", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "allowed" },
      { code: "H240/02", name: "Paper 2 · Pure Mathematics and Statistics", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "allowed", note: "部分统计题以预发布 large data set 为背景" },
      { code: "H240/03", name: "Paper 3 · Pure Mathematics and Mechanics", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "allowed" },
    ],
    routes: [
      { id: "all-components", level: "A Level", label: "Linear route", papers: ["H240/01", "H240/02", "H240/03"], note: "三张均为必考，并在同一考试系列完成。" },
    ],
    calculator: {
      status: "all",
      summary: "三张试卷均允许科学或图形计算器；设备应具备迭代、汇总统计及二项/正态分布概率功能。",
      prohibited: calculatorProhibited,
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "卷内公式",
      summary: "没有独立 H240 公式册；指定公式直接印在每张试卷第 2–3 页。",
    },
    upcomingSeries: "June 2027",
    timetableStatus: "Final · published June 2026",
    upcomingExams: [
      { date: "2027-05-26", session: "PM", code: "H240/01", title: "Pure Mathematics", durationMinutes: 120 },
      { date: "2027-06-09", session: "PM", code: "H240/02", title: "Pure Mathematics and Statistics", durationMinutes: 120 },
      { date: "2027-06-16", session: "PM", code: "H240/03", title: "Pure Mathematics and Mechanics", durationMinutes: 120 },
    ],
    materials: [
      { id: "ocr-h240-timetable", type: "timetable", title: "June 2027 AS, A Level and FSMQ Final Timetable", version: "Final · June 2026", status: "current", officialUrl: JUNE_2027_TIMETABLE, previewUrl: `${LOCAL}/ocr-june-2027-as-a-level-fsmq-final.pdf` },
      { id: "ocr-h240-spec", type: "syllabus", title: "H240 A Level Mathematics A Specification", version: "Version 3 · October 2025", status: "current", officialUrl: "https://www.ocr.org.uk/Images/308723-specification-accredited-a-level-gce-mathematics-a-h240.pdf", previewUrl: `${LOCAL}/ocr-h240-spec-v3.pdf` },
      { id: "ocr-h240-formula", type: "formula", title: "H240 formulae printed in each question paper", version: "Specification reference", status: "reference", officialUrl: "https://www.ocr.org.uk/Images/308723-specification-accredited-a-level-gce-mathematics-a-h240.pdf#page=4", previewUrl: `${LOCAL}/ocr-h240-spec-v3.pdf#page=4`, note: "这是卷内公式规则，不是独立公式册。" },
    ],
    release,
  },
  {
    id: "ocr-h245",
    board: "Cambridge OCR",
    qualification: "A Level Further Mathematics A",
    code: "H245",
    region,
    examSeries: [{ name: "May/June", note: "全部选定试卷必须在同一终结性考试系列完成" }],
    paperCount: "每位考生考 4 张：Pure Core 1、Pure Core 2 必考，再从 Statistics、Mechanics、Discrete Mathematics、Additional Pure Mathematics 中任选 2 张。",
    nextExam: {
      date: "2027-05-18",
      session: "PM",
      code: "Y540",
      title: "Pure Core 1",
      durationMinutes: 90,
      group: "Mandatory",
    },
    components: [
      { code: "Y540", name: "Pure Core 1", group: "Mandatory", durationMinutes: 90, marks: 75, weighting: "25%", calculator: "allowed" },
      { code: "Y541", name: "Pure Core 2", group: "Mandatory", durationMinutes: 90, marks: 75, weighting: "25%", calculator: "allowed" },
      { code: "Y542", name: "Statistics", group: "Optional", durationMinutes: 90, marks: 75, weighting: "25%", calculator: "allowed" },
      { code: "Y543", name: "Mechanics", group: "Optional", durationMinutes: 90, marks: 75, weighting: "25%", calculator: "allowed" },
      { code: "Y544", name: "Discrete Mathematics", group: "Optional", durationMinutes: 90, marks: 75, weighting: "25%", calculator: "allowed" },
      { code: "Y545", name: "Additional Pure Mathematics", group: "Optional", durationMinutes: 90, marks: 75, weighting: "25%", calculator: "allowed" },
    ],
    routes: [
      { id: "statistics-mechanics", level: "A Level", label: "Statistics + Mechanics", papers: ["Y540", "Y541", "Y542", "Y543"] },
      { id: "statistics-discrete", level: "A Level", label: "Statistics + Discrete Mathematics", papers: ["Y540", "Y541", "Y542", "Y544"] },
      { id: "statistics-additional-pure", level: "A Level", label: "Statistics + Additional Pure", papers: ["Y540", "Y541", "Y542", "Y545"] },
      { id: "mechanics-discrete", level: "A Level", label: "Mechanics + Discrete Mathematics", papers: ["Y540", "Y541", "Y543", "Y544"] },
      { id: "mechanics-additional-pure", level: "A Level", label: "Mechanics + Additional Pure", papers: ["Y540", "Y541", "Y543", "Y545"] },
      { id: "discrete-additional-pure", level: "A Level", label: "Discrete Mathematics + Additional Pure", papers: ["Y540", "Y541", "Y544", "Y545"] },
    ],
    calculator: {
      status: "all",
      summary: "六种可能试卷均允许科学或图形计算器；设备应支持矩阵运算、汇总统计及二项/正态分布概率。",
      prohibited: calculatorProhibited,
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "独立公式册",
      summary: "每张试卷均提供 H245 Formulae Booklet；公式册也包含 H240 A Level Mathematics A 的公式。",
    },
    upcomingSeries: "June 2027",
    timetableStatus: "Final · published June 2026",
    upcomingExams: [
      { date: "2027-05-18", session: "PM", code: "Y540", title: "Pure Core 1", durationMinutes: 90, group: "Mandatory" },
      { date: "2027-05-20", session: "PM", code: "Y541", title: "Pure Core 2", durationMinutes: 90, group: "Mandatory" },
      { date: "2027-05-25", session: "PM", code: "Y542", title: "Statistics", durationMinutes: 90, group: "Optional" },
      { date: "2027-06-10", session: "PM", code: "Y543", title: "Mechanics", durationMinutes: 90, group: "Optional" },
      { date: "2027-06-15", session: "PM", code: "Y544", title: "Discrete Mathematics", durationMinutes: 90, group: "Optional" },
      { date: "2027-06-18", session: "PM", code: "Y545", title: "Additional Pure Mathematics", durationMinutes: 90, group: "Optional" },
    ],
    materials: [
      { id: "ocr-h245-timetable", type: "timetable", title: "June 2027 AS, A Level and FSMQ Final Timetable", version: "Final · June 2026", status: "current", officialUrl: JUNE_2027_TIMETABLE, previewUrl: `${LOCAL}/ocr-june-2027-as-a-level-fsmq-final.pdf` },
      { id: "ocr-h245-spec", type: "syllabus", title: "H245 A Level Further Mathematics A Specification", version: "Version 2 · October 2025", status: "current", officialUrl: "https://www.ocr.org.uk/Images/308752-specification-accredited-a-level-gce-further-mathematics-a-h245.pdf", previewUrl: `${LOCAL}/ocr-h245-spec-v2.pdf` },
      { id: "ocr-h245-formula", type: "formula", title: "H245 A Level Further Mathematics A Formulae Booklet", version: "Current official booklet", status: "current", officialUrl: "https://www.ocr.org.uk/Images/726857-formulae-booklet-a-level-further-mathematics-a.pdf", previewUrl: `${LOCAL}/ocr-h245-formulae-booklet.pdf` },
    ],
    release,
  },
];
