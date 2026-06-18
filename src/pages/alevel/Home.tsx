import { Link } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { BookOpen, Award, BarChart3, TrendingUp } from "lucide-react";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "Edexcel", to: "/alevel/edexcel" },
  { label: "CAIE", to: "/alevel/caie" },
  { label: "AQA", to: "/alevel/aqa" },
  { label: "OCR", to: "/alevel/ocr" },
  { label: "等级预测模拟器", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
];

const CARDS = [
  {
    board: "Edexcel",
    description: "超过 800 个单元，覆盖数学、科学、经济、语言、人文等 125 门科目（2014-2026）。",
    to: "/alevel/edexcel",
    icon: BookOpen,
    accent: "#94A8B8",
    count: "2,129",
  },
  {
    board: "CAIE",
    description: "Cambridge International AS/A-Level Grade Thresholds，涵盖数学、物理、化学、生物、经济、计算机等全部 CAIE 科目（2021-2025）。",
    to: "/alevel/caie",
    icon: Award,
    accent: "#8F7F6E",
    count: "4,597",
  },
  {
    board: "AQA",
    description: "Oxford AQA A-Level 分数线，覆盖会计、生物、化学、计算机、经济、英语、进阶数学、地理、文学、数学、物理、心理等 13 门科目（2018-2026）。",
    to: "/alevel/aqa",
    icon: TrendingUp,
    accent: "#BFA8A0",
    count: "634",
  },
  {
    board: "OCR",
    description: "覆盖古代历史、古典文明等人文与科学科目（2021-2025）。",
    to: "/alevel/ocr",
    icon: BarChart3,
    accent: "#9AAF9E",
    count: "701",
  },
];

export default function AlevelHome() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title="A-Level 分数线查询" links={NAV_LINKS} />
      <main style={{ flex: 1 }}>
        <section style={{ padding: "48px 16px", position: "relative" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
            <h2 className="animate-fade-in-up morandi-gradient-text" style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, margin: 0, letterSpacing: "0.04em", animationDelay: "0.1s", opacity: 0 }}>
              A-Level 分数线查询
            </h2>
            <p className="animate-fade-in-up" style={{ fontSize: 16, color: "#8B8378", lineHeight: 1.8, marginTop: 16, animationDelay: "0.2s", opacity: 0 }}>
              免费浏览 Edexcel、CAIE、AQA、OCR 四大考试局的 A-Level 分数线数据。<br />
              下拉选择科目查看趋势图，筛选表格数据，或下载 CSV 离线分析。
            </p>
          </div>
        </section>

        <section style={{ padding: "0 16px 40px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {CARDS.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div key={card.board} className="animate-fade-in-up glass-card" style={{ padding: 28, display: "flex", flexDirection: "column", animationDelay: `${0.2 + idx * 0.1}s`, opacity: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${card.accent}18, ${card.accent}08)`, border: `1px solid ${card.accent}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={18} style={{ color: card.accent }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 600, color: "#3D3832", margin: 0 }}>{card.board}</h3>
                      <p style={{ fontSize: 11, color: "#A8A095", margin: 0, marginTop: 2 }}>{card.count} 条数据</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: "#8B8378", lineHeight: 1.6, marginTop: 12, flex: 1 }}>{card.description}</p>
                  <Link to={card.to}
                    style={{ display: "block", textAlign: "center", background: `linear-gradient(135deg, ${card.accent}12, ${card.accent}04)`, color: card.accent, fontSize: 14, fontWeight: 500, padding: "12px 16px", borderRadius: 10, textDecoration: "none", marginTop: 20, border: `1px solid ${card.accent}20`, transition: "all 0.3s ease" }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = `linear-gradient(135deg, ${card.accent}22, ${card.accent}10)`; (e.target as HTMLElement).style.borderColor = `${card.accent}38`; (e.target as HTMLElement).style.boxShadow = `0 4px 14px ${card.accent}12`; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = `linear-gradient(135deg, ${card.accent}12, ${card.accent}04)`; (e.target as HTMLElement).style.borderColor = `${card.accent}20`; (e.target as HTMLElement).style.boxShadow = "none"; }}>
                    查看 {card.board} A-Level 分数线
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
