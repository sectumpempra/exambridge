import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Check, ChevronsUpDown, SlidersHorizontal, X } from "lucide-react";
import { createCourseContext, getDisplayCourseCatalog, SUBJECT_CATEGORY_LABELS, withCourseContext } from "@/course-context/catalog";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import type { SubjectCategory } from "@/course-context/types";
import { cn } from "@/lib/utils";

const CONTEXT_ROUTES = ["/courses", "/exam-overview", "/knowledge-tree", "/papers", "/results", "/tools", "/alevel", "/gcse", "/statistics", "/calculator", "/planner", "/graph"];

export default function CourseContextBar() {
  const location = useLocation();
  const { context, entry, recent, setCourse, clearCourse } = useCourseContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SubjectCategory | "">("");
  const [level, setLevel] = useState("");
  const [board, setBoard] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentCourses = useMemo(() => getDisplayCourseCatalog("current"), []);
  const categories = useMemo(() => [...new Set(currentCourses.map((course) => course.subjectCategory))].sort((a, b) => SUBJECT_CATEGORY_LABELS[a].localeCompare(SUBJECT_CATEGORY_LABELS[b], "zh-CN")), [currentCourses]);
  const levels = useMemo(() => [...new Set(currentCourses.map((course) => course.level))].sort(), [currentCourses]);
  const boards = useMemo(() => [...new Set(currentCourses.map((course) => course.boardName))].sort(), [currentCourses]);
  const visible = location.pathname === "/" || CONTEXT_ROUTES.some((route) => location.pathname === route || location.pathname.startsWith(`${route}/`));
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return currentCourses.filter((course) => (
      (!category || course.subjectCategory === category)
      && (!level || course.level === level)
      && (!board || course.boardName === board)
      && (!query || `${course.label} ${course.subjectCode}`.toLowerCase().includes(query))
    ));
  }, [board, category, currentCourses, level, search]);
  const options = filteredCourses.slice(0, 60);
  const hasFilters = Boolean(search || category || level || board);
  const resetFilters = () => { setSearch(""); setCategory(""); setLevel(""); setBoard(""); };

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [open]);
  if (!visible) return null;

  return (
    <div className="border-t border-[#ddd6ce]/70 bg-[#ebe6df]/90">
      <div className="relative mx-auto flex max-w-[1200px] items-center gap-3 px-5 py-2 text-xs text-[#625c54]">
        <BookOpen size={14} aria-hidden="true" />
        {entry ? (
          <>
            <span className="min-w-0 flex-1 truncate"><strong className="text-[#3d3832]">{entry.boardName} · {entry.subjectCode}</strong><span className="hidden sm:inline"> · {entry.subjectName} · {entry.specificationLabel}</span></span>
            <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-md border border-[#cfc6bc] bg-white/70 px-2.5 py-1.5 font-medium text-[#675a4d] hover:bg-white">
              切换课程 <ChevronsUpDown size={13} />
            </button>
            <button type="button" onClick={() => { clearCourse(); setOpen(false); }} className="rounded p-1 hover:bg-white" aria-label="清除课程上下文"><X size={14} /></button>
          </>
        ) : (
          <>
            <span className="flex-1">尚未选择课程。选择后，各工具会保持同一课程。</span>
            <Link to="/courses" className="font-semibold text-[#675a4d] no-underline">选择课程</Link>
          </>
        )}
        {open && (
          <div ref={panelRef} className="fixed inset-x-0 bottom-0 z-[70] max-h-[88vh] overflow-y-auto rounded-t-2xl border border-[#d9d4ce] bg-[#faf8f5] p-4 shadow-2xl sm:absolute sm:bottom-auto sm:left-auto sm:right-5 sm:top-[calc(100%+8px)] sm:w-[min(94vw,620px)] sm:rounded-xl sm:p-3" role="dialog" aria-modal="false" aria-label="切换课程">
            <div className="mb-3 flex items-center justify-between"><div><strong className="text-sm text-[#3d3832]">切换课程</strong><span className="ml-2 text-[11px] text-[#7a736b]">现行课程</span></div><button type="button" onClick={() => setOpen(false)} aria-label="关闭课程选择" className="rounded-md p-1.5 hover:bg-[#eee8e1]"><X size={17} /></button></div>
            <label className="sr-only" htmlFor="course-context-search">搜索课程</label>
            <input id="course-context-search" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索考试局、课程名称或代码" className="mb-2 w-full rounded-lg border border-[#d9d4ce] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#a69888]/30" />
            <div className="mb-2 grid gap-2 sm:grid-cols-3" aria-label="筛选课程">
              <label className="relative"><span className="sr-only">学科分类</span><select aria-label="学科分类" value={category} onChange={(event) => setCategory(event.target.value as SubjectCategory | "")} className="w-full appearance-none rounded-lg border border-[#d9d4ce] bg-white px-3 py-2 pr-8 text-xs font-medium text-[#514b45] outline-none focus:ring-2 focus:ring-[#a69888]/30"><option value="">全部学科</option>{categories.map((item) => <option key={item} value={item}>{SUBJECT_CATEGORY_LABELS[item]}</option>)}</select><ChevronsUpDown aria-hidden="true" size={12} className="pointer-events-none absolute right-2.5 top-2.5 text-[#827a72]" /></label>
              <label className="relative"><span className="sr-only">课程阶段</span><select aria-label="课程阶段" value={level} onChange={(event) => setLevel(event.target.value)} className="w-full appearance-none rounded-lg border border-[#d9d4ce] bg-white px-3 py-2 pr-8 text-xs font-medium text-[#514b45] outline-none focus:ring-2 focus:ring-[#a69888]/30"><option value="">全部阶段</option>{levels.map((item) => <option key={item} value={item}>{item === "A-Level" ? "A-Level（AL）" : item}</option>)}</select><ChevronsUpDown aria-hidden="true" size={12} className="pointer-events-none absolute right-2.5 top-2.5 text-[#827a72]" /></label>
              <label className="relative"><span className="sr-only">考试局</span><select aria-label="考试局" value={board} onChange={(event) => setBoard(event.target.value)} className="w-full appearance-none rounded-lg border border-[#d9d4ce] bg-white px-3 py-2 pr-8 text-xs font-medium text-[#514b45] outline-none focus:ring-2 focus:ring-[#a69888]/30"><option value="">全部考试局</option>{boards.map((item) => <option key={item}>{item}</option>)}</select><ChevronsUpDown aria-hidden="true" size={12} className="pointer-events-none absolute right-2.5 top-2.5 text-[#827a72]" /></label>
            </div>
            <div className="mb-2 flex min-h-6 items-center justify-between gap-3 text-[11px] text-[#7a736b]"><span className="inline-flex items-center gap-1"><SlidersHorizontal size={12} />匹配 {filteredCourses.length} 门{filteredCourses.length > options.length ? ` · 显示前 ${options.length} 门` : ""}</span>{hasFilters && <button type="button" onClick={resetFilters} className="font-semibold text-[#675a4d] hover:underline">清除筛选</button>}</div>
            <div className="max-h-72 overflow-y-auto" role="listbox" aria-label="课程列表">
              {options.map((course) => {
                const selected = context?.qualificationId === course.qualificationId;
                return <button key={course.qualificationId} role="option" aria-selected={selected} type="button" onClick={() => { setCourse(createCourseContext(course)); setOpen(false); resetFilters(); }} className={cn("flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#eee8e1]", selected && "bg-[#e8e1d9]")}>
                  <Check size={14} className={cn("mt-0.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                  <span><strong className="text-[#3d3832]">{course.boardName} {course.subjectCode}</strong><span className="block text-xs text-[#6e675e]">{course.level} · {course.subjectName}</span></span>
                </button>;
              })}
              {options.length === 0 && <div className="rounded-lg border border-dashed border-[#d9d4ce] px-4 py-8 text-center text-xs leading-5 text-[#7a736b]">没有符合当前条件的现行课程。<button type="button" onClick={resetFilters} className="ml-1 font-semibold text-[#675a4d] hover:underline">清除筛选</button></div>}
            </div>
            {recent.length > 0 && <Link to={withCourseContext("/courses", context)} onClick={() => setOpen(false)} className="mt-2 block border-t border-[#e2ddd7] pt-2 text-right font-medium text-[#675a4d] no-underline">打开完整课程中心</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
