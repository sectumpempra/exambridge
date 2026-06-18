import ALevelBoardPage from "../../components/ALevelBoardPage";
import data from "../../data/aqa_al.json";

const COLUMNS = [
  { key: "year", label: "年份" },
  { key: "session", label: "考试季" },
  { key: "code", label: "科目代码" },
  { key: "unit", label: "单元名称" },
  { key: "max_mark", label: "满分" },
  { key: "a_star", label: "A*" },
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { key: "c", label: "C" },
  { key: "d", label: "D" },
  { key: "e", label: "E" },
];

const GRADES = [
  { key: "a_star", label: "A*", color: "#94A8B8" },
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

export default function AlevelAqaPage() {
  return (
    <ALevelBoardPage
      boardName="AQA"
      note="Oxford AQA A-Level 分数线（2018-2026），634 条数据，覆盖会计、生物、化学、计算机、经济、英语、进阶数学、地理、文学、数学、物理、心理等科目。版权归 Oxford AQA 所有。"
      columns={COLUMNS}
      data={data as Record<string, string | number>[]}
      gradeFields={GRADES}
      codeField="code"
      sessionField="session"
      yearField="year"
      maxMarkField="max_mark"
      filterFields={FILTERS}
      level="A-Level"
      otherLevelPath="/gcse/aqa"
      otherLevelLabel="AQA GCSE"
    />
  );
}
