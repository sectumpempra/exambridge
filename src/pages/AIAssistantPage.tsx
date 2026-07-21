import { Bot, BookOpenCheck, MessageCircleMore, ShieldCheck, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIChatPanel from "@/components/ai/AIChatPanel";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import { isAIAssistantEnabled } from "@/domain-v2/shared/feature-flags";

export default function AIAssistantPage() {
  const { context, entry } = useCourseContext();
  const enabled = isAIAssistantEnabled();
  return <div className="min-h-screen bg-[linear-gradient(180deg,#eef2f1_0%,#f5f2ee_42%,#f0ede8_100%)] text-[#3d3832]">
    <Header title="AI 问答" />
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
      <section className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-stretch">
        <div className="rounded-[30px] border border-[#ccd4d4] bg-[linear-gradient(145deg,#fdfcf9,#edf3f1)] p-6 shadow-[0_24px_70px_rgba(61,56,50,0.08)] sm:p-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#253b46] text-white"><Bot size={24} /></span>
          <p className="mb-0 mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#526b7e]">ExamBridge AI</p>
          <h1 className="mb-0 mt-2 text-3xl font-bold tracking-tight sm:text-4xl">先核对资料，再解释答案</h1>
          <p className="mb-0 mt-4 text-sm leading-7 text-[#625c54]">询问考试结构、Paper 规则、最近考试日期或两门数学考纲的差异。助手只接收当前已批准的数据，不自行搜索或补充考试事实。</p>
          <div className="mt-6 space-y-3">
            {[{ icon: BookOpenCheck, title: "已核验上下文", text: "只使用 ExamBridge 当前 active 数据" }, { icon: MessageCircleMore, title: "支持连续追问", text: "能结合本标签页内最近对话理解指代" }, { icon: ShieldCheck, title: "隐私与边界", text: "不保存跨设备记录，不需要个人敏感信息" }].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 rounded-2xl border border-white/80 bg-white/65 p-4"><Icon size={18} className="mt-0.5 shrink-0 text-[#526b7e]" /><div><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-[#756e67]">{text}</span></div></div>)}
          </div>
          <div className="mt-6 rounded-2xl bg-[#253b46] p-4 text-sm leading-6 text-[#dbe6e7]"><Sparkles size={16} className="mb-2" />{entry ? <>当前课程：<strong className="text-white">{entry.boardName} {entry.subjectCode} · {entry.subjectName}</strong></> : <>当前没有选择课程。你可以在问题中输入准确代码，例如 <strong className="text-white">9709</strong>；如果只说“这门数学”，助手会请你先选择。</>}</div>
        </div>
        {enabled ? <AIChatPanel
          fullHeight
          pageContext={{ pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: [], comparisonIds: entry?.knowledgeTreeCode ? [entry.knowledgeTreeCode] : [] }}
          qualificationIds={context ? [context.qualificationId] : []}
          syllabusVersions={entry?.specificationLabel ? [entry.specificationLabel] : []}
          contextLabel={entry ? `${entry.subjectCode} · ${entry.subjectName}` : "输入课程代码开始提问"}
        /> : <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-[#d9d4ce] bg-white p-8 text-center"><div><ShieldCheck size={34} className="mx-auto text-[#526b7e]" /><h2 className="mb-0 mt-4 text-xl font-bold">AI 助手正在内部验收</h2><p className="mb-0 mt-2 text-sm text-[#716a61]">公开入口尚未启用。</p></div></div>}
      </section>
    </main>
    <Footer />
  </div>;
}
