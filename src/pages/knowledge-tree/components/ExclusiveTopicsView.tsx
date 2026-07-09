import { FileText, AlertCircle, FileSpreadsheet } from "lucide-react";
import type { ExclusiveSubtopicItem } from "@/data/knowledge-tree/types-v3.2";
import { exportExclusiveTopicsToExcel } from "@/utils/exportExclusiveTopics";

interface Props {
  aName: string;
  bName: string;
  aExclusive: ExclusiveSubtopicItem[];
  bExclusive: ExclusiveSubtopicItem[];
}

function groupByPaper(items: ExclusiveSubtopicItem[]) {
  const groups = new Map<string | null, ExclusiveSubtopicItem[]>();
  for (const item of items) {
    const key = item.paperRef ? item.paperRef.join(", ") : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

function ExclusiveList({
  title,
  items,
  accentColor,
}: {
  title: string;
  items: ExclusiveSubtopicItem[];
  accentColor: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[#E8E4DE] bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
          <h4 className="text-sm font-semibold text-[#3D3832]">{title}</h4>
          <span className="text-[11px] text-[#A8A095]">(0 个)</span>
        </div>
        <p className="text-xs text-[#A8A095]">无独有知识点</p>
      </div>
    );
  }

  const groups = groupByPaper(items);
  const hasPapers = groups.size > 1 || (groups.size === 1 && groups.keys().next().value !== null);

  return (
    <div className="rounded-xl border border-[#E8E4DE] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
          <h4 className="text-sm font-semibold text-[#3D3832]">{title}</h4>
          <span className="text-[11px] text-[#A8A095]">({items.length} 个)</span>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {hasPapers ? (
          // Group by paper
          Array.from(groups.entries()).map(([paper, paperItems]) => (
            <div key={paper ?? "all"} className="border-b border-[#F0EDE8] last:border-0">
              <div className="px-4 py-2 bg-[#F5F2EE]">
                <span className="text-[11px] font-medium text-[#8B8378]">
                  {paper ?? "整科"}
                </span>
                <span className="text-[10px] text-[#A8A095] ml-2">({paperItems.length} 个)</span>
              </div>
              <div className="divide-y divide-[#F5F2EE]">
                {paperItems.map((item, idx) => (
                  <ExclusiveItemRow key={item.subtopicId} item={item} index={idx} />
                ))}
              </div>
            </div>
          ))
        ) : (
          // No paper grouping
          <div className="divide-y divide-[#F5F2EE]">
            {items.map((item, idx) => (
              <ExclusiveItemRow key={item.subtopicId} item={item} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ExclusiveItemRow({ item, index }: { item: ExclusiveSubtopicItem; index: number }) {
  return (
    <div className="px-4 py-3 hover:bg-[#FAF8F5] transition-colors">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#F0EDE8] flex items-center justify-center text-[10px] font-medium text-[#8B8378]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#3D3832] leading-relaxed">{item.subtopicName}</p>
          {item.description && (
            <p className="mt-1 text-[11px] text-[#A8A095] leading-relaxed">{item.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0EDE8] text-[#8B8378]">
              {item.topicName}
            </span>
            {item.paperRef && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8E4DE] text-[#8B8378]">
                {item.paperRef.join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExclusiveTopicsView({ aName, bName, aExclusive, bExclusive }: Props) {
  if (aExclusive.length === 0 && bExclusive.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E8E4DE] bg-white p-8 text-center">
        <AlertCircle className="w-8 h-8 text-[#C4BDB3] mx-auto mb-3" />
        <p className="text-sm text-[#8B8378]">两个考试的知识点完全重合，无独有内容</p>
      </div>
    );
  }

  const hasAnyExclusive = aExclusive.length > 0 || bExclusive.length > 0;

  const handleExport = () => {
    exportExclusiveTopicsToExcel({ aName, bName, aExclusive, bExclusive });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#8F7F6E]" />
          <h3 className="text-sm font-semibold text-[#3D3832]">独有知识点（考纲原文）</h3>
          <span className="text-[11px] text-[#A8A095]">
            基于知识树节点交集识别，非文本匹配
          </span>
        </div>
        {hasAnyExclusive && (
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9D4CE] bg-white px-3 py-1.5 text-xs font-medium text-[#5A7AA0] shadow-sm transition-all hover:bg-[#F5F2EE] hover:shadow active:scale-[0.98]"
            title="导出独有知识点 Excel"
          >
            <FileSpreadsheet size={14} />
            导出 Excel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExclusiveList title={aName} items={aExclusive} accentColor="#C75B2A" />
        <ExclusiveList title={bName} items={bExclusive} accentColor="#5A7AA0" />
      </div>
    </div>
  );
}
