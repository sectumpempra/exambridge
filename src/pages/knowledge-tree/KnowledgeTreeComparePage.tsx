import { useState, useMemo } from "react";
import { GitCompareArrows, FolderTree, Layers } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SubjectSelector from "./components/SubjectSelector";
import OverlapDashboard from "./components/OverlapDashboard";
import KnowledgeTreeView from "./components/KnowledgeTreeView";
import TopicDiffView from "./components/TopicDiffView";
import {
  listSubjects,
  calculateOverlap,
  getOverlapSets,
  getTreeNodes,
} from "@/data/knowledge-tree/loader";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "A-Level 分数线", to: "/alevel" },
  { label: "Paper 查询", to: "/papers" },
  { label: "刷题规划", to: "/planner" },
];

type TabKey = "tree" | "diff";

export default function KnowledgeTreeComparePage() {
  const subjects = useMemo(() => listSubjects(), []);
  const allTreeNodes = useMemo(() => getTreeNodes(), []);

  const [codeA, setCodeA] = useState("CAIE-9709");
  const [codeB, setCodeB] = useState("Edexcel-9MA0");
  const [activeTab, setActiveTab] = useState<TabKey>("tree");

  // Calculate overlap synchronously
  const overlap = useMemo(() => {
    if (!codeA || !codeB || codeA === codeB) return null;
    return calculateOverlap(codeA, codeB);
  }, [codeA, codeB]);

  // Calculate highlight sets
  const highlightSets = useMemo(() => {
    if (!codeA || !codeB || codeA === codeB) {
      return { shared: new Set<string>(), aOnly: new Set<string>(), bOnly: new Set<string>() };
    }
    return getOverlapSets(codeA, codeB);
  }, [codeA, codeB]);

  const subjectA = subjects.find((s) => s.code === codeA);
  const subjectB = subjects.find((s) => s.code === codeB);

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "tree", label: "知识树视图", icon: <FolderTree className="w-3.5 h-3.5" /> },
    { key: "diff", label: "差异分析", icon: <Layers className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{ background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}
    >
      <Header title="考纲扩科对比" links={NAV_LINKS} />

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          {/* Page header */}
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-[#B8A68A]">
              EXAMBRIDGE 知识树驱动
            </p>
            <h1 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.2] text-[#3D3832]">
              跨考试局考纲重合度分析
            </h1>
            <p className="mt-2 text-sm text-[#8B8378] leading-relaxed">
              基于 1,670 节点统一知识树，覆盖 5 大考试局 21 个数学类科目的精确映射
              <br />
              <span className="text-[#C75B2A] font-medium">任意两个科目均可实时对比</span>
            </p>
          </div>

          {/* Subject selectors */}
          <div className="mb-6 rounded-2xl border border-[#E8E4DE] bg-white p-5">
            <div className="flex items-center gap-4">
              <SubjectSelector
                label="科目 A"
                value={codeA}
                options={subjects}
                onChange={setCodeA}
              />
              <div className="flex-shrink-0 pt-5">
                <GitCompareArrows className="w-5 h-5 text-[#C4BDB3]" />
              </div>
              <SubjectSelector
                label="科目 B"
                value={codeB}
                options={subjects}
                onChange={setCodeB}
              />
            </div>
          </div>

          {/* Same subject warning */}
          {codeA && codeB && codeA === codeB && (
            <div className="mb-6 rounded-2xl border border-[#E8E4DE] bg-white p-6 text-center">
              <p className="text-sm text-[#8B8378]">
                请选择<span className="font-medium text-[#C75B2A]">两个不同的科目</span>进行对比
              </p>
            </div>
          )}

          {/* Overlap dashboard */}
          {codeA !== codeB && (
            <div className="mb-6">
              <OverlapDashboard
                overlap={overlap}
                subjectAName={subjectA?.name || codeA}
                subjectBName={subjectB?.name || codeB}
                loading={false}
              />
            </div>
          )}

          {/* Tabs */}
          {overlap && (
            <>
              <div className="mb-4 flex gap-1 rounded-xl border border-[#E8E4DE] bg-white p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      activeTab === tab.key
                        ? "bg-black text-white"
                        : "text-[#8B8378] hover:text-[#3D3832] hover:bg-[#F5F2EE]"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "tree" && (
                <KnowledgeTreeView
                  nodes={allTreeNodes}
                  highlightNodes={highlightSets.shared}
                  aOnlyNodes={highlightSets.aOnly}
                  bOnlyNodes={highlightSets.bOnly}
                />
              )}

              {activeTab === "diff" && (
                <TopicDiffView
                  overlap={overlap}
                  nodes={allTreeNodes}
                  aOnlyNodes={highlightSets.aOnly}
                  bOnlyNodes={highlightSets.bOnly}
                />
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
