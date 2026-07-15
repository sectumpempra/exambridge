import type { ExamOverview } from "./schema";

const LOCAL = "/exam-materials";
const IGCSE_NOV_TIMETABLE = "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-Edexcel-International-GCSE/intgcse-nov-2026-final.pdf";
const IGCSE_SUMMER_TIMETABLE = "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-Edexcel-International-GCSE/int-gcse-summer-2027-final.pdf";
const IAL_TIMETABLE = "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-International-Advanced-Levels/ial-october2026-final.pdf";
const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: { normal: "每周一核对官方时间表", nearExam: "距离考试 60 天内每日核对", materials: "每月 1 日核对考纲与考试资料" },
};

type PearsonIgcseScienceInput = {
  id: string;
  code: "4BI1" | "4CH1" | "4PH1";
  subject: string;
  suffix: "B" | "C" | "P";
  paper1Date: string;
  paper2Date: string;
  specUrl: string;
  specFile: string;
  specVersion: string;
  formula: ExamOverview["formula"];
  references?: ExamOverview["materials"];
};

function makePearsonIgcseScience(input: PearsonIgcseScienceInput): ExamOverview {
  const paper1 = `${input.code}/1${input.suffix}`;
  const paper2 = `${input.code}/2${input.suffix}`;
  return {
    id: input.id,
    board: "Pearson Edexcel",
    qualification: `Pearson Edexcel International GCSE ${input.subject}`,
    code: input.code,
    region: { label: "中国大陆", note: "November 2026 使用标准试卷；Summer 中国大陆按官方 information manual 使用 R variant。仅展示 Morning / Afternoon，不推算当地钟点。" },
    examSeries: [{ name: "November", note: "无 R variant" }, { name: "Summer (May/June)", note: "中国大陆使用 R variant" }],
    paperCount: "线性资格共 2 张必考试卷，均在同一考季完成；不分 tier。",
    nextExam: { date: input.paper1Date, session: "Morning", code: paper1, title: `${input.subject} Paper 1`, durationMinutes: 120, group: "Linear" },
    components: [
      { code: paper1, name: `${input.subject} Paper 1`, durationMinutes: 120, marks: 110, weighting: "61.1%", calculator: "allowed", assessmentMode: "written" },
      { code: paper2, name: `${input.subject} Paper 2`, durationMinutes: 75, marks: 70, weighting: "38.9%", calculator: "allowed", assessmentMode: "written" },
    ],
    routes: [{ id: "linear", level: "International GCSE", label: "Linear · untiered", papers: [paper1, paper2], note: "两张均为必考。" }],
    calculator: { status: "all", summary: "两张书面考试均允许使用计算器。", prohibited: ["符号代数、微分或积分", "文字或资料库检索", "与其他设备或互联网通信"] },
    formula: input.formula,
    practical: { status: "not-applicable", summary: "实践技能通过规定实验教学并在书面试卷中考核；没有独立实验考试或 practical endorsement。", options: [] },
    upcomingSeries: "November 2026", timetableStatus: "Final",
    upcomingExams: [
      { date: input.paper1Date, session: "Morning", code: paper1, title: `${input.subject} Paper 1`, durationMinutes: 120, group: "Linear" },
      { date: input.paper2Date, session: "Morning", code: paper2, title: `${input.subject} Paper 2`, durationMinutes: 75, group: "Linear" },
    ],
    materials: [
      { id: `${input.code}-timetable`, type: "timetable", title: "International GCSE November 2026 Timetable", version: "Final", status: "current", officialUrl: IGCSE_NOV_TIMETABLE, previewUrl: `${LOCAL}/pearson-intgcse-november-2026-final.pdf` },
      { id: `${input.code}-spec`, type: "syllabus", title: `International GCSE ${input.subject} Specification`, version: input.specVersion, status: "current", officialUrl: input.specUrl, previewUrl: `${LOCAL}/${input.specFile}` },
      { id: `${input.code}-practical`, type: "practical-guidance", title: "Practical skills and written assessment guidance", version: input.specVersion, status: "reference", officialUrl: input.specUrl, previewUrl: `${LOCAL}/${input.specFile}`, note: "第一版直接定位到官方规格中的实践技能与考试结构，不另打包教师实验指南。" },
      ...(input.references ?? []),
    ],
    release,
  };
}

type IalSubjectInput = {
  id: string;
  subject: string;
  prefix: "WBI" | "WCH" | "WPH";
  awardCodes: string;
  dates: [string, string, string, string, string, string];
  sessions: ["Morning" | "Afternoon", "Morning" | "Afternoon", "Morning" | "Afternoon", "Morning" | "Afternoon", "Morning" | "Afternoon", "Morning" | "Afternoon"];
  specUrl: string;
  specFile: string;
  specVersion: string;
  formula: ExamOverview["formula"];
  references?: ExamOverview["materials"];
};

const ialUnitMeta = [
  { unit: 1, durationMinutes: 90, marks: 80, weighting: "IAS 40% / IAL 20%", name: "Unit 1", mode: "written" as const },
  { unit: 2, durationMinutes: 90, marks: 80, weighting: "IAS 40% / IAL 20%", name: "Unit 2", mode: "written" as const },
  { unit: 3, durationMinutes: 80, marks: 50, weighting: "IAS 20% / IAL 10%", name: "Unit 3 · Practical Skills", mode: "written" as const },
  { unit: 4, durationMinutes: 105, marks: 90, weighting: "IAL 20%", name: "Unit 4", mode: "written" as const },
  { unit: 5, durationMinutes: 105, marks: 90, weighting: "IAL 20%", name: "Unit 5", mode: "written" as const },
  { unit: 6, durationMinutes: 80, marks: 50, weighting: "IAL 10%", name: "Unit 6 · Practical Skills", mode: "written" as const },
];

function makePearsonIalScience(input: IalSubjectInput): ExamOverview {
  const codeFor = (unit: number) => `${input.prefix}1${unit}/01`;
  const components = ialUnitMeta.map((item) => ({
    code: codeFor(item.unit), name: `${input.subject} ${item.name}`, durationMinutes: item.durationMinutes,
    marks: item.marks, weighting: item.weighting, group: `Unit ${item.unit}`, calculator: "allowed" as const, assessmentMode: item.mode,
  }));
  const upcomingExams = ialUnitMeta.map((item, index) => ({
    date: input.dates[index], session: input.sessions[index], code: `${input.prefix}1${item.unit} 01`,
    title: `${input.subject} ${item.name}`, durationMinutes: item.durationMinutes, group: `Unit ${item.unit}`,
  })).sort((a, b) => a.date.localeCompare(b.date));
  return {
    id: input.id, board: "Pearson Edexcel", qualification: `Pearson Edexcel International Advanced Level ${input.subject}`, code: input.awardCodes,
    region: { label: "中国大陆", note: "公开时间表不提供足够证据把中国大陆映射为 IAL A-paper 区域，因此不作 A variant 推断；仅展示 Morning / Afternoon。" },
    examSeries: [{ name: "January" }, { name: "Summer (May/June)" }, { name: "October" }],
    paperCount: "IAS 由 Units 1–3 组成；完整 IAL 由 Units 1–6 组成。各单元均为外部书面考试，可按 Pearson 规则分考季累积。",
    nextExam: upcomingExams[0],
    components,
    routes: [
      { id: "ias", level: "IAS", label: "International AS", papers: [codeFor(1), codeFor(2), codeFor(3)] },
      { id: "ial-staged", level: "IAL · staged", label: "IAS + second stage", papers: [codeFor(1), codeFor(2), codeFor(3), codeFor(4), codeFor(5), codeFor(6)] },
      { id: "ial-linear", level: "IAL", label: "All six units", papers: [codeFor(1), codeFor(2), codeFor(3), codeFor(4), codeFor(5), codeFor(6)] },
    ],
    qualificationViews: [
      { key: "ial", label: "IAL", paperCount: "6 个单元：Units 1–6", componentGroups: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5", "Unit 6"], routes: [{ id: "ial", level: "IAL", label: "Units 1–6", papers: components.map((item) => item.code) }] },
      { key: "ias", label: "IAS", paperCount: "3 个单元：Units 1–3", componentGroups: ["Unit 1", "Unit 2", "Unit 3"], routes: [{ id: "ias", level: "IAS", label: "Units 1–3", papers: components.slice(0, 3).map((item) => item.code) }] },
    ],
    calculator: { status: "all", summary: "Units 1–6 均允许使用符合 Pearson 规定的计算器。", prohibited: ["符号代数、微分或积分", "文字或资料库检索", "与其他设备或互联网通信"] },
    formula: input.formula,
    practical: { status: "required", summary: "实践能力通过教学中的规定实验与 Units 3、6 的书面 Practical Skills 考试评估；没有现场实验考试。", options: [{ label: "IAS practical skills", papers: [codeFor(3)], note: "80 分钟，50 marks，书面考试。" }, { label: "IAL practical skills", papers: [codeFor(6)], note: "80 分钟，50 marks，书面考试。" }] },
    upcomingSeries: "October 2026", timetableStatus: "Final", upcomingExams,
    materials: [
      { id: `${input.id}-timetable`, type: "timetable", title: "International Advanced Levels October 2026 Timetable", version: "Final", status: "current", officialUrl: IAL_TIMETABLE, previewUrl: `${LOCAL}/pearson-ial-october-2026-final.pdf` },
      { id: `${input.id}-spec`, type: "syllabus", title: `International Advanced Level ${input.subject} Specification`, version: input.specVersion, status: "current", officialUrl: input.specUrl, previewUrl: `${LOCAL}/${input.specFile}` },
      ...(input.references ?? []),
    ],
    release,
  };
}

export const PEARSON_SCIENCE_EXAM_OVERVIEWS: ExamOverview[] = [
  makePearsonIgcseScience({
    id: "pearson-igcse-4bi1", code: "4BI1", subject: "Biology", suffix: "B", paper1Date: "2026-11-02", paper2Date: "2026-11-13",
    specUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Biology/2017/specification-and-sample-assessments/international-gcse-biology-2017-specification1.pdf", specFile: "pearson-4bi1-specification-issue3.pdf", specVersion: "Issue 3 · September 2024",
    formula: { supplied: false, status: "not-applicable", label: "公式与数据资料", summary: "官方规格未列出独立公式表、数据册或预发布资料。" },
  }),
  makePearsonIgcseScience({
    id: "pearson-igcse-4ch1", code: "4CH1", subject: "Chemistry", suffix: "C", paper1Date: "2026-11-09", paper2Date: "2026-11-16",
    specUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Chemistry/2017/specification-and-sample-assessments/international-gcse-chemistry-2017-specification.pdf", specFile: "pearson-4ch1-specification-issue3.pdf", specVersion: "Issue 3 · September 2024",
    formula: { supplied: false, status: "unknown", label: "元素周期表", summary: "官方规格附元素周期表作为参考，但现有一手证据未确认考场是否随试卷发放；第一版不作提供承诺。" },
    references: [{ id: "4ch1-periodic", type: "periodic-table", title: "Periodic Table", version: "Specification appendix · page 55", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Chemistry/2017/specification-and-sample-assessments/international-gcse-chemistry-2017-specification.pdf#page=55", previewUrl: `${LOCAL}/pearson-4ch1-specification-issue3.pdf#page=55` }],
  }),
  makePearsonIgcseScience({
    id: "pearson-igcse-4ph1", code: "4PH1", subject: "Physics", suffix: "P", paper1Date: "2026-11-11", paper2Date: "2026-11-18",
    specUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Physics/2017/specification-and-sample-assessments/international-gcse-physics-2017-specification.pdf", specFile: "pearson-4ph1-specification-issue4.pdf", specVersion: "Issue 4 · September 2024",
    formula: { supplied: true, status: "provided", label: "完整公式表", summary: "Pearson 已确认 2025–2027 的 International GCSE Physics 考试提供完整 equation sheet；2028 政策待官方确认。" },
    references: [{ id: "4ph1-equations", type: "formula", title: "International GCSE Physics Equation Sheet", version: "Applicable through November 2027", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Physics/2017/teaching-and-learning-materials/int-gcse-physics-4ph1-science-double-award-4ds0-equation-sheet.pdf", previewUrl: `${LOCAL}/pearson-igcse-physics-equation-sheet.pdf`, note: "2028 起政策需继续监控。" }],
  }),
  {
    id: "pearson-igcse-4cp0", board: "Pearson Edexcel", qualification: "Pearson Edexcel International GCSE Computer Science", code: "4CP0",
    region: { label: "中国大陆", note: "官方 2025/26 information manual 未列出 4CP0 R entry option；只展示 Morning 或考试窗口，不推算当地钟点。" },
    examSeries: [{ name: "Summer (May/June)" }], paperCount: "2 张必考：Paper 1 为书面考试，Paper 2 为受监督的三小时上机实践考试。",
    nextExam: { date: "2027-05-10", session: "Morning", code: "4CP0/01", title: "Paper 1 · Principles of Computer Science", durationMinutes: 120 },
    components: [
      { code: "4CP0/01", name: "Principles of Computer Science", durationMinutes: 120, marks: 80, weighting: "50%", calculator: "unknown", assessmentMode: "written" },
      { code: "4CP0/02", name: "Application of Computational Thinking", durationMinutes: 180, marks: 80, weighting: "50%", calculator: "unknown", assessmentMode: "programming", note: "在受监督的计算机环境完成；entry options A Python、B C#、C Java。" },
    ],
    routes: [{ id: "linear", level: "International GCSE", label: "Linear", papers: ["4CP0/01", "4CP0/02"], note: "两张均为必考。" }],
    calculator: { status: "unknown", summary: "现有官方规格证据未明确计算器规则；上线保留为待核验，不作允许或禁止推断。", prohibited: [] },
    formula: { supplied: true, status: "provided", label: "Pseudocode reference", summary: "Paper 2 考试提供 pseudocode reference document；它不是公式表，但属于可在 assessment 中查阅的官方参考资料。" },
    practical: { status: "required", summary: "Paper 2 是 3 小时受监督上机实践考试。", options: [{ label: "Python entry option A", papers: ["4CP0/02"] }, { label: "C# entry option B", papers: ["4CP0/02"] }, { label: "Java entry option C", papers: ["4CP0/02"] }] },
    upcomingSeries: "Summer 2027", timetableStatus: "Final",
    upcomingExams: [
      { date: "2027-05-10", session: "Morning", code: "4CP0/01", title: "Paper 1 · Principles of Computer Science", durationMinutes: 120 },
      { date: "2027-06-07", session: "Window · 7–9 June", code: "4CP0/02", title: "Paper 2 · Application of Computational Thinking", durationMinutes: 180 },
    ],
    materials: [
      { id: "4cp0-timetable", type: "timetable", title: "International GCSE Summer 2027 Timetable", version: "Final", status: "current", officialUrl: IGCSE_SUMMER_TIMETABLE, previewUrl: `${LOCAL}/pearson-intgcse-summer-2027-final.pdf` },
      { id: "4cp0-spec", type: "syllabus", title: "International GCSE Computer Science Specification", version: "Current specification", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/computer-science/2017/specification-and-sample-assessments/international-gcse-in-Computer-Science-Specification.pdf", previewUrl: `${LOCAL}/pearson-4cp0-specification.pdf` },
      { id: "4cp0-pseudocode", type: "reference-document", title: "Pseudocode reference policy", version: "Specification · page 12", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/computer-science/2017/specification-and-sample-assessments/international-gcse-in-Computer-Science-Specification.pdf#page=12", previewUrl: `${LOCAL}/pearson-4cp0-specification.pdf#page=12`, note: "规格确认考试中可查阅 pseudocode reference document。" },
    ], release,
  },
  makePearsonIalScience({
    id: "pearson-ial-biology", subject: "Biology", prefix: "WBI", awardCodes: "YBI11 / XBI11",
    dates: ["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-23", "2026-10-27", "2026-10-29"], sessions: ["Afternoon", "Afternoon", "Afternoon", "Morning", "Morning", "Morning"],
    specUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Biology/2018/Specification-and-Sample-Assessment/International-A-Level-Biology-Spec.pdf", specFile: "pearson-ial-biology-specification.pdf", specVersion: "Issue 3 · September 2024",
    formula: { supplied: true, status: "varies", label: "Unit 5 Scientific Article", summary: "Unit 5 使用考季专属 scientific article：考前发布供学习，考试时发全新副本；不能携带批注副本。区域版本映射未确认时不作推断。" },
    references: [{ id: "ial-bio-article", type: "data-booklet", title: "Scientific Article FAQs", version: "Current teaching guidance", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Biology/2018/Teaching-and-Learning-Materials/ial-biology-scientific-article-faqs.pdf", previewUrl: `${LOCAL}/pearson-ial-biology-scientific-article-faq.pdf` }],
  }),
  makePearsonIalScience({
    id: "pearson-ial-chemistry", subject: "Chemistry", prefix: "WCH", awardCodes: "YCH11 / XCH11",
    dates: ["2026-10-09", "2026-10-13", "2026-10-20", "2026-10-22", "2026-10-26", "2026-10-29"], sessions: ["Afternoon", "Morning", "Morning", "Afternoon", "Afternoon", "Afternoon"],
    specUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Chemistry/2018/Specification-and-Sample-Assessment/International-A-Level-Chemistry-Spec.pdf", specFile: "pearson-ial-chemistry-specification.pdf", specVersion: "Issue 3 · September 2024",
    formula: { supplied: true, status: "provided", label: "Chemistry Data Booklet", summary: "官方 Chemistry Data Booklet 用于 Units 2、4、5；考生在这些考试中会拿到干净副本。" },
    references: [{ id: "ial-chem-data", type: "data-booklet", title: "IAL Chemistry Data Booklet", version: "Issue 1 · March 2019", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Chemistry/2018/Teaching-and-Learning-Materials/IAL_Chemistry%202018_Data_booklet_Issue_1_March%202019.pdf", previewUrl: `${LOCAL}/pearson-ial-chemistry-data-booklet.pdf` }],
  }),
  makePearsonIalScience({
    id: "pearson-ial-physics", subject: "Physics", prefix: "WPH", awardCodes: "YPH11 / XPH11",
    dates: ["2026-10-08", "2026-10-15", "2026-10-19", "2026-10-21", "2026-10-28", "2026-10-30"], sessions: ["Afternoon", "Afternoon", "Afternoon", "Morning", "Morning", "Afternoon"],
    specUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Physics/2018/Specification%20and%20Sample%20Assessment/9781446957783_IAL_Physics_Iss3.pdf", specFile: "pearson-ial-physics-specification-issue3.pdf", specVersion: "Issue 3",
    formula: { supplied: true, status: "provided", label: "公式与常数", summary: "每张考试试卷提供相关公式；完整公式页见官方规格 pages 69–78，并需同时采用官方 SI prefixes addendum。" },
    references: [{ id: "ial-physics-formula", type: "formula", title: "Physics formulae", version: "Specification · pages 69–78", status: "reference", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Physics/2018/Specification%20and%20Sample%20Assessment/9781446957783_IAL_Physics_Iss3.pdf#page=69", previewUrl: `${LOCAL}/pearson-ial-physics-specification-issue3.pdf#page=69` }, { id: "ial-physics-prefix", type: "update-notice", title: "SI unit prefixes addendum", version: "Current addendum", status: "current", officialUrl: "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Physics/2018/Specification%20and%20Sample%20Assessment/international-a-level-physics-unit-prefixes-addendum-to-specification.pdf", previewUrl: `${LOCAL}/pearson-ial-physics-unit-prefixes-addendum.pdf` }],
  }),
];
