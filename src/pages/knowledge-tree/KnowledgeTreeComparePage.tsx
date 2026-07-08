import { useState, useEffect, useMemo, useCallback } from "react";
import { GitCompareArrows, FolderTree, Layers, FileText } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SubjectSelector from "./components/SubjectSelector";
import PaperSelector from "./components/PaperSelector";
import OverlapDashboard from "./components/OverlapDashboard";
import KnowledgeTreeView from "./components/KnowledgeTreeView";
import TopicDiffView from "./components/TopicDiffView";
import ExclusiveTopicsView from "./components/ExclusiveTopicsView";
import type { OverlapResultV32, SubjectInfoV32, ExclusiveSubtopicItem } from "@/data/knowledge-tree/types-v3.2";
import type { KnowledgeTreeNode } from "@/data/knowledge-tree/types";
import {
  listSubjectsV32,
  calculateOverlapV32,
  getOverlapSetsV32,
  getTreeNodesV32,
  findExclusiveSubtopics,
} from "@/data/knowledge-tree/loader-v3.2";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "A-Level 分数线", to: "/alevel" },
  { label: "Paper 查询", to: "/papers" },
  { label: "刷题规划", to: "/planner" },
];

type TabKey = "tree" | "diff" | "exclusive";

export default function KnowledgeTreeComparePage() {
  // Data loading state
  const [subjects, setSubjects] = useState<SubjectInfoV32[]>([]);
  const [treeNodes, setTreeNodes] = useState<KnowledgeTreeNode[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Selection state
  const [codeA, setCodeA] = useState("CAIE-9709");
  const [codeB, setCodeB] = useState("Edexcel-9MA0");
  const [paperA, setPaperA] = useState<string | null>(null);
  const [paperB, setPaperB] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("tree");

  // Async loading state
  const [overlapResult, setOverlapResult] = useState<OverlapResultV32 | null>(null);
  const [overlapSets, setOverlapSets] = useState({
    shared: new Set<string>(),
    aOnly: new Set<string>(),
    bOnly: new Set<string>(),
  });
  const [exclusiveData, setExclusiveData] = useState<{
    aExclusive: ExclusiveSubtopicItem[];
    bExclusive: ExclusiveSubtopicItem[];
  }>({ aExclusive: [], bExclusive: [] });
  const [loadingCalc, setLoadingCalc] = useState(false);

  // Initial data load
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [subjs, nodes] = await Promise.all([
          listSubjectsV32(),
          getTreeNodesV32(),
        ]);
        if (cancelled) return;
        setSubjects(subjs);
        setTreeNodes(nodes);
      } catch (e) {
        console.error("Failed to load v3.2 data:", e);
      } finally {
        setLoadingData(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Get papers for selected subjects
  const papersA = useMemo(() => {
    const s = subjects.find((s) => s.code === codeA);
    return s?.papers ?? [];
  }, [subjects, codeA]);

  const papersB = useMemo(() => {
    const s = subjects.find((s) => s.code === codeB);
    return s?.papers ?? [];
  }, [subjects, codeB]);

  // Unified subject change handlers (avoid intermediate states)
  const handleSetCodeA = useCallback((newCode: string) => {
    setCodeA(newCode);
    setPaperA(null);
  }, []);

  const handleSetCodeB = useCallback((newCode: string) => {
    setCodeB(newCode);
    setPaperB(null);
  }, []);

  // Calculate overlap when selection changes
  useEffect(() => {
    if (!codeA || !codeB || codeA === codeB) {
      setOverlapResult(null);
      setOverlapSets({ shared: new Set(), aOnly: new Set(), bOnly: new Set() });
      setExclusiveData({ aExclusive: [], bExclusive: [] });
      return;
    }

    let cancelled = false;
    setLoadingCalc(true);

    async function calc() {
      try {
        const [result, sets, exclusive] = await Promise.all([
          calculateOverlapV32(codeA, codeB, paperA, paperB),
          getOverlapSetsV32(codeA, codeB, paperA, paperB),
          findExclusiveSubtopics(codeA, codeB, paperA, paperB),
        ]);
        if (cancelled) return;
        setOverlapResult(result);
        setOverlapSets(sets);
        setExclusiveData(exclusive);
      } catch (e) {
        console.error("Overlap calculation error:", e);
      } finally {
        if (!cancelled) setLoadingCalc(false);
      }
    }
    calc();
    return () => { cancelled = true; };
  }, [codeA, codeB, paperA, paperB]);

  const subjectOptions = useMemo(
    () =>
      subjects.map((s) => ({
        code: s.code,
        board: s.board,
        subjectCode: s.subjectCode,
        name: s.name,
        level: s.isGCSE ? "GCSE" : "A-Level",
      })),
    [subjects]
  );

  const subjectA = subjects.find((s) => s.code === codeA);
  const subjectB = subjects.find((s) => s.code === codeB);

  const displayA = paperA ? `${subjectA?.name || codeA} ${paperA}` : subjectA?.name || codeA;
  const displayB = paperB ? `${subjectB?.name || codeB} ${paperB}` : subjectB?.name || codeB;

  const { shared: sharedSet, aOnly: aOnlySet, bOnly: bOnlySet } = overlapSets;

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "tree", label: "知识树视图", icon: <FolderTree className="w-3.5 h-3.5" /> },
    { key: "diff", label: "差异分析", icon: <Layers className="w-3.5 h-3.5" /> },
    { key: "exclusive", label: "独有知识点", icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  const overlapData = useMemo(() => {
    if (!overlapResult) return null;
    return {
      version: "3.2",
      comparison: {
        A: overlapResult.aName,
        B: overlapResult.bName,
        topicCountA: overlapResult.aTotal,
        topicCountB: overlapResult.bTotal,
      },
      summary: {
        symmetric: {
          weighted: overlapResult.weighted,
          unweighted: overlapResult.unweighted,
        },
        AtoB: {
          name: displayA,
          weighted: { overlap: overlapResult.sharedCount, total: overlapResult.aTotal, percentage: overlapResult.aTotal > 0 ? (overlapResult.sharedCount / overlapResult.aTotal) * 100 : 0 },
          unweighted: { overlap: overlapResult.sharedCount, total: overlapResult.aTotal, percentage: overlapResult.aTotal > 0 ? (overlapResult.sharedCount / overlapResult.aTotal) * 100 : 0 },
        },
        BtoA: {
          name: displayB,
          weighted: { overlap: overlapResult.sharedCount, total: overlapResult.bTotal, percentage: overlapResult.bTotal > 0 ? (overlapResult.sharedCount / overlapResult.bTotal) * 100 : 0 },
          unweighted: { overlap: overlapResult.sharedCount, total: overlapResult.bTotal, percentage: overlapResult.bTotal > 0 ? (overlapResult.sharedCount / overlapResult.bTotal) * 100 : 0 },
        },
      },
      details: {
        AtoB: overlapResult.sharedNodes.map((nid) => ({
          topicId: nid,
          topicName: nid,
          hasOverlap: true,
          overlappingTopicsB: [nid],
          sharedNodes: [nid],
          nodeCount: 1,
        })),
        BtoA: overlapResult.sharedNodes.map((nid) => ({
          topicId: nid,
          topicName: nid,
          hasOverlap: true,
          overlappingTopicsA: [nid],
          sharedNodes: [nid],
          nodeCount: 1,
        })),
      },
    };
  }, [overlapResult, displayA, displayB]);

  if (loadingData) {
    return (
      <div className="flex min-h-[100dvh] flex-col" style={{ background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
        <Header title="考纲扩科对比" links={NAV_LINKS} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#8F7F6E] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-[#8B8378]">加载知识树数据...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

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
              EXAMBRIDGE v3.2 知识树驱动
            </p>
            <h1 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.2] text-[#3D3832]">
              跨考试局考纲重合度分析
            </h1>
            <p className="mt-2 text-sm text-[#8B8378] leading-relaxed">
              基于 <strong className="text-[#3D3832]">812 节点</strong> 统一知识树，覆盖{" "}
              <strong className="text-[#3D3832]">5 大考试局 21 个数学类科目</strong> 的精确映射
              <br />
              支持 <strong className="text-[#C75B2A]">整科对比</strong>、{" "}
              <strong className="text-[#C75B2A]">Paper 级别对比</strong> 及{" "}
              <strong className="text-[#C75B2A]">独有知识点展示</strong>
            </p>
          </div>

          {/* Subject + Paper selectors */}
          <div className="mb-6 rounded-2xl border border-[#E8E4DE] bg-white p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <SubjectSelector label="科目 A" value={codeA} options={subjectOptions} onChange={handleSetCodeA} />
                {papersA.length > 0 && (
                  <div className="mt-2">
                    <PaperSelector label="Paper" papers={papersA} value={paperA} onChange={setPaperA} />
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 pt-6">
                <button
                  onClick={() => { setCodeA(codeB); setCodeB(codeA); setPaperA(paperB); setPaperB(paperA); }}
                  className="p-2 rounded-lg hover:bg-[#F5F2EE] transition-colors"
                  title="交换科目"
                >
                  <GitCompareArrows className="w-5 h-5 text-[#C4BDB3]" />
                </button>
              </div>
              <div className="flex-1 min-w-[200px]">
                <SubjectSelector label="科目 B" value={codeB} options={subjectOptions} onChange={handleSetCodeB} />
                {papersB.length > 0 && (
                  <div className="mt-2">
                    <PaperSelector label="Paper" papers={papersB} value={paperB} onChange={setPaperB} />
                  </div>
                )}
              </div>
            </div>

            {overlapResult && (
              <div className="mt-4 pt-3 border-t border-[#E8E4DE]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#8B8378]">对比模式：</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F5F2EE] text-[#3D3832]">
                    {overlapResult.mode === "subject-vs-subject" && "整科 vs 整科"}
                    {overlapResult.mode === "paper-vs-paper" && "Paper vs Paper"}
                    {overlapResult.mode === "paper-vs-subject" && `${paperA ? displayA : displayB} vs 整科`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {codeA && codeB && codeA === codeB && !paperA && !paperB && (
            <div className="mb-6 rounded-2xl border border-[#E8E4DE] bg-white p-6 text-center">
              <p className="text-sm text-[#8B8378]">
                请选择<span className="font-medium text-[#C75B2A]">两个不同的科目</span>进行对比
              </p>
            </div>
          )}

          {codeA !== codeB && (
            <div className="mb-6">
              <OverlapDashboard overlap={overlapData} subjectAName={displayA} subjectBName={displayB} loading={loadingCalc} />
            </div>
          )}

          {overlapData && (
            <>
              <div className="mb-4 flex gap-1 rounded-xl border border-[#E8E4DE] bg-white p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      activeTab === tab.key ? "bg-black text-white" : "text-[#8B8378] hover:text-[#3D3832] hover:bg-[#F5F2EE]"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "tree" && (
                <KnowledgeTreeView nodes={treeNodes} highlightNodes={sharedSet} aOnlyNodes={aOnlySet} bOnlyNodes={bOnlySet} />
              )}
              {activeTab === "diff" && (
                <TopicDiffView overlap={overlapData} nodes={treeNodes} sharedNodes={sharedSet} aOnlyNodes={aOnlySet} bOnlyNodes={bOnlySet} />
              )}
              {activeTab === "exclusive" && (
                <ExclusiveTopicsView
                  aName={displayA}
                  bName={displayB}
                  aExclusive={exclusiveData.aExclusive}
                  bExclusive={exclusiveData.bExclusive}
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
