import { useState, useMemo, useEffect } from "react";
import Header from "../components/Header";
import { useCourseContext } from "../course-context/CourseContextProvider";
import Footer from "../components/Footer";
import { QRCodeSVG } from "qrcode.react";
import { format, differenceInDays } from "date-fns";
import { parseLocalDate, buildExamEvents } from "../hooks/usePlanner";
import {
  BookOpen, Settings, Share2, Clock, Check, ChevronDown, ChevronUp,
  Copy, CheckCheck, FileSpreadsheet, FileText, FileDown, GraduationCap,
  Filter, User, CalendarDays,
} from "lucide-react";
import plannerData from "../data/plannerData.json";
import { INTENSITY_CONFIG } from "../data/examData";
import type { Intensity } from "../data/examData";
import {
  getSubjectCategory, CATEGORY_NAMES,
  type SubjectCategory,
} from "../data/examDates";
import {
  resolvePlannerGroupExamDate,
  type PlannerExamDateResolution,
} from "../data/plannerExamDates";
import { usePlanner } from "../hooks/usePlanner";
import type { PlannerConfig, PracticePaperOption } from "../hooks/usePlanner";
import { assetHref, buildPastPaperSets, resolvePastPaperCatalogKey, usePastPaperCatalogs } from "../domain-v2/past-papers";

/** UI-level type: a selected paper group in the planner */
interface SelectedPaperGroup {
  subjectCode: string;
  subjectName?: string;
  paperLabel: string;
  paperNum?: string;       // numeric paper number for sorting
  level: string;
  board: string;
  variants: { code: string; component: string; name?: string }[];
}
import { generateShareUrl, parseShareUrl, clearPlanUrl } from "../utils/shareCode";
import { groupPapers, type PaperGroup } from "../utils/paperGroups";
import { groupEdexcelALUnits, getUnitName, needsSubjectGrouping } from "../utils/subjectGroups";
import { exportToExcel, exportToWord, exportToPDF } from "../utils/exportPlanner";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** Get the nearest future exam date for a paper group. Returns null if no date found. */
function getGroupNearestExamDate(level: string, board: string, variants: { code: string }[]): string | null {
  return resolvePlannerGroupExamDate(level, board, variants)?.date ?? null;
}

function ExamDateDisplay({ schedule }: { schedule: PlannerExamDateResolution | null }) {
  if (!schedule) return <span className="text-[#887f75]">日期待补充</span>;
  const official = schedule.source === "exam-overview";
  const detail = official
    ? `${schedule.series ?? "考试概览"} · ${schedule.componentCode} · ${schedule.timetableStatus ?? "官方时间表"}`
    : "该课程尚未接入考试概览，暂用规划器日期，等待官方复核";
  return (
    <span title={detail} className="inline-flex items-center gap-1">
      <CalendarDays size={10} aria-hidden="true" />
      <span>{schedule.date}</span>
      <span className={official
        ? "rounded bg-[#e8f0e9] px-1 py-0.5 text-[9px] font-semibold text-[#456348]"
        : "rounded bg-[#f2ece5] px-1 py-0.5 text-[9px] font-semibold text-[#8a674e]"
      }>{official ? "官方" : "预估"}</span>
    </span>
  );
}

export default function Planner() {
  const { entry } = useCourseContext();
  // Parse shared plan from URL once (before state init)
  const initialShared = useMemo(() => parseShareUrl(), []);
  // Clean URL after parsing
  useEffect(() => { if (initialShared) clearPlanUrl(); }, [initialShared]);

  const [studentName, setStudentName] = useState("");
  // Backward-compatible loading from old share URLs (may contain level/board/selectedGroups)
  const oldShared = initialShared as unknown as Record<string, unknown> | null;
  const [selectedLevel, setSelectedLevel] = useState<string>(
    (oldShared?.level as string) ?? "A-Level"
  );
  const [selectedBoard, setSelectedBoard] = useState<string>(
    (oldShared?.board as string) ?? "CAIE"
  );
  const [selectedGroups, setSelectedGroups] = useState<SelectedPaperGroup[]>(
    (oldShared?.selectedGroups as SelectedPaperGroup[]) ?? []
  );
  const [startDate, setStartDate] = useState(initialShared?.startDate ?? format(new Date(), "yyyy-MM-dd"));
  const [restDays, setRestDays] = useState<number[]>(initialShared?.restDays ?? [0]);
  const [intensity, setIntensity] = useState<Intensity>(initialShared?.intensity ?? "normal");
  const [paperOverrides] = useState<Record<string, string>>(initialShared?.paperOverrides ?? {});
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

  const selectedCatalogKeys = useMemo(() => [...new Set(
    selectedGroups
      .map((group) => resolvePastPaperCatalogKey(group.board, group.subjectCode))
      .filter((key): key is string => Boolean(key))
  )], [selectedGroups]);
  const { catalogs: pastPaperCatalogs, loading: pastPaperCatalogsLoading } = usePastPaperCatalogs(selectedCatalogKeys);

  useEffect(() => {
    if (initialShared || !entry || entry.capabilities.planner.status === "unavailable" || !entry.plannerLevel || !entry.plannerBoard) return;
    const data = plannerData as Record<string, Record<string, unknown>>;
    if (!data[entry.plannerLevel]?.[entry.plannerBoard]) return;
    queueMicrotask(() => {
      setSelectedLevel(entry.plannerLevel!);
      setSelectedBoard(entry.plannerBoard!);
      setSelectedGroups([]);
      const boardData = data[entry.plannerLevel!][entry.plannerBoard!] as Record<string, { name: string; papers: { code: string; component: string }[] }>;
      if (needsSubjectGrouping(entry.plannerBoard!, entry.plannerLevel!)) {
        const prefix = entry.subjectCode.slice(0, 3);
        const expanded = Object.fromEntries(groupEdexcelALUnits(boardData).filter((group) => group.units.some((unit) => unit.code.startsWith(prefix))).map((group) => [`edx_${group.category}_${group.subjectName}`, false]));
        setCollapsedSubjects((current) => ({ ...current, ...expanded }));
      } else if (boardData[entry.subjectCode]) {
        setCollapsedSubjects((current) => ({ ...current, [entry.subjectCode]: false }));
      }
    });
  }, [entry, initialShared]);

  // Available options
  const levels = Object.keys(plannerData).sort((a, b) => ['IGCSE', 'GCSE', 'A-Level'].indexOf(a) - ['IGCSE', 'GCSE', 'A-Level'].indexOf(b));
  const boards = selectedLevel
    ? Object.keys((plannerData as Record<string, Record<string, unknown>>)[selectedLevel] || {})
      .sort((a, b) => ['CAIE', 'Edexcel', 'AQA', 'OCR'].indexOf(a) - ['CAIE', 'Edexcel', 'AQA', 'OCR'].indexOf(b))
    : [];

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
    // P1-3: Group variants into ExamEvents (one per subjectCode + paperLabel)
    const events = buildExamEvents(selectedGroups, getGroupNearestExamDate);
    const cfg: PlannerConfig = {
      startDate,
      events,
      restDays,
      intensity,
      paperOverrides,
      maxTasksPerDay: 3,
    };
    const map: Record<string, PracticePaperOption[]> = {};
    for (const g of selectedGroups) {
      const name = `${g.subjectCode} ${g.paperLabel}`;
      const key = resolvePastPaperCatalogKey(g.board, g.subjectCode);
      const catalog = key ? pastPaperCatalogs.get(key) : undefined;
      if (!catalog) {
        map[name] = [];
        continue;
      }
      const componentCodes = g.variants
        .flatMap((variant) => [variant.component, variant.code])
        .map((value) => value.split("/").pop() ?? value);
      map[name] = buildPastPaperSets(catalog, componentCodes).map((set) => ({
        id: set.id,
        title: set.title,
        questionPaperUrl: assetHref(set.questionPaper),
        markSchemeUrl: set.markScheme ? assetHref(set.markScheme) : undefined,
        sourcePageUrl: catalog.sourcePageUrl,
        accessStatus: set.questionPaper.accessStatus,
      }));
    }
    return { config: cfg, pastPapersMap: map };
  }, [selectedGroups, startDate, restDays, intensity, paperOverrides, pastPaperCatalogs]);

  const { weeks, totalTasks } = usePlanner(config, pastPapersMap);

  // Detect groups missing exam dates
  const missingDateGroups = useMemo(() =>
    selectedGroups.filter(g => !getGroupNearestExamDate(g.level, g.board, g.variants)),
  [selectedGroups]);
  const missingMaterialGroups = useMemo(() => selectedGroups.filter((group) =>
    (pastPapersMap[`${group.subjectCode} ${group.paperLabel}`] ?? []).length === 0
  ), [selectedGroups, pastPapersMap]);

  // Exam countdown (one entry per selected group, not per variant)
  const examGroups = useMemo(() =>
    selectedGroups.map(g => {
      const schedule = resolvePlannerGroupExamDate(g.level, g.board, g.variants);
      const date = schedule?.date ?? null;
      if (!date) return { label: `${g.subjectCode} ${g.paperLabel}`, date: "暂无日期", daysUntil: Infinity };
      const days = differenceInDays(parseLocalDate(date), new Date());
      return { label: `${g.subjectCode} ${g.paperLabel}`, date, daysUntil: days, schedule };
    }).filter(g => g.daysUntil !== Infinity).sort((a, b) => a.daysUntil - b.daysUntil),
  [selectedGroups]);

  const toggleRestDay = (d: number) => {
    setRestDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b));
  };

  const getCountdownColor = (days: number) => days < 7 ? "#C17B5F" : days < 30 ? "#C9A87C" : "#6B8F5E";
  const CARD_CLS = "rounded-[14px] border border-[rgba(233,229,222,0.8)] bg-gradient-to-br from-[rgba(255,255,255,0.95)] to-[rgba(250,248,245,0.9)] p-5 shadow-[0_4px_20px_rgba(61,56,50,0.06)]";
  // cardStyle deprecated — all usages now use CARD_CLS
  const selectBtnCls = (active: boolean) => `cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-medium transition-all ${active ? "border border-[#675A4D] bg-gradient-to-br from-[rgba(143,127,110,0.12)] to-[rgba(143,127,110,0.04)] text-[#675A4D]" : "border border-[#D9D4CE] bg-white text-[#625C54] hover:border-[#A69888] hover:text-[#675A4D]"}`;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8, #F5F2EE)" }}>
      <Header title="刷题规划" />
      <main style={{ flex: 1, padding: "24px 16px 40px" }}>
        <h1 className="sr-only">刷题规划</h1>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_minmax(0,1fr)]" style={{ maxWidth: 1400, margin: "0 auto" }}>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Student Name */}
            <div className={CARD_CLS}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <User size={16} style={{ color: "#675A4D" }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>学生信息</h3>
              </div>
              <input aria-label="学生姓名" type="text" value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="输入学生姓名..."
                style={{ padding: "8px 12px", border: "1px solid #D9D4CE", borderRadius: 8, fontSize: 14, width: "100%", color: "#3D3832", background: "#FFF", outline: "none" }} />
            </div>

            {/* Level */}
            <div className={CARD_CLS}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Filter size={16} style={{ color: "#675A4D" }} /><h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>选择学段</h3></div>
              <div style={{ display: "flex", gap: 8 }}>{levels.map(l => (<button key={l} onClick={() => { setSelectedLevel(l); setSelectedBoard(Object.keys((plannerData as Record<string, Record<string, unknown>>)[l] || {})[0] || ""); setSelectedGroups([]); }} className={selectBtnCls(selectedLevel === l)}>{l}</button>))}</div>
            </div>

            {/* Board */}
            <div className={CARD_CLS}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><GraduationCap size={16} style={{ color: "#675A4D" }} /><h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>选择考试局</h3></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{boards.map(b => (<button key={b} onClick={() => { setSelectedBoard(b); setSelectedGroups([]); }} className={selectBtnCls(selectedBoard === b)}>{b}</button>))}</div>
            </div>

            {/* Settings */}
            <div className={CARD_CLS}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><Settings size={16} style={{ color: "#675A4D" }} /><h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>规划设置</h3></div>
              <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: "#625C54", fontWeight: 500, display: "block", marginBottom: 6 }}>开始日期</label><input aria-label="开始日期" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "8px 12px", border: "1px solid #D9D4CE", borderRadius: 8, fontSize: 14, width: "100%", color: "#3D3832", background: "#FFF" }} /></div>
              <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, color: "#625C54", fontWeight: 500, display: "block", marginBottom: 6 }}>备考强度</label><div style={{ display: "flex", gap: 6 }}>{(Object.keys(INTENSITY_CONFIG) as Intensity[]).map(k => (<button key={k} onClick={() => setIntensity(k)} className={selectBtnCls(intensity === k)}>{INTENSITY_CONFIG[k].label}</button>))}</div><p style={{ fontSize: 11, color: "#6E675E", margin: "4px 0 0" }}>{INTENSITY_CONFIG[intensity].description}</p></div>
              <div><label style={{ fontSize: 12, color: "#625C54", fontWeight: 500, display: "block", marginBottom: 6 }}>休息日</label><div style={{ display: "flex", gap: 4 }}>{WEEKDAYS.map((name, i) => (<button key={i} onClick={() => toggleRestDay(i)} title={WEEKDAYS[i]} style={{ width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600, border: restDays.includes(i) ? "1px solid #675A4D" : "1px solid #D9D4CE", background: restDays.includes(i) ? "linear-gradient(135deg, #675A4D, #A69888)" : "#FFF", color: restDays.includes(i) ? "#FFF" : "#625C54", cursor: "pointer" }}>{name}</button>))}</div>{restDays.length >= 7 && <p style={{ fontSize: 11, color: "#A9471F", margin: "4px 0 0" }}>⚠️ 一周内每天都设为休息日将导致规划为空</p>}</div>
            </div>

            {/* Subject & Paper Selection */}
            <div className={CARD_CLS}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <BookOpen size={16} style={{ color: "#675A4D" }} />
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>选择科目 <span style={{ fontSize: 11, color: "#6E675E", fontWeight: 400 }}>({selectedGroups.length} 个 Paper)</span></h3>
              </div>
              <div tabIndex={0} aria-label="科目与试卷列表" style={{ maxHeight: 520, overflowY: "auto" }}>
                {subjects.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#6E675E", fontSize: 13 }}>暂无科目数据</div>
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
                        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "rgba(143,127,110,0.1)", color: "#675A4D", fontWeight: 700 }}>{CATEGORY_NAMES[subject.category]}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#3D3832" }}>{subject.code}</span>
                        <span style={{ fontSize: 11, color: "#6E675E", flex: 1 }}>{subject.name}</span>
                        {selectedPaperCount > 0 && <span style={{ fontSize: 10, color: "#675A4D", fontWeight: 600 }}>{selectedPaperCount}个</span>}
                        {isSubjectCollapsed ? <ChevronDown size={14} style={{ color: "#6E675E" }} /> : <ChevronUp size={14} style={{ color: "#6E675E" }} />}
                      </div>
                      {!isSubjectCollapsed && (
                        <div style={{ padding: "6px 0", background: "#FFF" }}>
                          {subject.paperGroups.map(group => {
                            const isSelected = selectedGroups.some(g => g.subjectCode === subject.code && g.paperNum === group.paperNum);
                            const examSchedule = resolvePlannerGroupExamDate(selectedLevel, selectedBoard, group.papers);
                            const examDate = examSchedule?.date ?? null;
                            const daysUntil = examDate ? differenceInDays(parseLocalDate(examDate), new Date()) : null;
                            return (
                              <div key={`${subject.code}_${group.paperNum}`} onClick={() => togglePaperGroup(subject.code, group)}
                                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", background: isSelected ? "rgba(143,127,110,0.04)" : "transparent", borderLeft: isSelected ? "3px solid #675A4D" : "3px solid transparent" }}>
                                <div style={{ width: 18, height: 18, borderRadius: 5, border: isSelected ? "none" : "1.5px solid #D9D4CE", background: isSelected ? "#675A4D" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {isSelected && <Check size={12} color="#FFF" strokeWidth={3} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{group.label}</div>
                                  {group.description && <div style={{ fontSize: 10, color: "#6E675E" }}>{group.description}</div>}
                                </div>
                                <span style={{ fontSize: 10, color: (daysUntil ?? Infinity) < 30 ? "#C17B5F" : "#6E675E" }}><ExamDateDisplay schedule={examSchedule} /></span>
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
              <div className={CARD_CLS}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><Clock size={16} style={{ color: "#675A4D" }} /><h3 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: 0 }}>考试倒计时</h3></div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>{examGroups.map((g, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #F0EDE8" }}>
                    <div><span style={{ fontSize: 12, fontWeight: 500, color: "#4A453F" }}>{g.label}</span><span style={{ fontSize: 10, color: "#6E675E", marginLeft: 4 }}><ExamDateDisplay schedule={g.schedule ?? null} /></span></div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: getCountdownColor(g.daysUntil) }}>{g.daysUntil > 0 ? `${g.daysUntil}天` : g.daysUntil === 0 ? "今天" : "已过"}</span>
                  </div>
                ))}</div>
              </div>
            )}

            {/* Share */}
            <div className={CARD_CLS}>
              <button onClick={() => { const url = generateShareUrl(config); setShareUrl(url); setShowShare(true); }} style={{ width: "100%", padding: "10px", borderRadius: 8, background: "linear-gradient(135deg, #675A4D, #A69888)", color: "#FFF", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Share2 size={16} /> 生成分享链接</button>
              {showShare && (<div style={{ marginTop: 10, padding: 10, background: "rgba(143,127,110,0.06)", borderRadius: 8 }}><div style={{ display: "flex", gap: 6, marginBottom: 8 }}><input value={shareUrl} readOnly style={{ flex: 1, padding: "6px 10px", border: "1px solid #D9D4CE", borderRadius: 6, fontSize: 11, color: "#625C54" }} /><button onClick={() => navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })} style={{ padding: "6px 10px", borderRadius: 6, background: "#675A4D", color: "#FFF", border: "none", cursor: "pointer" }}>{copied ? <CheckCheck size={14} /> : <Copy size={14} />}</button></div><div style={{ display: "flex", justifyContent: "center" }}><QRCodeSVG value={shareUrl} size={100} level="M" /></div></div>)}
            </div>
          </div>

          {/* Plan Area */}
          <div style={{ minWidth: 0 }}>
            <div className={`${CARD_CLS} mb-3.5 flex items-center justify-between gap-2.5 flex-wrap`}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <GraduationCap size={20} style={{ color: "#675A4D" }} />
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 600, color: "#3D3832", margin: 0 }}>
                    {studentName ? `${studentName} 的` : ""}备考计划
                  </h2>
                  <p style={{ fontSize: 12, color: "#6E675E", margin: "2px 0 0" }}>
                    {selectedLevel} · {selectedBoard} · 共 {totalTasks} 套试卷 · {selectedGroups.length} 个 Paper · {weeks.length} 周
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => exportToExcel(weeks, selectedBoard, studentName || undefined)} style={{ padding: "7px 12px", borderRadius: 8, background: "#FFF", border: "1px solid #D9D4CE", color: "#625C54", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><FileSpreadsheet size={14} /> Excel</button>
                <button onClick={() => exportToWord(weeks, selectedBoard, studentName || undefined)} style={{ padding: "7px 12px", borderRadius: 8, background: "#FFF", border: "1px solid #D9D4CE", color: "#625C54", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><FileText size={14} /> Word</button>
                <button onClick={() => exportToPDF("planner-export", selectedBoard, studentName || undefined)} style={{ padding: "7px 12px", borderRadius: 8, background: "#FFF", border: "1px solid #D9D4CE", color: "#625C54", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><FileDown size={14} /> PDF</button>
              </div>
            </div>

            <div id="planner-export" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {studentName && (
                <div className={`${CARD_CLS} px-5 py-4 mb-1`}>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    <div><span style={{ fontSize: 12, color: "#6E675E" }}>学生</span><div style={{ fontSize: 16, fontWeight: 600, color: "#3D3832" }}>{studentName}</div></div>
                    <div><span style={{ fontSize: 12, color: "#6E675E" }}>学段</span><div style={{ fontSize: 14, fontWeight: 500, color: "#4A453F" }}>{selectedLevel}</div></div>
                    <div><span style={{ fontSize: 12, color: "#6E675E" }}>考试局</span><div style={{ fontSize: 14, fontWeight: 500, color: "#4A453F" }}>{selectedBoard}</div></div>
                    <div><span style={{ fontSize: 12, color: "#6E675E" }}>备考科目</span><div style={{ fontSize: 14, fontWeight: 500, color: "#4A453F" }}>{selectedGroups.length} 个 Paper</div></div>
                    <div><span style={{ fontSize: 12, color: "#6E675E" }}>计划周期</span><div style={{ fontSize: 14, fontWeight: 500, color: "#4A453F" }}>{weeks.length} 周 · {totalTasks} 套试卷</div></div>
                  </div>
                </div>
              )}

              {pastPaperCatalogsLoading && selectedGroups.length > 0 ? (
                <div className={`${CARD_CLS} text-center py-15`}><p style={{ fontSize: 15, color: "#625C54", margin: 0 }}>正在加载已核验真题目录…</p></div>
              ) : weeks.length === 0 ? (
                <div className={`${CARD_CLS} text-center py-15`}>
                  <BookOpen size={32} style={{ color: "#716A61", marginBottom: 12 }} />
                  {selectedGroups.length === 0 ? (
                    <p style={{ fontSize: 15, color: "#625C54", margin: 0 }}>请先选择科目和 Paper</p>
                  ) : missingDateGroups.length > 0 ? (
                    <div>
                      <p style={{ fontSize: 15, color: "#A9471F", margin: "0 0 8px" }}>
                        以下 {missingDateGroups.length} 个 Paper 暂无考试日期，规划器无法生成计划
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                        {missingDateGroups.map(g => (
                          <span key={g.subjectCode + g.paperLabel} style={{ fontSize: 12, color: "#625C54", background: "#F0EDE8", padding: "2px 8px", borderRadius: 6 }}>
                            {g.subjectCode} {g.paperLabel}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : missingMaterialGroups.length > 0 ? (
                    <div><p style={{ fontSize: 15, color: "#725b3e", margin: "0 0 6px" }}>所选 Paper 暂无已核验真题</p><p style={{ fontSize: 12, lineHeight: 1.6, color: "#74695c", margin: 0 }}>规划器不会再生成虚拟年份名称。逐份官方链接通过审核后会自动进入计划。</p></div>
                  ) : (
                    <p style={{ fontSize: 15, color: "#625C54", margin: 0 }}>所有休息日被覆盖，无法生成计划</p>
                  )}
                </div>
              ) : (weeks.map(week => (
                <div key={week.weekNum} className={CARD_CLS}>
                  <div onClick={() => setCollapsedWeeks(prev => ({ ...prev, [week.weekNum]: !prev[week.weekNum] }))} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", paddingBottom: 8, borderBottom: "1px solid #F0EDE8" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#3D3832" }}>{week.weekLabel}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#6E675E" }}>{week.days.filter(d => !d.isRestDay && d.papers.length > 0).length} 天刷题 · {week.days.reduce((s, d) => s + d.papers.length, 0)} 套</span>
                      {collapsedWeeks[week.weekNum] ? <ChevronDown size={16} style={{ color: "#6E675E" }} /> : <ChevronUp size={16} style={{ color: "#6E675E" }} />}
                    </div>
                  </div>
                  {!collapsedWeeks[week.weekNum] && (<div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 8 }}>{week.days.map(day => <DayRow key={day.date} day={day} completedTasks={completedTasks} onToggleComplete={key => setCompletedTasks(p => ({ ...p, [key]: !p[key] }))} />)}</div>)}
                </div>
              )))}
              {!pastPaperCatalogsLoading && weeks.length > 0 && missingMaterialGroups.length > 0 && <div className={CARD_CLS} style={{ borderColor: "rgba(166,152,136,0.35)", background: "rgba(255,250,244,0.9)" }}><p style={{ fontSize: 13, fontWeight: 600, color: "#725b3e", margin: "0 0 6px" }}>部分 Paper 尚无已核验真题</p><p style={{ fontSize: 12, lineHeight: 1.6, color: "#74695c", margin: 0 }}>{missingMaterialGroups.map((group) => `${group.subjectCode} ${group.paperLabel}`).join("、")}。这些 Paper 暂不生成虚拟任务。</p></div>}
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
  if (day.isRestDay) return <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: "rgba(143,127,110,0.04)", borderRadius: 8 }}><span style={{ fontSize: 13, color: "#6E675E", width: 90, flexShrink: 0 }}>{day.dateLabel}</span><span style={{ fontSize: 13, color: "#625C54", fontStyle: "italic" }}>休息日</span></div>;
  if (day.isExamDay) return <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", background: "rgba(193,123,95,0.08)", borderRadius: 8, border: "1px solid rgba(193,123,95,0.15)" }}><span style={{ fontSize: 13, color: "#C17B5F", width: 90, flexShrink: 0, fontWeight: 600 }}>{day.dateLabel}</span><span style={{ fontSize: 13, color: "#C17B5F", fontWeight: 500 }}>考试日</span></div>;
  if (day.papers.length === 0) return <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: 8 }}><span style={{ fontSize: 13, color: "#6E675E", width: 90, flexShrink: 0 }}>{day.dateLabel}</span><span style={{ fontSize: 12, color: "#716A61" }}>—</span></div>;
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
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#675A4D" }}>{p.paperCode}</span>
                    <span style={{ fontSize: 12, color: "#4A453F", fontWeight: 500 }}>{p.pastPaper}</span>
                    {p.questionPaperUrl && <a href={p.questionPaperUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#486b58", fontSize: 11, fontWeight: 600, textDecoration: "none" }}><FileDown size={11} /> 试卷</a>}
                    {p.markSchemeUrl && <a href={p.markSchemeUrl} target="_blank" rel="noreferrer" style={{ color: "#5d6f64", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>评分标准</a>}
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
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: "rgba(143,127,110,0.1)", color: "#675A4D", fontWeight: 700 }}>{group.categoryLabel}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#3D3832", flex: 1 }}>{group.subjectName}</span>
              {selectedCount > 0 && <span style={{ fontSize: 10, color: "#675A4D", fontWeight: 600 }}>{selectedCount}/{group.units.length}</span>}
              {isCollapsed ? <ChevronDown size={14} style={{ color: "#6E675E" }} /> : <ChevronUp size={14} style={{ color: "#6E675E" }} />}
            </div>
            {/* Units list */}
            {!isCollapsed && (
              <div style={{ padding: "6px 0", background: "#FFF" }}>
                {group.units.map(unit => {
                  const isSelected = selectedGroups.some(g => g.subjectCode === unit.code);
                  const examSchedule = resolvePlannerGroupExamDate(selectedLevel, selectedBoard, unit.papers);
                  const examDate = examSchedule?.date ?? null;
                  const daysUntil = examDate ? differenceInDays(parseLocalDate(examDate), new Date()) : null;
                  return (
                    <div key={unit.code} onClick={() => onToggleUnit(unit.code, unit.papers)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", background: isSelected ? "rgba(143,127,110,0.04)" : "transparent", borderLeft: isSelected ? "3px solid #675A4D" : "3px solid transparent" }}>
                      {/* Checkbox */}
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: isSelected ? "none" : "1.5px solid #D9D4CE", background: isSelected ? "#675A4D" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isSelected && <Check size={12} color="#FFF" strokeWidth={3} />}
                      </div>
                      {/* Unit info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? "#3D3832" : "#4A453F" }}>{unit.code}</div>
                        <div style={{ fontSize: 11, color: "#6E675E" }}>{unit.name}</div>
                      </div>
                      {/* Exam date */}
                      <span style={{ fontSize: 10, color: (daysUntil ?? Infinity) < 30 ? "#C17B5F" : "#6E675E", flexShrink: 0 }}>
                        <ExamDateDisplay schedule={examSchedule} />
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
