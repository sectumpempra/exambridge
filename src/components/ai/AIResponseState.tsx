import { AlertTriangle, CircleStop, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AIAnswerState =
  | "streaming"
  | "complete"
  | "stopped"
  | "interrupted"
  | "rate-limited"
  | "service-unavailable"
  | "empty";

interface AIResponseStateProps {
  state: AIAnswerState;
  retryAfterSeconds?: number;
  onRetry?: () => void;
}

const stateCopy: Record<Exclude<AIAnswerState, "streaming" | "complete">, string> = {
  stopped: "已停止生成。这段内容未完成，不能作为完整结论导出。",
  interrupted: "连接在回答完成前中断。已保留收到的片段，请重试以获得完整回答。",
  "rate-limited": "请求较频繁，请稍后重试。",
  "service-unavailable": "AI 服务暂时不可用，请稍后重试。",
  empty: "服务没有返回可用回答，请重试。",
};

export default function AIResponseState({ state, retryAfterSeconds, onRetry }: AIResponseStateProps) {
  if (state === "complete") return null;
  if (state === "streaming") {
    return <div className="mt-3 inline-flex items-center gap-2 text-xs text-[#6f756f]" role="status">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#526b7e]" />正在生成已核验回答
    </div>;
  }
  const stopped = state === "stopped";
  return <div className={cn(
    "mt-3 rounded-xl border px-3 py-2.5 text-xs leading-5",
    stopped ? "border-[#d8cfc4] bg-[#f8f4ee] text-[#6f655a]" : "border-[#e0bbb0] bg-[#fff6f2] text-[#855e53]",
  )} role="status" aria-live="polite">
    <div className="flex items-start gap-2">
      {stopped ? <CircleStop size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
      <span>{stateCopy[state]}{state === "rate-limited" && retryAfterSeconds ? ` 建议等待 ${retryAfterSeconds} 秒。` : ""}</span>
    </div>
    {onRetry && <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-2 h-8 gap-1.5 bg-white text-xs">
      <RefreshCw size={13} />重新生成
    </Button>}
  </div>;
}
