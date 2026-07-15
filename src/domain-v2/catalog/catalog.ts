/**
 * ExamCatalog — Read-only query interface for canonical catalog.
 *
 * All domain engines access catalog data through this interface.
 * No direct access to raw JSON files.
 */

import type {
  Qualification,
  SpecificationVersion,
  AssessmentUnit,
  Paper,
  PaperVariant,
  BoundarySet,
  AwardRoute,
  GradingScale,
  AggregationPolicy,
  GradePolicy,
  AStarPolicy,
  CalculationPolicy,
  ExamCatalog,
  ExamSitting,
} from "./schema";

// ── Filter types ───────────────────────────────────────────────────────────

export interface QualificationFilter {
  boardId?: string;
  level?: string;
  subjectCode?: string;
}

export interface BoundaryQuery {
  unitId?: string;
  paperVariantId?: string;
  qualificationId?: string;
  series: string;
}

export type BoundaryLookupResult =
  | { kind: "FOUND"; boundary: BoundarySet }
  | { kind: "NOT_FOUND" }
  | { kind: "AMBIGUOUS"; candidates: BoundarySet[] };

export interface SittingFilter {
  paperVariantId?: string;
  series?: string;
  fromDate?: string;
  toDate?: string;
}

export type EntityKind =
  | "board"
  | "qualification"
  | "specification"
  | "unit"
  | "paper"
  | "paperVariant"
  | "sitting"
  | "boundarySet"
  | "route"
  | "gradingScale"
  | "aggregationPolicy"
  | "gradePolicy"
  | "aStarPolicy"
  | "calculationPolicy";

export type ResolveResult =
  | { kind: "FOUND"; id: string }
  | { kind: "NOT_FOUND" }
  | { kind: "AMBIGUOUS"; candidates: string[] };

// ── Catalog interface ──────────────────────────────────────────────────────

export class Catalog {
  private data: ExamCatalog;

  // Indexes for fast lookups
  private qualificationById = new Map<string, Qualification>();
  private specById = new Map<string, SpecificationVersion>();
  private unitById = new Map<string, AssessmentUnit>();
  private paperById = new Map<string, Paper>();
  private variantById = new Map<string, PaperVariant>();
  private sittingById = new Map<string, ExamSitting>();
  private boundaryById = new Map<string, BoundarySet>();
  private routeById = new Map<string, AwardRoute>();
  private scaleById = new Map<string, GradingScale>();
  private aggPolicyById = new Map<string, AggregationPolicy>();
  private gradePolicyById = new Map<string, GradePolicy>();
  private aStarPolicyById = new Map<string, AStarPolicy>();
  private calcPolicyById = new Map<string, CalculationPolicy>();

  // Cross-entity indexes
  private unitsBySpec = new Map<string, AssessmentUnit[]>();
  private papersByUnit = new Map<string, Paper[]>();
  private variantsByPaper = new Map<string, PaperVariant[]>();
  private boundariesByUnitSeries = new Map<string, BoundarySet[]>();
  private routesBySpec = new Map<string, AwardRoute[]>();
  private aliases = new Map<string, Map<string, string[]>>(); // kind -> alias -> ids

  constructor(catalog: ExamCatalog) {
    this.data = catalog;
    this.buildIndexes();
  }

  private buildIndexes(): void {
    for (const board of this.data.boards) {
      this.indexAliases("board", board.id, [board.code, board.name, ...board.aliases]);
    }
    for (const q of this.data.qualifications) {
      this.qualificationById.set(q.id, q);
      this.indexAliases("qualification", q.id, [q.subjectCode, q.subjectName]);
    }
    for (const s of this.data.specifications) {
      this.specById.set(s.id, s);
      this.indexAliases("specification", s.id, [s.label]);
      this.unitsBySpec.set(s.id, []);
      this.routesBySpec.set(s.id, []);
    }
    for (const u of this.data.units) {
      this.unitById.set(u.id, u);
      this.indexAliases("unit", u.id, [u.code, u.name, ...u.aliases]);
      const specUnits = this.unitsBySpec.get(u.specificationId);
      if (specUnits) specUnits.push(u);
    }
    for (const p of this.data.papers) {
      this.paperById.set(p.id, p);
      this.indexAliases("paper", p.id, [p.numberOrCode, p.name]);
      if (p.unitId) {
        const unitPapers = this.papersByUnit.get(p.unitId) ?? [];
        unitPapers.push(p);
        this.papersByUnit.set(p.unitId, unitPapers);
      }
    }
    for (const v of this.data.paperVariants) {
      this.variantById.set(v.id, v);
      this.indexAliases("paperVariant", v.id, [v.code, ...v.aliases]);
      const paperVars = this.variantsByPaper.get(v.paperId) ?? [];
      paperVars.push(v);
      this.variantsByPaper.set(v.paperId, paperVars);
    }
    for (const s of this.data.sittings) {
      this.sittingById.set(s.id, s);
    }
    for (const b of this.data.boundarySets) {
      this.boundaryById.set(b.id, b);
      const key = `${b.unitId ?? b.paperVariantId}-${b.series}`;
      const existing = this.boundariesByUnitSeries.get(key) ?? [];
      existing.push(b);
      this.boundariesByUnitSeries.set(key, existing);
    }
    for (const r of this.data.routes) {
      this.routeById.set(r.id, r);
      const specRoutes = this.routesBySpec.get(r.specificationId);
      if (specRoutes) specRoutes.push(r);
    }
    for (const s of this.data.gradingScales) {
      this.scaleById.set(s.id, s);
    }
    for (const a of this.data.aggregationPolicies) {
      this.aggPolicyById.set(a.id, a);
    }
    for (const g of this.data.gradePolicies) {
      this.gradePolicyById.set(g.id, g);
    }
    for (const a of this.data.aStarPolicies) {
      this.aStarPolicyById.set(a.id, a);
    }
    for (const c of this.data.calculationPolicies) {
      this.calcPolicyById.set(c.id, c);
    }
  }

  private indexAliases(kind: EntityKind, id: string, aliases: string[]): void {
    let kindAliases = this.aliases.get(kind);
    if (!kindAliases) {
      kindAliases = new Map<string, string[]>();
      this.aliases.set(kind, kindAliases);
    }
    for (const alias of aliases) {
      const normalized = alias.trim().toLowerCase();
      if (!normalized) continue;
      const ids = kindAliases.get(normalized) ?? [];
      if (!ids.includes(id)) ids.push(id);
      kindAliases.set(normalized, ids);
    }
  }

  // ── Getters ──

  getQualification(id: string): Qualification | undefined {
    return this.qualificationById.get(id);
  }

  getSpecification(id: string): SpecificationVersion | undefined {
    return this.specById.get(id);
  }

  getUnit(id: string): AssessmentUnit | undefined {
    return this.unitById.get(id);
  }

  getPaper(id: string): Paper | undefined {
    return this.paperById.get(id);
  }

  getPaperVariant(id: string): PaperVariant | undefined {
    return this.variantById.get(id);
  }

  getSitting(id: string): ExamSitting | undefined {
    return this.sittingById.get(id);
  }

  getBoundarySet(id: string): BoundarySet | undefined {
    return this.boundaryById.get(id);
  }

  getRoute(id: string): AwardRoute | undefined {
    return this.routeById.get(id);
  }

  getGradingScale(id: string): GradingScale | undefined {
    return this.scaleById.get(id);
  }

  getAggregationPolicy(id: string): AggregationPolicy | undefined {
    return this.aggPolicyById.get(id);
  }

  getGradePolicy(id: string): GradePolicy | undefined {
    return this.gradePolicyById.get(id);
  }

  getAStarPolicy(id: string): AStarPolicy | undefined {
    return this.aStarPolicyById.get(id);
  }

  getCalculationPolicy(id: string): CalculationPolicy | undefined {
    return this.calcPolicyById.get(id);
  }

  // ── List queries ──

  listQualifications(filter?: QualificationFilter): Qualification[] {
    let results = this.data.qualifications;
    if (filter?.boardId) {
      results = results.filter((q) => q.boardId === filter.boardId);
    }
    if (filter?.level) {
      results = results.filter((q) => q.level === filter.level);
    }
    if (filter?.subjectCode) {
      results = results.filter((q) => q.subjectCode === filter.subjectCode);
    }
    return results;
  }

  listUnits(specificationId: string): AssessmentUnit[] {
    return this.unitsBySpec.get(specificationId) ?? [];
  }

  listPapers(unitId: string): Paper[] {
    return this.papersByUnit.get(unitId) ?? [];
  }

  listPaperVariants(paperId: string): PaperVariant[] {
    return this.variantsByPaper.get(paperId) ?? [];
  }

  listRoutes(specificationId: string): AwardRoute[] {
    return this.routesBySpec.get(specificationId) ?? [];
  }

  // ── Boundary lookup ──

  getBoundary(query: BoundaryQuery): BoundaryLookupResult {
    const key = `${query.unitId ?? query.paperVariantId}-${query.series}`;
    const candidates = this.boundariesByUnitSeries.get(key) ?? [];

    if (candidates.length === 0) return { kind: "NOT_FOUND" };
    if (candidates.length === 1) return { kind: "FOUND", boundary: candidates[0] };
    return { kind: "AMBIGUOUS", candidates };
  }

  // ── Alias resolution ──

  resolveAlias(kind: EntityKind, alias: string): ResolveResult {
    const kindAliases = this.aliases.get(kind);
    if (!kindAliases) return { kind: "NOT_FOUND" };

    const ids = kindAliases.get(alias.toLowerCase());
    if (!ids || ids.length === 0) return { kind: "NOT_FOUND" };
    if (ids.length === 1) return { kind: "FOUND", id: ids[0] };
    return { kind: "AMBIGUOUS", candidates: ids };
  }

  // ── Specification for series ──

  getSpecificationForSeries(qualificationId: string, series: string): SpecificationVersion | undefined {
    const qual = this.qualificationById.get(qualificationId);
    if (!qual) return undefined;

    // Extract year from series (e.g. "2025-june" -> 2025)
    const yearMatch = series.match(/^(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : 0;

    for (const specId of qual.specificationIds) {
      const spec = this.specById.get(specId);
      if (!spec) continue;

      const fromYear = parseInt(spec.validFrom.substring(0, 4));
      const toYear = spec.validTo ? parseInt(spec.validTo.substring(0, 4)) : 9999;

      if (year >= fromYear && year < toYear) {
        return spec;
      }
    }
    return undefined;
  }

  // ── Raw access (for adapters/ETL only) ──

  get rawCatalog(): ExamCatalog {
    return this.data;
  }
}
