import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import GradeCalculator from "./pages/GradeCalculator";
import Planner from "./pages/Planner";
import About from "./pages/About";
import PersonalityTest from "./pages/PersonalityTest";
import IdentitySelect from "./pages/IdentitySelect";

// A-Level pages
import AlevelHome from "./pages/alevel/Home";
import AlevelEdexcelPage from "./pages/alevel/EdexcelPage";
import AlevelCaiePage from "./pages/alevel/CaiePage";
import AlevelAqaPage from "./pages/alevel/AqaPage";
import AlevelOcrPage from "./pages/alevel/OcrPage";

// GCSE pages
import GcseHome from "./pages/gcse/Home";
import GcseCaiePage from "./pages/gcse/CaiePage";
import GcseEdexcelPage from "./pages/gcse/EdexcelPage";
import GcseOcrPage from "./pages/gcse/OcrPage";
import GcseAqaPage from "./pages/gcse/AqaPage";

export default function App() {
  return (
    <Routes>
      {/* Home */}
      <Route path="/" element={<Home />} />

      {/* A-Level */}
      <Route path="/alevel" element={<AlevelHome />} />
      <Route path="/alevel/edexcel" element={<AlevelEdexcelPage />} />
      <Route path="/alevel/caie" element={<AlevelCaiePage />} />
      <Route path="/alevel/aqa" element={<AlevelAqaPage />} />
      <Route path="/alevel/ocr" element={<AlevelOcrPage />} />

      {/* GCSE */}
      <Route path="/gcse" element={<GcseHome />} />
      <Route path="/gcse/caie" element={<GcseCaiePage />} />
      <Route path="/gcse/edexcel" element={<GcseEdexcelPage />} />
      <Route path="/gcse/ocr" element={<GcseOcrPage />} />
      <Route path="/gcse/aqa" element={<GcseAqaPage />} />

      {/* Grade Calculator */}
      <Route path="/calculator" element={<GradeCalculator />} />

      {/* Planner */}
      <Route path="/planner" element={<Planner />} />

      {/* About */}
      <Route path="/about" element={<About />} />

      {/* Personality Test */}
      <Route path="/personality" element={<IdentitySelect />} />
      <Route path="/personality/test" element={<PersonalityTest />} />
    </Routes>
  );
}
