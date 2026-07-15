import { FileText, AlertCircle, FileSpreadsheet, Info } from "lucide-react";
import type { ExclusiveSubtopicItem } from "@/data/knowledge-tree/types-v3.2";
import { exportExclusiveTopicsToExcel } from "@/utils/exportExclusiveTopics";

interface Props {
  aName: string;
  bName: string;
  aExclusive: ExclusiveSubtopicItem[];
  bExclusive: ExclusiveSubtopicItem[];
}

function groupByTopic(items: ExclusiveSubtopicItem[]) {
  const groups = new Map<string, ExclusiveSubtopicItem[]>();
  for (const item of items) {
    const key = item.topicName || "其他";
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
          <span className="text-[11px] text-[#6E675E]">(0 个)</span>
        </div>
        <p className="text-xs leading-relaxed text-[#6E675E]">
          未发现整条独有的考纲原文。这不代表知识树没有局部或层级差异。
        </p>
      </div>
    );
  }

  const groups = groupByTopic(items);

  return (
    <div className="rounded-xl border border-[#E8E4DE] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
          <h4 className="text-sm font-semibold text-[#3D3832]">{title}</h4>
          <span className="text-[11px] text-[#6E675E]">({items.length} 个)</span>
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {Array.from(groups.entries()).map(([topic, topicItems]) => (
          <div key={topic} className="border-b border-[#F0EDE8] last:border-0">
            <div className="px-4 py-2 bg-[#F5F2EE]">
              <span className="text-[11px] font-medium text-[#625C54]">{topic}</span>
              <span className="text-[10px] text-[#6E675E] ml-2">({topicItems.length} 条)</span>
            </div>
            <div className="divide-y divide-[#F5F2EE]">
              {topicItems.map((item, idx) => (
                <ExclusiveItemRow key={item.subtopicId} item={item} index={idx} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExclusiveItemRow({ item, index }: { item: ExclusiveSubtopicItem; index: number }) {
  return (
    <div className="px-4 py-3 hover:bg-[#FAF8F5] transition-colors">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#F0EDE8] flex items-center justify-center text-[10px] font-medium text-[#625C54]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[#3D3832] leading-relaxed">{item.subtopicName}</p>
          {item.description && (
            <p className="mt-1 text-[11px] text-[#6E675E] leading-relaxed">{item.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            {item.paperRef && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8E4DE] text-[#625C54]">
                适用 Paper：{item.paperRef.join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExclusiveTopicsView({ aName, bName, aExclusive, bExclusive }: Props) {
  const hasAnyExclusive = aExclusive.length > 0 || bExclusive.length > 0;

  const handleExport = () => {
    exportExclusiveTopicsToExcel({ aName, bName, aExclusive, bExclusive });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#675A4D]" />
            <h3 className="text-sm font-semibold text-[#3D3832]">整条独有的考纲原文</h3>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#6E675E]">
            只有当一整条考纲陈述映射不到对方任何知识节点时，才计为独有；这比“知识节点差异”的判定更严格。
          </p>
        </div>
        {hasAnyExclusive && (
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9D4CE] bg-white px-3 py-1.5 text-xs font-medium text-[#435F7A] shadow-sm transition-all hover:bg-[#F5F2EE] hover:shadow active:scale-[0.98]"
            title="导出独有知识点 Excel"
          >
            <FileSpreadsheet size={14} />
            导出 Excel
          </button>
        )}
      </div>

      {!hasAnyExclusive && (
        <div className="flex items-start gap-3 rounded-xl border border-[#D9D4CE] bg-[#FAF8F5] p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#716A61]" />
          <p className="text-xs leading-relaxed text-[#625C54]">
            两科都没有整条完全独有的考纲原文，但仍可能存在局部教学点或知识树层级差异；请结合“知识节点差异”查看。
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-[#E5D4B7] bg-[#FBF6EC] px-4 py-3 text-[11px] leading-relaxed text-[#625C54]">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#745627]" />
        <p>本页按考纲主题分组，显示官方原文及适用 Paper。识别依赖知识树映射，不以英文措辞是否相同作简单文本匹配。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExclusiveList title={aName} items={aExclusive} accentColor="#A9471F" />
        <ExclusiveList title={bName} items={bExclusive} accentColor="#435F7A" />
      </div>
    </div>
  );
}
