import { useState, useMemo } from "react";
import type { KnowledgeTreeNode } from "@/data/knowledge-tree/types";
import { ChevronRight, ChevronDown, Search } from "lucide-react";

interface Props {
  nodes: KnowledgeTreeNode[];
  highlightNodes?: Set<string>;
  aOnlyNodes?: Set<string>;
  bOnlyNodes?: Set<string>;
}

interface TreeItem {
  node: KnowledgeTreeNode;
  children: TreeItem[];
}

function buildHierarchy(nodes: KnowledgeTreeNode[]): TreeItem[] {
  const map = new Map<string, TreeItem>();
  for (const n of nodes) {
    map.set(n.nodeId, { node: n, children: [] });
  }
  const roots: TreeItem[] = [];
  for (const n of nodes) {
    const item = map.get(n.nodeId)!;
    if (n.parentNodeId && map.has(n.parentNodeId)) {
      map.get(n.parentNodeId)!.children.push(item);
    } else if (n.level <= 1) {
      roots.push(item);
    }
  }
  return roots;
}

function TreeNodeItem({
  item,
  depth,
  highlightNodes,
  aOnlyNodes,
  bOnlyNodes,
}: {
  item: TreeItem;
  depth: number;
  highlightNodes?: Set<string>;
  aOnlyNodes?: Set<string>;
  bOnlyNodes?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = item.children.length > 0;
  const nodeId = item.node.nodeId;
  const isHighlight = highlightNodes?.has(nodeId);
  const isAOnly = aOnlyNodes?.has(nodeId);
  const isBOnly = bOnlyNodes?.has(nodeId);

  const indentColors = ["#8F7F6E", "#5A7AA0", "#6B8F5E", "#A08078"];
  void indentColors[Math.min(depth, 3)]; // used for visual weight

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1 px-1 rounded cursor-pointer transition-colors hover:bg-[#F5F2EE]"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#A8A095] flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#A8A095] flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        {/* Status indicator */}
        {(isHighlight || isAOnly || isBOnly) && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: isAOnly ? "#C75B2A" : isBOnly ? "#5A7AA0" : "#5A7A5E",
            }}
          />
        )}

        <span
          className="text-xs font-medium truncate"
          style={{
            color: isAOnly ? "#C75B2A" : isBOnly ? "#5A7AA0" : isHighlight ? "#5A7A5E" : "#3D3832",
          }}
        >
          {item.node.path[item.node.path.length - 1]}
        </span>

        {item.node.level >= 3 && (
          <span className="text-[10px] text-[#C4BDB3] ml-1 flex-shrink-0">
            {item.node.nodeId}
          </span>
        )}
      </div>

      {expanded &&
        item.children.map((child) => (
          <TreeNodeItem
            key={child.node.nodeId}
            item={child}
            depth={depth + 1}
            highlightNodes={highlightNodes}
            aOnlyNodes={aOnlyNodes}
            bOnlyNodes={bOnlyNodes}
          />
        ))}
    </div>
  );
}

export default function KnowledgeTreeView({ nodes, highlightNodes, aOnlyNodes, bOnlyNodes }: Props) {
  const [search, setSearch] = useState("");

  useMemo(() => buildHierarchy(nodes), [nodes]);

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return nodes;
    const term = search.toLowerCase();
    return nodes.filter(
      (n) =>
        n.nodeId.toLowerCase().includes(term) ||
        n.path.some((p) => p.toLowerCase().includes(term)) ||
        n.description.toLowerCase().includes(term)
    );
  }, [nodes, search]);

  const filteredTree = useMemo(() => buildHierarchy(filteredNodes), [filteredNodes]);

  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <h3 className="text-sm font-semibold text-[#3D3832] mb-3">统一知识树</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C4BDB3]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索知识点..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E8E4DE] rounded-lg focus:border-[#8F7F6E] focus:outline-none"
          />
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[#8B8378]">
          <span>共 {nodes.length} 节点</span>
          {highlightNodes && highlightNodes.size > 0 && (
            <>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#5A7A5E]" />共同 {highlightNodes.size}</span>
              {aOnlyNodes && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C75B2A]" />A独有 {aOnlyNodes.size}</span>}
              {bOnlyNodes && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#5A7AA0]" />B独有 {bOnlyNodes.size}</span>}
            </>
          )}
        </div>
      </div>

      <div className="p-3 max-h-[600px] overflow-y-auto custom-scroll">
        {filteredTree.map((item) => (
          <TreeNodeItem
            key={item.node.nodeId}
            item={item}
            depth={0}
            highlightNodes={highlightNodes}
            aOnlyNodes={aOnlyNodes}
            bOnlyNodes={bOnlyNodes}
          />
        ))}
        {filteredTree.length === 0 && (
          <p className="text-center text-xs text-[#A8A095] py-8">未找到匹配的知识点</p>
        )}
      </div>
    </div>
  );
}
