import { useEffect, useRef } from "react";
import type {
  AwardCalculationInput,
  AwardCalculationResult,
  EstimatedAwardBoundary,
  OfficialAwardBoundary,
  OfficialAwardRoute,
} from "@/domain-v2/awards/schema";

type AwardScoreInput = AwardCalculationInput["scores"][number];

type AwardResultCardProps = {
  result: AwardCalculationResult;
  route: OfficialAwardRoute;
  scores: AwardScoreInput[];
  boundary: OfficialAwardBoundary | EstimatedAwardBoundary;
};

const confidenceLabel = { high: "高", medium: "中", low: "低" } as const;

export default function AwardResultCard({ result, route, scores, boundary }: AwardResultCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [result]);

  const isEstimated = result.source === "estimated";
  const components = route.components.map(component => component.code).join(", ");

  return (
    <section
      aria-live="polite"
      aria-labelledby="award-result-heading"
      className="award-result-card mt-6 rounded-2xl border border-[#d9d4ce] bg-white p-6 shadow-[0_8px_32px_rgba(61,56,50,0.08)]"
    >
      <style>{`@media print {
        .award-result-card { break-inside: avoid; box-shadow: none !important; }
        .award-result-badge, .award-estimate-warning { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }`}</style>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`award-result-badge inline-flex rounded-full px-3 py-1 text-xs font-bold ${
            isEstimated ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
          }`}>
            {isEstimated ? "非官方预估等级" : "官方整体边界 · 已核验"}
          </span>
          <h2 id="award-result-heading" ref={headingRef} tabIndex={-1} className="mt-3 text-xl font-bold text-[#3d3832] outline-none">
            {route.board} {route.qualificationCode} {route.board === "CAIE" ? route.optionCode : "Overall"}
          </h2>
          <p className="m-0 text-sm text-[#6e675e]">{route.level} · 路线 {route.routeKey}</p>
        </div>
        <div className="text-right">
          <div className={`text-6xl font-black ${isEstimated ? "text-amber-800" : "text-emerald-800"}`}>{result.grade}</div>
          {result.gradeRange && <p className="m-0 text-sm font-semibold text-amber-900">合理范围 {result.gradeRange.join("–")}</p>}
        </div>
      </div>

      <dl className="mt-5 grid gap-3 rounded-xl bg-[#f7f4f0] p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-[#756e67]">考季</dt><dd className="m-0 font-semibold text-[#3d3832]">{result.series}</dd></div>
        <div><dt className="text-[#756e67]">总分</dt><dd className="m-0 font-semibold text-[#3d3832]">{result.total} / {result.maximumMarkAfterWeighting}</dd></div>
        {result.optionCode && <div><dt className="text-[#756e67]">Option code</dt><dd className="m-0 font-semibold text-[#3d3832]">{result.optionCode}</dd></div>}
        <div><dt className="text-[#756e67]">组成</dt><dd className="m-0 font-semibold text-[#3d3832]">{components}</dd></div>
      </dl>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="mb-2 text-left font-bold text-[#3d3832]">合分明细</caption>
          <thead><tr className="border-b border-[#ddd6ce] text-[#6e675e]"><th className="py-2">Paper</th><th className="py-2">输入分数</th><th className="py-2">权重</th></tr></thead>
          <tbody>{scores.map(score => {
            const component = route.components.find(item => item.code === score.componentCode)!;
            return <tr key={score.componentCode} className="border-b border-[#eee9e3]"><td className="py-2">{score.componentCode}</td><td className="py-2">{score.rawScore} / {component.maxRawMark}</td><td className="py-2">× {component.weightingFactor}</td></tr>;
          })}</tbody>
        </table>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="mb-2 text-left font-bold text-[#3d3832]">{isEstimated ? "预估区间" : "官方整体等级门槛"}</caption>
          <thead><tr className="border-b border-[#ddd6ce] text-[#6e675e]"><th className="py-2">等级</th>{isEstimated ? <><th>宽松值</th><th>中心值</th><th>严格值</th></> : <th>最低总分</th>}</tr></thead>
          <tbody>{Object.entries(boundary.thresholds).map(([grade, threshold]) => <tr key={grade} className="border-b border-[#eee9e3]"><td className="py-2 font-semibold">{grade}</td>{typeof threshold === "number" ? <td>{threshold}</td> : <><td>{threshold.lower}</td><td>{threshold.centre}</td><td>{threshold.upper}</td></>}</tr>)}</tbody>
        </table>
      </div>

      {route.board !== "CAIE" && <p className="mt-4 text-xs text-[#756e67]">单卷门槛仅供表现参考，不用于资格授予</p>}

      {isEstimated && (
        <div className="award-estimate-warning mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="m-0 font-bold">置信度：{result.confidence ? confidenceLabel[result.confidence] : "未提供"}</p>
          <p className="mb-0 mt-2">样本考季：{result.sampleSeries?.join("、")}</p>
          <p className="mb-0 mt-2">算法版本：{result.methodVersion}</p>
          <p className="mb-0 mt-3 font-semibold">{result.warning}</p>
        </div>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-bold text-[#3d3832]">数据来源</h3>
        <ul className="m-0 space-y-1 pl-5 text-xs">{result.sourceUrls.map(url => <li key={url}><a className="break-all text-[#675a4d] underline" href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul>
      </div>
    </section>
  );
}
