import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, FileText, Clock, Calculator, ChevronRight } from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { ALL_PAPERS, type PaperMetadata } from "../../data/papers/paperMetadata";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "A-Level", to: "/alevel" },
  { label: "GCSE", to: "/gcse" },
  { label: "Paper 查询", to: "/papers" },
  { label: "等级预测", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
  { label: "A*率趋势", to: "/statistics" },
];

export default function PaperSearchPage() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const [search, setSearch] = useState(initialSearch);
  const [boardFilter, setBoardFilter] = useState("");
  const [qualFilter, setQualFilter] = useState("");

  const boards = useMemo(() => {
    const set = new Set(ALL_PAPERS.map((p) => p.board));
    return Array.from(set).sort();
  }, []);

  const quals = useMemo(() => {
    const set = new Set(ALL_PAPERS.map((p) => p.qualification));
    return Array.from(set).sort();
  }, []);

  const filteredPapers = useMemo(() => {
    let result = [...ALL_PAPERS];
    if (boardFilter) {
      result = result.filter((p) => p.board === boardFilter);
    }
    if (qualFilter) {
      result = result.filter((p) => p.qualification === qualFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.paperName.toLowerCase().includes(s) ||
          p.subjectCode.toLowerCase().includes(s) ||
          p.subjectName.toLowerCase().includes(s) ||
          p.paperId.toLowerCase().includes(s)
      );
    }
    return result;
  }, [boardFilter, qualFilter, search]);

  const groupedBySubject = useMemo(() => {
    const map = new Map<string, PaperMetadata[]>();
    for (const p of filteredPapers) {
      const key = `${p.board} ${p.qualification} ${p.subjectCode} — ${p.subjectName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Sort papers within each group by paper number
    for (const [, papers] of map) {
      papers.sort((a, b) => a.paperNumber.localeCompare(b.paperNumber, undefined, { numeric: true }));
    }
    return map;
  }, [filteredPapers]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title="Paper 查询" links={NAV_LINKS} />

      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section style={{ padding: "40px 16px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700, color: "#3D3832", margin: 0, letterSpacing: "0.02em" }}>
              <span style={{ color: "#8F7F6E" }}>按 Paper</span> 查询考试信息
            </h1>
            <p style={{ fontSize: 14, color: "#A8A095", marginTop: 10, lineHeight: 1.7 }}>
              查看每份 Paper 的时长、满分、占比、历史分数线和 A*率<br />
              首批覆盖 CAIE A-Level Math (9709)、CAIE IGCSE Math (0580)、Edexcel IGCSE Math A (4MA1)
            </p>
          </div>
        </section>

        {/* Filters */}
        <section style={{ padding: "0 16px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "center" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 400 }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#B8B0A4" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索 Paper 名称、科目代码..."
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 36px",
                    border: "1px solid #D9D4CE",
                    borderRadius: 10,
                    fontSize: 14,
                    backgroundColor: "#FFF",
                    color: "#3D3832",
                    outline: "none",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#A69888"; e.target.style.boxShadow = "0 0 0 3px rgba(166,152,136,0.12)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#D9D4CE"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Board filter */}
              <select
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #D9D4CE",
                  borderRadius: 10,
                  fontSize: 14,
                  backgroundColor: "#FFF",
                  color: "#3D3832",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="">全部考试局</option>
                {boards.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              {/* Qual filter */}
              <select
                value={qualFilter}
                onChange={(e) => setQualFilter(e.target.value)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #D9D4CE",
                  borderRadius: 10,
                  fontSize: 14,
                  backgroundColor: "#FFF",
                  color: "#3D3832",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="">全部资格</option>
                {quals.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: "center", marginTop: 10 }}>
              <span style={{ fontSize: 12, color: "#A8A095" }}>
                共 {filteredPapers.length} 份 Paper
                {(boardFilter || qualFilter || search) && `（已筛选）`}
              </span>
            </div>
          </div>
        </section>

        {/* Paper List */}
        <section style={{ padding: "0 16px 48px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            {groupedBySubject.size === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#A8A095" }}>
                <FileText size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <p>没有找到匹配的 Paper</p>
              </div>
            ) : (
              Array.from(groupedBySubject.entries()).map(([subjectKey, papers]) => (
                <div key={subjectKey} style={{ marginBottom: 24 }}>
                  {/* Subject header */}
                  <div style={{
                    padding: "12px 16px",
                    background: "linear-gradient(135deg, #ECE7E0 0%, #E8E4DE 100%)",
                    borderRadius: "12px 12px 0 0",
                    border: "1px solid #E8E4DE",
                    borderBottom: "none",
                  }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#3D3832", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#8F7F6E" }}>{papers[0].board}</span>
                      <span style={{ color: "#A8A095", fontWeight: 400 }}>/</span>
                      {papers[0].subjectName}
                      <span style={{ fontSize: 12, color: "#A8A095", fontWeight: 400, background: "rgba(166,152,136,0.12)", padding: "2px 8px", borderRadius: 6 }}>
                        {papers[0].subjectCode}
                      </span>
                      <span style={{ fontSize: 12, color: "#A8A095", fontWeight: 400, marginLeft: 4 }}>
                        {papers[0].qualification}
                      </span>
                    </h3>
                  </div>

                  {/* Paper cards */}
                  <div style={{ border: "1px solid #E8E4DE", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                    {papers.map((paper, idx) => (
                      <Link
                        key={paper.paperId}
                        to={`/papers/${paper.paperId}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "14px 16px",
                          textDecoration: "none",
                          color: "inherit",
                          backgroundColor: idx % 2 === 0 ? "rgba(255,255,255,0.8)" : "rgba(245,242,238,0.6)",
                          borderBottom: idx < papers.length - 1 ? "1px solid rgba(233,228,222,0.6)" : "none",
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(166,152,136,0.06)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = idx % 2 === 0 ? "rgba(255,255,255,0.8)" : "rgba(245,242,238,0.6)"; }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#3D3832", marginBottom: 4 }}>
                            Paper {paper.paperNumber}: {paper.paperName}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: 12, color: "#8B8378" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Clock size={12} /> {paper.duration}
                            </span>
                            <span>满分 {paper.maxMarks}</span>
                            <span>占比 {paper.weightPercent}%</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Calculator size={12} />
                              {paper.calculatorAllowed ? "计算器" : "非计算器"}
                            </span>
                            <span style={{
                              fontSize: 11,
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: paper.gradingSystem === "9-1" ? "rgba(148,168,184,0.15)" : "rgba(166,152,136,0.12)",
                              color: paper.gradingSystem === "9-1" ? "#5A7A8E" : "#7A6E5F",
                            }}>
                              {paper.gradingSystem}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={18} style={{ color: "#C4BDB3", flexShrink: 0, marginLeft: 8 }} />
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
