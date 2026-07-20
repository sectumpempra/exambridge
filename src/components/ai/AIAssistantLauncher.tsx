import { Sparkles } from "lucide-react";
import AIChatPanel from "./AIChatPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { isAIAssistantEnabled } from "@/domain-v2/shared/feature-flags";
import type { AIPageContext } from "@/domain-v2/ai-assistant";

interface AIAssistantLauncherProps {
  pageContext: AIPageContext;
  qualificationIds?: string[];
  syllabusVersions?: string[];
  contextLabel: string;
}

export default function AIAssistantLauncher(props: AIAssistantLauncherProps) {
  if (!isAIAssistantEnabled()) return null;
  return <Sheet>
    <SheetTrigger asChild>
      <Button type="button" className="gap-2 rounded-xl bg-[#253b46] px-4 text-white shadow-md hover:bg-[#344f5b]"><Sparkles size={16} />询问 AI 助手</Button>
    </SheetTrigger>
    <SheetContent side="right" className="w-full border-0 bg-[#f0ede8] p-0 sm:max-w-[620px]">
      <SheetTitle className="sr-only">ExamBridge AI 助手</SheetTitle>
      <SheetDescription className="sr-only">根据当前页面已核验资料连续提问</SheetDescription>
      <div className="h-[100dvh] p-0 sm:p-3"><AIChatPanel {...props} className="h-full rounded-none sm:rounded-[26px]" /></div>
    </SheetContent>
  </Sheet>;
}
