import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  GraduationCap, School, Calculator, BookOpen,
  CheckCircle, ArrowLeft,
} from "lucide-react";

const NAV_LINKS = [
  { label: "A-level 分数线", to: "/alevel" },
  { label: "Paper 查询", to: "/papers" },
  { label: "GCSE 分数线", to: "/gcse" },
  { label: "等级预测模拟器", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
];

const FEATURES = [
  {
    icon: GraduationCap,
    title: "A-Level 分数线查询",
    color: "#94A8B8",
    items: [
      "Edexcel A-Level：2,129 条数据，覆盖 125+ 门科目（2014-2026）",
      "CAIE A-Level：4,597 条数据，涵盖数学、物理、化学、生物、经济、计算机等全部科目（2021-2025）",
      "AQA A-Level（Oxford AQA）：634 条数据，覆盖 13 门科目（2018-2026）",
      "OCR A-Level：701 条数据，覆盖人文与科学科目（2021-2025）",
      "支持按科目代码、年份、考试季筛选",
      "可视化趋势图，按时间顺序展示各等级分数线变化",
      "CSV 数据导出",
    ],
  },
  {
    icon: School,
    title: "GCSE / IGCSE 分数线查询",
    color: "#8F7F6E",
    items: [
      "CAIE IGCSE：304 条数据，覆盖 A*-G 等级制科目（2021-2025）",
      "Edexcel IGCSE：145 条数据，含数学 4MA1 等热门科目",
      "OCR GCSE：132 条数据，含附加数学 6993 等",
      "AQA GCSE：133 条数据，含进阶数学 8365 等",
      "支持 9-1 和 A*-G 两种等级制",
      "趋势图去重处理，避免数据点重复",
    ],
  },
  {
    icon: Calculator,
    title: "等级预测模拟器",
    color: "#9F8F7E",
    items: [
      "覆盖 7 个考试局：CAIE / Edexcel / AQA / OCR（A-Level + GCSE）",
      "每张 Paper 独立选择考试年份，自动加载对应满分和分数线",
      "支持勾选部分 Paper 进行合分预测（如 0580 只需 P2 + P4）",
      "跨年份组合：不同 Paper 可选择不同年份的分数线数据",
      "输入校验：自动检测分数是否超过该年份满分",
      "基准对照法：累加 component 分数线预测总成绩等级",
      "提分建议：分析距离下一等级差几分，各 Paper 提分空间",
    ],
  },
  {
    icon: BookOpen,
    title: "CAIE 刷题规划",
    color: "#BFA8A0",
    items: [
      "覆盖 7 个 CAIE A-Level 科目：数学、进阶数学、物理、化学、生物、经济、计算机",
      "智能排课：按备考强度（轻松/标准/密集）自动分配历年真题",
      "考试倒计时：颜色分级预警（>30天绿、15-30天橙、<7天红）",
      "每周任务：按周分组展示，支持折叠/展开",
      "完成追踪：点击标记已完成试卷",
      "分享功能：URL + 二维码跨设备同步（无需后端）",
      "导出：Excel / Word / PDF 三种格式",
    ],
  },
];

const cardStyle: React.CSSProperties = {
  padding: 32, borderRadius: 16,
  background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(250,248,245,0.9))",
  boxShadow: "0 4px 24px rgba(61,56,50,0.06)",
  border: "1px solid rgba(233,229,222,0.8)",
};

export default function About() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8, #F5F2EE)" }}>
      <Header title="功能介绍" links={NAV_LINKS} />
      <main style={{ flex: 1, padding: "40px 16px 60px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>

          {/* Back link */}
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#8F7F6E", fontSize: 14, textDecoration: "none", marginBottom: 24 }}>
            <ArrowLeft size={16} /> 返回首页
          </Link>

          {/* Title */}
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#3D3832", margin: "0 0 8px" }}>
            功能介绍
          </h1>
          <p style={{ fontSize: 15, color: "#8B8378", lineHeight: 1.7, margin: "0 0 32px" }}>
            本平台为国际课程（A-Level / GCSE / IGCSE）学生提供一站式分数线查询、等级预测和备考规划工具。
          </p>

          {/* Feature Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} style={cardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${f.color}18, ${f.color}08)`, border: `1px solid ${f.color}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={20} style={{ color: f.color }} />
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#3D3832", margin: 0 }}>{f.title}</h2>
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {f.items.map((item, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#5A554F", lineHeight: 1.6 }}>
                        <CheckCircle size={16} style={{ color: f.color, flexShrink: 0, marginTop: 2 }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Data Summary */}
          <div style={{ ...cardStyle, marginTop: 20, textAlign: "center" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#3D3832", margin: "0 0 20px" }}>数据总览</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { num: "8,600+", label: "总数据条数" },
                { num: "7", label: "考试科目" },
                { num: "4", label: "考试局" },
                { num: "2014-2026", label: "时间跨度" },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#8F7F6E" }}>{s.num}</div>
                  <div style={{ fontSize: 12, color: "#A8A095", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ marginTop: 24, padding: 16, background: "rgba(143,127,110,0.04)", borderRadius: 10, border: "1px solid #E9E5DE" }}>
            <p style={{ fontSize: 12, color: "#A8A095", lineHeight: 1.6, margin: 0, textAlign: "center" }}>
              所有分数线数据来源于各考试局官方公开资料，仅供参考学习使用。<br />
              等级预测结果基于历年分数线估算，不代表实际成绩，请以考试局最终发布为准。<br />
              Created by Leo Liu
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
