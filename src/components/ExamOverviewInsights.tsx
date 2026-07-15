import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, LineChart as LineChartIcon, TriangleAlert } from "lucide-react";
import GradeChart from "./GradeChart";
import { withCourseContext } from "@/course-context/catalog";
import type { CourseContext, CourseContextEntry } from "@/course-context/types";
import { useStaticBoundaryData } from "@/hooks/useStaticBoundaryData";
import {
  OFFICIAL_STATISTICS_UNAVAILABLE_MESSAGE,
  SPECIAL_OVERVIEW_BOUNDARIES,
  SPECIAL_OVERVIEW_TOP_GRADES,
} from "@/data/examOverviewInsightsData";

type Row = Record<string, string | number>;
type GradeField = { key: string; label: string; color: string };
type BoundaryConfig = {
  data: Row[];
  codeField: string;
  sessionField: string;
  yearField: string;
  maxMarkField: string;
  gradeFields: GradeField[];
  componentField?: string;
  isCaie?: boolean;
};

const A_TO_E: GradeField[] = [
  { key: "A", label: "A", color: "#526B7E" }, { key: "B", label: "B", color: "#506D58" },
  { key: "C", label: "C", color: "#6E5C40" }, { key: "D", label: "D", color: "#775E55" },
  { key: "E", label: "E", color: "#655A70" },
];
const LOWER_A_TO_G: GradeField[] = [
  { key: "a", label: "A", color: "#526B7E" }, { key: "b", label: "B", color: "#506D58" },
  { key: "c", label: "C", color: "#6E5C40" }, { key: "d", label: "D", color: "#775E55" },
  { key: "e", label: "E", color: "#655A70" }, { key: "f", label: "F", color: "#B5A88A" },
  { key: "g", label: "G", color: "#A0A8A0" },
];
const A_STAR: GradeField[] = [
  { key: "a*", label: "A*", color: "#A9471F" }, { key: "a", label: "A", color: "#2E7D6F" },
  { key: "b", label: "B", color: "#3B6EA5" }, { key: "c", label: "C", color: "#7B5EA7" },
  { key: "d", label: "D", color: "#6B5735" }, { key: "e", label: "E", color: "#626262" },
];
const AQA_A_STAR: GradeField[] = A_STAR.map((grade) => ({ ...grade, key: grade.key === "a*" ? "a_star" : grade.key }));
const NINE_TO_ONE: GradeField[] = [9, 8, 7, 6, 5, 4].map((grade, index) => ({ key: `grade${grade}`, label: String(grade), color: ["#A9471F", "#2E7D6F", "#3B6EA5", "#7B5EA7", "#6B5735", "#626262"][index] }));

const BOUNDARY_CODE_OVERRIDES: Record<string, string> = {
  "pearson-ial-mathematics": "WMA11", "pearson-ial-further-mathematics": "WFM01", "pearson-ial-pure-mathematics": "WMA11",
  "pearson-ial-biology": "WBI11", "pearson-ial-chemistry": "WCH11", "pearson-ial-physics": "WPH11",
  "pearson-ial-economics": "WEC11", "pearson-ial-business": "WBS11", "pearson-ial-accounting": "WAC11",
};

function boundaryConfig(entry: CourseContextEntry, data: Row[]): BoundaryConfig | undefined {
  if (entry.boardName === "CAIE" && entry.level === "A-Level") return { data, codeField: "SubjectCode", sessionField: "Series", yearField: "Series", maxMarkField: "MaxRawMark", gradeFields: A_TO_E, componentField: "Component", isCaie: true };
  if (entry.boardName === "CAIE") return { data, codeField: "subjectCode", sessionField: "series", yearField: "series", maxMarkField: "maxMark", gradeFields: LOWER_A_TO_G, componentField: "component", isCaie: true };
  if (entry.boardName === "AQA" && entry.level === "A-Level") return { data, codeField: "code", sessionField: "session", yearField: "year", maxMarkField: "max_mark", gradeFields: AQA_A_STAR, componentField: "unit" };
  if (entry.boardName === "AQA") return { data, codeField: "code", sessionField: "session", yearField: "year", maxMarkField: "maxMark", gradeFields: NINE_TO_ONE, componentField: "subject" };
  if (entry.boardName.startsWith("Edexcel") && entry.level === "A-Level") return { data, codeField: "code", sessionField: "session", yearField: "year", maxMarkField: "max_mark", gradeFields: A_STAR, componentField: "unit" };
  if (entry.boardName.startsWith("Edexcel")) return { data, codeField: "code", sessionField: "session", yearField: "year", maxMarkField: "maxMark", gradeFields: NINE_TO_ONE };
  if (entry.boardName === "OCR" && entry.level === "A-Level") return { data, codeField: "code", sessionField: "session", yearField: "year", maxMarkField: "max_mark", gradeFields: A_STAR, componentField: "component" };
  if (entry.boardName === "OCR") return { data, codeField: "code", sessionField: "session", yearField: "year", maxMarkField: "maxMark", gradeFields: NINE_TO_ONE, componentField: "component" };
  return undefined;
}

function resolveBoundaryCode(config: BoundaryConfig, requested: string): string | undefined {
  const codes = new Map(config.data.map((row) => [String(row[config.codeField]).toUpperCase(), String(row[config.codeField])]));
  return codes.get(requested.toUpperCase());
}

function seriesLabel(year: number, series: string) {
  const names: Record<string, string> = { january: "Jan", march: "Mar", june: "Jun", summer: "Sum", november: "Nov", autumn: "Aut" };
  return `${year} ${names[series.toLowerCase()] ?? series}`;
}

export default function ExamOverviewInsights({ entry, context, overviewId, overviewCode }: { entry: CourseContextEntry; context: CourseContext | null; overviewId: string; overviewCode: string }) {
  const { data: caieHistory, loading: historyLoading } = useStaticBoundaryData(entry.boardName === "CAIE" && entry.level === "A-Level" ? "/data/caie-al-history-v1.json" : undefined);
  const [boundaryRows, setBoundaryRows] = useState<Row[]>([]);
  const [boundaryLoading, setBoundaryLoading] = useState(true);
  const [statsData, setStatsData] = useState<Array<{ label: string; rate: number }>>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [topGradeLabel, setTopGradeLabel] = useState("A*率");
  const [topGradeSource, setTopGradeSource] = useState<string>();

  useEffect(() => {
    let active = true;
    const load = async () => {
      const special = SPECIAL_OVERVIEW_BOUNDARIES[overviewId];
      if (special) {
        if (active) { setBoundaryRows(special.rows); setBoundaryLoading(false); }
        return;
      }
      let rows: Row[] = [];
      if (entry.boardName === "CAIE" || entry.boardName === "AQA") {
        const merged = await import("@/data/official/mergedMathData");
        if (entry.boardName === "CAIE") rows = (entry.level === "A-Level" ? merged.MERGED_CAIE_A_LEVEL_DATA : merged.MERGED_CAIE_GCSE_DATA) as Row[];
        else rows = (entry.level === "A-Level" ? merged.MERGED_AQA_A_LEVEL_DATA : merged.MERGED_AQA_GCSE_DATA) as Row[];
      } else if (entry.boardName.startsWith("Edexcel")) {
        rows = entry.level === "A-Level" ? (await import("@/data/edexcel_al.json")).default as Row[] : (await import("@/data/edexcel.json")).default as Row[];
      } else if (entry.boardName === "OCR") {
        rows = entry.level === "A-Level" ? (await import("@/data/ocr_al.json")).default as Row[] : (await import("@/data/ocrGradeBoundaries")).OCR_GCSE_BOUNDARIES as Row[];
      }
      if (active) { setBoundaryRows(rows); setBoundaryLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [entry.boardName, entry.level, overviewId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const special = SPECIAL_OVERVIEW_TOP_GRADES[overviewId];
      if (special) {
        const rows = [...special.rows]
          .sort((a, b) => a.year - b.year || a.series.localeCompare(b.series))
          .map((year) => ({ label: seriesLabel(year.year, year.series), rate: year.rate }));
        if (active) {
          setTopGradeLabel(`${special.label}率`);
          setTopGradeSource(special.sourceUrl);
          setStatsData(rows);
          setStatsLoading(false);
        }
        return;
      }
      const statistics = await import("@/data/resultStatistics");
      const subject = statistics.getSubjectStats(entry.subjectCode, entry.boardName, entry.level)
        ?? (entry.boardName === "CAIE" && entry.level === "GCSE" ? statistics.getSubjectStats(entry.subjectCode, entry.boardName, "IGCSE") : undefined);
      const nextNineToOne = statistics.isNineToOne(entry.boardName, entry.level);
      const topGradeKey = nextNineToOne ? "grade9Rate" : "aStarRate";
      const rows = subject ? [...subject.years].sort((a, b) => a.year - b.year || a.series.localeCompare(b.series)).map((year) => ({ label: seriesLabel(year.year, year.series), rate: Number((year as unknown as Record<string, number>)[topGradeKey]) || 0 })).slice(-10) : [];
      if (active) {
        setTopGradeLabel(nextNineToOne ? "9 分率" : "A*率");
        setTopGradeSource(undefined);
        setStatsData(rows);
        setStatsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [entry.boardName, entry.level, entry.subjectCode, overviewId]);

  const allBoundaryRows = useMemo(() => entry.boardName === "CAIE" && entry.level === "A-Level" ? [...caieHistory, ...boundaryRows] : boundaryRows, [boundaryRows, caieHistory, entry.boardName, entry.level]);
  const config = useMemo(() => {
    const special = SPECIAL_OVERVIEW_BOUNDARIES[overviewId];
    return special ? { ...special, data: special.rows } : boundaryConfig(entry, allBoundaryRows);
  }, [entry, allBoundaryRows, overviewId]);
  const requestedBoundaryCode = BOUNDARY_CODE_OVERRIDES[overviewId] ?? overviewCode.split("/")[0].trim();
  const boundaryCode = config ? resolveBoundaryCode(config, requestedBoundaryCode) : undefined;
  const latestRate = statsData.at(-1)?.rate;

  return <section className="mt-8" aria-labelledby="exam-insights-title">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#526b7e]">Historical evidence</span><h2 id="exam-insights-title" className="mb-0 mt-1 text-2xl font-bold">分数线与最高等级趋势</h2></div><span className="text-xs leading-5 text-[#6e675e]">分数线与获得率含义不同，请勿直接互相换算。</span></div>
    <div className="mt-4 grid gap-5 xl:grid-cols-2">
      <article className="min-w-0 rounded-3xl border border-[#d7dfe2] bg-[#f7fafb] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#526b7e]"><LineChartIcon size={16} /> 可视化分数线</span><p className="mb-0 mt-2 text-xs leading-5 text-[#68777c]">展示本站现有官方分数线记录；可按 Paper / Unit 进一步切换。</p></div>{entry.capabilities.boundaries.href && <Link to={withCourseContext(entry.capabilities.boundaries.href, context)} className="shrink-0 text-xs font-semibold text-[#526b7e] no-underline">完整数据 →</Link>}</div>
        {config && boundaryCode ? <GradeChart key={`${overviewId}-${boundaryCode}`} {...config} initialCode={boundaryCode} lockedCode compact titlePrefix="历年分数线" /> : <div className="mt-5 rounded-2xl border border-[#e2d7ca] bg-white px-4 py-8 text-center text-sm text-[#7a6e61]"><TriangleAlert className="mx-auto mb-2" size={20} />{historyLoading || boundaryLoading ? "正在加载已核验历史分数线…" : "该资格的可视化分数线记录正在整理。"}</div>}
      </article>
      <article className="min-w-0 rounded-3xl border border-[#ded5e4] bg-[#faf7fb] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#775e70]"><BarChart3 size={16} /> {topGradeLabel}趋势</span><p className="mb-0 mt-2 text-xs leading-5 text-[#756775]">表示获得该等级或以上的考生占比，不是分数线。</p></div>{topGradeSource ? <a href={topGradeSource} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-[#775e70] no-underline">官方来源 ↗</a> : entry.capabilities.statistics.href && <Link to={withCourseContext(entry.capabilities.statistics.href, context)} className="shrink-0 text-xs font-semibold text-[#775e70] no-underline">完整统计 →</Link>}</div>
        {statsData.length > 0 ? <><div className="mt-5 flex items-end gap-2"><strong className="text-3xl text-[#775e70]">{latestRate?.toFixed(1)}%</strong><span className="pb-1 text-xs text-[#7b727b]">最近已收录考季</span></div><div className="mt-4 rounded-2xl border border-[#e6dee9] bg-white p-3"><ResponsiveContainer width="100%" height={300}><AreaChart data={statsData} margin={{ top: 10, right: 12, left: -12, bottom: 8 }}><defs><linearGradient id={`top-grade-${overviewId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#775e70" stopOpacity={0.32} /><stop offset="95%" stopColor="#775e70" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#eee8ef" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#716873" }} angle={-32} textAnchor="end" height={58} interval="preserveStartEnd" /><YAxis domain={[0, "auto"]} tick={{ fontSize: 10, fill: "#716873" }} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, topGradeLabel]} /><Area type="monotone" dataKey="rate" stroke="#775e70" strokeWidth={2.5} fill={`url(#top-grade-${overviewId})`} /></AreaChart></ResponsiveContainer></div></> : <div className="mt-5 rounded-2xl border border-dashed border-[#d8cbdc] bg-white/75 px-5 py-12 text-center"><BarChart3 className="mx-auto text-[#9a8799]" size={24} /><strong className="mt-3 block text-sm text-[#685968]">{statsLoading ? "正在加载成绩统计…" : OFFICIAL_STATISTICS_UNAVAILABLE_MESSAGE}</strong>{!statsLoading && <p className="mx-auto mb-0 mt-2 max-w-sm text-xs leading-5 text-[#817482]">考试局未提供可核验的最高等级获得率时，本站不会推算或用相近课程代替。</p>}</div>}
      </article>
    </div>
  </section>;
}
