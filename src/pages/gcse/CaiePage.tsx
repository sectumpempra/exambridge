import BoardPage from "../../components/BoardPage";
import caieData from "../../data/caie.json";

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
  { key: "a", label: "A", color: "#94A8B8" },
  { key: "b", label: "B", color: "#9AAF9E" },
  { key: "c", label: "C", color: "#B8A68A" },
  { key: "d", label: "D", color: "#BFA8A0" },
  { key: "e", label: "E", color: "#A8A0B0" },
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
      note="数据来源于剑桥国际官方，仅作学习参考。含 Mathematics (0580)、Additional Mathematics (0606)、Biology (0610)、Chemistry (0620)、Physics (0625)、Coordinated Sciences (0654)、English First Language (0500)、Computer Science (0478)、Economics (0455)、History (0470)。版权归 Cambridge 所有。"
      columns={COLUMNS}
      data={caieData as Record<string, string | number>[]}
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
