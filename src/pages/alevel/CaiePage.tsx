import ALevelBoardPage from "../../components/ALevelBoardPage";
import data from "../../data/caie_al.json";

const COLUMNS = [
  { key: "SubjectCode", label: "科目代码" },
  { key: "Subject", label: "科目名称" },
  { key: "Series", label: "考试季" },
  { key: "Component", label: "试卷" },
  { key: "MaxRawMark", label: "满分" },
  { key: "A", label: "A" },
  { key: "B", label: "B" },
  { key: "C", label: "C" },
  { key: "D", label: "D" },
  { key: "E", label: "E" },
];

const GRADES = [
  { key: "A", label: "A", color: "#94A8B8" },
  { key: "B", label: "B", color: "#9AAF9E" },
  { key: "C", label: "C", color: "#B8A68A" },
  { key: "D", label: "D", color: "#BFA8A0" },
  { key: "E", label: "E", color: "#A8A0B0" },
];

const FILTERS = [
  { key: "SubjectCode", label: "科目代码" },
  { key: "Series", label: "考试季" },
  { key: "Component", label: "试卷" },
];

export default function AlevelCiePage() {
  return (
    <ALevelBoardPage
      boardName="CAIE"
      note="Cambridge International AS/A-Level Grade Thresholds（2021-2025），覆盖 4,500+ 条数据，涵盖数学、物理、化学、生物、经济、计算机等全部 CIE 科目。版权归 Cambridge 所有。"
      columns={COLUMNS}
      data={data as Record<string, string | number>[]}
      gradeFields={GRADES}
      codeField="SubjectCode"
      sessionField="Series"
      yearField="Series"
      maxMarkField="MaxRawMark"
      componentField="Component"
      filterFields={FILTERS}
      level="A-Level"
      isCaie={true}
      otherLevelPath="/gcse/caie"
      otherLevelLabel="CAIE GCSE"
    />
  );
}
