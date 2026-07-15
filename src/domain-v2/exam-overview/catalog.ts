import type { CourseContextEntry } from "@/course-context/types";
import { ExamOverviewSchema, type ExamOverview } from "./schema";
import { EXPANSION_EXAM_OVERVIEWS } from "./expansion-catalog";
import { SCIENCE_EXAM_OVERVIEWS } from "./science-catalog";
import { CAMBRIDGE_ADVANCED_SCIENCE_EXAM_OVERVIEWS } from "./cambridge-advanced-science-catalog";
import { PEARSON_SCIENCE_EXAM_OVERVIEWS } from "./pearson-science-catalog";
import { AQA_UK_MATHS_EXAM_OVERVIEWS } from "./aqa-uk-maths-catalog";
import { PEARSON_UK_MATHS_EXAM_OVERVIEWS } from "./pearson-uk-maths-catalog";
import { OCR_UK_MATHS_EXAM_OVERVIEWS } from "./ocr-uk-maths-catalog";
import { CAMBRIDGE_BUSINESS_EXAM_OVERVIEWS } from "./cambridge-business-catalog";
import { PEARSON_IGCSE_BUSINESS_EXAM_OVERVIEWS } from "./pearson-igcse-business-catalog";
import { PEARSON_IAL_BUSINESS_EXAM_OVERVIEWS } from "./pearson-ial-business-catalog";

const CAMBRIDGE_TIMETABLE = "https://www.cambridgeinternational.org/Images/757650-november-2026-zone-5-timetable.pdf";
const PEARSON_4MA1_SPEC = "https://qualifications.pearson.com/content/dam/pdf/International%20GCSE/Mathematics%20A/2016/Specification%20and%20sample%20assessments/international-gcse-in-mathematics-spec-a.pdf";
const PEARSON_4MA1_TIMETABLE = "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-Edexcel-International-GCSE/intgcse-nov-2026-final.pdf";
const PEARSON_IAL_SPEC = "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Mathematics/2018/Specification-and-Sample-Assessment/international-a-level-maths-spec.pdf";
const PEARSON_IAL_FORMULAE = "https://qualifications.pearson.com/content/dam/pdf/International%20Advanced%20Level/Mathematics/2018/Specification-and-Sample-Assessment/IAL-Mathematics-Formula-Book.pdf";
const PEARSON_IAL_TIMETABLE = "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-International-Advanced-Levels/ial-october2026-final.pdf";
const PEARSON_IAL_JANUARY_TIMETABLE = "https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-International-Advanced-Levels/ial-january-2027-final.pdf";
const LOCAL_MATERIALS = "/exam-materials";

const release = {
  status: "approved" as const,
  approvedAt: "2026-07-15",
  verifiedAt: "2026-07-15",
  schedule: { normal: "每周检查考试时间表", nearExam: "距考试 60 天内每日检查", materials: "每月检查考纲与公式表" },
};

const rawCatalog = [
  ...EXPANSION_EXAM_OVERVIEWS,
  ...SCIENCE_EXAM_OVERVIEWS,
  ...CAMBRIDGE_ADVANCED_SCIENCE_EXAM_OVERVIEWS,
  ...PEARSON_SCIENCE_EXAM_OVERVIEWS,
  ...AQA_UK_MATHS_EXAM_OVERVIEWS,
  ...PEARSON_UK_MATHS_EXAM_OVERVIEWS,
  ...OCR_UK_MATHS_EXAM_OVERVIEWS,
  ...CAMBRIDGE_BUSINESS_EXAM_OVERVIEWS,
  ...PEARSON_IGCSE_BUSINESS_EXAM_OVERVIEWS,
  ...PEARSON_IAL_BUSINESS_EXAM_OVERVIEWS,
  {
    id: "cambridge-9709",
    board: "Cambridge International",
    qualification: "Cambridge International AS & A Level Mathematics",
    code: "9709",
    region: { label: "中国大陆 · Zone 5", note: "默认按上海对应的 Cambridge Administrative Zone 5 展示。" },
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "共 6 种组件；AS Level 选择 2 张，A Level 共 4 张。",
    nextExam: { date: "2026-10-13", session: "AM", code: "9709/13", title: "Pure Mathematics 1", durationMinutes: 110, group: "AS" },
    components: [
      { code: "Paper 1", name: "Pure Mathematics 1", durationMinutes: 110, marks: 75, weighting: "AS 60% / A Level 30%", calculator: "allowed" },
      { code: "Paper 2", name: "Pure Mathematics 2", durationMinutes: 75, marks: 50, weighting: "AS 40%", calculator: "allowed", note: "仅 AS Level" },
      { code: "Paper 3", name: "Pure Mathematics 3", durationMinutes: 110, marks: 75, weighting: "A Level 30%", calculator: "allowed", note: "仅 A Level" },
      { code: "Paper 4", name: "Mechanics", durationMinutes: 75, marks: 50, weighting: "AS 40% / A Level 20%", calculator: "allowed" },
      { code: "Paper 5", name: "Probability & Statistics 1", durationMinutes: 75, marks: 50, weighting: "AS 40% / A Level 20%", calculator: "allowed" },
      { code: "Paper 6", name: "Probability & Statistics 2", durationMinutes: 75, marks: 50, weighting: "A Level 20%", calculator: "allowed", note: "仅 A Level" },
    ],
    routes: [
      { id: "as-pure", level: "AS Level", label: "Pure Mathematics only", papers: ["P1", "P2"], note: "不能衔接到完整 A Level" },
      { id: "as-mechanics", level: "AS Level", label: "Pure Mathematics + Mechanics", papers: ["P1", "P4"] },
      { id: "as-statistics", level: "AS Level", label: "Pure Mathematics + Statistics", papers: ["P1", "P5"] },
      { id: "al-mechanics", level: "A Level", label: "Pure + Mechanics + Statistics", papers: ["P1", "P3", "P4", "P5"] },
      { id: "al-statistics", level: "A Level", label: "Pure + Statistics", papers: ["P1", "P3", "P5", "P6"] },
      { id: "al-staged-m", level: "A Level · staged", label: "AS Mechanics route → P3 + S1", papers: ["P1", "P4", "P3", "P5"] },
      { id: "al-staged-sm", level: "A Level · staged", label: "AS Statistics route → P3 + Mechanics", papers: ["P1", "P5", "P3", "P4"] },
      { id: "al-staged-ss", level: "A Level · staged", label: "AS Statistics route → P3 + S2", papers: ["P1", "P5", "P3", "P6"] },
    ],
    calculator: { status: "all", summary: "全部组件允许使用标准科学计算器；答案必须写出必要过程。", prohibited: ["图形计算器", "符号代数运算", "符号微分或积分"] },
    formula: { supplied: true, summary: "考试提供 MF19 公式与统计表；该文件同时包含 9231 部分内容。" },
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026",
    upcomingExams: [
      { date: "2026-10-13", session: "AM", code: "9709/13", title: "Pure Mathematics 1", durationMinutes: 110, group: "AS" },
      { date: "2026-10-15", session: "AM", code: "9709/53", title: "Probability & Statistics 1", durationMinutes: 75, group: "AS" },
      { date: "2026-10-19", session: "AM", code: "9709/23", title: "Pure Mathematics 2", durationMinutes: 75, group: "AS" },
      { date: "2026-10-19", session: "AM", code: "9709/43", title: "Mechanics", durationMinutes: 75, group: "AS" },
      { date: "2026-10-19", session: "AM", code: "9709/63", title: "Probability & Statistics 2", durationMinutes: 75, group: "AL" },
      { date: "2026-10-21", session: "AM", code: "9709/33", title: "Pure Mathematics 3", durationMinutes: 110, group: "AL" },
    ],
    materials: [
      { id: "9709-timetable", type: "timetable", title: "November 2026 Zone 5 Final Timetable", version: "Version 1 · April 2026", status: "current", officialUrl: CAMBRIDGE_TIMETABLE, previewUrl: `${LOCAL_MATERIALS}/november-2026-zone-5-timetable-v1.pdf` },
      { id: "9709-syllabus", type: "syllabus", title: "9709 Syllabus 2026–2027", version: "Version 4 · December 2025", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf", previewUrl: `${LOCAL_MATERIALS}/9709-syllabus-2026-2027-v4.pdf` },
      { id: "9709-future", type: "syllabus", title: "9709 Syllabus 2028–2030", version: "Version 1 · September 2025", status: "future", officialUrl: "https://www.cambridgeinternational.org/Images/744634-2028-2030-syllabus.pdf", previewUrl: `${LOCAL_MATERIALS}/9709-syllabus-2028-2030-v1.pdf`, note: "官方说明：无影响教学的重大变化。" },
      { id: "9709-mf19", type: "formula", title: "MF19 公式与统计表", version: "Syllabus section 5 · pages 43–55", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf#page=43", previewUrl: `${LOCAL_MATERIALS}/9709-syllabus-2026-2027-v4.pdf#page=43`, note: "直接预览官方页面，不重新录入公式。" },
    ],
    release,
  },
  {
    id: "cambridge-0580",
    board: "Cambridge International",
    qualification: "Cambridge IGCSE Mathematics",
    code: "0580",
    region: { label: "中国大陆 · Zone 5", note: "默认按上海对应的 Cambridge Administrative Zone 5 展示。" },
    examSeries: [{ name: "June" }, { name: "November" }, { name: "March", note: "仅印度" }],
    paperCount: "共 4 种试卷；Core 考 Paper 1 + 3，Extended 考 Paper 2 + 4。",
    nextExam: { date: "2026-10-08", session: "PM", code: "0580/12 · 0580/22", title: "Core Paper 1 / Extended Paper 2", durationMinutes: 90 },
    components: [
      { code: "Paper 1", name: "Non-calculator", group: "Core", durationMinutes: 90, marks: 80, weighting: "50%", calculator: "not-allowed" },
      { code: "Paper 2", name: "Non-calculator", group: "Extended", durationMinutes: 120, marks: 100, weighting: "50%", calculator: "not-allowed" },
      { code: "Paper 3", name: "Calculator", group: "Core", durationMinutes: 90, marks: 80, weighting: "50%", calculator: "required" },
      { code: "Paper 4", name: "Calculator", group: "Extended", durationMinutes: 120, marks: 100, weighting: "50%", calculator: "required" },
    ],
    routes: [
      { id: "core", level: "Core · grades C–G", label: "Core route", papers: ["Paper 1", "Paper 3"] },
      { id: "extended", level: "Extended · grades A*–E", label: "Extended route", papers: ["Paper 2", "Paper 4"] },
    ],
    calculator: { status: "mixed", summary: "Paper 1、2 禁止计算器；Paper 3、4 必须使用科学计算器。", prohibited: ["代数计算器", "图形计算器"] },
    formula: { supplied: true, summary: "公式表印在每张试卷第 2 页；并非所有需要的公式都会提供。" },
    upcomingSeries: "November 2026 · Zone 5",
    timetableStatus: "Final · Version 1 · April 2026",
    upcomingExams: [
      { date: "2026-10-08", session: "PM", code: "0580/12", title: "Paper 1 · Non-calculator", durationMinutes: 90, group: "Core" },
      { date: "2026-10-08", session: "PM", code: "0580/22", title: "Paper 2 · Non-calculator", durationMinutes: 120, group: "Extended" },
      { date: "2026-10-14", session: "PM", code: "0580/32", title: "Paper 3 · Calculator", durationMinutes: 90, group: "Core" },
      { date: "2026-10-14", session: "PM", code: "0580/42", title: "Paper 4 · Calculator", durationMinutes: 120, group: "Extended" },
    ],
    materials: [
      { id: "0580-timetable", type: "timetable", title: "November 2026 Zone 5 Final Timetable", version: "Version 1 · April 2026", status: "current", officialUrl: CAMBRIDGE_TIMETABLE, previewUrl: `${LOCAL_MATERIALS}/november-2026-zone-5-timetable-v1.pdf` },
      { id: "0580-syllabus", type: "syllabus", title: "0580 Syllabus 2025–2027", version: "Version 3 · May 2024", status: "current", officialUrl: "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf", previewUrl: `${LOCAL_MATERIALS}/0580-syllabus-2025-2027-v3.pdf` },
      { id: "0580-future", type: "syllabus", title: "0580 Syllabus 2028–2030", version: "Version 1 · September 2025", status: "future", officialUrl: "https://www.cambridgeinternational.org/Images/745681-2028-2030-syllabus.pdf", previewUrl: `${LOCAL_MATERIALS}/0580-syllabus-2028-2030-v1.pdf` },
      { id: "0580-formula-core", type: "formula", title: "Core 公式表", version: "Syllabus page 60", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf#page=60", previewUrl: `${LOCAL_MATERIALS}/0580-syllabus-2025-2027-v3.pdf#page=60` },
      { id: "0580-formula-extended", type: "formula", title: "Extended 公式表", version: "Syllabus page 61", status: "reference", officialUrl: "https://www.cambridgeinternational.org/Images/662466-2025-2027-syllabus.pdf#page=61", previewUrl: `${LOCAL_MATERIALS}/0580-syllabus-2025-2027-v3.pdf#page=61` },
    ],
    release,
  },
  {
    id: "pearson-4ma1",
    board: "Pearson Edexcel",
    qualification: "International GCSE Mathematics A (Linear)",
    code: "4MA1",
    region: { label: "中国大陆", note: "November 使用标准试卷；Summer 中国大陆使用 R variant。时间仅展示官方 Morning / Afternoon，不推算当地钟点。" },
    examSeries: [{ name: "November", note: "无 R variant" }, { name: "Summer (May/June)", note: "中国大陆使用 R variant" }],
    paperCount: "共 4 种 tier 试卷；考生在同一考季完成同一 tier 的两张试卷。",
    nextExam: { date: "2026-11-04", session: "Morning", code: "4MA1 1F · 4MA1 1H", title: "Paper 1 Foundation / Higher", durationMinutes: 120 },
    components: [
      { code: "4MA1/1F", name: "Paper 1F", group: "Foundation", durationMinutes: 120, marks: 100, weighting: "50%", calculator: "required" },
      { code: "4MA1/2F", name: "Paper 2F", group: "Foundation", durationMinutes: 120, marks: 100, weighting: "50%", calculator: "required" },
      { code: "4MA1/1H", name: "Paper 1H", group: "Higher", durationMinutes: 120, marks: 100, weighting: "50%", calculator: "required" },
      { code: "4MA1/2H", name: "Paper 2H", group: "Higher", durationMinutes: 120, marks: 100, weighting: "50%", calculator: "required" },
    ],
    routes: [
      { id: "foundation", level: "Foundation · grades 5–1", label: "Foundation route", papers: ["1F", "2F"], note: "两张必须在同一考季完成" },
      { id: "higher", level: "Higher · grades 9–4（允许 3）", label: "Higher route", papers: ["1H", "2H"], note: "两张必须在同一考季完成" },
    ],
    calculator: { status: "all", summary: "全部试卷都需要合适的电子计算器。", prohibited: ["资料库或文字/公式检索", "QWERTY 键盘", "符号代数、微分或积分"] },
    formula: { supplied: true, summary: "Foundation 与 Higher 各有官方公式表，随书面考试提供。" },
    upcomingSeries: "November 2026",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-11-04", session: "Morning", code: "4MA1 1F", title: "Paper 1F", durationMinutes: 120, group: "Foundation" },
      { date: "2026-11-04", session: "Morning", code: "4MA1 1H", title: "Paper 1H", durationMinutes: 120, group: "Higher" },
      { date: "2026-11-06", session: "Morning", code: "4MA1 2F", title: "Paper 2F", durationMinutes: 120, group: "Foundation" },
      { date: "2026-11-06", session: "Morning", code: "4MA1 2H", title: "Paper 2H", durationMinutes: 120, group: "Higher" },
    ],
    materials: [
      { id: "4ma1-timetable", type: "timetable", title: "International GCSE November 2026 Timetable", version: "Final", status: "current", officialUrl: PEARSON_4MA1_TIMETABLE, previewUrl: `${LOCAL_MATERIALS}/pearson-intgcse-november-2026-final.pdf` },
      { id: "4ma1-spec", type: "syllabus", title: "International GCSE Mathematics A Specification", version: "Issue 2", status: "current", officialUrl: PEARSON_4MA1_SPEC, previewUrl: `${LOCAL_MATERIALS}/4ma1-specification-issue2.pdf` },
      { id: "4ma1-formula-f", type: "formula", title: "Foundation 公式表", version: "Specification page 63", status: "reference", officialUrl: `${PEARSON_4MA1_SPEC}#page=63`, previewUrl: `${LOCAL_MATERIALS}/4ma1-specification-issue2.pdf#page=63` },
      { id: "4ma1-formula-h", type: "formula", title: "Higher 公式表", version: "Specification page 65", status: "reference", officialUrl: `${PEARSON_4MA1_SPEC}#page=65`, previewUrl: `${LOCAL_MATERIALS}/4ma1-specification-issue2.pdf#page=65` },
    ],
    release,
  },
  {
    id: "pearson-ial-mathematics",
    board: "Pearson Edexcel",
    qualification: "International Advanced Level Mathematics",
    code: "YMA01 / XMA01",
    region: { label: "中国大陆", note: "Pearson 不按中国大陆区分试卷；仅展示官方 Morning / Afternoon，不推算当地钟点。" },
    examSeries: [{ name: "January" }, { name: "Summer (May/June)" }, { name: "October", note: "D1 不开考" }],
    paperCount: "IAL 由 6 个外部考试单元组成；IAS 由 3 个单元组成，均可跨考季保留成绩。",
    nextExam: { date: "2026-10-09", session: "Morning", code: "WMA11 01", title: "Pure Mathematics 1", durationMinutes: 90, group: "P1" },
    components: [
      { code: "WMA11/01", name: "Pure Mathematics 1", group: "P1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WMA12/01", name: "Pure Mathematics 2", group: "P2", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WMA13/01", name: "Pure Mathematics 3", group: "P3", durationMinutes: 90, marks: 75, weighting: "IAL 16⅔%", calculator: "allowed" },
      { code: "WMA14/01", name: "Pure Mathematics 4", group: "P4", durationMinutes: 90, marks: 75, weighting: "IAL 16⅔%", calculator: "allowed" },
      { code: "WME01/01", name: "Mechanics 1", group: "M1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WME02/01", name: "Mechanics 2", group: "M2", durationMinutes: 90, marks: 75, weighting: "IAL 16⅔%", calculator: "allowed" },
      { code: "WST01/01", name: "Statistics 1", group: "S1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WST02/01", name: "Statistics 2", group: "S2", durationMinutes: 90, marks: 75, weighting: "IAL 16⅔%", calculator: "allowed" },
      { code: "WDM11/01", name: "Decision Mathematics 1", group: "D1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed", note: "October 不开考" },
    ],
    routes: [
      { id: "ial-ms", level: "IAL", label: "M1 + S1", papers: ["P1", "P2", "P3", "P4", "M1", "S1"] },
      { id: "ial-md", level: "IAL", label: "M1 + D1", papers: ["P1", "P2", "P3", "P4", "M1", "D1"] },
      { id: "ial-mm", level: "IAL", label: "M1 + M2", papers: ["P1", "P2", "P3", "P4", "M1", "M2"] },
      { id: "ial-sd", level: "IAL", label: "S1 + D1", papers: ["P1", "P2", "P3", "P4", "S1", "D1"] },
      { id: "ial-ss", level: "IAL", label: "S1 + S2", papers: ["P1", "P2", "P3", "P4", "S1", "S2"] },
    ],
    qualificationViews: [
      { key: "ial", label: "IAL", paperCount: "6 个单元：P1–P4 + 1 组可选单元组合", componentGroups: ["P1", "P2", "P3", "P4", "M1", "M2", "S1", "S2", "D1"], routes: [
        { id: "ial-ms", level: "IAL", label: "M1 + S1", papers: ["P1", "P2", "P3", "P4", "M1", "S1"] },
        { id: "ial-md", level: "IAL", label: "M1 + D1", papers: ["P1", "P2", "P3", "P4", "M1", "D1"] },
        { id: "ial-mm", level: "IAL", label: "M1 + M2", papers: ["P1", "P2", "P3", "P4", "M1", "M2"] },
        { id: "ial-sd", level: "IAL", label: "S1 + D1", papers: ["P1", "P2", "P3", "P4", "S1", "D1"] },
        { id: "ial-ss", level: "IAL", label: "S1 + S2", papers: ["P1", "P2", "P3", "P4", "S1", "S2"] },
      ] },
      { key: "ias", label: "IAS", paperCount: "3 个单元：P1 + P2 + M1 / S1 / D1", componentGroups: ["P1", "P2", "M1", "S1", "D1"], routes: [
        { id: "ias-m", level: "IAS", label: "Mechanics route", papers: ["P1", "P2", "M1"] },
        { id: "ias-s", level: "IAS", label: "Statistics route", papers: ["P1", "P2", "S1"] },
        { id: "ias-d", level: "IAS", label: "Decision route", papers: ["P1", "P2", "D1"] },
      ] },
    ],
    calculator: { status: "all", summary: "全部 YMA01 / XMA01 单元都允许计算器。", prohibited: ["符号代数、微分或积分", "与其他设备或互联网通信", "储存或检索文字、资料库或公式"] },
    formula: { supplied: true, summary: "全部 YMA01 / XMA01 单元提供 Mathematical Formulae and Statistical Tables。" },
    upcomingSeries: "October 2026",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-10-09", session: "Morning", code: "WMA11 01", title: "Pure Mathematics 1", durationMinutes: 90, group: "P1" },
      { date: "2026-10-13", session: "Afternoon", code: "WME01 01", title: "Mechanics M1", durationMinutes: 90, group: "M1" },
      { date: "2026-10-15", session: "Morning", code: "WMA12 01", title: "Pure Mathematics 2", durationMinutes: 90, group: "P2" },
      { date: "2026-10-19", session: "Morning", code: "WST01 01", title: "Statistics S1", durationMinutes: 90, group: "S1" },
      { date: "2026-10-21", session: "Afternoon", code: "WMA13 01", title: "Pure Mathematics 3", durationMinutes: 90, group: "P3" },
      { date: "2026-10-22", session: "Morning", code: "WME02 01", title: "Mechanics M2", durationMinutes: 90, group: "M2" },
      { date: "2026-10-26", session: "Morning", code: "WST02 01", title: "Statistics S2", durationMinutes: 90, group: "S2" },
      { date: "2026-10-28", session: "Afternoon", code: "WMA14 01", title: "Pure Mathematics 4", durationMinutes: 90, group: "P4" },
    ],
    materials: [
      { id: "ial-timetable", type: "timetable", title: "IAL October 2026 Timetable", version: "Final", status: "current", officialUrl: PEARSON_IAL_TIMETABLE, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-october-2026-final.pdf` },
      { id: "ial-spec", type: "syllabus", title: "IAL Mathematics Specification", version: "Issue 3 · April 2019", status: "current", officialUrl: PEARSON_IAL_SPEC, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-maths-spec-issue3.pdf`, note: "本页仅使用 YMA01 / XMA01 范围。" },
      { id: "ial-formula", type: "formula", title: "Mathematical Formulae and Statistical Tables", version: "Issue 2 · 2021", status: "reference", officialUrl: PEARSON_IAL_FORMULAE, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-maths-formula-book-issue2.pdf`, note: "直接预览 Pearson 官方 PDF。" },
    ],
    release,
  },
  {
    id: "pearson-ial-further-mathematics",
    board: "Pearson Edexcel",
    qualification: "International Advanced Level Further Mathematics",
    code: "YFM01 / XFM01",
    region: { label: "中国大陆", note: "Pearson 不按中国大陆区分试卷；仅展示官方 Morning / Afternoon，不推算当地钟点。FP1–FP3 不在 October 考季开考；同时申请 IAL Mathematics 与 Further Mathematics 时，同一单元成绩不能重复用于两个资格。" },
    examSeries: [{ name: "January" }, { name: "Summer (May/June)" }, { name: "October", note: "仅部分应用单元；FP1–FP3 不开考" }],
    paperCount: "IAL 由 6 个外部考试单元组成；IAS 由 3 个单元组成，均可跨考季保留成绩。",
    nextExam: { date: "2026-10-13", session: "Afternoon", code: "WME01 01", title: "Mechanics M1 · 可选应用单元", durationMinutes: 90, group: "M1" },
    components: [
      { code: "WFM01/01", name: "Further Pure Mathematics 1", group: "FP1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WFM02/01", name: "Further Pure Mathematics 2", group: "FP2", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WFM03/01", name: "Further Pure Mathematics 3", group: "FP3", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WME01/01", name: "Mechanics 1", group: "M1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WME02/01", name: "Mechanics 2", group: "M2", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WME03/01", name: "Mechanics 3", group: "M3", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WST01/01", name: "Statistics 1", group: "S1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WST02/01", name: "Statistics 2", group: "S2", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WST03/01", name: "Statistics 3", group: "S3", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WDM11/01", name: "Decision Mathematics 1", group: "D1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
    ],
    routes: [
      { id: "ial-fp2-branch", level: "IAL", label: "FP2 compulsory branch", papers: ["FP1", "FP2", "再选 4 个不同单元"], note: "其余单元从 FP3、M1–M3、S1–S3、D1 中选择；完整资格共 6 个不同单元。" },
      { id: "ial-fp3-branch", level: "IAL", label: "FP3 compulsory branch", papers: ["FP1", "FP3", "再选 4 个不同单元"], note: "其余单元从 FP2、M1–M3、S1–S3、D1 中选择；完整资格共 6 个不同单元。" },
    ],
    qualificationViews: [
      { key: "ial", label: "IAL", paperCount: "6 个单元：FP1 + FP2 / FP3 至少一个 + 其余可选单元", routes: [
        { id: "ial-fp2-branch", level: "IAL", label: "FP2 compulsory branch", papers: ["FP1", "FP2", "再选 4 个不同单元"], note: "其余单元从 FP3、M1–M3、S1–S3、D1 中选择。" },
        { id: "ial-fp3-branch", level: "IAL", label: "FP3 compulsory branch", papers: ["FP1", "FP3", "再选 4 个不同单元"], note: "其余单元从 FP2、M1–M3、S1–S3、D1 中选择。" },
      ] },
      { key: "ias", label: "IAS", paperCount: "3 个单元：FP1 + 任意 2 个可选单元", routes: [
        { id: "ias-further", level: "IAS", label: "Further Mathematics IAS rule", papers: ["FP1", "任选 2 个不同单元"], note: "从 FP2、FP3、M1–M3、S1–S3、D1 中任选两个。" },
      ] },
    ],
    calculator: { status: "all", summary: "全部 YFM01 / XFM01 可用单元都允许计算器。", prohibited: ["符号代数、微分或积分", "与其他设备或互联网通信", "储存或检索文字、资料库或公式"] },
    formula: { supplied: true, summary: "全部相关单元均提供 Mathematical Formulae and Statistical Tables；仍有部分公式要求考生记忆。" },
    upcomingSeries: "October 2026 + January 2027",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-10-13", session: "Afternoon", code: "WME01 01", title: "Mechanics M1", durationMinutes: 90, group: "M1" },
      { date: "2026-10-19", session: "Morning", code: "WST01 01", title: "Statistics S1", durationMinutes: 90, group: "S1" },
      { date: "2026-10-22", session: "Morning", code: "WME02 01", title: "Mechanics M2", durationMinutes: 90, group: "M2" },
      { date: "2026-10-26", session: "Morning", code: "WST02 01", title: "Statistics S2", durationMinutes: 90, group: "S2" },
      { date: "2027-01-14", session: "Afternoon", code: "WFM01 01", title: "Further Pure Mathematics 1", durationMinutes: 90, group: "FP1" },
      { date: "2027-01-20", session: "Morning", code: "WFM02 01", title: "Further Pure Mathematics 2", durationMinutes: 90, group: "FP2" },
      { date: "2027-01-21", session: "Afternoon", code: "WFM03 01", title: "Further Pure Mathematics 3", durationMinutes: 90, group: "FP3" },
    ],
    materials: [
      { id: "ial-further-october-timetable", type: "timetable", title: "IAL October 2026 Timetable", version: "Final", status: "current", officialUrl: PEARSON_IAL_TIMETABLE, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-october-2026-final.pdf`, note: "仅列出该考季开放的应用单元；FP1–FP3 不在 October 开考。" },
      { id: "ial-further-january-timetable", type: "timetable", title: "IAL January 2027 Timetable", version: "Final", status: "current", officialUrl: PEARSON_IAL_JANUARY_TIMETABLE, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-january-2027-final.pdf` },
      { id: "ial-further-spec", type: "syllabus", title: "IAL Mathematics / Further Mathematics / Pure Mathematics Specification", version: "Issue 3 · April 2019", status: "current", officialUrl: PEARSON_IAL_SPEC, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-maths-spec-issue3.pdf`, note: "本页使用 YFM01 / XFM01 范围。" },
      { id: "ial-further-formula", type: "formula", title: "Mathematical Formulae and Statistical Tables", version: "Issue 2 · 2021", status: "reference", officialUrl: PEARSON_IAL_FORMULAE, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-maths-formula-book-issue2.pdf` },
    ],
    release,
  },
  {
    id: "pearson-ial-pure-mathematics",
    board: "Pearson Edexcel",
    qualification: "International Advanced Level Pure Mathematics",
    code: "YPM01 / XPM01",
    region: { label: "中国大陆", note: "Pearson 不按中国大陆区分试卷；仅展示官方 Morning / Afternoon，不推算当地钟点。P1–P4 可在 October 开考，FP1–FP3 仅在 January 和 Summer 开考。" },
    examSeries: [{ name: "January" }, { name: "Summer (May/June)" }, { name: "October", note: "只开考 P1–P4，不开考 FP1–FP3" }],
    paperCount: "IAL 由 6 个外部考试单元组成；IAS 由 3 个单元组成，均可跨考季保留成绩。",
    nextExam: { date: "2026-10-09", session: "Morning", code: "WMA11 01", title: "Pure Mathematics 1", durationMinutes: 90, group: "P1" },
    components: [
      { code: "WMA11/01", name: "Pure Mathematics 1", group: "P1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WMA12/01", name: "Pure Mathematics 2", group: "P2", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WMA13/01", name: "Pure Mathematics 3", group: "P3", durationMinutes: 90, marks: 75, weighting: "IAL 16⅔%", calculator: "allowed" },
      { code: "WMA14/01", name: "Pure Mathematics 4", group: "P4", durationMinutes: 90, marks: 75, weighting: "IAL 16⅔%", calculator: "allowed" },
      { code: "WFM01/01", name: "Further Pure Mathematics 1", group: "FP1", durationMinutes: 90, marks: 75, weighting: "IAS 33⅓% / IAL 16⅔%", calculator: "allowed" },
      { code: "WFM02/01", name: "Further Pure Mathematics 2", group: "FP2", durationMinutes: 90, marks: 75, weighting: "IAL 16⅔%", calculator: "allowed" },
      { code: "WFM03/01", name: "Further Pure Mathematics 3", group: "FP3", durationMinutes: 90, marks: 75, weighting: "IAL 16⅔%", calculator: "allowed" },
    ],
    routes: [
      { id: "ial-pure-fp2", level: "IAL", label: "FP2 route", papers: ["P1", "P2", "P3", "P4", "FP1", "FP2"] },
      { id: "ial-pure-fp3", level: "IAL", label: "FP3 route", papers: ["P1", "P2", "P3", "P4", "FP1", "FP3"] },
    ],
    qualificationViews: [
      { key: "ial", label: "IAL", paperCount: "6 个单元：P1–P4 + FP1 + FP2 / FP3", componentGroups: ["P1", "P2", "P3", "P4", "FP1", "FP2", "FP3"], routes: [
        { id: "ial-pure-fp2", level: "IAL", label: "FP2 route", papers: ["P1", "P2", "P3", "P4", "FP1", "FP2"] },
        { id: "ial-pure-fp3", level: "IAL", label: "FP3 route", papers: ["P1", "P2", "P3", "P4", "FP1", "FP3"] },
      ] },
      { key: "ias", label: "IAS", paperCount: "3 个单元：P1 + P2 + FP1", componentGroups: ["P1", "P2", "FP1"], routes: [
        { id: "ias-pure", level: "IAS", label: "Pure Mathematics IAS", papers: ["P1", "P2", "FP1"] },
      ] },
    ],
    calculator: { status: "all", summary: "全部 YPM01 / XPM01 单元都允许计算器。", prohibited: ["符号代数、微分或积分", "与其他设备或互联网通信", "储存或检索文字、资料库或公式"] },
    formula: { supplied: true, summary: "全部相关单元均提供 Mathematical Formulae and Statistical Tables；仍有部分公式要求考生记忆。" },
    upcomingSeries: "October 2026 + January 2027",
    timetableStatus: "Final",
    upcomingExams: [
      { date: "2026-10-09", session: "Morning", code: "WMA11 01", title: "Pure Mathematics 1", durationMinutes: 90, group: "P1" },
      { date: "2026-10-15", session: "Morning", code: "WMA12 01", title: "Pure Mathematics 2", durationMinutes: 90, group: "P2" },
      { date: "2026-10-21", session: "Afternoon", code: "WMA13 01", title: "Pure Mathematics 3", durationMinutes: 90, group: "P3" },
      { date: "2026-10-28", session: "Afternoon", code: "WMA14 01", title: "Pure Mathematics 4", durationMinutes: 90, group: "P4" },
      { date: "2027-01-14", session: "Afternoon", code: "WFM01 01", title: "Further Pure Mathematics 1", durationMinutes: 90, group: "FP1" },
      { date: "2027-01-20", session: "Morning", code: "WFM02 01", title: "Further Pure Mathematics 2", durationMinutes: 90, group: "FP2" },
      { date: "2027-01-21", session: "Afternoon", code: "WFM03 01", title: "Further Pure Mathematics 3", durationMinutes: 90, group: "FP3" },
    ],
    materials: [
      { id: "ial-pure-october-timetable", type: "timetable", title: "IAL October 2026 Timetable", version: "Final", status: "current", officialUrl: PEARSON_IAL_TIMETABLE, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-october-2026-final.pdf` },
      { id: "ial-pure-january-timetable", type: "timetable", title: "IAL January 2027 Timetable", version: "Final", status: "current", officialUrl: PEARSON_IAL_JANUARY_TIMETABLE, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-january-2027-final.pdf` },
      { id: "ial-pure-spec", type: "syllabus", title: "IAL Mathematics / Further Mathematics / Pure Mathematics Specification", version: "Issue 3 · April 2019", status: "current", officialUrl: PEARSON_IAL_SPEC, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-maths-spec-issue3.pdf`, note: "本页使用 YPM01 / XPM01 范围。" },
      { id: "ial-pure-formula", type: "formula", title: "Mathematical Formulae and Statistical Tables", version: "Issue 2 · 2021", status: "reference", officialUrl: PEARSON_IAL_FORMULAE, previewUrl: `${LOCAL_MATERIALS}/pearson-ial-maths-formula-book-issue2.pdf` },
    ],
    release,
  },
] satisfies ExamOverview[];

export const EXAM_OVERVIEW_CATALOG = rawCatalog.map((item) => ExamOverviewSchema.parse(item));

const byId = new Map(EXAM_OVERVIEW_CATALOG.map((item) => [item.id, item]));

export function examOverviewIdForCourse(entry: Pick<CourseContextEntry, "boardName" | "subjectCode"> | undefined): string | undefined {
  if (!entry) return undefined;
  if (entry.boardName === "AQA" && entry.subjectCode === "8300") return "aqa-8300";
  if (entry.boardName === "AQA" && entry.subjectCode === "8365") return "aqa-8365";
  if (entry.boardName === "AQA" && entry.subjectCode === "7357") return "aqa-7357";
  if (entry.boardName === "AQA" && entry.subjectCode === "7367") return "aqa-7367";
  if (entry.boardName === "CAIE" && entry.subjectCode === "9709") return "cambridge-9709";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0580") return "cambridge-0580";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0606") return "cambridge-0606";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0607") return "cambridge-0607";
  if (entry.boardName === "CAIE" && entry.subjectCode === "9231") return "cambridge-9231";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0610") return "cambridge-0610";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0620") return "cambridge-0620";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0625") return "cambridge-0625";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0478") return "cambridge-0478";
  if (entry.boardName === "CAIE" && entry.subjectCode === "9700") return "cambridge-9700";
  if (entry.boardName === "CAIE" && entry.subjectCode === "9701") return "cambridge-9701";
  if (entry.boardName === "CAIE" && entry.subjectCode === "9702") return "cambridge-9702";
  if (entry.boardName === "CAIE" && entry.subjectCode === "9618") return "cambridge-9618";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0455") return "cambridge-0455";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0450") return "cambridge-0450";
  if (entry.boardName === "CAIE" && entry.subjectCode === "0452") return "cambridge-0452";
  if (entry.boardName === "CAIE" && entry.subjectCode === "9708") return "cambridge-9708";
  if (entry.boardName === "CAIE" && entry.subjectCode === "9609") return "cambridge-9609";
  if (entry.boardName === "CAIE" && entry.subjectCode === "9706") return "cambridge-9706";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4MA1") return "pearson-4ma1";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4PM1") return "pearson-4pm1";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4MB1") return "pearson-4mb1";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4BI1") return "pearson-igcse-4bi1";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4CH1") return "pearson-igcse-4ch1";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4PH1") return "pearson-igcse-4ph1";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4CP0") return "pearson-igcse-4cp0";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4EC1") return "pearson-igcse-4ec1";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4BS1") return "pearson-igcse-4bs1";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "4AC1") return "pearson-igcse-4ac1";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "WMA") return "pearson-ial-mathematics";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "YFM01") return "pearson-ial-further-mathematics";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "YPM01") return "pearson-ial-pure-mathematics";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "YBI11") return "pearson-ial-biology";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "YCH11") return "pearson-ial-chemistry";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "YPH11") return "pearson-ial-physics";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "YEC11") return "pearson-ial-economics";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "YBS11") return "pearson-ial-business";
  if (entry.boardName === "Edexcel" && entry.subjectCode === "YAC11") return "pearson-ial-accounting";
  if ((entry.boardName === "Edexcel" || entry.boardName === "Edexcel UK") && entry.subjectCode === "1MA1") return "pearson-uk-1ma1";
  if ((entry.boardName === "Edexcel" || entry.boardName === "Edexcel UK") && entry.subjectCode === "7M20") return "pearson-uk-7m20";
  if ((entry.boardName === "Edexcel" || entry.boardName === "Edexcel UK") && entry.subjectCode === "9MA0") return "pearson-uk-9ma0";
  if ((entry.boardName === "Edexcel" || entry.boardName === "Edexcel UK") && entry.subjectCode === "9FM0") return "pearson-uk-9fm0";
  if (entry.boardName === "OCR" && entry.subjectCode === "J560") return "ocr-j560";
  if (entry.boardName === "OCR" && entry.subjectCode === "6993") return "ocr-6993";
  if (entry.boardName === "OCR" && entry.subjectCode === "H240") return "ocr-h240";
  if (entry.boardName === "OCR" && entry.subjectCode === "H245") return "ocr-h245";
  return undefined;
}

export function getExamOverviewForCourse(entry: Pick<CourseContextEntry, "boardName" | "subjectCode"> | undefined): ExamOverview | undefined {
  const id = examOverviewIdForCourse(entry);
  return id ? byId.get(id) : undefined;
}
