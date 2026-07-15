import type { ExamOverview } from "./schema";

const LOCAL = "/exam-materials";
const CAMBRIDGE_TIMETABLE = "https://www.cambridgeinternational.org/Images/757650-november-2026-zone-5-timetable.pdf";
const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: { normal: "每周一核对官方时间表", nearExam: "距离考试 60 天内每日核对", materials: "每月 1 日核对考纲与考试资料" },
};

type ScienceInput = {
  id: string;
  code: string;
  qualification: string;
  variant: "2" | "3";
  dates: Record<"1" | "2" | "3" | "4" | "5" | "6", { date: string; session: "AM" | "PM" }>;
  syllabus: { title: string; version: string; officialUrl: string; previewUrl: string };
  update?: { title: string; version: string; officialUrl: string; previewUrl: string };
  formula: ExamOverview["formula"];
  referenceMaterials?: ExamOverview["materials"];
};

function makeIgcseScience(input: ScienceInput): ExamOverview {
  const component = (paper: "1" | "2" | "3" | "4" | "5" | "6") => `${input.code}/${paper}${input.variant}`;
  const details = {
    "1": { name: "Paper 1 · Multiple Choice (Core)", group: "Core", durationMinutes: 45, marks: 40, weighting: "30%", assessmentMode: "multiple-choice" as const },
    "2": { name: "Paper 2 · Multiple Choice (Extended)", group: "Extended", durationMinutes: 45, marks: 40, weighting: "30%", assessmentMode: "multiple-choice" as const },
    "3": { name: "Paper 3 · Theory (Core)", group: "Core", durationMinutes: 75, marks: 80, weighting: "50%", assessmentMode: "written" as const },
    "4": { name: "Paper 4 · Theory (Extended)", group: "Extended", durationMinutes: 75, marks: 80, weighting: "50%", assessmentMode: "written" as const },
    "5": { name: "Paper 5 · Practical Test", group: "Practical", durationMinutes: 75, marks: 40, weighting: "20%", assessmentMode: "practical" as const },
    "6": { name: "Paper 6 · Alternative to Practical", group: "Alternative", durationMinutes: 60, marks: 40, weighting: "20%", assessmentMode: "alternative-practical" as const },
  };
  const papers = (["1", "2", "3", "4", "5", "6"] as const).map((paper) => ({
    code: component(paper), ...details[paper], calculator: "allowed" as const,
  }));
  const upcomingExams = (["1", "2", "3", "4", "5", "6"] as const)
    .map((paper) => ({
      date: input.dates[paper].date,
      session: input.dates[paper].session,
      code: component(paper),
      title: details[paper].name,
      durationMinutes: details[paper].durationMinutes,
      group: details[paper].group,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const firstDate = upcomingExams[0].date;
  const first = upcomingExams.filter((exam) => exam.date === firstDate && exam.session === upcomingExams[0].session);

  return {
    id: input.id,
    board: "Cambridge International",
    qualification: input.qualification,
    code: input.code,
    region: { label: "中国大陆 · Zone 5", note: "默认按上海对应的 Cambridge Administrative Zone 5 展示；AM / PM 是官方场次标签，不推算当地钟点。" },
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "每位考生考 3 张：Core 或 Extended 的选择题与理论卷，再选 Practical Test 或 Alternative to Practical。",
    nextExam: {
      date: firstDate,
      session: first[0].session,
      code: first.map((exam) => exam.code).join(" · "),
      title: first.map((exam) => exam.title.replace(/^Paper \d · /, "")).join(" / "),
      durationMinutes: Math.max(...first.map((exam) => exam.durationMinutes)),
      group: "按报考路线",
    },
    components: papers,
    routes: [
      { id: "core-practical", level: "Core · grades C–G", label: "Core + Practical Test", papers: [component("1"), component("3"), component("5")] },
      { id: "core-alternative", level: "Core · grades C–G", label: "Core + Alternative to Practical", papers: [component("1"), component("3"), component("6")] },
      { id: "extended-practical", level: "Extended · grades A*–G", label: "Extended + Practical Test", papers: [component("2"), component("4"), component("5")] },
      { id: "extended-alternative", level: "Extended · grades A*–G", label: "Extended + Alternative to Practical", papers: [component("2"), component("4"), component("6")] },
    ],
    calculator: { status: "all", summary: "官方考纲允许在所有考试部分使用计算器。", prohibited: ["符号代数、微分或积分", "与其他设备或互联网通信", "储存文字或资料库"] },
    formula: input.formula,
    practical: {
      status: "route-dependent",
      summary: "实践技能为必考部分；考生按考点安排选择 Paper 5 实验考试或 Paper 6 实验替代卷。",
      options: [
        { label: "实验路线", papers: [component("5")], note: "1 小时 15 分，40 marks，20%" },
        { label: "实验替代路线", papers: [component("6")], note: "1 小时，40 marks，20%" },
      ],
    },
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026",
    upcomingExams,
    materials: [
      { id: `${input.code}-timetable`, type: "timetable", title: "November 2026 Zone 5 Final Timetable", version: "Version 1 · April 2026", status: "current", officialUrl: CAMBRIDGE_TIMETABLE, previewUrl: `${LOCAL}/november-2026-zone-5-timetable-v1.pdf` },
      { id: `${input.code}-syllabus`, type: "syllabus", title: input.syllabus.title, version: input.syllabus.version, status: "current", officialUrl: input.syllabus.officialUrl, previewUrl: input.syllabus.previewUrl },
      ...(input.update ? [{ id: `${input.code}-update`, type: "update-notice" as const, title: input.update.title, version: input.update.version, status: "current" as const, officialUrl: input.update.officialUrl, previewUrl: input.update.previewUrl }] : []),
      { id: `${input.code}-practical`, type: "practical-guidance", title: `${input.qualification} · Practical assessment guidance`, version: "Current syllabus", status: "reference", officialUrl: input.syllabus.officialUrl, previewUrl: `${input.syllabus.previewUrl}#page=9`, note: "考试结构与实践路线以官方考纲为准。" },
      ...(input.referenceMaterials ?? []),
    ],
    release,
  };
}

const scienceCourses: ExamOverview[] = [
  makeIgcseScience({
    id: "cambridge-0610", code: "0610", qualification: "Cambridge IGCSE Biology", variant: "3",
    dates: {
      "1": { date: "2026-11-10", session: "AM" }, "2": { date: "2026-11-10", session: "AM" },
      "3": { date: "2026-10-16", session: "AM" }, "4": { date: "2026-10-16", session: "AM" },
      "5": { date: "2026-10-13", session: "AM" }, "6": { date: "2026-10-13", session: "AM" },
    },
    syllabus: { title: "0610 Syllabus 2026–2028", version: "Version 2 · December 2025", officialUrl: "https://www.cambridgeinternational.org/Images/697203-2026-2028-syllabus.pdf", previewUrl: `${LOCAL}/0610-syllabus-2026-2028-v2.pdf` },
    update: { title: "0610 Syllabus Update", version: "Version 2 · December 2025", officialUrl: "https://www.cambridgeinternational.org/Images/748912-2026-syllabus-update.pdf", previewUrl: `${LOCAL}/0610-syllabus-update-v2.pdf` },
    formula: { supplied: false, status: "not-applicable", label: "公式与数据资料", summary: "官方考纲未列出独立公式表或数据册；所需信息以题目和考纲要求为准。" },
  }),
  makeIgcseScience({
    id: "cambridge-0620", code: "0620", qualification: "Cambridge IGCSE Chemistry", variant: "3",
    dates: {
      "1": { date: "2026-11-12", session: "AM" }, "2": { date: "2026-11-12", session: "AM" },
      "3": { date: "2026-10-12", session: "AM" }, "4": { date: "2026-10-12", session: "AM" },
      "5": { date: "2026-10-15", session: "AM" }, "6": { date: "2026-10-15", session: "AM" },
    },
    syllabus: { title: "0620 Syllabus 2026–2028", version: "Version 1 · September 2023", officialUrl: "https://www.cambridgeinternational.org/Images/697205-2026-2028-syllabus.pdf", previewUrl: `${LOCAL}/0620-syllabus-2026-2028-v1.pdf` },
    formula: { supplied: true, status: "varies", label: "周期表与定性分析资料", summary: "理论卷和选择题卷附元素周期表，实验卷不附；Paper 5 和 Paper 6 提供定性分析说明。" },
    referenceMaterials: [
      { id: "0620-qualitative-analysis", type: "data-booklet", title: "Notes for use in qualitative analysis", version: "Current syllabus · page 47", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/697205-2026-2028-syllabus.pdf#page=47", previewUrl: `${LOCAL}/0620-syllabus-2026-2028-v1.pdf#page=47` },
      { id: "0620-periodic-table", type: "periodic-table", title: "Periodic Table", version: "Current syllabus · page 49", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/697205-2026-2028-syllabus.pdf#page=49", previewUrl: `${LOCAL}/0620-syllabus-2026-2028-v1.pdf#page=49`, note: "官方 FAQ：理论卷和选择题卷附表，实验卷不附。" },
    ],
  }),
  makeIgcseScience({
    id: "cambridge-0625", code: "0625", qualification: "Cambridge IGCSE Physics", variant: "2",
    dates: {
      "1": { date: "2026-11-05", session: "PM" }, "2": { date: "2026-11-05", session: "PM" },
      "3": { date: "2026-10-07", session: "PM" }, "4": { date: "2026-10-07", session: "PM" },
      "5": { date: "2026-10-20", session: "PM" }, "6": { date: "2026-10-20", session: "PM" },
    },
    syllabus: { title: "0625 Syllabus 2026–2028", version: "Version 2 · December 2025", officialUrl: "https://www.cambridgeinternational.org/Images/697209-2026-2028-syllabus.pdf", previewUrl: `${LOCAL}/0625-syllabus-2026-2028-v2.pdf` },
    update: { title: "0625 Syllabus Update", version: "Version 2 · December 2025", officialUrl: "https://www.cambridgeinternational.org/Images/748914-2026-2028-syllabus-update.pdf", previewUrl: `${LOCAL}/0625-syllabus-update-v2.pdf` },
    formula: { supplied: false, status: "not-provided", label: "公式表", summary: "不提供独立公式表；考纲要求记忆的方程需要考生掌握，不要求记忆的方程会在相关题目中给出。" },
    referenceMaterials: [
      { id: "0625-formula-policy", type: "formula", title: "Equation recall policy", version: "Current syllabus reference", status: "reference", officialUrl: "https://help.cambridgeinternational.org/hc/en-gb/articles/19811958820114-Will-my-students-be-provided-with-a-formula-sheet-in-the-exam", previewUrl: `${LOCAL}/0625-syllabus-2026-2028-v2.pdf#page=49`, note: "官方 FAQ 与考纲共同说明公式记忆规则。" },
    ],
  }),
  {
    id: "cambridge-0478",
    board: "Cambridge International",
    qualification: "Cambridge IGCSE Computer Science",
    code: "0478",
    region: { label: "中国大陆 · Zone 5", note: "默认按上海对应的 Cambridge Administrative Zone 5 展示；AM / PM 是官方场次标签，不推算当地钟点。" },
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "2 张必考试卷；两张各占资格总分的 50%。",
    nextExam: { date: "2026-10-14", session: "AM", code: "0478/13", title: "Paper 1 · Computer Systems", durationMinutes: 105 },
    components: [
      { code: "0478/13", name: "Paper 1 · Computer Systems", durationMinutes: 105, marks: 75, weighting: "50%", calculator: "not-allowed", assessmentMode: "written" },
      { code: "0478/23", name: "Paper 2 · Algorithms, Programming and Logic", durationMinutes: 105, marks: 75, weighting: "50%", calculator: "not-allowed", assessmentMode: "programming", note: "书面考试；包含 unseen 15-mark scenario question" },
    ],
    routes: [{ id: "all-candidates", level: "IGCSE · grades A*–G", label: "Single route", papers: ["0478/13", "0478/23"], note: "两张均为必考。" }],
    calculator: { status: "none", summary: "两张试卷均禁止使用计算器。", prohibited: ["任何计算器"] },
    formula: { supplied: false, status: "not-applicable", label: "考试参考资料", summary: "不使用预发布材料；Paper 2 已改为考场内首次见到的 15-mark scenario question。" },
    practical: { status: "not-applicable", summary: "没有上机或独立实践考试；算法与编程能力在书面 Paper 2 中考核。", options: [] },
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026",
    upcomingExams: [
      { date: "2026-10-14", session: "AM", code: "0478/13", title: "Paper 1 · Computer Systems", durationMinutes: 105 },
      { date: "2026-10-19", session: "AM", code: "0478/23", title: "Paper 2 · Algorithms, Programming and Logic", durationMinutes: 105 },
    ],
    materials: [
      { id: "0478-timetable", type: "timetable", title: "November 2026 Zone 5 Final Timetable", version: "Version 1 · April 2026", status: "current", officialUrl: CAMBRIDGE_TIMETABLE, previewUrl: `${LOCAL}/november-2026-zone-5-timetable-v1.pdf` },
      { id: "0478-syllabus", type: "syllabus", title: "0478 Syllabus 2026–2028", version: "Version 5 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/697167-2026-2028-syllabus.pdf", previewUrl: `${LOCAL}/0478-syllabus-2026-2028-v5.pdf` },
      { id: "0478-update", type: "update-notice", title: "0478 Syllabus Update", version: "Version 5 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/711263-2026-2028-syllabus-update.pdf", previewUrl: `${LOCAL}/0478-syllabus-update-v5.pdf` },
    ],
    release,
  },
];

export const SCIENCE_EXAM_OVERVIEWS = scienceCourses;
