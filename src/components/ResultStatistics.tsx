/**
 * Result Statistics Visualizer
 * Displays historical A-Star / A / B / C / D / E grade rate trends for A-Level subjects
 * 
 * Features:
 * - Area chart showing cumulative grade percentages over years
 * - Toggle between grade levels (A-Star, A, B, C, D, E)
 * - Subject selector with search
 * - Board/level filter
 * - June/November series toggle (CAIE)
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
import { BarChart3, Info } from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  aStarRate: "#8F7F6E",  // Morandi brown-gold
  aRate: "#94A8B8",      // Morandi blue
  bRate: "#9AAF9E",      // Morandi sage
  cRate: "#BFA8A0",      // Morandi rose
  dRate: "#B8A68A",      // Morandi gold
  eRate: "#A8A0B0",      // Morandi mauve
};

const GRADE_LABELS: Record<string, string> = {
  aStarRate: "A*",
  aRate: "A",
  bRate: "B",
  cRate: "C",
  dRate: "D",
  eRate: "E",
};

interface ChartDataPoint {
  year: string;
  yearNum: number;
  [key: string]: string | number;
}

/** Build chart data from subject stats, filtering by series */
function buildChartData(
  stats: SubjectStats,
  seriesFilter: "all" | "june" | "november",
  gradesToShow: string[]
): ChartDataPoint[] {
  // Filter by series
  let filtered = stats.years;
  if (seriesFilter !== "all") {
    filtered = filtered.filter((y) => y.series === seriesFilter);
  }

  // Sort by year ascending (chronological order for chart)
  filtered = [...filtered].sort((a, b) => a.year - b.year);

  return filtered.map((y) => {
    const pt: ChartDataPoint = {
      year: `${y.year} ${y.series === "november" ? "Nov" : y.series === "march" ? "Mar" : ""}`.trim(),
      yearNum: y.year,
    };
    gradesToShow.forEach((g) => {
      pt[g] = ((y as unknown) as Record<string, number>)[g] ?? 0;
    });
    return pt;
  });
}

interface ResultStatisticsProps {
  initialBoard?: string;
  initialLevel?: string;
  initialSubjectCode?: string;
}

export default function ResultStatistics({
  initialBoard = "CAIE",
  initialLevel = "A-Level",
  initialSubjectCode,
}: ResultStatisticsProps) {
  // State
  const [selectedBoard, setSelectedBoard] = useState(initialBoard);
  const [selectedLevel, setSelectedLevel] = useState(initialLevel);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>(
    initialSubjectCode || "9709"
  );
  const [seriesFilter, setSeriesFilter] = useState<"all" | "june" | "november">("all");
  const [gradesToShow, setGradesToShow] = useState<string[]>([
    "aStarRate", "aRate", "bRate", "cRate",
  ]);

  // Get available options
  const boards = getAvailableBoards();
  const levels = getAvailableLevels(selectedBoard);
  const subjects = getAvailableSubjects(selectedBoard, selectedLevel);

  // Get current subject stats
  const currentStats = useMemo(() => {
    return ALL_SUBJECT_STATS.find(
      (s) => s.code === selectedSubjectCode && s.board === selectedBoard
    );
  }, [selectedSubjectCode, selectedBoard]);

  // Build chart data
  const chartData = useMemo(() => {
    if (!currentStats) return [];
    return buildChartData(currentStats, seriesFilter, gradesToShow);
  }, [currentStats, seriesFilter, gradesToShow]);

  // Latest stats for summary cards
  const latestStats = useMemo(() => {
    if (!currentStats || currentStats.years.length === 0) return null;
    const sorted = [...currentStats.years].sort((a, b) => b.year - a.year);
    return sorted[0];
  }, [currentStats]);

  // Compute year-over-year change for A*
  const aStarChange = useMemo(() => {
    if (!currentStats || currentStats.years.length < 2) return null;
    const sorted = [...currentStats.years].sort((a, b) => b.year - a.year);
    const latest = sorted[0];
    const previous = sorted[1];
    if (latest.year === previous.year) {
      // Same year different series
      const prevSameYear = sorted.find((y) => y.year === latest.year && y.series !== latest.series);
      if (prevSameYear) {
        return latest.aStarRate - prevSameYear.aStarRate;
      }
      return null;
    }
    return latest.aStarRate - previous.aStarRate;
  }, [currentStats]);

  const toggleGrade = (grade: string) => {
    setGradesToShow((prev) =>
      prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade]
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: "#FFF",
          border: "1px solid #E8E4DE",
          borderRadius: 10,
          padding: "12px 16px",
          boxShadow: "0 4px 16px rgba(61,56,50,0.1)",
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
              }}
            />
            <span style={{ fontWeight: 600 }}>{GRADE_LABELS[entry.dataKey]}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>
              {entry.value?.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (!currentStats) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center", color: "#A8A095" }}>
        <Info size={32} style={{ marginBottom: 12 }} />
        <p>暂无该科目的历年成绩统计数据</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 0" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, #8F7F6E, #A69888)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BarChart3 size={20} style={{ color: "#FFF" }} />
        </div>
        <div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#3D3832",
              margin: 0,
            }}
          >
            历年 A*率 / A率趋势
          </h3>
          <p style={{ fontSize: 12, color: "#A8A095", margin: "2px 0 0" }}>
            {currentStats.board} · {currentStats.name} · {currentStats.level}
          </p>
        </div>

        {/* Quick stats */}
        {latestStats && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: GRADE_COLORS.aStarRate,
                  lineHeight: 1,
                }}
              >
                {latestStats.aStarRate}%
              </div>
              <div style={{ fontSize: 10, color: "#A8A095", marginTop: 2 }}>
                A* 率 ({latestStats.year})
              </div>
            </div>
            {aStarChange !== null && (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: aStarChange && aStarChange >= 0 ? "#6B8F5E" : "#C17B5F",
                    lineHeight: 1,
                  }}
                >
                  {aStarChange && aStarChange > 0 ? "+" : ""}
                  {aStarChange?.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: "#A8A095", marginTop: 2 }}>
                  较上年
                </div>
              </div>
            )}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: GRADE_COLORS.aRate,
                  lineHeight: 1,
                }}
              >
                {latestStats.aRate}%
              </div>
              <div style={{ fontSize: 10, color: "#A8A095", marginTop: 2 }}>
                A 率 ({latestStats.year})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Board selector */}
        <select
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
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #D9D4CE",
            background: "#FFF",
            fontSize: 13,
            color: "#3D3832",
            cursor: "pointer",
          }}
        >
          {boards.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Level selector */}
        <select
          value={selectedLevel}
          onChange={(e) => {
            setSelectedLevel(e.target.value);
            const newSubjects = getAvailableSubjects(selectedBoard, e.target.value);
            if (newSubjects.length > 0) setSelectedSubjectCode(newSubjects[0].code);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #D9D4CE",
            background: "#FFF",
            fontSize: 13,
            color: "#3D3832",
            cursor: "pointer",
          }}
        >
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        {/* Subject selector */}
        <select
          value={selectedSubjectCode}
          onChange={(e) => setSelectedSubjectCode(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #D9D4CE",
            background: "#FFF",
            fontSize: 13,
            color: "#3D3832",
            cursor: "pointer",
            minWidth: 180,
          }}
        >
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Series filter (only for CAIE) */}
        {selectedBoard === "CAIE" && (
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "june", "november"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSeriesFilter(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #D9D4CE",
                  background: seriesFilter === s ? "#8F7F6E" : "#FFF",
                  color: seriesFilter === s ? "#FFF" : "#8B8378",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {s === "all" ? "全部" : s === "june" ? "June" : "Nov"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grade toggle buttons */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {Object.entries(GRADE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggleGrade(key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 20,
              border: `1.5px solid ${gradesToShow.includes(key) ? GRADE_COLORS[key] : "#E8E4DE"}`,
              background: gradesToShow.includes(key) ? `${GRADE_COLORS[key]}15` : "#FFF",
              color: gradesToShow.includes(key) ? GRADE_COLORS[key] : "#C4BDB3",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: gradesToShow.includes(key) ? GRADE_COLORS[key] : "#E8E4DE",
                display: "inline-block",
              }}
            />
            {label} 率
          </button>
        ))}
      </div>

      {/* Chart */}
      <div
        style={{
          background: "#FFF",
          borderRadius: 12,
          border: "1px solid #E8E4DE",
          padding: 16,
        }}
      >
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              {gradesToShow.map((g) => (
                <linearGradient key={g} id={`grad-${g}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GRADE_COLORS[g]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GRADE_COLORS[g]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: "#A8A095" }}
              axisLine={{ stroke: "#E8E4DE" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#A8A095" }}
              axisLine={{ stroke: "#E8E4DE" }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: "% achieving (cumulative)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#A8A095" },
                offset: 10,
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value: string) => (
                <span style={{ color: "#8B8378", fontSize: 12, fontWeight: 500 }}>
                  {GRADE_LABELS[value]} 率
                </span>
              )}
            />
            {gradesToShow.map((g) => (
              <Area
                key={g}
                type="monotone"
                dataKey={g}
                stroke={GRADE_COLORS[g]}
                fill={`url(#grad-${g})`}
                strokeWidth={2.5}
                dot={{ r: 4, fill: GRADE_COLORS[g], stroke: "#FFF", strokeWidth: 2 }}
                activeDot={{ r: 6, stroke: GRADE_COLORS[g], strokeWidth: 2, fill: "#FFF" }}
                name={g}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Data source note */}
      <p
        style={{
          fontSize: 11,
          color: "#C4BDB3",
          margin: "12px 0 0",
          fontStyle: "italic",
        }}
      >
        数据来源：{currentStats.board === "CAIE"
          ? "Cambridge International Education official results statistics"
          : currentStats.board === "AQA"
          ? "AQA official results statistics (aqa.org.uk)"
          : currentStats.board === "OCR"
          ? "OCR official results statistics (ocr.org.uk)"
          : "Official exam board results statistics"}
        {latestStats?.entries ? ` · ${latestStats.entries.toLocaleString()} entries (${latestStats.year})` : ""}
      </p>
    </div>
  );
}
