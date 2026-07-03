import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  GraduationCap, Calculator, BookOpen, Sparkles,
  ArrowRight, ChevronDown, CheckCircle2,
  BarChart3, GitCompareArrows, FunctionSquare,
  Search,
} from "lucide-react";
import { useScrollReveal, useCountUp } from "../hooks/useScrollReveal";
import { NAV_LINKS } from "@/data/navLinks";

// Add personality link for Home page only
const HOME_NAV_LINKS = [...NAV_LINKS, { label: "人格测试", to: "/personality" }];

/* ═══════════════════════════════════════════════════════════
   EXAM BOARDS (teacher perspective, features trimmed to 2)
   ═══════════════════════════════════════════════════════════ */
const EXAM_BOARDS = [
  {
    id: "caie", short: "CAIE", nameZh: "剑桥国际", color: "#8F7F6E",
    gradient: "linear-gradient(135deg, #8F7F6E 0%, #A69888 100%)",
    subjects: 180, papers: 620, levels: "IGCSE · A-Level",
    features: ["PUM 统一评分", "A* 需总分 ≥90 + A2≥90"],
  },
  {
    id: "edexcel", short: "Edexcel", nameZh: "培生爱德思", color: "#94A8B8",
    gradient: "linear-gradient(135deg, #5A7AA0 0%, #94A8B8 100%)",
    subjects: 80, papers: 340, levels: "IGCSE · A-Level · IAL",
    features: ["UMS 统一评分标准", "模块化可单独重考"],
  },
  {
    id: "aqa", short: "AQA", nameZh: "英国资格评估", color: "#9AAF9E",
    gradient: "linear-gradient(135deg, #6B8F5E 0%, #9AAF9E 100%)",
    subjects: 35, papers: 120, levels: "GCSE · A-Level",
    features: ["线性考试结构", "NEA 非考试评估"],
  },
  {
    id: "ocr", short: "OCR", nameZh: "牛津剑桥RSA", color: "#BFA8A0",
    gradient: "linear-gradient(135deg, #A08078 0%, #BFA8A0 100%)",
    subjects: 45, papers: 166, levels: "GCSE · A-Level · FSMQ",
    features: ["分层试卷 H/F", "数学类科目覆盖全"],
  },
  {
    id: "wjec", short: "WJEC/Eduqas", nameZh: "威尔士/英格兰资格", color: "#7B8FA0",
    gradient: "linear-gradient(135deg, #5A7080 0%, #7B8FA0 100%)",
    subjects: 71, papers: 439, levels: "GCSE · A-Level",
    features: ["威尔士主考局全科数据", "艺术人文科目见长"],
  },
];

/* ═══════════════════════════════════════════════════════════
   HOT EXPANSION PATHS
   ═══════════════════════════════════════════════════════════ */
const EXPANSION_PATHS = [
  {
    from: { board: "CAIE", level: "A-Level", subject: "9709 数学", color: "#8F7F6E" },
    to: { board: "CAIE", level: "IGCSE", subject: "0580 数学", color: "#8F7F6E" },
    reason: "A-Level 数学教师快速掌握 IGCSE 数学基础内容",
  },
  {
    from: { board: "CAIE", level: "A-Level", subject: "9702 物理", color: "#8F7F6E" },
    to: { board: "Edexcel", level: "A-Level", subject: "WPH01 物理", color: "#94A8B8" },
    reason: "CAIE 物理教师拓展 Edexcel 物理教学",
  },
  {
    from: { board: "CAIE", level: "A-Level", subject: "9701 化学", color: "#8F7F6E" },
    to: { board: "AQA", level: "A-Level", subject: "7405 化学", color: "#9AAF9E" },
    reason: "化学教师跨考试局对比 AQA 与 CAIE 考纲差异",
  },
  {
    from: { board: "CAIE", level: "IGCSE", subject: "0610 生物", color: "#8F7F6E" },
    to: { board: "Edexcel", level: "IGCSE", subject: "4BI1 生物", color: "#94A8B8" },
    reason: "IGCSE 生物教师拓展 Edexcel 生物教学",
  },
];

/* ═══════════════════════════════════════════════════════════
   CORE FEATURE CARDS (teacher priority order)
   ═══════════════════════════════════════════════════════════ */
const CORE_FEATURES = [
  {
    title: "跨考试局考纲对比", desc: "同科目跨局对比 · 重合度分析",
    detail: "选择两个考试局的同类型科目或上下级科目，查看考纲重合度、差异知识点和试卷结构。",
    icon: GitCompareArrows, accent: "#5A7A5E", to: "/papers", colSpan: 1,
  },
  {
    title: "分数线对比查询", desc: "8,000+ 条数据 · 五大考试局",
    detail: "按科目、年份、考季对比不同考试局的分数线，快速定位难度差异。",
    icon: GraduationCap, accent: "#94A8B8", to: "/alevel", colSpan: 1,
  },
  {
    title: "A*率趋势分析", desc: "15+ 科目 · 2017-2025",
    detail: "按考试局、科目查看历年 A*率变化，帮助教师判断评分松紧与难度趋势。",
    icon: BarChart3, accent: "#C75B2A", to: "/statistics", colSpan: 1,
  },
  {
    title: "刷题规划", desc: "智能排课 · 考试倒计时 · 导出",
    detail: "为 A-Level / GCSE 备考智能安排刷题计划。支持五大考试局，按周分配历年真题。",
    icon: BookOpen, accent: "#BFA8A0", to: "/planner", colSpan: 1,
  },
];

const SECONDARY_FEATURES = [
  { title: "函数画图", desc: "函数绘图 · 参数滑块 · 导出分享", icon: FunctionSquare, accent: "#7B6EA5", to: "/graph" },
  { title: "等级预测模拟器", desc: "跨考试局 · 跨年份 · 自由组合", icon: Calculator, accent: "#9F8F7E", to: "/calculator" },
  { title: "人格诊断", desc: "20题 · 4维分析 · 16种人格", icon: Sparkles, accent: "#A8A0B0", to: "/personality" },
];

/* ═══════════════════════════════════════════════════════════
   STEPS (teacher research workflow)
   ═══════════════════════════════════════════════════════════ */
const STEPS = [
  { number: "01", title: "选择目标科目", desc: "输入你已授科目，或选择一条热门扩科路径", icon: Search },
  { number: "02", title: "对比考纲与数据", desc: "查看跨考试局的考纲重合度、分数线、A*率差异", icon: GitCompareArrows },
  { number: "03", title: "生成备课材料", desc: "一键生成刷题规划、试卷对比表和教学重点清单", icon: CheckCircle2 },
];

/* ═══════════════════════════════════════════════════════════
   STAT COMPONENT (Count-up with IntersectionObserver)
   ═══════════════════════════════════════════════════════════ */
function StatItem({ end, suffix, label, delay }: { end: number; suffix: string; label: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);

  // useCountUp itself uses IntersectionObserver internally
  useCountUp(countRef, end, 2000);

  return (
    <div ref={ref} className={cn("stat-card scroll-reveal", `scroll-reveal-delay-${delay}`)}>
      <div ref={countRef} className="stat-number" data-suffix={suffix}>
        0{suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXPANSION PATH CARD
   ═══════════════════════════════════════════════════════════ */
function ExpansionPathCard({ path }: { path: (typeof EXPANSION_PATHS)[0] }) {
  const navigate = useNavigate();

  const handleClick = () => {
    const fromCode = path.from.subject.split(" ")[0];
    navigate(`/papers?search=${encodeURIComponent(fromCode)}`);
  };

  return (
    <div className="group relative rounded-xl border border-[#E8E4DE] bg-white p-5 transition-all hover:border-[#A69888]/40 hover:shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: path.from.color }}>
          {path.from.board} {path.from.level}
        </div>
        <ArrowRight className="h-4 w-4 text-[#C4BDB3]" />
        <div className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: path.to.color }}>
          {path.to.board} {path.to.level}
        </div>
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-[#3D3832]">{path.from.subject}</span>
        <span className="text-xs text-[#C4BDB3]">→</span>
        <span className="text-sm font-semibold text-[#3D3832]">{path.to.subject}</span>
      </div>
      <p className="text-xs leading-relaxed text-[#8B8378]">{path.reason}</p>
      <Button
        size="sm"
        className="mt-4 gap-1 bg-gradient-to-br from-[#8F7F6E] to-[#A69888] text-white"
        onClick={handleClick}
      >
        查看差异 <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXAM BOARD CARD (hover to expand, click button to navigate)
   ═══════════════════════════════════════════════════════════ */
function ExamBoardCard({ board }: { board: (typeof EXAM_BOARDS)[0] }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="hero-board-card scroll-reveal p-5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ height: 3, borderRadius: 2, background: board.gradient, marginBottom: 16, opacity: 0.8 }} />
      <div style={{ fontSize: 28, fontWeight: 800, color: board.color, letterSpacing: "0.04em", lineHeight: 1, marginBottom: 6 }}>
        {board.short}
      </div>
      <div style={{ fontSize: 12, color: "#A8A095", fontWeight: 500, marginBottom: 4 }}>{board.nameZh}</div>
      <div style={{ fontSize: 11, color: "#C4BDB3", letterSpacing: "0.05em", marginBottom: 12 }}>{board.levels}</div>

      <div
        className="card-details"
        style={{
          maxHeight: isHovered ? 400 : 0,
          opacity: isHovered ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease 0.1s",
          pointerEvents: isHovered ? "auto" : "none",
        }}
      >
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: board.color }}>{board.subjects}+</div>
              <div style={{ fontSize: 10, color: "#A8A095" }}>科目</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: board.color }}>{board.papers}+</div>
              <div style={{ fontSize: 10, color: "#A8A095" }}>试卷</div>
            </div>
          </div>
          {board.features.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6, fontSize: 11, color: "#8B8378", lineHeight: 1.4 }}>
              <CheckCircle2 size={12} style={{ color: board.color, flexShrink: 0, marginTop: 1 }} />
              {f}
            </div>
          ))}
          <Link
            to={`/alevel/${board.id}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 11, fontWeight: 600, color: board.color, padding: "6px 12px", borderRadius: 6, background: `${board.color}10`, border: `1px solid ${board.color}25`, textDecoration: "none" }}
          >
            浏览 {board.short} 科目 <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN HOME COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Home() {
  useScrollReveal();
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/papers?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleTagClick = (tag: string) => {
    const code = tag.split(" ")[0];
    navigate(`/papers?search=${encodeURIComponent(code)}`);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title="" links={HOME_NAV_LINKS} scrolled={scrolled} />

      <main className="flex-1">
        {/* ════════════════════════════════════════════════
            HERO SECTION (with search box)
            ════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden px-4 pt-20 pb-12 md:pt-24 md:pb-16">
          <div className="pointer-events-none absolute top-[10%] right-[5%] h-[300px] w-[300px] rounded-full" style={{ background: "radial-gradient(circle, rgba(184,166,138,0.08) 0%, transparent 70%)" }} />

          <div className="relative z-10 mx-auto max-w-[900px] text-center">
            {/* Label */}
            <p className="text-reveal text-reveal-delay-1 mb-4 text-[13px] font-semibold tracking-[0.12em]" style={{ color: "#B8A68A" }}>
              EXAMBRIDGE 教师扩科助手
            </p>

            {/* Main headline */}
            <h1 className="text-[clamp(32px,6vw,56px)] font-extrabold leading-[1.15] tracking-[0.02em]" style={{ color: "#3D3832" }}>
              <span className="text-reveal text-reveal-delay-2">跨考试局扩科，</span>
              <span className="text-reveal text-reveal-delay-3 morandi-gradient-text">从一节课开始</span>
            </h1>

            {/* Subtitle */}
            <p className="animate-fade-in-up mx-auto mt-6 max-w-[600px] text-base leading-[1.8] opacity-0" style={{ color: "#8B8378", animationDelay: "0.5s" }}>
              查分数线 · 对比考纲 · 分析 A*率 · 生成刷题规划
              <br />
              覆盖 CAIE / Edexcel / AQA / OCR / WJEC-Eduqas 五大考试局
            </p>

            {/* Search box + CTA */}
            <div className="animate-fade-in-up mx-auto mt-8 flex max-w-lg flex-col items-center gap-4 opacity-0 sm:flex-row" style={{ animationDelay: "0.7s" }}>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8A095]" />
                <Input
                  type="text"
                  placeholder="搜索科目，如 9709、0580..."
                  className="h-12 rounded-xl border-[#D9D4CE] pl-10 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
              <Button
                size="lg"
                className="h-12 gap-2 whitespace-nowrap rounded-xl bg-gradient-to-br from-[#8F7F6E] to-[#A69888] px-8 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110"
                onClick={handleSearch}
              >
                <GitCompareArrows size={16} />
                开始扩科对比
              </Button>
            </div>

            {/* Hot search tags */}
            <div className="animate-fade-in-up mt-3 flex flex-wrap items-center justify-center gap-2 text-xs opacity-0" style={{ color: "#8B8378", animationDelay: "0.85s" }}>
              <span>热门搜索：</span>
              {["9709 数学", "0580 数学", "9702 物理", "WMA01", "9701 化学"].map((tag) => (
                <button
                  key={tag}
                  className="transition-colors hover:text-[#8F7F6E] underline-offset-2 hover:underline"
                  onClick={() => handleTagClick(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Scroll indicator */}
            <div className="animate-fade-in mt-10 flex flex-col items-center gap-2 opacity-0" style={{ animationDelay: "1s" }}>
              <span className="text-[11px] tracking-[0.1em]" style={{ color: "#C4BDB3" }}>向下滚动探索</span>
              <ChevronDown size={20} style={{ color: "#C4BDB3", animation: "float 2s ease-in-out infinite" }} />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            HOT EXPANSION PATHS
            ════════════════════════════════════════════════ */}
        <section className="px-4 pb-14">
          <div className="mx-auto max-w-[1000px]">
            <div className="scroll-reveal mb-8">
              <p className="mb-3 text-xs font-semibold tracking-[0.15em]" style={{ color: "#B8A68A" }}>热门扩科路径</p>
              <h2 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.2]" style={{ color: "#3D3832" }}>
                教师最常选的扩科方向
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {EXPANSION_PATHS.map((path) => (
                <ExpansionPathCard key={`${path.from.subject}-${path.to.subject}`} path={path} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            EXAM BOARD CARDS (grid-cols-5 fix)
            ════════════════════════════════════════════════ */}
        <section className="px-4 pb-14">
          <div className="mx-auto grid max-w-7xl grid-cols-5 gap-4">
            {EXAM_BOARDS.map((board) => (
              <ExamBoardCard key={board.id} board={board} />
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            STATS BAR (IntersectionObserver triggered)
            ════════════════════════════════════════════════ */}
        <section className="border-y border-[#E8E4DE] px-4 py-10">
          <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-6 md:grid-cols-4">
            <StatItem end={10000} suffix="+" label="条分数线" delay={1} />
            <StatItem end={560} suffix="" label="个科目" delay={2} />
            <StatItem end={1146} suffix="" label="份试卷" delay={3} />
            <StatItem end={5} suffix="" label="大考试局" delay={4} />
          </div>
        </section>

        {/* ════════════════════════════════════════════════
            CORE FEATURES
            ════════════════════════════════════════════════ */}
        <section className="px-4 py-14">
          <div className="mx-auto max-w-[900px]">
            <div className="scroll-reveal mb-10 text-center">
              <p className="mb-3 text-xs font-semibold tracking-[0.15em]" style={{ color: "#B8A68A" }}>核心教研工具</p>
              <h2 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.2]" style={{ color: "#3D3832" }}>
                教师扩科教研，一站式数据平台
              </h2>
            </div>

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
              <h2 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.2]" style={{ color: "#3D3832" }}>三步开始扩科教研</h2>
            </div>

            <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
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
                覆盖教师常见扩科方向
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#A8A095" }}>
                跨考试局、跨学段、跨年度的分数线与 A*率数据，辅助教师快速定位差异
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
            热门扩科路径 (replaced university marquee)
            ════════════════════════════════════════════════ */}
        <section className="overflow-hidden border-t border-[#E8E4DE] px-4 py-10">
          <div className="mx-auto max-w-[900px]">
            <p className="mb-4 text-center text-xs font-semibold tracking-[0.15em]" style={{ color: "#B8A68A" }}>
              热门扩科路径
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "A-Level 数学 → IGCSE 数学",
                "CAIE 数学 → Edexcel 数学",
                "A-Level 物理 → IGCSE 物理",
                "CAIE 化学 → AQA 化学",
                "A-Level 经济 → IGCSE 经济",
              ].map((path) => (
                <span
                  key={path}
                  className="rounded-full border border-[#D9D4CE] bg-white px-4 py-2 text-sm text-[#8B8378]"
                >
                  {path}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
