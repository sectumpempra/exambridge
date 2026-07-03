/**
 * Paper 元数据
 * 定义每份 Paper 的基本信息
 * 考纲知识点（syllabusTopics）由 agent 集群在另一个会话中生成
 */

export interface PaperMetadata {
  paperId: string;        // 唯一标识，如 "CAIE-9709-P1"
  board: string;          // 考试局
  qualification: string;  // 资格类型
  subjectCode: string;    // 科目代码
  subjectName: string;    // 科目名称
  paperNumber: string;    // Paper 编号
  paperName: string;      // Paper 全名
  duration: string;       // 考试时长（如 "1h 50m"）
  durationMinutes: number;
  maxMarks: number;       // 满分
  weightPercent: number;  // 在总成绩中的占比
  gradingSystem: string;  // A*-E / 9-1 / A*-G
  calculatorAllowed: boolean;
  paperType: string;      // Written / Coursework / Practical
  syllabusVersion: string;
  variantCodes: string[]; // 对应的 component/variant codes（用于匹配分数线数据）
  description: string;    // 简要描述
}

// CAIE A-Level Mathematics (9709) - 6 Papers
const CAIE_9709_PAPERS: PaperMetadata[] = [
  {
    paperId: "CAIE-9709-P1",
    board: "CAIE",
    qualification: "A-Level",
    subjectCode: "9709",
    subjectName: "Mathematics",
    paperNumber: "1",
    paperName: "Pure Mathematics 1",
    duration: "1h 50m",
    durationMinutes: 110,
    maxMarks: 75,
    weightPercent: 30,
    gradingSystem: "A*-E",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2020-2025",
    variantCodes: ["11", "12", "13", "15"],
    description: "Quadratics, functions, coordinate geometry, circular measure, trigonometry, series, differentiation, integration. Includes China zone variant (15)."
  },
  {
    paperId: "CAIE-9709-P2",
    board: "CAIE",
    qualification: "A-Level",
    subjectCode: "9709",
    subjectName: "Mathematics",
    paperNumber: "2",
    paperName: "Pure Mathematics 2",
    duration: "1h 15m",
    durationMinutes: 75,
    maxMarks: 50,
    weightPercent: 17.5,
    gradingSystem: "A*-E",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2020-2025",
    variantCodes: ["21", "22", "23", "25"],
    description: "Algebra, logarithmic and exponential functions, trigonometry, differentiation, integration, numerical solutions of equations. (AS only) Includes China zone variant (25)."
  },
  {
    paperId: "CAIE-9709-P3",
    board: "CAIE",
    qualification: "A-Level",
    subjectCode: "9709",
    subjectName: "Mathematics",
    paperNumber: "3",
    paperName: "Pure Mathematics 3",
    duration: "1h 50m",
    durationMinutes: 110,
    maxMarks: 75,
    weightPercent: 30,
    gradingSystem: "A*-E",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2020-2025",
    variantCodes: ["31", "32", "33", "35"],
    description: "Algebra, logarithmic and exponential functions, trigonometry, differentiation, integration, numerical solutions of equations, vectors, differential equations, complex numbers. Includes China zone variant (35)."
  },
  {
    paperId: "CAIE-9709-P4",
    board: "CAIE",
    qualification: "A-Level",
    subjectCode: "9709",
    subjectName: "Mathematics",
    paperNumber: "4",
    paperName: "Mechanics",
    duration: "1h 15m",
    durationMinutes: 75,
    maxMarks: 50,
    weightPercent: 17.5,
    gradingSystem: "A*-E",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2020-2025",
    variantCodes: ["41", "42", "43", "45"],
    description: "Forces and equilibrium, kinematics of motion in a straight line, momentum, Newton's laws of motion, energy, work and power. Includes China zone variant (45)."
  },
  {
    paperId: "CAIE-9709-P5",
    board: "CAIE",
    qualification: "A-Level",
    subjectCode: "9709",
    subjectName: "Mathematics",
    paperNumber: "5",
    paperName: "Probability & Statistics 1",
    duration: "1h 15m",
    durationMinutes: 75,
    maxMarks: 50,
    weightPercent: 17.5,
    gradingSystem: "A*-E",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2020-2025",
    variantCodes: ["51", "52", "53", "55"],
    description: "Representation of data, permutations and combinations, probability, discrete random variables, the normal distribution. Includes China zone variant (55)."
  },
  {
    paperId: "CAIE-9709-P6",
    board: "CAIE",
    qualification: "A-Level",
    subjectCode: "9709",
    subjectName: "Mathematics",
    paperNumber: "6",
    paperName: "Probability & Statistics 2",
    duration: "1h 15m",
    durationMinutes: 75,
    maxMarks: 50,
    weightPercent: 17.5,
    gradingSystem: "A*-E",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2020-2025",
    variantCodes: ["61", "62", "63", "65"],
    description: "The Poisson distribution, linear combinations of random variables, continuous random variables, sampling and estimation, hypothesis tests. Includes China zone variant (65)."
  },
];

// CAIE IGCSE Mathematics (0580) - 2 Papers (Extended)
const CAIE_0580_PAPERS: PaperMetadata[] = [
  {
    paperId: "CAIE-0580-P2",
    board: "CAIE",
    qualification: "IGCSE",
    subjectCode: "0580",
    subjectName: "Mathematics",
    paperNumber: "2",
    paperName: "Mathematics (Extended) Paper 2",
    duration: "1h 30m",
    durationMinutes: 90,
    maxMarks: 70,
    weightPercent: 35,
    gradingSystem: "A*-E",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2020-2025",
    variantCodes: ["21", "22"],
    description: "Short-answer questions. Number, algebra, shape and space, statistics and probability. Covers Extended syllabus.",
  },
  {
    paperId: "CAIE-0580-P4",
    board: "CAIE",
    qualification: "IGCSE",
    subjectCode: "0580",
    subjectName: "Mathematics",
    paperNumber: "4",
    paperName: "Mathematics (Extended) Paper 4",
    duration: "2h 30m",
    durationMinutes: 150,
    maxMarks: 130,
    weightPercent: 65,
    gradingSystem: "A*-E",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2020-2025",
    variantCodes: ["41", "42"],
    description: "Structured questions. Number, algebra, shape and space, statistics and probability. Covers Extended syllabus with more in-depth problem solving.",
  },
];

// Edexcel IGCSE Mathematics A (4MA1) - 2 Papers (Higher)
const EDEXCEL_4MA1_PAPERS: PaperMetadata[] = [
  {
    paperId: "EDX-4MA1-P1H",
    board: "Edexcel",
    qualification: "IGCSE",
    subjectCode: "4MA1",
    subjectName: "Mathematics A",
    paperNumber: "1H",
    paperName: "Mathematics A Paper 1H (Higher)",
    duration: "2h",
    durationMinutes: 120,
    maxMarks: 100,
    weightPercent: 50,
    gradingSystem: "9-1",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2017-2025",
    variantCodes: ["1H"],
    description: "Number, algebra, geometry, statistics. Higher tier covers grades 4-9. Calculator allowed throughout.",
  },
  {
    paperId: "EDX-4MA1-P2H",
    board: "Edexcel",
    qualification: "IGCSE",
    subjectCode: "4MA1",
    subjectName: "Mathematics A",
    paperNumber: "2H",
    paperName: "Mathematics A Paper 2H (Higher)",
    duration: "2h",
    durationMinutes: 120,
    maxMarks: 100,
    weightPercent: 50,
    gradingSystem: "9-1",
    calculatorAllowed: true,
    paperType: "Written",
    syllabusVersion: "2017-2025",
    variantCodes: ["2H"],
    description: "Number, algebra, geometry, statistics. Higher tier covers grades 4-9. Calculator allowed throughout. Focuses on problem-solving and reasoning.",
  },
];

// 所有 Paper 汇总
export const ALL_PAPERS: PaperMetadata[] = [
  ...CAIE_9709_PAPERS,
  ...CAIE_0580_PAPERS,
  ...EDEXCEL_4MA1_PAPERS,
];

// 按科目分组索引
export interface PaperGroup {
  board: string;
  qualification: string;
  subjectCode: string;
  subjectName: string;
  papers: PaperMetadata[];
}

export const PAPER_GROUPS: PaperGroup[] = (() => {
  const map = new Map<string, PaperGroup>();
  for (const p of ALL_PAPERS) {
    const key = `${p.board}-${p.qualification}-${p.subjectCode}`;
    if (!map.has(key)) {
      map.set(key, {
        board: p.board,
        qualification: p.qualification,
        subjectCode: p.subjectCode,
        subjectName: p.subjectName,
        papers: [],
      });
    }
    map.get(key)!.papers.push(p);
  }
  return Array.from(map.values());
})();

// 快速查找
export function getPaperById(paperId: string): PaperMetadata | undefined {
  return ALL_PAPERS.find((p) => p.paperId === paperId);
}

export function getPapersBySubject(board: string, qualification: string, subjectCode: string): PaperMetadata[] {
  return ALL_PAPERS.filter(
    (p) => p.board === board && p.qualification === qualification && p.subjectCode === subjectCode
  );
}
