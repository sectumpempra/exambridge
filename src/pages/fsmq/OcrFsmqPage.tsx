import BoardPage from "@/components/BoardPage";
import { OCR_FSMQ_BOUNDARIES } from "@/data/ocrGradeBoundaries";

const COLUMNS = [
  { key: "year", label: "年份" }, { key: "session", label: "考试季" }, { key: "code", label: "科目代码" },
  { key: "component", label: "卷号" }, { key: "unit", label: "科目名称" }, { key: "maxMark", label: "满分" },
  { key: "a_star", label: "A*" }, { key: "a", label: "A" }, { key: "b", label: "B" },
  { key: "c", label: "C" }, { key: "d", label: "D" }, { key: "e", label: "E" },
];
const GRADES = [
  { key: "a_star", label: "A*", color: "#526B7E" }, { key: "a", label: "A", color: "#506D58" },
  { key: "b", label: "B", color: "#6E5C40" }, { key: "c", label: "C", color: "#775E55" },
  { key: "d", label: "D", color: "#655A70" }, { key: "e", label: "E", color: "#A0A8B0" },
];

export default function OcrFsmqPage() {
  return <BoardPage boardName="OCR FSMQ" note="OCR Level 3 FSMQ Additional Mathematics 6993，采用 A*–E 等级。当前展示 OCR 官方 2025 年分数线；等级预测功能尚未完成整体资格路线核验。" columns={COLUMNS} data={OCR_FSMQ_BOUNDARIES as unknown as Record<string, string | number>[]} gradeFields={GRADES} codeField="code" sessionField="session" yearField="year" maxMarkField="maxMark" filterFields={[{ key: "year", label: "年份" }, { key: "session", label: "考试季" }]} />;
}
