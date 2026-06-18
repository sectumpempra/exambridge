import { Link } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { BookOpen, TrendingUp, Award, BarChart3 } from "lucide-react";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "CAIE", to: "/gcse/caie" },
  { label: "Edexcel", to: "/gcse/edexcel" },
  { label: "OCR", to: "/gcse/ocr" },
  { label: "AQA", to: "/gcse/aqa" },
  { label: "等级预测模拟器", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
];

const CARDS = [
  {
    board: "CAIE",
    description: "IGCSE 分数线（2021-2025），覆盖数学、附加数学、生物、化学、物理、综合科学、英语、计算机、经济、历史共 10 门科目。",
    to: "/gcse/caie",
    icon: Award,
    accent: "#8F7F6E",
  },
  {
    board: "Edexcel",
    description: "GCSE & IGCSE 分数线（2021-2025），覆盖数学（含进阶纯数）、生物、化学、物理、英语语言、英语文学共 8 门科目。",
    to: "/gcse/edexcel",
    icon: BookOpen,
    accent: "#94A8B8",
  },
  {
    board: "OCR",
    description: "GCSE 分数线（2021-2025），覆盖数学、附加数学（A*-E）、生物、化学、物理、英语语言、英语文学共 7 门科目。",
    to: "/gcse/ocr",
    icon: BarChart3,
    accent: "#9AAF9E",
  },
  {
    board: "AQA",
    description: "GCSE 分数线（2021-2025），覆盖数学（含进阶数学）、生物、化学、物理、英语语言、英语文学共 7 门科目。",
    to: "/gcse/aqa",
    icon: TrendingUp,
    accent: "#BFA8A0",
  },
];

export default function GcseHome() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title="GCSE / IGCSE 分数线查询" links={NAV_LINKS} />
      <main style={{ flex: 1 }}>
        <section style={{ padding: "48px 16px", position: "relative" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
            <h2 className="animate-fade-in-up morandi-gradient-text" style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, margin: 0, letterSpacing: "0.04em", animationDelay: "0.1s", opacity: 0 }}>
              GCSE / IGCSE 分数线查询
            </h2>
            <p className="animate-fade-in-up" style={{ fontSize: 16, color: "#8B8378", lineHeight: 1.8, marginTop: 16, animationDelay: "0.2s", opacity: 0 }}>
              免费浏览 CAIE、Edexcel、OCR 和 AQA 四大考试局的 GCSE / IGCSE 分数线数据。
            </p>
          </div>
        </section>

        <section style={{ padding: "0 16px 40px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 20 }}>
            {CARDS.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={card.board} className="animate-fade-in-up glass-card" style={{ padding: 28, display: "flex", flexDirection: "column", animationDelay: `${0.2 + idx * 0.1}s`, opacity: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${card.accent}18, ${card.accent}08)`, border: `1px solid ${card.accent}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={18} style={{ color: card.accent }} />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: "#3D3832", margin: 0 }}>{card.board}</h3>
                  </div>
                  <p style={{ fontSize: 13, color: "#8B8378", lineHeight: 1.6, marginTop: 12, flex: 1 }}>{card.description}</p>
                  <Link to={card.to}
                    style={{ display: "block", textAlign: "center", background: `linear-gradient(135deg, ${card.accent}12, ${card.accent}04)`, color: card.accent, fontSize: 14, fontWeight: 500, padding: "12px 16px", borderRadius: 10, textDecoration: "none", marginTop: 20, border: `1px solid ${card.accent}20`, transition: "all 0.3s ease" }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = `linear-gradient(135deg, ${card.accent}22, ${card.accent}10)`; (e.target as HTMLElement).style.borderColor = `${card.accent}38`; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = `linear-gradient(135deg, ${card.accent}12, ${card.accent}04)`; (e.target as HTMLElement).style.borderColor = `${card.accent}20`; }}>
                    查看 {card.board} GCSE 分数线
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
