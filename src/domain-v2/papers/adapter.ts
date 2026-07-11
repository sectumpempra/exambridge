/**
 * Paper Catalog Adapter v2
 *
 * Provides paper search, detail, and syllabus queries on top of
 * the canonical Catalog. Eliminates duplicate paper descriptions
 * from paperMetadata.ts, paperBoundaries.ts, plannerData.json, examDates.ts.
 */

import type { Catalog } from "@/domain-v2/catalog/catalog";
import type { Paper, PaperVariant, BoundarySet, ExamSitting } from "@/domain-v2/catalog/schema";

export interface PaperSearchQuery {
  boardId?: string;
  qualificationId?: string;
  subjectCode?: string;
  search?: string;       // normalized text search
  paperType?: "WRITTEN" | "PRACTICAL" | "COURSEWORK" | "OTHER";
}

export interface PaperSearchResult {
  paperId: string;
  unitCode: string;
  name: string;
  qualificationId: string;
  qualificationName: string;
  rawMax?: number;
  paperType?: string;
}

export interface PaperDetail {
  paper: Paper;
  variants: PaperVariant[];
  qualificationName: string;
  unitName?: string;
}

export interface SeriesFilter {
  from?: string;   // YYYY-MM
  to?: string;     // YYYY-MM
  exact?: string;  // e.g. "2025-june"
}

/**
 * Search papers using the canonical catalog.
 */
export function searchPapers(catalog: Catalog, query: PaperSearchQuery): PaperSearchResult[] {
  let papers = catalog.rawCatalog.papers;

  // Filter by board
  if (query.boardId) {
    const quals = catalog.rawCatalog.qualifications.filter(
      (q) => q.boardId === query.boardId
    );
    const qualIds = new Set(quals.map((q) => q.id));
    papers = papers.filter((p) => qualIds.has(p.qualificationId));
  }

  // Filter by qualification
  if (query.qualificationId) {
    papers = papers.filter((p) => p.qualificationId === query.qualificationId);
  }

  // Filter by subjectCode
  const subjectCodeFilter = query.subjectCode;
  if (subjectCodeFilter) {
    const normalizedFilter = subjectCodeFilter.toLowerCase();
    const quals = catalog.rawCatalog.qualifications.filter(
      (q) => q.subjectCode.toLowerCase() === normalizedFilter
    );
    const qualIds = new Set(quals.map((q) => q.id));
    papers = papers.filter((p) => qualIds.has(p.qualificationId));
  }

  // Filter by paperType
  if (query.paperType) {
    papers = papers.filter((p) => p.paperType === query.paperType);
  }

  // Text search (normalized)
  if (query.search) {
    const normalized = query.search.toLowerCase().replace(/[-_\s]+/g, "");
    papers = papers.filter((p) => {
      const haystack = `${p.name} ${p.numberOrCode}`.toLowerCase().replace(/[-_\s]+/g, "");
      return haystack.includes(normalized);
    });
  }

  // Build results
  return papers.map((p) => {
    const qual = catalog.rawCatalog.qualifications.find(
      (q) => q.id === p.qualificationId
    );

    return {
      paperId: p.id,
      unitCode: p.numberOrCode,
      name: p.name,
      qualificationId: p.qualificationId,
      qualificationName: qual?.subjectName ?? "Unknown",
      rawMax: p.rawMax,
      paperType: p.paperType,
    };
  });
}

/**
 * Get detailed paper info.
 */
export function getPaperDetail(catalog: Catalog, paperId: string): PaperDetail | undefined {
  const paper = catalog.getPaper(paperId);
  if (!paper) return undefined;

  const variants = catalog.listPaperVariants(paperId);
  const qual = catalog.rawCatalog.qualifications.find(
    (q) => q.id === paper.qualificationId
  );
  const unit = paper.unitId ? catalog.getUnit(paper.unitId) : undefined;

  return {
    paper,
    variants,
    qualificationName: qual?.subjectName ?? "Unknown",
    unitName: unit?.name,
  };
}

/**
 * List paper variants.
 */
export function listPaperVariants(catalog: Catalog, paperId: string): PaperVariant[] {
  return catalog.listPaperVariants(paperId);
}

/**
 * List boundary sets for a paper.
 */
export function listPaperBoundaries(
  catalog: Catalog,
  paperId: string,
  filter?: SeriesFilter
): BoundarySet[] {
  const paper = catalog.getPaper(paperId);
  if (!paper) return [];

  // Find all boundary sets for this paper's unit
  let boundaries = catalog.rawCatalog.boundarySets.filter((b) => {
    if (b.unitId && paper.unitId) return b.unitId === paper.unitId;
    if (b.paperVariantId) {
      const variant = catalog.getPaperVariant(b.paperVariantId);
      return variant?.paperId === paperId;
    }
    return false;
  });

  // Apply series filter
  if (filter?.exact) {
    boundaries = boundaries.filter((b) => b.series === filter.exact);
  }
  if (filter?.from) {
    boundaries = boundaries.filter((b) => b.series >= filter.from!);
  }
  if (filter?.to) {
    boundaries = boundaries.filter((b) => b.series <= filter.to!);
  }

  return boundaries;
}

/**
 * List exam sittings for a paper.
 */
export function listExamSittings(
  catalog: Catalog,
  paperId: string,
  filter?: { from?: string; to?: string }
): ExamSitting[] {
  const paper = catalog.getPaper(paperId);
  if (!paper) return [];

  let sittings = catalog.rawCatalog.sittings.filter((s) => {
    const variant = catalog.getPaperVariant(s.paperVariantId);
    return variant?.paperId === paperId;
  });

  if (filter?.from) {
    sittings = sittings.filter((s) => s.localDate >= filter.from!);
  }
  if (filter?.to) {
    sittings = sittings.filter((s) => s.localDate <= filter.to!);
  }

  return sittings;
}

/**
 * Compare two papers.
 */
export interface PaperComparison {
  paperA: Paper;
  paperB: Paper;
  sameQualification: boolean;
  sameUnit: boolean;
}

export function comparePapers(catalog: Catalog, paperIdA: string, paperIdB: string): PaperComparison | undefined {
  const paperA = catalog.getPaper(paperIdA);
  const paperB = catalog.getPaper(paperIdB);
  if (!paperA || !paperB) return undefined;

  return {
    paperA,
    paperB,
    sameQualification: paperA.qualificationId === paperB.qualificationId,
    sameUnit: paperA.unitId === paperB.unitId && paperA.unitId !== undefined,
  };
}
