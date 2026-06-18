import ALevelBoardPage from "../../components/ALevelBoardPage";
import data from "../../data/ocr_al.json";

const COLUMNS = [
  { key: "year", label: "年份" },
  { key: "session", label: "考试季" },
  { key: "code", label: "科目代码" },
  { key: "component", label: "卷号" },
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

export default function AlevelOcrPage() {
  return (
    <ALevelBoardPage
      boardName="OCR"
      note="OCR A-Level 分数线（2021-2025），覆盖古代历史、古典文明等人文科目。版权归 OCR 所有。"
      columns={COLUMNS}
      data={data as Record<string, string | number>[]}
      gradeFields={GRADES}
      codeField="code"
      sessionField="session"
      yearField="year"
      maxMarkField="max_mark"
      componentField="component"
      filterFields={FILTERS}
      level="A-Level"
      otherLevelPath="/gcse/ocr"
      otherLevelLabel="OCR GCSE"
    />
  );
}
