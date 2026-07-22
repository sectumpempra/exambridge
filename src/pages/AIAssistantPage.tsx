import { useState } from "react";
import { Bot, SearchCheck, ShieldCheck } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIChatPanel from "@/components/ai/AIChatPanel";
import AIAssistantDisclosure from "@/components/ai/AIAssistantDisclosure";
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
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ccd4d4] bg-white/70 px-3.5 py-2.5 shadow-[0_10px_30px_rgba(61,56,50,0.05)] sm:px-4">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#253b46] text-white"><Bot size={16} /></span>
          <div className="min-w-[220px] flex-1">
            <h1 className="m-0 text-sm font-bold leading-5 tracking-tight sm:text-base">全站考试事实查询</h1>
            <p className="m-0 mt-0.5 text-[11px] leading-4 text-[#6c655d]">直接提问考试结构、Paper、合分、分数线或多个资格的差异；课程筛选不是必填项。</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c9d5d3] bg-[#f6faf9] px-2.5 py-1 text-[10px] font-semibold text-[#526b7e]"><SearchCheck size={12} />已核验资料</span>
        </div>
        {enabled ? <AIChatPanel
          fullHeight
          pageContext={{ pageType: "assistant-home", route: "/ai-assistant", selectedPaperIds: selectedPaperId ? [selectedPaperId] : [], comparisonIds: entry?.knowledgeTreeCode ? [entry.knowledgeTreeCode] : [] }}
          qualificationIds={context ? [context.qualificationId] : []}
          syllabusVersions={entry?.specificationLabel ? [entry.specificationLabel] : []}
          contextLabel={entry ? `${entry.subjectCode} · ${entry.subjectName}` : "未限定范围"}
          contextControl={<div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2"><AIContextCourseSwitcher /><AIContextPaperSelector knowledgeCode={entry?.knowledgeTreeCode} value={selectedPaperId} onChange={(paperId) => setPaperSelection({ knowledgeCode: entry?.knowledgeTreeCode ?? "", paperId })} /></div>}
        /> : <div className="flex min-h-[560px] items-center justify-center rounded-[28px] border border-[#d9d4ce] bg-white p-8 text-center"><div><ShieldCheck size={34} className="mx-auto text-[#526b7e]" /><h2 className="mb-0 mt-4 text-xl font-bold">AI 助手正在内部验收</h2><p className="mb-0 mt-2 text-sm text-[#716a61]">公开入口尚未启用。</p></div></div>}
        {enabled && <AIAssistantDisclosure />}
      </section>
    </main>
    <Footer />
  </div>;
}
