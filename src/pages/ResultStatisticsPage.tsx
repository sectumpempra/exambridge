/**
 * Result Statistics Page - Historical Grade Rate Trends
 * 
 * Displays A-Star / A / B / C / D / E grade rate trends across years for multiple subjects and boards.
 * 
 * Features:
 * - High-contrast color scheme for each grade level
 * - Proper x-axis labels showing year + month for every data point
 * - Subject/grade/board/level selector
 * - Summary stat cards showing latest rates
 * - Responsive area chart with Recharts
 */

import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  ALL_SUBJECT_STATS, getAvailableBoards, getAvailableLevels, getAvailableSubjects,
  type SubjectStats,
} from "../data/resultStatistics";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { BarChart3, Info, TrendingDown, TrendingUp, Minus } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// HIGH-CONTRAST GRADE COLORS (distinct and accessible)
// ═══════════════════════════════════════════════════════════

const GRADE_COLORS: Record<string, { stroke: string; fill: string }> = {
  aStarRate: { stroke: "#C75B2A", fill: "#C75B2A" },   // Burnt orange - A*
  aRate:     { stroke: "#2E7D6F", fill: "#2E7D6F" },   // Teal green - A
  bRate:     { stroke: "#3B6EA5", fill: "#3B6EA5" },   // Steel blue - B
  cRate:     { stroke: "#7B5EA7", fill: "#7B5EA7" },   // Purple - C
  dRate:     { stroke: "#A0885E", fill: "#A0885E" },   // Tan - D
  eRate:     { stroke: "#8A8A8A", fill: "#8A8A8A" },   // Gray - E
};

const GRADE_LABELS: Record<string, string> = {
  aStarRate: "A*",
  aRate: "A",
  bRate: "B",
  cRate: "C",
  dRate: "D",
  eRate: "E",
};

const ALL_GRADES = ["aStarRate", "aRate", "bRate", "cRate", "dRate", "eRate"];

// ═══════════════════════════════════════════════════════════
// X-AXIS LABEL: always show year + month
// ═══════════════════════════════════════════════════════════

function formatXAxisLabel(year: number, series: string): string {
  const monthAbbr =
    series === "june" ? "Jun"
    : series === "november" ? "Nov"
    : series === "march" ? "Mar"
    : series === "summer" ? "Sum"
    : series;
  return `${year} ${monthAbbr}`;
}

interface ChartDataPoint {
  label: string;
  sortIndex: number;
  [key: string]: string | number;
}

function buildChartData(
  stats: SubjectStats,
  gradesToShow: string[]
): ChartDataPoint[] {
  // Sort chronologically
  const sorted = [...stats.years].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    const seriesOrder = { march: 0, june: 1, summer: 1, november: 2 };
    return (seriesOrder[a.series as keyof typeof seriesOrder] || 0) -
           (seriesOrder[b.series as keyof typeof seriesOrder] || 0);
  });

  return sorted.map((y, idx) => {
    const pt: ChartDataPoint = {
      label: formatXAxisLabel(y.year, y.series),
      sortIndex: idx,
    };
    gradesToShow.forEach((g) => {
      pt[g] = ((y as unknown) as Record<string, number>)[g] ?? 0;
    });
    return pt;
  });
}

// ═══════════════════════════════════════════════════════════
// TOOLTIP
// ═══════════════════════════════════════════════════════════

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#FFF",
        border: "1px solid #E8E4DE",
        borderRadius: 10,
        padding: "12px 16px",
        boxShadow: "0 4px 16px rgba(61,56,50,0.12)",
        fontSize: 13,
      }}
    >
      <p style={{ fontWeight: 700, color: "#3D3832", margin: "0 0 8px" }}>
        {label}
      </p>
      {payload.map((entry: any) => (
        <div
          key={entry.dataKey}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
            color: "#5A554F",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: entry.color,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600 }}>{GRADE_LABELS[entry.dataKey]}</span>
          <span style={{ marginLeft: "auto", fontWeight: 700, minWidth: 48, textAlign: "right" }}>
            {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LEGEND
// ═══════════════════════════════════════════════════════════

function CustomLegend({ payload }: any) {
  if (!payload) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 16,
        marginTop: 8,
        flexWrap: "wrap",
      }}
    >
      {payload.map((entry: any) => (
        <span
          key={entry.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#5A554F",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 12,
              height: 3,
              borderRadius: 2,
              background: entry.color,
              display: "inline-block",
            }}
          />
          {GRADE_LABELS[entry.value]} 率
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  color,
  change,
}: {
  label: string;
  value: number;
  color: string;
  change: number | null;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "16px 20px",
        background: "#FFF",
        borderRadius: 12,
        border: "1px solid #E8E4DE",
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color,
          lineHeight: 1.1,
        }}
      >
        {value.toFixed(1)}%
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#8B8378",
          marginTop: 4,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      {change !== null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            marginTop: 6,
            fontSize: 11,
            fontWeight: 600,
            color: change > 0 ? "#2E7D6F" : change < 0 ? "#C75B2A" : "#8A8A8A",
          }}
        >
          {change > 0 ? <TrendingUp size={12} /> : change < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          {change > 0 ? "+" : ""}
          {change.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "A-Level 分数线", to: "/alevel" },
  { label: "GCSE 分数线", to: "/gcse" },
  { label: "等级预测", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
  { label: "A*率趋势", to: "/statistics" },
  { label: "人格测试", to: "/personality" },
];

export default function ResultStatisticsPage() {
  const [selectedBoard, setSelectedBoard] = useState("CAIE");
  const [selectedLevel, setSelectedLevel] = useState("A-Level");
  const [selectedSubjectCode, setSelectedSubjectCode] = useState("9709");
  const [gradesToShow, setGradesToShow] = useState<string[]>([
    "aStarRate", "aRate", "bRate",
  ]);

  // Derived options
  const boards = getAvailableBoards();
  const levels = getAvailableLevels(selectedBoard);
  const subjects = getAvailableSubjects(selectedBoard, selectedLevel);

  // Current subject
  const currentStats = useMemo(() => {
    return ALL_SUBJECT_STATS.find(
      (s) => s.code === selectedSubjectCode && s.board === selectedBoard
    );
  }, [selectedSubjectCode, selectedBoard]);

  // Chart data
  const chartData = useMemo(() => {
    if (!currentStats) return [];
    return buildChartData(currentStats, gradesToShow);
  }, [currentStats, gradesToShow]);

  // Latest stats
  const latest = useMemo(() => {
    if (!currentStats || currentStats.years.length === 0) return null;
    return [...currentStats.years].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const order = { november: 2, june: 1, summer: 1, march: 0 };
      return (order[a.series] || 0) - (order[b.series] || 0);
    })[0];
  }, [currentStats]);

  // Year-over-year change
  const changes = useMemo(() => {
    if (!currentStats || currentStats.years.length < 2) return {} as Record<string, number | null>;
    const sorted = [...currentStats.years].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const order = { november: 2, june: 1, summer: 1, march: 0 };
      return (order[a.series] || 0) - (order[b.series] || 0);
    });
    const now = sorted[0];
    const prev = sorted.find((y) => y.year < now.year || (y.year === now.year && y.series !== now.series));
    if (!prev) return {} as Record<string, number | null>;
    const result: Record<string, number | null> = {};
    ALL_GRADES.forEach((g) => {
      result[g] = ((now as unknown) as Record<string, number>)[g] - ((prev as unknown) as Record<string, number>)[g];
    });
    return result;
  }, [currentStats]);

  const toggleGrade = (grade: string) => {
    setGradesToShow((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F0EDE8" }}>
      <Header title="" links={NAV_LINKS} />

      <main style={{ flex: 1, padding: "24px 16px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Page Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #8F7F6E, #A69888)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BarChart3 size={22} style={{ color: "#FFF" }} />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#3D3832", margin: 0 }}>
                  历年 A*率 / A率趋势
                </h1>
                <p style={{ fontSize: 12, color: "#A8A095", margin: "2px 0 0" }}>
                  各考试局、各科目历年成绩统计 · 数据驱动备考决策
                </p>
              </div>
            </div>
          </div>

          {currentStats && (
            <>
              {/* Controls */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 20,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <select
                  value={selectedBoard}
                  onChange={(e) => {
                    setSelectedBoard(e.target.value);
                    const newLevels = getAvailableLevels(e.target.value);
                    if (newLevels.length > 0) setSelectedLevel(newLevels[0]);
                  }}
                  style={selectStyle}
                >
                  {boards.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                <select
                  value={selectedLevel}
                  onChange={(e) => {
                    setSelectedLevel(e.target.value);
                    const newSubjects = getAvailableSubjects(selectedBoard, e.target.value);
                    if (newSubjects.length > 0) setSelectedSubjectCode(newSubjects[0].code);
                  }}
                  style={selectStyle}
                >
                  {levels.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>

                <select
                  value={selectedSubjectCode}
                  onChange={(e) => setSelectedSubjectCode(e.target.value)}
                  style={{ ...selectStyle, minWidth: 200 }}
                >
                  {subjects.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Stat Cards */}
              {latest && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <StatCard
                    label="A* 率"
                    value={latest.aStarRate}
                    color={GRADE_COLORS.aStarRate.stroke}
                    change={changes.aStarRate ?? null}
                  />
                  <StatCard
                    label="A 率"
                    value={latest.aRate}
                    color={GRADE_COLORS.aRate.stroke}
                    change={changes.aRate ?? null}
                  />
                  <StatCard
                    label="B 率"
                    value={latest.bRate}
                    color={GRADE_COLORS.bRate.stroke}
                    change={changes.bRate ?? null}
                  />
                  <StatCard
                    label="C 率"
                    value={latest.cRate}
                    color={GRADE_COLORS.cRate.stroke}
                    change={changes.cRate ?? null}
                  />
                  {latest.entries && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "16px 20px",
                        background: "#FFF",
                        borderRadius: 12,
                        border: "1px solid #E8E4DE",
                        minWidth: 100,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: "#8F7F6E",
                          lineHeight: 1.1,
                        }}
                      >
                        {latest.entries.toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#8B8378",
                          marginTop: 4,
                          fontWeight: 500,
                        }}
                      >
                        考生人数 ({latest.year})
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Grade Toggle */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 16,
                  flexWrap: "wrap",
                }}
              >
                {ALL_GRADES.map((g) => {
                  const active = gradesToShow.includes(g);
                  const colors = GRADE_COLORS[g];
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGrade(g)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: `2px solid ${active ? colors.stroke : "#E8E4DE"}`,
                        background: active ? `${colors.stroke}12` : "#FFF",
                        color: active ? colors.stroke : "#C4BDB3",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: active ? colors.stroke : "#E8E4DE",
                          display: "inline-block",
                        }}
                      />
                      {GRADE_LABELS[g]}
                    </button>
                  );
                })}
              </div>

              {/* Chart */}
              <div
                style={{
                  background: "#FFF",
                  borderRadius: 14,
                  border: "1px solid #E8E4DE",
                  padding: 20,
                }}
              >
                <ResponsiveContainer width="100%" height={420}>
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                  >
                    <defs>
                      {gradesToShow.map((g) => (
                        <linearGradient key={g} id={`grad-${g}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GRADE_COLORS[g].fill} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={GRADE_COLORS[g].fill} stopOpacity={0.02} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#8B8378" }}
                      axisLine={{ stroke: "#E8E4DE" }}
                      tickLine={false}
                      angle={-35}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "#A8A095" }}
                      axisLine={{ stroke: "#E8E4DE" }}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      width={45}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    {gradesToShow.map((g) => (
                      <Area
                        key={g}
                        type="monotone"
                        dataKey={g}
                        stroke={GRADE_COLORS[g].stroke}
                        fill={`url(#grad-${g})`}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: GRADE_COLORS[g].fill, stroke: "#FFF", strokeWidth: 2 }}
                        activeDot={{ r: 5, strokeWidth: 2, fill: "#FFF" }}
                        name={g}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Data table */}
              <div
                style={{
                  marginTop: 24,
                  background: "#FFF",
                  borderRadius: 14,
                  border: "1px solid #E8E4DE",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#FAF8F5",
                    borderBottom: "1px solid #E8E4DE",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#3D3832",
                  }}
                >
                  详细数据
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#FAF8F5" }}>
                        <th style={{ padding: "10px 12px", textAlign: "left", color: "#8B8378", fontWeight: 600, borderBottom: "1px solid #E8E4DE" }}>考季</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", color: GRADE_COLORS.aStarRate.stroke, fontWeight: 700, borderBottom: "1px solid #E8E4DE" }}>A*</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", color: GRADE_COLORS.aRate.stroke, fontWeight: 700, borderBottom: "1px solid #E8E4DE" }}>A</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", color: GRADE_COLORS.bRate.stroke, fontWeight: 700, borderBottom: "1px solid #E8E4DE" }}>B</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", color: GRADE_COLORS.cRate.stroke, fontWeight: 700, borderBottom: "1px solid #E8E4DE" }}>C</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", color: GRADE_COLORS.dRate.stroke, fontWeight: 700, borderBottom: "1px solid #E8E4DE" }}>D</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", color: GRADE_COLORS.eRate.stroke, fontWeight: 700, borderBottom: "1px solid #E8E4DE" }}>E</th>
                        {latest?.entries !== undefined && (
                          <th style={{ padding: "10px 12px", textAlign: "right", color: "#8B8378", fontWeight: 600, borderBottom: "1px solid #E8E4DE" }}>考生</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {[...currentStats.years]
                        .sort((a, b) => {
                          if (a.year !== b.year) return b.year - a.year;
                          const order = { november: 2, june: 1, summer: 1, march: 0 };
                          return (order[a.series] || 0) - (order[b.series] || 0);
                        })
                        .map((y, i) => (
                          <tr
                            key={`${y.year}-${y.series}`}
                            style={{
                              background: i % 2 === 0 ? "#FFF" : "#FAFAF8",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F2EE"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "#FFF" : "#FAFAF8"; }}
                          >
                            <td style={{ padding: "8px 12px", fontWeight: 600, color: "#3D3832", borderBottom: "1px solid #F0EDE8" }}>
                              {formatXAxisLabel(y.year, y.series)}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center", color: GRADE_COLORS.aStarRate.stroke, fontWeight: 700, borderBottom: "1px solid #F0EDE8" }}>
                              {y.aStarRate}%
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center", color: GRADE_COLORS.aRate.stroke, fontWeight: 600, borderBottom: "1px solid #F0EDE8" }}>
                              {y.aRate}%
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center", color: GRADE_COLORS.bRate.stroke, fontWeight: 600, borderBottom: "1px solid #F0EDE8" }}>
                              {y.bRate}%
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center", color: GRADE_COLORS.cRate.stroke, fontWeight: 600, borderBottom: "1px solid #F0EDE8" }}>
                              {y.cRate}%
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center", color: GRADE_COLORS.dRate.stroke, fontWeight: 600, borderBottom: "1px solid #F0EDE8" }}>
                              {y.dRate}%
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "center", color: GRADE_COLORS.eRate.stroke, fontWeight: 600, borderBottom: "1px solid #F0EDE8" }}>
                              {y.eRate}%
                            </td>
                            {y.entries !== undefined && (
                              <td style={{ padding: "8px 12px", textAlign: "right", color: "#8B8378", fontWeight: 500, borderBottom: "1px solid #F0EDE8" }}>
                                {y.entries.toLocaleString()}
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Source note */}
              <p
                style={{
                  fontSize: 11,
                  color: "#C4BDB3",
                  margin: "16px 0 0",
                  fontStyle: "italic",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={12} />
                数据来源：
                {selectedBoard === "CAIE"
                  ? "Cambridge International Education official results statistics (world totals)"
                  : "JCQ Joint Council for Qualifications (UK national aggregates, combining Edexcel + AQA + OCR)"}
              </p>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #D9D4CE",
  background: "#FFF",
  fontSize: 13,
  color: "#3D3832",
  cursor: "pointer",
  outline: "none",
};
