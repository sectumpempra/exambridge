export type SpreadsheetCell = string | number | { value: string | number; type?: StringConstructor | NumberConstructor; fontWeight?: "bold" };

export interface SpreadsheetSheet {
  data: SpreadsheetCell[][];
  sheet: string;
  columns: { width: number }[];
  stickyRowsCount: number;
}

/** Prevent spreadsheet applications from interpreting exported text as formulas. */
export function sanitizeSpreadsheetValue(value: string | number): string | number {
  if (typeof value !== "string") return value;
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function buildObjectSheet(
  name: string,
  rows: Record<string, string | number>[],
  widths: number[],
): SpreadsheetSheet {
  const headers = rows.length > 0 ? Object.keys(rows[0]).filter((header) => !header.startsWith("_")) : [];
  const data: SpreadsheetCell[][] = [];
  if (headers.length > 0) {
    data.push(headers.map((header) => ({ value: header, type: String, fontWeight: "bold" })));
    for (const row of rows) {
      data.push(headers.map((header) => {
        const value = sanitizeSpreadsheetValue(row[header] ?? "");
        return typeof value === "number" ? { value, type: Number } : { value, type: String };
      }));
    }
  }
  return {
    data,
    sheet: name,
    columns: widths.map((width) => ({ width })),
    stickyRowsCount: headers.length > 0 ? 1 : 0,
  };
}
