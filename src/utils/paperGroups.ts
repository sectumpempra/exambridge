/**
 * Paper Grouping Utility
 * Groups paper variants (e.g. 9709/11+12+13 → Paper 1)
 */

export interface PaperGroup {
  label: string;
  description: string;
  paperNum: string;
  papers: { code: string; component: string; latestSeries?: string }[];
}

/** Extract paper number from a component string */
function extractPaperNum(component: string): string {
  if (!component) return "0";

  // 1. Pure 2-digit CAIE/OCR format: "01", "11", "12", "21" → first digit
  // "01" → "1" (Paper 1), "11" → "1" (Paper 1), "21" → "2" (Paper 2)
  if (/^\d{2}$/.test(component)) {
    const firstDigit = component[0];
    // "01", "02" etc. → treat as Paper 1, 2
    return firstDigit === "0" ? component[1] : firstDigit;
  }

  // 2. Edexcel GCSE descriptive: "Mathematics Paper 1H", "Mathematics Paper 01H"
  // Match one or more digits after "Paper "
  const paperMatch = component.match(/Paper\s+(\d+)/i);
  if (paperMatch) {
    // "Paper 01H" → "01" → "1", "Paper 1H" → "1"
    const num = paperMatch[1];
    return num.replace(/^0+/, "") || "0";
  }

  // 3. Fallback: first digit in the string
  const digitMatch = component.match(/(\d)/);
  if (digitMatch) return digitMatch[1];

  return component;
}

/** Paper number display names for 9709 */
const P9709_NAMES: Record<string, { label: string; desc: string }> = {
  "1": { label: "Paper 1", desc: "纯数学1 (P1)" },
  "2": { label: "Paper 2", desc: "纯数学2 (P2)" },
  "3": { label: "Paper 3", desc: "纯数学3 (P3)" },
  "4": { label: "Paper 4", desc: "力学 (M1)" },
  "5": { label: "Paper 5", desc: "概率统计1 (S1)" },
  "6": { label: "Paper 6", desc: "概率统计2 (S2)" },
};

/** Paper number display names for 9231 */
const P9231_NAMES: Record<string, { label: string; desc: string }> = {
  "1": { label: "Paper 1", desc: "进阶纯数学1 (FP1)" },
  "2": { label: "Paper 2", desc: "进阶纯数学2 (FP2)" },
  "3": { label: "Paper 3", desc: "进阶力学 (FM)" },
  "4": { label: "Paper 4", desc: "进阶统计 (FS)" },
};

/** Generic paper names */
const GENERIC_NAMES: Record<string, string> = {
  "1": "Paper 1", "2": "Paper 2", "3": "Paper 3", "4": "Paper 4",
  "5": "Paper 5", "6": "Paper 6", "7": "Paper 7", "8": "Paper 8",
  "9": "Paper 9", "0": "Paper 0",
};

/** Normalize component display name
 * Edexcel GCSE: "Mathematics Paper 01H" → "1H"
 * OCR 6993: "Y533" → "Y533" (keep as-is, label comes from config)
 * CAIE 2-digit: "11", "21" → keep as-is
 */
export function normalizeComponentDisplay(component: string): string {
  // Edexcel GCSE style: "Mathematics Paper 01H" → extract "01H" → "1H"
  const match = component.match(/Paper\s+(\d+[A-Z]+)/i);
  if (match) {
    const raw = match[1]; // e.g. "01H", "1H", "01HR"
    // Strip leading zeros: "01H" → "1H", "01HR" → "1HR"
    return raw.replace(/^0+/, "") || raw;
  }
  // OCR option codes: Y533, Y534, Y535 → keep as-is (labels from config)
  if (/^Y\d{3}$/i.test(component)) {
    return component;
  }
  // CAIE 2-digit style: "11", "21" → keep as-is
  if (/^\d{2}$/.test(component)) {
    return component;
  }
  // Edexcel AL descriptive names: "Pure Mathematics 1", "Mechanics M1" → keep as-is
  if (component.length > 5 && /[a-zA-Z]/.test(component)) {
    return component;
  }
  return component;
}

/** Group papers by their logical paper number */
export function groupPapers(
  papers: { code: string; component: string; latestSeries?: string }[],
  _board: string,
  _level: string,
  subjectCode: string,
): PaperGroup[] {
  const groups: Record<string, PaperGroup> = {};

  for (const paper of papers) {
    let paperNum: string;

    // OCR 6993 (FSMQ): component "01" → Paper 1
    if (subjectCode === "6993") {
      paperNum = "1";
    } else {
      paperNum = extractPaperNum(paper.component);
    }

    let label: string;
    let description: string;

    // Subject-specific naming
    if (subjectCode === "9709") {
      const info = P9709_NAMES[paperNum] || { label: `Paper ${paperNum}`, desc: "" };
      label = info.label;
      description = info.desc;
    } else if (subjectCode === "9231") {
      const info = P9231_NAMES[paperNum] || { label: `Paper ${paperNum}`, desc: "" };
      label = info.label;
      description = info.desc;
    } else if (subjectCode === "4MA1" || subjectCode === "1MA1") {
      label = GENERIC_NAMES[paperNum] || `Paper ${paperNum}`;
      description = "";
    } else {
      label = GENERIC_NAMES[paperNum] || `Paper ${paperNum}`;
      description = "";
    }

    if (!groups[paperNum]) {
      groups[paperNum] = { label, description, paperNum, papers: [] };
    }
    groups[paperNum].papers.push(paper);
  }

  // Sort by paper number
  return Object.values(groups).sort((a, b) => parseInt(a.paperNum) - parseInt(b.paperNum));
}
