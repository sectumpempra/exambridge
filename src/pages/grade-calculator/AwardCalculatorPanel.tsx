import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { CourseContextEntry } from "@/course-context/types";
import { awardCatalog as defaultAwardCatalog } from "@/domain-v2/awards/catalog";
import { calculateEstimatedAward } from "@/domain-v2/awards/estimate-engine";
import {
  AwardCalculationError,
  calculateOfficialAward,
  componentVariantsForRoute,
  type AwardCatalog,
  type AwardErrorCode,
} from "@/domain-v2/awards/official-engine";
import type {
  AwardCalculationResult,
  AwardCalculationInput,
  EstimatedAwardBoundary,
  OfficialAwardBoundary,
  OfficialAwardRoute,
} from "@/domain-v2/awards/schema";
import {
  decodeAwardShareState,
  encodeAwardShareState,
  getAwardShareParam,
  readStoredAwardShare,
  resolveSharedAward,
  withAwardShareParam,
  writeStoredAwardShare,
  type AwardShareState,
} from "@/domain-v2/awards/share-state";
import AwardResultCard from "./AwardResultCard";
import { exportAwardCsv, exportAwardExcel } from "./exportAwardResult";

type AwardScoreInput = AwardCalculationInput["scores"][number];

export const PUBLIC_AWARD_ERRORS: Record<AwardErrorCode, string> = {
  INVALID_INPUT: "输入内容不完整，请检查路线、考季和分数。",
  UNKNOWN_ROUTE: "无法识别该资格路线，请重新选择。",
  UNSUPPORTED_ROUTE: "该资格路线目前不支持等级计算。",
  INCOMPLETE_ROUTE: "请填写该资格路线要求的全部 Paper。",
  DUPLICATE_COMPONENT: "同一 Paper 不能重复提交。",
  UNKNOWN_COMPONENT: "所选 Paper 不属于当前资格路线。",
  CROSS_SERIES: "所有 Paper 必须属于所选考季。",
  SCORE_OUT_OF_RANGE: "分数必须是满分范围内的整数。",
  OPTION_MISMATCH: "Option code 与所选资格路线不一致。",
  VARIANT_MISMATCH: "Paper 变体与所选资格路线不一致。",
  MISSING_BOUNDARY: "该考季没有可用的官方整体分数线。",
  MISSING_ESTIMATE: "该考季没有满足严格样本规则的预估分数线。",
  ESTIMATE_CONSENT_REQUIRED: "请先确认你理解这是非官方预估。",
  CARRY_FORWARD_REQUIRED: "该路线需要输入官方结转分数。",
  INTERNAL_ERROR: "暂时无法完成计算，请稍后重试。",
};

export type AwardSeriesOption = { id: string; label: string; source: "official" | "estimated" };
export type AwardRouteOption = { id: string; label: string; level: string; optionCode?: string };
export type AwardCalculatorViewModel = {
  mode: "official" | "estimated" | "unavailable";
  requiresConsent: boolean;
  selectedSeries?: string;
  routeOptions: AwardRouteOption[];
  seriesOptions: AwardSeriesOption[];
};

const seriesRank = (series: string) => {
  const [year, season] = series.split("-");
  return Number(year) * 10 + ({ march: 1, june: 2, november: 3 }[season] ?? 0);
};

const getLocalStorage = (): Storage | undefined => {
  try { return typeof window === "undefined" ? undefined : window.localStorage; } catch { return undefined; }
};

function listSeries(catalog: AwardCatalog, routeIds: string[]): AwardSeriesOption[] {
  const bySeries = new Map<string, AwardSeriesOption>();
  for (const boundary of catalog.officialBoundaries) {
    if (routeIds.includes(boundary.routeId)) bySeries.set(boundary.series, { id: boundary.series, label: `${boundary.series} · 官方`, source: "official" });
  }
  for (const boundary of catalog.estimatedBoundaries) {
    if (routeIds.includes(boundary.routeId) && !bySeries.has(boundary.targetSeries)) {
      bySeries.set(boundary.targetSeries, { id: boundary.targetSeries, label: `${boundary.targetSeries} · 非官方预估`, source: "estimated" });
    }
  }
  return [...bySeries.values()].sort((a, b) => {
    if (a.source !== b.source) return a.source === "official" ? -1 : 1;
    return seriesRank(b.id) - seriesRank(a.id);
  });
}

export function buildAwardCalculatorViewModel(
  entry: CourseContextEntry,
  catalog: AwardCatalog,
  selectedSeries?: string,
): AwardCalculatorViewModel {
  if (entry.gradeCalculation.status === "unavailable") {
    return { mode: "unavailable", requiresConsent: false, routeOptions: [], seriesOptions: [] };
  }
  const routes = catalog.listAwardRoutes(entry.subjectCode)
    .filter(route => entry.gradeCalculation.status !== "unavailable" && entry.gradeCalculation.routeIds.includes(route.id));
  if (routes.length === 0) return { mode: "unavailable", requiresConsent: false, routeOptions: [], seriesOptions: [] };
  const routeOptions = routes.map(route => ({
    id: route.id,
    label: `${route.level} · ${route.optionCode ?? route.routeKey}`,
    level: route.level,
    ...(route.optionCode ? { optionCode: route.optionCode } : {}),
  }));
  const seriesOptions = listSeries(catalog, routes.map(route => route.id));
  const resolvedSeries = seriesOptions.some(option => option.id === selectedSeries) ? selectedSeries : seriesOptions[0]?.id;
  const source = seriesOptions.find(option => option.id === resolvedSeries)?.source;
  if (!source) return { mode: "unavailable", requiresConsent: false, routeOptions, seriesOptions };
  return {
    mode: source,
    requiresConsent: source === "estimated",
    selectedSeries: resolvedSeries,
    routeOptions,
    seriesOptions,
  };
}

export type CalculatedState = {
  result: AwardCalculationResult;
  route: OfficialAwardRoute;
  scores: AwardScoreInput[];
  boundary: OfficialAwardBoundary | EstimatedAwardBoundary;
};

export type AwardInteractionState = {
  scores: Record<string, string>;
  consent: boolean;
  error: string | null;
  calculated: CalculatedState | null;
  notice: string | null;
};

type AwardInteractionAction =
  | { type: "reset" }
  | { type: "score"; componentCode: string; value: string }
  | { type: "consent"; value: boolean }
  | { type: "success"; value: CalculatedState; notice?: string }
  | { type: "restore"; scores: Record<string, string>; consent: boolean; calculated: CalculatedState; notice?: string }
  | { type: "error"; value: string };

export const INITIAL_AWARD_INTERACTION: AwardInteractionState = {
  scores: {}, consent: false, error: null, calculated: null, notice: null,
};

export function reduceAwardInteraction(
  state: AwardInteractionState,
  action: AwardInteractionAction,
): AwardInteractionState {
  if (action.type === "reset") return INITIAL_AWARD_INTERACTION;
  if (action.type === "score") return {
    ...state,
    scores: { ...state.scores, [action.componentCode]: action.value },
    error: null,
    calculated: null,
    notice: null,
  };
  if (action.type === "consent") return { ...state, consent: action.value, error: null, calculated: null, notice: null };
  if (action.type === "success") return { ...state, error: null, calculated: action.value, notice: action.notice ?? null };
  if (action.type === "restore") return {
    scores: action.scores,
    consent: action.consent,
    error: null,
    calculated: action.calculated,
    notice: action.notice ?? null,
  };
  return { ...state, error: action.value, calculated: null, notice: null };
}

export function areAwardScoresComplete(
  componentCodes: string[],
  scores: Record<string, string>,
): boolean {
  return componentCodes.every(code => typeof scores[code] === "string" && scores[code].trim() !== "");
}

export default function AwardCalculatorPanel({ course, catalog = defaultAwardCatalog }: { course: CourseContextEntry; catalog?: AwardCatalog }) {
  const initialModel = useMemo(() => buildAwardCalculatorViewModel(course, catalog), [course, catalog]);
  const [routeId, setRouteId] = useState(initialModel.routeOptions[0]?.id ?? "");
  const [series, setSeries] = useState(initialModel.selectedSeries ?? "");
  const [interaction, dispatch] = useReducer(reduceAwardInteraction, INITIAL_AWARD_INTERACTION);
  const { scores, consent, error, calculated, notice } = interaction;
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const route = catalog.getAwardRoute(routeId);
  const routeSeries = useMemo(() => listSeries(catalog, routeId ? [routeId] : []), [catalog, routeId]);
  const seriesOption = routeSeries.find(option => option.id === series);
  const mode = seriesOption?.source ?? "unavailable";

  const resetCalculation = () => {
    dispatch({ type: "reset" });
  };

  const handleRouteChange = (nextRouteId: string) => {
    setRouteId(nextRouteId);
    setSeries(listSeries(catalog, [nextRouteId])[0]?.id ?? "");
    resetCalculation();
  };

  const handleSeriesChange = (nextSeries: string) => {
    setSeries(nextSeries);
    resetCalculation();
  };

  const restoreEncodedState = useCallback((encoded: string | null): boolean => {
    const shared = decodeAwardShareState(encoded);
    if (!shared) return false;
    const sharedRoute = catalog.getAwardRoute(shared.input.routeId);
    if (!sharedRoute || sharedRoute.qualificationCode !== course.subjectCode || sharedRoute.board !== course.boardName) return false;
    try {
      const resolved = resolveSharedAward(shared, catalog);
      const query = {
        routeId: sharedRoute.id,
        series: shared.input.series,
        optionCode: shared.input.optionCode,
        componentVariants: componentVariantsForRoute(sharedRoute),
      };
      const boundary = resolved.result.source === "official"
        ? catalog.findOfficialBoundary(query)
        : catalog.findEstimatedBoundary(query);
      if (!boundary) return false;
      setRouteId(sharedRoute.id);
      setSeries(shared.input.series);
      dispatch({
        type: "restore",
        scores: Object.fromEntries(shared.input.scores.map(score => [score.componentCode, String(score.rawScore)])),
        consent: shared.input.estimateConsent,
        calculated: { result: resolved.result, route: sharedRoute, scores: shared.input.scores, boundary },
        notice: resolved.notice,
      });
      return true;
    } catch (caught) {
      const code = caught instanceof AwardCalculationError ? caught.code : "INTERNAL_ERROR";
      dispatch({ type: "error", value: PUBLIC_AWARD_ERRORS[code] });
      return false;
    }
  }, [catalog, course.boardName, course.subjectCode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restoreFromHash = () => {
      const encoded = getAwardShareParam(window.location.hash);
      if (encoded) restoreEncodedState(encoded);
      else {
        setRouteId(initialModel.routeOptions[0]?.id ?? "");
        setSeries(initialModel.selectedSeries ?? "");
        dispatch({ type: "reset" });
      }
    };
    const initialEncoded = getAwardShareParam(window.location.hash) ?? readStoredAwardShare(getLocalStorage());
    queueMicrotask(() => { if (initialEncoded) restoreEncodedState(initialEncoded); });
    const onHashChange = () => queueMicrotask(restoreFromHash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [initialModel.routeOptions, initialModel.selectedSeries, restoreEncodedState]);

  const persistShareState = (input: AwardCalculationInput, displayedSource: "official" | "estimated") => {
    if (typeof window === "undefined") return;
    try {
      const encoded = encodeAwardShareState({ version: 1, input, displayedSource });
      writeStoredAwardShare(getLocalStorage(), encoded);
      const nextHash = withAwardShareParam(window.location.hash, encoded);
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
    } catch {
      setActionStatus("分享状态过大，无法保存。");
    }
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setActionStatus("分享链接已复制。");
    } catch {
      setActionStatus("无法复制，请手动选择链接。");
    }
  };

  if (!route || initialModel.mode === "unavailable") {
    return <div className="rounded-xl border border-[#ddd6ce] bg-white p-5 text-sm text-[#6e675e]">该课程没有完整可用的整体资格路线，当前只提供分数线查询。</div>;
  }

  const complete = areAwardScoresComplete(route.components.map(component => component.code), scores);
  const disabled = !complete || !series || (mode === "estimated" && !consent);

  const handleCalculate = () => {
    const inputScores: AwardScoreInput[] = route.components.map(component => ({
      componentCode: component.code,
      ...(route.board === "CAIE" ? { variant: component.code.slice(component.code.lastIndexOf("/") + 1) } : {}),
      series,
      rawScore: Number(scores[component.code]),
      inputKind: component.inputKind,
    }));
    const input = { routeId: route.id, series, ...(route.optionCode ? { optionCode: route.optionCode } : {}), scores: inputScores, estimateConsent: consent };
    try {
      const result = mode === "estimated" ? calculateEstimatedAward(input, catalog) : calculateOfficialAward(input, catalog);
      const query = { routeId: route.id, series, optionCode: route.optionCode, componentVariants: componentVariantsForRoute(route) };
      const boundary = mode === "estimated" ? catalog.findEstimatedBoundary(query) : catalog.findOfficialBoundary(query);
      if (!boundary) throw new AwardCalculationError(mode === "estimated" ? "MISSING_ESTIMATE" : "MISSING_BOUNDARY");
      dispatch({ type: "success", value: { result, route, scores: inputScores, boundary } });
      persistShareState(input, result.source);
    } catch (caught) {
      const code = caught instanceof AwardCalculationError ? caught.code : "INTERNAL_ERROR";
      dispatch({ type: "error", value: PUBLIC_AWARD_ERRORS[code] });
    }
  };

  const shareState: AwardShareState | null = calculated ? {
    version: 1,
    input: {
      routeId: calculated.route.id,
      series: calculated.result.series,
      ...(calculated.result.optionCode ? { optionCode: calculated.result.optionCode } : {}),
      scores: calculated.scores,
      estimateConsent: calculated.result.source === "estimated",
    },
    displayedSource: calculated.result.source,
  } : null;
  const encodedShare = shareState ? encodeAwardShareState(shareState) : null;
  const shareUrl = encodedShare && typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}${window.location.search}${withAwardShareParam(window.location.hash, encodedShare)}`
    : "";

  return (
    <div>
      <section className="rounded-2xl border border-[#ddd6ce] bg-white/90 p-6 shadow-[0_4px_24px_rgba(61,56,50,0.06)]">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <span className="block text-sm font-semibold text-[#625c54]">资格</span>
            <p className="m-0 mt-2 rounded-lg bg-[#f3f0ec] px-3 py-2.5 text-sm text-[#3d3832]">{course.boardName} {course.level} · {course.subjectCode} {course.subjectName}</p>
          </div>
          <div>
            <label htmlFor="award-route" className="block text-sm font-semibold text-[#625c54]">路线</label>
            <select id="award-route" value={routeId} onChange={event => handleRouteChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d9d4ce] bg-white px-3 py-2.5 text-sm">
              {initialModel.routeOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="award-series" className="block text-sm font-semibold text-[#625c54]">考季</label>
            <select id="award-series" value={series} onChange={event => handleSeriesChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d9d4ce] bg-white px-3 py-2.5 text-sm">
              {routeSeries.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          {route.board === "CAIE" && <div>
            <label htmlFor="award-option" className="block text-sm font-semibold text-[#625c54]">Option code</label>
            <select id="award-option" value={route.optionCode} disabled className="mt-2 w-full rounded-lg border border-[#d9d4ce] bg-[#f3f0ec] px-3 py-2.5 text-sm"><option value={route.optionCode}>{route.optionCode}</option></select>
          </div>}
        </div>

        <fieldset className="mt-6 border-0 p-0">
          <legend className="text-base font-bold text-[#3d3832]">输入 Paper 分数</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">{route.components.map(component => {
            const id = `award-score-${component.code.replace(/[^a-z0-9]+/gi, "-")}`;
            return <div key={component.code}><label htmlFor={id} className="block text-sm font-semibold text-[#625c54]">{component.code} 分数</label><input id={id} type="number" min={0} max={component.maxRawMark} step={1} inputMode="numeric" value={scores[component.code] ?? ""} onChange={event => dispatch({ type: "score", componentCode: component.code, value: event.target.value })} className="mt-2 w-full rounded-lg border border-[#d9d4ce] bg-white px-3 py-2.5 text-sm" /><p className="mb-0 mt-1 text-xs text-[#756e67]">满分 {component.maxRawMark}{component.inputKind === "carried-forward" ? " · 请输入官方结转分数" : ""}</p></div>;
          })}</div>
        </fieldset>

        {mode === "estimated" && <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4"><label htmlFor="award-estimate-consent" className="flex cursor-pointer items-start gap-3 text-sm font-semibold text-amber-950"><input id="award-estimate-consent" type="checkbox" checked={consent} onChange={event => dispatch({ type: "consent", value: event.target.checked })} className="mt-0.5 h-4 w-4" />我理解这是非官方预估</label></div>}

        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>}
        <button type="button" onClick={handleCalculate} disabled={disabled} className="mt-6 w-full rounded-xl bg-[#675a4d] px-5 py-3 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-[#a9a29a]">计算等级</button>
      </section>
      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{notice}</p>}
      {calculated && <>
        <AwardResultCard {...calculated} />
        <section aria-label="分享与导出" className="mt-5 rounded-2xl border border-[#ddd6ce] bg-white p-5">
          <label htmlFor="award-share-url" className="block text-sm font-bold text-[#3d3832]">分享链接</label>
          <input id="award-share-url" aria-label="分享链接" readOnly value={shareUrl} className="mt-2 w-full rounded-lg border border-[#d9d4ce] bg-[#f7f4f0] px-3 py-2 text-xs text-[#625c54]" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button type="button" onClick={copyShareUrl} className="rounded-lg border border-[#b9afa4] bg-white px-3 py-2 text-sm font-semibold text-[#675a4d]">复制分享链接</button>
            <button type="button" onClick={() => exportAwardCsv(calculated.result)} className="rounded-lg border border-[#b9afa4] bg-white px-3 py-2 text-sm font-semibold text-[#675a4d]">下载 CSV</button>
            <button type="button" onClick={() => exportAwardExcel(calculated.result).catch(() => setActionStatus("Excel 导出失败，请稍后重试。"))} className="rounded-lg border border-[#b9afa4] bg-white px-3 py-2 text-sm font-semibold text-[#675a4d]">下载 Excel</button>
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-[#b9afa4] bg-white px-3 py-2 text-sm font-semibold text-[#675a4d]">打印结果</button>
          </div>
          {actionStatus && <p role="status" className="mb-0 mt-3 text-xs font-semibold text-[#625c54]">{actionStatus}</p>}
        </section>
      </>}
    </div>
  );
}
