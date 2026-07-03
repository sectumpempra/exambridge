import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  GraduationCap, Calculator, BookOpen, Sparkles,
  ArrowRight, ChevronDown, CheckCircle2,
  FileText, BarChart3, GitCompareArrows, FunctionSquare,
} from "lucide-react";
import { useScrollReveal, useCountUp } from "../hooks/useScrollReveal";

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════════════════ */
const NAV_LINKS = [
  { label: "A-level 分数线", to: "/alevel" },
  { label: "Paper 查询", to: "/papers" },
  { label: "GCSE 分数线", to: "/gcse" },
  { label: "等级预测", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
  { label: "A*率趋势", to: "/statistics" },
  { label: "人格测试", to: "/personality" },
];

/* ═══════════════════════════════════════════════════════════
   EXAM BOARDS
   ═══════════════════════════════════════════════════════════ */
const EXAM_BOARDS = [
  {
    id: "caie", short: "CAIE", nameZh: "剑桥国际", color: "#8F7F6E",
    gradient: "linear-gradient(135deg, #8F7F6E 0%, #A69888 100%)",
    subjects: 180, papers: 620, levels: "IGCSE · A-Level",
    features: ["PUM 百分比统一评分", "A* 需总分 ≥90 + A2≥90", "支持跨考季合分"],
  },
  {
    id: "edexcel", short: "Edexcel", nameZh: "培生爱德思", color: "#94A8B8",
    gradient: "linear-gradient(135deg, #5A7AA0 0%, #94A8B8 100%)",
    subjects: 80, papers: 340, levels: "IGCSE · A-Level · IAL",
    features: ["UMS 统一评分标准", "模块化考试可单独重考", "A* 需 A2 UMS ≥90%"],
  },
  {
    id: "aqa", short: "AQA", nameZh: "英国资格评估", color: "#9AAF9E",
    gradient: "linear-gradient(135deg, #6B8F5E 0%, #9AAF9E 100%)",
    subjects: 35, papers: 120, levels: "GCSE · A-Level",
    features: ["线性考试结构", "NEA 非考试评估", "规范的评分标准"],
  },
  {
    id: "ocr", short: "OCR", nameZh: "牛津剑桥RSA", color: "#BFA8A0",
    gradient: "linear-gradient(135deg, #A08078 0%, #BFA8A0 100%)",
    subjects: 45, papers: 166, levels: "GCSE · A-Level · FSMQ",
    features: ["分层试卷 (H/F 系列)", "多样化的评估方式", "数学类科目覆盖全"],
  },
  {
    id: "wjec", short: "WJEC/Eduqas", nameZh: "威尔士/英格兰资格", color: "#7B8FA0",
    gradient: "linear-gradient(135deg, #5A7080 0%, #7B8FA0 100%)",
    subjects: 71, papers: 439, levels: "GCSE · A-Level",
    features: ["威尔士主要考试局", "英格兰分校 Eduqas", "艺术人文科目见长"],
  },
];

/* ═══════════════════════════════════════════════════════════
   CORE FEATURE CARDS (4 primary + 4 secondary)
   ═══════════════════════════════════════════════════════════ */
const CORE_FEATURES = [
  {
    title: "分数线查询", desc: "8,000+ 条数据 · 五大考试局",
    detail: "A-Level 等级制（A*-E）和 GCSE 9-1 分数线，覆盖 Edexcel、CAIE、AQA、OCR、WJEC，数据跨度 2014-2026。",
    icon: GraduationCap, accent: "#94A8B8", to: "/alevel", colSpan: 1,
  },
  {
    title: "等级预测模拟器", desc: "跨考试局 · 跨年份 · 自由组合",
    detail: "为每张 Paper 选择考试年份并输入预估分数，系统根据历年 component 分数线累加计算，预测总成绩等级。",
    icon: Calculator, accent: "#9F8F7E", to: "/calculator", colSpan: 1,
  },
  {
    title: "Paper 考纲对比", desc: "跨考试局 · 考纲重合度分析",
    detail: "选择两份 Paper，查看考纲重合度与差异。支持跨考试局同科目对比和向下扩科分析。",
    icon: GitCompareArrows, accent: "#5A7A5E", to: "/papers", colSpan: 1,
  },
  {
    title: "刷题规划", desc: "智能排课 · 考试倒计时 · 导出",
    detail: "为 A-Level / GCSE 备考智能安排刷题计划。支持五大考试局，按周分配历年真题，考试倒计时提醒。",
    icon: BookOpen, accent: "#BFA8A0", to: "/planner", colSpan: 1,
  },
];

const SECONDARY_FEATURES = [
  { title: "历年 A*率趋势", desc: "15+ 科目 · 2017-2025", icon: BarChart3, accent: "#C75B2A", to: "/statistics" },
  { title: "函数画图", desc: "函数绘图 · 参数滑块 · 导出分享", icon: FunctionSquare, accent: "#7B6EA5", to: "/graph" },
  { title: "人格诊断", desc: "20题 · 4维分析 · 16种人格", icon: Sparkles, accent: "#A8A0B0", to: "/personality" },
];

/* ═══════════════════════════════════════════════════════════
   STEPS
   ═══════════════════════════════════════════════════════════ */
const STEPS = [
  { number: "01", title: "选择功能", desc: "从分数线查询、等级预测、刷题规划、考纲对比中选择你需要的工具", icon: FileText },
  { number: "02", title: "输入信息", desc: "选择考试局、科目、Paper 年份，输入预估分数或设置备考计划", icon: BarChart3 },
  { number: "03", title: "获取结果", desc: "即时查看预测等级、生成刷题计划、对比考纲差异", icon: CheckCircle2 },
];

/* ═══════════════════════════════════════════════════════════
   STAT COMPONENT (Count-up)
   ═══════════════════════════════════════════════════════════ */
function StatItem({ end, suffix, label, delay }: { end: number; suffix: string; label: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useCountUp(ref, end, 2000);

  return (
    <div className={cn("stat-card scroll-reveal", `scroll-reveal-delay-${delay}`)}>
      <div ref={ref} className="stat-number" data-suffix={suffix}>
        0{suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXAM BOARD CARD
   ═══════════════════════════════════════════════════════════ */
function ExamBoardCard({ board }: { board: (typeof EXAM_BOARDS)[0] }) {
  return (
    <Link
      to={`/alevel/${board.id}`}
      className="hero-board-card scroll-reveal block flex-1 min-w-0 no-underline text-inherit"
      style={{ padding: "32px 28px" }}
    >
      <div style={{ height: 3, borderRadius: 2, background: board.gradient, marginBottom: 20, opacity: 0.8 }} />
      <div style={{ fontSize: 32, fontWeight: 800, color: board.color, letterSpacing: "0.04em", lineHeight: 1, marginBottom: 6 }}>
        {board.short}
      </div>
      <div style={{ fontSize: 13, color: "#A8A095", fontWeight: 500, marginBottom: 4 }}>{board.nameZh}</div>
      <div style={{ fontSize: 11, color: "#C4BDB3", letterSpacing: "0.05em", marginBottom: 16 }}>{board.levels}</div>

      <div className="card-details">
        <div style={{ borderTop: "1px solid #E8E4DE", paddingTop: 16, marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: board.color }}>{board.subjects}+</div>
              <div style={{ fontSize: 11, color: "#A8A095" }}>科目</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: board.color }}>{board.papers}+</div>
              <div style={{ fontSize: 11, color: "#A8A095" }}>试卷</div>
            </div>
          </div>
          {board.features.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: 12, color: "#8B8378", lineHeight: 1.5 }}>
              <CheckCircle2 size={14} style={{ color: board.color, flexShrink: 0, marginTop: 1 }} />
              {f}
            </div>
          ))}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, fontWeight: 600, color: board.color, padding: "8px 16px", borderRadius: 8, background: `${board.color}10`, border: `1px solid ${board.color}25` }}>
            查看 A-Level 分数线 <ArrowRight size={14} />
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title="" links={NAV_LINKS} scrolled={scrolled} />

      <main className="flex-1">
        {/* ════════════════════════════════════════════════
            HERO SECTION
            ════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden px-4 pt-20 pb-12 md:pt-24 md:pb-16">
          {/* Background decoration */}
          <div className="pointer-events-none absolute top-[10%] right-[5%] h-[300px] w-[300px] rounded-full" style={{ background: "radial-gradient(circle, rgba(184,166,138,0.08) 0%, transparent 70%)" }} />

          <div className="relative z-10 mx-auto max-w-[900px] text-center">
            {/* Label */}
            <p className="text-reveal text-reveal-delay-1 mb-4 text-[13px] font-semibold tracking-[0.12em]" style={{ color: "#B8A68A" }}>
              GRADEMASTER 备考管家
            </p>

            {/* Main headline */}
            <h1 className="text-[clamp(32px,6vw,56px)] font-extrabold leading-[1.15] tracking-[0.02em]" style={{ color: "#3D3832" }}>
              <span className="text-reveal text-reveal-delay-2">你的私人</span>{" "}
              <span className="text-reveal text-reveal-delay-3 morandi-gradient-text">A-Level</span>{" "}
              <span className="text-reveal text-reveal-delay-4">备考管家</span>
            </h1>

            {/* Subtitle */}
            <p className="animate-fade-in-up mx-auto mt-6 max-w-[560px] text-base leading-[1.8] opacity-0" style={{ color: "#8B8378", animationDelay: "0.5s" }}>
              查分数线 · 算预估分 · 排刷题表 · 对比考纲 · 测学习人格
              <br />
              覆盖 CAIE / Edexcel / AQA / OCR / WJEC-Eduqas 五大考试局
            </p>

            {/* CTA Buttons */}
            <div className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-4 opacity-0" style={{ animationDelay: "0.7s" }}>
              <Button asChild size="lg" className="h-12 gap-2 rounded-xl bg-gradient-to-br from-[#8F7F6E] to-[#A69888] px-8 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110">
                <Link to="/papers">
                  <GitCompareArrows size={16} />
                  Paper 考纲对比
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 gap-2 rounded-xl border-[#D9D4CE] bg-white/80 px-8 text-sm font-semibold text-[#8B8378] backdrop-blur-sm transition-all hover:border-[#A69888] hover:text-[#8F7F6E]">
                <Link to="/alevel">
                  <GraduationCap size={16} />
                  查分数线
                </Link>
              </Button>
            </div>

            {/* Scroll indicator */}
            <div className="animate-fade-in mt-10 flex flex-col items-center gap-2 opacity-0" style={{ animationDelay: "0.9s" }}>
              <span className="text-[11px] tracking-[0.1em]" style={{ color: "#C4BDB3" }}>向下滚动探索</span>
              <ChevronDown size={20} style={{ color: "#C4BDB3", animation: "float 2s ease-in-out infinite" }} />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            EXAM BOARD CARDS
            ════════════════════════════════════════════════ */}
        <section className="px-4 pb-14">
          <div className="mx-auto flex max-w-[1000px] gap-4">
            {EXAM_BOARDS.map((board) => (
              <ExamBoardCard key={board.id} board={board} />
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            STATS BAR
            ════════════════════════════════════════════════ */}
        <section className="border-y border-[#E8E4DE] px-4 py-10">
          <div className="mx-auto grid max-w-[800px] grid-cols-2 gap-4 md:grid-cols-4">
            <StatItem end={10000} suffix="+" label="条分数线" delay={1} />
            <StatItem end={560} suffix="" label="个科目" delay={2} />
            <StatItem end={1146} suffix="" label="份试卷" delay={3} />
            <StatItem end={5} suffix="" label="大考试局" delay={4} />
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            CORE FEATURES (4-card grid)
            ════════════════════════════════════════════════ */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-[900px]">
            {/* Section header */}
            <div className="scroll-reveal mb-10 text-center">
              <p className="mb-3 text-xs font-semibold tracking-[0.15em]" style={{ color: "#B8A68A" }}>核心功能</p>
              <h2 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.2]" style={{ color: "#3D3832" }}>
                备考路上，你需要的一切
              </h2>
            </div>

            {/* 4-card grid */}
            <div className="scroll-stagger grid grid-cols-1 gap-5 sm:grid-cols-2">
              {CORE_FEATURES.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="scroll-reveal glass-card flex flex-col p-7">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" style={{ background: `linear-gradient(135deg, ${card.accent}18, ${card.accent}08)`, borderColor: `${card.accent}25` }}>
                        <Icon size={18} style={{ color: card.accent }} />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-bold" style={{ color: "#3D3832" }}>{card.title}</h3>
                        <p className="mt-0.5 text-[11px]" style={{ color: "#A8A095" }}>{card.desc}</p>
                      </div>
                    </div>
                    <p className="flex-1 text-xs leading-relaxed" style={{ color: "#8B8378" }}>{card.detail}</p>
                    <Button asChild size="sm" className="mt-5 gap-1.5 self-start rounded-lg border-0 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-md hover:brightness-110" style={{ background: card.accent }}>
                      <Link to={card.to}>
                        开始使用 <ArrowRight size={12} />
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Secondary features */}
            <div className="scroll-stagger mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {SECONDARY_FEATURES.map((card) => {
                const Icon = card.icon;
                return (
                  <Link key={card.title} to={card.to} className="scroll-reveal group flex items-center gap-3 rounded-xl border border-[#E8E4DE] bg-white/70 p-4 no-underline transition-all hover:border-[#A69888]/30 hover:bg-white hover:shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-transform group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${card.accent}12, ${card.accent}06)`, borderColor: `${card.accent}20` }}>
                      <Icon size={16} style={{ color: card.accent }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold transition-colors group-hover:text-[#8F7F6E]" style={{ color: "#3D3832" }}>{card.title}</h4>
                      <p className="text-[11px]" style={{ color: "#A8A095" }}>{card.desc}</p>
                    </div>
                    <ArrowRight size={14} className="ml-auto shrink-0 text-[#C4BDB3] transition-all group-hover:translate-x-1 group-hover:text-[#A69888]" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            HOW TO USE STEPS
            ════════════════════════════════════════════════ */}
        <section className="border-y border-[#E8E4DE] px-4 py-14" style={{ background: "linear-gradient(180deg, #FAF8F5 0%, #F5F2EE 100%)" }}>
          <div className="mx-auto max-w-[800px]">
            <div className="scroll-reveal mb-12">
              <p className="mb-3 text-xs font-semibold tracking-[0.15em]" style={{ color: "#B8A68A" }}>使用流程</p>
              <h2 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.2]" style={{ color: "#3D3832" }}>三步开始备考</h2>
            </div>

            <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Connector line (desktop only) */}
              <div className="pointer-events-none absolute top-6 left-[16%] right-[16%] hidden h-0.5 md:block" style={{ background: "linear-gradient(90deg, #D9D4CE 0%, #B8A68A 50%, #D9D4CE 100%)" }} />

              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div key={step.number} className={cn("scroll-reveal relative z-10 text-center", `scroll-reveal-delay-${idx + 1}`)}>
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg" style={{ background: "linear-gradient(135deg, #A69888 0%, #B8A68A 100%)" }}>
                      {step.number}
                    </div>
                    <Icon size={24} className="mx-auto mb-3" style={{ color: "#A69888" }} />
                    <h3 className="mb-2 text-base font-bold" style={{ color: "#3D3832" }}>{step.title}</h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: "#8B8378" }}>{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            DARK SECTION - DATA COVERAGE
            ════════════════════════════════════════════════ */}
        <section className="section-dark px-4 py-16">
          <div className="mx-auto max-w-[800px]">
            <div className="scroll-reveal mb-10">
              <p className="section-label mb-3">数据覆盖</p>
              <h2 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.2]" style={{ color: "#F0EDE8" }}>
                覆盖五大考试局全部核心数据
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#A8A095" }}>
                分数线数据跨度 2014-2026，持续更新最新考季
              </p>
            </div>

            <div className="scroll-stagger grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: "CAIE A-Level", value: "100+ 科目", desc: "9709数学 · 9231进阶数学 · 9700生物 · 9701化学 · 9702物理等" },
                { label: "CAIE IGCSE", value: "50+ 科目", desc: "0580数学 · 0606附加数学 · 0620化学 · 0610生物等" },
                { label: "Edexcel A-Level / IAL", value: "80+ 科目", desc: "WMA数学 · WFM进阶数学 · WME力学 · WST统计等" },
                { label: "Edexcel / AQA / OCR GCSE", value: "70+ 科目", desc: "4MA1数学 · 1MA1数学 · 8365进阶数学 · 6993 FSMQ等" },
              ].map((item) => (
                <div key={item.label} className="scroll-reveal rounded-xl border border-white/[0.06] bg-white/[0.04] p-6 transition-all hover:border-[rgba(201,165,90,0.2)] hover:bg-white/[0.08]">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: "#E8E4DE" }}>{item.label}</span>
                    <span className="text-sm font-bold" style={{ color: "#C9A55A" }}>{item.value}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "#7A756F" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            UNIVERSITY MARQUEE
            ════════════════════════════════════════════════ */}
        <section className="overflow-hidden border-t border-[#E8E4DE] py-10">
          <div className="relative">
            <div className="marquee-track flex items-center gap-16 whitespace-nowrap">
              {[...Array(2)].map((_, dup) => (
                <div key={dup} className="flex items-center gap-16">
                  {["University of Cambridge", "Imperial College London", "London School of Economics", "University of Oxford", "University College London", "University of Warwick", "University of Edinburgh", "King's College London", "University of Manchester", "Durham University"].map((u) => (
                    <span key={`${dup}-${u}`} className="text-sm font-medium" style={{ color: "#C4BDB3" }}>{u}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
