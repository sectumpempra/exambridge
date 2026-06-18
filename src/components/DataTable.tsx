import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, Search } from "lucide-react";

interface Column { key: string; label: string; sortable?: boolean; }

interface DataTableProps {
  columns: Column[];
  data: Record<string, string | number>[];
  itemsPerPageOptions?: number[];
  filterFields?: { key: string; label: string }[];
}

/** Extract unique values for a field */
function getUniqueValues(data: Record<string, string | number>[], key: string): string[] {
  const vals = new Set<string>();
  data.forEach(r => { const v = String(r[key] || ""); if (v) vals.add(v); });
  return Array.from(vals).sort();
}

export default function DataTable({ columns, data, itemsPerPageOptions = [10, 25, 50, 100], filterFields = [] }: DataTableProps) {
  const [search, setSearch] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Build dropdown options for filter fields
  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    filterFields.forEach(ff => {
      opts[ff.key] = getUniqueValues(data, ff.key);
    });
    return opts;
  }, [data, filterFields]);

  const handleSort = useCallback((columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === "asc") setSortDirection("desc");
      else { setSortColumn(null); setSortDirection("asc"); }
    } else { setSortColumn(columnKey); setSortDirection("asc"); }
  }, [sortColumn, sortDirection]);

  const setFilter = (key: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    let result = [...data];
    // Apply dropdown filters
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(r => String(r[key]).toLowerCase() === value.toLowerCase());
      }
    });
    // Apply text search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(s)));
    }
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn], bVal = b[sortColumn];
        const aNum = Number(aVal), bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum) && aVal !== "" && bVal !== "") {
          return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }
        const aStr = String(aVal).toLowerCase(), bStr = String(bVal).toLowerCase();
        if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, search, sortColumn, sortDirection, activeFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const startEntry = filteredData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(currentPage * itemsPerPage, filteredData.length);

  const goToPage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const s = Math.max(2, currentPage - 1), e = Math.min(totalPages - 1, currentPage + 1);
      for (let i = s; i <= e; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const selectBaseStyle: React.CSSProperties = {
    padding: "6px 10px", border: "1px solid #D9D4CE", borderRadius: 8, fontSize: 13,
    backgroundColor: "#FFF", color: "#3D3832", cursor: "pointer", outline: "none",
  };

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: "0.3s", opacity: 0 }}>
      {/* Filter row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", alignItems: "center", marginTop: 20 }}>
        {filterFields.map(ff => (
          <div key={ff.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#8B8378", whiteSpace: "nowrap" }}>{ff.label}</span>
            <select value={activeFilters[ff.key] || ""} onChange={(e) => setFilter(ff.key, e.target.value)}
              style={{ ...selectBaseStyle, minWidth: 80, maxWidth: 130 }}
              onFocus={(e) => { e.target.style.borderColor = "#A69888"; }}
              onBlur={(e) => { e.target.style.borderColor = "#D9D4CE"; }}>
              <option value="">全部</option>
              {(filterOptions[ff.key] || []).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ))}

        {/* Text search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", position: "relative" }}>
          <Search size={15} style={{ color: "#B8B0A4", position: "absolute", left: 10 }} />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="搜索..."
            style={{ padding: "7px 10px 7px 32px", border: "1px solid #D9D4CE", borderRadius: 8, fontSize: 13, backgroundColor: "#FFF", color: "#3D3832", width: 160, outline: "none" }}
            onFocus={(e) => { e.target.style.borderColor = "#A69888"; e.target.style.boxShadow = "0 0 0 3px rgba(166,152,136,0.12)"; }}
            onBlur={(e) => { e.target.style.borderColor = "#D9D4CE"; e.target.style.boxShadow = "none"; }} />
        </div>
      </div>

      {/* Items per page */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 12, color: "#A8A095" }}>每页</span>
        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ ...selectBaseStyle, padding: "4px 8px" }}>
          {itemsPerPageOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "#A8A095" }}>条</span>
        <span style={{ fontSize: 12, color: "#A8A095", marginLeft: 12 }}>
          {Object.values(activeFilters).some(v => v) || search ? `（已筛选 ${filteredData.length} 条）` : `共 ${filteredData.length} 条`}
        </span>
      </div>

      {/* Table */}
      <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid #E8E4DE", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "linear-gradient(135deg, #ECE7E0 0%, #E8E4DE 100%)" }}>
              {columns.map(col => (
                <th key={col.key} onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{ padding: "11px 13px", color: "#7A6E5F", fontSize: 12, fontWeight: 600, textTransform: "uppercase", textAlign: "left", cursor: col.sortable !== false ? "pointer" : "default", whiteSpace: "nowrap", letterSpacing: "0.03em", userSelect: "none", borderBottom: "1px solid #D9D4CE" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    {col.label}
                    {sortColumn === col.key && (sortDirection === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="data-row-hover"
                style={{ backgroundColor: idx % 2 === 0 ? "rgba(255,255,255,0.8)" : "rgba(245,242,238,0.6)", borderBottom: "1px solid rgba(233,228,222,0.6)", transition: "background-color 0.2s ease" }}>
                {columns.map(col => (
                  <td key={col.key} style={{ padding: "9px 13px", fontSize: 13, color: "#4A453F", whiteSpace: "nowrap" }}>{row[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 12, color: "#A8A095" }}>显示 {startEntry} 至 {endEntry} 条，共 {filteredData.length} 条</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
            style={{ padding: "5px 10px", border: "1px solid #D9D4CE", borderRadius: 8, fontSize: 12, backgroundColor: "#FFF", color: currentPage === 1 ? "#C4BDB3" : "#8B8378", cursor: currentPage === 1 ? "not-allowed" : "pointer" }}>上一页</button>
          {getPageNumbers().map((page, idx) =>
            typeof page === "string"
              ? <span key={idx} style={{ padding: "5px 6px", fontSize: 13, color: "#C4BDB3" }}>...</span>
              : <button key={page} onClick={() => goToPage(page)}
                style={{ padding: "5px 10px", border: "1px solid", borderRadius: 8, fontSize: 12, backgroundColor: currentPage === page ? "rgba(166,152,136,0.12)" : "#FFF", borderColor: currentPage === page ? "rgba(166,152,136,0.35)" : "#D9D4CE", color: currentPage === page ? "#7A6E5F" : "#8B8378", cursor: "pointer", minWidth: 32 }}>{page}</button>
          )}
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
            style={{ padding: "5px 10px", border: "1px solid #D9D4CE", borderRadius: 8, fontSize: 12, backgroundColor: "#FFF", color: currentPage === totalPages ? "#C4BDB3" : "#8B8378", cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}>下一页</button>
        </div>
      </div>
    </div>
  );
}
