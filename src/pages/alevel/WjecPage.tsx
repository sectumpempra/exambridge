import { Link } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { BarChart3, ArrowRight, BookOpen } from "lucide-react";

export default function AlevelWjecPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <Header title="WJEC / Eduqas" links={[{ label: "首页", to: "/" }, { label: "A-Level", to: "/alevel" }]} />

      <main className="max-w-[1200px] mx-auto px-5 pt-[88px] pb-20">
        {/* Breadcrumb */}
        <nav className="text-sm text-[#8B8378] mb-6">
          <Link to="/" className="hover:text-[#1B4D3E] transition-colors">首页</Link>
          <span className="mx-2">/</span>
          <Link to="/alevel" className="hover:text-[#1B4D3E] transition-colors">A-Level</Link>
          <span className="mx-2">/</span>
          <span className="text-[#4A4A4A]">WJEC / Eduqas</span>
        </nav>

        <div className="text-center py-16">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #5A7080 0%, #7B8FA0 100%)" }}
          >
            <BarChart3 className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-3xl font-semibold text-[#2A2A2A] mb-4">
            WJEC / Eduqas
          </h1>

          <p className="text-lg text-[#8B8378] max-w-2xl mx-auto mb-4">
            威尔士 WJEC 与英格兰 Eduqas 的 A-Level 分数线数据
          </p>

          <p className="text-sm text-[#A8A095] max-w-xl mx-auto mb-10">
            71 个科目 · 439 条分数线记录（Grade Statistics 数据已导入，Grade Boundaries 数据即将上线）
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/statistics"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #5A7080 0%, #7B8FA0 100%)" }}
            >
              <BarChart3 className="w-5 h-5" />
              查看 WJEC 成绩统计
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/alevel"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-[#D8D4CE] text-[#6B6560] font-medium hover:bg-[#F0EDE8] transition-all"
            >
              <BookOpen className="w-5 h-5" />
              返回 A-Level 首页
            </Link>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-8">
          <div className="bg-white rounded-xl p-5 border border-[#E8E4DE]">
            <h3 className="font-medium text-[#2A2A2A] mb-2">WJEC</h3>
            <p className="text-sm text-[#8B8378]">
              威尔士资格认证机构，威尔士地区学校主要考试局
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-[#E8E4DE]">
            <h3 className="font-medium text-[#2A2A2A] mb-2">Eduqas</h3>
            <p className="text-sm text-[#8B8378]">
              WJEC 英格兰分校，提供英格兰学校使用的同等资格认证
            </p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-[#E8E4DE]">
            <h3 className="font-medium text-[#2A2A2A] mb-2">数据覆盖</h3>
            <p className="text-sm text-[#8B8378]">
              艺术、人文、科学等 71 个科目的 Grade Statistics 数据
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
