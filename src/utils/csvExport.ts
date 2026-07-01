/** Escape a CSV field: wrap in quotes if it contains comma, quote, or newline */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.map(escapeCsv).join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          const stringValue =
            value === null || value === undefined ? "" : String(value);
          return escapeCsv(stringValue);
        })
        .join(",")
    ),
  ];

  const csvContent = "\uFEFF" + csvRows.join("\n");  // BOM prefix for Excel UTF-8
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
