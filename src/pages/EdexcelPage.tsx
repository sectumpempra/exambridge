import BoardPage from "../components/BoardPage";
import edexcelData from "../data/edexcel.json";

const COLUMNS = [
  { key: "year", label: "年份" },
  { key: "session", label: "考试季" },
  { key: "code", label: "科目代码" },
  { key: "unit", label: "科目名称" },
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

export default function EdexcelPage() {
  return (
    <BoardPage
      boardName="Edexcel"
      note="数据来源于 Edexcel 官方，仅作学习参考。含 GCSE Mathematics (1MA1)、IGCSE Mathematics A (4MA1)、Further Pure Mathematics (4PM1)、Biology (1BI0)、Chemistry (1CH0)、Physics (1PH0)、English Language (1EN0)、English Literature (1ET0)。版权归 Pearson 所有。"
      columns={COLUMNS}
      data={edexcelData as Record<string, string | number>[]}
      gradeFields={GRADES}
      codeField="code"
      sessionField="session"
      yearField="year"
      maxMarkField="maxMark"
      filterFields={FILTERS}
    />
  );
}
