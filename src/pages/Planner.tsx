import { useState, useMemo } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { QRCodeSVG } from "qrcode.react";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  BookOpen, Settings, Share2, Clock, Check, ChevronDown, ChevronUp,
  Copy, CheckCheck, FileSpreadsheet, FileText, FileDown, GraduationCap,
  Filter, User, CalendarDays,
} from "lucide-react";
import plannerData from "../data/plannerData.json";
import { INTENSITY_CONFIG } from "../data/examData";
import type { Intensity } from "../data/examData";
import {
  EXAM_DATES, getSubjectCategory, CATEGORY_NAMES,
  type SubjectCategory,
} from "../data/examDates";
import { usePlanner } from "../hooks/usePlanner";
import type { PlannerConfig } from "../hooks/usePlanner";
import { generateShareUrl } from "../utils/shareCode";
import { groupPapers, type PaperGroup } from "../utils/paperGroups";
import { groupEdexcelALUnits, getUnitName, needsSubjectGrouping } from "../utils/subjectGroups";
import { exportToExcel, exportToWord, exportToPDF } from "../utils/exportPlanner";

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "A-level 分数线", to: "/alevel" },
  { label: "GCSE 分数线", to: "/gcse" },
  { label: "等级预测模拟器", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
];

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** A selected paper group (e.g. "9709 Paper 1") containing all variants */
interface SelectedPaperGroup {
  subjectCode: string;
  paperNum: string;
  paperLabel: string;
  board: string;
  level: string;
  variants: { code: string; component: string }[];
}

/** Generate past papers for a single variant/component */
function generatePastPapersForVariant(subjectCode: string, component: string): string[] {
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const papers: string[] = [];
  for (const year of years) {
    const series = year >= 2023 ? ["s", "m", "w"] : ["s", "w"];
    for (const ser of series) {
      papers.push(`${subjectCode}_${ser}_${year}_${component}`);
    }
  }
  const so: Record<string, number> = { w: 0, s: 1, m: 2 };
  return papers.sort((a, b) => {
    const pa = a.split("_"), pb = b.split("_");
    const yA = parseInt(pa[2]), yB = parseInt(pb[2]);
    if (yB !== yA) return yB - yA;
    return (so[pa[1]] ?? 3) - (so[pb[1]] ?? 3);
  });
}

/** Get the nearest exam date for a paper group */
function getGroupNearestExamDate(level: string, board: string, variants: { code: string }[]): string {
  let earliest = "";
  for (const v of variants) {
    const d = lookupExamDate(level, board, v.code);
    if (!earliest || d < earliest) earliest = d;
  }
  return earliest || "2026-05-01";
}

/** Get exam date from EXAM_DATES */
function lookupExamDate(level: string, board: string, paperCode: string): string {
  const boardKey = board === "Edexcel" && level === "A-Level" ? "Edexcel-IAL"
    : board === "Edexcel" && level === "GCSE" ? "Edexcel-GCSE"
    : `${board}-${level === "A-Level" ? "AL" : "GCSE"}`;
  const dates = EXAM_DATES[boardKey];
  if (!dates) return "2026-10-01";

  // Try direct match first
  if (dates[paperCode]) return dates[paperCode];

  const slashIdx = paperCode.indexOf("/");
  if (slashIdx > 0) {
    const subject = paperCode.substring(0, slashIdx);
    const paper = paperCode.substring(slashIdx + 1);

    // Edexcel AL: "WMA11/Pure Mathematics 1" → lookup "WMA11"
    if (board === "Edexcel" && level === "A-Level") {
      if (dates[subject]) return dates[subject];
    }
    // AQA AL: "MA01/MATHS UNIT 1" → lookup "MA01"
    else if (board === "AQA" && level === "A-Level") {
      if (dates[subject]) return dates[subject];
    }
    // Others: "4MA1/Mathematics Paper 1H" → "4MA1/1H", "9709/11" → "9709/11"
    else {
      const cleanedPaper = paper.replace(/^[A-Za-z\s]+Paper\s+/i, "").trim();
      const key = `${subject}/${cleanedPaper}`;
      if (dates[key]) return dates[key];
      // Try just the subject code for some formats
      if (dates[subject]) return dates[subject];
    }
  }

  // Fallback: try without suffix after dash or space
  const baseCode = paperCode.split(/[/\s]/)[0];
  if (dates[baseCode]) return dates[baseCode];

  return "2026-10-01";
}

export default function Planner() {
  const [studentName, setStudentName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("A-Level");
  const [selectedBoard, setSelectedBoard] = useState("CAIE");
  const [selectedGroups, setSelectedGroups] = useState<SelectedPaperGroup[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [restDays, setRestDays] = useState<number[]>([0]);
  const [intensity, setIntensity] = useState<Intensity>("normal");
  const [paperOverrides] = useState<Record<string, string>>({});
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<number, boolean>>({});
  // All subjects collapsed by default (true = collapsed)
  const [collapsedSubjects, setCollapsedSubjects] = useState<Record<string, boolean>>(() => {
    // Initialize with all subjects collapsed
    return {};
  });
  const [shareUrl, setShareUrl] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Available options
  const levels = Object.keys(plannerData);
  const boards = selectedLevel ? Object.keys((plannerData as Record<string, Record<string, unknown>>)[selectedLevel] || {}) : [];

  // Get subjects for selected level/board with category sorting
  const subjects = useMemo(() => {
    if (!selectedLevel || !selectedBoard) return [];
    const boardData = (plannerData as Record<string, Record<string, Record<string, { name: string; papers: { code: string; component: string; latestSeries: string }[] }>>>)[selectedLevel]?.[selectedBoard] || {};

    const categorized: Record<string, { code: string; name: string; paperGroups: PaperGroup[]; category: SubjectCategory }[]> = {};
    for (const [code, info] of Object.entries(boardData)) {
      const cat = getSubjectCategory(code);
      if (!categorized[cat]) categorized[cat] = [];
      const paperGroups = groupPapers(info.papers, selectedBoard, selectedLevel, code);
      categorized[cat].push({ code, name: info.name || code, paperGroups, category: cat });
    }

    const result: typeof categorized[string] = [];
    const catOrder: SubjectCategory[] = ["math", "physics", "chemistry", "economics", "biology", "cs", "other"];
    for (const cat of catOrder) {
      if (categorized[cat]) {
        categorized[cat].sort((a, b) => {
          if (a.code === "9709" && b.code === "9231") return -1;
          if (a.code === "9231" && b.code === "9709") return 1;
          return a.code.localeCompare(b.code);
        });
        result.push(...categorized[cat]);
      }
    }
    return result;
  }, [selectedLevel, selectedBoard]);

  // Toggle a paper group (select/deselect all variants)
  const togglePaperGroup = (subjectCode: string, group: PaperGroup) => {
    setSelectedGroups(prev => {
      const exists = prev.find(g => g.subjectCode === subjectCode && g.paperNum === group.paperNum);
      if (exists) {
        return prev.filter(g => !(g.subjectCode === subjectCode && g.paperNum === group.paperNum));
      }
      return [...prev, {
        subjectCode, paperNum: group.paperNum, paperLabel: group.label,
        board: selectedBoard, level: selectedLevel,
        variants: group.papers.map(p => ({ code: p.code, component: p.component })),
      }];
    });
  };

  // Toggle a unit for Edexcel AL (select/deselect all papers in unit)
  const toggleUnitSelection = (unitCode: string, papers: { code: string; component: string }[]) => {
    setSelectedGroups(prev => {
      const exists = prev.find(g => g.subjectCode === unitCode);
      if (exists) {
        return prev.filter(g => g.subjectCode !== unitCode);
      }
      return [...prev, {
        subjectCode: unitCode, paperNum: "1", paperLabel: getUnitName(unitCode),
        board: selectedBoard, level: selectedLevel,
        variants: papers.map(p => ({ code: p.code, component: p.component })),
      }];
    });
  };

  // Build planner config from selected groups
  const { config, pastPapersMap } = useMemo(() => {
    const selectedPapers = selectedGroups.flatMap(g =>
      g.variants.map(v => ({
        code: v.code, name: `${g.subjectCode} ${g.paperLabel}`,
        subjectCode: g.subjectCode, component: v.component,
        examDate: getGroupNearestExamDate(g.level, g.board, g.variants),
      }))
    );
    const cfg: PlannerConfig = {
      startDate,
      selectedPapers,
      restDays, intensity, paperOverrides,
    };
    const map: Record<string, string[]> = {};
    for (const g of selectedGroups) {
      for (const v of g.variants) {
        map[v.code] = generatePastPapersForVariant(g.subjectCode, v.component);
      }
    }
    return { config: cfg, pastPapersMap: map };
  }, [selectedGroups, startDate, restDays, intensity, paperOverrides]);

  const { weeks, totalTasks } = usePlanner(config, pastPapersMap);

  // Exam countdown (one entry per selected group, not per variant)
  const examGroups = useMemo(() =>
    selectedGroups.map(g => {
      const date = getGroupNearestExamDate(g.level, g.board, g.variants);
      const days = differenceInDays(parseISO(date), new Date());
      return { label: `${g.subjectCode} ${g.paperLabel}`, date, daysUntil: days };
    }).sort((a, b) => a.daysUntil - b.daysUntil),
  [selectedGroups]);

  const toggleRestDay = (d: number) => {
    setRestDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b));
  };

  const getCountdownColor = (days: number) => days < 7 ? "#C17B5F" : days < 30 ? "#C9A87C" : "#6B8F5E";
  const cardStyle: React.CSSProperties = { padding: 20, borderRadius: 14, background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(250,248,245,0.9))", boxShadow: "0 4px 20px rgba(61,56,50,0.06)", border: "1px solid rgba(233,229,222,0.8)" };
  const selectBtn = (active: boolean): React.CSSProperties => ({ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: active ? "1px solid #8F7F6E" : "1px solid #D9D4CE", background: active ? "linear-gradient(135deg, rgba(143,127,110,0.12), rgba(143,127,110,0.04))" : "#FFF", color: active ? "#8F7F6E" : "#8B8378", cursor: "pointer", transition: "all 0.2s ease" });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8, #F5F2EE)" }}>
      <Header title="刷题规划" links={NAV_LINKS} />
      <main style={{ flex: 1, padding: "24px 16px 40px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 }}>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Student Name */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <User size={16} style={{ color: "#8F7F6E" }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>学生信息</h3>
              </div>
              <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="输入学生姓名..."
                style={{ padding: "8px 12px", border: "1px solid #D9D4CE", borderRadius: 8, fontSize: 14, width: "100%", color: "#3D3832", background: "#FFF", outline: "none" }} />
            </div>

            {/* Level */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Filter size={16} style={{ color: "#8F7F6E" }} /><h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>选择学段</h3></div>
              <div style={{ display: "flex", gap: 8 }}>{levels.map(l => (<button key={l} onClick={() => { setSelectedLevel(l); setSelectedBoard(Object.keys((plannerData as Record<string, Record<string, unknown>>)[l] || {})[0] || ""); setSelectedGroups([]); }} style={selectBtn(selectedLevel === l)}>{l}</button>))}</div>
            </div>

            {/* Board */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><GraduationCap size={16} style={{ color: "#8F7F6E" }} /><h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>选择考试局</h3></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{boards.map(b => (<button key={b} onClick={() => { setSelectedBoard(b); setSelectedGroups([]); }} style={selectBtn(selectedBoard === b)}>{b}</button>))}</div>
            </div>

            {/* Settings */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><Settings size={16} style={{ color: "#8F7F6E" }} /><h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>规划设置</h3></div>
              <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: "#8B8378", fontWeight: 500, display: "block", marginBottom: 6 }}>开始日期</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #D9D4CE", borderRadius: 8, fontSize: 14, width: "100%", color: "#3D3832", background: "#FFF" }} /></div>
              <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: "#8B8378", fontWeight: 500, display: "block", marginBottom: 6 }}>备考强度</label><div style={{ display: "flex", gap: 6 }}>{(Object.keys(INTENSITY_CONFIG) as Intensity[]).map(k => (<button key={k} onClick={() => setIntensity(k)} style={selectBtn(intensity === k)}>{INTENSITY_CONFIG[k].label}</button>))}</div><p style={{ fontSize: 11, color: "#A8A095", margin: "4px 0 0" }}>{INTENSITY_CONFIG[intensity].description}</p></div>
              <div><label style={{ fontSize: 12, color: "#8B8378", fontWeight: 500, display: "block", marginBottom: 6 }}>休息日</label><div style={{ display: "flex", gap: 4 }}>{WEEKDAYS.map((name, i) => (<button key={i} onClick={() => toggleRestDay(i)} title={WEEKDAYS[i]} style={{ width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600, border: restDays.includes(i) ? "1px solid #8F7F6E" : "1px solid #D9D4CE", background: restDays.includes(i) ? "linear-gradient(135deg, #8F7F6E, #A69888)" : "#FFF", color: restDays.includes(i) ? "#FFF" : "#8B8378", cursor: "pointer" }}>{name}</button>))}</div>{restDays.length >= 7 && <p style={{ fontSize: 11, color: "#C75B2A", margin: "4px 0 0" }}>⚠️ 一周内每天都设为休息日将导致规划为空</p>}</div>
            </div>

            {/* Subject & Paper Selection */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <BookOpen size={16} style={{ color: "#8F7F6E" }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>选择科目 <span style={{ fontSize: 11, color: "#A8A095", fontWeight: 400 }}>({selectedGroups.length} 个 Paper)</span></h3>
              </div>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {subjects.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#A8A095", fontSize: 13 }}>暂无科目数据</div>
                ) : needsSubjectGrouping(selectedBoard, selectedLevel) ? (
                  /* Edexcel AL: grouped by subject area */
                  <EdexcelALSubjectList
                    boardData={(plannerData as Record<string, Record<string, Record<string, { name: string; papers: { code: string; component: string; latestSeries?: string }[] }>>>)[selectedLevel]?.[selectedBoard] || {}}
                    selectedGroups={selectedGroups}
                    onToggleUnit={(unitCode, papers) => toggleUnitSelection(unitCode, papers)}
                    collapsedSubjects={collapsedSubjects}
                    onToggleSubject={(code) => setCollapsedSubjects(prev => ({ ...prev, [code]: !prev[code] }))}
                    selectedLevel={selectedLevel}
                    selectedBoard={selectedBoard}
                  />
                ) : (
                  /* Other boards: per-subject with paper groups */
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {subjects.map(subject => {
                  const isSubjectCollapsed = collapsedSubjects[subject.code] === undefined ? true : collapsedSubjects[subject.code]; // default collapsed
                  const selectedPaperCount = selectedGroups.filter(g => g.subjectCode === subject.code).length;
                  return (
                    <div key={subject.code} style={{ border: "1px solid #E9E5DE", borderRadius: 10, overflow: "hidden" }}>
                      <div onClick={() => setCollapsedSubjects(prev => ({ ...prev, [subject.code]: !prev[subject.code] }))}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", background: selectedPaperCount > 0 ? "rgba(143,127,110,0.06)" : "#FAFAF8" }}>
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "rgba(143,127,110,0.1)", color: "#8F7F6E", fontWeight: 700 }}>{CATEGORY_NAMES[subject.category]}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#3D3832" }}>{subject.code}</span>
                        <span style={{ fontSize: 11, color: "#A8A095", flex: 1 }}>{subject.name}</span>
                        {selectedPaperCount > 0 && <span style={{ fontSize: 10, color: "#8F7F6E", fontWeight: 600 }}>{selectedPaperCount}个</span>}
                        {isSubjectCollapsed ? <ChevronDown size={14} style={{ color: "#A8A095" }} /> : <ChevronUp size={14} style={{ color: "#A8A095" }} />}
                      </div>
                      {!isSubjectCollapsed && (
                        <div style={{ padding: "6px 0", background: "#FFF" }}>
                          {subject.paperGroups.map(group => {
                            const isSelected = selectedGroups.some(g => g.subjectCode === subject.code && g.paperNum === group.paperNum);
                            const examDate = getGroupNearestExamDate(selectedLevel, selectedBoard, group.papers);
                            const daysUntil = differenceInDays(parseISO(examDate), new Date());
                            return (
                              <div key={`${subject.code}_${group.paperNum}`} onClick={() => togglePaperGroup(subject.code, group)}
                                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", background: isSelected ? "rgba(143,127,110,0.04)" : "transparent", borderLeft: isSelected ? "3px solid #8F7F6E" : "3px solid transparent" }}>
                                <div style={{ width: 18, height: 18, borderRadius: 5, border: isSelected ? "none" : "1.5px solid #D9D4CE", background: isSelected ? "#8F7F6E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {isSelected && <Check size={12} color="#FFF" strokeWidth={3} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{group.label}</div>
                                  {group.description && <div style={{ fontSize: 10, color: "#A8A095" }}>{group.description}</div>}
                                </div>
                                <span style={{ fontSize: 10, color: daysUntil < 30 ? "#C17B5F" : "#A8A095" }}><CalendarDays size={10} style={{ display: "inline", marginRight: 2 }} />{examDate}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
                )}
              </div>
            </div>

            {/* Countdown */}
            {selectedGroups.length > 0 && (
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><Clock size={16} style={{ color: "#8F7F6E" }} /><h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>考试倒计时</h3></div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>{examGroups.map((g, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #F0EDE8" }}>
                    <div><span style={{ fontSize: 12, fontWeight: 500, color: "#4A453F" }}>{g.label}</span><span style={{ fontSize: 10, color: "#A8A095", marginLeft: 4 }}>{g.date}</span></div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: getCountdownColor(g.daysUntil) }}>{g.daysUntil > 0 ? `${g.daysUntil}天` : g.daysUntil === 0 ? "今天" : "已过"}</span>
                  </div>
                ))}</div>
              </div>
            )}

            {/* Share */}
            <div style={cardStyle}>
              <button onClick={() => { const url = generateShareUrl(config); setShareUrl(url); setShowShare(true); }} style={{ width: "100%", padding: "10px", borderRadius: 8, background: "linear-gradient(135deg, #8F7F6E, #A69888)", color: "#FFF", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Share2 size={16} /> 生成分享链接</button>
              {showShare && (<div style={{ marginTop: 10, padding: 10, background: "rgba(143,127,110,0.06)", borderRadius: 8 }}><div style={{ display: "flex", gap: 6, marginBottom: 8 }}><input value={shareUrl} readOnly style={{ flex: 1, padding: "6px 10px", border: "1px solid #D9D4CE", borderRadius: 6, fontSize: 11, color: "#8B8378" }} /><button onClick={() => navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })} style={{ padding: "6px 10px", borderRadius: 6, background: "#8F7F6E", color: "#FFF", border: "none", cursor: "pointer" }}>{copied ? <CheckCheck size={14} /> : <Copy size={14} />}</button></div><div style={{ display: "flex", justifyContent: "center" }}><QRCodeSVG value={shareUrl} size={100} level="M" /></div></div>)}
            </div>
          </div>

          {/* Plan Area */}
          <div>
            <div style={{ ...cardStyle, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GraduationCap size={20} style={{ color: "#8F7F6E" }} />
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 600, color: "#3D3832", margin: 0 }}>
                    {studentName ? `${studentName} 的` : ""}备考计划
                  </h2>
                  <p style={{ fontSize: 12, color: "#A8A095", margin: "2px 0 0" }}>
                    {selectedLevel} · {selectedBoard} · 共 {totalTasks} 套试卷 · {selectedGroups.length} 个 Paper · {weeks.length} 周
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => exportToExcel(weeks, selectedBoard, studentName || undefined)} style={{ padding: "7px 12px", borderRadius: 8, background: "#FFF", border: "1px solid #D9D4CE", color: "#8B8378", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><FileSpreadsheet size={14} /> Excel</button>
                <button onClick={() => exportToWord(weeks, selectedBoard, studentName || undefined)} style={{ padding: "7px 12px", borderRadius: 8, background: "#FFF", border: "1px solid #D9D4CE", color: "#8B8378", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><FileText size={14} /> Word</button>
                <button onClick={() => exportToPDF("planner-export", selectedBoard, studentName || undefined)} style={{ padding: "7px 12px", borderRadius: 8, background: "#FFF", border: "1px solid #D9D4CE", color: "#8B8378", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><FileDown size={14} /> PDF</button>
              </div>
            </div>

            <div id="planner-export" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {studentName && (
                <div style={{ ...cardStyle, padding: "16px 20px", marginBottom: 4 }}>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    <div><span style={{ fontSize: 12, color: "#A8A095" }}>学生</span><div style={{ fontSize: 16, fontWeight: 600, color: "#3D3832" }}>{studentName}</div></div>
                    <div><span style={{ fontSize: 12, color: "#A8A095" }}>学段</span><div style={{ fontSize: 14, fontWeight: 500, color: "#4A453F" }}>{selectedLevel}</div></div>
                    <div><span style={{ fontSize: 12, color: "#A8A095" }}>考试局</span><div style={{ fontSize: 14, fontWeight: 500, color: "#4A453F" }}>{selectedBoard}</div></div>
                    <div><span style={{ fontSize: 12, color: "#A8A095" }}>备考科目</span><div style={{ fontSize: 14, fontWeight: 500, color: "#4A453F" }}>{selectedGroups.length} 个 Paper</div></div>
                    <div><span style={{ fontSize: 12, color: "#A8A095" }}>计划周期</span><div style={{ fontSize: 14, fontWeight: 500, color: "#4A453F" }}>{weeks.length} 周 · {totalTasks} 套试卷</div></div>
                  </div>
                </div>
              )}

              {weeks.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: "center", padding: 60 }}><BookOpen size={32} style={{ color: "#C4BDB3", marginBottom: 12 }} /><p style={{ fontSize: 15, color: "#8B8378", margin: 0 }}>请先选择科目和 Paper</p></div>
              ) : (weeks.map(week => (
                <div key={week.weekNum} style={cardStyle}>
                  <div onClick={() => setCollapsedWeeks(prev => ({ ...prev, [week.weekNum]: !prev[week.weekNum] }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", paddingBottom: 8, borderBottom: "1px solid #F0EDE8" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#3D3832" }}>{week.weekLabel}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#A8A095" }}>{week.days.filter(d => !d.isRestDay && d.papers.length > 0).length} 天刷题 · {week.days.reduce((s, d) => s + d.papers.length, 0)} 套</span>
                      {collapsedWeeks[week.weekNum] ? <ChevronDown size={16} style={{ color: "#A8A095" }} /> : <ChevronUp size={16} style={{ color: "#A8A095" }} />}
                    </div>
                  </div>
                  {!collapsedWeeks[week.weekNum] && (<div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 8 }}>{week.days.map(day => <DayRow key={day.date} day={day} completedTasks={completedTasks} onToggleComplete={key => setCompletedTasks(p => ({ ...p, [key]: !p[key] }))} />)}</div>)}
                </div>
              )))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// Day Row Component
function DayRow({ day, completedTasks, onToggleComplete }: {
  day: import("../hooks/usePlanner").DailyTask;
  completedTasks: Record<string, boolean>;
  onToggleComplete: (key: string) => void;
}) {
  if (day.isRestDay) return <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: "rgba(143,127,110,0.04)", borderRadius: 8 }}><span style={{ fontSize: 13, color: "#A8A095", width: 90, flexShrink: 0 }}>{day.dateLabel}</span><span style={{ fontSize: 13, color: "#8B8378", fontStyle: "italic" }}>休息日</span></div>;
  if (day.isExamDay) return <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: "rgba(193,123,95,0.08)", borderRadius: 8, border: "1px solid rgba(193,123,95,0.15)" }}><span style={{ fontSize: 13, color: "#C17B5F", width: 90, flexShrink: 0, fontWeight: 600 }}>{day.dateLabel}</span><span style={{ fontSize: 13, color: "#C17B5F", fontWeight: 500 }}>考试日</span></div>;
  if (day.papers.length === 0) return <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: 8 }}><span style={{ fontSize: 13, color: "#A8A095", width: 90, flexShrink: 0 }}>{day.dateLabel}</span><span style={{ fontSize: 12, color: "#C4BDB3" }}>—</span></div>;
  return (
    <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.5)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 13, color: "#4A453F", width: 90, flexShrink: 0, fontWeight: 500, paddingTop: 4 }}>{day.dateLabel}</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {day.papers.map((p, i) => {
            const key = `${day.date}_${p.paperCode}_${i}`;
            const isDone = completedTasks[key];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: isDone ? "rgba(107,143,94,0.08)" : "rgba(143,127,110,0.04)", border: isDone ? "1px solid rgba(107,143,94,0.2)" : "1px solid transparent" }}>
                <button onClick={() => onToggleComplete(key)} style={{ width: 18, height: 18, borderRadius: "50%", border: isDone ? "none" : "1px solid #D9D4CE", background: isDone ? "#6B8F5E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{isDone && <Check size={12} color="#FFF" />}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#8F7F6E" }}>{p.paperCode}</span>
                    <span style={{ fontSize: 12, color: "#4A453F", fontWeight: 500 }}>{p.pastPaper}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// ── Edexcel AL Subject List Component ──────────────────────────────
function EdexcelALSubjectList({
  boardData,
  selectedGroups,
  onToggleUnit,
  collapsedSubjects,
  onToggleSubject,
  selectedLevel,
  selectedBoard,
}: {
  boardData: Record<string, { name: string; papers: { code: string; component: string; latestSeries?: string }[] }>;
  selectedGroups: SelectedPaperGroup[];
  onToggleUnit: (unitCode: string, papers: { code: string; component: string }[]) => void;
  collapsedSubjects: Record<string, boolean>;
  onToggleSubject: (code: string) => void;
  selectedLevel: string;
  selectedBoard: string;
}) {
  const groups = groupEdexcelALUnits(boardData);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {groups.map(group => {
        const key = `edx_${group.category}_${group.subjectName}`;
        const isCollapsed = collapsedSubjects[key] === undefined ? true : collapsedSubjects[key]; // default collapsed
        const selectedCount = group.units.filter(u => selectedGroups.some(g => g.subjectCode === u.code)).length;
        return (
          <div key={key} style={{ border: "1px solid #E9E5DE", borderRadius: 10, overflow: "hidden" }}>
            {/* Subject area header */}
            <div onClick={() => onToggleSubject(key)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", background: selectedCount > 0 ? "rgba(143,127,110,0.06)" : "#FAFAF8" }}>
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "rgba(143,127,110,0.1)", color: "#8F7F6E", fontWeight: 700 }}>{group.categoryLabel}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#3D3832", flex: 1 }}>{group.subjectName}</span>
              {selectedCount > 0 && <span style={{ fontSize: 10, color: "#8F7F6E", fontWeight: 600 }}>{selectedCount}/{group.units.length}</span>}
              {isCollapsed ? <ChevronDown size={14} style={{ color: "#A8A095" }} /> : <ChevronUp size={14} style={{ color: "#A8A095" }} />}
            </div>
            {/* Units list */}
            {!isCollapsed && (
              <div style={{ padding: "6px 0", background: "#FFF" }}>
                {group.units.map(unit => {
                  const isSelected = selectedGroups.some(g => g.subjectCode === unit.code);
                  const examDate = getGroupNearestExamDate(selectedLevel, selectedBoard, unit.papers);
                  const daysUntil = differenceInDays(parseISO(examDate), new Date());
                  return (
                    <div key={unit.code} onClick={() => onToggleUnit(unit.code, unit.papers)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", background: isSelected ? "rgba(143,127,110,0.04)" : "transparent", borderLeft: isSelected ? "3px solid #8F7F6E" : "3px solid transparent" }}>
                      {/* Checkbox */}
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: isSelected ? "none" : "1.5px solid #D9D4CE", background: isSelected ? "#8F7F6E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isSelected && <Check size={12} color="#FFF" strokeWidth={3} />}
                      </div>
                      {/* Unit info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? "#3D3832" : "#4A453F" }}>{unit.code}</div>
                        <div style={{ fontSize: 11, color: "#A8A095" }}>{unit.name}</div>
                      </div>
                      {/* Exam date */}
                      <span style={{ fontSize: 10, color: daysUntil < 30 ? "#C17B5F" : "#A8A095", flexShrink: 0 }}>
                        <CalendarDays size={10} style={{ display: "inline", marginRight: 2 }} />{examDate}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
