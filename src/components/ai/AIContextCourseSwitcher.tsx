import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronsUpDown, Search, X } from "lucide-react";
import { createCourseContext, getDisplayCourseCatalog } from "@/course-context/catalog";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import { cn } from "@/lib/utils";

export default function AIContextCourseSwitcher() {
  const { context, entry, setCourse } = useCourseContext();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const courses = useMemo(() => getDisplayCourseCatalog("current"), []);
  const visibleCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => !query || `${course.boardName} ${course.subjectCode} ${course.subjectName} ${course.level}`.toLowerCase().includes(query)).slice(0, 60);
  }, [courses, search]);

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
          className="fixed inset-x-3 top-24 z-[90] max-h-[72vh] overflow-hidden rounded-2xl border border-[#d4cec6] bg-[#faf8f5] p-3 text-left shadow-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+8px)] sm:w-[min(78vw,520px)]"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><strong className="block text-sm text-[#3d3832]">更换课程</strong><span className="text-[11px] text-[#7a736b]">切换后，新问题会使用对应的已核验资料</span></div>
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
          <div className="mt-2 max-h-[min(54vh,360px)] overflow-y-auto" role="listbox" aria-label="AI 助手课程列表">
            {visibleCourses.map((course) => {
              const selected = context?.qualificationId === course.qualificationId;
              return (
                <button
                  key={course.qualificationId}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setCourse(createCourseContext(course));
                    setSearch("");
                    setOpen(false);
                  }}
                  className={cn("flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#eee8e1]", selected && "bg-[#e8e1d9]")}
                >
                  <Check size={14} className={cn("mt-0.5 shrink-0", selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                  <span className="min-w-0"><strong className="block truncate text-[#3d3832]">{course.boardName} {course.subjectCode} · {course.subjectName}</strong><span className="block text-xs text-[#6e675e]">{course.level}</span></span>
                </button>
              );
            })}
            {visibleCourses.length === 0 && <div className="rounded-lg border border-dashed border-[#d9d4ce] px-4 py-8 text-center text-xs text-[#7a736b]"><BookOpen size={19} className="mx-auto mb-2" />没有匹配的现行课程</div>}
          </div>
        </div>
      )}
    </div>
  );
}
