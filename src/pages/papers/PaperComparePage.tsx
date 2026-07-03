import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, GitCompareArrows, Check, X, Minus, ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { ALL_PAPERS, getPaperById } from "../../data/papers/paperMetadata";
import { comparePapers } from "../../data/papers/paperSyllabus";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "Paper 查询", to: "/papers" },
  { label: "等级预测", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
];

const COLORS = {
  full: { bg: "rgba(154,175,158,0.12)", border: "rgba(154,175,158,0.35)", text: "#5A7A5E", dot: "#9AAF9E" },
  partial: { bg: "rgba(184,166,138,0.12)", border: "rgba(184,166,138,0.35)", text: "#8A7A5E", dot: "#B8A68A" },
  "only-a": { bg: "rgba(191,168,160,0.12)", border: "rgba(191,168,160,0.35)", text: "#8F6860", dot: "#BFA8A0" },
  "only-b": { bg: "rgba(168,160,176,0.12)", border: "rgba(168,160,176,0.35)", text: "#6A5E78", dot: "#A8A0B0" },
};

const TYPE_LABELS: Record<string, string> = {
  full: "完全重合",
  partial: "部分重合",
  "only-a": "Paper A 独有",
  "only-b": "Paper B 独有",
};

export default function PaperComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const paperAId = searchParams.get("a") || "";
  const paperBId = searchParams.get("b") || "";

  const paperA = useMemo(() => getPaperById(paperAId), [paperAId]);
  const paperB = useMemo(() => getPaperById(paperBId), [paperBId]);

  const comparison = useMemo(() => {
    if (!paperAId || !paperBId || paperAId === paperBId) return null;
    return comparePapers(paperAId, paperBId);
  }, [paperAId, paperBId]);

  const availablePapers = useMemo(() => ALL_PAPERS.filter((p) => p.paperId !== paperAId), [paperAId]);

  const toggleExpand = (tid: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title="Paper 对比" links={NAV_LINKS} />

      <main style={{ flex: 1 }}>
        {/* Header */}
        <section style={{ padding: "32px 16px 0" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <Link to="/papers" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#8F7F6E", textDecoration: "none", fontSize: 13, marginBottom: 16 }}>
              <ArrowLeft size={14} /> 返回 Paper 列表
            </Link>

            <h1 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, color: "#3D3832", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <GitCompareArrows size={24} style={{ color: "#A69888" }} />
              Paper 考纲对比
            </h1>
          </div>
        </section>

        {/* Paper Selectors */}
        <section style={{ padding: "20px 16px" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <select
                value={paperAId}
                onChange={(e) => {
                  const newA = e.target.value;
                  if (newA === paperBId) return;
                  setSearchParams({ a: newA, b: paperBId });
                }}
                style={{ flex: "1 1 280px", padding: "10px 12px", border: "1px solid #D9D4CE", borderRadius: 10, fontSize: 14, background: "#FFF", color: "#3D3832", cursor: "pointer", outline: "none" }}
              >
                <option value="">选择 Paper A</option>
                {ALL_PAPERS.map((p) => (
                  <option key={p.paperId} value={p.paperId}>
                    {p.board} {p.subjectCode} Paper {p.paperNumber} — {p.paperName}
                  </option>
                ))}
              </select>

              <span style={{ color: "#A8A095", fontSize: 13, fontWeight: 600 }}>VS</span>

              <select
                value={paperBId}
                onChange={(e) => {
                  const newB = e.target.value;
                  if (newB === paperAId) return;
                  setSearchParams({ a: paperAId, b: newB });
                }}
                style={{ flex: "1 1 280px", padding: "10px 12px", border: "1px solid #D9D4CE", borderRadius: 10, fontSize: 14, background: "#FFF", color: "#3D3832", cursor: "pointer", outline: "none" }}
              >
                <option value="">选择 Paper B</option>
                {availablePapers.map((p) => (
                  <option key={p.paperId} value={p.paperId}>
                    {p.board} {p.subjectCode} Paper {p.paperNumber} — {p.paperName}
                  </option>
                ))}
              </select>
            </div>

            {/* Paper info cards */}
            {paperA && paperB && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 16 }}>
                {[
                  { label: "Paper A", p: paperA, color: "#8F7F6E" },
                  { label: "Paper B", p: paperB, color: "#5A7A8E" },
                ].map(({ label, p, color }) => (
                  <div key={label} style={{ padding: "14px 18px", background: "rgba(255,255,255,0.8)", border: `1px solid ${color}22`, borderRadius: 12, borderLeft: `3px solid ${color}` }}>
                    <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#3D3832" }}>{p.board} {p.subjectCode} Paper {p.paperNumber}</div>
                    <div style={{ fontSize: 12, color: "#8B8378", marginTop: 2 }}>{p.paperName}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#A8A095" }}>
                      <span>{p.duration}</span>
                      <span>满分 {p.maxMarks}</span>
                      <span>{p.calculatorAllowed ? "计算器" : "非计算器"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Results */}
        {comparison && (
          <>
            {/* Stats Summary */}
            <section style={{ padding: "0 16px 24px" }}>
              <div style={{ maxWidth: 960, margin: "0 auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                  {[
                    { label: "重合率", value: `${comparison.overlapRate}%`, color: "#5A7A5E", sub: `${comparison.fullOverlap + comparison.partialOverlap}/${comparison.totalUniqueTopics}` },
                    { label: "完全重合", value: String(comparison.fullOverlap), color: "#9AAF9E" },
                    { label: "部分重合", value: String(comparison.partialOverlap), color: "#B8A68A" },
                    { label: "Paper A 独有", value: String(comparison.onlyInA), color: "#BFA8A0" },
                    { label: "Paper B 独有", value: String(comparison.onlyInB), color: "#A8A0B0" },
                  ].map((s) => (
                    <div key={s.label} style={{ textAlign: "center", padding: "14px", background: "rgba(255,255,255,0.8)", border: "1px solid #E8E4DE", borderRadius: 12 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "#8B8378", marginTop: 2 }}>{s.label}</div>
                      {s.sub && <div style={{ fontSize: 10, color: "#A8A095", marginTop: 2 }}>{s.sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Category breakdown */}
                {Object.keys(comparison.categoryStats).length > 0 && (
                  <div style={{ marginTop: 16, padding: "14px 18px", background: "rgba(255,255,255,0.6)", border: "1px solid #E8E4DE", borderRadius: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#3D3832", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <BarChart3 size={14} style={{ color: "#A69888" }} />
                      按分类统计
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                      {Object.entries(comparison.categoryStats).map(([cat, stats]) => (
                        <div key={cat} style={{ fontSize: 12, color: "#5A554F" }}>
                          <span style={{ fontWeight: 600 }}>{cat}</span>
                          <span style={{ color: "#A8A095", marginLeft: 4 }}>
                            共{stats.total} · 重合{stats.full + stats.partial} · A独{stats.onlyA} · B独{stats.onlyB}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Topic Comparison List */}
            <section style={{ padding: "0 16px 48px" }}>
              <div style={{ maxWidth: 960, margin: "0 auto" }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#3D3832", margin: "0 0 12px" }}>
                  知识点详细对比
                </h2>

                {comparison.topics.map((topic) => {
                  const c = COLORS[topic.overlapType];
                  const isExpanded = expandedTopics.has(topic.topicId);
                  const hasSubtopics = topic.commonSubtopics.length > 0 || topic.onlyInA.length > 0 || topic.onlyInB.length > 0;

                  return (
                    <div
                      key={topic.topicId}
                      style={{
                        marginBottom: 8,
                        borderRadius: 10,
                        overflow: "hidden",
                        border: `1px solid ${c.border}`,
                        background: c.bg,
                      }}
                    >
                      {/* Topic header row */}
                      <div
                        onClick={() => hasSubtopics && toggleExpand(topic.topicId)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "10px 14px",
                          cursor: hasSubtopics ? "pointer" : "default",
                          gap: 10,
                        }}
                      >
                        {hasSubtopics && (
                          <span style={{ color: "#A8A095", flexShrink: 0 }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        )}

                        {/* Status icon */}
                        <span style={{ flexShrink: 0 }}>
                          {topic.overlapType === "full" && <Check size={14} style={{ color: c.dot }} />}
                          {topic.overlapType === "partial" && <Minus size={14} style={{ color: c.dot }} />}
                          {(topic.overlapType === "only-a" || topic.overlapType === "only-b") && <X size={14} style={{ color: c.dot }} />}
                        </span>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
                            {topic.topicName}
                            <span style={{ fontSize: 10, color: "#A8A095", marginLeft: 8, fontWeight: 400 }}>{topic.category}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#8B8378", marginTop: 1 }}>
                            {TYPE_LABELS[topic.overlapType]}
                            {topic.difficultyA && topic.difficultyB && topic.difficultyA !== topic.difficultyB && (
                              <span style={{ marginLeft: 8 }}>
                                ({topic.difficultyA} → {topic.difficultyB})
                              </span>
                            )}
                          </div>
                        </div>

                        <span style={{
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "rgba(255,255,255,0.5)",
                          color: c.text,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}>
                          {topic.inA && topic.inB
                            ? `${topic.commonSubtopics.length} 共同 · ${topic.onlyInA.length} A独 · ${topic.onlyInB.length} B独`
                            : topic.inA
                              ? `${topic.onlyInA.length} 子知识点`
                              : `${topic.onlyInB.length} 子知识点`}
                        </span>
                      </div>

                      {/* Expanded subtopics */}
                      {isExpanded && hasSubtopics && (
                        <div style={{ padding: "0 14px 12px 40px", fontSize: 12 }}>
                          {topic.commonSubtopics.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ color: "#5A7A5E", fontWeight: 600, fontSize: 11, marginBottom: 4 }}>共同子知识点</div>
                              {topic.commonSubtopics.map((s, i) => (
                                <div key={i} style={{ color: "#5A554F", padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                                  <Check size={10} style={{ color: "#9AAF9E", marginTop: 3, flexShrink: 0 }} />
                                  {s}
                                </div>
                              ))}
                            </div>
                          )}
                          {topic.onlyInA.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ color: "#8F6860", fontWeight: 600, fontSize: 11, marginBottom: 4 }}>Paper A 独有</div>
                              {topic.onlyInA.map((s, i) => (
                                <div key={i} style={{ color: "#5A554F", padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                                  <X size={10} style={{ color: "#BFA8A0", marginTop: 3, flexShrink: 0 }} />
                                  {s}
                                </div>
                              ))}
                            </div>
                          )}
                          {topic.onlyInB.length > 0 && (
                            <div>
                              <div style={{ color: "#6A5E78", fontWeight: 600, fontSize: 11, marginBottom: 4 }}>Paper B 独有</div>
                              {topic.onlyInB.map((s, i) => (
                                <div key={i} style={{ color: "#5A554F", padding: "2px 0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                                  <X size={10} style={{ color: "#A8A0B0", marginTop: 3, flexShrink: 0 }} />
                                  {s}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
