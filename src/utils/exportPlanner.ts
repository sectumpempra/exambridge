import { format } from "date-fns";
import { toast } from "sonner";
import type { WeekGroup } from "../hooks/usePlanner";
import { buildObjectSheet } from "./excelExport";

/** Show export error toast (bug 3.16: replaces alert + void hack) */
function handleExportError(err: unknown, type: string): void {
  const msg = err instanceof Error ? err.message : String(err);
  toast.error(`${type} 导出失败`, {
    description: msg,
    duration: 4000,
  });
  console.error(`[exportPlanner] ${type} export failed:`, err);
}

// ── Excel 导出 ───────────────────────────────────────────────────────
export function exportToExcel(weeks: WeekGroup[], boardName?: string, studentName?: string): void {
  import("write-excel-file/browser")
    .then(async ({ default: writeExcelFile }) => {
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

      const prefix = boardName ? `${boardName}刷题计划` : "刷题计划";
      const suffix = studentName ? `_${studentName}` : "";
      await writeExcelFile([buildObjectSheet("刷题计划", rows, [14, 14, 12, 18, 18, 28])]).toFile(
        `${prefix}${suffix}_${format(new Date(), "yyyyMMdd")}.xlsx`,
      );
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
          } else if (day.isExamDay) {
            rows.push(new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(week.weekLabel)] }),
                new TableCell({ children: [new Paragraph(day.dateLabel)] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "考试日", color: "C17B5F" })] })] }),
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
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "—", color: "C17B5F" })] })] }),
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

          // Bug 3.17: use getImageProperties for robust multi-page pagination
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();

          let imgWidth: number;
          let imgHeight: number;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const jspdfPdf = pdf as any;
          if (jspdfPdf.getImageProperties) {
            try {
              const props = jspdfPdf.getImageProperties(imgData);
              const ratio = props.width / pageWidth;
              imgWidth = pageWidth;
              imgHeight = props.height / ratio;
            } catch {
              imgWidth = pageWidth;
              imgHeight = (canvas.height * imgWidth) / canvas.width;
            }
          } else {
            imgWidth = pageWidth;
            imgHeight = (canvas.height * imgWidth) / canvas.width;
          }

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
          throw new Error("PDF渲染失败: " + (err instanceof Error ? err.message : String(err)));
        });
    })
    .catch(err => handleExportError(err, "PDF"));
}
