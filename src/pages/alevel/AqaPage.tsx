import ALevelBoardPage from "../../components/ALevelBoardPage";
import { MERGED_AQA_A_LEVEL_DATA } from "../../data/official/mergedMathData";

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
  { key: "a_star", label: "A*", color: "#526B7E" },
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

export default function AlevelAqaPage() {
  return (
    <ALevelBoardPage
      boardName="AQA"
      note="包含 OxfordAQA International 数据，并补充 AQA UK Mathematics (7357) 与 Further Mathematics (7367) 的官方 subject/component 分数线。2019 June、2020/2021 November 与 2022-2025 June 已核验；2020/2021 夏季没有考试分数线。"
      columns={COLUMNS}
      data={MERGED_AQA_A_LEVEL_DATA}
      gradeFields={GRADES}
      codeField="code"
      sessionField="session"
      yearField="year"
      maxMarkField="max_mark"
      componentField="unit"
      filterFields={FILTERS}
      level="A-Level"
      otherLevelPath="/gcse/aqa"
      otherLevelLabel="AQA GCSE"
    />
  );
}
