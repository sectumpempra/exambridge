import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Clock, Calculator, FileText, TrendingUp, AlertCircle } from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { getPaperById } from "../../data/papers/paperMetadata";
import { getBoundariesForPaper } from "../../data/papers/paperBoundaries";
import { getSubjectStats } from "../../data/resultStatistics";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "A-Level", to: "/alevel" },
  { label: "GCSE", to: "/gcse" },
  { label: "Paper 查询", to: "/papers" },
  { label: "等级预测", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
  { label: "A*率趋势", to: "/statistics" },
];

export default function PaperDetailPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const paper = paperId ? getPaperById(paperId) : undefined;

  if (!paper) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
        <Header title="Paper 详情" links={NAV_LINKS} />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#A8A095" }}>
            <FileText size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p>Paper 未找到</p>
            <Link to="/papers" style={{ color: "#8F7F6E", textDecoration: "none", fontSize: 14 }}>← 返回 Paper 列表</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const boundaries = getBoundariesForPaper(paper.paperId);
  const subjectStats = getSubjectStats(paper.subjectCode, paper.board);

  // Sort boundaries by year desc, then session
  const sortedBoundaries = [...boundaries].sort((a, b) => {
    const yearDiff = Number(b.year) - Number(a.year);
    if (yearDiff !== 0) return yearDiff;
    const sessionOrder: Record<string, number> = { June: 1, November: 2, March: 3, January: 4 };
    return (sessionOrder[a.session] || 99) - (sessionOrder[b.session] || 99);
  });

  // Get grade columns from first boundary entry
  const gradeColumns = sortedBoundaries.length > 0
    ? Object.keys(sortedBoundaries[0].grades)
    : [];

  // Get recent subject stats (last 3 entries)
  const recentStats = subjectStats
    ? [...subjectStats.years].sort((a, b) => b.year - a.year).slice(0, 5)
    : [];

  const boardColor = paper.board === "CAIE" ? "#8F7F6E" : paper.board === "Edexcel" ? "#5A7A8E" : "#7A6E5F";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title={`${paper.board} ${paper.subjectCode} Paper ${paper.paperNumber}`} links={NAV_LINKS} />

      <main style={{ flex: 1 }}>
        {/* Back link + Title */}
        <section style={{ padding: "32px 16px 0" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <Link to="/papers" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#8F7F6E", textDecoration: "none", fontSize: 13, marginBottom: 16 }}>
              <ArrowLeft size={14} /> 返回 Paper 列表
            </Link>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: `linear-gradient(135deg, ${boardColor}22, ${boardColor}11)`,
                border: `1px solid ${boardColor}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, color: boardColor,
                flexShrink: 0,
              }}>
                P{paper.paperNumber}
              </div>
              <div>
                <h1 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, color: "#3D3832", margin: 0 }}>
                  {paper.paperName}
                </h1>
                <p style={{ fontSize: 13, color: "#8B8378", margin: "4px 0 0" }}>
                  {paper.board} · {paper.qualification} · {paper.subjectCode} {paper.subjectName}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Basic Info Cards */}
        <section style={{ padding: "24px 16px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {[
                { icon: <Clock size={18} />, label: "时长", value: paper.duration },
                { icon: <FileText size={18} />, label: "满分", value: paper.maxMarks.toString() },
                { icon: <TrendingUp size={18} />, label: "占比", value: `${paper.weightPercent}%` },
                { icon: <Calculator size={18} />, label: "计算器", value: paper.calculatorAllowed ? "允许" : "不允许" },
              ].map((card) => (
                <div key={card.label} style={{
                  background: "rgba(255,255,255,0.8)",
                  border: "1px solid #E8E4DE",
                  borderRadius: 12,
                  padding: "16px",
                  textAlign: "center",
                }}>
                  <div style={{ color: "#A69888", marginBottom: 6 }}>{card.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#3D3832" }}>{card.value}</div>
                  <div style={{ fontSize: 11, color: "#A8A095", marginTop: 2 }}>{card.label}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            {paper.description && (
              <div style={{
                marginTop: 16,
                padding: "16px 20px",
                background: "rgba(255,255,255,0.6)",
                border: "1px solid #E8E4DE",
                borderRadius: 12,
                fontSize: 13,
                color: "#5A554F",
                lineHeight: 1.7,
              }}>
                {paper.description}
              </div>
            )}
          </div>
        </section>

        {/* Grade Boundaries Table */}
        <section style={{ padding: "0 16px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#3D3832", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={18} style={{ color: "#A69888" }} />
              历史分数线
            </h2>

            {sortedBoundaries.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#A8A095", fontSize: 13, background: "rgba(255,255,255,0.5)", borderRadius: 12, border: "1px solid #E8E4DE" }}>
                暂无分数线数据
              </div>
            ) : (
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #E8E4DE", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 500 }}>
                  <colgroup>
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "10%" }} />
                    {gradeColumns.map(() => <col key={Math.random()} style={{ width: `${64 / gradeColumns.length}%` }} />)}
                  </colgroup>
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg, #ECE7E0 0%, #E8E4DE 100%)" }}>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>年份</th>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>考试季</th>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>满分</th>
                      {gradeColumns.map((g) => (
                        <th key={g} style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>{g}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBoundaries.map((b, idx) => (
                      <tr key={`${b.year}-${b.session}-${b.component}`}
                        style={{ backgroundColor: idx % 2 === 0 ? "rgba(255,255,255,0.8)" : "rgba(245,242,238,0.6)", borderBottom: "1px solid rgba(233,228,222,0.6)" }}>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center" }}>{b.year}</td>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center" }}>{b.session}</td>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center" }}>{b.maxMark}</td>
                        {gradeColumns.map((g) => (
                          <td key={g} style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center" }}>
                            {b.grades[g] !== undefined ? b.grades[g] : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Subject-Level Stats */}
        <section style={{ padding: "0 16px 32px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#3D3832", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={18} style={{ color: "#A69888" }} />
              所属科目成绩统计
            </h2>

            {/* Disclaimer */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "10px 14px",
              background: "rgba(166,152,136,0.08)",
              border: "1px solid rgba(166,152,136,0.2)",
              borderRadius: 8,
              marginBottom: 12,
            }}>
              <AlertCircle size={14} style={{ color: "#A69888", flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: "#7A6E5F", lineHeight: 1.5 }}>
                以下数据为<strong>科目级</strong>（{paper.subjectCode} {paper.subjectName} 整体），非单份 Paper 的 A*率。各考试局不公开 Paper 级成绩统计。
              </span>
            </div>

            {recentStats.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#A8A095", fontSize: 13, background: "rgba(255,255,255,0.5)", borderRadius: 12, border: "1px solid #E8E4DE" }}>
                暂无科目成绩统计数据
              </div>
            ) : (
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #E8E4DE", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 500 }}>
                  <colgroup>
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "16%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg, #ECE7E0 0%, #E8E4DE 100%)" }}>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>年份</th>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>考试季</th>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>A*率</th>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>A 率</th>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>B 率</th>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>C 率</th>
                      <th style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#7A6E5F", textAlign: "center" }}>报考人数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentStats.map((s, idx) => (
                      <tr key={`${s.year}-${s.series}`}
                        style={{ backgroundColor: idx % 2 === 0 ? "rgba(255,255,255,0.8)" : "rgba(245,242,238,0.6)", borderBottom: "1px solid rgba(233,228,222,0.6)" }}>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center" }}>{s.year}</td>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center", textTransform: "capitalize" }}>{s.series}</td>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#8F7F6E", fontWeight: 600, textAlign: "center" }}>{s.aStarRate}%</td>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center" }}>{s.aRate}%</td>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center" }}>{s.bRate}%</td>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center" }}>{s.cRate}%</td>
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#4A453F", textAlign: "center" }}>
                          {s.entries ? s.entries.toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Compare CTA */}
        <section style={{ padding: "0 16px 48px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{
              padding: "20px 24px",
              background: "linear-gradient(135deg, rgba(143,127,110,0.08), rgba(166,152,136,0.04))",
              border: "1px solid rgba(166,152,136,0.2)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#3D3832" }}>Paper 对比功能</div>
                <div style={{ fontSize: 12, color: "#8B8378", marginTop: 4 }}>
                  选择两份 Paper，查看考纲重合度与差异（即将上线）
                </div>
              </div>
              <span style={{
                fontSize: 12,
                color: "#A8A095",
                background: "rgba(255,255,255,0.6)",
                padding: "4px 12px",
                borderRadius: 6,
              }}>
                开发中
              </span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
