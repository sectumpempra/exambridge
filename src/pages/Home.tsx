import { useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  FileSearch,
  FunctionSquare,
  GitCompareArrows,
  Search,
  Wrench,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import { COURSE_CATALOG, getDisplayCourseCatalog, withCourseContext } from "@/course-context/catalog";
import type { CourseFeature } from "@/course-context/types";

type TeacherTask = {
  title: string;
  description: string;
  result: string;
  to: string;
  icon: typeof CalendarDays;
  accent: string;
  surface: string;
  capabilities: CourseFeature[];
};

const TEACHER_TASKS: TeacherTask[] = [
  {
    title: "了解考试安排",
    description: "查看考季、最近考试日期、Paper 结构、计算器规则和官方材料。",
    result: "先把一门课的考试规则讲清楚",
    to: "/exam-overview",
    icon: CalendarDays,
    accent: "#44677C",
    surface: "#EDF3F6",
    capabilities: ["examOverview"],
  },
  {
    title: "比较两份考纲",
    description: "对照知识树、内容重合、差异重点和各自独有的考纲原文。",
    result: "为转轨与扩科找出教学增量",
    to: "/knowledge-tree",
    icon: GitCompareArrows,
    accent: "#456348",
    surface: "#EDF3ED",
    capabilities: ["syllabus"],
  },
  {
    title: "查看分数线与 A* 率",
    description: "区分等级门槛与考生表现，按考试局、考季和年份查看趋势。",
    result: "用数据判断难度与成绩表现",
    to: "/results",
    icon: BarChart3,
    accent: "#775E55",
    surface: "#F4EFED",
    capabilities: ["boundaries", "statistics"],
  },
  {
    title: "查找和比较 Paper",
    description: "按课程筛选试卷，查看组件代码、结构与两份 Paper 的差异。",
    result: "快速找到课堂和练习所需试卷",
    to: "/papers",
    icon: FileSearch,
    accent: "#A4512C",
    surface: "#F8F0EA",
    capabilities: ["papers"],
  },
  {
    title: "备课与练习工具",
    description: "继续使用刷题规划、函数画图和已核验的等级预测工具。",
    result: "把课程信息带入日常教学",
    to: "/tools",
    icon: Wrench,
    accent: "#655A70",
    surface: "#F2EFF5",
    capabilities: ["planner", "graph", "calculator"],
  },
];

const ONBOARDING_STEPS = [
  { number: "1", title: "选课程", description: "确认考试局、资格代码与现行考纲版本。" },
  { number: "2", title: "懂考试", description: "先看考试日期、Paper 结构和考场规则。" },
  { number: "3", title: "做分析与教学", description: "再进入考纲、成绩、试卷和备课工具。" },
];

const QUICK_TOOLS = [
  { title: "刷题规划", to: "/planner", icon: BookOpen },
  { title: "函数画图", to: "/graph", icon: FunctionSquare },
  { title: "等级预测", to: "/calculator", icon: Calculator },
];

export default function Home() {
  const navigate = useNavigate();
  const { context, entry } = useCourseContext();
  const [searchQuery, setSearchQuery] = useState("");
  const currentCourses = getDisplayCourseCatalog("current");
  const overviewCourses = currentCourses.filter((course) => course.capabilities.examOverview.status !== "unavailable");
  const boardCount = new Set(COURSE_CATALOG.map((course) => course.boardName)).size;

  const handleSearch = () => {
    const query = searchQuery.trim();
    navigate(query ? `/courses?search=${encodeURIComponent(query)}` : "/courses");
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") handleSearch();
  };

  const taskAvailability = (task: TeacherTask) => {
    if (!entry) return "选择课程后自动带入";
    return task.capabilities.some((feature) => entry.capabilities[feature].status !== "unavailable")
      ? "当前课程可用"
      : "当前课程待补充";
  };

  const continueHref = entry && entry.capabilities.examOverview.status !== "unavailable"
    ? "/exam-overview"
    : "/courses";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f3f0eb]">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-[#ded8d0] px-4 py-10 md:py-14">
          <div className="pointer-events-none absolute -right-32 -top-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(82,107,126,0.11),transparent_68%)]" />
          <div className="pointer-events-none absolute -bottom-48 -left-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(80,109,88,0.09),transparent_70%)]" />

          <div className="relative mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-[#675a4d]">面向国际课程教师的工作台</p>
              <h1 className="max-w-[760px] text-[clamp(34px,5vw,58px)] font-extrabold leading-[1.12] tracking-[-0.025em] text-[#332f2b]">
                从一门课程开始，<span className="text-[#526b7e]">快速进入教研任务</span>
              </h1>
              <p className="mt-5 max-w-[680px] text-[15px] leading-7 text-[#625c54] md:text-base">
                先确认课程与考试，再查看考纲、分数线、A* 率和 Paper。课程一旦选定，会自动带入各项工具。
              </p>

              <div className="mt-7 flex max-w-[680px] flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search aria-hidden="true" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746d65]" />
                  <Input
                    aria-label="搜索课程名称或资格代码"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="搜索课程名称或代码，如 9709、4MA1"
                    className="h-12 rounded-xl border-[#cfc7bd] bg-white pl-11 shadow-sm focus-visible:ring-[#526b7e]/35"
                  />
                </div>
                <Button onClick={handleSearch} className="h-12 rounded-xl bg-[#3f5d70] px-6 font-semibold text-white shadow-sm hover:bg-[#304c5f]">
                  选择课程 <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#716a61]">
                <span>常用课程</span>
                {["9709", "0580", "4MA1", "YMA01"].map((code) => (
                  <button key={code} type="button" onClick={() => navigate(`/courses?search=${encodeURIComponent(code)}`)} className="font-semibold text-[#526b7e] underline-offset-4 hover:underline">
                    {code}
                  </button>
                ))}
              </div>
            </div>

            <aside aria-label="当前课程" className="rounded-2xl border border-[#d7d0c7] bg-white/90 p-6 shadow-[0_18px_50px_rgba(61,56,50,0.08)] backdrop-blur-sm">
              {entry ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.12em] text-[#887d71]">继续当前课程</p>
                      <h2 className="mt-2 text-2xl font-bold text-[#332f2b]">{entry.subjectCode} · {entry.subjectName}</h2>
                      <p className="mt-1 text-sm text-[#625c54]">{entry.boardName} · {entry.level}</p>
                    </div>
                    <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-[#456348]" aria-hidden="true" />
                  </div>
                  <p className="mt-5 rounded-xl bg-[#f4f1ed] px-4 py-3 text-xs leading-5 text-[#625c54]">
                    {entry.specificationLabel ?? "当前数据版本"}。下方任务会沿用此课程，仍可随时切换。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2" aria-label="当前课程可用能力">
                    {[
                      ["examOverview", "考试概览"],
                      ["papers", "Paper"],
                      ["syllabus", "考纲"],
                      ["boundaries", "分数线"],
                      ["statistics", "成绩统计"],
                    ].map(([feature, label]) => {
                      const available = entry.capabilities[feature as CourseFeature].status !== "unavailable";
                      return (
                        <span key={feature} className={available ? "rounded-full bg-[#eaf1eb] px-2.5 py-1 text-[11px] font-medium text-[#456348]" : "rounded-full bg-[#f1eeea] px-2.5 py-1 text-[11px] text-[#857d74]"}>
                          {label}{available ? "可用" : "待补充"}
                        </span>
                      );
                    })}
                  </div>
                  <Button asChild className="mt-5 w-full rounded-xl bg-[#675a4d] text-white hover:bg-[#564a3f]">
                    <Link to={withCourseContext(continueHref, context)}>继续查看 <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf3f6] text-[#526b7e]">
                    <BookOpen className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold text-[#332f2b]">先选择一门课程</h2>
                  <p className="mt-2 text-sm leading-6 text-[#625c54]">选择考试局、资格代码和现行版本后，网站会显示这门课真正可用的考试信息与工具。</p>
                  <Button asChild className="mt-6 w-full rounded-xl bg-[#675a4d] text-white hover:bg-[#564a3f]">
                    <Link to="/courses">打开课程中心 <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                  </Button>
                </>
              )}
            </aside>
          </div>
        </section>

        <section className="px-4 py-14" aria-labelledby="teacher-tasks-title">
          <div className="mx-auto max-w-[1200px]">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.14em] text-[#675a4d]">按任务开始</p>
              <h2 id="teacher-tasks-title" className="mt-2 text-[clamp(26px,4vw,38px)] font-bold tracking-[-0.02em] text-[#332f2b]">你现在想做什么？</h2>
              <p className="mt-3 text-sm leading-6 text-[#625c54]">不需要先理解网站结构，直接选择当前教研目标。</p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              {TEACHER_TASKS.map((task, index) => {
                const Icon = task.icon;
                const status = taskAvailability(task);
                return (
                  <Link
                    key={task.title}
                    to={withCourseContext(task.to, context)}
                    className={`group rounded-2xl border border-[#d9d3cb] bg-white p-5 no-underline shadow-[0_2px_12px_rgba(61,56,50,0.04)] transition duration-300 hover:-translate-y-1 hover:border-[#bfb6aa] hover:shadow-[0_14px_32px_rgba(61,56,50,0.09)] ${index < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ color: task.accent, background: task.surface }}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className={status === "当前课程可用" ? "rounded-full bg-[#edf3ed] px-2.5 py-1 text-[10px] font-medium text-[#456348]" : "rounded-full bg-[#f2efeb] px-2.5 py-1 text-[10px] font-medium text-[#625c54]"}>
                        {status}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold text-[#332f2b]">{task.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#625c54]">{task.description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#ece7e1] pt-4">
                      <span className="text-xs font-medium" style={{ color: task.accent }}>{task.result}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#8b8278] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-[#ded8d0] bg-white/55 px-4 py-12" aria-labelledby="onboarding-title">
          <div className="mx-auto max-w-[1100px]">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-sm">
                <p className="text-xs font-semibold tracking-[0.14em] text-[#675a4d]">第一次使用</p>
                <h2 id="onboarding-title" className="mt-2 text-2xl font-bold text-[#332f2b]">三步建立清晰的教研路径</h2>
                <p className="mt-3 text-sm leading-6 text-[#625c54]">建议先了解考试，再做差异和成绩分析，避免把考试规则、等级门槛与群体表现混在一起。</p>
              </div>
              <ol className="grid flex-1 gap-3 sm:grid-cols-3">
                {ONBOARDING_STEPS.map((step) => (
                  <li key={step.number} className="rounded-xl border border-[#ded8d0] bg-[#faf8f5] p-5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#526b7e] text-sm font-bold text-white">{step.number}</span>
                    <h3 className="mt-4 font-bold text-[#3d3832]">{step.title}</h3>
                    <p className="mt-1.5 text-xs leading-5 text-[#625c54]">{step.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="px-4 py-12" aria-labelledby="quick-tools-title">
          <div className="mx-auto grid max-w-[1100px] gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 id="quick-tools-title" className="text-xl font-bold text-[#332f2b]">常用教学工具</h2>
              <p className="mt-2 text-sm text-[#625c54]">已经熟悉课程信息？可直接继续备课、作图或核验等级结果。</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {QUICK_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.to} to={withCourseContext(tool.to, context)} className="inline-flex items-center gap-2 rounded-xl border border-[#d5cec5] bg-white px-4 py-3 text-sm font-semibold text-[#514b45] no-underline transition hover:border-[#a69888] hover:text-[#675a4d]">
                    <Icon className="h-4 w-4" aria-hidden="true" /> {tool.title}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#27313a] px-4 py-10 text-white" aria-label="数据覆盖说明">
          <div className="mx-auto grid max-w-[1100px] gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-xl font-bold">数据边界清楚，结论才值得使用</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d4d9dc]">课程与考试材料以考试局官方来源为准；未发布的 A* 率会明确标为“官方尚未发布”，不提供估算。</p>
            </div>
            <dl className="grid grid-cols-3 gap-6 text-center">
              <div><dt className="text-xs text-[#bfc7cc]">现行课程</dt><dd className="mt-1 text-2xl font-bold">{currentCourses.length}</dd></div>
              <div><dt className="text-xs text-[#bfc7cc]">考试概览</dt><dd className="mt-1 text-2xl font-bold">{overviewCourses.length}</dd></div>
              <div><dt className="text-xs text-[#bfc7cc]">考试局</dt><dd className="mt-1 text-2xl font-bold">{boardCount}</dd></div>
            </dl>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
