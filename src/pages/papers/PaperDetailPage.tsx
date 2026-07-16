import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Clock, Calculator, FileText, TrendingUp, AlertCircle, BookOpen, ChevronDown, ChevronRight, GitCompareArrows } from "lucide-react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { getPaperById, ALL_PAPERS } from "../../data/papers/paperMetadata";
import { getBoundariesForPaper } from "../../data/papers/paperBoundaries";
import { getSubjectStats } from "../../data/resultStatistics";
import { loadSyllabus, type PaperSyllabus } from "../../data/papers/paperSyllabus";
import { buildKnowledgeComparisonHref } from "../../data/papers/knowledgeComparison";
import { COURSE_CATALOG, createCourseContext, withCourseContext } from "../../course-context/catalog";
import PastPaperLibrary from "../../components/PastPaperLibrary";

export default function PaperDetailPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [comparePaperId, setComparePaperId] = useState("");
  const [syllabus, setSyllabus] = useState<PaperSyllabus | null>(null);
  const [syllabusLoading, setSyllabusLoading] = useState(false);

  const paper = paperId ? getPaperById(paperId) : undefined;

  // Async load syllabus
  useEffect(() => {
    if (!paperId) {
      queueMicrotask(() => setSyllabus(null));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setSyllabusLoading(true));
    loadSyllabus(paperId).then((data) => {
      if (!cancelled) {
        setSyllabus(data || null);
        setSyllabusLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [paperId]);

  if (!paper) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
        <Header title="Paper 详情" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#6E675E" }}>
            <FileText size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p>Paper 未找到</p>
            <Link to="/papers" style={{ color: "#675A4D", textDecoration: "none", fontSize: 14 }}>← 返回 Paper 列表</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const boundaries = getBoundariesForPaper(paper.paperId);
  const subjectStats = getSubjectStats(paper.subjectCode, paper.board);

  const sortedBoundaries = [...boundaries].sort((a, b) => {
    const yearDiff = Number(b.year) - Number(a.year);
    if (yearDiff !== 0) return yearDiff;
    const sessionOrder: Record<string, number> = { June: 1, November: 2, March: 3, January: 4 };
    return (sessionOrder[a.session] || 99) - (sessionOrder[b.session] || 99);
  });

  const gradeColumns = sortedBoundaries.length > 0
    ? Object.keys(sortedBoundaries[0].grades)
    : [];

  const recentStats = subjectStats
    ? [...subjectStats.years].sort((a, b) => b.year - a.year).slice(0, 5)
    : [];

  const boardColor = paper.board === "CAIE" ? "#675A4D" : paper.board === "Edexcel" ? "#5A7A8E" : "#7A6E5F";
  const paperCourse = COURSE_CATALOG.find((course) => course.boardName === paper.board && course.subjectCode === paper.subjectCode && course.capabilities.papers.status !== "unavailable");
  const paperContext = paperCourse ? createCourseContext(paperCourse) : null;
  const comparePaper = ALL_PAPERS.find((candidate) => candidate.paperId === comparePaperId);
  const knowledgeComparisonHref = comparePaper ? buildKnowledgeComparisonHref(paper, comparePaper) : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title={`${paper.board} ${paper.subjectCode} Paper ${paper.paperNumber}`} />

      <main style={{ flex: 1 }}>
        {/* Back link + Title */}
        <section style={{ padding: "32px 16px 0" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <Link to={withCourseContext("/papers", paperContext)} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#675A4D", textDecoration: "none", fontSize: 13, marginBottom: 16 }}>
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
                <p style={{ fontSize: 13, color: "#625C54", margin: "4px 0 0" }}>
                  {paper.board} · {paper.qualification} · {paper.subjectCode} {paper.subjectName}
                </p>
              </div>
            </div>
            {paperCourse && <nav aria-label="当前 Paper 相关功能" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {paperCourse.capabilities.boundaries.href && <Link to={withCourseContext(paperCourse.capabilities.boundaries.href, paperContext)} style={{ padding: "7px 11px", borderRadius: 8, background: "#fff", border: "1px solid #d9d4ce", color: "#675a4d", fontSize: 12, textDecoration: "none" }}>对应分数线</Link>}
              {paperCourse.capabilities.syllabus.href && <Link to={withCourseContext(paperCourse.capabilities.syllabus.href, paperContext)} style={{ padding: "7px 11px", borderRadius: 8, background: "#fff", border: "1px solid #d9d4ce", color: "#675a4d", fontSize: 12, textDecoration: "none" }}>对应知识树</Link>}
              {paperCourse.capabilities.statistics.href && <Link to={withCourseContext(paperCourse.capabilities.statistics.href, paperContext)} style={{ padding: "7px 11px", borderRadius: 8, background: "#fff", border: "1px solid #d9d4ce", color: "#675a4d", fontSize: 12, textDecoration: "none" }}>成绩统计</Link>}
            </nav>}
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
                  <div style={{ fontSize: 11, color: "#6E675E", marginTop: 2 }}>{card.label}</div>
                </div>
              ))}
            </div>

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
            <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 10, border: "1px solid #d7e0da", background: "#f4f8f5", fontSize: 12, color: "#4f6256", lineHeight: 1.6 }}>
              当前结构适用于 {paper.effectiveFrom}{paper.effectiveTo ? `–${paper.effectiveTo}` : " 起"} 年考纲；历史分数线按表格中的年份和当年满分解释。{" "}
              <a href={paper.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#3f5d50", fontWeight: 600 }}>查看官方考纲</a>
            </div>
          </div>
        </section>

        <section style={{ padding: "0 16px 24px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <PastPaperLibrary
              board={paper.board}
              subjectCode={paper.subjectCode}
              componentCodes={paper.variantCodes}
              paperCodes={[paper.paperNumber]}
              compact
            />
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
              <div style={{ padding: "32px", textAlign: "center", color: "#6E675E", fontSize: 13, background: "rgba(255,255,255,0.5)", borderRadius: 12, border: "1px solid #E8E4DE" }}>
                暂无分数线数据
              </div>
            ) : (
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #E8E4DE", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 500 }}>
                  <colgroup>
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "10%" }} />
                    {gradeColumns.map((_g, i) => <col key={`gc-${i}`} style={{ width: `${64 / gradeColumns.length}%` }} />)}
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
              <div style={{ padding: "32px", textAlign: "center", color: "#6E675E", fontSize: 13, background: "rgba(255,255,255,0.5)", borderRadius: 12, border: "1px solid #E8E4DE" }}>
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
                        <td style={{ padding: "9px 8px", fontSize: 13, color: "#675A4D", fontWeight: 600, textAlign: "center" }}>{s.aStarRate}%</td>
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

        {/* Syllabus Topics — async loaded */}
        <section style={{ padding: "0 16px 32px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "#3D3832", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={18} style={{ color: "#A69888" }} />
              考纲知识点
              {syllabus && <span style={{ fontSize: 12, color: "#6E675E", fontWeight: 400 }}>({syllabus.totalTopics} 个知识点)</span>}
            </h2>

            {syllabusLoading && (
              <div style={{ padding: "24px", textAlign: "center", color: "#6E675E", fontSize: 13 }}>
                加载考纲数据...
              </div>
            )}

            {syllabus && (
              <>
                {syllabus.topics.map((topic) => {
                  const isExpanded = expandedTopic === topic.topicId;
                  return (
                    <div key={topic.topicId} style={{ marginBottom: 6, borderRadius: 10, overflow: "hidden", border: "1px solid #E8E4DE", background: "rgba(255,255,255,0.7)" }}>
                      <div
                        onClick={() => setExpandedTopic(isExpanded ? null : topic.topicId)}
                        style={{ display: "flex", alignItems: "center", padding: "10px 14px", cursor: "pointer", gap: 10 }}
                      >
                        <span style={{ color: "#6E675E", flexShrink: 0 }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#3D3832" }}>
                            {topic.topicName}
                            <span style={{ fontSize: 10, color: "#6E675E", marginLeft: 8, fontWeight: 400, background: "rgba(166,152,136,0.1)", padding: "1px 6px", borderRadius: 4 }}>{topic.topicCategory}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#625C54", marginTop: 1 }}>
                            {topic.subtopics.length} 个子知识点 · {topic.difficulty === "Advanced" ? "高级" : topic.difficulty === "Foundation" ? "基础" : "标准"}
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: "0 14px 12px 38px", fontSize: 12 }}>
                          <p style={{ color: "#5A554F", lineHeight: 1.6, margin: "0 0 8px" }}>{topic.description}</p>
                          {topic.subtopics.map((s, i) => (
                            <div key={i} style={{ color: "#4A453F", padding: "3px 0", display: "flex", alignItems: "flex-start", gap: 6 }}>
                              <span style={{ color: "#A69888", fontSize: 10, marginTop: 2, flexShrink: 0 }}>•</span>
                              {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {!syllabusLoading && !syllabus && (
              <div style={{ padding: "24px", textAlign: "center", color: "#6E675E", fontSize: 13, background: "rgba(255,255,255,0.5)", borderRadius: 12, border: "1px solid #E8E4DE" }}>
                暂无考纲数据
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
              flexDirection: "column",
              gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GitCompareArrows size={18} style={{ color: "#675A4D" }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#3D3832" }}>对比与备课</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "#6E675E" }}>先选择另一张 Paper，再选择比较考试结构或知识内容。</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <select
                  value={comparePaperId}
                  onChange={(e) => setComparePaperId(e.target.value)}
                  style={{ flex: "1 1 200px", padding: "8px 10px", border: "1px solid #D9D4CE", borderRadius: 8, fontSize: 13, background: "#FFF", color: "#3D3832", cursor: "pointer", outline: "none" }}
                >
                  <option value="">选择另一份 Paper 进行对比...</option>
                  {ALL_PAPERS.filter((p) => p.paperId !== paperId).map((p) => (
                    <option key={p.paperId} value={p.paperId}>
                      {p.board} {p.subjectCode} Paper {p.paperNumber} — {p.paperName}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {comparePaperId ? (
                  <Link to={withCourseContext(`/papers/compare?a=${paperId}&b=${comparePaperId}`, paperContext)} style={{ padding: "11px 16px", background: "linear-gradient(135deg, #675A4D, #8C7C6C)", color: "#FFF", fontSize: 13, fontWeight: 600, borderRadius: 9, textDecoration: "none", textAlign: "center" }}>比较考试结构 →</Link>
                ) : (
                  <div aria-disabled="true" style={{ padding: "11px 16px", background: "#E7E2DC", color: "#8A8279", fontSize: 13, fontWeight: 600, borderRadius: 9, textAlign: "center" }}>比较考试结构</div>
                )}
                {comparePaperId ? (
                  knowledgeComparisonHref ? (
                    <Link
                      to={withCourseContext(knowledgeComparisonHref, paperContext)}
                      style={{ padding: "11px 16px", background: "#E4EEE9", border: "1px solid #C8DAD0", color: "#355344", fontSize: 13, fontWeight: 600, borderRadius: 9, textDecoration: "none", textAlign: "center" }}
                    >
                      比较知识内容 →
                    </Link>
                  ) : (
                    <div style={{ padding: "11px 16px", background: "#EEEAE5", color: "#817970", fontSize: 12, borderRadius: 9, textAlign: "center" }}>知识树映射待补充</div>
                  )
                ) : (
                  <div aria-disabled="true" style={{ padding: "11px 16px", background: "#E7E2DC", color: "#8A8279", fontSize: 13, fontWeight: 600, borderRadius: 9, textAlign: "center" }}>比较知识内容</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
