/**
 * Subject Grouping for Planner
 * Groups units by subject area (e.g. all WMA/WFM/WME/WST/WDM → Mathematics)
 * For Edexcel AL: units are grouped by 3-letter prefix
 */

export interface UnitItem {
  code: string;        // e.g. "WMA11"
  name: string;        // e.g. "Pure Mathematics 1"
  category: string;    // e.g. "math"
  papers: { code: string; component: string; latestSeries?: string }[];
}

export interface SubjectGroup {
  category: string;
  categoryLabel: string;
  subjectName: string;  // e.g. "Mathematics"
  units: UnitItem[];
}

// ── Edexcel AL Unit Names ──────────────────────────────────────────
const EDEXCEL_AL_UNIT_NAMES: Record<string, string> = {
  // Mathematics
  WMA11: "Pure Mathematics 1 纯数学1",
  WMA12: "Pure Mathematics 2 纯数学2",
  WMA13: "Pure Mathematics 3 纯数学3",
  WMA14: "Pure Mathematics 4 纯数学4",
  WMA01: "Core Mathematics C12",
  WMA02: "Core Mathematics C34",
  // Further Mathematics
  WFM01: "Further Pure Mathematics 1 进阶纯数1",
  WFM02: "Further Pure Mathematics 2 进阶纯数2",
  WFM03: "Further Pure Mathematics 3 进阶纯数3",
  // Mechanics
  WME01: "Mechanics 1 力学1",
  WME02: "Mechanics 2 力学2",
  WME03: "Mechanics 3 力学3",
  // Statistics
  WST01: "Statistics 1 统计1",
  WST02: "Statistics 2 统计2",
  WST03: "Statistics 3 统计3",
  // Decision Math
  WDM01: "Decision Mathematics 1 决策数学1",
  WDM11: "Decision Mathematics D1 决策数学D1",
  // Physics
  WPH11: "Physics 1 物理1",
  WPH12: "Physics 2 物理2",
  WPH13: "Physics 3 物理3",
  WPH14: "Physics 4 物理4",
  WPH15: "Physics 5 物理5",
  WPH16: "Physics 6 物理6",
  // Chemistry
  WCH11: "Chemistry 1 化学1",
  WCH12: "Chemistry 2 化学2",
  WCH13: "Chemistry 3 化学3",
  WCH14: "Chemistry 4 化学4",
  WCH15: "Chemistry 5 化学5",
  WCH16: "Chemistry 6 化学6",
  WCH01: "Core Principles of Chemistry",
  WCH02: "Application of Core Principles",
  WCH03: "Chemistry Lab Skills I",
  WCH04: "General Principles I",
  WCH05: "General Principles II",
  WCH06: "Chemistry Lab Skills II",
  WCH07: "Chemistry Practical Exam",
  // Biology
  WBI11: "Biology 1 生物1",
  WBI12: "Biology 2 生物2",
  WBI13: "Biology 3 生物3",
  WBI14: "Biology 4 生物4",
  WBI15: "Biology 5 生物5",
  WBI16: "Biology 6 生物6",
  WBI01: "Lifestyle, Transport, Genes & Health",
  WBI02: "Development, Plants & Environment",
  WBI03: "Practical Biology & Research",
  WBI04: "Natural Environment & Species Survival",
  WBI05: "Energy, Exercise & Coordination",
  WBI06: "Practical Biology & Investigative",
  // Economics
  WEC11: "Economics 1 经济1",
  WEC12: "Economics 2 经济2",
  WEC13: "Economics 3 经济3",
  WEC14: "Economics 4 经济4",
  // Business
  WBS11: "Business 1 商业1",
  WBS12: "Business 2 商业2",
  WBS13: "Business 3 商业3",
  WBS14: "Business 4 商业4",
  WBS01: "Business Enterprise",
  WBS02: "Business Structures & Processes",
  WBS03: "Strategic Business Decisions",
  WBS04: "Business in a Global Context",
  // Accounting
  WAC11: "Accounting 1 会计1",
  WAC12: "Accounting 2 会计2",
  WAC01: "The Accounting System & Costing",
  WAC02: "Corporate & Management Accounting",
  // Arabic
  WAA01: "Arabic: Understanding & Written Response",
  WAA02: "Arabic: Research, Writing & Research",
};

/** Get display name for a unit code */
export function getUnitName(code: string): string {
  return EDEXCEL_AL_UNIT_NAMES[code] || code;
}

/** Group Edexcel AL units by subject area */
export function groupEdexcelALUnits(
  subjects: Record<string, { name: string; papers: { code: string; component: string; latestSeries?: string }[] }>
): SubjectGroup[] {
  // Define subject area mappings
  const areaMap: Record<string, { category: string; categoryLabel: string; subjectName: string }> = {
    WMA: { category: "math", categoryLabel: "数学", subjectName: "Mathematics" },
    WFM: { category: "math", categoryLabel: "数学", subjectName: "Further Mathematics" },
    WME: { category: "math", categoryLabel: "数学", subjectName: "Mechanics" },
    WST: { category: "math", categoryLabel: "数学", subjectName: "Statistics" },
    WDM: { category: "math", categoryLabel: "数学", subjectName: "Decision Mathematics" },
    WPH: { category: "physics", categoryLabel: "物理", subjectName: "Physics" },
    WCH: { category: "chemistry", categoryLabel: "化学", subjectName: "Chemistry" },
    WBI: { category: "biology", categoryLabel: "生物", subjectName: "Biology" },
    WEC: { category: "economics", categoryLabel: "经济", subjectName: "Economics" },
    WBS: { category: "business", categoryLabel: "商业", subjectName: "Business" },
    WAC: { category: "accounting", categoryLabel: "会计", subjectName: "Accounting" },
    WAA: { category: "language", categoryLabel: "语言", subjectName: "Arabic" },
  };

  // Group units
  const groups: Record<string, SubjectGroup> = {};

  for (const [code, subj] of Object.entries(subjects)) {
    const prefix = code.substring(0, 3);
    const area = areaMap[prefix];
    if (!area) continue;

    const groupKey = `${area.category}_${area.subjectName}`;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        category: area.category,
        categoryLabel: area.categoryLabel,
        subjectName: area.subjectName,
        units: [],
      };
    }

    groups[groupKey].units.push({
      code,
      name: getUnitName(code),
      category: area.category,
      papers: subj.papers,
    });
  }

  // Sort units within each group
  for (const g of Object.values(groups)) {
    g.units.sort((a, b) => a.code.localeCompare(b.code));
  }

  // Sort groups by category order
  const catOrder: Record<string, number> = {
    math: 0, physics: 1, chemistry: 2, biology: 3,
    economics: 4, business: 5, accounting: 6, language: 7,
  };

  return Object.values(groups).sort((a, b) => {
    const oa = catOrder[a.category] ?? 99;
    const ob = catOrder[b.category] ?? 99;
    return oa - ob;
  });
}

/** Check if a board needs subject grouping (Edexcel AL only) */
export function needsSubjectGrouping(board: string, level: string): boolean {
  return board === "Edexcel" && level === "A-Level";
}
