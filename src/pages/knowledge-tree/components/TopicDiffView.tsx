import { useMemo } from "react";
import type { KnowledgeComparisonViewData } from "@/data/knowledge-tree/comparison-view";
import {
  getKnowledgeNodeTitle,
  groupKnowledgeNodesByDomain,
  partitionKnowledgeNodes,
} from "@/data/knowledge-tree/comparison-view";
import type { KnowledgeTreeNode } from "@/data/knowledge-tree/types";
import { AlertCircle, Check, ChevronDown, Info, Layers, X } from "lucide-react";

interface Props {
  overlap: KnowledgeComparisonViewData;
  nodes: KnowledgeTreeNode[];
  sharedNodes: Set<string>;
  aOnlyNodes: Set<string>;
  bOnlyNodes: Set<string>;
}

const DOMAIN_LABELS: Record<string, string> = {
  "Algebra and Functions": "代数与函数",
  Algebra: "代数",
  Calculus: "微积分",
  "Coordinate Geometry": "坐标几何",
  "Decision Mathematics": "决策数学",
  "Discrete Mathematics": "离散数学",
  "Geometry and Mensuration": "几何与测量",
  Geometry: "几何",
  Mechanics: "力学",
  Mensuration: "测量",
  Number: "数与运算",
  Probability: "概率",
  Statistics: "统计",
  Trigonometry: "三角学",
  Vectors: "向量",
};

function domainLabel(domain: string) {
  return DOMAIN_LABELS[domain] ?? domain;
}

export default function TopicDiffView({ overlap, nodes, sharedNodes, aOnlyNodes, bOnlyNodes }: Props) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.nodeId, node])), [nodes]);

  const resolve = (ids: Set<string>) =>
    Array.from(ids)
      .map((id) => nodeMap.get(id))
      .filter((node): node is KnowledgeTreeNode => Boolean(node));

  const sharedArr = resolve(sharedNodes);
  const aOnlyArr = resolve(aOnlyNodes);
  const bOnlyArr = resolve(bOnlyNodes);

  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#675A4D]" />
          <h3 className="text-sm font-semibold text-[#3D3832]">知识节点差异</h3>
        </div>
        <p className="mt-2 max-w-4xl text-[11px] leading-relaxed text-[#625C54]">
          这里按统一知识树节点比较。末级节点更接近可直接教学的知识点，因此优先展示；只用于分类的上级节点收进“结构节点”。
          “独有考纲原文”按整条考纲陈述统计，口径不同，数量不会与本页一一对应。
        </p>
      </div>

      <div className="grid grid-cols-1 divide-y divide-[#E8E4DE] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <DiffColumn
          title="共同教学点"
          subtitle={`${overlap.comparison.A} 与 ${overlap.comparison.B}`}
          color="#456348"
          icon={<Check className="w-3.5 h-3.5 text-[#456348]" />}
          emptyText="未发现共同的末级教学点"
          items={sharedArr}
          allNodes={nodes}
          expandDomains={false}
        />
        <DiffColumn
          title={`${overlap.comparison.A} 特有`}
          subtitle="仅在左侧考纲的知识树节点中出现"
          color="#A9471F"
          icon={<X className="w-3.5 h-3.5 text-[#A9471F]" />}
          emptyText="未发现仅此科拥有的末级教学点"
          items={aOnlyArr}
          allNodes={nodes}
          expandDomains
        />
        <DiffColumn
          title={`${overlap.comparison.B} 特有`}
          subtitle="仅在右侧考纲的知识树节点中出现"
          color="#435F7A"
          icon={<AlertCircle className="w-3.5 h-3.5 text-[#435F7A]" />}
          emptyText="未发现仅此科拥有的末级教学点"
          items={bOnlyArr}
          allNodes={nodes}
          expandDomains
        />
      </div>
    </div>
  );
}

function DiffColumn({
  title,
  subtitle,
  color,
  icon,
  emptyText,
  items,
  allNodes,
  expandDomains,
}: {
  title: string;
  subtitle: string;
  color: string;
  icon: React.ReactNode;
  emptyText: string;
  items: KnowledgeTreeNode[];
  allNodes: KnowledgeTreeNode[];
  expandDomains: boolean;
}) {
  const { teachingPoints, structuralNodes } = partitionKnowledgeNodes(items, allNodes);
  const groups = groupKnowledgeNodesByDomain(teachingPoints);
  const structuralGroups = groupKnowledgeNodesByDomain(structuralNodes);

  return (
    <section className="min-w-0 p-4">
      <div className="mb-4">
        <div className="flex items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold leading-relaxed text-[#3D3832]">{title}</h4>
            <p className="mt-0.5 text-[10px] leading-relaxed text-[#6E675E]">{subtitle}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 pl-4">
          <span className="rounded-full bg-[#F0EDE8] px-2 py-1 text-[10px] font-medium text-[#3D3832]">
            末级教学点 {teachingPoints.length}
          </span>
          <span className="rounded-full bg-[#F7F5F2] px-2 py-1 text-[10px] text-[#6E675E]">
            结构节点 {structuralNodes.length}
          </span>
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="space-y-2">
          {groups.map((group) => (
            <details
              key={group.domain}
              open={expandDomains}
              className="group overflow-hidden rounded-xl border border-[#E8E4DE] bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 bg-[#FAF8F5] px-3 py-2.5 text-[11px] font-semibold text-[#3D3832]">
                <ChevronDown className="h-3.5 w-3.5 text-[#716A61] transition-transform group-open:rotate-180" />
                <span>{domainLabel(group.domain)}</span>
                <span className="ml-auto font-normal text-[#6E675E]">{group.items.length} 个</span>
              </summary>
              <div className="divide-y divide-[#F0EDE8]">
                {group.items.map((node) => (
                  <KnowledgeNodeRow key={node.nodeId} node={node} icon={icon} />
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-[#FAF8F5] px-3 py-5 text-center text-xs text-[#6E675E]">{emptyText}</p>
      )}

      {structuralGroups.length > 0 && (
        <details className="group mt-3 rounded-xl border border-dashed border-[#D9D4CE] bg-[#FAF8F5] px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-medium text-[#625C54]">
            <Info className="h-3.5 w-3.5" />
            查看 {structuralNodes.length} 个结构节点
            <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3">
            {structuralGroups.map((group) => (
              <div key={group.domain}>
                <p className="mb-1.5 text-[10px] font-semibold text-[#6E675E]">{domainLabel(group.domain)}</p>
                <div className="space-y-1">
                  {group.items.map((node) => (
                    <div key={node.nodeId} className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-[#3D3832]">
                      {getKnowledgeNodeTitle(node)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function KnowledgeNodeRow({ node, icon }: { node: KnowledgeTreeNode; icon: React.ReactNode }) {
  const parentPath = node.path.slice(0, -1);

  return (
    <div className="px-3 py-3 hover:bg-[#FAF8F5]">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-relaxed text-[#3D3832]">{getKnowledgeNodeTitle(node)}</p>
          {parentPath.length > 0 && (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-[#6E675E]">
              {parentPath.join(" › ")}
            </p>
          )}
          <details className="group/details mt-1.5">
            <summary className="cursor-pointer list-none text-[10px] font-medium text-[#675A4D]">
              查看完整路径与节点信息
            </summary>
            <div className="mt-1.5 rounded-lg bg-[#F5F2EE] p-2 text-[10px] leading-relaxed text-[#625C54]">
              <p>{node.path.join(" › ")}</p>
              {node.description && <p className="mt-1">{node.description}</p>}
              <p className="mt-1 font-mono text-[#716A61]">{node.nodeId} · L{node.level}</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
