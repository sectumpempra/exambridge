import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { GraduationCap, BookOpen, Sparkles } from "lucide-react";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "A-level 分数线", to: "/alevel" },
  { label: "Paper 查询", to: "/papers" },
  { label: "GCSE 分数线", to: "/gcse" },
  { label: "等级预测模拟器", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
];

export default function IdentitySelect() {
  const cardStyle: React.CSSProperties = {
    padding: 32, borderRadius: 16,
    background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(250,248,245,0.9))",
    boxShadow: "0 4px 24px rgba(61,56,50,0.06)",
    border: "1px solid rgba(233,229,222,0.8)",
    transition: "all 0.3s ease",
    cursor: "pointer",
    textDecoration: "none",
    display: "block",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8, #F5F2EE)" }}>
      <Header title="人格诊断" links={NAV_LINKS} />
      <main style={{ flex: 1, padding: "40px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <Sparkles size={36} style={{ color: "#8F7F6E", marginBottom: 12 }} />
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#3D3832", margin: "0 0 8px" }}>
              选择你的身份
            </h2>
            <p style={{ fontSize: 15, color: "#8B8378", margin: 0 }}>
              学生版与教师版的题目和人格解读各不相同
            </p>
          </div>

          {/* Two cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Student Card */}
            <Link
              to="/personality/test?mode=student"
              style={cardStyle}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(61,56,50,0.1)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(61,56,50,0.06)";
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #94A8B820, #94A8B808)", border: "1px solid #94A8B825", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <BookOpen size={22} style={{ color: "#94A8B8" }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#3D3832", margin: "0 0 6px" }}>我是学生</h3>
              <p style={{ fontSize: 13, color: "#8B8378", lineHeight: 1.6, margin: "0 0 16px" }}>
                测测你在 A-Level 圈子里是哪种生物？Plans 批发商、DDL 极限运动家，还是梦校预言家？
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["20道趣味题", "16种学科人格"].map(t => (
                  <span key={t} style={{ padding: "3px 10px", borderRadius: 12, background: "rgba(148,168,184,0.1)", color: "#94A8B8", fontSize: 11, fontWeight: 500 }}>{t}</span>
                ))}
              </div>
            </Link>

            {/* Teacher Card */}
            <Link
              to="/personality/test?mode=teacher"
              style={cardStyle}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(61,56,50,0.1)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(61,56,50,0.06)";
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #8F7F6E20, #8F7F6E08)", border: "1px solid #8F7F6E25", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <GraduationCap size={22} style={{ color: "#8F7F6E" }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#3D3832", margin: "0 0 6px" }}>我是教师</h3>
              <p style={{ fontSize: 13, color: "#8B8378", lineHeight: 1.6, margin: "0 0 16px" }}>
                测测你是哪种类型的 A-Level 教师？严谨守护者、灵魂引路人，还是教育统帅？
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["20道教师场景题", "16种教师人格"].map(t => (
                  <span key={t} style={{ padding: "3px 10px", borderRadius: 12, background: "rgba(143,127,110,0.1)", color: "#8F7F6E", fontSize: 11, fontWeight: 500 }}>{t}</span>
                ))}
              </div>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
