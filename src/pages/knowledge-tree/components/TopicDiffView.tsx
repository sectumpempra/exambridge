import { useState } from "react";
import type { KnowledgeTreeNode } from "@/data/knowledge-tree/types";
import { X, Check, AlertCircle, Layers, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  overlap: import("@/data/knowledge-tree/types").OverlapData;
  nodes: KnowledgeTreeNode[];
  aOnlyNodes: Set<string>;
  bOnlyNodes: Set<string>;
}

export default function TopicDiffView({ overlap, nodes, aOnlyNodes, bOnlyNodes }: Props) {
  // Build node map
  const nodeMap = new Map<string, KnowledgeTreeNode>();
  for (const n of nodes) nodeMap.set(n.nodeId, n);

  const resolve = (ids: string[]) =>
    ids
      .map((id) => nodeMap.get(id))
      .filter(Boolean) as KnowledgeTreeNode[];

  const sharedNodes = resolve(
    [...new Set([...aOnlyNodes].filter((n) => bOnlyNodes.has(n)))]
  );
  const aOnlyArr = resolve([...aOnlyNodes].filter((n) => !bOnlyNodes.has(n)));
  const bOnlyArr = resolve([...bOnlyNodes].filter((n) => !aOnlyNodes.has(n)));

  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#8F7F6E]" />
          <h3 className="text-sm font-semibold text-[#3D3832]">Topic 差异分析</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E8E4DE]">
        <DiffColumn
          title="共同知识点"
          subtitle={overlap.comparison.A}
          count={sharedNodes.length}
          color="#5A7A5E"
          icon={<Check className="w-3 h-3 text-[#5A7A5E]" />}
          emptyText="这两科几乎没有共同知识点"
          items={sharedNodes}
        />
        <DiffColumn
          title={`${overlap.comparison.A} 独有`}
          subtitle={overlap.comparison.B}
          count={aOnlyArr.length}
          color="#C75B2A"
          icon={<X className="w-3 h-3 text-[#C75B2A]" />}
          emptyText={`${overlap.comparison.A} 不涉及的内容`}
          items={aOnlyArr}
        />
        <DiffColumn
          title={`${overlap.comparison.B} 独有`}
          subtitle={overlap.comparison.A}
          count={bOnlyArr.length}
          color="#5A7AA0"
          icon={<AlertCircle className="w-3 h-3 text-[#5A7AA0]" />}
          emptyText={`${overlap.comparison.B} 不涉及的内容`}
          items={bOnlyArr}
        />
      </div>
    </div>
  );
}

function DiffColumn({
  title,
  count,
  color,
  icon,
  emptyText,
  items,
}: {
  title: string;
  subtitle?: string;
  count: number;
  color: string;
  icon: React.ReactNode;
  emptyText: string;
  items: KnowledgeTreeNode[];
}) {
  const [expanded, setExpanded] = useState(false);
  const displayCount = expanded ? items.length : Math.min(items.length, 50);
  const displayed = items.slice(0, displayCount);

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold text-[#3D3832]">{title}</span>
        <span className="text-[10px] text-[#A8A095] ml-auto">{count}</span>
      </div>

      {items.length > 0 ? (
        <>
          <div className="space-y-1">
            {displayed.map((n) => (
              <div
                key={n.nodeId}
                className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-[#F5F2EE]"
                title={n.path.join(" > ")}
              >
                <span className="mt-0.5 flex-shrink-0">{icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#3D3832] truncate">
                    {n.path[n.path.length - 1]}
                  </div>
                  <div className="text-[10px] text-[#A8A095]">{n.nodeId}</div>
                </div>
              </div>
            ))}
          </div>

          {items.length > 50 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-[#8F7F6E] hover:text-[#3D3832] hover:bg-[#F5F2EE] rounded transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> 收起
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> 还有 {items.length - 50} 个，展开全部
                </>
              )}
            </button>
          )}
        </>
      ) : (
        <p className="text-xs text-[#A8A095] py-4 text-center">{emptyText}</p>
      )}
    </div>
  );
}
