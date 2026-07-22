import { useState } from "react";
import { Bot, BookOpenCheck, MessageCircleMore, ShieldCheck, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIChatPanel from "@/components/ai/AIChatPanel";
import AIContextCourseSwitcher from "@/components/ai/AIContextCourseSwitcher";
import AIContextPaperSelector from "@/components/ai/AIContextPaperSelector";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import { isAIAssistantEnabled } from "@/domain-v2/shared/feature-flags";

export default function AIAssistantPage() {
  const { context, entry } = useCourseContext();
  const enabled = isAIAssistantEnabled();
  const [paperSelection, setPaperSelection] = useState({ knowledgeCode: "", paperId: "" });
  const selectedPaperId = paperSelection.knowledgeCode === entry?.knowledgeTreeCode ? paperSelection.paperId : "";
  return <div className="min-h-screen bg-[linear-gradient(180deg,#eef2f1_0%,#f5f2ee_42%,#f0ede8_100%)] text-[#3d3832]">
    <Header title="AI 问答" />
    <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7">
      <section className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-stretch xl:grid-cols-[230px_minmax(0,1fr)]">
        <div className="rounded-[22px] border border-[#ccd4d4] bg-[linear-gradient(145deg,#fdfcf9,#edf3f1)] p-4 shadow-[0_20px_55px_rgba(61,56,50,0.07)]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#253b46] text-white"><Bot size={18} /></span>
          <p className="mb-0 mt-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#526b7e]">ExamBridge AI</p>
          <h1 className="mb-0 mt-1 text-lg font-bold leading-6 tracking-tight">全站考试事实查询</h1>
          <p className="mb-0 mt-2 text-[11px] leading-5 text-[#625c54]">直接询问考试结构、Paper 规则、合分、分数线或多个资格的差异。课程筛选不是必填项。</p>
          <div className="mt-3 space-y-1.5">
            {[{ icon: BookOpenCheck, title: "已核验资料", text: "仅使用 active 数据" }, { icon: MessageCircleMore, title: "连续追问", text: "理解本标签页内指代" }, { icon: ShieldCheck, title: "隐私边界", text: "不保存跨设备记录" }].map(({ icon: Icon, title, text }) => <div key={title} className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/65 px-2.5 py-2"><Icon size={14} className="shrink-0 text-[#526b7e]" /><div><strong className="block text-[11px]">{title}</strong><span className="block text-[10px] leading-4 text-[#756e67]">{text}</span></div></div>)}
          </div>
          <div className="mt-3 rounded-lg bg-[#253b46] px-2.5 py-2.5 text-[10px] leading-4 text-[#dbe6e7]"><Sparkles size={13} className="mb-1" />可以不选课程直接提问；问题中明确写出的资格始终优先。</div>
        </div>
        {enabled ? <AIChatPanel
          fullHeight
          pageContext={{ pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: selectedPaperId ? [selectedPaperId] : [], comparisonIds: entry?.knowledgeTreeCode ? [entry.knowledgeTreeCode] : [] }}
          qualificationIds={context ? [context.qualificationId] : []}
          syllabusVersions={entry?.specificationLabel ? [entry.specificationLabel] : []}
          contextLabel={entry ? `${entry.subjectCode} · ${entry.subjectName}` : "未限定范围"}
          contextControl={<div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2"><AIContextCourseSwitcher /><AIContextPaperSelector knowledgeCode={entry?.knowledgeTreeCode} value={selectedPaperId} onChange={(paperId) => setPaperSelection({ knowledgeCode: entry?.knowledgeTreeCode ?? "", paperId })} /></div>}
        /> : <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-[#d9d4ce] bg-white p-8 text-center"><div><ShieldCheck size={34} className="mx-auto text-[#526b7e]" /><h2 className="mb-0 mt-4 text-xl font-bold">AI 助手正在内部验收</h2><p className="mb-0 mt-2 text-sm text-[#716a61]">公开入口尚未启用。</p></div></div>}
      </section>
    </main>
    <Footer />
  </div>;
}
