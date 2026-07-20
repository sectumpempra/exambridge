import { FileText, AlertCircle, FileSpreadsheet, Info, ExternalLink, ChevronDown } from "lucide-react";
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

const statusLabels = {
  shared: "共享",
  partial: "部分重合",
  exclusive: "确定独有",
  unresolved: "待核验",
  "non-comparable": "不参与比较",
} as const;

const statusClasses = {
  shared: "bg-[#F1F7F2] text-[#456348]",
  partial: "bg-[#FBF6EC] text-[#745627]",
  exclusive: "bg-[#FFF2EC] text-[#A9471F]",
  unresolved: "bg-[#F5F2EE] text-[#625C54]",
  "non-comparable": "bg-[#F2F6FA] text-[#435F7A]",
} as const;

type DisplayStatus = Exclude<NonNullable<ExclusiveSubtopicItem["comparisonStatus"]>, "shared">;
const displayStatusOrder: DisplayStatus[] = ["exclusive", "partial", "unresolved", "non-comparable"];

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

  const hasV5Statuses = items.some((item) => item.comparisonStatus);
  const sections = hasV5Statuses
    ? displayStatusOrder.map((status) => ({ status, items: items.filter((item) => item.comparisonStatus === status) })).filter((section) => section.items.length)
    : [{ status: null, items }];

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
        {sections.map((section) => (
          <section key={section.status ?? "legacy-exclusive"} aria-label={section.status ? statusLabels[section.status] : undefined}>
            {section.status && (
              <div className={`sticky top-0 z-[1] flex items-center justify-between border-b border-[#E8E4DE] px-4 py-2 text-[11px] font-semibold ${statusClasses[section.status]}`}>
                <span>{statusLabels[section.status]}</span>
                <span>{section.items.length} 条</span>
              </div>
            )}
            {Array.from(groupByTopic(section.items).entries()).map(([topic, topicItems]) => (
              <div key={`${section.status ?? "legacy"}-${topic}`} className="border-b border-[#F0EDE8] last:border-0">
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
          </section>
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
          <p className="text-sm text-[#3D3832] leading-6">{item.subtopicName}</p>
          {item.description && (
            <p className="mt-1 text-[11px] text-[#6E675E] leading-relaxed">{item.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[#625C54]">
            {item.comparisonStatus && <span className={`rounded px-1.5 py-0.5 font-medium ${statusClasses[item.comparisonStatus]}`}>{statusLabels[item.comparisonStatus]}</span>}
            {item.sectionId && <span className="rounded bg-[#F0EDE8] px-1.5 py-0.5">{item.sectionId}</span>}
            {item.syllabusVersion && <span className="rounded bg-[#F0EDE8] px-1.5 py-0.5">{item.syllabusVersion}</span>}
            {item.printedPage && <span className="rounded bg-[#F0EDE8] px-1.5 py-0.5">印刷页 {item.printedPage}</span>}
            {item.pdfPage && <span className="rounded bg-[#F0EDE8] px-1.5 py-0.5">PDF 页 {item.pdfPage}</span>}
            {item.paperRef && (
              <span className="rounded bg-[#E8E4DE] px-1.5 py-0.5">
                适用 Paper：{item.paperRef.join(", ")}
              </span>
            )}
            {item.tiers?.map((tier) => <span key={tier} className="rounded bg-[#FBF6EC] px-1.5 py-0.5">{tier}</span>)}
            {item.routes?.map((route) => <span key={route} className="rounded bg-[#F2F6FA] px-1.5 py-0.5">{route}</span>)}
            {item.dimensionLabels?.map((dimension) => <span key={dimension} className="rounded bg-[#F1F7F2] px-1.5 py-0.5">{dimension}</span>)}
          </div>
          {item.decisionReason && <p className="mt-2 text-[11px] leading-relaxed text-[#6E675E]"><strong className="text-[#3D3832]">判定原因：</strong>{item.decisionReason}</p>}
          {item.conceptLabels?.length ? <p className="mt-1 text-[11px] leading-relaxed text-[#6E675E]"><strong className="text-[#3D3832]">知识概念：</strong>{item.conceptLabels.join("、")}</p> : null}
          {item.sourceLocator && <p className="mt-1 break-words text-[11px] leading-relaxed text-[#6E675E]"><strong className="text-[#3D3832]">Source Ref：</strong>{item.sourceLocator}</p>}
          {(item.notesText?.length || item.examplesText?.length) && (
            <details className="group mt-2 rounded-lg border border-[#E8E4DE] bg-[#FAF8F5] px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium text-[#625C54]">
                Notes / examples
                <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-[#625C54]">
                {item.notesText?.map((note, noteIndex) => <p key={`note-${noteIndex}`}><strong>Note：</strong>{note}</p>)}
                {item.examplesText?.map((example, exampleIndex) => <p key={`example-${exampleIndex}`}><strong>Example：</strong>{example}</p>)}
              </div>
            </details>
          )}
          {item.sourceUrl && (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[#435F7A] underline-offset-2 hover:underline">
              官方来源 <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExclusiveTopicsView({ aName, bName, aExclusive, bExclusive }: Props) {
  const hasAnyExclusive = aExclusive.length > 0 || bExclusive.length > 0;
  const hasV5Statuses = [...aExclusive, ...bExclusive].some((item) => item.comparisonStatus);

  const handleExport = () => {
    exportExclusiveTopicsToExcel({ aName, bName, aExclusive, bExclusive });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#675A4D]" />
            <h3 className="text-sm font-semibold text-[#3D3832]">{hasV5Statuses ? "独有、部分重合与待核验考纲原文" : "整条独有的考纲原文"}</h3>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#6E675E]">
            只有经过完整复核、且与对方不存在 exact、partial、broader 或 narrower 关系的原子考纲陈述，才计为确定独有。
          </p>
        </div>
        {hasAnyExclusive && (
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9D4CE] bg-white px-3 py-1.5 text-xs font-medium text-[#435F7A] shadow-sm transition-all hover:bg-[#F5F2EE] hover:shadow active:scale-[0.98]"
            title={hasV5Statuses ? "导出考纲差异 Excel" : "导出独有知识点 Excel"}
          >
            <FileSpreadsheet size={14} />
            {hasV5Statuses ? "导出差异 Excel" : "导出 Excel"}
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
        <p>本页按考纲主题分组，显示完整原子 statement、版本和来源定位。Notes / examples 默认收起；待核验与不参与比较的记录不会被计为确定独有。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExclusiveList title={aName} items={aExclusive} accentColor="#A9471F" />
        <ExclusiveList title={bName} items={bExclusive} accentColor="#435F7A" />
      </div>
    </div>
  );
}
