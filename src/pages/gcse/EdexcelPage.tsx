import BoardPage from "../../components/BoardPage";
import edexcelData from "../../data/edexcel.json";

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
  { key: "grade9", label: "9", color: "#94A8B8" },
  { key: "grade8", label: "8", color: "#9AAF9E" },
  { key: "grade7", label: "7", color: "#B8A68A" },
  { key: "grade6", label: "6", color: "#BFA8A0" },
  { key: "grade5", label: "5", color: "#A8A0B0" },
  { key: "grade4", label: "4", color: "#A0A8B0" },
  { key: "grade3", label: "3", color: "#B5A88A" },
  { key: "grade2", label: "2", color: "#A0A8A0" },
  { key: "grade1", label: "1", color: "#C4BDB3" },
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
