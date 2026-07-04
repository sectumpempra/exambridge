import type { OverlapData, KnowledgeTreeNode } from "@/data/knowledge-tree/types";
import { X, Check, AlertCircle, Layers } from "lucide-react";

interface Props {
  overlap: OverlapData;
  nodes: KnowledgeTreeNode[];
}

const nodeMap = new Map<string, KnowledgeTreeNode>();

export default function TopicDiffView({ overlap, nodes }: Props) {
  // Build node map for lookup
  for (const n of nodes) nodeMap.set(n.nodeId, n);

  // Collect unique node IDs from details
  const sharedSet = new Set<string>();
  const aOnlySet = new Set<string>();
  const bOnlySet = new Set<string>();

  for (const d of overlap.details.AtoB) {
    if (d.hasOverlap) {
      for (const nid of d.sharedNodes) sharedSet.add(nid);
    }
  }

  // A-only: A's topics that map to nodes not in B's overlap
  const bSharedNodes = new Set<string>();
  for (const d of overlap.details.BtoA) {
    if (d.hasOverlap) {
      for (const nid of d.sharedNodes) bSharedNodes.add(nid);
    }
  }

  for (const d of overlap.details.AtoB) {
    if (d.hasOverlap) {
      for (const nid of d.sharedNodes) {
        if (!bSharedNodes.has(nid)) aOnlySet.add(nid);
      }
    }
  }

  for (const d of overlap.details.BtoA) {
    if (d.hasOverlap) {
      for (const nid of d.sharedNodes) {
        if (!sharedSet.has(nid)) bOnlySet.add(nid);
      }
    }
  }

  const sharedNodes = Array.from(sharedSet)
    .map((id) => nodeMap.get(id))
    .filter(Boolean) as KnowledgeTreeNode[];
  const aOnlyNodesArr = Array.from(aOnlySet)
    .map((id) => nodeMap.get(id))
    .filter(Boolean) as KnowledgeTreeNode[];
  const bOnlyNodesArr = Array.from(bOnlySet)
    .map((id) => nodeMap.get(id))
    .filter(Boolean) as KnowledgeTreeNode[];

  const renderNodeList = (items: KnowledgeTreeNode[], _color: string, icon: React.ReactNode) => (
    <div className="space-y-1">
      {items.slice(0, 50).map((n) => (
        <div
          key={n.nodeId}
          className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-[#F5F2EE]"
        >
          <span className="mt-0.5 flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#3D3832] truncate">
              {n.path.join(" > ")}
            </div>
            <div className="text-[10px] text-[#A8A095]">{n.nodeId}</div>
          </div>
        </div>
      ))}
      {items.length > 50 && (
        <p className="text-[10px] text-[#A8A095] text-center py-2">
          还有 {items.length - 50} 个节点...
        </p>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#8F7F6E]" />
          <h3 className="text-sm font-semibold text-[#3D3832]">Topic 差异分析</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E8E4DE]">
        {/* Shared */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5A7A5E]" />
            <span className="text-xs font-semibold text-[#3D3832]">共同知识点</span>
            <span className="text-[10px] text-[#A8A095] ml-auto">{sharedNodes.length}</span>
          </div>
          {sharedNodes.length > 0 ? (
            renderNodeList(sharedNodes, "#5A7A5E", <Check className="w-3 h-3 text-[#5A7A5E]" />)
          ) : (
            <p className="text-xs text-[#A8A095] py-4 text-center">无共同知识点</p>
          )}
        </div>

        {/* A Only */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C75B2A]" />
            <span className="text-xs font-semibold text-[#3D3832]">{overlap.comparison.A} 独有</span>
            <span className="text-[10px] text-[#A8A095] ml-auto">{aOnlyNodesArr.length}</span>
          </div>
          {aOnlyNodesArr.length > 0 ? (
            renderNodeList(aOnlyNodesArr, "#C75B2A", <X className="w-3 h-3 text-[#C75B2A]" />)
          ) : (
            <p className="text-xs text-[#A8A095] py-4 text-center">无独有知识点</p>
          )}
        </div>

        {/* B Only */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5A7AA0]" />
            <span className="text-xs font-semibold text-[#3D3832]">{overlap.comparison.B} 独有</span>
            <span className="text-[10px] text-[#A8A095] ml-auto">{bOnlyNodesArr.length}</span>
          </div>
          {bOnlyNodesArr.length > 0 ? (
            renderNodeList(bOnlyNodesArr, "#5A7AA0", <AlertCircle className="w-3 h-3 text-[#5A7AA0]" />)
          ) : (
            <p className="text-xs text-[#A8A095] py-4 text-center">无独有知识点</p>
          )}
        </div>
      </div>
    </div>
  );
}
