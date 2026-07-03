import Header from "./Header";
import Footer from "./Footer";
import DataTable from "./DataTable";
import GradeChart from "./GradeChart";
import { downloadCSV } from "../utils/csvExport";
import { Download } from "lucide-react";

interface Column { key: string; label: string; sortable?: boolean; }
interface GradeField { key: string; label: string; color: string; }
interface FilterField { key: string; label: string; }

interface BoardPageProps {
  boardName: string;
  note: string;
  columns: Column[];
  data: Record<string, string | number>[];
  gradeFields: GradeField[];
  codeField: string;
  sessionField: string;
  yearField: string;
  maxMarkField: string;
  isCaie?: boolean;
  componentField?: string;
  filterFields?: FilterField[];
}

const NAV_LINKS = [
  { label: "首页", to: "/" },
  { label: "A-Level", to: "/alevel" },
  { label: "GCSE", to: "/gcse" },
  { label: "Paper 查询", to: "/papers" },
  { label: "等级预测", to: "/calculator" },
  { label: "刷题规划", to: "/planner" },
  { label: "人格测试", to: "/personality" },
];

export default function BoardPage({
  boardName, note, columns, data, gradeFields,
  codeField, sessionField, yearField, maxMarkField,
  isCaie = false, componentField, filterFields = []
}: BoardPageProps) {
  const handleDownloadCSV = () => {
    downloadCSV(data, `${boardName.toLowerCase()}-grade-boundaries.csv`);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title={`${boardName} 分数线`} links={NAV_LINKS} />

      <main style={{ flex: 1 }}>
        {/* Chart Section - ABOVE the table */}
        <section style={{ padding: "32px 16px 0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <GradeChart
              data={data}
              codeField={codeField}
              sessionField={sessionField}
              yearField={yearField}
              maxMarkField={maxMarkField}
              gradeFields={gradeFields}
              titlePrefix={`${boardName} 分数线趋势`}
              isCaie={isCaie}
              componentField={componentField}
            />
          </div>
        </section>

        {/* Data Table Section - BELOW the chart */}
        <section style={{ padding: "40px 16px 48px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="animate-fade-in-up" style={{ animationDelay: "0.1s", opacity: 0 }}>
              <h2 style={{ fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 600, color: "#3D3832", margin: 0, letterSpacing: "0.02em" }}>
                <span style={{ color: "#8F7F6E" }}>{boardName}</span>{" 分数线数据"}
              </h2>
              <p style={{ fontSize: 13, color: "#A8A095", marginTop: 6 }}>{note}</p>
            </div>

            <DataTable columns={columns} data={data} filterFields={filterFields} />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={handleDownloadCSV}
                style={{ background: "linear-gradient(135deg, rgba(166,152,136,0.1), rgba(166,152,136,0.04))", color: "#7A6E5F", fontSize: 14, fontWeight: 500, padding: "10px 24px", borderRadius: 10, border: "1px solid #C9C0B3", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.3s ease", letterSpacing: "0.02em" }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "linear-gradient(135deg, rgba(166,152,136,0.18), rgba(166,152,136,0.08))"; (e.target as HTMLElement).style.borderColor = "#A69888"; (e.target as HTMLElement).style.boxShadow = "0 4px 12px rgba(166,152,136,0.12)"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "linear-gradient(135deg, rgba(166,152,136,0.1), rgba(166,152,136,0.04))"; (e.target as HTMLElement).style.borderColor = "#C9C0B3"; (e.target as HTMLElement).style.boxShadow = "none"; }}>
                <Download size={16} /> 下载 CSV
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
