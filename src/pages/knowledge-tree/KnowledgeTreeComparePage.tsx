import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { calculateKnowledgeV5Comparison, listSubjectsV5, loadKnowledgeV5Manifest, loadKnowledgeV5Tree } from "@/data/knowledge-tree/loader-v5";
import { buildKnowledgeComparisonV5ViewData } from "@/data/knowledge-tree/comparison-view";
import type { KnowledgeComparisonV5 } from "@/domain-v2/knowledge-tree";
import { getKnowledgeComparisonPrompt, isKnowledgeComparisonValid } from "@/data/knowledge-tree/comparison-selection";
import { useCourseContext } from "@/course-context/CourseContextProvider";
import { withCourseContext } from "@/course-context/catalog";

type TabKey = "tree" | "diff" | "exclusive";

export default function KnowledgeTreeComparePage() {
  const { entry, context } = useCourseContext();
  const [searchParams] = useSearchParams();
  const requestedCodeA = searchParams.get("subjectA");
  const requestedCodeB = searchParams.get("subjectB");
  const requestedPaperA = searchParams.get("paperA");
  const requestedPaperB = searchParams.get("paperB");
  // Data loading state
  const [subjects, setSubjects] = useState<SubjectInfoV32[]>([]);
  const [treeNodes, setTreeNodes] = useState<KnowledgeTreeNode[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [knowledgeNodeCount, setKnowledgeNodeCount] = useState(0);

  // Selection state
  const [codeA, setCodeA] = useState("CAIE-9709");
  const [codeB, setCodeB] = useState("Edexcel-9MA0");
  const [paperA, setPaperA] = useState<string | null>(null);
  const [paperB, setPaperB] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("tree");

  // Async loading state
  const [overlapResult, setOverlapResult] = useState<OverlapResultV32 | null>(null);
  const [v5Comparison, setV5Comparison] = useState<KnowledgeComparisonV5 | null>(null);
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
        const manifest = await loadKnowledgeV5Manifest();
        const [subjs, nodes] = await Promise.all([listSubjectsV5(), loadKnowledgeV5Tree(manifest)]);
        if (cancelled) return;
        setSubjects(subjs);
        setTreeNodes(nodes);
        setKnowledgeNodeCount(manifest.ontologyNodeCount);
      } catch (e) {
        console.error("Failed to load knowledge comparison data:", e);
        if (!cancelled) setDataError("考纲数据完整性校验失败。为避免展示旧版或不完整结果，本页已停止计算，请稍后重试。");
      } finally {
        setLoadingData(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (subjects.length === 0) return;
    const subjectA = requestedCodeA ? subjects.find((subject) => subject.code === requestedCodeA) : undefined;
    const subjectB = requestedCodeB ? subjects.find((subject) => subject.code === requestedCodeB) : undefined;
    queueMicrotask(() => {
      if (subjectA) {
        setCodeA(subjectA.code);
        setPaperA(requestedPaperA && subjectA.paperComparisonReady && subjectA.papers.includes(requestedPaperA) ? requestedPaperA : null);
      }
      if (subjectB) {
        setCodeB(subjectB.code);
        setPaperB(requestedPaperB && subjectB.paperComparisonReady && subjectB.papers.includes(requestedPaperB) ? requestedPaperB : null);
      }
    });
  }, [subjects, requestedCodeA, requestedCodeB, requestedPaperA, requestedPaperB]);

  useEffect(() => {
    if (requestedCodeA) return;
    if (!entry?.knowledgeTreeCode || !subjects.some((subject) => subject.code === entry.knowledgeTreeCode)) return;
    queueMicrotask(() => {
      setCodeA(entry.knowledgeTreeCode!);
      setPaperA(null);
    });
  }, [entry, subjects, requestedCodeA]);

  // Get papers for selected subjects
  const papersA = useMemo(() => {
    const s = subjects.find((s) => s.code === codeA);
    return s?.paperOptions ?? [];
  }, [subjects, codeA]);

  const papersB = useMemo(() => {
    const s = subjects.find((s) => s.code === codeB);
    return s?.paperOptions ?? [];
  }, [subjects, codeB]);

  const subjectA = subjects.find((s) => s.code === codeA);
  const subjectB = subjects.find((s) => s.code === codeB);
  const selectedPaperA = subjectA?.paperOptions.find((paper) => paper.id === paperA);
  const selectedPaperB = subjectB?.paperOptions.find((paper) => paper.id === paperB);
  const displayA = paperA ? `${subjectA?.name || codeA} ${selectedPaperA ? `${selectedPaperA.code} · ${selectedPaperA.name}` : paperA}` : subjectA?.name || codeA;
  const displayB = paperB ? `${subjectB?.name || codeB} ${selectedPaperB ? `${selectedPaperB.code} · ${selectedPaperB.name}` : paperB}` : subjectB?.name || codeB;
  const subjectComparisonBlocked = Boolean(
    subjectA && subjectB && (!subjectA.comparisonReady || !subjectB.comparisonReady)
  );
  const paperComparisonBlocked = Boolean(
    (paperA && !subjectA?.paperComparisonReady) || (paperB && !subjectB?.paperComparisonReady)
  );

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
    () => !subjectComparisonBlocked && !paperComparisonBlocked && isKnowledgeComparisonValid(codeA, codeB, paperA, paperB),
    [codeA, codeB, paperA, paperB, subjectComparisonBlocked, paperComparisonBlocked]
  );
  const comparisonPrompt = useMemo(
    () => getKnowledgeComparisonPrompt(codeA, codeB, paperA, paperB),
    [codeA, codeB, paperA, paperB]
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
        const payload = await calculateKnowledgeV5Comparison(codeA, codeB, paperA, paperB);
        if (cancelled) return;
        const { result } = payload;
        const mode = paperA && paperB ? "paper-vs-paper" : paperA || paperB ? "paper-vs-subject" : "subject-vs-subject";
        setV5Comparison(result);
        setOverlapResult({
          subjectA: codeA,
          subjectB: codeB,
          paperA,
          paperB,
          mode,
          unweighted: result.exact.jaccard,
          weighted: result.exact.jaccard,
          sharedNodes: result.exact.sharedNodeIds,
          aOnlyNodes: result.exact.aOnlyNodeIds,
          bOnlyNodes: result.exact.bOnlyNodeIds,
          sharedCount: result.exact.sharedNodeIds.length,
          aTotal: result.exact.sharedNodeIds.length + result.exact.aOnlyNodeIds.length,
          bTotal: result.exact.sharedNodeIds.length + result.exact.bOnlyNodeIds.length,
          aName: displayA,
          bName: displayB,
        });
        setOverlapSets({ shared: new Set(result.exact.sharedNodeIds), aOnly: new Set(result.exact.aOnlyNodeIds), bOnly: new Set(result.exact.bOnlyNodeIds) });
        setExclusiveData({ aExclusive: payload.aItems.filter((item) => item.comparisonStatus !== "shared"), bExclusive: payload.bItems.filter((item) => item.comparisonStatus !== "shared") });
      } catch {
        if (!cancelled) setCalcError("计算失败，请稍后重试");
      } finally {
        if (!cancelled) setLoadingCalc(false);
      }
    }

    calc();
    return () => { cancelled = true; };
  }, [isValidComparison, codeA, codeB, paperA, paperB, displayA, displayB]);

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
  const hasPublishedMappings = subjects.length > 0;

  const { shared: sharedSet, aOnly: aOnlySet, bOnly: bOnlySet } = effectiveOverlapSets;

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "tree", label: "知识树视图", icon: <FolderTree className="w-3.5 h-3.5" /> },
    { key: "diff", label: "差异分析", icon: <Layers className="w-3.5 h-3.5" /> },
    { key: "exclusive", label: "独有知识点", icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  const overlapData = useMemo(() => {
    if (!effectiveOverlapResult) return null;
    return v5Comparison ? buildKnowledgeComparisonV5ViewData(v5Comparison, displayA, displayB) : null;
  }, [effectiveOverlapResult, v5Comparison, displayA, displayB]);

  if (loadingData) {
    return (
      <div className="flex min-h-[100dvh] flex-col" style={{ background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
        <Header title="考纲内容对比" />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#675A4D] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-[#625C54]">加载知识树数据...</p>
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
      <Header title="考纲内容对比" />

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          {/* Page header */}
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold tracking-[0.15em] text-[#6E5C40]">
              EXAMBRIDGE v5 知识树驱动
            </p>
            <h1 className="text-[clamp(24px,4vw,36px)] font-bold leading-[1.2] text-[#3D3832]">
              考纲与 Paper 知识重合度分析
            </h1>
            <p className="mt-2 text-sm text-[#625C54] leading-relaxed">
              基于 <strong className="text-[#3D3832]">{knowledgeNodeCount} 节点</strong> 统一知识树，覆盖{" "}
              <strong className="text-[#3D3832]">5 大考试局 22 个数学类资格版本</strong> 的{hasPublishedMappings ? "已批准映射" : "候选映射"}
              <br />
              支持 <strong className="text-[#A9471F]">跨考试局整科对比</strong>、{" "}
              <strong className="text-[#A9471F]">同课程或跨课程 Paper 对比</strong> 及{" "}
              <strong className="text-[#A9471F]">独有知识点展示</strong>
            </p>
            {entry?.capabilities.papers.href && <Link to={withCourseContext(entry.capabilities.papers.href, context)} className="mt-4 inline-flex rounded-lg border border-[#d9d4ce] bg-white px-3 py-2 text-xs font-semibold text-[#675a4d] no-underline hover:border-[#a69888]">查看当前课程相关 Paper →</Link>}
          </div>

          {dataError && (
            <div className="mb-6 rounded-2xl border border-[#e6cdbf] bg-[#fff8f3] p-5 text-sm text-[#8a5c45]" role="alert">
              {dataError}
            </div>
          )}

          {!dataError && !hasPublishedMappings && (
            <div className="mb-6 rounded-2xl border border-[#e6cdbf] bg-[#fff8f3] p-5 text-center text-sm text-[#8a5c45]" role="status">
              21 门课程映射已完成候选复核，正在等待所有者批准。批准前不会发布课程映射，也不会计算或展示精确相似度；下方仍可浏览已审计的 812 节点知识树。
            </div>
          )}

          {/* Subject + Paper selectors */}
          {!dataError && hasPublishedMappings && <div className="mb-6 rounded-2xl border border-[#E8E4DE] bg-white p-5">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <SubjectSelector label="科目 A" value={codeA} options={subjectOptions} onChange={handleSetCodeA} />
                {papersA.length > 0 && (
                  <div className="mt-2">
                    <PaperSelector label="Paper" papers={papersA} value={paperA} onChange={setPaperA} disabled={!subjectA?.paperComparisonReady} />
                    {!subjectA?.paperComparisonReady && <p className="mt-1 text-[10px] text-[#9a684d]">Paper 级映射待核验，暂不提供百分比对比</p>}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 pt-6">
                <button
                  onClick={() => { setCodeA(codeB); setCodeB(codeA); setPaperA(paperB); setPaperB(paperA); }}
                  className="p-2 rounded-lg hover:bg-[#F5F2EE] transition-colors"
                  title="交换科目"
                >
                  <GitCompareArrows className="w-5 h-5 text-[#716A61]" />
                </button>
              </div>
              <div className="flex-1 min-w-[200px]">
                <SubjectSelector label="科目 B" value={codeB} options={subjectOptions} onChange={handleSetCodeB} />
                {papersB.length > 0 && (
                  <div className="mt-2">
                    <PaperSelector label="Paper" papers={papersB} value={paperB} onChange={setPaperB} disabled={!subjectB?.paperComparisonReady} />
                    {!subjectB?.paperComparisonReady && <p className="mt-1 text-[10px] text-[#9a684d]">Paper 级映射待核验，暂不提供百分比对比</p>}
                  </div>
                )}
              </div>
            </div>

            {effectiveOverlapResult && (
              <div className="mt-4 pt-3 border-t border-[#E8E4DE]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#625C54]">对比模式：</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F5F2EE] text-[#3D3832]">
                    {effectiveOverlapResult.mode === "subject-vs-subject" && "整科 vs 整科"}
                    {effectiveOverlapResult.mode === "paper-vs-paper" && "Paper vs Paper"}
                    {effectiveOverlapResult.mode === "paper-vs-subject" && `${paperA ? displayA : displayB} vs 整科`}
                  </span>
                </div>
              </div>
            )}
          </div>}

          {/* Invalid comparison */}
          {hasPublishedMappings && !isValidComparison && (
            <div className="mb-6 rounded-2xl border border-[#E8E4DE] bg-white p-6">
              <div className="flex items-center justify-center gap-2 text-[#625C54]">
                <AlertCircle className="w-4 h-4 text-[#716A61]" />
                <p className="text-sm">
                  {comparisonPrompt}
                </p>
              </div>
            </div>
          )}

          {paperComparisonBlocked && (
            <div className="mb-6 rounded-2xl border border-[#e6cdbf] bg-[#fff8f3] p-5 text-center text-sm text-[#8a5c45]">
              Paper 级映射尚未达到完整且已复核的发布标准，本次不会计算或展示相似度。
            </div>
          )}

          {subjectComparisonBlocked && (
            <div className="mb-6 rounded-2xl border border-[#e6cdbf] bg-[#fff8f3] p-5 text-center text-sm text-[#8a5c45]">
              当前课程映射仍处于候选复核阶段。本页可以浏览知识树，但不会计算或展示整科与 Paper 的精确相似度。
            </div>
          )}

          {!hasPublishedMappings && (
            <KnowledgeTreeView nodes={treeNodes} />
          )}

          {/* Calculation error */}
          {calcError && isValidComparison && (
            <div className="mb-6 rounded-2xl border border-[#E8E4DE] bg-white p-6 text-center">
              <p className="text-sm text-[#A9471F]">{calcError}</p>
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
                      activeTab === tab.key ? "bg-black text-white" : "text-[#625C54] hover:text-[#3D3832] hover:bg-[#F5F2EE]"
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
