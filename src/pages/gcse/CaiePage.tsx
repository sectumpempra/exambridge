import BoardPage from "../../components/BoardPage";
import { MERGED_CAIE_GCSE_DATA } from "../../data/official/mergedMathData";

const COLUMNS = [
  { key: "subjectCode", label: "科目代码" },
  { key: "subject", label: "科目名称" },
  { key: "series", label: "考试季" },
  { key: "component", label: "试卷" },
  { key: "maxMark", label: "满分" },
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { key: "c", label: "C" },
  { key: "d", label: "D" },
  { key: "e", label: "E" },
  { key: "f", label: "F" },
  { key: "g", label: "G" },
];

const GRADES = [
  { key: "a", label: "A", color: "#526B7E" },
  { key: "b", label: "B", color: "#506D58" },
  { key: "c", label: "C", color: "#6E5C40" },
  { key: "d", label: "D", color: "#775E55" },
  { key: "e", label: "E", color: "#655A70" },
  { key: "f", label: "F", color: "#B5A88A" },
  { key: "g", label: "G", color: "#A0A8A0" },
];

const FILTERS = [
  { key: "subjectCode", label: "科目代码" },
  { key: "series", label: "考试季" },
  { key: "component", label: "试卷" },
];

export default function CaiePage() {
  return (
    <BoardPage
      boardName="CAIE"
      note="数据来源于 Cambridge International 官方。Mathematics (0580) 与 Additional Mathematics (0606) 已补充并核验 March 2026；June 2026 尚未发布。其余历史考季按官方可用性展示。"
      columns={COLUMNS}
      data={MERGED_CAIE_GCSE_DATA}
      gradeFields={GRADES}
      codeField="subjectCode"
      sessionField="series"
      yearField="series"
      maxMarkField="maxMark"
      isCaie={true}
      componentField="component"
      filterFields={FILTERS}
    />
  );
}
