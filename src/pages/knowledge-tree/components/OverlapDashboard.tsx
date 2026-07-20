import type { KnowledgeComparisonViewData } from "@/data/knowledge-tree/comparison-view";
import { AlertCircle, ArrowRight, ChevronDown, GitCompareArrows } from "lucide-react";

interface Props {
  overlap: KnowledgeComparisonViewData | null;
  subjectAName: string;
  subjectBName: string;
  loading: boolean;
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

export default function OverlapDashboard({ overlap, subjectAName, subjectBName, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E8E4DE] bg-white p-8 text-center">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-[#E8E4DE] rounded mx-auto mb-4" />
          <div className="h-4 w-32 bg-[#E8E4DE] rounded mx-auto" />
        </div>
      </div>
    );
  }

  if (!overlap) {
    return (
      <div className="rounded-2xl border border-[#E8E4DE] bg-white p-8 text-center">
        <AlertCircle className="w-10 h-10 text-[#716A61] mx-auto mb-3" />
        <p className="text-sm text-[#625C54]">请选择两个科目进行对比</p>
      </div>
    );
  }

  const { unionOverlap, coverageA, coverageB, partialStatementCount, unresolvedStatementCount } = overlap.metrics;

  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden">
      <div className="px-5 py-4 sm:px-6 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <div className="flex items-center gap-3">
          <GitCompareArrows className="w-5 h-5 text-[#675A4D]" />
          <h3 className="text-sm font-semibold text-[#3D3832]">考纲相似度概览</h3>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#625C54]">
          <span className="font-medium text-[#3D3832]">{subjectAName}</span>
          <ArrowRight className="w-3 h-3 text-[#716A61]" />
          <span className="font-medium text-[#3D3832]">{subjectBName}</span>
        </div>
      </div>

      <div className="px-5 py-6 text-center sm:px-6">
        <p className="text-xs font-semibold tracking-wide text-[#6E5C40]">知识范围重合度</p>
        <div
          className="mt-2 text-[clamp(36px,8vw,56px)] font-extrabold leading-none"
          style={{
            background: "linear-gradient(135deg, #675A4D 0%, #6E5C40 50%, #A69888 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {unionOverlap.percentage.toFixed(1)}%
        </div>
        <p className="mt-2 text-xs text-[#6E675E]">
          {unionOverlap.overlap} 个共同节点 / {unionOverlap.total} 个并集节点
        </p>

        <div className="mt-4 mx-auto max-w-md">
          <div className="h-3 bg-[#E8E4DE] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${clampPercentage(unionOverlap.percentage)}%`,
                background: "linear-gradient(90deg, #506D58, #456348)",
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#6E675E]">
            <span>范围差异较大</span>
            <span>知识范围高度重合</span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MetricCard
            label={`${subjectAName} 被覆盖`}
            value={coverageA.percentage}
            note={`${coverageA.overlap}/${coverageA.total} 个知识节点在对方考纲中出现`}
            tone="green"
          />
          <MetricCard
            label={`${subjectBName} 被覆盖`}
            value={coverageB.percentage}
            note={`${coverageB.overlap}/${coverageB.total} 个知识节点在对方考纲中出现`}
            tone="blue"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#625C54]">
          <span className="rounded-full border border-[#E5D4B7] bg-[#FBF6EC] px-3 py-1">部分重合陈述：{partialStatementCount ?? 0}</span>
          <span className="rounded-full border border-[#D9D4CE] bg-[#FAF8F5] px-3 py-1">待核验陈述：{unresolvedStatementCount ?? 0}</span>
        </div>

        <details className="group mt-4 rounded-xl border border-[#E8E4DE] bg-[#FAF8F5] px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-[#3D3832]">
            为什么这些百分比不同？
            <ChevronDown className="ml-auto h-3.5 w-3.5 text-[#716A61] transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-[#625C54]">
            <p><strong className="text-[#3D3832]">知识范围重合度</strong>：共同知识节点 ÷ 两科知识节点并集，用于判断“教什么”有多相似。</p>
            <p><strong className="text-[#3D3832]">单科覆盖率</strong>：共同节点 ÷ 该科全部节点。两科节点总数不同，所以两个方向的覆盖率可能不同。</p>
            <p><strong className="text-[#3D3832]">部分重合与待核验</strong>：上下位或范围不完整的关系单列，未批准或空映射不会折算为精确百分比。</p>
          </div>
        </details>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone: "amber" | "green" | "blue";
}) {
  const tones = {
    amber: "border-[#E5D4B7] bg-[#FBF6EC] text-[#745627]",
    green: "border-[#CDDED1] bg-[#F1F7F2] text-[#456348]",
    blue: "border-[#CFDCE8] bg-[#F2F6FA] text-[#435F7A]",
  };

  return (
    <div className={`rounded-xl border p-4 text-left ${tones[tone]}`}>
      <p className="text-[11px] font-semibold leading-snug">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#3D3832]">{value.toFixed(1)}%</p>
      <p className="mt-1 text-[10px] leading-relaxed text-[#625C54]">{note}</p>
    </div>
  );
}
