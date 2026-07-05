import { useState, useMemo } from "react";
import type { KnowledgeTreeNode } from "@/data/knowledge-tree/types";
import { X, Check, AlertCircle, Layers, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  overlap: import("@/data/knowledge-tree/types").OverlapData;
  nodes: KnowledgeTreeNode[];
  sharedNodes: Set<string>;
  aOnlyNodes: Set<string>;
  bOnlyNodes: Set<string>;
}

export default function TopicDiffView({ overlap, nodes, sharedNodes, aOnlyNodes, bOnlyNodes }: Props) {
  // Build node map for path/description lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, KnowledgeTreeNode>();
    for (const n of nodes) map.set(n.nodeId, n);
    return map;
  }, [nodes]);

  const resolve = (ids: Set<string>) =>
    Array.from(ids)
      .map((id) => nodeMap.get(id))
      .filter(Boolean) as KnowledgeTreeNode[];

  const sharedArr = resolve(sharedNodes);
  const aOnlyArr = resolve(aOnlyNodes);
  const bOnlyArr = resolve(bOnlyNodes);

  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#8F7F6E]" />
          <h3 className="text-sm font-semibold text-[#3D3832]">知识点差异分析</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E8E4DE]">
        <DiffColumn
          title="共同知识点"
          subtitle={`${overlap.comparison.A} ∩ ${overlap.comparison.B}`}
          count={sharedArr.length}
          color="#5A7A5E"
          icon={<Check className="w-3 h-3 text-[#5A7A5E]" />}
          emptyText="两科几乎没有共同知识点"
          items={sharedArr}
        />
        <DiffColumn
          title={`${overlap.comparison.A} 独有`}
          subtitle={`仅在 ${overlap.comparison.A} 中出现`}
          count={aOnlyArr.length}
          color="#C75B2A"
          icon={<X className="w-3 h-3 text-[#C75B2A]" />}
          emptyText="无不独有内容"
          items={aOnlyArr}
        />
        <DiffColumn
          title={`${overlap.comparison.B} 独有`}
          subtitle={`仅在 ${overlap.comparison.B} 中出现`}
          count={bOnlyArr.length}
          color="#5A7AA0"
          icon={<AlertCircle className="w-3 h-3 text-[#5A7AA0]" />}
          emptyText="无不独有内容"
          items={bOnlyArr}
        />
      </div>
    </div>
  );
}

function DiffColumn({
  title,
  subtitle,
  count,
  color,
  icon,
  emptyText,
  items,
}: {
  title: string;
  subtitle: string;
  count: number;
  color: string;
  icon: React.ReactNode;
  emptyText: string;
  items: KnowledgeTreeNode[];
}) {
  const [expanded, setExpanded] = useState(false);
  const displayCount = expanded ? items.length : Math.min(items.length, 30);
  const displayed = items.slice(0, displayCount);

  return (
    <div className="p-4">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-[#3D3832]">{title}</span>
          <span className="text-[10px] text-[#A8A095] ml-auto">{count} 个</span>
        </div>
        <div className="mt-1 text-[10px] text-[#A8A095] pl-4.5">{subtitle}</div>
      </div>

      {items.length > 0 ? (
        <>
          <div className="space-y-1 max-h-[500px] overflow-y-auto custom-scroll">
            {displayed.map((n) => (
              <div
                key={n.nodeId}
                className="py-1.5 px-2 rounded hover:bg-[#F5F2EE]"
                title={n.description || n.path.join(" > ")}
              >
                {/* Full path */}
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex-shrink-0">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-[#3D3832] leading-relaxed">
                      {n.path.join(" > ")}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {/* Node ID badge */}
                      <span className="text-[10px] text-[#A8A095] font-mono">{n.nodeId}</span>
                      {/* Level badge */}
                      <span className="text-[9px] px-1 py-0.5 rounded bg-[#F0EDE8] text-[#8B8378]">
                        L{n.level}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {items.length > 30 && (
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
                  <ChevronDown className="w-3 h-3" /> 还有 {items.length - 30} 个，展开全部
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
