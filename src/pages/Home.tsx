import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  GraduationCap, School, Calculator, BookOpen, Sparkles,
  ArrowRight, ChevronDown, CheckCircle2, TrendingUp,
  FileText, BarChart3
} from "lucide-react";
import { useScrollReveal, useCountUp } from "../hooks/useScrollReveal";

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════ */
const NAV_LINKS = [
  { label: "A-level 分数线", to: "/alevel" },
  { label: "GCSE 分数线", to: "/gcse" },
  { label: "等级预测", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
  { label: "A*率趋势", to: "/statistics" },
  { label: "人格测试", to: "/personality" },
];

/* ═══════════════════════════════════════════════════════════
   EXAM BOARD CARDS (FrontierVUE 3-card expand style)
   ═══════════════════════════════════════════════════════════ */
const EXAM_BOARDS = [
  {
    id: "caie",
    short: "CAIE",
    name: "Cambridge International",
    nameZh: "剑桥国际",
    color: "#8F7F6E",
    gradient: "linear-gradient(135deg, #8F7F6E 0%, #A69888 100%)",
    subjects: 180,
    papers: 620,
    levels: "IGCSE · A-Level",
    features: ["PUM 百分比统一评分", "A* 需总分 ≥90 + A2≥90", "支持跨考季合分"],
  },
  {
    id: "edexcel",
    short: "Edexcel",
    name: "Pearson Edexcel",
    nameZh: "培生爱德思",
    color: "#94A8B8",
    gradient: "linear-gradient(135deg, #5A7AA0 0%, #94A8B8 100%)",
    subjects: 80,
    papers: 340,
    levels: "IGCSE · A-Level · IAL",
    features: ["UMS 统一评分标准", "模块化考试可单独重考", "A* 需 A2 UMS ≥90%"],
  },
  {
    id: "aqa",
    short: "AQA",
    name: "Assessment and Qualifications Alliance",
    nameZh: "英国资格评估",
    color: "#9AAF9E",
    gradient: "linear-gradient(135deg, #6B8F5E 0%, #9AAF9E 100%)",
    subjects: 35,
    papers: 120,
    levels: "GCSE · A-Level",
    features: ["线性考试结构", "NEA 非考试评估", "规范的评分标准"],
  },
  {
    id: "ocr",
    short: "OCR",
    name: "Oxford, Cambridge and RSA",
    nameZh: "牛津剑桥RSA",
    color: "#BFA8A0",
    gradient: "linear-gradient(135deg, #A08078 0%, #BFA8A0 100%)",
    subjects: 45,
    papers: 166,
    levels: "GCSE · A-Level · FSMQ",
    features: ["H_serial_s 分层试卷", "多样化的评估方式", "数学类科目覆盖全"],
  },
];

/* ═══════════════════════════════════════════════════════════
   FEATURE CARDS
   ═══════════════════════════════════════════════════════════ */
const FEATURE_CARDS = [
  {
    title: "A-Level 分数线",
    desc: "8,000+ 条数据 · 四大考试局",
    detail: "A-Level 等级制（A*-E）分数线数据。覆盖 Edexcel、CAIE、AQA、OCR，数据跨度 2014-2026。",
    icon: GraduationCap,
    accent: "#94A8B8",
    to: "/alevel",
    stat: "8,000+",
    statLabel: "条分数线",
  },
  {
    title: "GCSE / IGCSE 分数线",
    desc: "640+ 条数据 · 四大考试局",
    detail: "9-1 等级制（或 A*-G）GCSE / IGCSE 分数线数据。覆盖数学、科学、英语等主流科目。",
    icon: School,
    accent: "#8F7F6E",
    to: "/gcse",
    stat: "640+",
    statLabel: "条分数线",
  },
  {
    title: "等级预测模拟器",
    desc: "跨考试局 · 跨年份 · 自由组合",
    detail: "为每张 Paper 选择考试年份并输入预估分数，系统根据历年 component 分数线累加计算，预测总成绩等级。",
    icon: Calculator,
    accent: "#9F8F7E",
    to: "/calculator",
    stat: "PUM / UMS",
    statLabel: "双算法",
  },
  {
    title: "刷题规划",
    desc: "智能排课 · 考试倒计时 · 导出",
    detail: "为 A-Level / GCSE 备考智能安排刷题计划。支持四大考试局，按周分配历年真题，考试倒计时提醒。",
    icon: BookOpen,
    accent: "#BFA8A0",
    to: "/planner",
    stat: "1,146",
    statLabel: "份试卷",
  },
  {
    title: "历年 A*率趋势",
    desc: "15+ 科目 · 2017-2025 · 多考试局",
    detail: "查看 CAIE、UK National 等考试局历年 A*率、A率、B率趋势。覆盖数学、进阶数学、物理、化学、生物等核心科目。",
    icon: BarChart3,
    accent: "#C75B2A",
    to: "/statistics",
    stat: "2017-2025",
    statLabel: "数据跨度",
  },
  {
    title: "A-Level 人格诊断",
    desc: "20题 · 4维分析 · 16种人格",
    detail: "测测你在 A-Level 圈子里到底是哪种生物？学生版20题学科场景，教师版20题教学场景，各自独立16种人格解读。",
    icon: Sparkles,
    accent: "#A8A0B0",
    to: "/personality",
    stat: "16",
    statLabel: "种人格",
  },
  {
    title: "分数线趋势图",
    desc: "Recharts 可视化 · 多年对比",
    detail: "查看分数线多年走势，直观了解 grade boundary 的变化趋势，为预估成绩提供数据支撑。",
    icon: TrendingUp,
    accent: "#B8A68A",
    to: "/charts",
    stat: "趋势",
    statLabel: "可视化",
  },
];

/* ═══════════════════════════════════════════════════════════
   HOW TO USE STEPS
   ═══════════════════════════════════════════════════════════ */
const STEPS = [
  {
    number: "01",
    title: "选择功能",
    desc: "从分数线查询、等级预测、刷题规划、人格测试中选择你需要的工具",
    icon: FileText,
  },
  {
    number: "02",
    title: "输入信息",
    desc: "选择考试局、科目、Paper 年份，输入预估分数或设置备考计划",
    icon: BarChart3,
  },
  {
    number: "03",
    title: "获取结果",
    desc: "即时查看预测等级、生成刷题计划、发现你的学习人格类型",
    icon: CheckCircle2,
  },
];

/* ═══════════════════════════════════════════════════════════
   UNIVERSITY MARQUEE
   ═══════════════════════════════════════════════════════════ */
const UNIVERSITIES = [
  "University of Cambridge",
  "Imperial College London",
  "London School of Economics",
  "University of Oxford",
  "University College London",
  "University of Warwick",
  "University of Edinburgh",
  "King's College London",
  "University of Manchester",
  "Durham University",
];

/* ═══════════════════════════════════════════════════════════
   STAT COMPONENT (Count-up)
   ═══════════════════════════════════════════════════════════ */
function StatItem({ end, suffix, label, delay }: { end: number; suffix: string; label: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useCountUp(ref, end, 2000);

  return (
    <div className={`stat-card scroll-reveal scroll-reveal-delay-${delay}`}>
      <div ref={ref} className="stat-number" data-suffix={suffix}>
        0{suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXAM BOARD CARD COMPONENT
   Click → navigate to board page. Hover → expand details.
   ═══════════════════════════════════════════════════════════ */
function ExamBoardCard({
  board,
}: {
  board: (typeof EXAM_BOARDS)[0];
}) {
  return (
    <Link
      to={`/alevel/${board.id}`}
      className="hero-board-card scroll-reveal"
      style={{
        padding: "28px 24px",
        display: "block",
        textDecoration: "none",
        color: "inherit",
        flex: "1",
        minWidth: 0,
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          height: 3,
          borderRadius: 2,
          background: board.gradient,
          marginBottom: 20,
          opacity: 0.8,
        }}
      />

      {/* Board short name */}
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: board.color,
          letterSpacing: "0.04em",
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {board.short}
      </div>

      {/* Chinese name */}
      <div
        style={{
          fontSize: 13,
          color: "#A8A095",
          fontWeight: 500,
          marginBottom: 4,
        }}
      >
        {board.nameZh}
      </div>

      {/* Levels */}
      <div
        style={{
          fontSize: 11,
          color: "#C4BDB3",
          letterSpacing: "0.05em",
          marginBottom: 16,
        }}
      >
        {board.levels}
      </div>

      {/* Hover-expandable details */}
      <div className="card-details">
        <div
          style={{
            borderTop: "1px solid #E8E4DE",
            paddingTop: 16,
            marginTop: 8,
          }}
        >
          {/* Quick stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: board.color,
                }}
              >
                {board.subjects}+
              </div>
              <div style={{ fontSize: 11, color: "#A8A095" }}>科目</div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: board.color,
                }}
              >
                {board.papers}+
              </div>
              <div style={{ fontSize: 11, color: "#A8A095" }}>试卷</div>
            </div>
          </div>

          {/* Features */}
          {board.features.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 8,
                fontSize: 12,
                color: "#8B8378",
                lineHeight: 1.5,
              }}
            >
              <CheckCircle2
                size={14}
                style={{
                  color: board.color,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
              {f}
            </div>
          ))}

          {/* CTA hint */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
              fontSize: 12,
              fontWeight: 600,
              color: board.color,
              padding: "8px 16px",
              borderRadius: 8,
              background: `${board.color}10`,
              border: `1px solid ${board.color}25`,
            }}
          >
            查看 A-Level 分数线
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN HOME COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Home() {
  useScrollReveal();

  // No active board state - cards are always visible, hover expands details
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for nav glass effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)",
      }}
    >
      <Header title="" links={NAV_LINKS} scrolled={scrolled} />

      <main style={{ flex: 1 }}>
        {/* ══════════════════════════════════════════════════
            HERO SECTION
            ══════════════════════════════════════════════════ */}
        <section
          style={{
            padding: "80px 16px 48px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle background decoration */}
          <div
            style={{
              position: "absolute",
              top: "10%",
              right: "5%",
              width: 300,
              height: 300,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(184,166,138,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              maxWidth: 900,
              margin: "0 auto",
              textAlign: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
            {/* Label */}
            <p
              className="text-reveal text-reveal-delay-1"
              style={{
                fontSize: 13,
                color: "#B8A68A",
                margin: "0 0 16px",
                fontWeight: 600,
                letterSpacing: "0.12em",
              }}
            >
              GRADEMASTER 备考管家
            </p>

            {/* Main headline */}
            <h1
              style={{
                fontSize: "clamp(32px, 6vw, 56px)",
                fontWeight: 800,
                margin: "0 0 8px",
                letterSpacing: "0.02em",
                lineHeight: 1.15,
                color: "#3D3832",
              }}
            >
              <span className="text-reveal text-reveal-delay-2">
                你的私人
              </span>{" "}
              <span
                className="text-reveal text-reveal-delay-3 morandi-gradient-text"
              >
                A-Level
              </span>{" "}
              <span className="text-reveal text-reveal-delay-4">
                备考管家
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="animate-fade-in-up"
              style={{
                fontSize: 16,
                color: "#8B8378",
                lineHeight: 1.8,
                marginTop: 24,
                opacity: 0,
                animationDelay: "0.5s",
                maxWidth: 560,
                margin: "24px auto 0",
              }}
            >
              查分数线 · 算预估分 · 排刷题表 · 测学习人格
              <br />
              覆盖 CAIE / Edexcel / AQA / OCR 四大考试局
            </p>

            {/* Scroll indicator */}
            <div
              className="animate-fade-in"
              style={{
                marginTop: 40,
                opacity: 0,
                animationDelay: "0.8s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, color: "#C4BDB3", letterSpacing: "0.1em" }}>
                向下滚动探索
              </span>
              <ChevronDown
                size={20}
                style={{ color: "#C4BDB3", animation: "float 2s ease-in-out infinite" }}
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            EXAM BOARD CARDS (4-card expandable)
            ══════════════════════════════════════════════════ */}
        <section style={{ padding: "0 16px 56px" }}>
          <div
            style={{
              maxWidth: 1000,
              margin: "0 auto",
              display: "flex",
              gap: 16,
            }}
          >
            {EXAM_BOARDS.map((board) => (
              <ExamBoardCard key={board.id} board={board} />
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            STATS BAR (Count-up numbers)
            ══════════════════════════════════════════════════ */}
        <section
          style={{
            padding: "40px 16px",
            borderTop: "1px solid #E8E4DE",
            borderBottom: "1px solid #E8E4DE",
          }}
        >
          <div
            style={{
              maxWidth: 800,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
            }}
          >
            <StatItem end={10000} suffix="+" label="条分数线" delay={1} />
            <StatItem end={307} suffix="" label="个科目" delay={2} />
            <StatItem end={1146} suffix="" label="份试卷" delay={3} />
            <StatItem end={4} suffix="" label="大考试局" delay={4} />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            FEATURE CARDS (6-card grid with scroll reveal)
            ══════════════════════════════════════════════════ */}
        <section style={{ padding: "56px 16px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {/* Section header */}
            <div
              className="scroll-reveal"
              style={{ textAlign: "center", marginBottom: 40 }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: "#B8A68A",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  margin: "0 0 12px",
                }}
              >
                核心功能
              </p>
              <h2
                style={{
                  fontSize: "clamp(24px, 4vw, 36px)",
                  fontWeight: 700,
                  color: "#3D3832",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                备考路上，你需要的一切
              </h2>
            </div>

            {/* Cards grid */}
            <div
              className="scroll-stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 20,
              }}
            >
              {FEATURE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="scroll-reveal glass-card"
                    style={{ padding: 28, display: "flex", flexDirection: "column" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: `linear-gradient(135deg, ${card.accent}18, ${card.accent}08)`,
                          border: `1px solid ${card.accent}25`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon size={18} style={{ color: card.accent }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#3D3832",
                            margin: 0,
                          }}
                        >
                          {card.title}
                        </h3>
                        <p
                          style={{
                            fontSize: 11,
                            color: "#A8A095",
                            margin: "2px 0 0",
                          }}
                        >
                          {card.desc}
                        </p>
                      </div>
                      {/* Stat badge */}
                      <div
                        style={{
                          textAlign: "right",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: card.accent,
                            lineHeight: 1,
                          }}
                        >
                          {card.stat}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#C4BDB3",
                            marginTop: 2,
                          }}
                        >
                          {card.statLabel}
                        </div>
                      </div>
                    </div>

                    <p
                      style={{
                        fontSize: 12,
                        color: "#8B8378",
                        lineHeight: 1.6,
                        marginTop: 10,
                        flex: 1,
                      }}
                    >
                      {card.detail}
                    </p>

                    <Link
                      to={card.to}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 16,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#FFF",
                        textDecoration: "none",
                        padding: "10px 16px",
                        borderRadius: 8,
                        background: card.accent,
                        transition: "all 0.3s ease",
                        alignSelf: "flex-start",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.opacity = "0.85";
                        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.opacity = "1";
                        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      }}
                    >
                      开始使用
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            HOW TO USE STEPS (01→02→03 flow)
            ══════════════════════════════════════════════════ */}
        <section
          style={{
            padding: "56px 16px",
            background: "linear-gradient(180deg, #FAF8F5 0%, #F5F2EE 100%)",
            borderTop: "1px solid #E8E4DE",
            borderBottom: "1px solid #E8E4DE",
          }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {/* Section header */}
            <div className="scroll-reveal" style={{ marginBottom: 48 }}>
              <p
                style={{
                  fontSize: 12,
                  color: "#B8A68A",
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  margin: "0 0 12px",
                }}
              >
                使用流程
              </p>
              <h2
                style={{
                  fontSize: "clamp(24px, 4vw, 36px)",
                  fontWeight: 700,
                  color: "#3D3832",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                三步开始备考
              </h2>
            </div>

            {/* Steps */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 32,
                position: "relative",
              }}
            >
              {/* Connector line */}
              <div
                style={{
                  position: "absolute",
                  top: 24,
                  left: "16%",
                  right: "16%",
                  height: 2,
                  background:
                    "linear-gradient(90deg, #D9D4CE 0%, #B8A68A 50%, #D9D4CE 100%)",
                  zIndex: 0,
                }}
              />

              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.number}
                    className={`scroll-reveal scroll-reveal-delay-${idx + 1}`}
                    style={{
                      textAlign: "center",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {/* Step number circle */}
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, #A69888 0%, #B8A68A 100%)`,
                        color: "white",
                        fontSize: 18,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 20px",
                        boxShadow: "0 4px 16px rgba(166,152,136,0.3)",
                      }}
                    >
                      {step.number}
                    </div>

                    {/* Icon */}
                    <div
                      style={{
                        marginBottom: 12,
                      }}
                    >
                      <Icon
                        size={24}
                        style={{ color: "#A69888" }}
                      />
                    </div>

                    {/* Title */}
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#3D3832",
                        margin: "0 0 8px",
                      }}
                    >
                      {step.title}
                    </h3>

                    {/* Description */}
                    <p
                      style={{
                        fontSize: 13,
                        color: "#8B8378",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            DARK SECTION - DATA COVERAGE
            ══════════════════════════════════════════════════ */}
        <section
          className="section-dark"
          style={{ padding: "64px 16px" }}
        >
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {/* Section header */}
            <div className="scroll-reveal" style={{ marginBottom: 40 }}>
              <p className="section-label" style={{ margin: "0 0 12px" }}>
                数据覆盖
              </p>
              <h2
                style={{
                  fontSize: "clamp(24px, 4vw, 36px)",
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.2,
                  color: "#F0EDE8",
                }}
              >
                覆盖四大考试局全部核心数据
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#A8A095",
                  marginTop: 12,
                  lineHeight: 1.6,
                }}
              >
                分数线数据跨度 2014-2026，持续更新最新考季
              </p>
            </div>

            {/* Coverage grid */}
            <div
              className="scroll-stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
              }}
            >
              {[
                {
                  label: "CAIE A-Level",
                  value: "100+ 科目",
                  desc: "9709数学 · 9231进阶数学 · 9700生物 · 9701化学 · 9702物理等",
                },
                {
                  label: "CAIE IGCSE",
                  value: "50+ 科目",
                  desc: "0580数学 · 0606附加数学 · 0620化学 · 0610生物等",
                },
                {
                  label: "Edexcel A-Level / IAL",
                  value: "80+ 科目",
                  desc: "WMA数学 · WFM进阶数学 · WME力学 · WST统计等",
                },
                {
                  label: "Edexcel / AQA / OCR GCSE",
                  value: "70+ 科目",
                  desc: "4MA1数学 · 1MA1数学 · 8365进阶数学 · 6993 FSMQ等",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="scroll-reveal"
                  style={{
                    padding: 24,
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.06)",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgba(201,165,90,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "rgba(255,255,255,0.06)";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#E8E4DE",
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#c9a55a",
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#8B8378",
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            UNIVERSITY MARQUEE
            ══════════════════════════════════════════════════ */}
        <section
          style={{
            padding: "32px 0",
            borderBottom: "1px solid #E8E4DE",
            overflow: "hidden",
          }}
        >
          <div className="scroll-reveal">
            <p
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "#C4BDB3",
                letterSpacing: "0.15em",
                margin: "0 0 16px",
                fontWeight: 500,
              }}
            >
              服务全球 A-Level 学子，目标直指 G5 与罗素集团名校
            </p>
            <div style={{ overflow: "hidden" }}>
              <div className="marquee-track">
                {[...UNIVERSITIES, ...UNIVERSITIES].map((uni, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "0 40px",
                      fontSize: 14,
                      color: "#A8A095",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {uni}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            CTA SECTION
            ══════════════════════════════════════════════════ */}
        <section style={{ padding: "56px 16px" }}>
          <div
            className="scroll-reveal"
            style={{
              maxWidth: 700,
              margin: "0 auto",
              textAlign: "center",
              padding: "48px 32px",
              background: "linear-gradient(135deg, #FAF8F5 0%, #F5F2EE 100%)",
              borderRadius: 20,
              border: "1px solid #E8E4DE",
            }}
          >
            <h2
              style={{
                fontSize: "clamp(22px, 4vw, 32px)",
                fontWeight: 700,
                color: "#3D3832",
                margin: "0 0 12px",
              }}
            >
              开始你的备考之旅
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "#8B8378",
                margin: "0 0 28px",
                lineHeight: 1.6,
              }}
            >
              所有功能完全免费，无需注册，即刻使用
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link
                to="/alevel"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 24px",
                  borderRadius: 10,
                  background:
                    "linear-gradient(135deg, #8F7F6E 0%, #A69888 100%)",
                  color: "#FFF",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  transition: "all 0.3s ease",
                  boxShadow: "0 4px 16px rgba(143,127,110,0.25)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 6px 24px rgba(143,127,110,0.35)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 4px 16px rgba(143,127,110,0.25)";
                }}
              >
                查询分数线
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/calculator"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 24px",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#8F7F6E",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  border: "1.5px solid #D9D4CE",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "#A69888";
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(166,152,136,0.05)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "#D9D4CE";
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
                }}
              >
                等级预测
                <Calculator size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
