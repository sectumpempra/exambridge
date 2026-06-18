import ALevelBoardPage from "../../components/ALevelBoardPage";
import data from "../../data/edexcel_al.json";

const COLUMNS = [
  { key: "year", label: "年份" },
  { key: "session", label: "考试季" },
  { key: "code", label: "科目代码" },
  { key: "unit", label: "科目名称" },
  { key: "max_mark", label: "满分" },
  { key: "a*", label: "A*" },
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { key: "c", label: "C" },
  { key: "d", label: "D" },
  { key: "e", label: "E" },
  { key: "u", label: "U" },
];

const GRADES = [
  { key: "a*", label: "A*", color: "#94A8B8" },
  { key: "a", label: "A", color: "#9AAF9E" },
  { key: "b", label: "B", color: "#B8A68A" },
  { key: "c", label: "C", color: "#BFA8A0" },
  { key: "d", label: "D", color: "#A8A0B0" },
  { key: "e", label: "E", color: "#A0A8B0" },
];

const FILTERS = [
  { key: "code", label: "科目代码" },
  { key: "year", label: "年份" },
  { key: "session", label: "考试季" },
];

export default function AlevelEdexcelPage() {
  return (
    <ALevelBoardPage
      boardName="Edexcel"
      note="Edexcel A-Level 分数线（2014-2026），超过 800 个单元，覆盖数学、科学、经济、语言、人文等 125 门科目。数据来源于 Pearson Edexcel 官方。"
      columns={COLUMNS}
      data={data as Record<string, string | number>[]}
      gradeFields={GRADES}
      codeField="code"
      sessionField="session"
      yearField="year"
      maxMarkField="max_mark"
      filterFields={FILTERS}
      componentField="unit"
      level="A-Level"
      otherLevelPath="/gcse/edexcel"
      otherLevelLabel="Edexcel GCSE"
    />
  );
}
