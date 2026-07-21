import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

function SafeLink({ href, className, ...props }: ComponentPropsWithoutRef<"a">) {
  const safeHref = href && /^https?:\/\//i.test(href) ? href : undefined;
  if (!safeHref) return <span className={className}>{props.children}</span>;
  return <a {...props} href={safeHref} target="_blank" rel="noreferrer" className={cn("font-medium text-[#526b7e] underline decoration-[#a9b8bd] underline-offset-2", className)} />;
}

export default function AIMessageMarkdown({ content }: { content: string }) {
  return (
    <div className="ai-message-markdown break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: (props) => <h3 {...props} className="mb-2 mt-4 text-lg font-bold leading-7 first:mt-0" />,
          h2: (props) => <h3 {...props} className="mb-2 mt-4 text-base font-bold leading-7 first:mt-0" />,
          h3: (props) => <h4 {...props} className="mb-1.5 mt-3 text-sm font-bold leading-6 first:mt-0" />,
          p: (props) => <p {...props} className="mb-0 mt-2 whitespace-pre-wrap leading-7 first:mt-0" />,
          ul: (props) => <ul {...props} className="mb-0 mt-2 list-disc space-y-1 pl-5" />,
          ol: (props) => <ol {...props} className="mb-0 mt-2 list-decimal space-y-1 pl-5" />,
          li: (props) => <li {...props} className="pl-0.5 leading-7" />,
          blockquote: (props) => <blockquote {...props} className="mb-0 mt-3 border-l-2 border-[#a9b8bd] bg-[#f5f7f6] py-1 pl-3 text-[#5f5a54]" />,
          code: (props) => <code {...props} className="rounded bg-[#f0ede8] px-1.5 py-0.5 font-mono text-[0.9em] text-[#3f5963]" />,
          pre: (props) => <pre {...props} className="mt-3 overflow-x-auto rounded-xl bg-[#253b46] p-3 text-xs leading-6 text-[#edf3f3] [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit" />,
          table: (props) => <div className="mt-3 overflow-x-auto"><table {...props} className="w-full border-collapse text-left text-xs" /></div>,
          th: (props) => <th {...props} className="border border-[#ddd7cf] bg-[#f3f0eb] px-2.5 py-2 font-semibold" />,
          td: (props) => <td {...props} className="border border-[#e4ded7] px-2.5 py-2 align-top" />,
          hr: (props) => <hr {...props} className="my-4 border-0 border-t border-[#e2ddd6]" />,
          a: SafeLink,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
