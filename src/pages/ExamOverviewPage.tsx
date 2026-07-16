import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  BookOpen, Calculator, CalendarDays, CheckCircle2, Clock3, ExternalLink,
  Eye, FileText, FlaskConical, MapPin, RefreshCw, Route, ShieldCheck, Sigma,
} from "lucide-react";
import Footer from "@/components/Footer";
import PastPaperLibrary from "@/components/PastPaperLibrary";
import Header from "@/components/Header";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { COURSE_CATALOG, createCourseContext } from "@/course-context/catalog";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import {
  EXAM_OVERVIEW_CATALOG, examOverviewIdForCourse, getExamOverviewForCourse,
  type ExamMaterial,
} from "@/domain-v2/exam-overview";
import { explainCalculatorRestriction, isCalculatorRuleNote, mentionsCasRule } from "@/domain-v2/exam-overview/calculator-language";
import { cn } from "@/lib/utils";

const ExamOverviewInsights = lazy(() => import("@/components/ExamOverviewInsights"));

const MATERIAL_LABEL = {
  syllabus: "考纲", formula: "公式表", timetable: "时间表", "update-notice": "更新说明",
  "data-booklet": "数据资料", "periodic-table": "周期表", "practical-guidance": "实验说明", "reference-document": "考试参考",
} as const;
const STATUS_LABEL = { current: "当前有效", future: "已发布·未来适用", reference: "考试资料" } as const;
const CALCULATOR_LABEL = { allowed: "允许", "not-allowed": "禁止", required: "需要", unknown: "待确认" } as const;
const ASSESSMENT_MODE_LABEL = {
  written: "书面", "multiple-choice": "选择题", practical: "实验",
  "alternative-practical": "实验替代", programming: "编程", "pre-release": "预发布材料",
} as const;

function referenceMaterialStatus(formula: { supplied: boolean; status?: "provided" | "not-provided" | "varies" | "not-applicable" | "unknown" }) {
  if (formula.status === "varies") return "按 Paper 区分";
  if (formula.status === "not-applicable") return "无独立参考资料";
  if (formula.status === "not-provided") return "考试不提供";
  if (formula.status === "unknown") return "待官方确认";
  return formula.supplied ? "考试提供" : "考试不提供";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${date}T12:00:00+08:00`));
}

function daysUntil(date: string) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const target = new Date(`${date}T00:00:00+08:00`).getTime();
  return Math.ceil((target - start) / 86_400_000);
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} 小时${rest ? ` ${rest} 分` : ""}` : `${rest} 分钟`;
}

function PdfPreview({ material, onClose }: { material: ExamMaterial | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(material)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="h-[92vh] max-w-[min(1100px,calc(100%-1rem))] gap-3 overflow-hidden bg-[#f8f6f2] p-3 sm:p-4">
        <DialogHeader className="pr-10">
          <DialogTitle className="text-base text-[#302d2a]">{material?.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span>{material?.version}</span>
            {material && <a href={material.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#526b7e]">在官方页面打开 <ExternalLink size={12} /></a>}
          </DialogDescription>
        </DialogHeader>
        {material && <iframe title={`${material.title} PDF 预览`} src={material.previewUrl} className="h-full min-h-0 w-full rounded-xl border border-[#d9d4ce] bg-white" />}
      </DialogContent>
    </Dialog>
  );
}

export default function ExamOverviewPage() {
  const { context, entry, setCourse } = useCourseContext();
  const [preview, setPreview] = useState<ExamMaterial | null>(null);
  const [qualificationView, setQualificationView] = useState<"ial" | "ias">("ial");
  const overview = getExamOverviewForCourse(entry);
  const supportedCourses = useMemo(() => {
    const seen = new Set<string>();
    return COURSE_CATALOG.filter((course) => {
      const id = examOverviewIdForCourse(course);
      if (!id || seen.has(id)) return false;
      if (["cambridge-0580", "cambridge-0606", "cambridge-0607", "cambridge-0610", "cambridge-0620", "cambridge-0625", "cambridge-0478", "pearson-4ma1", "pearson-4pm1", "pearson-4mb1", "pearson-igcse-4bi1", "pearson-igcse-4ch1", "pearson-igcse-4ph1", "pearson-igcse-4cp0"].includes(id) && course.level !== "IGCSE") return false;
      seen.add(id);
      return true;
    });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [overview?.id]);

  if (!overview) {
    return <div className="min-h-screen bg-[#f0ede8] text-[#3d3832]">
      <Header title="考试概览" />
      <main className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6">
        <div className="rounded-[28px] border border-[#d9d4ce] bg-[linear-gradient(135deg,#fff_0%,#f7f3ed_55%,#edf2f1_100%)] p-7 shadow-[0_18px_60px_rgba(61,56,50,0.08)] sm:p-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#526b7e]/10 px-3 py-1.5 text-xs font-semibold text-[#526b7e]"><CalendarDays size={14} /> 首版已核验数据</span>
          <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">选择课程，查看完整考试概览</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#625c54] sm:text-base">集中查看考季、Paper 数量、考试路线、计算器规则、最近考试日期，以及官方考纲和公式表。Cambridge 默认显示中国大陆 Zone 5。</p>
        </div>

        {entry && <div className="mt-6 rounded-xl border border-[#cbaea4] bg-[#fff8f5] px-4 py-3 text-sm text-[#775e55]">当前课程暂未覆盖。可从下面已核验的课程组中选择。</div>}
        <section aria-labelledby="supported-courses" className="mt-8">
          <h2 id="supported-courses" className="text-xl font-bold">已核验课程</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {supportedCourses.map((course) => {
              const data = EXAM_OVERVIEW_CATALOG.find((item) => item.id === examOverviewIdForCourse(course));
              return <button key={course.qualificationId} type="button" onClick={() => setCourse(createCourseContext(course))} className="group rounded-2xl border border-[#d9d4ce] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#9aa9ad] hover:shadow-lg">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#526b7e]">{data?.board}</span>
                <strong className="mt-2 block text-lg">{data?.code} · {data?.qualification}</strong>
                <span className="mt-3 flex items-center justify-between text-sm text-[#6e675e]"><span>{data?.region.label}</span><span className="font-semibold text-[#526b7e]">查看概览 →</span></span>
              </button>;
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>;
  }

  const activeView = overview.qualificationViews?.find((view) => view.key === qualificationView);
  const routes = activeView?.routes ?? overview.routes;
  const paperCount = activeView?.paperCount ?? overview.paperCount;
  const componentGroups = activeView?.componentGroups ? new Set(activeView.componentGroups) : null;
  const components = componentGroups ? overview.components.filter((item) => item.group && componentGroups.has(item.group)) : overview.components;
  const upcoming = componentGroups ? overview.upcomingExams.filter((item) => item.group && componentGroups.has(item.group)) : overview.upcomingExams;
  const countdown = daysUntil(overview.nextExam.date);
  const calculatorRestrictions = overview.calculator.prohibited.filter((item) => !isCalculatorRuleNote(item));
  const calculatorNotes = overview.calculator.prohibited.filter(isCalculatorRuleNote);

  return <div className="min-h-screen bg-[linear-gradient(180deg,#eef2f1_0%,#f5f2ee_22%,#f0ede8_100%)] text-[#3d3832]">
    <Header title="考试概览" />
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
      <section className="relative overflow-hidden rounded-[30px] border border-[#ccd4d4] bg-[#fdfcf9] p-6 shadow-[0_24px_70px_rgba(61,56,50,0.09)] sm:p-9">
        <div aria-hidden="true" className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#9cabb6]/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#b8a68a]/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#526b7e]/10 px-3 py-1.5 text-xs font-semibold text-[#526b7e]"><ShieldCheck size={14} /> 已人工核验发布</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#506d58]/10 px-3 py-1.5 text-xs font-semibold text-[#506d58]"><MapPin size={14} /> {overview.region.label}</span>
            </div>
            <p className="mb-0 mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#7b7269]">{overview.board}</p>
            <h1 className="mb-0 mt-2 max-w-4xl text-3xl font-bold tracking-tight sm:text-5xl">{overview.qualification}</h1>
            <p className="mb-0 mt-3 text-base font-semibold text-[#526b7e]">{overview.code}</p>
          </div>
          <div className="max-w-md rounded-2xl border border-[#d8dfdf] bg-[#edf2f1]/80 p-4 text-sm leading-6 text-[#4d5f63]">
            <strong className="block text-[#34484d]">区域与时间说明</strong>{overview.region.note}
          </div>
        </div>
      </section>

      {overview.qualificationViews && <div className="mt-6 inline-flex rounded-xl border border-[#d2cdc6] bg-white/80 p-1" role="tablist" aria-label="选择资格视图">
        {overview.qualificationViews.map((view) => <button key={view.key} type="button" role="tab" aria-selected={qualificationView === view.key} onClick={() => setQualificationView(view.key)} className={cn("rounded-lg px-6 py-2 text-sm font-semibold transition", qualificationView === view.key ? "bg-[#526b7e] text-white shadow-sm" : "text-[#625c54] hover:bg-[#eef1f1]")}>{view.label}</button>)}
      </div>}

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]" aria-label="关键考试信息">
        <div className="rounded-3xl bg-[#253b46] p-6 text-white shadow-lg sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#c9d7dc]"><CalendarDays size={16} /> 最近一场考试</span><h2 className="mb-0 mt-4 text-2xl font-bold sm:text-3xl">{formatDate(overview.nextExam.date)}</h2></div>
            <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold">{countdown >= 0 ? `还有 ${countdown} 天` : "等待新时间表"}</span>
          </div>
          <div className="mt-7 grid gap-4 border-t border-white/15 pt-5 sm:grid-cols-3">
            <div><span className="text-xs text-[#afc1c8]">官方场次</span><strong className="mt-1 block text-lg">{overview.nextExam.session}</strong></div>
            <div><span className="text-xs text-[#afc1c8]">组件代码</span><strong className="mt-1 block text-lg">{overview.nextExam.code}</strong></div>
            <div><span className="text-xs text-[#afc1c8]">考试内容</span><strong className="mt-1 block text-lg">{overview.nextExam.title}</strong></div>
          </div>
        </div>
        <div className="rounded-3xl border border-[#d8cbb9] bg-[#f6efe4] p-6 sm:p-7">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#7c684b]"><FileText size={16} /> Paper 数量</span>
          <p className="mb-0 mt-5 text-lg font-semibold leading-8 text-[#4e4336]">{paperCount}</p>
          <div className="mt-5 flex flex-wrap gap-2">{overview.examSeries.map((series) => <span key={series.name} title={series.note} className="rounded-full border border-[#d6c5ad] bg-white/70 px-3 py-1 text-xs font-medium text-[#6e5c40]">{series.name}{series.note ? " *" : ""}</span>)}</div>
        </div>
      </section>

      <section className={cn("mt-6 grid gap-4 md:grid-cols-2", overview.practical && "xl:grid-cols-3")} aria-label="考试工具与实践规则">
        <article className="rounded-3xl border border-[#cbd8cd] bg-[#edf3ed] p-6 sm:p-7">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#506d58]"><Calculator size={17} /> 计算器规则</span>
          <h2 className="mb-0 mt-4 text-xl font-bold text-[#334c39]">{overview.calculator.status === "all" ? "全部允许" : overview.calculator.status === "mixed" ? "按 Paper 区分" : overview.calculator.status === "none" ? "全部禁止" : "待官方确认"}</h2>
          <p className="mb-0 mt-2 text-sm leading-7 text-[#506257]">{overview.calculator.summary}</p>
          {calculatorRestrictions.length > 0 && <div className="mt-4 rounded-2xl bg-white/65 p-3"><strong className="text-xs text-[#3f5945]">设备不能具备或使用以下功能</strong><ul className="mb-0 mt-2 space-y-1.5 pl-4 text-xs leading-5 text-[#53675a]">{calculatorRestrictions.map((item) => <li key={item}>{explainCalculatorRestriction(item)}</li>)}</ul></div>}
          {mentionsCasRule(overview.calculator.prohibited) && <p className="mb-0 mt-3 rounded-xl border border-[#cbd8cd] bg-[#f8fbf8] px-3 py-2 text-xs leading-5 text-[#4e6554]"><strong>CAS 是什么？</strong> CAS 是“计算机代数系统”，能直接处理含字母的式子，例如符号化简、解含字母方程、符号求导或符号积分。普通科学计算器通常不具备这些功能。</p>}
          {calculatorNotes.map((item) => <p key={item} className="mb-0 mt-3 text-xs leading-5 text-[#5b6d60]">考试日提醒：{item}</p>)}
        </article>
        <article className="rounded-3xl border border-[#d5c9d0] bg-[#f4eef2] p-6 sm:p-7">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#775e70]"><Sigma size={17} /> {overview.formula.label ?? "公式表"}</span>
          <h2 className="mb-0 mt-4 text-xl font-bold text-[#59424f]">{referenceMaterialStatus(overview.formula)}</h2>
          <p className="mb-0 mt-2 text-sm leading-7 text-[#6d5965]">{overview.formula.summary}</p>
          <p className="mb-0 mt-4 text-xs text-[#7a6872]">本站直接展示考试局官方 PDF，不重新录入或改写公式。</p>
        </article>
        {overview.practical && <article className="rounded-3xl border border-[#c9d2df] bg-[#edf1f7] p-6 sm:p-7">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#536b8b]"><FlaskConical size={17} /> 实验与实践考核</span>
          <h2 className="mb-0 mt-4 text-xl font-bold text-[#3f526c]">{overview.practical.status === "required" ? "包含实践考核" : overview.practical.status === "route-dependent" ? "按路线选择" : "无独立实践考试"}</h2>
          <p className="mb-0 mt-2 text-sm leading-7 text-[#586a82]">{overview.practical.summary}</p>
          {overview.practical.options.length > 0 && <div className="mt-4 space-y-2">{overview.practical.options.map((option) => <div key={option.label} className="rounded-xl bg-white/70 px-3 py-2.5 text-xs text-[#52657d]"><strong className="block">{option.label}</strong><span className="mt-1 block">{option.papers.join(" + ")}{option.note ? ` · ${option.note}` : ""}</span></div>)}</div>}
        </article>}
      </section>

      <section className="mt-8" aria-labelledby="routes-title">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#526b7e]">Assessment structure</span><h2 id="routes-title" className="mb-0 mt-1 text-2xl font-bold">考试路线</h2></div><span className="text-sm text-[#6e675e]">{routes.length} 条有效路线</span></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{routes.map((route) => <article key={route.id} className="rounded-2xl border border-[#d9d4ce] bg-white/80 p-5 shadow-[0_8px_24px_rgba(61,56,50,0.04)]">
          <span className="flex items-center gap-2 text-xs font-semibold text-[#526b7e]"><Route size={15} /> {route.level}</span><h3 className="mb-0 mt-3 text-base font-bold">{route.label}</h3><div className="mt-4 flex flex-wrap gap-2">{route.papers.map((paper) => <span key={paper} className="rounded-md bg-[#edf1f2] px-2.5 py-1 text-xs font-semibold text-[#465f69]">{paper}</span>)}</div>{route.note && <p className="mb-0 mt-3 text-xs leading-5 text-[#756e67]">{route.note}</p>}
        </article>)}</div>
      </section>

      <section className="mt-8" aria-labelledby="components-title">
        <div><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#506d58]">Paper details</span><h2 id="components-title" className="mb-0 mt-1 text-2xl font-bold">Paper / Unit 详情</h2></div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#d9d4ce] bg-white/80">
          <div className="hidden grid-cols-[0.8fr_1.5fr_0.8fr_0.65fr_0.7fr] gap-3 border-b border-[#ddd7d0] bg-[#ebe7e1] px-5 py-3 text-xs font-semibold text-[#625c54] md:grid"><span>代码</span><span>名称 / 组别</span><span>时长</span><span>分值</span><span>计算器</span></div>
          {components.map((component) => <div key={component.code} className="grid gap-3 border-b border-[#e5e0da] px-5 py-4 text-sm last:border-b-0 md:grid-cols-[0.8fr_1.5fr_0.8fr_0.65fr_0.7fr] md:items-center">
            <strong>{component.code}</strong><div><span>{component.name}</span>{component.group && <span className="ml-2 rounded-full bg-[#f0ece7] px-2 py-0.5 text-[11px] text-[#756e67]">{component.group}</span>}{component.assessmentMode && <span className="ml-2 rounded-full bg-[#e8eef5] px-2 py-0.5 text-[11px] text-[#536b8b]">{ASSESSMENT_MODE_LABEL[component.assessmentMode]}</span>}<span className="mt-1 block text-xs text-[#756e67]">{component.weighting}{component.note ? ` · ${component.note}` : ""}</span></div><span><Clock3 size={13} className="mr-1 inline" />{durationLabel(component.durationMinutes)}</span><span>{component.marks} marks</span><span className={cn("w-fit rounded-full px-2.5 py-1 text-xs font-semibold", component.calculator === "not-allowed" ? "bg-[#f4e9e6] text-[#8f6860]" : component.calculator === "unknown" ? "bg-[#eeeae3] text-[#70675d]" : "bg-[#e8f0e9] text-[#456348]")}>{CALCULATOR_LABEL[component.calculator]}</span>
          </div>)}
        </div>
      </section>

      <PastPaperLibrary board={overview.board} subjectCode={entry?.subjectCode ?? overview.code} />

      {entry && <Suspense fallback={<div className="mt-8 rounded-3xl border border-[#d7dfe2] bg-[#f7fafb] px-5 py-12 text-center text-sm text-[#68777c]">正在加载分数线与成绩趋势…</div>}><ExamOverviewInsights key={overview.id} entry={entry} context={context} overviewId={overview.id} overviewCode={overview.code} /></Suspense>}

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div aria-labelledby="schedule-title"><div className="flex flex-wrap items-end justify-between gap-2"><div><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#526b7e]">Upcoming schedule</span><h2 id="schedule-title" className="mb-0 mt-1 text-2xl font-bold">最近考试日期</h2></div><span className="text-xs text-[#6e675e]">{overview.upcomingSeries} · {overview.timetableStatus}</span></div>
          <div className="mt-4 space-y-2">{upcoming.map((exam, index) => <article key={`${exam.date}-${exam.code}`} className="grid grid-cols-[48px_1fr] gap-3 rounded-2xl border border-[#d8dfe0] bg-[#f8fbfb] p-3 sm:grid-cols-[72px_1fr_auto] sm:items-center">
            <div className="rounded-xl bg-[#526b7e] py-2 text-center text-white"><span className="block text-[10px] uppercase opacity-75">{new Date(`${exam.date}T12:00:00+08:00`).toLocaleDateString("zh-CN", { month: "short" })}</span><strong className="block text-lg leading-5">{exam.date.slice(-2)}</strong></div>
            <div><strong className="text-sm">{exam.title}</strong><span className="mt-1 block text-xs text-[#66777c]">{exam.code} · {durationLabel(exam.durationMinutes)}{exam.group ? ` · ${exam.group}` : ""}</span></div>
            <span className="col-start-2 w-fit rounded-full bg-[#dfe8ea] px-2.5 py-1 text-xs font-semibold text-[#465f69] sm:col-start-auto">{exam.session}</span>
            {index < upcoming.length - 1 && <span aria-hidden="true" className="sr-only">下一场</span>}
          </article>)}</div>
        </div>

        <div aria-labelledby="materials-title"><div><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#775e55]">Official materials</span><h2 id="materials-title" className="mb-0 mt-1 text-2xl font-bold">官方考纲与资料</h2></div>
          <div className="mt-4 space-y-3">{overview.materials.map((material) => <article key={material.id} className="rounded-2xl border border-[#ded6d0] bg-[#fffaf7] p-4">
            <div className="flex items-start justify-between gap-3"><div><span className="inline-flex rounded-full bg-[#eee5df] px-2.5 py-1 text-[11px] font-semibold text-[#775e55]">{MATERIAL_LABEL[material.type]}</span><h3 className="mb-0 mt-2 text-sm font-bold leading-6">{material.title}</h3><p className="mb-0 mt-1 text-xs text-[#756e67]">{material.version} · {STATUS_LABEL[material.status]}</p></div><FileText size={20} className="mt-1 shrink-0 text-[#9b8175]" /></div>
            {material.note && <p className="mb-0 mt-2 text-xs leading-5 text-[#756e67]">{material.note}</p>}
            <div className="mt-3 flex gap-2"><button type="button" onClick={() => setPreview(material)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#775e55] px-3 py-2 text-xs font-semibold text-white hover:bg-[#624b44]"><Eye size={14} /> 站内预览</button><a href={material.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#d5c9c3] bg-white px-3 py-2 text-xs font-semibold text-[#675a54] no-underline hover:border-[#9b8175]"><ExternalLink size={14} /> 官方链接</a></div>
          </article>)}</div>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-[#ccd6d0] bg-[#f4f8f5] p-6" aria-labelledby="freshness-title">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-2xl"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#506d58]"><RefreshCw size={15} /> Update window</span><h2 id="freshness-title" className="mb-0 mt-2 text-xl font-bold">资料更新与发布审核</h2><p className="mb-0 mt-2 text-sm leading-7 text-[#5d6d61]">自动检查只会生成候选版本和差异报告。时间表、考纲或公式表的变化必须人工确认后，才会替换当前页面数据。</p></div>
          <div className="grid gap-2 text-xs sm:grid-cols-3 lg:max-w-xl"><span className="rounded-xl bg-white px-3 py-2.5"><strong className="block text-[#3e5945]">常规</strong>{overview.release.schedule.normal}</span><span className="rounded-xl bg-white px-3 py-2.5"><strong className="block text-[#3e5945]">临近考试</strong>{overview.release.schedule.nearExam}</span><span className="rounded-xl bg-white px-3 py-2.5"><strong className="block text-[#3e5945]">教学资料</strong>{overview.release.schedule.materials}</span></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 border-t border-[#d7e0da] pt-4 text-xs text-[#607066]"><span className="inline-flex items-center gap-1.5"><CheckCircle2 size={14} /> 数据核验：{overview.release.verifiedAt}</span><span className="inline-flex items-center gap-1.5"><BookOpen size={14} /> 人工确认发布：{overview.release.approvedAt}</span></div>
      </section>
    </main>
    <Footer />
    <PdfPreview material={preview} onClose={() => setPreview(null)} />
  </div>;
}
