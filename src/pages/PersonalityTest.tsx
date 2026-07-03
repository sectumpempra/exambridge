import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { QUESTIONS, PERSONALITIES, calculatePersonality, getDimensionPercentages } from "../data/personalityData";
import { TEACHER_QUESTIONS, TEACHER_PERSONALITIES } from "../data/teacherPersonalityData";
import type { Personality } from "../data/personalityData";
import { Clipboard, RotateCcw, Sparkles, Zap, Heart, GraduationCap } from "lucide-react";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "A-level 分数线", to: "/alevel" },
  { label: "Paper 查询", to: "/papers" },
  { label: "GCSE 分数线", to: "/gcse" },
  { label: "等级预测模拟器", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
];

type PageState = "landing" | "quiz" | "loading" | "result";
type TestMode = "student" | "teacher";

export default function PersonalityTest() {
  const [searchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const mode: TestMode = (searchParams.get("mode") as TestMode) || "student";

  const [page, setPage] = useState<PageState>("landing");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<Personality | null>(null);
  const [dimensions, setDimensions] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [animating, setAnimating] = useState(false);

  const questions = useMemo(() => mode === "teacher" ? TEACHER_QUESTIONS : QUESTIONS, [mode]);
  const personalities = useMemo(() => mode === "teacher" ? TEACHER_PERSONALITIES : PERSONALITIES, [mode]);
  const isTeacher = mode === "teacher";

  // Mode change resets handled by key prop on route component

  const startQuiz = () => {
    setAnswers([]);
    setCurrentQ(0);
    setPage("quiz");
  };

  const handleAnswer = (idx: number) => {
    if (animating) return;
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);

    if (currentQ < questions.length - 1) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentQ(prev => prev + 1);
        setAnimating(false);
      }, 300);
    } else {
      const { code, dimensions: dims } = calculatePersonality(newAnswers, questions);
      const personality = personalities[code];
      setResult(personality || null);
      setDimensions(dims);
      setPage("loading");
      setTimeout(() => setPage("result"), 2000);
    }
  };

  const handleShare = () => {
    if (!result) return;
    const title = isTeacher ? "A-Level 教师人格诊断" : "A-Level 学科人格诊断";
    const text = `我在${title}中是【${result.code} - ${result.name}】${result.tagline} 快来测测你是哪种！`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRestart = () => {
    setPage("landing");
    setAnswers([]);
    setCurrentQ(0);
    setResult(null);
  };

  const progress = ((currentQ + 1) / questions.length) * 100;
  const q = questions[currentQ];

  const cardStyle: React.CSSProperties = {
    padding: 24, borderRadius: 16,
    background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(250,248,245,0.9))",
    boxShadow: "0 4px 24px rgba(61,56,50,0.06)",
    border: "1px solid rgba(233,229,222,0.8)",
  };

  return (
    <div key={queryKey} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8, #F5F2EE)" }}>
      <Header title={isTeacher ? "A-Level 教师人格诊断" : "A-Level 学科人格诊断"} links={NAV_LINKS} />
      <main style={{ flex: 1, padding: "24px 16px 40px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {/* ── Landing Page ──────────────────────────────────────── */}
          {page === "landing" && (
            <div style={{ ...cardStyle, textAlign: "center", padding: "48px 32px" }}>
              <div style={{ fontSize: 56, marginBottom: 16, animation: "float 3s ease-in-out infinite" }}>
                {isTeacher ? <GraduationCap size={48} style={{ color: "#8F7F6E" }} /> : <Sparkles size={48} style={{ color: "#8F7F6E" }} />}
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#3D3832", margin: "0 0 8px" }}>
                {isTeacher ? "A-Level 教师人格诊断" : "A-Level 学科人格诊断"}
              </h2>
              <p style={{ fontSize: 15, color: "#8B8378", margin: "0 0 32px" }}>
                {isTeacher
                  ? "测测你是什么样的 A-Level 教师？"
                  : "测测你在 A-Level 圈子里到底是哪种生物？"}
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
                {["20 道趣味题目", "4 维人格分析", "16 种独特人格"].map(t => (
                  <span key={t} style={{ padding: "6px 14px", borderRadius: 20, background: "rgba(143,127,110,0.08)", color: "#8F7F6E", fontSize: 13, fontWeight: 500 }}>
                    {t}
                  </span>
                ))}
              </div>
              <button onClick={startQuiz}
                style={{
                  padding: "14px 40px", borderRadius: 12, fontSize: 17, fontWeight: 600,
                  background: "linear-gradient(135deg, #8F7F6E, #A69888)", color: "#FFF",
                  border: "none", cursor: "pointer", transition: "all 0.3s ease",
                  boxShadow: "0 4px 16px rgba(143,127,110,0.25)",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}>
                开始诊断
              </button>
            </div>
          )}

          {/* ── Quiz Page ─────────────────────────────────────────── */}
          {page === "quiz" && q && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Progress bar */}
              <div style={{ ...cardStyle, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#A8A095", fontWeight: 500 }}>第 {currentQ + 1} / {questions.length} 题</span>
                  <span style={{ fontSize: 12, color: "#A8A095" }}>{Math.round(progress)}%</span>
                </div>
                <div style={{ height: 6, background: "#E8E4DE", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #94A8B8, #BFA8A0)", borderRadius: 3, transition: "width 0.4s ease" }} />
                </div>
              </div>

              {/* Question */}
              <div style={{ ...cardStyle, padding: "32px 24px", opacity: animating ? 0 : 1, transform: animating ? "translateX(-20px)" : "translateX(0)", transition: "all 0.3s ease" }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#3D3832", margin: "0 0 24px", lineHeight: 1.6 }}>
                  {q.text}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {q.options.map((opt, i) => (
                    <button key={i} onClick={() => handleAnswer(i)}
                      style={{
                        padding: "14px 18px", borderRadius: 12, textAlign: "left",
                        background: "#FFF", border: "1px solid #E9E5DE", cursor: "pointer",
                        fontSize: 14, color: "#4A453F", lineHeight: 1.5,
                        transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 10,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#8F7F6E"; e.currentTarget.style.background = "rgba(143,127,110,0.04)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E9E5DE"; e.currentTarget.style.background = "#FFF"; }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #ECE7E0, #E8E4DE)",
                        color: "#8F7F6E", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>{opt.label}</span>
                      <span>{opt.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Loading Page ──────────────────────────────────────── */}
          {page === "loading" && (
            <div style={{ ...cardStyle, textAlign: "center", padding: "80px 32px" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                border: "3px solid #E8E4DE", borderTopColor: "#8F7F6E",
                margin: "0 auto 24px", animation: "spin 1s linear infinite",
              }} />
              <p style={{ fontSize: 16, color: "#8B8378", margin: 0 }}>正在解析你的人格...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── Result Page ───────────────────────────────────────── */}
          {page === "result" && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Result header */}
              <div style={{
                ...cardStyle, textAlign: "center", padding: "36px 24px",
                background: `linear-gradient(135deg, ${result.color}18, ${result.color}08)`,
                border: `1px solid ${result.color}25`,
              }}>
                <div style={{ fontSize: 56, marginBottom: 8 }}>{result.emoji}</div>
                <div style={{
                  fontSize: 40, fontWeight: 800, color: result.color, letterSpacing: "0.1em",
                  marginBottom: 4, animation: "popIn 0.6s ease",
                }}>{result.code}</div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: "#3D3832", margin: "0 0 4px" }}>{result.name}</h3>
                <p style={{ fontSize: 14, color: "#8B8378", fontStyle: "italic", margin: 0 }}>{result.tagline}</p>
              </div>

              {/* Description */}
              <div style={cardStyle}>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: "0 0 12px" }}>人格描述</h4>
                <p style={{ fontSize: 14, color: "#5A554F", lineHeight: 1.7, margin: 0 }}>{result.description}</p>
                <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(143,127,110,0.06)", borderRadius: 10, borderLeft: "3px solid #8F7F6E" }}>
                  <p style={{ fontSize: 13, color: "#6B5E4F", fontStyle: "italic", margin: 0 }}>"{result.quote}"</p>
                </div>
              </div>

              {/* Dimensions */}
              <DimensionBars dimensions={dimensions} />

              {/* Powers */}
              <div style={cardStyle}>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Zap size={16} style={{ color: "#C9A87C" }} /> 超能力
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.powers.map((p, i) => (
                    <span key={i} style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(107,143,94,0.08)", color: "#6B8F5E", fontSize: 12, fontWeight: 500 }}>{p}</span>
                  ))}
                </div>
              </div>

              {/* Weaknesses */}
              <div style={cardStyle}>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Heart size={16} style={{ color: "#BFA8A0" }} /> 软肋
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {result.weaknesses.map((w, i) => (
                    <span key={i} style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(193,123,95,0.08)", color: "#8B5E3C", fontSize: 12, fontWeight: 500 }}>{w}</span>
                  ))}
                </div>
              </div>

              {/* Advice */}
              <div style={cardStyle}>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: "0 0 12px" }}>
                  {isTeacher ? "成长建议" : "学习建议"}
                </h4>
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                  {result.advice.map((a, i) => (
                    <li key={i} style={{ fontSize: 13, color: "#5A554F", lineHeight: 1.6 }}>{a}</li>
                  ))}
                </ul>
              </div>

              {/* Partners */}
              <div style={cardStyle}>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: "0 0 8px" }}>
                  {isTeacher ? "推荐搭档" : "推荐学习搭子"}
                </h4>
                <p style={{ fontSize: 13, color: "#8B8378", margin: 0 }}>{result.partners}</p>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={handleShare}
                  style={{ flex: 1, padding: "12px", borderRadius: 10, background: "linear-gradient(135deg, #8F7F6E, #A69888)", color: "#FFF", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Clipboard size={16} /> {copied ? "已复制" : "分享结果"}
                </button>
                <button onClick={handleRestart}
                  style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#FFF", color: "#8F7F6E", fontSize: 14, fontWeight: 600, border: "1px solid #D9D4CE", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <RotateCcw size={16} /> 再测一次
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes popIn { 0% { transform: scale(0); } 70% { transform: scale(1.1); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}

// ── Dimension Bars ─────────────────────────────────────────────────
function DimensionBars({ dimensions }: { dimensions: Record<string, number> }) {
  const pct = getDimensionPercentages(dimensions);
  const bars = [
    { key: "EI", label: "外向 E", rightLabel: "内向 I", leftPct: pct.EI.left, leftColor: "#94A8B8", rightColor: "#BFA8A0" },
    { key: "SN", label: "实感 S", rightLabel: "直觉 N", leftPct: pct.SN.left, leftColor: "#9AAF9E", rightColor: "#A8A0B0" },
    { key: "TF", label: "理性 T", rightLabel: "感性 F", leftPct: pct.TF.left, leftColor: "#8F7F6E", rightColor: "#C17B5F" },
    { key: "JP", label: "计划 J", rightLabel: "随性 P", leftPct: pct.JP.left, leftColor: "#B8A68A", rightColor: "#A0A8B0" },
  ];

  return (
    <div style={{ padding: 20, borderRadius: 16, background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(250,248,245,0.9))", boxShadow: "0 4px 20px rgba(61,56,50,0.06)", border: "1px solid rgba(233,229,222,0.8)" }}>
      <h4 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: "0 0 16px" }}>维度分析</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {bars.map(b => (
          <div key={b.key}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8B8378", marginBottom: 4 }}>
              <span>{b.label}</span>
              <span>{b.rightLabel}</span>
            </div>
            <div style={{ height: 10, background: "#E8E4DE", borderRadius: 5, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${b.leftPct}%`, background: b.leftColor, borderRadius: "5px 0 0 5px", transition: "width 0.8s ease" }} />
              <div style={{ width: `${100 - b.leftPct}%`, background: b.rightColor, borderRadius: "0 5px 5px 0", transition: "width 0.8s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#A8A095", marginTop: 2 }}>
              <span>{Math.round(b.leftPct)}%</span>
              <span>{Math.round(100 - b.leftPct)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
