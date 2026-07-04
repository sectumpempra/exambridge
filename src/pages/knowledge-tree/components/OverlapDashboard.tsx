import type { OverlapData } from "@/data/knowledge-tree/types";
import { GitCompareArrows, ArrowRight, AlertCircle } from "lucide-react";

interface Props {
  overlap: OverlapData | null;
  subjectAName: string;
  subjectBName: string;
  loading: boolean;
}

const STRENGTH_COLORS: Record<string, string> = {
  exact: "#5A7A5E",
  strong: "#8F7F6E",
  partial: "#BFA8A0",
};

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
        <AlertCircle className="w-10 h-10 text-[#C4BDB3] mx-auto mb-3" />
        <p className="text-sm text-[#8B8378]">请选择两个科目进行对比</p>
      </div>
    );
  }

  const s = overlap.summary;
  const symW = s.symmetric.weighted;

  return (
    <div className="rounded-2xl border border-[#E8E4DE] bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#E8E4DE] bg-gradient-to-r from-[#FAF8F5] to-white">
        <div className="flex items-center gap-3">
          <GitCompareArrows className="w-5 h-5 text-[#8F7F6E]" />
          <h3 className="text-sm font-semibold text-[#3D3832]">考纲重合度分析</h3>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-[#8B8378]">
          <span className="font-medium text-[#3D3832]">{subjectAName}</span>
          <ArrowRight className="w-3 h-3 text-[#C4BDB3]" />
          <span className="font-medium text-[#3D3832]">{subjectBName}</span>
        </div>
      </div>

      {/* Big score */}
      <div className="px-6 py-6 text-center">
        <div className="text-[clamp(36px,8vw,56px)] font-extrabold leading-none" style={{
          background: "linear-gradient(135deg, #8F7F6E 0%, #B8A68A 50%, #A69888 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          {symW.toFixed(1)}%
        </div>
        <p className="mt-2 text-xs text-[#A8A095]">加权重合度（推荐）</p>

        {/* Progress bar */}
        <div className="mt-4 mx-auto max-w-md">
          <div className="h-3 bg-[#E8E4DE] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${symW}%`,
                background: "linear-gradient(90deg, #9AAF9E, #5A7A5E)",
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#A8A095]">
            <span>差异大</span>
            <span>高度重合</span>
          </div>
        </div>
      </div>

      {/* Bidirectional breakdown */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-2 gap-4">
          {/* A → B */}
          <div className="rounded-xl border border-[#E8E4DE] p-4">
            <p className="text-[11px] text-[#A8A095] mb-2">{s.AtoB.name}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#3D3832]">{s.AtoB.weighted.percentage.toFixed(1)}%</span>
              <span className="text-xs text-[#A8A095]">weighted</span>
            </div>
            <div className="mt-1 text-[11px] text-[#8B8378]">
              {s.AtoB.unweighted.overlap}/{s.AtoB.unweighted.total} topics
            </div>
          </div>

          {/* B → A */}
          <div className="rounded-xl border border-[#E8E4DE] p-4">
            <p className="text-[11px] text-[#A8A095] mb-2">{s.BtoA.name}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[#3D3832]">{s.BtoA.weighted.percentage.toFixed(1)}%</span>
              <span className="text-xs text-[#A8A095]">weighted</span>
            </div>
            <div className="mt-1 text-[11px] text-[#8B8378]">
              {s.BtoA.unweighted.overlap}/{s.BtoA.unweighted.total} topics
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 justify-center">
          {(["exact", "strong", "partial"] as const).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STRENGTH_COLORS[s] }} />
              <span className="text-[10px] text-[#8B8378] capitalize">{s === "exact" ? "精确匹配" : s === "strong" ? "强相关" : "部分相关"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
