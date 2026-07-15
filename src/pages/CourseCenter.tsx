import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleOff, History, Search, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { FEATURE_LABELS, SUBJECT_CATEGORY_LABELS, createCourseContext, getDisplayCourseCatalog, withCourseContext } from "@/course-context/catalog";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import type { CourseFeature, CourseLifecycleStatus, SubjectCategory } from "@/course-context/types";

const FEATURES = Object.keys(FEATURE_LABELS) as CourseFeature[];
const STATUS_LABEL = { available: "可用", partial: "部分可用", unavailable: "不可用" } as const;
const PAGE_SIZE = 24;

function pageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push("ellipsis");
    result.push(page);
  });
  return result;
}

export default function CourseCenter() {
  const [searchParams] = useSearchParams();
  const { context, entry: selectedEntry, setCourse } = useCourseContext();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [level, setLevel] = useState("");
  const [board, setBoard] = useState("");
  const [category, setCategory] = useState<SubjectCategory | "">("");
  const [lifecycle, setLifecycle] = useState<CourseLifecycleStatus>("current");
  const [page, setPage] = useState(1);
  const currentCatalog = useMemo(() => getDisplayCourseCatalog("current"), []);
  const historicalCatalog = useMemo(() => getDisplayCourseCatalog("historical"), []);
  const catalog = lifecycle === "current" ? currentCatalog : historicalCatalog;
  const levels = useMemo(() => [...new Set(catalog.map((item) => item.level))].sort(), [catalog]);
  const boards = useMemo(() => [...new Set(catalog.map((item) => item.boardName))].sort(), [catalog]);
  const categoryCounts = useMemo(() => catalog.reduce<Partial<Record<SubjectCategory, number>>>((counts, item) => {
    counts[item.subjectCategory] = (counts[item.subjectCategory] ?? 0) + 1;
    return counts;
  }, {}), [catalog]);
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalog.filter((item) => (!level || item.level === level) && (!board || item.boardName === board) && (!category || item.subjectCategory === category) && (!query || `${item.label} ${item.subjectCode} ${SUBJECT_CATEGORY_LABELS[item.subjectCategory]}`.toLowerCase().includes(query)));
  }, [catalog, search, level, board, category]);
  const pageCount = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const matches = filteredCourses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const switchLifecycle = (next: CourseLifecycleStatus) => {
    setLifecycle(next); setLevel(""); setBoard(""); setCategory(""); setPage(1);
  };

  return <div className="min-h-screen bg-gradient-to-b from-[#f0ede8] via-[#f5f2ee] to-[#f0ede8] text-[#3d3832]">
    <Header title="课程中心" />
    <main className="mx-auto max-w-[1200px] px-4 py-10">
      <h1 className="m-0 text-3xl font-bold">课程中心</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#625c54]">先选择稳定的资格与考纲版本，分数线、成绩统计、Paper、考纲和工具会继承同一课程。考季、tier、region 和 award route 仍在各页面单独选择。</p>
      <div className="mt-6 inline-flex rounded-xl border border-[#d2cdc6] bg-white/75 p-1" role="tablist" aria-label="课程状态">
        <button type="button" role="tab" aria-selected={lifecycle === "current"} onClick={() => switchLifecycle("current")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${lifecycle === "current" ? "bg-[#526b7e] text-white shadow-sm" : "text-[#625c54] hover:bg-[#eef1f1]"}`}><Sparkles size={15} />现行课程 <span className="opacity-75">{currentCatalog.length}</span></button>
        <button type="button" role="tab" aria-selected={lifecycle === "historical"} onClick={() => switchLifecycle("historical")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${lifecycle === "historical" ? "bg-[#806c59] text-white shadow-sm" : "text-[#625c54] hover:bg-[#f2eee9]"}`}><History size={15} />历史课程 <span className="opacity-75">{historicalCatalog.length}</span></button>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#756e67]">现行课程依据考试局现行目录、近期官方成绩记录及已人工核验考试概览判定；旧代码、停考规格和仅见于历史工具的数据保留在历史入口。</p>
      <section aria-label="筛选课程" className="mt-7 rounded-2xl border border-[#ddd6ce] bg-white/70 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_200px_180px]">
        <label className="relative"><span className="sr-only">搜索课程</span><Search aria-hidden="true" size={16} className="absolute left-3 top-3 text-[#8a8178]" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="搜索科目名称或代码" className="w-full rounded-lg border border-[#d9d4ce] bg-white py-2.5 pl-9 pr-3 text-sm" /></label>
        <label><span className="sr-only">阶段</span><select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className="w-full rounded-lg border border-[#d9d4ce] bg-white px-3 py-2.5 text-sm"><option value="">全部阶段</option>{levels.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className="sr-only">考试局</span><select value={board} onChange={(e) => { setBoard(e.target.value); setPage(1); }} className="w-full rounded-lg border border-[#d9d4ce] bg-white px-3 py-2.5 text-sm"><option value="">全部考试局</option>{boards.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className="sr-only">学科分类</span><select aria-label="学科分类" value={category} onChange={(e) => { setCategory(e.target.value as SubjectCategory | ""); setPage(1); }} className="w-full rounded-lg border border-[#d9d4ce] bg-white px-3 py-2.5 text-sm"><option value="">全部学科分类</option>{Object.entries(SUBJECT_CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="按学科类别快速筛选">
          <button type="button" aria-pressed={!category} onClick={() => { setCategory(""); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!category ? "border-[#806c59] bg-[#806c59] text-white" : "border-[#d9d4ce] bg-white text-[#625c54] hover:border-[#a69888]"}`}>全部</button>
          {(Object.entries(SUBJECT_CATEGORY_LABELS) as [SubjectCategory, string][]).map(([key, label]) => <button key={key} type="button" aria-pressed={category === key} onClick={() => { setCategory(key); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${category === key ? "border-[#806c59] bg-[#806c59] text-white" : "border-[#d9d4ce] bg-white text-[#625c54] hover:border-[#a69888]"}`}>{label} <span aria-hidden="true" className="ml-1">{categoryCounts[key] ?? 0}</span></button>)}
        </div>
      </section>
      {selectedEntry && <section className="mt-6 rounded-2xl border border-[#cfc3b6] bg-[#fffaf4] p-5" aria-labelledby="current-course-title">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-xs font-semibold uppercase tracking-wider text-[#8a6e55]">当前课程</p><h2 id="current-course-title" className="mt-1 text-xl font-bold">{selectedEntry.boardName} {selectedEntry.subjectCode} · {selectedEntry.subjectName}</h2><p className="mt-1 text-sm text-[#6e675e]">{selectedEntry.level} · {selectedEntry.specificationLabel} · 数据访问 {selectedEntry.accessedAt}</p></div><a href={selectedEntry.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-[#675a4d]">官方课程来源 <ShieldCheck size={15} /></a></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map((feature) => {
          const capability = selectedEntry.capabilities[feature]; const Icon = capability.status === "available" ? CheckCircle2 : capability.status === "partial" ? TriangleAlert : CircleOff;
          const content = <><div className="flex items-center justify-between"><span className="font-semibold">{FEATURE_LABELS[feature]}</span><Icon size={16} className={capability.status === "available" ? "text-emerald-700" : capability.status === "partial" ? "text-amber-700" : "text-[#9d958d]"} /></div><p className="mb-0 mt-2 text-xs leading-5 text-[#6e675e]">{STATUS_LABEL[capability.status]} · {capability.verificationStatus === "verified" ? "已核验" : capability.verificationStatus === "mixed" ? "混合核验" : "未核验"}{capability.reason ? `；${capability.reason}` : ""}</p></>;
          return capability.href ? <Link key={feature} to={withCourseContext(capability.href, context)} className="rounded-xl border border-[#ddd6ce] bg-white p-3 text-[#3d3832] no-underline hover:border-[#a69888] hover:shadow-sm">{content}</Link> : <div key={feature} className="rounded-xl border border-[#e5e0da] bg-[#f3f0ec] p-3 text-[#827a72]">{content}</div>;
        })}</div>
      </section>}
      <section className="mt-8" aria-labelledby="course-list-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="course-list-title" className="text-xl font-bold">{lifecycle === "current" ? "现行课程目录" : "历史课程目录"}</h2><span className="text-xs text-[#756e67]">共 {filteredCourses.length} 门 · 第 {safePage} / {pageCount} 页</span></div>
        {matches.length > 0 ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{matches.map((course) => <button key={course.qualificationId} type="button" onClick={() => setCourse(createCourseContext(course))} className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selectedEntry?.qualificationId === course.qualificationId ? "border-[#8e7965] bg-[#fffaf4]" : "border-[#ddd6ce] bg-white/70"}`}><span className="text-xs font-semibold text-[#846f5d]">{course.boardName} · {course.level} · {SUBJECT_CATEGORY_LABELS[course.subjectCategory]}</span><span className="mt-3 inline-flex rounded-md bg-[#e9eef0] px-2.5 py-1 font-mono text-sm font-bold tracking-wide text-[#3d5661]" aria-label={`资格代码 ${course.subjectCode}`}>{course.subjectCode}</span><strong className="mt-2 block text-base">{course.subjectName}</strong><span className="mt-2 block text-xs leading-5 text-[#756e67]">{course.specificationLabel}</span>{lifecycle === "historical" && <span className="mt-2 block text-[11px] leading-4 text-[#8a7465]">归档依据：{course.lifecycleEvidence}</span>}</button>)}</div> : <div className="rounded-2xl border border-[#ddd6ce] bg-white/70 px-5 py-10 text-center text-sm text-[#756e67]">没有符合当前筛选条件的课程。</div>}
        {pageCount > 1 && <nav className="mt-7 flex flex-wrap items-center justify-center gap-1.5" aria-label="课程目录分页">
          <button type="button" disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#d5cec6] bg-white px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={14} />上一页</button>
          {pageNumbers(safePage, pageCount).map((item, index) => item === "ellipsis" ? <span key={`ellipsis-${index}`} className="px-1 text-[#8b837b]">…</span> : <button key={item} type="button" aria-current={safePage === item ? "page" : undefined} onClick={() => setPage(item)} className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-semibold ${safePage === item ? "border-[#526b7e] bg-[#526b7e] text-white" : "border-[#d5cec6] bg-white text-[#625c54] hover:border-[#9ba9ae]"}`}>{item}</button>)}
          <button type="button" disabled={safePage === pageCount} onClick={() => setPage(Math.min(pageCount, safePage + 1))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#d5cec6] bg-white px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40">下一页<ChevronRight size={14} /></button>
        </nav>}
      </section>
    </main><Footer />
  </div>;
}
