import BoardPage from "../components/BoardPage";
import { MERGED_AQA_GCSE_DATA } from "../data/official/mergedMathData";

const COLUMNS = [
  { key: "year", label: "年份" },
  { key: "session", label: "考试季" },
  { key: "code", label: "科目代码" },
  { key: "subject", label: "科目名称" },
  { key: "maxMark", label: "满分" },
  { key: "grade9", label: "9" },
  { key: "grade8", label: "8" },
  { key: "grade7", label: "7" },
  { key: "grade6", label: "6" },
  { key: "grade5", label: "5" },
  { key: "grade4", label: "4" },
  { key: "grade3", label: "3" },
  { key: "grade2", label: "2" },
  { key: "grade1", label: "1" },
];

const GRADES = [
  { key: "grade9", label: "9", color: "#526B7E" },
  { key: "grade8", label: "8", color: "#506D58" },
  { key: "grade7", label: "7", color: "#6E5C40" },
  { key: "grade6", label: "6", color: "#775E55" },
  { key: "grade5", label: "5", color: "#655A70" },
  { key: "grade4", label: "4", color: "#A0A8B0" },
  { key: "grade3", label: "3", color: "#B5A88A" },
  { key: "grade2", label: "2", color: "#A0A8A0" },
  { key: "grade1", label: "1", color: "#716A61" },
];

const FILTERS = [
  { key: "code", label: "科目代码" },
  { key: "year", label: "年份" },
  { key: "session", label: "考试季" },
];

export default function AqaPage() {
  return (
    <BoardPage
      boardName="AQA"
      note="数据来源于 AQA 官方。数学数据已按 subject 与 notional component 分开：GCSE Mathematics (8300) 覆盖 2019、2020/2021 November 与 2022-2025 可用考季，Level 2 Further Mathematics 覆盖旧代码 8360 与现代码 8365；2020/2021 夏季没有考试，因此不展示虚构分数线。"
      columns={COLUMNS}
      data={MERGED_AQA_GCSE_DATA}
      gradeFields={GRADES}
      codeField="code"
      sessionField="session"
      yearField="year"
      maxMarkField="maxMark"
      componentField="subject"
      filterFields={FILTERS}
    />
  );
}
