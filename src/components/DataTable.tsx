import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, string | number>[];
  itemsPerPageOptions?: number[];
  filterFields?: { key: string; label: string }[];
}

/** Extract unique values for a field (preserves 0, excludes null/undefined/"") */
function getUniqueValues(
  data: Record<string, string | number>[],
  key: string
): string[] {
  const vals = new Set<string>();
  data.forEach((r) => {
    const raw = r[key];
    if (raw !== null && raw !== undefined && raw !== "") {
      vals.add(String(raw));
    }
  });
  return Array.from(vals).sort();
}

export default function DataTable({
  columns,
  data,
  itemsPerPageOptions = [10, 25, 50, 100],
  filterFields = [],
}: DataTableProps) {
  const [search, setSearch] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  /* Dropdown options */
  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    filterFields.forEach((ff) => {
      opts[ff.key] = getUniqueValues(data, ff.key);
    });
    return opts;
  }, [data, filterFields]);

  const handleSort = useCallback(
    (columnKey: string) => {
      if (sortColumn === columnKey) {
        if (sortDirection === "asc") setSortDirection("desc");
        else {
          setSortColumn(null);
          setSortDirection("asc");
        }
      } else {
        setSortColumn(columnKey);
        setSortDirection("asc");
      }
    },
    [sortColumn, sortDirection]
  );

  const setFilter = (key: string, value: string) => {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  /* Filtered + sorted + paginated data */
  const filteredData = useMemo(() => {
    let result = [...data];
    // Dropdown filters
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(
          (r) => String(r[key]).toLowerCase() === value.toLowerCase()
        );
      }
    });
    // Text search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        Object.values(r).some((v) =>
          String(v).toLowerCase().includes(s)
        )
      );
    }
    // Sort
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn],
          bVal = b[sortColumn];
        const aNum = Number(aVal),
          bNum = Number(bVal);
        if (
          !isNaN(aNum) &&
          !isNaN(bNum) &&
          aVal !== "" &&
          bVal !== ""
        ) {
          return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
        }
        const aStr = String(aVal).toLowerCase(),
          bStr = String(bVal).toLowerCase();
        if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
        if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, search, sortColumn, sortDirection, activeFilters]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredData.length / itemsPerPage)
  );
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const startEntry =
    filteredData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(
    currentPage * itemsPerPage,
    filteredData.length
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const s = Math.max(2, currentPage - 1),
        e = Math.min(totalPages - 1, currentPage + 1);
      for (let i = s; i <= e; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  /* Column width helper */
  const getColWidth = (key: string) => {
    const k = key.toLowerCase();
    if (k === "subject" || k === "unit") return "20%";
    if (k === "code" || k === "subjectcode") return "9%";
    if (k === "year") return "7%";
    if (k === "session" || k === "series") return "8%";
    if (k === "component") return "8%";
    if (k === "maxmark" || k === "max_mark" || k === "maxrawmark")
      return "7%";
    return "7%";
  };

  /* Shared input/select base classes */
  const inputBase =
    "rounded-lg border border-[#D9D4CE] bg-white text-[13px] text-[#3D3832] outline-none transition-colors focus:border-[#A69888] focus:ring-2 focus:ring-[rgba(166,152,136,0.12)]";

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: "0.3s", opacity: 0 }}>
      {/* ── Filter row ────────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        {filterFields.map((ff) => (
          <div key={ff.key} className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-xs text-[#8B8378]">
              {ff.label}
            </span>
            <select
              value={activeFilters[ff.key] || ""}
              onChange={(e) => setFilter(ff.key, e.target.value)}
              className={cn(inputBase, "min-w-[80px] max-w-[130px] px-2.5 py-1.5")}
            >
              <option value="">全部</option>
              {(filterOptions[ff.key] || []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Text search */}
        <div className="relative ml-auto flex items-center">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 text-[#B8B0A4]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="搜索..."
            className={cn(inputBase, "w-40 py-1.5 pl-8 pr-2.5")}
          />
        </div>
      </div>

      {/* ── Items per page ────────────────────────── */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-xs text-[#A8A095]">每页</span>
        <select
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
          className={cn(inputBase, "px-2 py-1")}
        >
          {itemsPerPageOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="text-xs text-[#A8A095]">条</span>
        <span className="ml-3 text-xs text-[#A8A095]">
          {Object.values(activeFilters).some((v) => v) || search
            ? `（已筛选 ${filteredData.length} 条）`
            : `共 ${filteredData.length} 条`}
        </span>
      </div>

      {/* ── Table (Card Container) ───────────────── */}
      <div className="mt-2.5 overflow-hidden rounded-xl border border-[#E8E4DE] bg-white shadow-[0_1px_6px_rgba(61,56,50,0.04)]">
        <div className="overflow-x-auto">
          <Table>
            <colgroup>
              {columns.map((col) => (
                <col key={col.key} style={{ width: getColWidth(col.key) }} />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-[#D9D4CE] bg-gradient-to-br from-[#ECE7E0] to-[#E8E4DE] hover:bg-gradient-to-br">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    onClick={() =>
                      col.sortable !== false && handleSort(col.key)
                    }
                    className={cn(
                      "cursor-pointer select-none whitespace-nowrap px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-[#7A6E5F]",
                      col.sortable === false && "cursor-default"
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {col.label}
                      {sortColumn === col.key &&
                        (sortDirection === "asc" ? (
                          <ChevronUp size={13} />
                        ) : (
                          <ChevronDown size={13} />
                        ))}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, idx) => (
                <TableRow
                  key={idx}
                  className={cn(
                    "border-b border-[rgba(233,228,222,0.6)] transition-colors duration-200 hover:bg-[rgba(166,152,136,0.04)]",
                    idx % 2 === 0
                      ? "bg-[rgba(255,255,255,0.8)]"
                      : "bg-[rgba(245,242,238,0.6)]"
                  )}
                >
                  {columns.map((col) => {
                    const val = row[col.key];
                    const display =
                      val === null || val === undefined || val === ""
                        ? "-"
                        : String(val);
                    const isSubjectName =
                      col.key.toLowerCase() === "subject" ||
                      col.key.toLowerCase() === "unit";
                    return (
                      <TableCell
                        key={col.key}
                        title={isSubjectName ? display : undefined}
                        className={cn(
                          "whitespace-nowrap px-2.5 py-2 text-center text-[13px]",
                          val === null || val === undefined
                            ? "text-[#B8B0A4]"
                            : "text-[#4A453F]",
                          isSubjectName &&
                            "max-w-[1px] overflow-hidden text-ellipsis"
                        )}
                      >
                        {display}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Pagination ────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-xs text-[#A8A095]">
          显示 {startEntry} 至 {endEntry} 条，共 {filteredData.length} 条
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
              currentPage === 1
                ? "cursor-not-allowed border-[#E8E4DE] text-[#C4BDB3]"
                : "border-[#D9D4CE] bg-white text-[#8B8378] hover:border-[#A69888] hover:text-[#8F7F6E]"
            )}
          >
            上一页
          </button>
          {getPageNumbers().map((page, idx) =>
            typeof page === "string" ? (
              <span
                key={idx}
                className="px-1.5 py-1.5 text-sm text-[#C4BDB3]"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={cn(
                  "min-w-[32px] rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                  currentPage === page
                    ? "border-[rgba(166,152,136,0.35)] bg-[rgba(166,152,136,0.12)] text-[#7A6E5F]"
                    : "border-[#D9D4CE] bg-white text-[#8B8378] hover:border-[#A69888] hover:text-[#8F7F6E]"
                )}
              >
                {page}
              </button>
            )
          )}
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
              currentPage === totalPages
                ? "cursor-not-allowed border-[#E8E4DE] text-[#C4BDB3]"
                : "border-[#D9D4CE] bg-white text-[#8B8378] hover:border-[#A69888] hover:text-[#8F7F6E]"
            )}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
