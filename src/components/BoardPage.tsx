import { Link, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import DataTable from "./DataTable";
import GradeChart from "./GradeChart";
import { downloadCSV } from "../utils/csvExport";
import { Download } from "lucide-react";
import { useState } from "react";
import { useCourseContext } from "../course-context/CourseContextProvider";
import { courseMatchesRoute, withCourseContext } from "../course-context/catalog";

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
  // A-Level/GCSE toggle support
  level?: string;
  otherLevelPath?: string;
  otherLevelLabel?: string;
  csvSuffix?: string;
}

export default function BoardPage({
  boardName, note, columns, data, gradeFields,
  codeField, sessionField, yearField, maxMarkField,
  isCaie = false, componentField, filterFields = [],
  level, otherLevelPath, otherLevelLabel, csvSuffix = "",
}: BoardPageProps) {
  const location = useLocation();
  const { entry } = useCourseContext();
  const [filteredData, setFilteredData] = useState(data);
  const handleDownloadCSV = () => {
    const suffix = csvSuffix ? `-${csvSuffix}` : "";
    downloadCSV(filteredData, `${boardName.toLowerCase()}${suffix}-grade-boundaries.csv`);
  };

  const title = level ? `${boardName} ${level}` : boardName;
  const chartTitle = level ? `${boardName} ${level} 分数线趋势` : `${boardName} 分数线趋势`;
  const tableTitle = level ? `${boardName} ${level} 分数线数据` : `${boardName} 分数线数据`;
  const urlStateKey = `${boardName.toLowerCase().replace(/\s+/g, "-")}${csvSuffix ? `-${csvSuffix}` : ""}`;
  const compatibleEntry = entry && courseMatchesRoute(entry, location.pathname) && entry.capabilities.boundaries.status !== "unavailable" ? entry : undefined;
  const initialFilters = compatibleEntry && filterFields.some((field) => field.key === codeField) ? { [codeField]: compatibleEntry.subjectCode } : undefined;
  const provenanceColumns = data.some((row) => "_verificationStatus" in row)
    ? [...columns, { key: "_verificationStatus", label: "核验状态", sortable: false }, { key: "_sourceUrl", label: "来源", sortable: false }]
    : columns;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #F0EDE8 0%, #F5F2EE 50%, #F0EDE8 100%)" }}>
      <Header title={`${title} 分数线`} />

      <main style={{ flex: 1 }}>
        <h1 className="sr-only">{title} 分数线</h1>
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
              titlePrefix={chartTitle}
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
                <span style={{ color: "#675A4D" }}>{boardName}</span>{` ${tableTitle.split(" ").slice(1).join(" ")}`}
              </h2>
              <p style={{ fontSize: 13, color: "#6E675E", marginTop: 6 }}>{note}</p>
            </div>

            <DataTable key={compatibleEntry?.qualificationId ?? "no-course"} columns={provenanceColumns} data={data} filterFields={filterFields} initialFilters={initialFilters} urlStateKey={urlStateKey} onFilteredDataChange={setFilteredData} />

            <div className={`mt-5 flex items-center gap-2.5 flex-wrap ${otherLevelPath ? "justify-between" : "justify-end"}`}>
              {otherLevelPath && (
                <span style={{ fontSize: 12, color: "#6E675E" }}>
                  <Link to={otherLevelPath} style={{ color: "#675A4D", textDecoration: "none" }}>
                    切换到 {otherLevelLabel} →
                  </Link>
                </span>
              )}
              {compatibleEntry?.capabilities.statistics.href && <Link to={withCourseContext(compatibleEntry.capabilities.statistics.href, { qualificationId: compatibleEntry.qualificationId, specificationId: compatibleEntry.specificationId })} className="rounded-[10px] border border-[#c9c0b3] bg-white px-4 py-2.5 text-sm font-medium text-[#675a4d] no-underline">查看对应成绩统计</Link>}
              <button onClick={handleDownloadCSV}
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-[#C9C0B3] bg-gradient-to-br from-[rgba(166,152,136,0.1)] to-[rgba(166,152,136,0.04)] px-6 py-2.5 text-sm font-medium tracking-wider text-[#7A6E5F] transition-all hover:border-[#A69888] hover:from-[rgba(166,152,136,0.18)] hover:to-[rgba(166,152,136,0.08)] hover:shadow-[0_4px_12px_rgba(166,152,136,0.12)]">
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
