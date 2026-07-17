import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  Calculator, Info, TrendingUp, Award,
  ArrowRight, AlertCircle, BookOpen, Calendar, CheckSquare, Square,
} from "lucide-react";
import {
  BOARD_META, BOARD_GRADE_CONFIG,
  getAvailableSeries, getRecordAt, getRecordAll, getRecordVariantCount, getVariantLabel, getMaxMark, getBoundaries,
  getComponentLabel,
  getSubjectsForBoard, getComponentsForSubject,
  formatSeries,
  type BoardMeta,
} from "../data/calculatorIndex";
import { CATEGORY_NAMES, type SubjectCategory } from "../data/examDates";
import { groupPapers, normalizeComponentDisplay } from "../utils/paperGroups";
import {
  runGradeCalculation,
  type PrecisionRating, type AStarCheck,
} from "../utils/gradeCalculation";
import { useCourseContext } from "../course-context/CourseContextProvider";
import AwardCalculatorPanel from "./grade-calculator/AwardCalculatorPanel";
import { COURSE_CATALOG, withCourseContext } from "../course-context/catalog";
import { awardCatalog } from "../domain-v2/awards/catalog";
import { decodeAwardShareState } from "../domain-v2/awards/share-state";

// ── Types ────────────────────────────────────────────────────────────
interface PaperConfig {
  component: string;
  series: string;
  score: string;
  label: string;
  selected: boolean;
  variantIndex: number; // P0: selected variant when multiple boundary rows exist
}

interface PaperResult {
  component: string;
  label: string;
  score: number;
  maxMark: number;
  series: string;
  percentage: number;
  pum?: number; // PUM percentage for CAIE
  syllabusVersion?: string; // e.g. "旧考纲(2024前)" or "新考纲(2025起)"
  // New fields from calculation engine
  normalizedScore: number;  // PUM (0-100) or UMS or GNS
  scoreType: "PUM" | "UMS" | "GNS" | "RAW";
  asA2Tag?: "AS" | "A2";   // AS/A2 classification for A-Level
  boundaries?: Record<string, number>; // grade thresholds (optional, for compatibility)
}

interface GradeBoundaryResult {
  gradeLabel: string;
  fieldKey: string;
  requiredTotal: number;
  achieved: boolean;
  gap: number;
}

interface CalculationResult {
  totalScore: number;
  maxTotal: number;
  percentage: number;
  predictedGrade: string | null;  // null = route invalid, no qualification grade
  gradeResults: GradeBoundaryResult[];
  papers: PaperResult[];
  nextGradeGap: number | null;
  completenessWarning?: string;
  avgPum?: number;
  aStarCheck: AStarCheck | null;
  precision: PrecisionRating;
  totalNormalized: number;
  maxNormalized: number;
  useUMS?: boolean;
  qualificationStatus: import("../utils/gradeCalculation").QualificationStatus;
}

// ── Board groups ─────────────────────────────────────────────────────
const BOARD_GROUPS = [
  { label: "已核验资格", options: [
    { key: "Edexcel-AL", name: "Edexcel IAL Mathematics", desc: "Raw → UMS · A*-E" },
  ]},
];

function sortSeriesNewestFirst(a: string, b: string): number {
  const yearA = parseInt(a.match(/\d{4}/)?.[0] ?? "0");
  const yearB = parseInt(b.match(/\d{4}/)?.[0] ?? "0");
  if (yearB !== yearA) return yearB - yearA;
  const order: Record<string, number> = { s: 3, june: 3, m: 2, march: 2, w: 1, november: 1 };
  const pa = a.split("-")[0].toLowerCase();
  const pb = b.split("-")[0].toLowerCase();
  return (order[pb] ?? 0) - (order[pa] ?? 0);
}

// ── Design System: Tailwind + shadcn constants ──────────────────────
const CARD_CLS = "rounded-2xl border border-[rgba(233,229,222,0.8)] bg-gradient-to-br from-[rgba(255,255,255,0.95)] to-[rgba(250,248,245,0.9)] p-6 shadow-[0_4px_24px_rgba(61,56,50,0.06),0_1px_3px_rgba(61,56,50,0.04)] backdrop-blur-xl";
const SELECT_CLS = "w-full cursor-pointer rounded-[10px] border border-[#D9D4CE] bg-white bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238B8378' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[right_12px_center] bg-no-repeat px-3.5 py-2.5 pr-9 text-sm text-[#3D3832] outline-none transition-all focus:border-[#A69888] focus:ring-2 focus:ring-[rgba(166,152,136,0.12)]";
const STEP_NUM = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#675A4D] to-[#A69888] text-sm font-bold text-white";

// ── Main Component ───────────────────────────────────────────────────
export default function GradeCalculator() {
  const { entry } = useCourseContext();
  const location = useLocation();
  const sharedCourse = useMemo(() => {
    const state = decodeAwardShareState(new URLSearchParams(location.search).get("award"));
    if (!state) return undefined;
    const route = awardCatalog.getAwardRoute(state.input.routeId);
    if (!route) return undefined;
    return COURSE_CATALOG.find(course => course.boardName === route.board && course.subjectCode === route.qualificationCode);
  }, [location.search]);
  const [selectedBoard, setSelectedBoard] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [paperConfigs, setPaperConfigs] = useState<PaperConfig[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const appliedCourse = useRef<string | null>(null);

  const meta: BoardMeta | null = selectedBoard ? BOARD_META[selectedBoard] : null;
  const gradeConfig = selectedBoard ? BOARD_GRADE_CONFIG[selectedBoard] : null;

  // ── Subjects ─────────────────────────────────────────────────────
  const subjects = useMemo(() => {
    if (!selectedBoard) return [];
    return getSubjectsForBoard(selectedBoard);
  }, [selectedBoard]);

  // ── Initialize paper configs ─────────────────────────────────────
  // All dependencies are stable module-level pure functions
  const initPapers = useCallback((boardKey: string, code: string) => {
    const comps = getComponentsForSubject(boardKey, code);
    return comps.map(comp => {
      const available = getAvailableSeries(boardKey, code, comp);
      return {
        component: comp,
        series: available.sort(sortSeriesNewestFirst)[0] || "",
        score: "",
        label: getComponentLabel(boardKey, code, comp),
        selected: false, // default all unselected
        variantIndex: 0,
      };
    });
  }, []);

  useEffect(() => {
    if (!entry || entry.capabilities.calculator.status !== "available" || !entry.calculatorBoardKey || appliedCourse.current === entry.qualificationId) return;
    setSelectedBoard(entry.calculatorBoardKey);
    setSelectedCode(entry.subjectCode);
    setPaperConfigs(initPapers(entry.calculatorBoardKey, entry.subjectCode));
    setResult(null);
    setErrors({});
    appliedCourse.current = entry.qualificationId;
  }, [entry, initPapers]);

  const handleSelectSubject = (code: string) => {
    if (!selectedBoard) return;
    setSelectedCode(code);
    setPaperConfigs(initPapers(selectedBoard, code));
    setResult(null);
    setErrors({});
  };

  // ── Update paper ─────────────────────────────────────────────────
  const updatePaper = (index: number, updates: Partial<PaperConfig>) => {
    setPaperConfigs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
    if (result) setResult(null);
  };

  // ── Toggle paper selection ───────────────────────────────────────
  const togglePaper = (index: number) => {
    setPaperConfigs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
    if (result) setResult(null);
  };

  // ── Select all / none ────────────────────────────────────────────
  const setAllSelected = (selected: boolean) => {
    setPaperConfigs(prev => prev.map(p => ({ ...p, selected })));
    if (result) setResult(null);
  };

  // ── Validate ─────────────────────────────────────────────────────
  const validateInputs = useCallback((): boolean => {
    if (!meta || !selectedCode) return false;
    const newErrors: Record<string, string> = {};
    let valid = true;

    paperConfigs.forEach((p, i) => {
      if (!p.selected) return; // skip unselected
      if (!p.series) {
        newErrors[`series-${i}`] = "请选择考试年份";
        valid = false;
      }
      if (p.score.trim() === "") {
        newErrors[`score-${i}`] = "请输入分数";
        valid = false;
        return;
      }
      const score = parseFloat(p.score);
      if (isNaN(score) || score < 0) {
        newErrors[`score-${i}`] = "分数不能为负数";
        valid = false;
        return;
      }
      const record = getRecordAt(selectedBoard, selectedCode, p.component, p.series, p.variantIndex);
      const maxMark = getMaxMark(record, meta);
      if (maxMark > 0 && score > maxMark) {
        newErrors[`score-${i}`] = `不能超过满分 ${maxMark}`;
        valid = false;
      }

      // P0-3/P1-5: Block calculation if selected series has unidentified conflicting variants
      // Identity key must be present AND unique across variants.
      if (p.series) {
        const variants = getRecordAll(selectedBoard, selectedCode, p.component, p.series);
        if (variants.length > 1) {
          const identityKeys = variants.map(v =>
            String(v._derived ?? v._tier ?? v._region ?? v._route ?? v._sourceRowId ?? "")
          );
          const hasIdentity = identityKeys.every(k => k.length > 0);
          const isUnique = new Set(identityKeys).size === identityKeys.length;
          if (!hasIdentity || !isUnique) {
            newErrors[`series-${i}`] = !hasIdentity
              ? "该考季数据存在冲突且无法区分，暂不可计算"
              : "该考季数据冲突标识重复，暂不可计算";
            valid = false;
          }
        }
      }
    });

    setErrors(newErrors);
    return valid;
  }, [meta, selectedBoard, selectedCode, paperConfigs]);

  // ── Get max mark ─────────────────────────────────────────────────
  const getPaperMaxMark = useCallback((component: string, series: string, variantIndex: number = 0): number => {
    if (!meta || !selectedCode) return 0;
    const record = getRecordAt(selectedBoard, selectedCode, component, series, variantIndex);
    return getMaxMark(record, meta);
  }, [meta, selectedBoard, selectedCode]);

  // ── Calculate ────────────────────────────────────────────────────
  const calculateGrade = useCallback(() => {
    if (!validateInputs() || !meta || !selectedCode || !gradeConfig) return;

    const selectedPapers = paperConfigs.filter(p => p.selected);
    if (selectedPapers.length === 0) return;

    const isAL = selectedBoard.includes("AL");
    const isCAIE = selectedBoard.startsWith("CAIE");

    // Build PaperInput[] for the engine
    // P0: Use variant-aware getRecordAt so users get the selected boundary row
    const engineInputs = selectedPapers.map(p => {
      const record = getRecordAt(selectedBoard, selectedCode, p.component, p.series, p.variantIndex);
      const maxMark = getMaxMark(record, meta);
      const boundaries = record ? getBoundaries(record, meta) : {};
      return {
        component: p.component,
        label: p.label,
        score: parseFloat(p.score) || 0,
        maxMark,
        series: p.series,
        boundaries,
      };
    });

    // Call the unified calculation engine
    const engineResult = runGradeCalculation({
      boardKey: selectedBoard,
      subjectCode: selectedCode,
      papers: engineInputs,
      useWeighting: true,
      targetGradeScale: gradeConfig.labels.join("/"),
      completenessCheck: getCompletenessWarning,
    });

    // Merge engine results into UI result type
    setResult({
      totalScore: engineResult.totalScore,
      maxTotal: engineResult.maxTotal,
      percentage: engineResult.percentage,
      predictedGrade: engineResult.predictedGrade,
      gradeResults: engineResult.gradeResults.map(gr => ({
        gradeLabel: gr.gradeLabel,
        fieldKey: gr.gradeLabel.toLowerCase().replace("*", "_star"),
        requiredTotal: gr.requiredTotal,
        achieved: gr.achieved,
        gap: gr.gap,
      })),
      papers: engineResult.papers.map(p => ({
        component: p.component,
        label: p.label,
        score: p.score,
        maxMark: p.maxMark,
        series: p.series,
        percentage: p.percentage,
        pum: p.scoreType === "PUM" ? p.normalizedScore : undefined,
        normalizedScore: p.normalizedScore,
        scoreType: p.scoreType,
        asA2Tag: p.asA2Tag,
        syllabusVersion: p.syllabusVersion,
      })),
      nextGradeGap: engineResult.nextGradeGap,
      completenessWarning: engineResult.completenessWarning,
      avgPum: engineResult.avgPum,
      aStarCheck: engineResult.aStarCheck,
      qualificationStatus: engineResult.qualificationStatus,
      precision: engineResult.precision,
      totalNormalized: engineResult.totalNormalized,
      maxNormalized: engineResult.maxNormalized,
      useUMS: isAL && !isCAIE,
    });
  }, [validateInputs, meta, selectedCode, gradeConfig, paperConfigs, selectedBoard]);

  // ── Count selected ───────────────────────────────────────────────
  const selectedCount = paperConfigs.filter(p => p.selected).length;
  const hasEmptyScore = paperConfigs.filter(p => p.selected).some(p => p.score === "");
  const awardCourseCandidate = sharedCourse ?? entry;
  const qualificationChoices = useMemo(() => {
    const supported = new Set(["AQA:7357", "OCR:H240", "OCR:6993", "CAIE:9709"]);
    return [...new Map(COURSE_CATALOG
      .filter((course) => supported.has(`${course.boardName}:${course.subjectCode}`) && course.gradeCalculation.status !== "unavailable")
      .map((course) => [`${course.boardName}:${course.subjectCode}`, course])).values()];
  }, []);
  const awardQualification = awardCourseCandidate && ["AQA:7357", "OCR:H240", "OCR:6993", "CAIE:9709"].includes(`${awardCourseCandidate.boardName}:${awardCourseCandidate.subjectCode}`) && awardCourseCandidate.gradeCalculation.status !== "unavailable"
    ? awardCourseCandidate
    : null;

  if (awardQualification) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#f0ede8] via-[#f5f2ee] to-[#f0ede8]">
        <Header title="等级预测" />
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
            <div className="mb-7">
              <div className="flex items-center gap-2.5">
                <Calculator size={24} className="text-[#675a4d]" />
                <h1 className="m-0 text-2xl font-bold text-[#3d3832]">等级预测</h1>
              </div>
              <p className="mb-0 mt-2 max-w-3xl text-sm leading-7 text-[#625c54]">
                官方模式使用考试局发布的整体资格分数线；预估模式仅在官方目标考季尚未发布且历史样本满足严格规则时提供，并始终明确标注为非官方预估。
              </p>
            </div>
            <AwardCalculatorPanel key={awardQualification.qualificationId} course={awardQualification} />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title="等级预测模拟器" />
      <main style={{ flex: 1 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px 48px" }}>

          {/* Intro */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Calculator size={24} style={{ color: "#675A4D" }} />
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#3D3832", margin: 0 }}>等级预测模拟器</h1>
            </div>
            <p style={{ fontSize: 14, color: "#625C54", lineHeight: 1.7, margin: 0 }}>
                请先选择资格路线。只对具备完整路线与来源状态的数据计算；未核验或缺少路线的课程保持不可用。
            </p>
          </div>

          {!entry && !sharedCourse && (
            <section className={`${CARD_CLS} mb-5`} aria-labelledby="qualification-route-heading">
              <h2 id="qualification-route-heading" style={{ margin: "0 0 6px", fontSize: 16, color: "#3D3832" }}>选择资格路线</h2>
              <p style={{ margin: "0 0 14px", fontSize: 12, lineHeight: 1.6, color: "#6E675E" }}>官方整体边界路线会进入资格计算器；Edexcel IAL Mathematics 可继续使用下方 Raw → UMS 单元路线。</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: 10 }}>
                {qualificationChoices.map((course) => (
                  <Link key={course.qualificationId} to={withCourseContext("/calculator", { qualificationId: course.qualificationId, specificationId: course.specificationId })}
                    style={{ border: "1px solid #d9d4ce", borderRadius: 10, padding: "12px 14px", background: "#fff", color: "#3D3832", textDecoration: "none" }}>
                    <strong style={{ display: "block", fontSize: 13 }}>{course.boardName} · {course.subjectCode}</strong>
                    <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "#6E675E" }}>{course.subjectName} · {course.gradeCalculation.status === "official" ? "官方路线" : "明确标注的预估路线"}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Step 1: Board */}
          <div className={CARD_CLS}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div className={STEP_NUM}>1</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "#3D3832", margin: 0 }}>选择考试局</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {BOARD_GROUPS.map(group => (
                <div key={group.label}>
                  <label style={{ fontSize: 12, color: "#6E675E", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", display: "block", marginBottom: 10 }}>{group.label}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {group.options.map(opt => (
                      <button key={opt.key} onClick={() => {
                        if (selectedBoard === opt.key) return;
                        setSelectedBoard(opt.key); setSelectedCode(""); setPaperConfigs([]); setResult(null); setErrors({});
                      }} style={{
                        padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 500,
                        border: selectedBoard === opt.key ? "1px solid #675A4D" : "1px solid #D9D4CE",
                        background: selectedBoard === opt.key ? "linear-gradient(135deg, rgba(143,127,110,0.12), rgba(143,127,110,0.04))" : "#FFF",
                        color: selectedBoard === opt.key ? "#675A4D" : "#625C54", cursor: "pointer", transition: "all 0.2s ease",
                        display: "flex", alignItems: "center", gap: 6,
                      }}>
                        <span>{opt.name}</span><span style={{ fontSize: 11, color: "#4A453F" }}>({opt.desc})</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Subject */}
          {selectedBoard && (
            <div className={`${CARD_CLS} mt-5`}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div className={STEP_NUM}>2</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#3D3832", margin: 0 }}>选择科目</h3>
              </div>
              <div style={{ position: "relative", maxWidth: 480 }}>
                <BookOpen size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#6E675E", pointerEvents: "none" }} />
                <select aria-label="选择科目" value={selectedCode} onChange={e => handleSelectSubject(e.target.value)} className={SELECT_CLS}>
                  <option value="">请选择科目...</option>
                  {/* Group by category */}
                  {(() => {
                    const grouped: Record<string, typeof subjects> = {};
                    subjects.forEach(s => {
                      const cat = (s as unknown as { category: SubjectCategory }).category || "other";
                      if (!grouped[cat]) grouped[cat] = [];
                      grouped[cat].push(s);
                    });
                    const catOrder = ["math", "physics", "chemistry", "economics", "biology", "cs", "other"];
                    return catOrder.map(cat => {
                      const items = grouped[cat];
                      if (!items || items.length === 0) return null;
                      return (
                        <optgroup key={cat} label={CATEGORY_NAMES[cat as SubjectCategory] || cat}>
                          {items.map(s => (
                            <option key={s.code} value={s.code}>{s.code} &mdash; {s.name}</option>
                          ))}
                        </optgroup>
                      );
                    });
                  })()}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Paper Selection & Input */}
          {selectedCode && paperConfigs.length > 0 && (
            <div className={`${CARD_CLS} mt-5`}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div className={STEP_NUM}>3</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#3D3832", margin: 0 }}>选择 Paper 并输入分数</h3>
                <span style={{ fontSize: 12, color: "#6E675E", marginLeft: "auto" }}>
                  已选 {selectedCount} / {paperConfigs.length} 个 Paper
                </span>
              </div>

              {/* Select all / none */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #E9E5DE" }}>
                <button onClick={() => setAllSelected(true)} style={{ fontSize: 12, color: "#675A4D", background: "none", border: "none", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckSquare size={14} /> 全选
                </button>
                <button onClick={() => setAllSelected(false)} style={{ fontSize: 12, color: "#6E675E", background: "none", border: "none", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                  <Square size={14} /> 全不选
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(() => {
                  // Group paperConfigs by paper number
                  const groups = groupPapers(
                    paperConfigs.map(p => ({ code: `${selectedCode}/${p.component}`, component: p.component })),
                    selectedBoard.split("-")[0],
                    selectedBoard.includes("AL") ? "A-Level" : "GCSE",
                    selectedCode,
                  );
                  return groups.map(group => {
                    const groupKey = `${selectedCode}_${group.paperNum}`;
                    const isCollapsed = collapsedGroups[groupKey] === undefined ? true : collapsedGroups[groupKey]; // default collapsed
                    // Find indices in paperConfigs for this group's papers
                    const groupPaperIndices = paperConfigs
                      .map((p, idx) => ({ ...p, idx }))
                      .filter(p => group.papers.some(gp => gp.component === p.component));
                    const selectedInGroup = groupPaperIndices.filter(p => p.selected).length;
                    return (
                      <div key={groupKey} style={{ border: "1px solid #E9E5DE", borderRadius: 12, overflow: "hidden", background: "#FFF" }}>
                        {/* Paper group header - clickable to expand */}
                        <button type="button" aria-expanded={!isCollapsed} onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                          style={{
                            display: "flex", width: "100%", border: 0, textAlign: "left", alignItems: "center", gap: 10, padding: "12px 16px",
                            cursor: "pointer", background: selectedInGroup > 0 ? "rgba(143,127,110,0.04)" : "#FAFAF8",
                            borderBottom: isCollapsed ? "none" : "1px solid #F0EDE8",
                          }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#3D3832", flex: 1 }}>{group.label}</span>
                          {group.description && <span style={{ fontSize: 11, color: "#6E675E" }}>{group.description}</span>}
                          <span style={{ fontSize: 11, color: selectedInGroup > 0 ? "#675A4D" : "#6E675E", fontWeight: 500 }}>
                            {selectedInGroup > 0 ? `${selectedInGroup}/${group.papers.length}` : `${group.papers.length}个`}
                          </span>
                          <span style={{ fontSize: 12, color: "#6E675E" }}>{isCollapsed ? "▼" : "▲"}</span>
                        </button>
                        {/* Variants inside group */}
                        {!isCollapsed && (
                          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                            {groupPaperIndices.map(p => {
                              const i = p.idx;
                              const maxMark = getPaperMaxMark(p.component, p.series, p.variantIndex);
                              const availableSeries = getAvailableSeries(selectedBoard, selectedCode, p.component);
                              const variantCount = p.series ? getRecordVariantCount(selectedBoard, selectedCode, p.component, p.series) : 1;
                              return (
                                <div key={p.component} style={{
                                  padding: 12, borderRadius: 10,
                                  background: p.selected ? "rgba(255,255,255,0.7)" : "rgba(245,242,238,0.5)",
                                  border: p.selected ? "1px solid #E9E5DE" : "1px solid transparent",
                                  opacity: p.selected ? 1 : 0.6, transition: "all 0.2s ease",
                                }}>
                                  {/* Variant checkbox + label */}
                                  <button type="button" aria-pressed={p.selected} style={{ display: "flex", width: "100%", border: 0, background: "transparent", padding: 0, textAlign: "left", alignItems: "center", gap: 10, marginBottom: p.selected ? 10 : 0, cursor: "pointer" }}
                                    onClick={() => togglePaper(i)}>
                                    {p.selected ?
                                      <CheckSquare size={16} style={{ color: "#675A4D", flexShrink: 0 }} /> :
                                      <Square size={16} style={{ color: "#716A61", flexShrink: 0 }} />
                                    }
                                    <span style={{ fontSize: 13, fontWeight: 600, color: p.selected ? "#3D3832" : "#6E675E" }}>{normalizeComponentDisplay(p.component)}</span>
                                    {!p.selected && <span style={{ fontSize: 11, color: "#716A61", marginLeft: "auto" }}>未选择</span>}
                                  </button>
                                  {/* Inputs */}
                                  {p.selected && (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10, alignItems: "flex-start", paddingLeft: 26 }}>
                                      <div>
                                        <label style={{ fontSize: 11, color: "#625C54", fontWeight: 500, display: "block", marginBottom: 4 }}>
                                          <Calendar size={10} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} />考试年份
                                        </label>
                                        <select aria-label={`${normalizeComponentDisplay(p.component)} 考试年份`} value={p.series} onChange={e => updatePaper(i, { series: e.target.value, variantIndex: 0 })} className="w-full cursor-pointer rounded-lg border border-[#D9D4CE] bg-white px-2.5 py-1.5 text-[13px] text-[#3D3832] outline-none">
                                          {availableSeries.sort(sortSeriesNewestFirst).map(s => (
                                            <option key={s} value={s}>{formatSeries(s)}</option>
                                          ))}
                                        </select>
                                        {/* P0: Variant selector when multiple boundary rows exist */}
                                        {variantCount > 1 && meta && (() => {
                                          const variants = getRecordAll(selectedBoard, selectedCode, p.component, p.series);
                                          // P0-4: Check if variants have business identity (derived, tier, region, etc.)
                                          const hasIdentity = variants.some(v =>
                                            v._derived || v._tier || v._region || v._route || v._sourceRowId
                                          );
                                          if (!hasIdentity && variantCount > 1) {
                                            // Unidentified conflicting variants — don't let user guess
                                            return (
                                              <span style={{ color: "#C17B5F", fontSize: 11, marginTop: 2, display: "block" }}>
                                                ⚠️ 该考季存在 {variantCount} 组边界数据冲突，身份标识缺失，暂不可选择。请等待数据核验。
                                              </span>
                                            );
                                          }
                                          return (
                                            <div style={{ marginTop: 4 }}>
                                              <label style={{ fontSize: 11, color: "#625C54", fontWeight: 500, display: "block", marginBottom: 2 }}>
                                                分数线方案
                                              </label>
                                              <select aria-label={`${normalizeComponentDisplay(p.component)} 分数线方案`}
                                                value={p.variantIndex}
                                                onChange={e => updatePaper(i, { variantIndex: parseInt(e.target.value) })}
                                                className="w-full cursor-pointer rounded-lg border border-[#D9D4CE] bg-white px-2.5 py-1 text-[12px] text-[#3D3832] outline-none"
                                              >
                                                {variants.map((v, idx) => (
                                                  <option key={idx} value={idx}>
                                                    {getVariantLabel(v, meta, idx)}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          );
                                        })()}
                                        {errors[`series-${i}`] && <span style={{ color: "#C17B5F", fontSize: 11, marginTop: 2, display: "block" }}>{errors[`series-${i}`]}</span>}
                                      </div>
                                      <div>
                                        <label style={{ fontSize: 11, color: "#625C54", fontWeight: 500, display: "block", marginBottom: 4 }}>
                                          分数 {maxMark > 0 && <span style={{ color: "#6E675E" }}>/ {maxMark}</span>}
                                        </label>
                                        <input aria-label={`${normalizeComponentDisplay(p.component)} 分数`} type="number" min={0} max={maxMark || undefined} step="0.5" value={p.score}
                                          onChange={e => { updatePaper(i, { score: e.target.value }); if (errors[`score-${i}`]) { setErrors(prev => { const n = { ...prev }; delete n[`score-${i}`]; return n; }); } }}
                                          placeholder={`0${maxMark ? ` - ${maxMark}` : ""}`}
                                          className="w-full rounded-lg border bg-white px-2.5 py-1.5 text-[13px] text-[#3D3832] outline-none" style={{ borderColor: errors[`score-${i}`] ? "#C17B5F" : "#D9D4CE" }} />
                                        {errors[`score-${i}`] && <span style={{ color: "#C17B5F", fontSize: 11, marginTop: 2, display: "block" }}>{errors[`score-${i}`]}</span>}
                                      </div>
                                    </div>
                                  )}
                                  {/* Boundaries preview */}
                                  {p.selected && p.series && meta && (
                                    <ComponentBoundariesPreview boardKey={selectedBoard} subjectCode={selectedCode} component={p.component} series={p.series} meta={meta} variantIndex={p.variantIndex} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Calculate button */}
              <button onClick={calculateGrade} disabled={selectedCount === 0 || hasEmptyScore} style={{
                marginTop: 24, width: "100%", padding: "14px 24px", borderRadius: 10,
                background: selectedCount === 0 || hasEmptyScore ? "#716A61" : "linear-gradient(135deg, #675A4D, #A69888)",
                color: "#FFF", fontSize: 16, fontWeight: 600, border: "none",
                cursor: selectedCount === 0 || hasEmptyScore ? "not-allowed" : "pointer",
                transition: "all 0.3s ease", letterSpacing: "0.02em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <TrendingUp size={18} /> 预测等级
              </button>
            </div>
          )}

          {/* Step 4: Results */}
          {result && (
            <div style={{ marginTop: 24 }}>
              {/* Completeness Warning */}
              {result.completenessWarning && (
                <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 12, background: "rgba(193,123,95,0.08)", border: "1px solid rgba(193,123,95,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertCircle size={18} style={{ color: "#C17B5F", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: "#8B5E3C", fontWeight: 500 }}>{result.completenessWarning}</span>
                </div>
              )}

              {/* Precision Rating */}
              <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 10, background: "rgba(107,143,94,0.08)", border: "1px solid rgba(107,143,94,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, color: "#6B8F5E", fontWeight: 600 }}>{result.precision.stars}</span>
                <span style={{ fontSize: 13, color: "#5A7A4E" }}>{result.precision.description}</span>
              </div>

              {/* Main Result Card */}
              <div style={{ padding: 32, borderRadius: 16, background: result.predictedGrade ? "linear-gradient(135deg, #675A4D, #A69888)" : "linear-gradient(135deg, #B8A99A, #C9B8A8)", color: "#FFF", textAlign: "center", boxShadow: "0 8px 32px rgba(143,127,110,0.25)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
                  <Award size={28} /><span style={{ fontSize: 18, fontWeight: 600, opacity: 0.9 }}>
                    {result.predictedGrade ? "预测等级" : "单元 UMS 汇总"}
                  </span>
                </div>
                {result.predictedGrade ? (
                  <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "0.05em", margin: "8px 0" }}>{result.predictedGrade}</div>
                ) : (
                  <div style={{ fontSize: 18, fontWeight: 600, margin: "16px 0", padding: "12px 24px", borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "inline-block" }}>
                    {result.qualificationStatus.reason || "不可评定资格等级"}
                    {result.qualificationStatus.missing && result.qualificationStatus.missing.length > 0 && (
                      <div style={{ fontSize: 13, marginTop: 6, opacity: 0.85 }}>
                        缺少: {result.qualificationStatus.missing.join(", ")}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 16, opacity: 0.85 }}>总分 {result.totalScore} / {result.maxTotal} &nbsp;&middot;&nbsp; {result.percentage}%</div>
                {/* Normalized score display */}
                <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
                  {result.useUMS ? (
                    <>UMS 总分: {result.totalNormalized} / {result.maxNormalized}</>
                  ) : (
                    <>PUM 均分: {result.totalNormalized.toFixed(1)} / 100</>
                  )}
                </div>
                {/* PUM display for CAIE */}
                {result.avgPum !== undefined && (
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.7 }}>
                    (CAIE PUM 平均值: {result.avgPum})
                  </div>
                )}
                {result.nextGradeGap !== null && result.nextGradeGap > 0 && (
                  <div style={{ marginTop: 16, padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500 }}>
                    <ArrowRight size={16} />距离下一等级还需 {result.nextGradeGap} 分
                  </div>
                )}
                {result.nextGradeGap === null && (
                  <div style={{ marginTop: 16, padding: "10px 20px", borderRadius: 8, background: "rgba(255,255,255,0.15)", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500 }}>
                    <Award size={16} />已达到最高预测等级
                  </div>
                )}
              </div>

              {/* A* Check Details (A-Level only) */}
              {result.aStarCheck && (
                <div className={`${CARD_CLS} mt-5`} style={{ borderLeft: result.aStarCheck.eligible ? "4px solid #6B8F5E" : "4px solid #C9A87C" }}>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
                    <Award size={16} /> A* 条件检查
                    {result.aStarCheck.eligible && <span style={{ marginLeft: 8, padding: "2px 10px", borderRadius: 6, background: "linear-gradient(135deg, #6B8F5E, #8AAF7E)", color: "#FFF", fontSize: 12, fontWeight: 600 }}>满足 A* ✅</span>}
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.aStarCheck.details.map((detail, i) => (
                      <div key={i} style={{ fontSize: 13, color: detail.includes("✅") ? "#4A7A3E" : detail.includes("❌") ? "#8B5E3C" : "#5A554F", padding: "6px 10px", background: "rgba(166,152,136,0.06)", borderRadius: 8 }}>
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paper Breakdown */}
              <div className={`${CARD_CLS} mt-5`}>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Info size={16} /> 各 Paper 得分明细
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.papers.map((paper, idx) => (
                    <div key={idx} style={{ padding: "12px 14px", background: "rgba(166,152,136,0.06)", borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, color: "#4A453F", fontWeight: 500 }}>{paper.label}</span>
                            {paper.asA2Tag && (
                              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: paper.asA2Tag === "A2" ? "rgba(148,168,184,0.15)" : "rgba(154,175,158,0.15)", color: paper.asA2Tag === "A2" ? "#7A8FA0" : "#6A8A6E", fontWeight: 600 }}>
                                {paper.asA2Tag}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "#6E675E" }}>{formatSeries(paper.series)}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                          <div style={{ width: 80, height: 8, background: "#E8E4DE", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: `${paper.maxMark > 0 ? (paper.score / paper.maxMark) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg, #675A4D, #A69888)", borderRadius: 4, transition: "width 0.5s ease" }} />
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#3D3832", minWidth: 80, textAlign: "right" }}>{paper.score} / {paper.maxMark}</span>
                          <span style={{ fontSize: 12, color: "#625C54", minWidth: 48, textAlign: "right" }}>{Math.round(paper.percentage)}%</span>
                        </div>
                      </div>
                      {/* Normalized score + Syllabus version row */}
                      <div style={{ display: "flex", gap: 10, marginTop: 6, paddingLeft: 0, flexWrap: "wrap" }}>
                        {paper.syllabusVersion && (
                          <span style={{ fontSize: 11, color: "#C17B5F", background: "rgba(193,123,95,0.08)", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>
                            {paper.syllabusVersion}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: paper.scoreType === "PUM" ? "#6B8F5E" : paper.scoreType === "UMS" ? "#435F7A" : "#675A4D", background: paper.scoreType === "PUM" ? "rgba(107,143,94,0.08)" : paper.scoreType === "UMS" ? "rgba(90,122,160,0.08)" : "rgba(143,127,110,0.08)", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>
                          {paper.scoreType}: {paper.normalizedScore}{paper.scoreType === "UMS" ? "" : "%"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grade Boundaries */}
              <div className={`${CARD_CLS} mt-5`}>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: "#3D3832", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={16} /> 等级分数线参考
                </h4>
                {selectedBoard.includes("GCSE") && !selectedBoard.includes("CAIE") && (
                  <div style={{ fontSize: 12, color: "#C17B5F", background: "rgba(193,123,95,0.08)", padding: "8px 12px", borderRadius: 8, margin: "0 0 12px", border: "1px solid rgba(193,123,95,0.2)" }}>
                    9-1 等级为近似参考，实际 grade boundaries 每年浮动，请以官方 PDF 为准。
                  </div>
                )}
                <p style={{ fontSize: 12, color: "#6E675E", margin: "0 0 16px" }}>基于所选年份各 Paper 的 component 分数线累加估算</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "linear-gradient(135deg, #ECE7E0, #E8E4DE)" }}>
                        <th style={{ padding: "10px 14px", fontSize: 12, color: "#7A6E5F", fontWeight: 600, textAlign: "left" }}>等级</th>
                        <th style={{ padding: "10px 14px", fontSize: 12, color: "#7A6E5F", fontWeight: 600, textAlign: "center" }}>所需总分</th>
                        <th style={{ padding: "10px 14px", fontSize: 12, color: "#7A6E5F", fontWeight: 600, textAlign: "center" }}>你的差距</th>
                        <th style={{ padding: "10px 14px", fontSize: 12, color: "#7A6E5F", fontWeight: 600, textAlign: "center" }}>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.gradeResults.map((gr, i) => (
                        <tr key={i} style={{
                          backgroundColor: gr.achieved ? "rgba(143,127,110,0.08)" : i % 2 === 0 ? "rgba(255,255,255,0.6)" : "rgba(245,242,238,0.4)",
                          borderBottom: "1px solid #E8E4DE", fontWeight: gr.achieved ? 600 : 400,
                        }}>
                          <td style={{ padding: "10px 14px", fontSize: 14, color: "#3D3832" }}>
                            {gr.gradeLabel}
                            {result.predictedGrade && gr.gradeLabel === result.predictedGrade && (
                              <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 6, background: "linear-gradient(135deg, #675A4D, #A69888)", color: "#FFF", fontSize: 11, fontWeight: 600 }}>预测</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 14, textAlign: "center", color: gr.requiredTotal > 0 ? "#4A453F" : "#6E675E" }}>{gr.requiredTotal > 0 ? gr.requiredTotal : "—"}</td>
                          <td style={{ padding: "10px 14px", fontSize: 14, textAlign: "center", color: gr.gap > 0 ? "#6B8F5E" : gr.gap < 0 ? "#C17B5F" : "#6E675E", fontWeight: 500 }}>
                            {gr.requiredTotal > 0 ? (gr.gap >= 0 ? `+${gr.gap}` : gr.gap) : "—"}
                          </td>
                          <td style={{ padding: "10px 14px", fontSize: 13, textAlign: "center" }}>
                            {gr.requiredTotal > 0 ? (gr.achieved ? <span style={{ color: "#6B8F5E", fontWeight: 600 }}>✓ 已达到</span> : <span style={{ color: "#6E675E" }}>未达到</span>) : <span style={{ color: "#716A61" }}>无数据</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Improvement tips */}
                {result.nextGradeGap !== null && result.nextGradeGap > 0 && result.papers.length > 0 && (
                  <ImprovementTips papers={result.papers} nextGradeGap={result.nextGradeGap} gradeResults={result.gradeResults} />
                )}
              </div>
            </div>
          )}

          {selectedCode && paperConfigs.length === 0 && (
            <div className={`${CARD_CLS} mt-5 text-center py-10`}>
              <AlertCircle size={32} style={{ color: "#716A61", marginBottom: 12 }} />
              <p style={{ fontSize: 15, color: "#625C54", margin: 0 }}>该科目暂无 component 配置数据</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function ComponentBoundariesPreview({ boardKey, subjectCode, component, series, meta, variantIndex = 0 }: {
  boardKey: string; subjectCode: string; component: string; series: string; meta: BoardMeta; variantIndex?: number;
}) {
  const record = getRecordAt(boardKey, subjectCode, component, series, variantIndex);
  if (!record) return null;
  const boundaries = getBoundaries(record, meta);
  const entries = Object.entries(boundaries).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: 10, marginLeft: 28, padding: "8px 12px", background: "rgba(143,127,110,0.04)", borderRadius: 8 }}>
      <span style={{ fontSize: 11, color: "#6E675E", fontWeight: 500 }}>该年份分数线：</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 4 }}>
        {entries.map(([grade, threshold]) => (
          <span key={grade} style={{ fontSize: 12, color: "#625C54" }}>
            <span style={{ fontWeight: 600, color: "#6B5E4F" }}>{grade.toUpperCase()}</span>: {threshold}
          </span>
        ))}
      </div>
    </div>
  );
}

// calculatePUM is now imported from ../utils/gradeCalculation (calculateCAIEPUM)
// detectSyllabusVersion is now imported from ../utils/gradeCalculation

/** Check if the selected papers form a complete assessment */
function getCompletenessWarning(boardKey: string, subjectCode: string, selectedComponents: string[]): string | undefined {
  // CAIE 9709: needs P1 + P3 + 2 applied for A-Level, or P1 + 1 applied for AS
  if (boardKey === "CAIE-AL" && subjectCode === "9709") {
    const hasP1 = selectedComponents.some(c => c.startsWith("1"));
    const hasP3 = selectedComponents.some(c => c.startsWith("3"));
    const appliedCount = selectedComponents.filter(c => c.startsWith("4") || c.startsWith("5") || c.startsWith("6")).length;
    if (!hasP1) return "缺少 Pure Mathematics 1 (P1)，AS/A-Level 必修";
    if (appliedCount < 1) return "AS Level 至少需 P1 + 1个 applied paper";
    if (!hasP3) return "缺少 Pure Mathematics 3 (P3)，A-Level 必修";
    if (appliedCount < 2) return "A-Level 需至少 2 个 applied papers (M1/S1/S2等)";
    return undefined;
  }
  // CAIE 0580 Extended: needs Paper 2 + Paper 4
  if (boardKey === "CAIE-GCSE" && subjectCode === "0580") {
    const hasP2 = selectedComponents.some(c => c.startsWith("2"));
    const hasP4 = selectedComponents.some(c => c.startsWith("4"));
    if (!hasP2) return "Extended 需 Paper 2";
    if (!hasP4) return "Extended 需 Paper 4";
    return undefined;
  }
  // CAIE 0606: needs both Paper 1 + Paper 2
  if (boardKey === "CAIE-GCSE" && subjectCode === "0606") {
    const hasP1 = selectedComponents.some(c => c.startsWith("1"));
    const hasP2 = selectedComponents.some(c => c.startsWith("2"));
    if (!hasP1) return "需 Paper 1";
    if (!hasP2) return "需 Paper 2";
    return undefined;
  }
  return undefined;
}

function ImprovementTips({ papers, nextGradeGap, gradeResults }: {
  papers: PaperResult[]; nextGradeGap: number; gradeResults: GradeBoundaryResult[];
}) {
  const paperGains = papers.map(p => ({ ...p, potentialGain: p.maxMark - p.score, efficiency: p.maxMark > 0 ? (p.maxMark - p.score) / p.maxMark : 0 }));
  const sorted = [...paperGains].sort((a, b) => b.efficiency - a.efficiency);
  const topPapers = sorted.filter(p => p.potentialGain > 0).slice(0, 3);
  if (topPapers.length === 0) return null;
  const nextGrade = gradeResults.find(gr => !gr.achieved && gr.requiredTotal > 0);
  return (
    <div style={{ marginTop: 20, padding: 18, borderRadius: 12, background: "rgba(193,123,95,0.06)", border: "1px solid rgba(193,123,95,0.15)" }}>
      <h5 style={{ fontSize: 14, fontWeight: 600, color: "#8B5E3C", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
        <TrendingUp size={16} />
        提分建议
        {nextGrade && <span style={{ fontWeight: 400, fontSize: 13, color: "#A89080" }}>（距离 {nextGrade.gradeLabel} 还需 {nextGradeGap} 分）</span>}
      </h5>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {topPapers.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.6)", borderRadius: 8 }}>
            <div>
              <span style={{ fontSize: 13, color: "#4A453F", fontWeight: 500 }}>{p.label}</span>
              <span style={{ fontSize: 11, color: "#6E675E", marginLeft: 8 }}>当前 {p.score}/{p.maxMark} ({Math.round(p.percentage)}%)</span>
            </div>
            <span style={{ fontSize: 13, color: "#8B5E3C", fontWeight: 600 }}>可提 {Math.round(p.potentialGain * 10) / 10} 分</span>
          </div>
        ))}
      </div>
    </div>
  );
}
