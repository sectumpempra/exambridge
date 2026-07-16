import { useMemo, useState, type ReactNode } from "react";
import { ExternalLink, FileCheck2, FileDown, Library, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  assetHref,
  buildPastPaperSets,
  getPastPaperCatalogMaturity,
  resolvePastPaperCatalogKey,
  usePastPaperCatalogs,
  type PastPaperAsset,
} from "@/domain-v2/past-papers";

const SERIES_LABEL: Record<PastPaperAsset["series"], string> = {
  january: "January",
  march: "March",
  june: "June",
  october: "October",
  november: "November",
  specimen: "Specimen",
};

const MATERIAL_LABEL: Record<PastPaperAsset["materialType"], string> = {
  "question-paper": "试卷",
  "mark-scheme": "评分标准",
  "examiner-report": "考官报告",
  insert: "附录",
  "data-booklet": "数据手册",
  audio: "音频",
  "source-file": "源文件",
};

const COVERAGE_LABEL = {
  complete: "完整核验",
  partial: "部分收录",
  "account-required": "需官方账号",
  "not-held": "未举行",
  "not-published": "未发布",
  removed: "官方已下架",
  "review-required": "待逐项核验",
} as const;

function companionLabel(asset: PastPaperAsset): string {
  return MATERIAL_LABEL[asset.materialType];
}

function accessBadge(asset: PastPaperAsset): string {
  if (asset.accessStatus === "account-required" || asset.distributionStatus === "restricted") return "需官方账号";
  if (asset.accessStatus === "not-published") return "尚未发布";
  if (asset.accessStatus === "removed") return "官方已下架";
  if (asset.accessStatus === "public") return "官方公开";
  return "访问状态待核验";
}

function distributionLabel(asset: PastPaperAsset): string {
  if (asset.distributionStatus === "link-only") return "官方链接";
  if (asset.distributionStatus === "hosting-permitted") return "本站授权文件";
  if (asset.distributionStatus === "restricted") return "官方账号材料";
  return "发布方式待核验";
}

function AssetLink({ asset, children }: { asset: PastPaperAsset; children: ReactNode }) {
  const href = assetHref(asset);
  if (!href) {
    return <span title="该材料不能由 ExamBridge 直接提供" className="inline-flex items-center gap-1 rounded-lg bg-[#eeeae4] px-3 py-2 text-xs font-semibold text-[#7b736a]"><LockKeyhole size={13} /> 需要官方账号</span>;
  }
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[#cbd6d1] bg-white px-3 py-2 text-xs font-semibold text-[#3f5d50] no-underline hover:border-[#769384]"><FileDown size={13} /> {children}</a>;
}

export default function PastPaperLibrary({
  board,
  subjectCode,
  componentCodes,
  paperCodes,
  compact = false,
}: {
  board: string;
  subjectCode: string;
  componentCodes?: readonly string[];
  paperCodes?: readonly string[];
  compact?: boolean;
}) {
  const catalogKey = resolvePastPaperCatalogKey(board, subjectCode);
  const { catalogs, loading, error } = usePastPaperCatalogs([catalogKey]);
  const catalog = catalogKey ? catalogs.get(catalogKey) : undefined;
  const [year, setYear] = useState("all");
  const [series, setSeries] = useState("all");
  const [component, setComponent] = useState("all");

  const allSets = useMemo(() => {
    if (!catalog) return [];
    const sets = buildPastPaperSets(catalog, componentCodes);
    if (!paperCodes?.length) return sets;
    const allowed = new Set(paperCodes.map(String));
    return sets.filter((set) => set.paperCode && allowed.has(set.paperCode));
  }, [catalog, componentCodes, paperCodes]);

  const visibleSets = allSets.filter((set) =>
    (year === "all" || String(set.year) === year)
    && (series === "all" || set.series === series)
    && (component === "all" || set.componentCode === component)
  );
  const years = [...new Set(allSets.map((set) => String(set.year)))].sort().reverse();
  const seriesOptions = [...new Set(allSets.map((set) => set.series))];
  const components = [...new Set(allSets.map((set) => set.componentCode).filter((value): value is string => Boolean(value)))].sort();
  const sittingYear = year === "all" ? 2025 : Number(year);
  const visibleSittings = catalog?.sittings.filter((entry) => entry.year === sittingYear) ?? [];
  const seriesMaterials = catalog?.assets.filter((asset) => asset.materialType === "examiner-report" && !asset.paperSetId) ?? [];
  const maturity = catalog ? getPastPaperCatalogMaturity(catalog) : undefined;
  const maturityLabel = maturity && ({ catalogued: "仅目录", "metadata-ready": "元数据已整理", "past-paper-ready": "已有试卷", verified: "试卷与评分标准已核验" } as const)[maturity];

  if (!catalogKey) return null;

  return <section className={compact ? "mt-5" : "mt-8"} aria-labelledby={`past-paper-title-${catalogKey}`}>
    <div className="rounded-3xl border border-[#cdd9d3] bg-[#f5f9f6] p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#506d58]"><Library size={15} /> Past papers</span>
          <h2 id={`past-paper-title-${catalogKey}`} className="mb-0 mt-2 text-xl font-bold text-[#334a3b]">历年真题与材料</h2>
          <p className="mb-0 mt-2 max-w-2xl text-xs leading-5 text-[#5f7064]">{catalog?.accessNote ?? "正在读取已核验目录…"}</p>
          {maturityLabel && <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#506d58]">成熟度：{maturityLabel}</span>}
        </div>
        {catalog && <a href={catalog.sourcePageUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#496454] px-3.5 py-2.5 text-xs font-semibold text-white no-underline hover:bg-[#3b5445]"><ExternalLink size={14} /> 官方材料入口</a>}
      </div>

      {loading && <div className="mt-5 rounded-2xl bg-white/75 px-4 py-8 text-center text-sm text-[#69766d]">正在加载已核验目录…</div>}
      {error && <div className="mt-5 rounded-2xl border border-[#e3c8bd] bg-[#fff6f2] px-4 py-4 text-sm text-[#8b5d4b]">目录暂时无法加载，请使用上方官方入口。</div>}

      {catalog && <>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-[#5b6d61]">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1"><ShieldCheck size={12} /> 人工核验至 {catalog.release.verifiedAt}</span>
          <span className="rounded-full bg-white px-2.5 py-1">默认仅跳转官方文件</span>
          <span className="rounded-full bg-[#f4eee2] px-2.5 py-1 text-[#795f39]">旧卷与当前考纲适用性需复核</span>
        </div>
        <div className="mt-3" aria-label="2021 至 2025 真题目录覆盖状态">
          <span className="text-[11px] font-semibold text-[#506d58]">2021–2025 覆盖核验</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {catalog.coverage.map((entry) => <button type="button" key={entry.year} title={entry.note} onClick={() => setYear(String(entry.year))} className={`rounded-full border-0 px-2.5 py-1 text-[10px] text-[#5b6d61] ${year === String(entry.year) ? "bg-[#dce9e1] font-semibold" : "bg-white"}`}>{entry.year} · {COVERAGE_LABEL[entry.status]}</button>)}
          </div>
        </div>
        {visibleSittings.length > 0 && <div className="mt-3 rounded-2xl bg-white/65 px-3 py-2.5" aria-label={`${sittingYear} 年逐考季可用状态`}>
          <span className="text-[11px] font-semibold text-[#506d58]">{sittingYear} 逐考季状态{year === "all" ? "（选择年份查看其他年份）" : ""}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{visibleSittings.map((entry) => <span key={`${entry.year}-${entry.series}`} title={entry.note} className="rounded-full bg-[#f4f7f5] px-2.5 py-1 text-[10px] text-[#5b6d61]">{SERIES_LABEL[entry.series]} · {COVERAGE_LABEL[entry.status]}{entry.expected ? "" : " · 补充考季"}</span>)}</div>
        </div>}

        {allSets.length > 0 ? <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-medium text-[#526258]">年份<select aria-label="筛选真题年份" value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 block w-full rounded-lg border border-[#ccd6d1] bg-white px-3 py-2 text-sm"><option value="all">全部年份</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="text-xs font-medium text-[#526258]">考季<select aria-label="筛选真题考季" value={series} onChange={(event) => setSeries(event.target.value)} className="mt-1 block w-full rounded-lg border border-[#ccd6d1] bg-white px-3 py-2 text-sm"><option value="all">全部考季</option>{seriesOptions.map((value) => <option key={value} value={value}>{SERIES_LABEL[value]}</option>)}</select></label>
            <label className="text-xs font-medium text-[#526258]">组件<select aria-label="筛选真题组件" value={component} onChange={(event) => setComponent(event.target.value)} className="mt-1 block w-full rounded-lg border border-[#ccd6d1] bg-white px-3 py-2 text-sm"><option value="all">全部组件</option>{components.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <div className="mt-4 space-y-2">
            {visibleSets.map((set) => <article key={set.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#d9e1dc] bg-white/85 p-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[#33483a]">{set.title}</strong><span className="rounded-full bg-[#edf3ef] px-2 py-0.5 text-[10px] font-semibold text-[#53705e]">{accessBadge(set.questionPaper)}</span></div>
                <span className="mt-1 block text-[11px] text-[#748078]">{set.year} {SERIES_LABEL[set.series]} · 组件 {set.componentCode ?? "全卷"} · {distributionLabel(set.questionPaper)}</span>
              </div>
              <div className="flex flex-wrap gap-2"><AssetLink asset={set.questionPaper}>下载试卷</AssetLink>{set.markScheme && <AssetLink asset={set.markScheme}>评分标准</AssetLink>}{set.companions.map((asset) => <AssetLink key={asset.id} asset={asset}>{companionLabel(asset)}</AssetLink>)}</div>
            </article>)}
            {visibleSets.length === 0 && <div className="rounded-2xl bg-white/75 px-4 py-8 text-center text-sm text-[#69766d]">当前筛选条件没有已核验材料。</div>}
          </div>
        </> : <div className="mt-5 rounded-2xl border border-dashed border-[#cbd6d0] bg-white/60 px-5 py-7 text-center">
          <FileCheck2 size={24} className="mx-auto text-[#789083]" />
          <p className="mb-0 mt-2 text-sm font-semibold text-[#455c4e]">逐份材料正在候选审核</p>
          <p className="mb-0 mt-1 text-xs leading-5 text-[#69766d]">第一版不生成虚拟试卷，也不从第三方站点补链接。请暂时通过官方材料入口查询。</p>
        </div>}

        {seriesMaterials.length > 0 && <div className="mt-4 border-t border-[#d7e0da] pt-4"><span className="text-xs font-semibold text-[#506d58]">考季配套资料</span><div className="mt-2 flex flex-wrap gap-2">{seriesMaterials.map((asset) => <AssetLink key={asset.id} asset={asset}>{asset.title}</AssetLink>)}</div></div>}
      </>}
    </div>
  </section>;
}
