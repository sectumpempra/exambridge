import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronsUpDown, Clock3, Search, SlidersHorizontal, X } from "lucide-react";
import { createCourseContext, getCourseEntry, getDisplayCourseCatalog } from "@/course-context/catalog";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import type { CourseContextEntry, SubjectCategory } from "@/course-context/types";
import { cn } from "@/lib/utils";
import {
  countCoursesBySubject,
  filterCoursePickerCourses,
  getCoursePickerBoardLabel,
  getCoursePickerCapabilityLabel,
  groupCoursePickerCourses,
} from "./coursePickerModel";

export default function AIContextCourseSwitcher() {
  const { context, entry, recent, setCourse } = useCourseContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [subjectCategory, setSubjectCategory] = useState<SubjectCategory | "all">("all");
  const [board, setBoard] = useState("");
  const [level, setLevel] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const courses = useMemo(() => getDisplayCourseCatalog("current"), []);
  const categories = useMemo(() => countCoursesBySubject(courses), [courses]);
  const boards = useMemo(() => [...new Set(courses.map((course) => course.boardName))].sort((a, b) => getCoursePickerBoardLabel(a).localeCompare(getCoursePickerBoardLabel(b), "zh-CN")), [courses]);
  const levels = useMemo(() => [...new Set(courses.map((course) => course.level))].sort((a, b) => a.localeCompare(b, "en-GB")), [courses]);
  const recentCourses = useMemo(() => {
    const selected = [entry, ...recent.map(getCourseEntry)].filter((course): course is CourseContextEntry => Boolean(course));
    return [...new Map(selected.map((course) => [course.qualificationId, course])).values()].slice(0, 5);
  }, [entry, recent]);
  const filtersActive = Boolean(search.trim() || subjectCategory !== "all" || board || level);
  const visibleCourses = useMemo(() => filterCoursePickerCourses(courses, { search, subjectCategory, board, level }), [board, courses, level, search, subjectCategory]);
  const groups = useMemo(() => groupCoursePickerCourses(visibleCourses, { subjectCategory, board }), [board, subjectCategory, visibleCourses]);

  const chooseCourse = (course: CourseContextEntry) => {
    setCourse(createCourseContext(course));
    setSearch("");
    setOpen(false);
  };

  const clearFilters = () => {
    setSearch("");
    setSubjectCategory("all");
    setBoard("");
    setLevel("");
  };

  const renderCourse = (course: CourseContextEntry) => {
    const selected = context?.qualificationId === course.qualificationId;
    return (
      <button
        key={course.qualificationId}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => chooseCourse(course)}
        className={cn("flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[#eee8e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f8172]/35", selected && "bg-[#e8e1d9]")}
      >
        <Check size={14} className={cn("mt-0.5 shrink-0", selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <strong className="block text-[#3d3832]">{course.subjectCode} · {course.subjectName}</strong>
          <span className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[#6e675e]">
            <span>{getCoursePickerBoardLabel(course.boardName)}</span><span>{course.level}</span><span>{getCoursePickerCapabilityLabel(course)}</span>
          </span>
        </span>
      </button>
    );
  };

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
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

  return (
    <div className="relative mt-0.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="group flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs text-[#625c54] transition hover:bg-white/75 hover:text-[#3d3832] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f8172]/35"
      >
        <span className="truncate">{entry ? `${entry.subjectCode} · ${entry.subjectName}` : "尚未选择课程"}</span>
        <span className="hidden shrink-0 font-semibold text-[#526b7e] sm:inline">{entry ? "更换课程" : "选择课程"}</span>
        <ChevronsUpDown size={13} className="shrink-0 text-[#7c756c] group-hover:text-[#526b7e]" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="更换 AI 助手课程"
          className="fixed inset-x-3 top-20 z-[90] max-h-[78vh] overflow-hidden rounded-2xl border border-[#d4cec6] bg-[#faf8f5] p-3 text-left shadow-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:w-[min(86vw,680px)]"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><strong className="block text-sm text-[#3d3832]">选择课程范围</strong><span className="text-[11px] text-[#7a736b]">按学科或考试局浏览；也可以直接搜索名称与代码</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="关闭课程选择" className="rounded-md p-1.5 text-[#6e675e] hover:bg-[#eee8e1]"><X size={16} /></button>
          </div>
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-[#8a8279]" aria-hidden="true" />
            <span className="sr-only">搜索课程</span>
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索考试局、课程名称或代码"
              className="w-full rounded-lg border border-[#d9d4ce] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#a69888]/30"
            />
          </label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="课程筛选">
            <label className="text-[10px] font-semibold text-[#756e66]">学科类别
              <select value={subjectCategory} onChange={(event) => setSubjectCategory(event.target.value as SubjectCategory | "all")} className="mt-1 w-full rounded-lg border border-[#d9d4ce] bg-white px-2 py-1.5 text-xs font-normal text-[#3d3832]">
                <option value="all">全部学科</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}（{category.count}）</option>)}
              </select>
            </label>
            <label className="text-[10px] font-semibold text-[#756e66]">考试局
              <select value={board} onChange={(event) => setBoard(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d9d4ce] bg-white px-2 py-1.5 text-xs font-normal text-[#3d3832]">
                <option value="">全部考试局</option>{boards.map((value) => <option key={value} value={value}>{getCoursePickerBoardLabel(value)}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-semibold text-[#756e66]">资格级别
              <select value={level} onChange={(event) => setLevel(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d9d4ce] bg-white px-2 py-1.5 text-xs font-normal text-[#3d3832]">
                <option value="">全部级别</option>{levels.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#756e66]">
            <span>{filtersActive ? `找到 ${visibleCourses.length} 门现行课程` : "先选学科类别，避免被某一考试局占满"}</span>
            {filtersActive && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-[#526b7e] hover:bg-[#eee8e1]"><SlidersHorizontal size={12} />清除筛选</button>}
          </div>
          <div className="mt-1 max-h-[min(51vh,410px)] overflow-y-auto pr-0.5" role="listbox" aria-label="AI 助手课程列表">
            {!filtersActive && recentCourses.length > 0 && <section aria-labelledby="ai-course-recent-heading" className="mb-2 rounded-xl border border-[#e0dbd5] bg-white p-1.5">
              <h3 id="ai-course-recent-heading" className="m-0 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-[#645e57]"><Clock3 size={12} />当前与最近使用</h3>
              {recentCourses.map(renderCourse)}
            </section>}
            {!filtersActive && <section aria-labelledby="ai-course-subject-heading">
              <h3 id="ai-course-subject-heading" className="m-0 px-1 py-1 text-[11px] font-bold text-[#645e57]">按学科浏览</h3>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {categories.map((category) => <button key={category.id} type="button" onClick={() => setSubjectCategory(category.id)} className="rounded-xl border border-[#ded8d1] bg-white px-3 py-2.5 text-left hover:border-[#a99c8f] hover:bg-[#f3eee8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f8172]/35"><strong className="block text-xs text-[#3d3832]">{category.label}</strong><span className="mt-0.5 block text-[10px] text-[#7a736b]">{category.count} 门现行课程</span></button>)}
              </div>
            </section>}
            {filtersActive && groups.map((group) => <section key={group.id} aria-label={`${group.label}，${group.courses.length} 门课程`} className="mb-2 rounded-xl border border-[#e0dbd5] bg-white p-1.5">
              <h3 className="m-0 flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] font-bold text-[#645e57]"><span>{group.label}</span><span className="font-normal text-[#8a8279]">{group.courses.length} 门</span></h3>
              {group.courses.map(renderCourse)}
            </section>)}
            {filtersActive && visibleCourses.length === 0 && <div className="rounded-lg border border-dashed border-[#d9d4ce] px-4 py-8 text-center text-xs text-[#7a736b]"><BookOpen size={19} className="mx-auto mb-2" />没有匹配的现行课程；请尝试清除部分筛选</div>}
          </div>
        </div>
      )}
    </div>
  );
}
