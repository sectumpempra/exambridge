import { BookOpen, Calculator, TrendingUp } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#1E2435] border-t border-[rgba(217,212,206,0.15)]">
      {/* Main footer content */}
      <div className="mx-auto max-w-[1200px] px-5 py-8 md:py-10">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="text-center md:text-left">
            <h3 className="text-sm font-bold tracking-wide text-[#E8E4DE]">
              ExamBridge
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#A8A095]">
              专为国际学校教师跨考试局扩科备课打造
            </p>
          </div>

          {/* Quick links with icons */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
            {[
              { icon: <BookOpen size={14} />, label: "Paper 查询", href: "#/papers" },
              { icon: <Calculator size={14} />, label: "等级预测", href: "#/calculator" },
              { icon: <TrendingUp size={14} />, label: "A*率趋势", href: "#/statistics" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="group flex items-center gap-1.5 text-xs text-[#7A756F] no-underline transition-colors duration-300 hover:text-[#C9A55A]"
              >
                <span className="transition-transform duration-300 group-hover:-translate-y-0.5">
                  {item.icon}
                </span>
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="my-5 h-px w-full bg-[rgba(122,117,111,0.2)]" />

        {/* Bottom row */}
        <div className="flex flex-col items-center gap-2 text-center md:flex-row md:justify-between">
          <p className="m-0 text-[11px] text-[#7A756F]">
            数据来源：各考试局官方 | 仅供参考学习使用
          </p>
          <p className="m-0 text-[11px] text-[#7A756F]">
            Created by Leo Liu
          </p>
        </div>
      </div>
    </footer>
  );
}
