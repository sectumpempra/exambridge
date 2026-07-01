import { format } from "date-fns";
import type { WeekGroup } from "../hooks/usePlanner";

/** Show export error alert */
function handleExportError(err: unknown, type: string): void {
  console.error(`${type} 导出失败:`, err);
  alert(`导出失败，请稍后重试\n${err instanceof Error ? err.message : ""}`);
}

// ── Excel 导出 ───────────────────────────────────────────────────────
export function exportToExcel(weeks: WeekGroup[], boardName?: string, studentName?: string): void {
  import("xlsx")
    .then(XLSX => {
      const rows: Record<string, string | number>[] = [];
      weeks.forEach(week => {
        week.days.forEach(day => {
          if (day.isRestDay) {
            rows.push({
              周: week.weekLabel,
              日期: day.dateLabel,
              类型: "休息日",
              科目: "",
              Paper: "",
              试卷: "",
            });
          } else if (day.isExamDay) {
            rows.push({
              周: week.weekLabel,
              日期: day.dateLabel,
              类型: "考试日",
              科目: "",
              Paper: "",
              试卷: "",
            });
          } else {
            day.papers.forEach(p => {
              rows.push({
                周: week.weekLabel,
                日期: day.dateLabel,
                类型: "刷题",
                科目: p.subjectCode,
                Paper: p.paperCode,
                试卷: p.pastPaper,
              });
            });
            if (day.papers.length === 0) {
              rows.push({
                周: week.weekLabel,
                日期: day.dateLabel,
                类型: "空闲",
                科目: "",
                Paper: "",
                试卷: "",
              });
            }
          }
        });
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "刷题计划");
      const prefix = boardName ? `${boardName}刷题计划` : "刷题计划";
      const suffix = studentName ? `_${studentName}` : "";
      XLSX.writeFile(wb, `${prefix}${suffix}_${format(new Date(), "yyyyMMdd")}.xlsx`);
    })
    .catch(err => handleExportError(err, "Excel"));
}

// ── Word 导出 ────────────────────────────────────────────────────────
export function exportToWord(weeks: WeekGroup[], boardName?: string, studentName?: string): void {
  import("docx")
    .then(docx => {
      const { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, AlignmentType } = docx;

      const rows: InstanceType<typeof TableRow>[] = [];

      // Header
      rows.push(new TableRow({
        children: ["周", "日期", "科目", "Paper", "试卷", "状态"].map(
          h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          })
        ),
      }));

      weeks.forEach(week => {
        week.days.forEach(day => {
          if (day.isRestDay) {
            rows.push(new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(week.weekLabel)] }),
                new TableCell({ children: [new Paragraph(day.dateLabel)] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "休息日", color: "5A7A6A" })] })] }),
                new TableCell({ children: [new Paragraph("")] }),
                new TableCell({ children: [new Paragraph("")] }),
                new TableCell({ children: [new Paragraph("")] }),
              ],
            }));
          } else if (day.papers.length === 0) {
            rows.push(new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(week.weekLabel)] }),
                new TableCell({ children: [new Paragraph(day.dateLabel)] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: day.isExamDay ? "考试日" : "—", color: "C17B5F" })] })] }),
                new TableCell({ children: [new Paragraph("")] }),
                new TableCell({ children: [new Paragraph("")] }),
                new TableCell({ children: [new Paragraph("")] }),
              ],
            }));
          } else {
            day.papers.forEach(p => {
              rows.push(new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(week.weekLabel)] }),
                  new TableCell({ children: [new Paragraph(day.dateLabel)] }),
                  new TableCell({ children: [new Paragraph(p.subjectCode)] }),
                  new TableCell({ children: [new Paragraph(p.paperCode)] }),
                  new TableCell({ children: [new Paragraph(p.pastPaper)] }),
                  new TableCell({ children: [new Paragraph("")] }),
                ],
              }));
            });
          }
        });
      });

      const titleText = boardName ? `${boardName} A-Level 刷题计划` : "A-Level 刷题计划";
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: titleText, bold: true, size: 32 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
          ],
        }],
      });

      return Packer.toBlob(doc);
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        const prefix = boardName ? `${boardName}刷题计划` : "刷题计划";
        const suffix = studentName ? `_${studentName}` : "";
        a.download = `${prefix}${suffix}_${format(new Date(), "yyyyMMdd")}.docx`;
        a.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    })
    .catch(err => handleExportError(err, "Word"));
}

// ── PDF 导出 ─────────────────────────────────────────────────────────
export function exportToPDF(elementId: string, boardName?: string, studentName?: string): void {
  // xlsx import placeholder for future Excel export feature
  void import("xlsx").catch(() => null);

  Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ])
    .then(([html2canvas, jsPDF]) => {
      const el = document.getElementById(elementId);
      if (!el) throw new Error("找不到导出内容");

      return html2canvas
        .default(el, { scale: 2, useCORS: true, logging: false })
        .then(canvas => {
          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF.jsPDF("p", "mm", "a4");
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = pageWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          let heightLeft = imgHeight;
          let position = 0;

          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;

          while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }

          const prefix = boardName ? `${boardName}刷题计划` : "刷题计划";
          const suffix = studentName ? `_${studentName}` : "";
          pdf.save(`${prefix}${suffix}_${format(new Date(), "yyyyMMdd")}.pdf`);
        })
        .catch(err => {
          console.error("html2canvas 渲染失败:", err);
          throw new Error("PDF渲染失败: " + (err instanceof Error ? err.message : String(err)));
        });
    })
    .catch(err => handleExportError(err, "PDF"));
}
