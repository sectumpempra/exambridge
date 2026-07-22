import { ChevronDown, ShieldCheck } from "lucide-react";

export default function AIAssistantDisclosure() {
  return <details className="group rounded-2xl border border-[#d7d3cd] bg-white/65 px-4 py-3 text-[#625c54] shadow-sm">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#526b7e] focus-visible:ring-offset-2">
      <span className="inline-flex items-center gap-2"><ShieldCheck size={14} />数据、模型与隐私说明</span>
      <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="mt-3 grid gap-2 border-t border-[#e2ddd6] pt-3 text-[11px] leading-5 sm:grid-cols-3">
      <p className="m-0"><strong className="block text-[#403b35]">资料边界</strong>回答仅使用 ExamBridge 当前已核验的 active 数据；资料不足时会明确停止，不自行补写考试事实。</p>
      <p className="m-0"><strong className="block text-[#403b35]">模型处理</strong>非 AQA 问题只向 DeepSeek 发送筛选后的课程、Paper 与考纲上下文；AQA 使用本地确定性模板。</p>
      <p className="m-0"><strong className="block text-[#403b35]">隐私边界</strong>不会发送官方 PDF、API 密钥或个人账号资料；对话只保存在当前浏览器标签页，不保存跨设备记录。</p>
    </div>
  </details>;
}
