import { useState, useEffect, useMemo, useCallback } from "react";
import { GitCompareArrows, FolderTree, Layers, FileText, AlertCircle } from "lucide-react";
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
  const [calcError, setCalcError] = useState<string | null>(null);

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

  // Derived: is this a valid comparison?
  const isValidComparison = useMemo(
    () => Boolean(codeA && codeB && codeA !== codeB),
    [codeA, codeB]
  );

  // Empty sets for invalid comparison state
  const emptyOverlapSets = useMemo(
    () => ({ shared: new Set<string>(), aOnly: new Set<string>(), bOnly: new Set<string>() }),
    []
  );

  // Effective data for rendering (no setState in effect for invalid state)
  const effectiveOverlapResult = isValidComparison ? overlapResult : null;
  const effectiveOverlapSets = isValidComparison ? overlapSets : emptyOverlapSets;
  const effectiveExclusiveData = isValidComparison
    ? exclusiveData
    : { aExclusive: [] as ExclusiveSubtopicItem[], bExclusive: [] as ExclusiveSubtopicItem[] };

  // Calculate overlap only when comparison is valid
  useEffect(() => {
    if (!isValidComparison) return;

    let cancelled = false;
    // Defer setState to avoid synchronous setState-in-effect lint warning
    queueMicrotask(() => {
      if (!cancelled) {
        setLoadingCalc(true);
        setCalcError(null);
      }
    });

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
      } catch {
        if (!cancelled) setCalcError("计算失败，请稍后重试");
      } finally {
        if (!cancelled) setLoadingCalc(false);
      }
    }

    calc();
    return () => { cancelled = true; };
  }, [isValidComparison, codeA, codeB, paperA, paperB]);

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

  const { shared: sharedSet, aOnly: aOnlySet, bOnly: bOnlySet } = effectiveOverlapSets;

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "tree", label: "知识树视图", icon: <FolderTree className="w-3.5 h-3.5" /> },
    { key: "diff", label: "差异分析", icon: <Layers className="w-3.5 h-3.5" /> },
    { key: "exclusive", label: "独有知识点", icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  const overlapData = useMemo(() => {
    if (!effectiveOverlapResult) return null;
    return {
      version: "3.2",
      comparison: {
        A: effectiveOverlapResult.aName,
        B: effectiveOverlapResult.bName,
        topicCountA: effectiveOverlapResult.aTotal,
        topicCountB: effectiveOverlapResult.bTotal,
      },
      summary: {
        symmetric: {
          weighted: effectiveOverlapResult.weighted,
          unweighted: effectiveOverlapResult.unweighted,
        },
        AtoB: {
          name: displayA,
          weighted: { overlap: effectiveOverlapResult.sharedCount, total: effectiveOverlapResult.aTotal, percentage: effectiveOverlapResult.aTotal > 0 ? (effectiveOverlapResult.sharedCount / effectiveOverlapResult.aTotal) * 100 : 0 },
          unweighted: { overlap: effectiveOverlapResult.sharedCount, total: effectiveOverlapResult.aTotal, percentage: effectiveOverlapResult.aTotal > 0 ? (effectiveOverlapResult.sharedCount / effectiveOverlapResult.aTotal) * 100 : 0 },
        },
        BtoA: {
          name: displayB,
          weighted: { overlap: effectiveOverlapResult.sharedCount, total: effectiveOverlapResult.bTotal, percentage: effectiveOverlapResult.bTotal > 0 ? (effectiveOverlapResult.sharedCount / effectiveOverlapResult.bTotal) * 100 : 0 },
          unweighted: { overlap: effectiveOverlapResult.sharedCount, total: effectiveOverlapResult.bTotal, percentage: effectiveOverlapResult.bTotal > 0 ? (effectiveOverlapResult.sharedCount / effectiveOverlapResult.bTotal) * 100 : 0 },
        },
      },
      details: {
        AtoB: effectiveOverlapResult.sharedNodes.map((nid) => ({
          topicId: nid,
          topicName: nid,
          hasOverlap: true,
          overlappingTopicsB: [nid],
          sharedNodes: [nid],
          nodeCount: 1,
        })),
        BtoA: effectiveOverlapResult.sharedNodes.map((nid) => ({
          topicId: nid,
          topicName: nid,
          hasOverlap: true,
          overlappingTopicsA: [nid],
          sharedNodes: [nid],
          nodeCount: 1,
        })),
      },
    };
  }, [effectiveOverlapResult, displayA, displayB]);

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

            {effectiveOverlapResult && (
              <div className="mt-4 pt-3 border-t border-[#E8E4DE]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#8B8378]">对比模式：</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F5F2EE] text-[#3D3832]">
                    {effectiveOverlapResult.mode === "subject-vs-subject" && "整科 vs 整科"}
                    {effectiveOverlapResult.mode === "paper-vs-paper" && "Paper vs Paper"}
                    {effectiveOverlapResult.mode === "paper-vs-subject" && `${paperA ? displayA : displayB} vs 整科`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Invalid comparison: same subject */}
          {!isValidComparison && (
            <div className="mb-6 rounded-2xl border border-[#E8E4DE] bg-white p-6">
              <div className="flex items-center justify-center gap-2 text-[#8B8378]">
                <AlertCircle className="w-4 h-4 text-[#C4BDB3]" />
                <p className="text-sm">
                  请选择<span className="font-medium text-[#C75B2A]">两个不同的科目/考试局</span>进行比较
                </p>
              </div>
            </div>
          )}

          {/* Calculation error */}
          {calcError && isValidComparison && (
            <div className="mb-6 rounded-2xl border border-[#E8E4DE] bg-white p-6 text-center">
              <p className="text-sm text-[#C75B2A]">{calcError}</p>
            </div>
          )}

          {/* Overlap dashboard */}
          {isValidComparison && (
            <div className="mb-6">
              <OverlapDashboard overlap={overlapData} subjectAName={displayA} subjectBName={displayB} loading={loadingCalc} />
            </div>
          )}

          {/* Tabs */}
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
                  aExclusive={effectiveExclusiveData.aExclusive}
                  bExclusive={effectiveExclusiveData.bExclusive}
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
