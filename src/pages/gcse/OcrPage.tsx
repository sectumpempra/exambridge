import BoardPage from "../../components/BoardPage";
import ocrData from "../../data/ocr.json";

const COLUMNS = [
  { key: "year", label: "年份" },
  { key: "session", label: "考试季" },
  { key: "code", label: "科目代码" },
  { key: "component", label: "卷号" },
  { key: "unit", label: "科目名称" },
  { key: "maxMark", label: "满分" },
  { key: "grade9", label: "9/A*" },
  { key: "grade8", label: "8/A" },
  { key: "grade7", label: "7/B" },
  { key: "grade6", label: "6/C" },
  { key: "grade5", label: "5/D" },
  { key: "grade4", label: "4/E" },
  { key: "grade3", label: "3" },
  { key: "grade2", label: "2" },
  { key: "grade1", label: "1" },
];

const GRADES = [
  { key: "grade9", label: "9/A*", color: "#94A8B8" },
  { key: "grade8", label: "8/A", color: "#9AAF9E" },
  { key: "grade7", label: "7/B", color: "#B8A68A" },
  { key: "grade6", label: "6/C", color: "#BFA8A0" },
  { key: "grade5", label: "5/D", color: "#A8A0B0" },
  { key: "grade4", label: "4/E", color: "#A0A8B0" },
  { key: "grade3", label: "3", color: "#B5A88A" },
  { key: "grade2", label: "2", color: "#A0A8A0" },
  { key: "grade1", label: "1", color: "#C4BDB3" },
];

const FILTERS = [
  { key: "code", label: "科目代码" },
  { key: "year", label: "年份" },
  { key: "session", label: "考试季" },
];

export default function OcrPage() {
  return (
    <BoardPage
      boardName="OCR"
      note="数据来源于 OCR 官方，仅作学习参考。含 Mathematics (J560)、FSMQ Additional Mathematics (6993, A*-E)、Biology A (J257)、Chemistry A (J258)、Physics A (J259)、English Language (J351)、English Literature (J352)。版权归 OCR 所有。"
      columns={COLUMNS}
      data={ocrData as Record<string, string | number>[]}
      gradeFields={GRADES}
      codeField="code"
      sessionField="session"
      yearField="year"
      maxMarkField="maxMark"
      filterFields={FILTERS}
    />
  );
}
