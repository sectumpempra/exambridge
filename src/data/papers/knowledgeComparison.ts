import type { PaperMetadata } from "./paperMetadata";

export interface KnowledgePaperSelection {
  subjectCode: string;
  paper: string;
}

/** Map Paper query metadata to the canonical v3.2 knowledge-tree identifiers. */
export function getKnowledgeSelectionForPaper(paper: PaperMetadata): KnowledgePaperSelection | null {
  if (paper.board === "CAIE" && ["9709", "0580"].includes(paper.subjectCode)) {
    return { subjectCode: `CAIE-${paper.subjectCode}`, paper: `P${paper.paperNumber}` };
  }

  if (paper.board === "Edexcel" && paper.subjectCode === "4MA1") {
    return { subjectCode: "Edexcel-4MA1", paper: paper.paperNumber };
  }

  if (paper.board === "Edexcel" && paper.subjectCode === "WMA") {
    return { subjectCode: "Edexcel-IAL", paper: paper.paperNumber };
  }

  return null;
}

export function buildKnowledgeComparisonHref(
  paperA: PaperMetadata,
  paperB?: PaperMetadata,
): string | null {
  const selectionA = getKnowledgeSelectionForPaper(paperA);
  if (!selectionA) return null;

  const params = new URLSearchParams({
    subjectA: selectionA.subjectCode,
    paperA: selectionA.paper,
  });

  if (paperB) {
    const selectionB = getKnowledgeSelectionForPaper(paperB);
    if (!selectionB) return null;
    params.set("subjectB", selectionB.subjectCode);
    params.set("paperB", selectionB.paper);
  }

  return `/knowledge-tree?${params.toString()}`;
}
