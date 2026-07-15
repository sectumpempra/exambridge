import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getSubjectCategory, CATEGORY_NAMES, type SubjectCategory } from "../data/examDates";

interface GradeField { key: string; label: string; color: string; }

interface GradeChartProps {
  data: Record<string, string | number>[];
  codeField: string;
  sessionField: string;
  yearField: string;
  maxMarkField: string;
  gradeFields: GradeField[];
  titlePrefix: string;
  isCaie?: boolean;
  componentField?: string;
  initialCode?: string;
  lockedCode?: boolean;
  compact?: boolean;
}

function getSessionSortKey(session: string): number {
  const s = session.toLowerCase().trim();

  // CAIE GCSE format: "s-2024", "m-2025", "w-2025"
  const caieMatch = s.match(/^(s|w|m)-(\d{4})$/);
  if (caieMatch) {
    const seasonOrder: Record<string, number> = { m: 0, s: 1, w: 2 };
    return parseInt(caieMatch[2]) * 10 + (seasonOrder[caieMatch[1]] ?? 5);
  }

  // Abbreviated month + year: "jan 2014", "jun 2025", "oct 2018"
  const abbrMatch = s.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})$/);
  if (abbrMatch) {
    const monthNames: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
    return parseInt(abbrMatch[2]) * 100 + (monthNames[abbrMatch[1]] || 0);
  }

  // Full month name + year (dash): "june-2024", "november-2025", "march-2025"
  const caieAlMatch = s.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{4})$/);
  if (caieAlMatch) {
    const monthNames: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
    return parseInt(caieAlMatch[2]) * 100 + (monthNames[caieAlMatch[1]] || 0);
  }

  // Full month name + year (space): "june 2023", "january 2026"
  const combinedMatch = s.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$/i);
  if (combinedMatch) {
    const monthNames: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
    return parseInt(combinedMatch[2]) * 100 + (monthNames[combinedMatch[1].toLowerCase()] || 0);
  }

  // Fallback: extract year
  const yearMatch = s.match(/(\d{4})/);
  return yearMatch ? parseInt(yearMatch[1]) * 100 : 999999;
}

/** Format session label for short display: "june-2021" → "Jun 21", "november-2025" → "Nov 25" */
function formatSessionLabel(session: string): string {
  const s = session.toLowerCase().trim();
  
  // "june-2021" format
  const dashMatch = s.match(/^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|s|w|m)[-_,\s]+(\d{4})$/);
  if (dashMatch) {
    const monthAbbrev: Record<string, string> = {
      january: 'Jan', jan: 'Jan', february: 'Feb', feb: 'Feb', march: 'Mar', mar: 'Mar',
      april: 'Apr', apr: 'Apr', may: 'May', june: 'Jun', jun: 'Jun',
      july: 'Jul', jul: 'Jul', august: 'Aug', aug: 'Aug',
      september: 'Sep', sep: 'Sep', sept: 'Sep', october: 'Oct', oct: 'Oct',
      november: 'Nov', nov: 'Nov', december: 'Dec', dec: 'Dec',
      s: 'Jun', w: 'Nov', m: 'Mar',
    };
    const month = monthAbbrev[dashMatch[1]] || dashMatch[1];
    const year = dashMatch[2].slice(-2); // last 2 digits
    return `${month} ${year}`;
  }
  
  // "June 2021" format
  const spaceMatch = s.match(/^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})$/i);
  if (spaceMatch) {
    const monthAbbrev: Record<string, string> = {
      january: 'Jan', jan: 'Jan', february: 'Feb', feb: 'Feb', march: 'Mar', mar: 'Mar',
      april: 'Apr', apr: 'Apr', may: 'May', june: 'Jun', jun: 'Jun',
      july: 'Jul', jul: 'Jul', august: 'Aug', aug: 'Aug',
      september: 'Sep', sep: 'Sep', sept: 'Sep', october: 'Oct', oct: 'Oct',
      november: 'Nov', nov: 'Nov', december: 'Dec', dec: 'Dec',
    };
    const month = monthAbbrev[spaceMatch[1].toLowerCase()] || spaceMatch[1];
    const year = spaceMatch[2].slice(-2);
    return `${month} ${year}`;
  }
  
  return session;
}

/** Extract unique code options from data, sorted by category */
function getCodeOptions(data: Record<string, string | number>[], codeField: string, nameField?: string): { code: string; name: string; category: SubjectCategory }[] {
  const map: Record<string, string> = {};
  data.forEach(r => {
    const code = String(r[codeField] || "");
    const name = nameField ? String(r[nameField] || "") : "";
    if (code && !map[code]) map[code] = name;
  });
  return Object.entries(map).map(([code, name]) => ({
    code, name, category: getSubjectCategory(code),
  })).sort((a, b) => {
    // Priority: Math > Further Math > Physics > Economics > Biology > Chemistry > CS > Other
    const getCatPriority = (cat: string): number => {
      const order: Record<string, number> = { math: 1, physics: 3, economics: 4, biology: 5, chemistry: 6, cs: 7, other: 99 };
      return order[cat] ?? 99;
    };
    // Within math group: Pure Mathematics before Further Mathematics
    if (a.category === "math" && b.category === "math") {
      const aIsFurther = a.name.toLowerCase().includes("further") || a.code.toLowerCase().startsWith("fm") || a.code === "9231";
      const bIsFurther = b.name.toLowerCase().includes("further") || b.code.toLowerCase().startsWith("fm") || b.code === "9231";
      if (aIsFurther !== bIsFurther) return aIsFurther ? 1 : -1;
    }
    const oa = getCatPriority(a.category);
    const ob = getCatPriority(b.category);
    if (oa !== ob) return oa - ob;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });
}

/** Extract unique component options for a given code */
function getComponentOptions(
  data: Record<string, string | number>[],
  codeField: string,
  selectedCode: string,
  componentField: string
): string[] {
  if (!selectedCode || !componentField) return [];
  const comps = new Set<string>();
  data.forEach(r => {
    if (String(r[codeField]).toLowerCase() === selectedCode.toLowerCase()) {
      const v = String(r[componentField] || "");
      if (v) comps.add(v);
    }
  });
  return Array.from(comps).sort();
}

const SELECT_STYLE: React.CSSProperties = {
  padding: "10px 14px", border: "1px solid #D9D4CE", borderRadius: 10, fontSize: 14,
  backgroundColor: "#FFF", color: "#3D3832", outline: "none", cursor: "pointer",
  transition: "all 0.2s ease",
};
const LABEL_STYLE: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: "#625C54", whiteSpace: "nowrap" };

export default function GradeChart({
  data, codeField, sessionField, yearField, maxMarkField, gradeFields, titlePrefix, isCaie = false, componentField,
  initialCode = "", lockedCode = false, compact = false,
}: GradeChartProps) {
  const [selectedCode, setSelectedCode] = useState(initialCode);
  const [selectedComponent, setSelectedComponent] = useState("");

  // Determine name field for display
  const nameField = useMemo(() => {
    if (data.length === 0) return undefined;
    const sample = data[0];
    if ('subject' in sample) return 'subject';
    if ('Subject' in sample) return 'Subject';
    if ('unit' in sample) return 'unit';
    if ('Unit' in sample) return 'Unit';
    return undefined;
  }, [data]);

  const codeOptions = useMemo(() => getCodeOptions(data, codeField, nameField), [data, codeField, nameField]);
  const componentOptions = useMemo(() => {
    if (!componentField) return [];
    return getComponentOptions(data, codeField, selectedCode, componentField);
  }, [data, codeField, selectedCode, componentField]);

  // Check if component filtering is needed (multiple options for same code)
  const showComponentFilter = useMemo(() => {
    if (!componentField) return false;
    // Check if any code has more than 1 component option
    const codes = new Set<string>();
    data.forEach(r => codes.add(String(r[codeField] || "")));
    for (const code of codes) {
      const comps = new Set<string>();
      data.filter(r => String(r[codeField]) === code).forEach(r => comps.add(String(r[componentField] || "")));
      if (comps.size > 1) return true;
    }
    return false;
  }, [data, codeField, componentField]);

  const chartData = useMemo(() => {
    if (!selectedCode) return [];
    let filtered = data.filter(r => String(r[codeField]).toLowerCase() === selectedCode.toLowerCase());
    if (selectedComponent && componentField) {
      filtered = filtered.filter(r => String(r[componentField]).toLowerCase() === selectedComponent.toLowerCase());
    }
    if (filtered.length === 0) return [];

    // Build session label: if sessionField === yearField (CAIE style), use session only
    // Otherwise combine session + year (Edexcel/AQA style)
    const sameField = sessionField === yearField;

    // Deduplicate by session label: for same session+year, keep the record with more non-zero values
    const entryMap = new Map<string, { row: Record<string, string | number>; score: number }>();
    filtered.forEach(row => {
      const sessionLabel = sameField || isCaie
        ? String(row[sessionField])
        : `${String(row[sessionField])} ${String(row[yearField])}`;

      // Count non-zero grade values as a quality score
      let score = 0;
      gradeFields.forEach(gf => { const v = Number(row[gf.key]) || 0; if (v > 0) score++; });
      if (Number(row[maxMarkField]) > 0) score++;

      if (!entryMap.has(sessionLabel)) {
        entryMap.set(sessionLabel, { row, score });
      } else if (score > entryMap.get(sessionLabel)!.score) {
        // Replace with record that has more non-zero values
        entryMap.set(sessionLabel, { row, score });
      }
    });

    // Convert map entries to chart data
    const entryMap2 = new Map<string, Record<string, string | number>>();
    entryMap.forEach(({ row }, sessionLabel) => {
      const sortKeyInput = sameField || isCaie
        ? String(row[sessionField])
        : `${String(row[sessionField])} ${String(row[yearField])}`;
      const sortKey = getSessionSortKey(sortKeyInput);
      const shortLabel = formatSessionLabel(sessionLabel);
      const entry: Record<string, string | number> = { session: shortLabel, _sortKey: sortKey, [maxMarkField]: Number(row[maxMarkField]) };
      gradeFields.forEach(gf => { entry[gf.key] = Number(row[gf.key]) || 0; });
      entryMap2.set(sessionLabel, entry);
    });

    const entries = Array.from(entryMap2.values());
    entries.sort((a, b) => (a._sortKey as number) - (b._sortKey as number));
    return entries.map((e) => { const { _sortKey: _sk, ...rest } = e; void _sk; return rest; });
  }, [selectedCode, selectedComponent, data, codeField, sessionField, yearField, maxMarkField, gradeFields, isCaie, componentField]);

  const selectedName = codeOptions.find(o => o.code === selectedCode)?.name || "";
  const titleCode = selectedComponent ? `${selectedCode} (${selectedComponent})` : selectedCode;
  const displayLabel = isCaie ? "试卷编号：" : "单元名称：";

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: "0.2s", opacity: 0 }}>
      {!compact && <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #D9D4CE, transparent)", marginBottom: 28 }} />}

      <h3 style={{ fontSize: 20, fontWeight: 600, color: "#3D3832", margin: 0, letterSpacing: "0.02em" }}>
        {selectedCode ? (
          <><span style={{ color: "#675A4D" }}>{titlePrefix}</span>{" — "}{titleCode}{selectedName ? ` (${selectedName})` : ""}</>
        ) : (
          <><span style={{ color: "#675A4D" }}>{titlePrefix}</span>{" — 选择科目查看趋势图"}</>
        )}
      </h3>

      <div style={{ display: "flex", gap: 20, marginTop: 20, flexWrap: "wrap", alignItems: "center" }}>
        {!lockedCode ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={LABEL_STYLE}>科目代码：</label>
          <select aria-label="科目代码" value={selectedCode} onChange={e => { setSelectedCode(e.target.value); setSelectedComponent(""); }}
            style={{ ...SELECT_STYLE, minWidth: 240 }}
            onFocus={e => { e.target.style.borderColor = "#A69888"; }}
            onBlur={e => { e.target.style.borderColor = "#D9D4CE"; }}>
            <option value="">请选择...</option>
            {(() => {
              const groups: Record<string, typeof codeOptions> = {};
              codeOptions.forEach(o => {
                if (!groups[o.category]) groups[o.category] = [];
                groups[o.category].push(o);
              });
              const catOrder: SubjectCategory[] = ["math", "physics", "chemistry", "economics", "biology", "cs", "other"];
              return catOrder.filter(c => groups[c]).map(cat => (
                <optgroup key={cat} label={CATEGORY_NAMES[cat]}>
                  {groups[cat].map(o => (
                    <option key={o.code} value={o.code}>{o.code}{o.name ? ` — ${o.name.split(" Paper")[0].substring(0, 40)}` : ""}</option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
        </div> : <span className="rounded-lg bg-[#e9eef0] px-3 py-2 font-mono text-sm font-bold text-[#3d5661]">资格代码 {selectedCode}</span>}

        {showComponentFilter && componentField && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={LABEL_STYLE}>{displayLabel}</label>
            <select aria-label={displayLabel} value={selectedComponent} onChange={e => setSelectedComponent(e.target.value)}
              style={{ ...SELECT_STYLE, minWidth: 180 }}
              onFocus={e => { e.target.style.borderColor = "#A69888"; }}
              onBlur={e => { e.target.style.borderColor = "#D9D4CE"; }}>
              <option value="">全部</option>
              {componentOptions.map(comp => <option key={comp} value={comp}>{comp}</option>)}
            </select>
          </div>
        )}

        {selectedCode && chartData.length > 0 && (
          <span style={{ fontSize: 13, color: "#6E675E" }}>{chartData.length} 个数据点</span>
        )}
      </div>

      {selectedCode && chartData.length === 0 && (
        <div style={{ marginTop: 24, padding: 24, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)", textAlign: "center" }}>
          <p style={{ color: "#DC2626", fontSize: 14, margin: 0 }}>
            未找到「{selectedCode}」{selectedComponent ? ` ${displayLabel.replace("：", "")}「${selectedComponent}」` : ""}的数据
          </p>
        </div>
      )}

      {chartData.length > 0 && (
        <div style={{ marginTop: compact ? 16 : 24, background: "#FFFFFF", borderRadius: 16, padding: compact ? 12 : 24, border: "1px solid #E8E4DE", boxShadow: "0 2px 16px rgba(61,56,50,0.06)" }}>
          <ResponsiveContainer width="100%" height={compact ? 300 : 420}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(166,152,136,0.15)" />
              <XAxis dataKey="session" tick={{ fontSize: 11, fill: "#6E675E" }} angle={-45} textAnchor="end" height={70} axisLine={{ stroke: "#E8E4DE" }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "#6E675E" }} label={{ value: "分数", angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "#6E675E" } }} axisLine={{ stroke: "#E8E4DE" }} />
              <Tooltip contentStyle={{ fontSize: 12, backgroundColor: "rgba(255,255,255,0.96)", border: "1px solid #D9D4CE", borderRadius: 10, color: "#3D3832", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#625C54", paddingTop: 16 }} />
              <Line type="monotone" dataKey={maxMarkField} stroke="#716A61" strokeWidth={2} strokeDasharray="6 3" dot={false} name="满分" />
              {gradeFields.map(gf => (
                <Line key={gf.key} type="monotone" dataKey={gf.key} stroke={gf.color} strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 0, fill: gf.color }} activeDot={{ r: 6, stroke: gf.color, strokeWidth: 2, fill: "#FFF" }} name={gf.label} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
