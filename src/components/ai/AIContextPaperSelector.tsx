import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { loadKnowledgeV5Manifest, type KnowledgeV5ManifestEntry } from "@/data/knowledge-tree/loader-v5";

type Props = {
  knowledgeCode?: string;
  value: string;
  onChange: (paperId: string) => void;
};

export default function AIContextPaperSelector({ knowledgeCode, value, onChange }: Props) {
  const [loaded, setLoaded] = useState<{ knowledgeCode: string; entry: KnowledgeV5ManifestEntry | null; failed: boolean }>({
    knowledgeCode: "",
    entry: null,
    failed: false,
  });
  const current = loaded.knowledgeCode === knowledgeCode ? loaded : { entry: null, failed: false };

  useEffect(() => {
    let active = true;
    if (!knowledgeCode) return () => { active = false; };
    void loadKnowledgeV5Manifest()
      .then((manifest) => {
        if (active) setLoaded({ knowledgeCode, entry: manifest.mappings.find((mapping) => mapping.code === knowledgeCode) ?? null, failed: false });
      })
      .catch(() => { if (active) setLoaded({ knowledgeCode, entry: null, failed: true }); });
    return () => { active = false; };
  }, [knowledgeCode]);

  const { entry, failed } = current;
  if (!knowledgeCode || failed || (entry && entry.paperDefinitions.length === 0)) return null;

  return (
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-[#625c54]">
      <FileText size={13} className="shrink-0 text-[#526b7e]" aria-hidden="true" />
      <span className="sr-only">限定 AI 回答使用的 Paper</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={!entry}
        className="max-w-[230px] rounded-md border border-[#d4cec6] bg-white/80 px-2 py-1 text-xs text-[#4c4640] outline-none focus:ring-2 focus:ring-[#8f8172]/30 disabled:opacity-60"
        aria-label="限定 AI 回答使用的 Paper"
      >
        <option value="">全部 Paper（可在问题中指定）</option>
        {entry?.paperDefinitions.map((paper) => (
          <option key={paper.paperId} value={paper.paperId}>{paper.code} · {paper.name}</option>
        ))}
      </select>
    </label>
  );
}
