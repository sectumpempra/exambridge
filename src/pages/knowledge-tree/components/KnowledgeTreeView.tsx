import { useState, useMemo } from "react";
import type { KnowledgeTreeNode } from "@/data/knowledge-tree/types";
import { ChevronRight, ChevronDown, Search, Folder } from "lucide-react";

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

  const statusLabel = isAOnly ? "A独有" : isBOnly ? "B独有" : isHighlight ? "共同" : null;
  const statusColor = isAOnly ? "#A9471F" : isBOnly ? "#435F7A" : isHighlight ? "#456348" : null;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 px-1 rounded cursor-pointer transition-colors hover:bg-[#F5F2EE] min-h-[36px]"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
        title={item.node.path.join(" > ")}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#6E675E] flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[#6E675E] flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        {hasChildren ? (
          <Folder className="w-3.5 h-3.5 text-[#6E5C40] flex-shrink-0" />
        ) : (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor || "#716A61" }} />
        )}

        <span
          className="text-xs font-medium truncate"
          style={{
            color: isAOnly ? "#A9471F" : isBOnly ? "#435F7A" : isHighlight ? "#456348" : "#3D3832",
          }}
        >
          {item.node.path[item.node.path.length - 1]}
        </span>

        {item.node.level >= 3 && !hasChildren && (
          <span className="text-[10px] text-[#716A61] ml-1 flex-shrink-0">
            {item.node.nodeId}
          </span>
        )}

        {statusLabel && (
          <span
            className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ color: statusColor!, backgroundColor: `${statusColor!}15` }}
          >
            {statusLabel}
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
  const [allExpanded, setAllExpanded] = useState(false);

  // 5.6: Search keeps parent path — include matching nodes + all their ancestors
  const searchFilteredNodes = useMemo(() => {
    if (!search.trim()) return nodes;
    const term = search.toLowerCase();

    // Find matching node IDs
    const matchedIds = new Set<string>();
    const nodeMap = new Map(nodes.map((n) => [n.nodeId, n]));

    for (const n of nodes) {
      if (
        n.nodeId.toLowerCase().includes(term) ||
        n.path.some((p) => p.toLowerCase().includes(term)) ||
        n.description.toLowerCase().includes(term)
      ) {
        matchedIds.add(n.nodeId);
        // Walk up ancestors
        let current = n;
        while (current.parentNodeId && nodeMap.has(current.parentNodeId)) {
          matchedIds.add(current.parentNodeId);
          current = nodeMap.get(current.parentNodeId)!;
        }
      }
    }

    return nodes.filter((n) => matchedIds.has(n.nodeId));
  }, [nodes, search]);

  const tree = useMemo(() => buildHierarchy(searchFilteredNodes), [searchFilteredNodes]);

  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <h3 className="text-sm font-semibold text-[#3D3832] mb-3">统一知识树</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#716A61]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索知识点..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-[#E8E4DE] rounded-lg focus:border-[#675A4D] focus:outline-none"
            />
          </div>
          <button
            onClick={() => setAllExpanded(!allExpanded)}
            className="px-3 py-2 text-[11px] text-[#675A4D] border border-[#E8E4DE] rounded-lg hover:bg-[#F5F2EE] transition-colors whitespace-nowrap"
          >
            {allExpanded ? "收起全部" : "展开全部"}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10px] text-[#625C54]">
          <span>共 {nodes.length} 节点</span>
          {highlightNodes && highlightNodes.size > 0 && (
            <>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#456348]" />共同 {highlightNodes.size}</span>
              {aOnlyNodes && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#A9471F]" />A独有 {aOnlyNodes.size}</span>}
              {bOnlyNodes && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#435F7A]" />B独有 {bOnlyNodes.size}</span>}
            </>
          )}
        </div>
      </div>

      <div className="p-3 max-h-[600px] overflow-y-auto custom-scroll">
        {tree.map((item) => (
          <TreeNodeItem
            key={item.node.nodeId}
            item={item}
            depth={0}
            highlightNodes={highlightNodes}
            aOnlyNodes={aOnlyNodes}
            bOnlyNodes={bOnlyNodes}
          />
        ))}
        {tree.length === 0 && (
          <p className="text-center text-xs text-[#6E675E] py-8">未找到匹配的知识点</p>
        )}
      </div>
    </div>
  );
}
