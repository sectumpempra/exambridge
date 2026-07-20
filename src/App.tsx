import { Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

// Pages that appear on every route (header/footer) - keep eager
import Home from "./pages/Home";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import PWAUpdateHandler from "./components/PWAUpdateHandler";
import ErrorBoundary from "./components/ErrorBoundary";
import { CourseContextProvider } from "./course-context/CourseContextProvider";

// Lazy-load all other pages to enable code splitting
const About = lazy(() => import("./pages/About"));
const ALevelHome = lazy(() => import("./pages/alevel/Home"));
const ALevelCaiePage = lazy(() => import("./pages/alevel/CaiePage"));
const ALevelEdexcelPage = lazy(() => import("./pages/alevel/EdexcelPage"));
const ALevelAqaPage = lazy(() => import("./pages/alevel/AqaPage"));
const ALevelOcrPage = lazy(() => import("./pages/alevel/OcrPage"));
const ALevelWjecPage = lazy(() => import("./pages/alevel/WjecPage"));
const GCSEHome = lazy(() => import("./pages/gcse/Home"));
const GCSEEdexcelPage = lazy(() => import("./pages/gcse/EdexcelPage"));
const GCSECaiePage = lazy(() => import("./pages/gcse/CaiePage"));
const GCSEAqaPage = lazy(() => import("./pages/gcse/AqaPage"));
const GCSEOcrPage = lazy(() => import("./pages/gcse/OcrPage"));
const OcrFsmqPage = lazy(() => import("./pages/fsmq/OcrFsmqPage"));
const GradeCalculator = lazy(() => import("./pages/GradeCalculator"));
const Planner = lazy(() => import("./pages/Planner"));
const ResultStatisticsPage = lazy(() => import("./pages/ResultStatisticsPage"));
const IdentitySelect = lazy(() => import("./pages/IdentitySelect"));
const PersonalityTest = lazy(() => import("./pages/PersonalityTest"));
const GraphPage = lazy(() => import("./pages/graph/GraphPage"));
const PaperSearchPage = lazy(() => import("./pages/papers/PaperSearchPage"));
const PaperDetailPage = lazy(() => import("./pages/papers/PaperDetailPage"));
const PaperComparePage = lazy(() => import("./pages/papers/PaperComparePage"));
const KnowledgeTreeComparePage = lazy(() => import("./pages/knowledge-tree/KnowledgeTreeComparePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CourseCenter = lazy(() => import("./pages/CourseCenter"));
const ResultsHub = lazy(() => import("./pages/ResultsHub"));
const ToolsHub = lazy(() => import("./pages/ToolsHub"));
const ExamOverviewPage = lazy(() => import("./pages/ExamOverviewPage"));
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));

function RouteFrame({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => { document.title = `${title} | ExamBridge`; }, [title]);
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

// Loading fallback for lazy routes
function PageLoader() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)",
    }}>
      <div style={{ textAlign: "center", color: "#6E675E" }}>
        <div style={{
          width: 40, height: 40,
          border: "3px solid #E8E4DE",
          borderTop: "3px solid #A69888",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto 16px",
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 14 }}>加载中...</div>
      </div>
    </div>
  );
}

export default function App() {
  const page = (title: string, element: ReactNode) => <RouteFrame title={title}>{element}</RouteFrame>;
  return (
    <CourseContextProvider>
    <Suspense fallback={<PageLoader />}>
      <PWAUpdateHandler />
      <PWAInstallPrompt />
      <Routes>
        <Route path="/" element={page("首页", <Home />)} />
        <Route path="/about" element={page("关于", <About />)} />
        <Route path="/courses" element={page("课程中心", <CourseCenter />)} />
        <Route path="/exam-overview" element={page("考试概览", <ExamOverviewPage />)} />
        <Route path="/results" element={page("成绩与等级", <ResultsHub />)} />
        <Route path="/tools" element={page("教学工具", <ToolsHub />)} />
        <Route path="/ai-assistant" element={page("AI 问答", <AIAssistantPage />)} />

        {/* A-Level 分数线 */}
        <Route path="/alevel" element={page("A-Level 分数线", <ALevelHome />)} />
        <Route path="/alevel/caie" element={page("CAIE A-Level 分数线", <ALevelCaiePage />)} />
        <Route path="/alevel/edexcel" element={page("Edexcel A-Level 分数线", <ALevelEdexcelPage />)} />
        <Route path="/alevel/aqa" element={page("AQA A-Level 分数线", <ALevelAqaPage />)} />
        <Route path="/alevel/ocr" element={page("OCR A-Level 分数线", <ALevelOcrPage />)} />
        <Route path="/alevel/wjec" element={page("WJEC 成绩统计", <ALevelWjecPage />)} />

        {/* GCSE 分数线 */}
        <Route path="/gcse" element={page("GCSE 分数线", <GCSEHome />)} />
        <Route path="/gcse/edexcel" element={page("Edexcel GCSE 分数线", <GCSEEdexcelPage />)} />
        <Route path="/gcse/caie" element={page("CAIE IGCSE 分数线", <GCSECaiePage />)} />
        <Route path="/gcse/aqa" element={page("AQA GCSE 分数线", <GCSEAqaPage />)} />
        <Route path="/gcse/ocr" element={page("OCR GCSE 分数线", <GCSEOcrPage />)} />
        <Route path="/fsmq/ocr" element={page("OCR FSMQ 分数线", <OcrFsmqPage />)} />

        {/* Calculator */}
        <Route path="/calculator" element={page("等级预测", <GradeCalculator />)} />

        {/* Planner */}
        <Route path="/planner" element={page("刷题规划", <Planner />)} />

        {/* Personality */}
        <Route path="/personality" element={page("人格诊断", <IdentitySelect />)} />
        <Route path="/personality/test" element={page("人格测试", <PersonalityTest />)} />

        {/* Result Statistics */}
        <Route path="/statistics" element={page("成绩统计", <ResultStatisticsPage />)} />

        {/* Function Graph */}
        <Route path="/graph" element={page("函数画图", <GraphPage />)} />

        {/* Paper Query */}
        <Route path="/papers" element={page("试卷查询", <PaperSearchPage />)} />
        <Route path="/papers/:paperId" element={page("试卷详情", <PaperDetailPage />)} />
        <Route path="/papers/compare" element={page("试卷比较", <PaperComparePage />)} />

        {/* Knowledge Tree Comparison */}
        <Route path="/knowledge-tree" element={page("知识树比较", <KnowledgeTreeComparePage />)} />
        <Route path="*" element={page("页面未找到", <NotFound />)} />
      </Routes>
      <Toaster position="top-right" richColors />
    </Suspense>
    </CourseContextProvider>
  );
}
