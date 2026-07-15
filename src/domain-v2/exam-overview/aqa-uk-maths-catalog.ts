import type { ExamOverview } from "./schema";

const LOCAL = "/exam-materials";
const AQA_NOVEMBER_2026_TIMETABLE = "https://www.aqa.org.uk/files/cec4fc90-997e-4da1-b3c2-e217c0e58fdb/721192a6ebd4e5c0eafe6a90d60e47f7e9e4bae0.pdf";
const AQA_GCSE_JUNE_2027_TIMETABLE = "https://www.aqa.org.uk/files/449f89fe-eb10-43c4-9f7f-d94906b16007/1b83dffb83cee43a7cb70a026385147f6dd632a0.pdf";
const AQA_GCE_JUNE_2027_TIMETABLE = "https://www.aqa.org.uk/files/f8837da9-1846-4e7f-89a3-fb265c42f2e5/0aac844db1a6bf406bc5c28d523d39996a61592d.pdf";
const AQA_FORMULA_UPDATE = "https://www.aqa.org.uk/news/gcse-maths-and-gcse-sciences-formulae-and-equation-sheets-for-2025-2027";

const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: {
    normal: "每周一核对 AQA confirmed timetable 与资格 Key Dates",
    nearExam: "距离考试 60 天内每日核对；若两个官方来源冲突，暂停自动发布并人工确认",
    materials: "每月 1 日核对 specification、公式资料与 AQA 更新公告",
  },
};

const ukRegion = {
  label: "英国本土 · AQA",
  note: "日期与 AM / PM 按 AQA 英国本土时间表原样展示，不换算其他时区；考点最终须以最新版 confirmed timetable 和个人准考安排为准。",
};

export const AQA_UK_MATHS_EXAM_OVERVIEWS: ExamOverview[] = [
  {
    id: "aqa-8300",
    board: "AQA",
    qualification: "AQA GCSE Mathematics",
    code: "8300",
    region: ukRegion,
    examSeries: [
      { name: "May/June" },
      { name: "November", note: "仅限在该年 8 月 31 日已满 16 岁的考生；三张卷须在同一考季、同一层级完成。" },
    ],
    paperCount: "每位考生考 3 张：Foundation 或 Higher 同一层级的 Paper 1、2、3；每张 80 marks，各占 33⅓%。",
    nextExam: {
      date: "2026-11-04",
      session: "AM",
      code: "8300/1F · 8300/1H",
      title: "Paper 1 · Non-calculator（Foundation / Higher）",
      durationMinutes: 90,
      group: "按报考层级",
    },
    components: [
      { code: "8300/1F", name: "Paper 1 · Non-calculator", group: "Foundation", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "not-allowed", assessmentMode: "written" },
      { code: "8300/2F", name: "Paper 2 · Calculator", group: "Foundation", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "required", assessmentMode: "written" },
      { code: "8300/3F", name: "Paper 3 · Calculator", group: "Foundation", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "required", assessmentMode: "written" },
      { code: "8300/1H", name: "Paper 1 · Non-calculator", group: "Higher", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "not-allowed", assessmentMode: "written" },
      { code: "8300/2H", name: "Paper 2 · Calculator", group: "Higher", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "required", assessmentMode: "written" },
      { code: "8300/3H", name: "Paper 3 · Calculator", group: "Higher", durationMinutes: 90, marks: 80, weighting: "33⅓%", calculator: "required", assessmentMode: "written" },
    ],
    routes: [
      { id: "foundation", level: "Foundation · grades 1–5", label: "Foundation route", papers: ["8300/1F", "8300/2F", "8300/3F"], note: "三张均为必考，必须在同一考季完成。" },
      { id: "higher", level: "Higher · grades 4–9", label: "Higher route", papers: ["8300/1H", "8300/2H", "8300/3H"], note: "三张均为必考，必须在同一考季完成。" },
    ],
    calculator: {
      status: "mixed",
      summary: "Paper 1 禁止计算器；Paper 2、3 要求使用符合当期 JCQ 规则的计算器。",
      prohibited: ["Paper 1 使用任何计算器", "不符合当期 JCQ Instructions for conducting examinations 的设备"],
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "Foundation / Higher 公式表",
      summary: "AQA 确认 2026、2027 考试均提供完整公式表，并作为每张数学试卷的 insert；本次 November 2026 使用对应层级的 2026 公式表。",
    },
    practical: { status: "not-applicable", summary: "资格全部通过书面考试评估。", options: [] },
    upcomingSeries: "November 2026",
    timetableStatus: "Confirmed · Version 1.0 · December 2025",
    upcomingExams: [
      { date: "2026-11-04", session: "AM", code: "8300/1F", title: "Paper 1 · Non-calculator", durationMinutes: 90, group: "Foundation" },
      { date: "2026-11-04", session: "AM", code: "8300/1H", title: "Paper 1 · Non-calculator", durationMinutes: 90, group: "Higher" },
      { date: "2026-11-06", session: "AM", code: "8300/2F", title: "Paper 2 · Calculator", durationMinutes: 90, group: "Foundation" },
      { date: "2026-11-06", session: "AM", code: "8300/2H", title: "Paper 2 · Calculator", durationMinutes: 90, group: "Higher" },
      { date: "2026-11-09", session: "AM", code: "8300/3F", title: "Paper 3 · Calculator", durationMinutes: 90, group: "Foundation" },
      { date: "2026-11-09", session: "AM", code: "8300/3H", title: "Paper 3 · Calculator", durationMinutes: 90, group: "Higher" },
    ],
    materials: [
      { id: "aqa-8300-timetable", type: "timetable", title: "AQA November 2026 GCSE Timetable", version: "Confirmed · Version 1.0 · December 2025", status: "current", officialUrl: AQA_NOVEMBER_2026_TIMETABLE, previewUrl: `${LOCAL}/aqa-gcse-november-2026-confirmed-v1.0.pdf`, note: "8300 全部组件见官方 PDF 第 4 页。" },
      { id: "aqa-8300-spec", type: "syllabus", title: "AQA GCSE Mathematics 8300 Specification", version: "Version 1.0", status: "current", officialUrl: "https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-8300-SP-2015.PDF", previewUrl: `${LOCAL}/aqa-8300-spec-v1.0.pdf`, note: "考试结构见第 7 页；考季规则第 36 页；计算器规则第 41 页。" },
      { id: "aqa-8300-foundation-formula", type: "formula", title: "GCSE Mathematics Foundation Formulae Sheet", version: "For exams in 2026 only", status: "current", officialUrl: "https://www.aqa.org.uk/files/resources.mathematics.AQA-8300F-FS-INS-2025_PDF/62e6d87dcdb8d76c07233364750d533f9b7c284a.pdf", previewUrl: `${LOCAL}/aqa-8300-foundation-formulae-2026.pdf`, note: "仅用于 2026 Foundation 试卷；2027 仍确认提供公式表，但须使用届时发布的版本。" },
      { id: "aqa-8300-higher-formula", type: "formula", title: "GCSE Mathematics Higher Formulae Sheet", version: "For exams in 2026 only", status: "current", officialUrl: "https://www.aqa.org.uk/files/resources.mathematics.AQA-8300H-FS-INS-2025_PDF/c87a0d4512612ebfb053370b84e9339e546e9e27.pdf", previewUrl: `${LOCAL}/aqa-8300-higher-formulae-2026.pdf`, note: "仅用于 2026 Higher 试卷；2027 仍确认提供公式表，但须使用届时发布的版本。" },
      { id: "aqa-8300-formula-update", type: "update-notice", title: "GCSE Maths formulae sheets for 2026–2027", version: "Updated 18 March 2026", status: "current", officialUrl: AQA_FORMULA_UPDATE, previewUrl: `${LOCAL}/aqa-8300-spec-v1.0.pdf#page=42`, note: "官方公告确认 2026、2027 均提供完整公式表；本地预览链接展示 specification 公式附录，公告正文请打开官方链接。" },
    ],
    release,
  },
  {
    id: "aqa-8365",
    board: "AQA",
    qualification: "AQA Level 2 Certificate in Further Mathematics",
    code: "8365",
    region: {
      ...ukRegion,
      note: `${ukRegion.note} 当前 AQA 两个官方来源未同步：confirmed timetable 与资格 Key Dates 的日期、场次均冲突。`,
    },
    examSeries: [{ name: "May/June", note: "每位考生在同一考季完成两张卷。" }],
    paperCount: "2 张必考试卷：Paper 1 非计算器、Paper 2 计算器；每张 80 marks，各占 50%。",
    nextExam: {
      date: "2027-06-11",
      session: "AM",
      code: "8365/1",
      title: "Paper 1 · Non-calculator",
      durationMinutes: 105,
      group: "按 confirmed timetable 暂列",
    },
    components: [
      { code: "8365/1", name: "Paper 1 · Non-calculator", durationMinutes: 105, marks: 80, weighting: "50%", calculator: "not-allowed", assessmentMode: "written", note: "暂按 confirmed timetable：11 June 2027 AM；Key Dates 同日却显示 PM。" },
      { code: "8365/2", name: "Paper 2 · Calculator", durationMinutes: 105, marks: 80, weighting: "50%", calculator: "allowed", assessmentMode: "written", note: "暂按 confirmed timetable：17 June 2027 AM；Key Dates 显示 16 June 2027 PM，日期与场次均冲突。" },
    ],
    routes: [
      { id: "untiered", level: "Untiered · grades 5–9（允许 grade 4）", label: "Single linear route", papers: ["8365/1", "8365/2"], note: "两张均为必考，必须在同一 May/June 考季完成。" },
    ],
    calculator: {
      status: "mixed",
      summary: "Paper 1 禁止计算器；Paper 2 允许使用符合当期 JCQ 规则的计算器。",
      prohibited: ["Paper 1 使用任何计算器", "不符合当期 JCQ Instructions for conducting examinations 的设备"],
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "Level 2 Further Mathematics 公式表",
      summary: "AQA 已确认 8365 在 2027 考试提供公式表；截至核验日尚未在公开页面定位到标注 2027 的独立 PDF，发布后须补充并复核。",
    },
    practical: { status: "not-applicable", summary: "资格全部通过书面考试评估。", options: [] },
    upcomingSeries: "June 2027",
    timetableStatus: "Confirmed timetable · Version 1.0：暂列 8365/1 = 11 Jun AM、8365/2 = 17 Jun AM；但 AQA Key Dates 显示 11 Jun PM、16 Jun PM。官方来源冲突，发布/报考前必须人工复核，不能静默采用。",
    upcomingExams: [
      { date: "2027-06-11", session: "AM", code: "8365/1", title: "Paper 1 · Non-calculator（按 confirmed timetable 暂列）", durationMinutes: 105 },
      { date: "2027-06-17", session: "AM", code: "8365/2", title: "Paper 2 · Calculator（按 confirmed timetable 暂列；Key Dates 冲突）", durationMinutes: 105 },
    ],
    materials: [
      { id: "aqa-8365-timetable", type: "timetable", title: "AQA May/June 2027 GCSE and AQA Certificates Timetable", version: "Confirmed · Version 1.0", status: "current", officialUrl: AQA_GCSE_JUNE_2027_TIMETABLE, previewUrl: `${LOCAL}/aqa-gcse-june-2027-confirmed-v1.0.pdf#page=22`, note: "PDF 第 22 页列 8365/1 为 11 June AM、8365/2 为 17 June AM；资格 Key Dates 页面则列 11 June PM、16 June PM。当前按 confirmed timetable 暂列，但必须保留冲突警告并人工复核。" },
      { id: "aqa-8365-spec", type: "syllabus", title: "AQA Level 2 Further Mathematics 8365 Specification", version: "Version 1.4 · November 2020", status: "current", officialUrl: "https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-8365-SP-2018.PDF", previewUrl: `${LOCAL}/aqa-8365-spec-v1.4.pdf`, note: "考试结构见第 5 页；考季规则第 15 页；公式附录第 20–21 页。" },
      { id: "aqa-8365-formula-reference", type: "formula", title: "8365 specification formulae appendix", version: "Specification pages 20–21", status: "reference", officialUrl: "https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-8365-SP-2018.PDF#page=20", previewUrl: `${LOCAL}/aqa-8365-spec-v1.4.pdf#page=20`, note: "用于核对公式内容；不是尚待发布或定位的 2027 考试 insert。" },
      { id: "aqa-8365-formula-update", type: "update-notice", title: "Level 2 Further Mathematics formula sheet provision for 2027", version: "AQA update · 18 March 2026", status: "current", officialUrl: AQA_FORMULA_UPDATE, previewUrl: `${LOCAL}/aqa-8365-spec-v1.4.pdf#page=20`, note: "公告确认 2027 提供公式表；预览为 specification 公式附录，不是尚待发布/定位的 2027 考试 insert。" },
    ],
    release,
  },
  {
    id: "aqa-7357",
    board: "AQA",
    qualification: "AQA A-level Mathematics",
    code: "7357",
    region: ukRegion,
    examSeries: [{ name: "May/June", note: "线性资格；三张卷须在同一考季完成。" }],
    paperCount: "3 张必考试卷；每张 2 小时、100 marks，各占 A-level 的 33⅓%。",
    nextExam: { date: "2027-05-26", session: "PM", code: "7357/1", title: "Paper 1 · Pure Mathematics", durationMinutes: 120 },
    components: [
      { code: "7357/1", name: "Paper 1 · Pure Mathematics", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "required", assessmentMode: "written", note: "考查 Proof、Algebra、Coordinate geometry、Sequences、Trigonometry、Exponentials、Calculus、Numerical methods。" },
      { code: "7357/2", name: "Paper 2 · Pure Mathematics and Mechanics", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "required", assessmentMode: "written", note: "可考 Paper 1 内容，并考 Vectors、Quantities and units、Kinematics、Forces、Moments。" },
      { code: "7357/3", name: "Paper 3 · Pure Mathematics and Statistics", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "required", assessmentMode: "written", note: "可考 Paper 1 内容，并考 Sampling、Data、Probability、Distributions、Hypothesis testing。" },
    ],
    routes: [{ id: "linear", level: "A-level", label: "Single linear route", papers: ["7357/1", "7357/2", "7357/3"], note: "三张均为必考，在同一 May/June 考季完成。" }],
    calculator: {
      status: "all",
      summary: "三张卷均要求计算器；最低应具备迭代、统计汇总与标准分布概率、inverse normal 等功能，并符合当期 JCQ 规则。",
      prohibited: ["不符合当期 JCQ Instructions for conducting examinations 的设备"],
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "MFB8 公式册",
      summary: "全部考试提供 Formulae for A-level Mathematics；同时报考 Further Mathematics 的考生也可使用更大的 FMFB16。Appendix B 所列部分公式与恒等式仍须记忆。",
    },
    practical: { status: "not-applicable", summary: "资格全部通过书面考试评估。", options: [] },
    upcomingSeries: "June 2027",
    timetableStatus: "Confirmed · Version 1.0",
    upcomingExams: [
      { date: "2027-05-26", session: "PM", code: "7357/1", title: "Paper 1", durationMinutes: 120 },
      { date: "2027-06-09", session: "PM", code: "7357/2", title: "Paper 2", durationMinutes: 120 },
      { date: "2027-06-16", session: "PM", code: "7357/3", title: "Paper 3", durationMinutes: 120 },
    ],
    materials: [
      { id: "aqa-7357-timetable", type: "timetable", title: "AQA May/June 2027 AS and A-level Timetable", version: "Confirmed · Version 1.0", status: "current", officialUrl: AQA_GCE_JUNE_2027_TIMETABLE, previewUrl: `${LOCAL}/aqa-gce-june-2027-confirmed-v1.0.pdf#page=15`, note: "7357 全部组件见官方 PDF 第 15 页；公式册考试使用规则见第 3 页。" },
      { id: "aqa-7357-spec", type: "syllabus", title: "AQA A-level Mathematics 7357 Specification", version: "Version 1.3 · 31 January 2018", status: "current", officialUrl: "https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-7357-SP-2017.PDF", previewUrl: `${LOCAL}/aqa-7357-spec-v1.3.pdf`, note: "考试结构见第 8–9 页；计算器规则第 33 页。" },
      { id: "aqa-7357-formula", type: "formula", title: "Formulae for A-level Mathematics", version: "MFB8 · Version 1.2", status: "current", officialUrl: "https://filestore.aqa.org.uk/resources/mathematics/AQA-AS-A-MATHS-FORMULAE.PDF", previewUrl: `${LOCAL}/aqa-as-a-level-mathematics-formulae.pdf`, note: "7356/7357 全部考试要求使用；考场使用 AQA 提供的干净版本。" },
      { id: "aqa-7357-further-formula", type: "data-booklet", title: "Formulae and statistical tables for A-level Mathematics and Further Mathematics", version: "FMFB16 · Version 1.5", status: "reference", officialUrl: "https://filestore.aqa.org.uk/resources/mathematics/AQA-AS-A-FMATHS-FORMULAE.PDF", previewUrl: `${LOCAL}/aqa-as-a-level-further-mathematics-formulae.pdf`, note: "7357 考生也可使用此较大版本。" },
    ],
    release,
  },
  {
    id: "aqa-7367",
    board: "AQA",
    qualification: "AQA A-level Further Mathematics",
    code: "7367",
    region: ukRegion,
    examSeries: [{ name: "May/June", note: "线性资格；Paper 1、Paper 2 与一组 Paper 3 选项须在同一考季完成。" }],
    paperCount: "每位考生考 3 张：Paper 1、Paper 2，以及从 Discrete / Mechanics / Statistics 中任选两册组成的 Paper 3；每张 100 marks、各占 33⅓%。",
    nextExam: { date: "2027-05-20", session: "PM", code: "7367/1", title: "Paper 1 · Compulsory pure content", durationMinutes: 120 },
    components: [
      { code: "7367/1", name: "Paper 1 · Compulsory pure content", group: "Compulsory", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "required", assessmentMode: "written" },
      { code: "7367/2", name: "Paper 2 · Compulsory pure content", group: "Compulsory", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "required", assessmentMode: "written" },
      { code: "7367/3D + 7367/3S", name: "Paper 3 · Discrete + Statistics", group: "Option pair", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "required", assessmentMode: "written", note: "同一 2 小时 Paper 3 中完成两本选项答题册，并非两张各 2 小时的独立试卷。" },
      { code: "7367/3S + 7367/3M", name: "Paper 3 · Statistics + Mechanics", group: "Option pair", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "required", assessmentMode: "written", note: "同一 2 小时 Paper 3 中完成两本选项答题册，并非两张各 2 小时的独立试卷。" },
      { code: "7367/3M + 7367/3D", name: "Paper 3 · Mechanics + Discrete", group: "Option pair", durationMinutes: 120, marks: 100, weighting: "33⅓%", calculator: "required", assessmentMode: "written", note: "同一 2 小时 Paper 3 中完成两本选项答题册，并非两张各 2 小时的独立试卷。" },
    ],
    routes: [
      { id: "discrete-statistics", level: "A-level", label: "Discrete + Statistics", papers: ["7367/1", "7367/2", "7367/3D + 7367/3S"] },
      { id: "statistics-mechanics", level: "A-level", label: "Statistics + Mechanics", papers: ["7367/1", "7367/2", "7367/3S + 7367/3M"] },
      { id: "mechanics-discrete", level: "A-level", label: "Mechanics + Discrete", papers: ["7367/1", "7367/2", "7367/3M + 7367/3D"] },
    ],
    calculator: {
      status: "all",
      summary: "全部考试要求计算器；最低应具备迭代、3×3 矩阵运算、统计汇总与标准分布概率等功能，并符合当期 JCQ 规则。",
      prohibited: ["不符合当期 JCQ Instructions for conducting examinations 的设备"],
    },
    formula: {
      supplied: true,
      status: "provided",
      label: "FMFB16 公式与统计表",
      summary: "全部 Further Mathematics 考试提供 Formulae and statistical tables for A-level Mathematics and A-level Further Mathematics；Appendix B 所列部分公式与恒等式仍须记忆。",
    },
    practical: { status: "not-applicable", summary: "资格全部通过书面考试评估。", options: [] },
    upcomingSeries: "June 2027",
    timetableStatus: "Confirmed · Version 1.0",
    upcomingExams: [
      { date: "2027-05-20", session: "PM", code: "7367/1", title: "Paper 1", durationMinutes: 120, group: "Compulsory" },
      { date: "2027-05-25", session: "PM", code: "7367/2", title: "Paper 2", durationMinutes: 120, group: "Compulsory" },
      { date: "2027-06-10", session: "PM", code: "7367/3D", title: "Paper 3 · Discrete option booklet", durationMinutes: 120, group: "任选两册" },
      { date: "2027-06-10", session: "PM", code: "7367/3M", title: "Paper 3 · Mechanics option booklet", durationMinutes: 120, group: "任选两册" },
      { date: "2027-06-10", session: "PM", code: "7367/3S", title: "Paper 3 · Statistics option booklet", durationMinutes: 120, group: "任选两册" },
    ],
    materials: [
      { id: "aqa-7367-timetable", type: "timetable", title: "AQA May/June 2027 AS and A-level Timetable", version: "Confirmed · Version 1.0", status: "current", officialUrl: AQA_GCE_JUNE_2027_TIMETABLE, previewUrl: `${LOCAL}/aqa-gce-june-2027-confirmed-v1.0.pdf#page=15`, note: "7367 全部组件与 Paper 3 任取两册规则见官方 PDF 第 15 页；公式册考试使用规则见第 3 页。" },
      { id: "aqa-7367-spec", type: "syllabus", title: "AQA A-level Further Mathematics 7367 Specification", version: "Version 1.1 · 20 October 2017", status: "current", officialUrl: "https://filestore.aqa.org.uk/resources/mathematics/specifications/AQA-7367-SP-2017.PDF", previewUrl: `${LOCAL}/aqa-7367-spec-v1.1.pdf`, note: "考试结构与 Paper 3 路线见第 7–9 页；计算器规则第 38 页。" },
      { id: "aqa-7367-formula", type: "data-booklet", title: "Formulae and statistical tables for A-level Mathematics and Further Mathematics", version: "FMFB16 · Version 1.5", status: "current", officialUrl: "https://filestore.aqa.org.uk/resources/mathematics/AQA-AS-A-FMATHS-FORMULAE.PDF", previewUrl: `${LOCAL}/aqa-as-a-level-further-mathematics-formulae.pdf`, note: "7366/7367 全部考试要求使用；考场使用 AQA 提供的干净版本。" },
    ],
    release,
  },
];
