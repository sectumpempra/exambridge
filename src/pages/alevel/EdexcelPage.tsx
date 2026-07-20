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
  { key: "a*", label: "A*", color: "#526B7E" },
  { key: "a", label: "A", color: "#506D58" },
  { key: "b", label: "B", color: "#6E5C40" },
  { key: "c", label: "C", color: "#775E55" },
  { key: "d", label: "D", color: "#655A70" },
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
      note="Pearson Edexcel AS/A-Level/IAL 历史分数线。8MA0 AS 使用 A–E 等级，不设 A*；已核验与待核验记录按严格发布策略区分，未核验数据不会用于等级预测。"
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
