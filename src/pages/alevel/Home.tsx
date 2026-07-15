import { Link } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { BookOpen, Award, BarChart3, TrendingUp, GraduationCap } from "lucide-react";

const CARDS = [
  {
    board: "Edexcel",
    description: "历史导入数据覆盖数学、科学、经济、语言与人文；未逐行核验的记录仅供查询。",
    to: "/alevel/edexcel",
    icon: BookOpen,
    accent: "#526B7E",
    count: "2,129",
  },
  {
    board: "CAIE",
    description: "Cambridge International AS/A-Level 历史阈值；已核验数据与待核验记录会明确区分。",
    to: "/alevel/caie",
    icon: Award,
    accent: "#675A4D",
    count: "4,597",
  },
  {
    board: "AQA",
    description: "AQA A-Level 历史分数线；数学官方修正版已接入，其余记录仍按严格策略核验。",
    to: "/alevel/aqa",
    icon: TrendingUp,
    accent: "#775E55",
    count: "634",
  },
  {
    board: "OCR",
    description: "覆盖古代历史、古典文明等人文与科学科目（2021-2025）。",
    to: "/alevel/ocr",
    icon: BarChart3,
    accent: "#506D58",
    count: "701",
  },
  {
    board: "WJEC/Eduqas",
    description: "威尔士 WJEC 与英格兰 Eduqas 的 A-Level 成绩统计数据，覆盖艺术、人文、科学等 71 门科目。",
    to: "/alevel/wjec",
    icon: GraduationCap,
    accent: "#52697A",
    count: "439",
  },
];

export default function AlevelHome() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title="A-Level 分数线查询" />
      <main style={{ flex: 1 }}>
        <section style={{ padding: "48px 16px", position: "relative" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
            <h1 className="animate-fade-in-up morandi-gradient-text" style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, margin: 0, letterSpacing: "0.04em", animationDelay: "0.1s", opacity: 0 }}>
              A-Level 分数线查询
            </h1>
            <p className="animate-fade-in-up" style={{ fontSize: 16, color: "#625C54", lineHeight: 1.8, marginTop: 16, animationDelay: "0.2s", opacity: 0 }}>
              查询 Edexcel、CAIE、AQA、OCR 的 A-Level 分数线，以及 WJEC/Eduqas 成绩统计。<br />
              未核验记录不会进入等级预测；WJEC/Eduqas 暂不提供分数线。
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
                      <p style={{ fontSize: 11, color: "#6E675E", margin: 0, marginTop: 2 }}>{card.count} 条数据</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: "#625C54", lineHeight: 1.6, marginTop: 12, flex: 1 }}>{card.description}</p>
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
