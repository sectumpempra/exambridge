import { Link } from "react-router-dom";
import { BarChart3, Calculator, LineChart } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import { withCourseContext } from "@/course-context/catalog";

export default function ResultsHub() {
  const { context, entry } = useCourseContext();
  const cards = [
    { key: "boundaries" as const, title: "分数线", question: "等级门槛是多少？", body: "按考试局、资格、科目和考季查询官方等级边界。", icon: LineChart, fallback: "/alevel" },
    { key: "statistics" as const, title: "成绩统计", question: "群体表现如何？", body: "查看历年各等级累计获得率和趋势。", icon: BarChart3, fallback: "/statistics" },
    { key: "calculator" as const, title: "等级预测", question: "个人成绩如何估算？", body: "仅对拥有完整、已核验 award route 的课程开放。", icon: Calculator, fallback: "/calculator" },
  ];
  return <div className="min-h-screen bg-gradient-to-b from-[#f0ede8] to-[#f5f2ee]"><Header title="成绩与等级" /><main className="mx-auto max-w-5xl px-4 py-12"><h1 className="text-3xl font-bold text-[#3d3832]">成绩与等级</h1><p className="max-w-2xl text-sm leading-7 text-[#625c54]">三个功能分别回答门槛、群体和个人问题。课程上下文只负责保持资格一致，考季和路线仍需在目标页面确认。</p><div className="mt-8 grid gap-5 md:grid-cols-3">{cards.map(({ key, title, question, body, icon: Icon, fallback }) => { const cap = entry?.capabilities[key]; const href = cap?.href ?? (!entry ? fallback : undefined); return <article key={key} className="flex min-h-60 flex-col rounded-2xl border border-[#ddd6ce] bg-white/75 p-6"><Icon size={24} className="text-[#806c59]" /><h2 className="mt-5 text-xl font-bold text-[#3d3832]">{title}</h2><strong className="text-sm text-[#806c59]">{question}</strong><p className="flex-1 text-sm leading-6 text-[#6e675e]">{body}</p>{href ? <Link to={withCourseContext(href, context)} className="rounded-lg bg-[#675a4d] px-4 py-2.5 text-center text-sm font-semibold text-white no-underline">进入{title}</Link> : <p className="m-0 rounded-lg bg-[#ebe7e2] px-3 py-2.5 text-center text-xs text-[#756e67]">{cap?.reason ?? "请先选择课程"}</p>}</article>; })}</div></main><Footer /></div>;
}
