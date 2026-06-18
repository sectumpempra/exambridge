// CAIE A-Level 考试数据

export interface Paper {
  code: string;        // e.g. "9709/13"
  name: string;        // e.g. "Pure Mathematics 1 (P1)"
  subjectCode: string; // e.g. "9709"
  component: string;   // e.g. "13"
  examDate: string;    // e.g. "2026-04-29"
}

export interface Subject {
  code: string;
  name: string;
  papers: Paper[];
}

// 考试日期（2026年5/6月考季）
const EXAM_DATES_2026: Record<string, string> = {
  // 数学 9709
  "9709/12": "2026-04-29", "9709/13": "2026-04-29",
  "9709/42": "2026-05-06", "9709/43": "2026-05-06",
  "9709/52": "2026-05-12", "9709/53": "2026-05-12",
  "9709/32": "2026-05-15", "9709/33": "2026-05-15",
  // 进阶数学 9231
  "9231/12": "2026-05-07", "9231/13": "2026-05-07",
  "9231/32": "2026-05-21", "9231/33": "2026-05-21",
  "9231/22": "2026-05-25", "9231/23": "2026-05-25",
  "9231/42": "2026-05-29", "9231/43": "2026-05-29",
  // 物理 9702
  "9702/12": "2026-04-28", "9702/13": "2026-04-28",
  "9702/22": "2026-05-08", "9702/23": "2026-05-08",
  "9702/33": "2026-05-14",
  "9702/42": "2026-05-19", "9702/43": "2026-05-19",
  "9702/52": "2026-05-26", "9702/53": "2026-05-26",
  // 化学 9701
  "9701/12": "2026-04-30", "9701/13": "2026-04-30",
  "9701/22": "2026-05-08", "9701/23": "2026-05-08",
  "9701/33": "2026-05-14",
  "9701/42": "2026-05-20", "9701/43": "2026-05-20",
  "9701/52": "2026-05-27", "9701/53": "2026-05-27",
  // 生物 9700
  "9700/12": "2026-05-01", "9700/13": "2026-05-01",
  "9700/22": "2026-05-11", "9700/23": "2026-05-11",
  "9700/33": "2026-05-15",
  "9700/42": "2026-05-21", "9700/43": "2026-05-21",
  "9700/52": "2026-05-28", "9700/53": "2026-05-28",
  // 经济 9708
  "9708/12": "2026-05-04", "9708/13": "2026-05-04",
  "9708/22": "2026-05-13", "9708/23": "2026-05-13",
  "9708/32": "2026-05-18", "9708/33": "2026-05-18",
  // 计算机 9618
  "9618/12": "2026-05-05", "9618/13": "2026-05-05",
  "9618/22": "2026-05-12", "9618/23": "2026-05-12",
  "9618/32": "2026-05-19", "9618/33": "2026-05-19",
};

// 生成历史试卷列表（近10年）
function generatePastPapers(subjectCode: string, component: string, years: number[]): string[] {
  return years.map(y => {
    const series = y >= 2023 ? ["s", "m", "w"] : ["s", "w"];
    return series.map(s => `${subjectCode}_${s}_${y}_${component}`);
  }).flat();
}

const PAST_YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

export const SUBJECTS: Subject[] = [
  {
    code: "9709",
    name: "Mathematics",
    papers: [
      { code: "9709/13", name: "Pure Mathematics 1 (P1)", subjectCode: "9709", component: "13", examDate: EXAM_DATES_2026["9709/13"] },
      { code: "9709/43", name: "Mechanics 1 (M1)", subjectCode: "9709", component: "43", examDate: EXAM_DATES_2026["9709/43"] },
      { code: "9709/53", name: "Probability & Statistics 1 (S1)", subjectCode: "9709", component: "53", examDate: EXAM_DATES_2026["9709/53"] },
      { code: "9709/33", name: "Pure Mathematics 3 (P3)", subjectCode: "9709", component: "33", examDate: EXAM_DATES_2026["9709/33"] },
    ],
  },
  {
    code: "9231",
    name: "Further Mathematics",
    papers: [
      { code: "9231/13", name: "Further Pure Mathematics 1 (FP1)", subjectCode: "9231", component: "13", examDate: EXAM_DATES_2026["9231/13"] },
      { code: "9231/33", name: "Further Mechanics (FM)", subjectCode: "9231", component: "33", examDate: EXAM_DATES_2026["9231/33"] },
      { code: "9231/23", name: "Further Pure Mathematics 2 (FP2)", subjectCode: "9231", component: "23", examDate: EXAM_DATES_2026["9231/23"] },
      { code: "9231/43", name: "Further Statistics (FS)", subjectCode: "9231", component: "43", examDate: EXAM_DATES_2026["9231/43"] },
    ],
  },
  {
    code: "9702",
    name: "Physics",
    papers: [
      { code: "9702/13", name: "Paper 1 (Multiple Choice)", subjectCode: "9702", component: "13", examDate: EXAM_DATES_2026["9702/13"] },
      { code: "9702/23", name: "Paper 2 (AS Structured)", subjectCode: "9702", component: "23", examDate: EXAM_DATES_2026["9702/23"] },
      { code: "9702/33", name: "Paper 3 (Advanced Practical)", subjectCode: "9702", component: "33", examDate: EXAM_DATES_2026["9702/33"] },
      { code: "9702/43", name: "Paper 4 (A2 Structured)", subjectCode: "9702", component: "43", examDate: EXAM_DATES_2026["9702/43"] },
      { code: "9702/53", name: "Paper 5 (Planning & Analysis)", subjectCode: "9702", component: "53", examDate: EXAM_DATES_2026["9702/53"] },
    ],
  },
  {
    code: "9701",
    name: "Chemistry",
    papers: [
      { code: "9701/13", name: "Paper 1 (Multiple Choice)", subjectCode: "9701", component: "13", examDate: EXAM_DATES_2026["9701/13"] },
      { code: "9701/23", name: "Paper 2 (AS Structured)", subjectCode: "9701", component: "23", examDate: EXAM_DATES_2026["9701/23"] },
      { code: "9701/33", name: "Paper 3 (Advanced Practical)", subjectCode: "9701", component: "33", examDate: EXAM_DATES_2026["9701/33"] },
      { code: "9701/43", name: "Paper 4 (A2 Structured)", subjectCode: "9701", component: "43", examDate: EXAM_DATES_2026["9701/43"] },
      { code: "9701/53", name: "Paper 5 (Planning & Analysis)", subjectCode: "9701", component: "53", examDate: EXAM_DATES_2026["9701/53"] },
    ],
  },
  {
    code: "9700",
    name: "Biology",
    papers: [
      { code: "9700/13", name: "Paper 1 (Multiple Choice)", subjectCode: "9700", component: "13", examDate: EXAM_DATES_2026["9700/13"] },
      { code: "9700/23", name: "Paper 2 (AS Structured)", subjectCode: "9700", component: "23", examDate: EXAM_DATES_2026["9700/23"] },
      { code: "9700/33", name: "Paper 3 (Advanced Practical)", subjectCode: "9700", component: "33", examDate: EXAM_DATES_2026["9700/33"] },
      { code: "9700/43", name: "Paper 4 (A2 Structured)", subjectCode: "9700", component: "43", examDate: EXAM_DATES_2026["9700/43"] },
      { code: "9700/53", name: "Paper 5 (Planning & Analysis)", subjectCode: "9700", component: "53", examDate: EXAM_DATES_2026["9700/53"] },
    ],
  },
  {
    code: "9708",
    name: "Economics",
    papers: [
      { code: "9708/13", name: "Paper 1 (Multiple Choice)", subjectCode: "9708", component: "13", examDate: EXAM_DATES_2026["9708/13"] },
      { code: "9708/23", name: "Paper 2 (Data Response & Essays)", subjectCode: "9708", component: "23", examDate: EXAM_DATES_2026["9708/23"] },
      { code: "9708/33", name: "Paper 3 (Multiple Choice A2)", subjectCode: "9708", component: "33", examDate: EXAM_DATES_2026["9708/33"] },
      { code: "9708/43", name: "Paper 4 (Data Response & Essays A2)", subjectCode: "9708", component: "43", examDate: "2026-05-25" },
    ],
  },
  {
    code: "9618",
    name: "Computer Science",
    papers: [
      { code: "9618/13", name: "Paper 1 (Fundamentals)", subjectCode: "9618", component: "13", examDate: EXAM_DATES_2026["9618/13"] },
      { code: "9618/23", name: "Paper 2 (Fundamental Problem Solving)", subjectCode: "9618", component: "23", examDate: EXAM_DATES_2026["9618/23"] },
      { code: "9618/33", name: "Paper 3 (Advanced Problem Solving)", subjectCode: "9618", component: "33", examDate: EXAM_DATES_2026["9618/33"] },
      { code: "9618/43", name: "Paper 4 (Practical)", subjectCode: "9618", component: "43", examDate: "2026-05-26" },
    ],
  },
];

// 获取试卷的所有历史试卷编号
export function getAvailablePapers(paper: Paper): string[] {
  return generatePastPapers(paper.subjectCode, paper.component, PAST_YEARS);
}

// 格式化paper代码用于显示
export function formatPaperCode(code: string): string {
  return code;
}

// 获取考试日期
export function getExamDate(paperCode: string): string | undefined {
  return EXAM_DATES_2026[paperCode];
}

// 计算距离考试还有多少天
export function getDaysUntilExam(examDate: string): number {
  const exam = new Date(examDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = exam.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// 强度配置
export type Intensity = "low" | "normal" | "high";

export const INTENSITY_CONFIG: Record<Intensity, { label: string; papersPerWeek: number; description: string }> = {
  low: { label: "轻松", papersPerWeek: 1, description: "每周每科1套试卷" },
  normal: { label: "标准", papersPerWeek: 2, description: "每周每科2套试卷" },
  high: { label: "密集", papersPerWeek: 3, description: "每周每科3套试卷" },
};
