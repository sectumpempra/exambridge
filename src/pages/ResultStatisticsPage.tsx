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

import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import {
  getSubjectStats, getAvailableBoards, getAvailableLevels, getAvailableSubjects,
  isNineToOne,
  RESULT_STATISTICS_SOURCES,
  type SubjectStats,
} from "../data/resultStatistics";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { BarChart3, Info, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useCourseContext } from "../course-context/CourseContextProvider";
import { withCourseContext } from "../course-context/catalog";

// ═══════════════════════════════════════════════════════════
// GRADE CONFIGURATION: supports both A*-E and 9-1 grading
// ═══════════════════════════════════════════════════════════

interface GradeConfig {
  colors: Record<string, { stroke: string; fill: string }>;
  labels: Record<string, string>;
  grades: string[];
}

const CONFIG_A_STAR: GradeConfig = {
  colors: {
    aStarRate: { stroke: "#A9471F", fill: "#A9471F" },   // A* - Burnt orange
    aRate:     { stroke: "#2E7D6F", fill: "#2E7D6F" },   // A - Teal green
    bRate:     { stroke: "#3B6EA5", fill: "#3B6EA5" },   // B - Steel blue
    cRate:     { stroke: "#7B5EA7", fill: "#7B5EA7" },   // C - Purple
    dRate:     { stroke: "#6B5735", fill: "#6B5735" },   // D - Tan
    eRate:     { stroke: "#626262", fill: "#626262" },   // E - Gray
  },
  labels: { aStarRate: "A*", aRate: "A", bRate: "B", cRate: "C", dRate: "D", eRate: "E" },
  grades: ["aStarRate", "aRate", "bRate", "cRate", "dRate", "eRate"],
};

const CONFIG_A_TO_E: GradeConfig = {
  colors: CONFIG_A_STAR.colors,
  labels: CONFIG_A_STAR.labels,
  grades: ["aRate", "bRate", "cRate", "dRate", "eRate"],
};

const CONFIG_9_1: GradeConfig = {
  colors: {
    grade9Rate: { stroke: "#A9471F", fill: "#A9471F" },  // 9 - Burnt orange
    grade8Rate: { stroke: "#2E7D6F", fill: "#2E7D6F" },  // 8 - Teal green
    grade7Rate: { stroke: "#3B6EA5", fill: "#3B6EA5" },  // 7 - Steel blue
    grade6Rate: { stroke: "#7B5EA7", fill: "#7B5EA7" },  // 6 - Purple
    grade5Rate: { stroke: "#6B5735", fill: "#6B5735" },  // 5 - Tan
    grade4Rate: { stroke: "#626262", fill: "#626262" },  // 4 - Gray
    grade3Rate: { stroke: "#B07050", fill: "#B07050" },  // 3 - Brown
    grade2Rate: { stroke: "#6090A0", fill: "#6090A0" },  // 2 - Blue-gray
    grade1Rate: { stroke: "#A0A0A0", fill: "#A0A0A0" },  // 1 - Light gray
  },
  labels: { grade9Rate: "9", grade8Rate: "8", grade7Rate: "7", grade6Rate: "6", grade5Rate: "5", grade4Rate: "4", grade3Rate: "3", grade2Rate: "2", grade1Rate: "1" },
  grades: ["grade9Rate", "grade8Rate", "grade7Rate", "grade6Rate", "grade5Rate", "grade4Rate", "grade3Rate", "grade2Rate", "grade1Rate"],
};

function getGradeConfig(board: string, level: string, subjectCode?: string): GradeConfig {
  if (board === "Edexcel UK" && subjectCode === "8MA0") return CONFIG_A_TO_E;
  return isNineToOne(board, level) ? CONFIG_9_1 : CONFIG_A_STAR;
}

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
    const seriesOrder = { autumn: 0, january: 1, march: 2, june: 3, summer: 3, november: 4 };
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

interface PayloadItem {
  dataKey: string;
  color: string;
  value: number;
}

function CustomTooltip({ active, payload, label, labels }: TooltipProps<number, string> & { labels: Record<string, string> }) {
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
      {(payload as PayloadItem[]).map((entry) => (
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
          <span style={{ fontWeight: 600 }}>{labels[entry.dataKey]}</span>
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

interface LegendPayloadItem {
  value: string;
  color: string;
}

function CustomLegend({ payload, labels }: { payload?: LegendPayloadItem[]; labels: Record<string, string> }) {
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
      {payload.map((entry) => (
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
          {labels[entry.value]} 率
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
          color: "#625C54",
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
            color: change > 0 ? "#2E7D6F" : change < 0 ? "#A9471F" : "#626262",
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

export default function ResultStatisticsPage() {
  const { entry, context } = useCourseContext();
  const [selectedBoard, setSelectedBoard] = useState("CAIE");
  const [selectedLevel, setSelectedLevel] = useState("A-Level");
  const [selectedSubjectCode, setSelectedSubjectCode] = useState("9709");
  const appliedCourse = useRef<string | null>(null);

  useEffect(() => {
    if (!entry || entry.capabilities.statistics.status === "unavailable" || appliedCourse.current === entry.qualificationId) return;
    if (!getSubjectStats(entry.subjectCode, entry.boardName, entry.level)) return;
    appliedCourse.current = entry.qualificationId;
    queueMicrotask(() => {
      setSelectedBoard(entry.boardName);
      setSelectedLevel(entry.level);
      setSelectedSubjectCode(entry.subjectCode);
    });
  }, [entry]);

  // Grade configuration (dynamic: A*-E or 9-1 based on board+level)
  const gradeConfig = useMemo(
    () => getGradeConfig(selectedBoard, selectedLevel, selectedSubjectCode),
    [selectedBoard, selectedLevel, selectedSubjectCode],
  );

  // Track user-toggled grades; gradesToShow is derived synchronously from gradeConfig
  const [toggledGrades, setToggledGrades] = useState<string[]>([]);
  // Reset toggles via derived key in useMemo (avoids setState-in-effect and ref-during-render)
  const validToggledGrades = useMemo(() => {
    const valid = toggledGrades.filter((g) => gradeConfig.grades.includes(g));
    return valid.length > 0 ? valid : [];
  }, [toggledGrades, gradeConfig.grades]);

  const gradesToShow = useMemo(() => {
    return validToggledGrades.length > 0 ? validToggledGrades : gradeConfig.grades.slice(0, 3);
  }, [validToggledGrades, gradeConfig]);

  // Derived options
  const boards = getAvailableBoards();
  const levels = getAvailableLevels(selectedBoard);
  const subjects = getAvailableSubjects(selectedBoard, selectedLevel);
  const sourceUrl = selectedBoard === 'OCR'
    ? 'https://www.ocr.org.uk/administration/results-statistics/results-statistics-archive/'
    : selectedBoard === 'AQA'
      ? RESULT_STATISTICS_SOURCES.AQA
      : selectedBoard === 'CAIE'
        ? (selectedLevel === 'A-Level' ? RESULT_STATISTICS_SOURCES.CAIE.A_LEVEL : RESULT_STATISTICS_SOURCES.CAIE.IGCSE)
        : selectedBoard.startsWith('Edexcel')
          ? RESULT_STATISTICS_SOURCES.Edexcel
          : 'https://www.wjec.co.uk/home/administration/results-grade-boundaries-and-prs/';

  // Current subject
  const currentStats = useMemo(() => {
    return getSubjectStats(selectedSubjectCode, selectedBoard, selectedLevel);
  }, [selectedSubjectCode, selectedBoard, selectedLevel]);

  // Chart data
  const chartData = useMemo(() => {
    if (!currentStats) return [];
    return buildChartData(currentStats, gradesToShow);
  }, [currentStats, gradesToShow]);
  const normalizationIssueCount = useMemo(() => currentStats?.years.reduce(
    (count, year) => count + (year.normalizationIssues?.length ?? 0), 0,
  ) ?? 0, [currentStats]);

  // Latest stats
  const latest = useMemo(() => {
    if (!currentStats || currentStats.years.length === 0) return null;
    return [...currentStats.years].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const order: Record<string, number> = { november: 4, june: 3, summer: 3, march: 2, january: 1, autumn: 0 };
      return (order[a.series] ?? 0) - (order[b.series] ?? 0);
    })[0];
  }, [currentStats]);

  // Year-over-year change
  const changes = useMemo(() => {
    if (!currentStats || currentStats.years.length < 2) return {} as Record<string, number | null>;
    const sorted = [...currentStats.years].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      const order: Record<string, number> = { november: 4, june: 3, summer: 3, march: 2, january: 1, autumn: 0 };
      return (order[a.series] ?? 0) - (order[b.series] ?? 0);
    });
    const now = sorted[0];
    const prev = sorted.find((y) => y.year < now.year && y.series === now.series)
      || sorted.find((y) => y.year < now.year);
    if (!prev) return {} as Record<string, number | null>;
    const result: Record<string, number | null> = {};
    gradeConfig.grades.forEach((g) => {
      result[g] = ((now as unknown) as Record<string, number>)[g] - ((prev as unknown) as Record<string, number>)[g];
    });
    return result;
  }, [currentStats, gradeConfig]);

  const toggleGrade = (grade: string) => {
    setToggledGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F0EDE8" }}>
      <Header title="" />

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
                  background: "linear-gradient(135deg, #675A4D, #A69888)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BarChart3 size={22} style={{ color: "#FFF" }} />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#3D3832", margin: 0 }}>
                  历年 {gradeConfig.labels[gradeConfig.grades[0]]}率 / {gradeConfig.labels[gradeConfig.grades[1]]}率 趋势
                </h1>
                <p style={{ fontSize: 12, color: "#6E675E", margin: "2px 0 0" }}>
                  各考试局、各科目历年成绩统计 · 数据驱动备考决策
                </p>
              </div>
            </div>
            {entry?.capabilities.boundaries.href && <Link to={withCourseContext(entry.capabilities.boundaries.href, context)} className="inline-flex rounded-lg border border-[#d9d4ce] bg-white px-3 py-2 text-xs font-semibold text-[#675a4d] no-underline">查看对应分数线 →</Link>}
          </div>

              {/* Controls - always visible */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 20,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <select aria-label="考试局"
                  value={selectedBoard}
                  onChange={(e) => {
                    const newBoard = e.target.value;
                    setSelectedBoard(newBoard);
                    const newLevels = getAvailableLevels(newBoard);
                    if (newLevels.length > 0) {
                      setSelectedLevel(newLevels[0]);
                      const newSubjects = getAvailableSubjects(newBoard, newLevels[0]);
                      if (newSubjects.length > 0) setSelectedSubjectCode(newSubjects[0].code);
                    }
                  }}
                  style={selectStyle}
                >
                  {boards.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                <select aria-label="资格等级"
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

                <select aria-label="科目"
                  value={selectedSubjectCode}
                  onChange={(e) => setSelectedSubjectCode(e.target.value)}
                  style={{ ...selectStyle, minWidth: 200 }}
                >
                  {subjects.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>

          {currentStats ? (
            <>
              {normalizationIssueCount > 0 && (
                <div role="status" style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(193,123,95,0.25)", background: "rgba(193,123,95,0.08)", color: "#7c513e", fontSize: 12, lineHeight: 1.6 }}>
                  该历史序列有 {normalizationIssueCount} 项原始累计率异常；图表使用保留审计记录的规范化值，原始值未被覆盖。
                </div>
              )}
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
                  {gradeConfig.grades.slice(0, 4).map((g) => (
                    <StatCard
                      key={g}
                      label={`${gradeConfig.labels[g]} 率`}
                      value={((latest as unknown) as Record<string, number>)[g]}
                      color={gradeConfig.colors[g].stroke}
                      change={changes[g] ?? null}
                    />
                  ))}
                  {latest.entries !== undefined && (
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
                          color: "#675A4D",
                          lineHeight: 1.1,
                        }}
                      >
                        {latest.entries.toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#625C54",
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
                {gradeConfig.grades.map((g) => {
                  const active = gradesToShow.includes(g);
                  const colors = gradeConfig.colors[g];
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
                        color: active ? colors.stroke : "#716A61",
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
                      {gradeConfig.labels[g]}
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
                          <stop offset="5%" stopColor={gradeConfig.colors[g].fill} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={gradeConfig.colors[g].fill} stopOpacity={0.02} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#625C54" }}
                      axisLine={{ stroke: "#E8E4DE" }}
                      tickLine={false}
                      angle={-35}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "#6E675E" }}
                      axisLine={{ stroke: "#E8E4DE" }}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                      width={45}
                    />
                    <Tooltip content={<CustomTooltip labels={gradeConfig.labels} />} />
                    <Legend content={<CustomLegend labels={gradeConfig.labels} />} />
                    {gradesToShow.map((g) => (
                      <Area
                        key={g}
                        type="monotone"
                        dataKey={g}
                        stroke={gradeConfig.colors[g].stroke}
                        fill={`url(#grad-${g})`}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: gradeConfig.colors[g].fill, stroke: "#FFF", strokeWidth: 2 }}
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
                <div tabIndex={0} role="region" aria-label="成绩统计详细数据，可横向滚动" style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#FAF8F5" }}>
                        <th style={{ padding: "10px 12px", textAlign: "left", color: "#625C54", fontWeight: 600, borderBottom: "1px solid #E8E4DE" }}>考季</th>
                        {gradeConfig.grades.slice(0, 6).map((g) => (
                          <th key={g} style={{ padding: "10px 12px", textAlign: "center", color: gradeConfig.colors[g].stroke, fontWeight: 700, borderBottom: "1px solid #E8E4DE" }}>
                            {gradeConfig.labels[g]}
                          </th>
                        ))}
                        {currentStats.years.some(y => y.entries !== undefined) && (
                          <th style={{ padding: "10px 12px", textAlign: "right", color: "#625C54", fontWeight: 600, borderBottom: "1px solid #E8E4DE" }}>考生</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {[...currentStats.years]
                        .sort((a, b) => {
                          if (a.year !== b.year) return b.year - a.year;
                          const order: Record<string, number> = { november: 4, june: 3, summer: 3, march: 2, january: 1, autumn: 0 };
                          return (order[a.series] ?? 0) - (order[b.series] ?? 0);
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
                            {gradeConfig.grades.slice(0, 6).map((g, gi) => {
                              const rate = (y as unknown as Record<string, number>)[g] ?? 0;
                              return (
                                <td key={g} style={{ padding: "8px 12px", textAlign: "center", color: gradeConfig.colors[g].stroke, fontWeight: gi === 0 ? 700 : 600, borderBottom: "1px solid #F0EDE8" }}>
                                  {rate.toFixed(1)}%
                                </td>
                              );
                            })}
                            {currentStats.years.some(yy => yy.entries !== undefined) && (
                              <td style={{ padding: "8px 12px", textAlign: "right", color: "#625C54", fontWeight: 500, borderBottom: "1px solid #F0EDE8" }}>
                                {y.entries !== undefined ? y.entries.toLocaleString() : "—"}
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
                  color: "#716A61",
                  margin: "16px 0 0",
                  fontStyle: "italic",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={12} />
                数据来源：
                <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#76695D", textDecoration: "underline", textUnderlineOffset: 2 }}>
                {selectedBoard === "CAIE" && selectedLevel === "A-Level"
                  ? "Cambridge International Education official results statistics (A-Level, world totals)"
                  : selectedBoard === "CAIE" && selectedLevel === "IGCSE"
                  ? "Cambridge International Education official results statistics (IGCSE A*-G, world totals)"
                  : selectedBoard === "Edexcel" && selectedLevel === "IGCSE"
                  ? "Pearson Edexcel official results statistics (9-1, International GCSE)"
                  : selectedBoard === "Edexcel"
                  ? "Pearson Edexcel official results statistics (IAL/International A-Level)"
                  : selectedBoard === "Edexcel UK"
                  ? "Pearson Edexcel UK official results statistics"
                  : selectedBoard === "AQA"
                  ? "AQA official results statistics (aqa.org.uk)"
                  : selectedBoard === "OCR"
                  ? "OCR official results statistics（2021–2025 已逐行核验）"
                  : "WJEC/Eduqas official results statistics"}
                </a>
              </p>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6E675E" }}>
              <p style={{ fontSize: 14 }}>该科目暂无数据</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>请尝试切换其他科目</p>
            </div>
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
