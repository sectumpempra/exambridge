import { useRef, useState } from "react";
import { Copy, Download, ExternalLink, FileCode2, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AICitation } from "@/domain-v2/ai-assistant";
import AIMessageMarkdown from "./AIMessageMarkdown";
import AIResponseState, { type AIAnswerState } from "./AIResponseState";
import {
  copyAnswerRichText,
  downloadAnswerHtml,
  downloadAnswerPng,
  type AIAnswerExportModel,
} from "./exportAIAnswer";

interface AIAnswerCardProps {
  messageId: string;
  content: string;
  citations?: AICitation[];
  state: AIAnswerState;
  retryAfterSeconds?: number;
  contextLabels: string[];
  onRetry?: () => void;
}

type ExportAction = "png" | "copy" | "html";

export default function AIAnswerCard({
  messageId,
  content,
  citations = [],
  state,
  retryAfterSeconds,
  contextLabels,
  onRetry,
}: AIAnswerCardProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<ExportAction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const buildModel = (): AIAnswerExportModel => {
    if (state !== "complete" || !content.trim() || !contentRef.current) {
      throw new Error("只有已完成的回答可以导出");
    }
    return {
      messageId,
      markdown: content,
      plainText: contentRef.current.innerText,
      renderedHtml: contentRef.current.innerHTML,
      citations,
      contextLabels,
      exportedAt: new Date().toISOString(),
      completionState: "complete",
    };
  };

  const runExport = async (action: ExportAction) => {
    if (busy) return;
    setBusy(action);
    setFeedback(null);
    try {
      const model = buildModel();
      if (action === "png") {
        const pages = await downloadAnswerPng(model);
        setFeedback(pages === 1 ? "PNG 已下载" : `回答较长，已导出 ${pages} 张连续 PNG`);
      } else if (action === "copy") {
        const format = await copyAnswerRichText(model);
        setFeedback(format === "rich" ? "已复制富文本和纯文本" : "浏览器不支持富文本，已复制纯文本");
      } else {
        downloadAnswerHtml(model);
        setFeedback("HTML 已下载");
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "导出失败，请重试");
    } finally {
      setBusy(null);
    }
  };

  return <div className="min-w-0">
    <div ref={contentRef} data-testid={`ai-answer-content-${messageId}`}>
      {content.trim()
        ? <AIMessageMarkdown content={content} />
        : state === "streaming" ? <p className="m-0 text-[#7d756c]">正在整理已核验资料…</p> : null}
    </div>
    <AIResponseState state={state} retryAfterSeconds={retryAfterSeconds} onRetry={onRetry} />
    {citations.length > 0 && <div className="mt-3 border-t border-[#ebe7e1] pt-2">
      <p className="m-0 text-[11px] font-semibold text-[#756e67]">来源</p>
      <ul className="m-0 mt-1 space-y-1 p-0">
        {citations.map((citation) => <li key={citation.sourceId} className="list-none">
          <a href={citation.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-xs font-medium text-[#526b7e] underline decoration-[#a9b8bd] underline-offset-2">
            <span>[{citation.sourceId}] {citation.title}</span><ExternalLink size={11} className="shrink-0" />
          </a>
          <span className="ml-1 text-[10px] text-[#8a8279]">{citation.dataVersion}</span>
        </li>)}
      </ul>
    </div>}
    {state === "complete" && content.trim() && <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#ebe7e1] pt-2" aria-label="导出此回答">
      <Button type="button" variant="ghost" size="sm" onClick={() => void runExport("png")} disabled={Boolean(busy)} className="h-8 gap-1.5 px-2 text-xs text-[#526b7e]" aria-label="将此回答导出为 PNG">
        {busy === "png" ? <Download size={13} className="animate-pulse" /> : <ImageDown size={13} />}导出 PNG
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => void runExport("copy")} disabled={Boolean(busy)} className="h-8 gap-1.5 px-2 text-xs text-[#526b7e]" aria-label="复制此回答的富文本">
        <Copy size={13} />复制富文本
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => void runExport("html")} disabled={Boolean(busy)} className="h-8 gap-1.5 px-2 text-xs text-[#526b7e]" aria-label="下载此回答的 HTML">
        <FileCode2 size={13} />下载 HTML
      </Button>
    </div>}
    {feedback && <div className="mt-1.5 text-[11px] text-[#65736e]" role="status" aria-live="polite">{feedback}</div>}
  </div>;
}
