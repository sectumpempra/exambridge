import ALevelBoardPage from "../../components/ALevelBoardPage";
import { MERGED_CAIE_A_LEVEL_DATA } from "../../data/official/mergedMathData";
import { useStaticBoundaryData } from "../../hooks/useStaticBoundaryData";

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
  { key: "A", label: "A", color: "#526B7E" },
  { key: "B", label: "B", color: "#506D58" },
  { key: "C", label: "C", color: "#6E5C40" },
  { key: "D", label: "D", color: "#775E55" },
  { key: "E", label: "E", color: "#655A70" },
];

const FILTERS = [
  { key: "SubjectCode", label: "科目代码" },
  { key: "Series", label: "考试季" },
  { key: "Component", label: "试卷" },
];

export default function AlevelCiePage() {
  const { data: historicalData, error, loading } = useStaticBoundaryData("/data/caie-al-history-v1.json");
  const data = [...historicalData, ...MERGED_CAIE_A_LEVEL_DATA];
  return (
    <ALevelBoardPage
      boardName="CAIE"
      note={error ? "历史数据加载失败，请重试。" : loading ? "正在加载 CAIE 历史分数线…" : "Cambridge International AS/A-Level Grade Thresholds。Mathematics (9709) 已补充并核验 March 2026；Further Mathematics (9231) 未在 March 2026 考季开考。June 2026 尚未发布。"}
      columns={COLUMNS}
      data={data}
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
