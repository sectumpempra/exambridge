import { BadgeCheck, Box, TriangleAlert } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { VectorGeometryLabWorkspace } from "./vector-geometry-lab/VectorGeometryLabWorkspace";

export default function VectorGeometryLabPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0ede8] to-[#f7f4f0]">
      <Header title="空间向量实验室" />
      <main className="mx-auto max-w-[1560px] px-3 py-5 sm:px-5 sm:py-7">
        <section className="mb-4 grid gap-3 rounded-2xl border border-[#d9d4ce] bg-white/75 p-4 shadow-[0_10px_30px_rgba(61,56,50,0.06)] lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#253b46] text-white">
              <Box size={21} aria-hidden="true" />
            </span>
            <div>
              <h1 className="m-0 text-xl font-bold text-[#3d3832] sm:text-2xl">
                空间向量实验室
              </h1>
              <p className="mb-0 mt-1 max-w-4xl text-sm leading-6 text-[#625c54]">
                用精确有理数与根式求解向量、距离、夹角、直线和平面问题，并用三维图形核验几何关系。
                数学结论由确定性求解器生成，不依赖生成式 AI。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#b9ccc6] bg-[#f3faf7] px-3 py-1.5 font-semibold text-[#345d50]">
              <BadgeCheck size={14} aria-hidden="true" />
              88 个 Gold Cases 已验证
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dbc8b7] bg-[#fff8f1] px-3 py-1.5 font-semibold text-[#72533b]">
              <TriangleAlert size={14} aria-hidden="true" />
              V1 仅支持页面列出的 16 类场景
            </span>
          </div>
        </section>
        <VectorGeometryLabWorkspace />
      </main>
      <Footer />
    </div>
  );
}
