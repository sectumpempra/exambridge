import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bot, CircleStop, ExternalLink, Maximize2, Minimize2, Send, ShieldCheck, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AIStreamEventSchema,
  aiSessionStorageKey,
  pruneAIChatHistory,
  type AICitation,
  type AIClarification,
  type AIChatMessage,
  type AIPageContext,
  type AIQueryScope,
  type AIResolvedContext,
} from "@/domain-v2/ai-assistant";
import { cn } from "@/lib/utils";
import AIMessageMarkdown from "./AIMessageMarkdown";

type DisplayMessage = AIChatMessage & {
  id: string;
  citations?: AICitation[];
  pending?: boolean;
  error?: boolean;
};

type StoredSessionV1 = {
  version: 1;
  messages: DisplayMessage[];
  resolvedContext?: AIResolvedContext;
};

type StoredSession = {
  version: 2;
  messages: DisplayMessage[];
  resolvedContext?: AIResolvedContext;
  scopes: AIQueryScope[];
  detachedFromPageContext: boolean;
};

interface AIChatPanelProps {
  pageContext: AIPageContext;
  qualificationIds?: string[];
  syllabusVersions?: string[];
  scopes?: AIQueryScope[];
  contextLabel?: string;
  contextControl?: ReactNode;
  className?: string;
  fullHeight?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "考试结构是什么？",
  "各张 Paper 可以使用计算器吗？",
  "最近一场已核验的考试是什么时候？",
  "请用家长容易理解的方式解释。",
];

export function safeStoredSession(value: string | null): StoredSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as (StoredSession & { roleView?: string }) | StoredSessionV1;
    if (![1, 2].includes(parsed.version) || !Array.isArray(parsed.messages)) return null;
    const messages = parsed.messages.filter((message) =>
      message && typeof message.id === "string"
      && (message.role === "user" || message.role === "assistant")
      && typeof message.content === "string"
      && message.content.length <= 2_000
    ).slice(-12);
    return parsed.version === 2
      ? { version: 2, messages, resolvedContext: parsed.resolvedContext, scopes: parsed.scopes ?? [], detachedFromPageContext: parsed.detachedFromPageContext ?? false }
      : { version: 2, messages, resolvedContext: parsed.resolvedContext, scopes: [], detachedFromPageContext: false };
  } catch {
    return null;
  }
}

async function consumeSSE(
  response: Response,
  onEvent: (event: ReturnType<typeof AIStreamEventSchema.parse>) => void,
) {
  if (!response.body) throw new Error("AI 服务没有返回可读取的数据流");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const consume = (eventText: string) => {
    const data = eventText.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data) return;
    const parsed = AIStreamEventSchema.safeParse(JSON.parse(data));
    if (!parsed.success) throw new Error("AI 服务返回了无法识别的数据");
    onEvent(parsed.data);
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    events.forEach(consume);
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
}

export default function AIChatPanel({
  pageContext,
  qualificationIds = [],
  syllabusVersions = [],
  scopes,
  contextLabel,
  contextControl,
  className,
  fullHeight = false,
}: AIChatPanelProps) {
  const pageScopes = useMemo<AIQueryScope[]>(() => scopes ?? (qualificationIds.length > 0 || syllabusVersions.length > 0 ? [{
    awardQualificationIds: [],
    qualificationVersionIds: syllabusVersions.slice(0, 4),
    catalogQualificationIds: qualificationIds.slice(0, 4),
    source: "page-context",
  }] : []), [qualificationIds, scopes, syllabusVersions]);
  const storageKey = useMemo(() => aiSessionStorageKey([
    pageContext.pageType,
    ...qualificationIds,
    ...pageContext.comparisonIds,
    ...pageContext.selectedPaperIds,
  ].join(":")), [pageContext, qualificationIds]);
  const initial = useMemo(() => safeStoredSession(typeof window === "undefined" ? null : window.sessionStorage.getItem(storageKey)), [storageKey]);
  const [messages, setMessages] = useState<DisplayMessage[]>(initial?.messages ?? []);
  const [resolvedContext, setResolvedContext] = useState<AIResolvedContext | undefined>(initial?.resolvedContext);
  const [queryScopes, setQueryScopes] = useState<AIQueryScope[]>(initial?.scopes.length ? initial.scopes : pageScopes);
  const [detachedFromPageContext, setDetachedFromPageContext] = useState(initial?.detachedFromPageContext ?? false);
  const [input, setInput] = useState("");
  const [inputExpanded, setInputExpanded] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [clarification, setClarification] = useState<AIClarification | null>(null);
  const [clarificationSelections, setClarificationSelections] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const restored = safeStoredSession(window.sessionStorage.getItem(storageKey));
    queueMicrotask(() => {
      setMessages(restored?.messages ?? []);
      setResolvedContext(restored?.resolvedContext);
      setQueryScopes(restored?.scopes.length ? restored.scopes : pageScopes);
      setDetachedFromPageContext(restored?.detachedFromPageContext ?? false);
      setClarification(null);
      setClarificationSelections({});
      setSuggestions(DEFAULT_SUGGESTIONS);
      setServiceError(null);
    });
    return () => abortRef.current?.abort();
  }, [pageScopes, storageKey]);

  useEffect(() => {
    const stable = messages.filter((message) => !message.pending).slice(-12);
    window.sessionStorage.setItem(storageKey, JSON.stringify({ version: 2, messages: stable, resolvedContext, scopes: queryScopes, detachedFromPageContext } satisfies StoredSession));
  }, [detachedFromPageContext, messages, queryScopes, resolvedContext, storageKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  useEffect(() => {
    if (!panelExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [panelExpanded]);

  const clearConversation = () => {
    abortRef.current?.abort();
    window.sessionStorage.removeItem(storageKey);
    setMessages([]);
    setResolvedContext(undefined);
    setQueryScopes(pageScopes);
    setDetachedFromPageContext(false);
    setSuggestions(DEFAULT_SUGGESTIONS);
    setClarification(null);
    setClarificationSelections({});
    setServiceError(null);
    setGenerating(false);
  };

  const removeResolvedScope = (index: number) => {
    if (!resolvedContext) return;
    const remaining = resolvedContext.labels.map((_, itemIndex) => itemIndex).filter(itemIndex => itemIndex !== index);
    const nextResolved: AIResolvedContext = {
      awardQualificationIds: remaining.map(itemIndex => resolvedContext.awardQualificationIds[itemIndex]).filter(Boolean),
      qualificationVersionIds: remaining.map(itemIndex => resolvedContext.qualificationVersionIds[itemIndex]).filter(Boolean),
      qualificationIds: remaining.map(itemIndex => resolvedContext.qualificationIds[itemIndex]).filter(Boolean),
      qualificationCodes: remaining.map(itemIndex => resolvedContext.qualificationCodes[itemIndex]).filter(Boolean),
      paperIds: [],
      labels: remaining.map(itemIndex => resolvedContext.labels[itemIndex]).filter(Boolean),
    };
    setResolvedContext(nextResolved);
    setQueryScopes(nextResolved.labels.map((_, itemIndex) => ({
      awardQualificationIds: nextResolved.awardQualificationIds[itemIndex] ? [nextResolved.awardQualificationIds[itemIndex]] : [],
      qualificationVersionIds: nextResolved.qualificationVersionIds[itemIndex] ? [nextResolved.qualificationVersionIds[itemIndex]] : [],
      catalogQualificationIds: nextResolved.qualificationIds[itemIndex] ? [nextResolved.qualificationIds[itemIndex]] : [],
      source: "manual-selection" as const,
    })).filter(scope => scope.awardQualificationIds.length + scope.qualificationVersionIds.length + scope.catalogQualificationIds.length > 0));
    setDetachedFromPageContext(true);
  };

  const send = async (content = input, options?: { scopes?: AIQueryScope[] }) => {
    const trimmed = content.trim();
    if (!trimmed || generating || trimmed.length > 2_000) return;
    const userMessage: DisplayMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantId = crypto.randomUUID();
    const assistantMessage: DisplayMessage = { id: assistantId, role: "assistant", content: "", pending: true };
    const requestMessages = pruneAIChatHistory(
      [...messages.filter((message) => !message.pending && !message.error), userMessage]
        .map(({ role, content: messageContent }) => ({ role, content: messageContent })),
    );
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setClarification(null);
    setClarificationSelections({});
    setGenerating(true);
    setServiceError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    let authoritativeAnswer = "";
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          version: 2,
          mode: "exam_assistant",
          scopes: (options?.scopes ?? queryScopes).slice(0, 4),
          qualificationIds: [],
          syllabusVersions: [],
          pageContext: detachedFromPageContext
            ? { ...pageContext, selectedPaperIds: [], comparisonIds: [] }
            : pageContext,
          messages: requestMessages,
          locale: /^en\b/i.test(navigator.language) ? "en-GB" : "zh-CN",
          resolvedContext,
          featureConsent: {
            externalSearch: { enabled: false },
            boundaryPrediction: { enabled: false },
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { retryAfterSeconds?: number };
        throw new Error(response.status === 429
          ? `请求较频繁，请在 ${payload.retryAfterSeconds ?? 30} 秒后重试。`
          : response.status === 503 ? "AI 服务当前繁忙，请稍后再试。" : "AI 服务请求失败。");
      }
      await consumeSSE(response, (event) => {
        if (event.type === "meta") setResolvedContext(event.resolvedContext);
        if (event.type === "delta") {
          setMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, content: message.content + event.text }
            : message));
        }
        if (event.type === "citations") {
          setMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, citations: event.citations }
            : message));
        }
        if (event.type === "suggestions") setSuggestions(event.suggestions);
        if (event.type === "clarification") {
          setClarification(event.clarification);
          setClarificationSelections({});
        }
        if (event.type === "done") {
          authoritativeAnswer = event.answer;
          setResolvedContext(event.resolvedContext);
          setMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, content: event.answer, pending: false }
            : message));
        }
        if (event.type === "error") throw new Error(event.message);
      });
      if (!authoritativeAnswer) throw new Error("AI 回答没有完整结束，请重试。");
    } catch (error) {
      const stopped = controller.signal.aborted;
      const message = stopped ? "已停止生成。" : error instanceof Error ? error.message : "AI 服务暂时不可用。";
      setMessages((current) => current.map((item) => item.id === assistantId
        ? { ...item, content: item.content || message, pending: false, error: !stopped }
        : item));
      if (!stopped) setServiceError(message);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setGenerating(false);
    }
  };

  const confirmClarification = () => {
    if (!clarification || generating) return;
    const selected = clarification.groups.map(group =>
      group.options.find(option => option.optionId === clarificationSelections[group.groupId]),
    );
    if (selected.some(option => !option)) return;
    const options = selected.filter((option): option is NonNullable<typeof option> => Boolean(option));
    const nextScopes = options.map(option => option.scope);
    setQueryScopes(nextScopes);
    setDetachedFromPageContext(true);
    void send(`已选择：${options.map(option => `${option.label}（${option.qualificationCode}）`).join("；")}。请继续回答我上一条问题。`, { scopes: nextScopes });
  };

  return (
    <section className={cn(
      "flex min-h-0 flex-col overflow-hidden rounded-[26px] border border-[#d7d3cd] bg-[#fdfcf9] shadow-[0_24px_70px_rgba(61,56,50,0.1)]",
      panelExpanded
        ? "fixed inset-2 z-[100] h-[calc(100dvh-1rem)] min-h-0 sm:inset-4 sm:h-[calc(100dvh-2rem)]"
        : fullHeight ? "h-[calc(100dvh-8rem)] min-h-[680px] resize-y" : "h-[min(820px,calc(100dvh-4rem))] resize-y",
      className,
    )} aria-label="ExamBridge AI 对话">
      <header className="border-b border-[#e2ddd6] bg-[linear-gradient(135deg,#f7f3ed,#eef3f2)] px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#253b46] text-white"><Bot size={19} /></span><div className="min-w-0"><h2 className="m-0 text-base font-bold text-[#302d2a]">ExamBridge AI 助手</h2>{contextControl ?? <p className="m-0 mt-0.5 truncate text-xs text-[#6e675e]">{contextLabel || "基于已核验资料回答"}</p>}</div></div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPanelExpanded(value => !value)} className="text-[#675a4d]" aria-label={panelExpanded ? "恢复回答区大小" : "放大回答区"} title={panelExpanded ? "恢复回答区大小" : "放大回答区"}>{panelExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span className="hidden md:inline">{panelExpanded ? "恢复" : "放大回答区"}</span></Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearConversation} disabled={messages.length === 0} className="text-[#675a4d]" aria-label="清空对话"><Trash2 size={15} /><span className="hidden sm:inline">清空</span></Button>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#ccd8d5] bg-white/70 px-3 py-2 text-[11px] leading-4 text-[#50645e]"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><span>仅根据 ExamBridge 已核验资料回答。非 AQA 问题会发送给 DeepSeek 生成回答，发送内容仅包括筛选后的课程、Paper 与考纲上下文；AQA 使用本地确定性模板。不会发送官方 PDF、API 密钥或个人账号资料。</span></div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#625c54]" aria-live="polite">
          <span className="font-semibold">检索范围：</span>
          {resolvedContext?.labels.length
            ? resolvedContext.labels.map((label, index) => <span key={`${label}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-[#cbd5d4] bg-white px-2 py-1"><span>{label}</span><button type="button" onClick={() => removeResolvedScope(index)} aria-label={`移除 ${label}`} className="rounded-full p-0.5 hover:bg-[#edf2f1]"><X size={11} /></button></span>)
            : <span className="rounded-full border border-dashed border-[#bfc9c7] px-2 py-1">未限定范围</span>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
        {messages.length === 0 && <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-8 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#526b7e]/10 text-[#526b7e]"><Sparkles size={25} /></span><h3 className="mb-0 mt-4 text-lg font-bold text-[#3d3832]">直接问考试事实或考纲问题</h3><p className="mb-0 mt-2 max-w-md text-sm leading-6 text-[#716a61]">通用规则无需选择课程；具体分数线或合分问题请写明资格、年份、考季和路线。可以连续追问。</p></div>}
        <div className="space-y-4">
          {messages.map((message) => <article key={message.id} className={cn("flex gap-2.5", message.role === "user" && "justify-end")}>
            {message.role === "assistant" && <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#253b46] text-white"><Bot size={14} /></span>}
            <div className={cn("max-w-[min(94%,900px)] rounded-2xl px-4 py-3 text-sm leading-7", message.role === "user" ? "bg-[#675a4d] text-white" : "border border-[#e0dcd6] bg-white text-[#403b35]", message.error && "border-[#dbb7ad] bg-[#fff7f4] text-[#855e53]")}>
              {message.role === "assistant"
                ? <AIMessageMarkdown content={message.content || (message.pending ? "正在整理已核验资料…" : "")} />
                : <p className="m-0 whitespace-pre-wrap break-words">{message.content || (message.pending ? "正在整理已核验资料…" : "")}</p>}
              {message.pending && <span className="mt-2 inline-flex items-center gap-1 text-xs text-[#7d756c]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#526b7e]" />DeepSeek 正在生成</span>}
              {message.citations && message.citations.length > 0 && <div className="mt-3 border-t border-[#ebe7e1] pt-2"><p className="m-0 text-[11px] font-semibold text-[#756e67]">来源</p><ul className="m-0 mt-1 space-y-1 p-0">{message.citations.map((citation) => <li key={citation.sourceId} className="list-none"><a href={citation.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-xs font-medium text-[#526b7e] underline decoration-[#a9b8bd] underline-offset-2"><span>[{citation.sourceId}] {citation.title}</span><ExternalLink size={11} className="shrink-0" /></a><span className="ml-1 text-[10px] text-[#8a8279]">{citation.dataVersion}</span></li>)}</ul></div>}
            </div>
            {message.role === "user" && <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#a69888] text-white"><UserRound size={14} /></span>}
          </article>)}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="border-t border-[#e2ddd6] bg-[#f8f5f1] p-3 sm:p-4">
        {clarification && <div className="mb-3 max-h-[min(45dvh,420px)] overflow-y-auto rounded-2xl border border-[#cbd5d4] bg-white p-3 text-left" role="group" aria-label="请选择准确资格">
          <p className="m-0 text-sm font-semibold text-[#3d3832]">{clarification.prompt}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {clarification.groups.map(group => <fieldset key={group.groupId} className="min-w-0 rounded-xl border border-[#e2ddd6] p-2.5">
              <legend className="px-1 text-xs font-bold text-[#625c54]">{group.label}</legend>
              <div className="space-y-2">
                {group.options.map(option => <label key={option.optionId} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition", clarificationSelections[group.groupId] === option.optionId ? "border-[#526b7e] bg-[#eef3f5]" : "border-[#ece8e2] hover:border-[#b9c5c8]") }>
                  <input type="radio" name={`clarification-${group.groupId}`} value={option.optionId} checked={clarificationSelections[group.groupId] === option.optionId} onChange={() => setClarificationSelections(current => ({ ...current, [group.groupId]: option.optionId }))} className="mt-1" />
                  <span className="min-w-0"><span className="block text-xs font-semibold text-[#403b35]">{option.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-[#756e67]">{option.description}</span></span>
                </label>)}
              </div>
            </fieldset>)}
          </div>
          <div className="mt-3 flex justify-end"><Button type="button" size="sm" onClick={confirmClarification} disabled={clarification.groups.some(group => group.required && !clarificationSelections[group.groupId])} className="bg-[#253b46] hover:bg-[#344f5b]">{clarification.submitLabel}</Button></div>
        </div>}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="快捷问题">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(suggestion)} disabled={generating} className="shrink-0 rounded-full border border-[#d7d1ca] bg-white px-3 py-1.5 text-xs font-medium text-[#625c54] transition hover:border-[#a69888] hover:text-[#675a4d] disabled:opacity-50">{suggestion}</button>)}</div>
        {serviceError && <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-[#fff1ec] px-3 py-2 text-xs text-[#8a5c4d]" role="alert"><span>{serviceError}</span><button type="button" onClick={() => setServiceError(null)} className="font-semibold">关闭</button></div>}
        <div className="relative flex items-end gap-2 rounded-2xl border border-[#d2cdc6] bg-white p-2 focus-within:border-[#8f8172] focus-within:ring-2 focus-within:ring-[#a69888]/15">
          <button type="button" onClick={() => setInputExpanded(value => !value)} className="absolute right-2 top-2 z-10 rounded-lg p-1.5 text-[#756e67] hover:bg-[#f1ede7]" aria-label={inputExpanded ? "缩小输入框" : "放大输入框"} title={inputExpanded ? "缩小输入框" : "放大输入框"}>{inputExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
          <Textarea value={input} onChange={(event) => setInput(event.target.value.slice(0, 2_000))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="输入问题；Shift + Enter 换行" aria-label="向 ExamBridge AI 提问" className={cn("min-h-[144px] resize-y border-0 bg-transparent px-2 py-2.5 pr-10 shadow-none focus-visible:ring-0", inputExpanded ? "max-h-[50dvh] min-h-[300px]" : "max-h-[320px]")} disabled={generating} />
          {generating ? <Button type="button" onClick={() => abortRef.current?.abort()} className="mb-0.5 shrink-0 bg-[#8b655c] hover:bg-[#76544c]"><CircleStop size={16} />停止</Button> : <Button type="button" onClick={() => void send()} disabled={!input.trim() || input.length > 2_000} className="mb-0.5 shrink-0 bg-[#253b46] hover:bg-[#344f5b]"><Send size={16} />发送</Button>}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[10px] text-[#625c54]"><span>对话仅保存在当前浏览器标签页；AQA 本地处理，其他问题只发送筛选后的已核验上下文</span><span className={cn("shrink-0", input.length > 1_900 && "font-semibold text-[#8a5c4d]")}>{input.length}/2000</span></div>
      </footer>
    </section>
  );
}
