import { Link } from "react-router-dom";
import { CalendarCheck, FunctionSquare, Share2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import { withCourseContext } from "@/course-context/catalog";

export default function ToolsHub() {
  const { context, entry } = useCourseContext();
  const tools = [
    { key: "planner" as const, title: "刷题规划", icon: CalendarCheck, href: "/planner", text: "根据课程的真实 Paper 候选安排个人练习；不会生成机构扩科安排。" },
    { key: "graph" as const, title: "函数画图", icon: FunctionSquare, href: "/graph", text: "数学课程会显示课程入口；其他课程仍可把它作为独立工具使用。" },
  ];
  return <div className="min-h-screen bg-gradient-to-b from-[#f0ede8] to-[#f5f2ee]"><Header title="教学工具" /><main className="mx-auto max-w-5xl px-4 py-12"><h1 className="text-3xl font-bold text-[#3d3832]">教学工具</h1><p className="max-w-2xl text-sm leading-7 text-[#625c54]">围绕课程内容组织个人备考和课堂演示，不包含机构业务流程、自动扩科计划或班级诊断。</p><div className="mt-8 grid gap-5 md:grid-cols-2">{tools.map(({ key, title, icon: Icon, href, text }) => { const cap = entry?.capabilities[key]; const usable = !entry || cap?.status !== "unavailable" || key === "graph"; return <article key={key} className="rounded-2xl border border-[#ddd6ce] bg-white/75 p-6"><Icon size={25} className="text-[#806c59]" /><h2 className="text-xl font-bold">{title}</h2><p className="min-h-14 text-sm leading-6 text-[#6e675e]">{text}</p>{usable ? <Link to={withCourseContext(href, context)} className="inline-block rounded-lg bg-[#675a4d] px-4 py-2.5 text-sm font-semibold text-white no-underline">打开工具</Link> : <span className="text-xs text-[#756e67]">{cap?.reason}</span>}</article>; })}</div><section className="mt-6 rounded-2xl border border-[#ddd6ce] bg-[#faf8f5] p-6"><div className="flex items-center gap-3"><Share2 size={22} /><h2 className="m-0 text-lg font-bold">导出与分享</h2></div><p className="mb-0 text-sm leading-6 text-[#6e675e]">课程上下文会写入 URL，可跨浏览器恢复；各页面继续负责自己的筛选参数。导出内容以页面当前筛选结果为准，并对表格公式注入进行防护。</p></section></main><Footer /></div>;
}
