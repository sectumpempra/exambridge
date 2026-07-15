import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, GitCompareArrows, Minus } from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { ALL_PAPERS, type PaperMetadata } from "../../data/papers/paperMetadata";
import { buildKnowledgeComparisonHref } from "../../data/papers/knowledgeComparison";
import { useCourseContext } from "../../course-context/CourseContextProvider";
import { withCourseContext } from "../../course-context/catalog";

type ComparisonRow = {
  label: string;
  value: (paper: PaperMetadata) => string;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "资格与考试局", value: (paper) => `${paper.board} · ${paper.qualification}` },
  { label: "课程代码", value: (paper) => `${paper.subjectCode} · ${paper.subjectName}` },
  { label: "Paper / 组件", value: (paper) => `${paper.subjectCode}/${paper.variantCodes.join("、")} · ${paper.paperName}` },
  { label: "考试时长", value: (paper) => paper.duration },
  { label: "满分", value: (paper) => `${paper.maxMarks} 分` },
  { label: "课程权重", value: (paper) => `${Number(paper.weightPercent.toFixed(1))}%` },
  { label: "计算器", value: (paper) => paper.calculatorAllowed ? "允许使用" : "不得使用" },
  { label: "评分体系", value: (paper) => paper.gradingSystem },
  { label: "考试方式", value: (paper) => paper.paperType },
  { label: "考纲版本", value: (paper) => paper.syllabusVersion },
];

const SUGGESTED_PAIRS = [
  ["CAIE-9709-P1", "CAIE-9709-P3", "同课程：Pure Mathematics 1 与 3"],
  ["CAIE-0580-P2", "CAIE-0580-P4", "同课程：短答卷与结构化试卷"],
  ["CAIE-0580-P2", "EDX-4MA1-P1H", "跨考试局：IGCSE 数学卷"],
] as const;

function PaperSummary({ paper, label, color }: { paper: PaperMetadata; label: string; color: string }) {
  return (
    <div style={{ padding: "16px 18px", background: "rgba(255,255,255,0.9)", border: "1px solid #E8E4DE", borderRadius: 14, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color, fontWeight: 700, letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ marginTop: 7, fontSize: 16, fontWeight: 700, color: "#3D3832" }}>{paper.board} {paper.subjectCode} Paper {paper.paperNumber}</div>
      <div style={{ marginTop: 3, fontSize: 13, color: "#625C54" }}>{paper.paperName}</div>
    </div>
  );
}

export default function PaperComparePage() {
  const { entry, context } = useCourseContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const paperAId = searchParams.get("a") ?? "";
  const paperBId = searchParams.get("b") ?? "";
  const paperA = useMemo(() => ALL_PAPERS.find((paper) => paper.paperId === paperAId), [paperAId]);
  const paperB = useMemo(() => ALL_PAPERS.find((paper) => paper.paperId === paperBId), [paperBId]);

  const orderedPapers = useMemo(() => [...ALL_PAPERS].sort((a, b) => {
    const aMatch = Number(a.board === entry?.boardName && a.subjectCode === entry?.subjectCode);
    const bMatch = Number(b.board === entry?.boardName && b.subjectCode === entry?.subjectCode);
    return bMatch - aMatch || a.paperId.localeCompare(b.paperId, undefined, { numeric: true });
  }), [entry]);

  const updateSelection = (a: string, b: string) => {
    const params = new URLSearchParams(searchParams);
    if (a) params.set("a", a); else params.delete("a");
    if (b) params.set("b", b); else params.delete("b");
    setSearchParams(params);
  };

  const knowledgeHref = paperA && paperB ? buildKnowledgeComparisonHref(paperA, paperB) : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title="Paper 结构对比" />
      <main style={{ flex: 1, padding: "32px 16px 48px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Link to={withCourseContext("/papers", context)} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#675A4D", textDecoration: "none", fontSize: 13, marginBottom: 16 }}>
            <ArrowLeft size={14} /> 返回 Paper 列表
          </Link>

          <h1 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, fontSize: "clamp(24px, 4vw, 34px)", color: "#3D3832" }}>
            <GitCompareArrows size={28} color="#675A4D" /> Paper 结构对比
          </h1>
          <p style={{ margin: "10px 0 0", maxWidth: 760, color: "#625C54", fontSize: 14, lineHeight: 1.7 }}>
            比较“这张卷怎么考”：时长、满分、权重、计算器、组件代码与考试方式。知识点重合和独有内容统一在考纲内容对比中查看。
          </p>

          <section style={{ marginTop: 24, padding: 20, borderRadius: 16, border: "1px solid #E1DBD4", background: "rgba(255,255,255,0.82)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 700, color: "#675A4D" }}>
                PAPER A
                <select aria-label="选择试卷 A" value={paperAId} onChange={(event) => updateSelection(event.target.value, event.target.value === paperBId ? "" : paperBId)} style={{ padding: "11px 12px", border: "1px solid #D9D4CE", borderRadius: 10, background: "white", color: "#3D3832" }}>
                  <option value="">选择第一张 Paper</option>
                  {orderedPapers.map((paper) => <option key={paper.paperId} value={paper.paperId}>{paper.board} {paper.subjectCode} P{paper.paperNumber} — {paper.paperName}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 700, color: "#3F6A78" }}>
                PAPER B
                <select aria-label="选择试卷 B" value={paperBId} onChange={(event) => updateSelection(paperAId, event.target.value)} style={{ padding: "11px 12px", border: "1px solid #D9D4CE", borderRadius: 10, background: "white", color: "#3D3832" }}>
                  <option value="">选择第二张 Paper</option>
                  {orderedPapers.filter((paper) => paper.paperId !== paperAId).map((paper) => <option key={paper.paperId} value={paper.paperId}>{paper.board} {paper.subjectCode} P{paper.paperNumber} — {paper.paperName}</option>)}
                </select>
              </label>
            </div>
          </section>

          {!paperA && !paperB && (
            <section style={{ marginTop: 22 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "#3D3832" }}>常用结构对比</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                {SUGGESTED_PAIRS.map(([a, b, label]) => (
                  <button key={`${a}-${b}`} onClick={() => updateSelection(a, b)} style={{ padding: "15px 16px", textAlign: "left", border: "1px solid #E1DBD4", borderRadius: 12, background: "rgba(255,255,255,0.8)", color: "#4A453F", cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#716A61" }}>{a} <ArrowRight size={12} /> {b}</div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {paperA && paperB && (
            <>
              <section style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                <PaperSummary paper={paperA} label="PAPER A" color="#675A4D" />
                <PaperSummary paper={paperB} label="PAPER B" color="#3F6A78" />
              </section>

              <section style={{ marginTop: 14, overflow: "hidden", border: "1px solid #E1DBD4", borderRadius: 16, background: "rgba(255,255,255,0.88)" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
                    <thead><tr style={{ background: "#EEE9E3" }}><th style={{ padding: 13, width: "19%", textAlign: "left", fontSize: 12, color: "#675A4D" }}>比较项</th><th style={{ padding: 13, width: "40.5%", textAlign: "left", fontSize: 12, color: "#675A4D" }}>Paper A</th><th style={{ padding: 13, width: "40.5%", textAlign: "left", fontSize: 12, color: "#3F6A78" }}>Paper B</th></tr></thead>
                    <tbody>
                      {COMPARISON_ROWS.map((row) => {
                        const a = row.value(paperA);
                        const b = row.value(paperB);
                        const same = a === b;
                        return <tr key={row.label} style={{ borderTop: "1px solid #ECE7E1" }}>
                          <th style={{ padding: 13, textAlign: "left", fontSize: 12, color: "#625C54", fontWeight: 600 }}>{row.label}</th>
                          <td style={{ padding: 13, fontSize: 13, color: "#3D3832" }}>{a}</td>
                          <td style={{ padding: 13, fontSize: 13, color: "#3D3832" }}><span style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>{same ? <Check size={13} color="#4F735B" /> : <Minus size={13} color="#A9471F" />}{b}</span></td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "17px 20px", borderRadius: 14, background: "#E9F0ED", border: "1px solid #CFDDD6" }}>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: "#355344" }}>还要比较“考什么”？</div><div style={{ marginTop: 3, fontSize: 12, color: "#567064" }}>查看共享、独有知识点与内容重合度。</div></div>
                {knowledgeHref ? <Link to={withCourseContext(knowledgeHref, context)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 9, background: "#476B58", color: "white", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>比较知识内容 <ArrowRight size={14} /></Link> : <span style={{ fontSize: 12, color: "#6E675E" }}>这组 Paper 暂无知识树映射</span>}
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
