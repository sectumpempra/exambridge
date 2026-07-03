import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

// Pages that appear on every route (header/footer) - keep eager
import Home from "./pages/Home";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

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
const GradeCalculator = lazy(() => import("./pages/GradeCalculator"));
const Planner = lazy(() => import("./pages/Planner"));
const ResultStatisticsPage = lazy(() => import("./pages/ResultStatisticsPage"));
const IdentitySelect = lazy(() => import("./pages/IdentitySelect"));
const PersonalityTest = lazy(() => import("./pages/PersonalityTest"));
const GraphPage = lazy(() => import("./pages/graph/GraphPage"));
const PaperSearchPage = lazy(() => import("./pages/papers/PaperSearchPage"));
const PaperDetailPage = lazy(() => import("./pages/papers/PaperDetailPage"));
const PaperComparePage = lazy(() => import("./pages/papers/PaperComparePage"));

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
      <div style={{ textAlign: "center", color: "#A8A095" }}>
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
  return (
    <Suspense fallback={<PageLoader />}>
      <PWAInstallPrompt />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />

        {/* A-Level 分数线 */}
        <Route path="/alevel" element={<ALevelHome />} />
        <Route path="/alevel/caie" element={<ALevelCaiePage />} />
        <Route path="/alevel/edexcel" element={<ALevelEdexcelPage />} />
        <Route path="/alevel/aqa" element={<ALevelAqaPage />} />
        <Route path="/alevel/ocr" element={<ALevelOcrPage />} />
        <Route path="/alevel/wjec" element={<ALevelWjecPage />} />

        {/* GCSE 分数线 */}
        <Route path="/gcse" element={<GCSEHome />} />
        <Route path="/gcse/edexcel" element={<GCSEEdexcelPage />} />
        <Route path="/gcse/caie" element={<GCSECaiePage />} />
        <Route path="/gcse/aqa" element={<GCSEAqaPage />} />
        <Route path="/gcse/ocr" element={<GCSEOcrPage />} />

        {/* Calculator */}
        <Route path="/calculator" element={<GradeCalculator />} />

        {/* Planner */}
        <Route path="/planner" element={<Planner />} />

        {/* Personality */}
        <Route path="/personality" element={<IdentitySelect />} />
        <Route path="/personality/test" element={<PersonalityTest />} />

        {/* Result Statistics */}
        <Route path="/statistics" element={<ResultStatisticsPage />} />

        {/* Function Graph */}
        <Route path="/graph" element={<GraphPage />} />

        {/* Paper Query */}
        <Route path="/papers" element={<PaperSearchPage />} />
        <Route path="/papers/:paperId" element={<PaperDetailPage />} />
        <Route path="/papers/compare" element={<PaperComparePage />} />
      </Routes>
    </Suspense>
  );
}
