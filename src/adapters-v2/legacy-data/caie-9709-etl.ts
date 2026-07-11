/**
 * CAIE 9709 ETL Adapter — CAIE A-Level Mathematics
 *
 * Transforms raw caie_al.json records into canonical catalog entities.
 * ETL steps: parseRaw → normalize → link → validate
 *
 * Second vertical slice for Phase 5.
 */

import type {
  Board,
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
  CalculationPolicy,
  BoundaryThreshold,
} from "@/domain-v2/catalog/schema";
import * as ids from "@/domain-v2/catalog/ids";

// ── Raw data types ──

interface RawRecord {
  SubjectCode: string;
  Subject: string;
  Series: string;
  Component: string;
  MaxRawMark: number | null;
  A: number | null;
  B: number | null;
  C: number | null;
  D: number | null;
  E: number | null;
}

// ── Component → Paper mapping ──
// First digit = paper number, remaining = variant
const COMPONENT_TO_PAPER: Record<string, { paperNum: number; name: string }> = {
  // Paper 1: Pure Math 1
  "11": { paperNum: 1, name: "Pure Mathematics 1" },
  "12": { paperNum: 1, name: "Pure Mathematics 1" },
  "13": { paperNum: 1, name: "Pure Mathematics 1" },
  "15": { paperNum: 1, name: "Pure Mathematics 1" },
  // Paper 2: Pure Math 2
  "21": { paperNum: 2, name: "Pure Mathematics 2" },
  "22": { paperNum: 2, name: "Pure Mathematics 2" },
  "23": { paperNum: 2, name: "Pure Mathematics 2" },
  "25": { paperNum: 2, name: "Pure Mathematics 2" },
  // Paper 3: Pure Math 3
  "31": { paperNum: 3, name: "Pure Mathematics 3" },
  "32": { paperNum: 3, name: "Pure Mathematics 3" },
  "33": { paperNum: 3, name: "Pure Mathematics 3" },
  "34": { paperNum: 3, name: "Pure Mathematics 3" },
  "35": { paperNum: 3, name: "Pure Mathematics 3" },
  // Paper 4: Mechanics
  "41": { paperNum: 4, name: "Mechanics" },
  "42": { paperNum: 4, name: "Mechanics" },
  "43": { paperNum: 4, name: "Mechanics" },
  "45": { paperNum: 4, name: "Mechanics" },
  // Paper 5: Probability & Statistics 1
  "51": { paperNum: 5, name: "Probability & Statistics 1" },
  "52": { paperNum: 5, name: "Probability & Statistics 1" },
  "53": { paperNum: 5, name: "Probability & Statistics 1" },
  "55": { paperNum: 5, name: "Probability & Statistics 1" },
  "58": { paperNum: 5, name: "Probability & Statistics 1" },
  "59": { paperNum: 5, name: "Probability & Statistics 1" },
  // Paper 6: Probability & Statistics 2
  "61": { paperNum: 6, name: "Probability & Statistics 2" },
  "62": { paperNum: 6, name: "Probability & Statistics 2" },
  "63": { paperNum: 6, name: "Probability & Statistics 2" },
  "65": { paperNum: 6, name: "Probability & Statistics 2" },
  "68": { paperNum: 6, name: "Probability & Statistics 2" },
  "69": { paperNum: 6, name: "Probability & Statistics 2" },
};

const CAIE_SOURCE = {
  title: "CAIE A-Level Mathematics (9709) specification",
  publisher: "CAIE",
  url: "https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-international-a-level-mathematics-9709/",
  accessedAt: "2026-07-11",
};

// ── Step 1: Parse Raw ──

export function parseRaw(allRecords: unknown[]): { records: RawRecord[]; errors: string[] } {
  const records: RawRecord[] = [];
  const errors: string[] = [];

  for (let i = 0; i < allRecords.length; i++) {
    const r = allRecords[i] as Record<string, unknown>;
    if (!r || typeof r !== "object") {
      errors.push(`Record ${i}: not an object`);
      continue;
    }
    const subjectCode = String(r.SubjectCode ?? "");
    if (subjectCode !== "9709") continue;

    const component = String(r.Component ?? "");
    if (!COMPONENT_TO_PAPER[component]) {
      errors.push(`Record ${i}: unknown component ${component}`);
      continue;
    }

    records.push({
      SubjectCode: subjectCode,
      Subject: String(r.Subject ?? ""),
      Series: String(r.Series ?? ""),
      Component: component,
      MaxRawMark: r.MaxRawMark !== undefined && r.MaxRawMark !== null ? Number(r.MaxRawMark) : null,
      A: r.A !== undefined && r.A !== null ? Number(r.A) : null,
      B: r.B !== undefined && r.B !== null ? Number(r.B) : null,
      C: r.C !== undefined && r.C !== null ? Number(r.C) : null,
      D: r.D !== undefined && r.D !== null ? Number(r.D) : null,
      E: r.E !== undefined && r.E !== null ? Number(r.E) : null,
    });
  }

  return { records, errors };
}

// ── Step 2: Normalize ──

export function normalizeRecords(records: RawRecord[]): {
  grouped: Map<string, RawRecord[]>;
  paperNums: Set<number>;
} {
  // Group by paper number
  const grouped = new Map<string, RawRecord[]>();
  const paperNums = new Set<number>();

  for (const r of records) {
    const meta = COMPONENT_TO_PAPER[r.Component];
    if (!meta) continue;
    const paperKey = String(meta.paperNum);
    paperNums.add(meta.paperNum);
    if (!grouped.has(paperKey)) grouped.set(paperKey, []);
    grouped.get(paperKey)!.push(r);
  }

  return { grouped, paperNums };
}

// ── Step 3 & 4: Link and Build Catalog ──

export function buildCAIE9709Catalog(allRecords: unknown[]): {
  catalogPartial: {
    boards: Board[];
    qualifications: Qualification[];
    specifications: SpecificationVersion[];
    units: AssessmentUnit[];
    papers: Paper[];
    paperVariants: PaperVariant[];
    boundarySets: BoundarySet[];
    routes: AwardRoute[];
    gradingScales: GradingScale[];
    aggregationPolicies: AggregationPolicy[];
    gradePolicies: GradePolicy[];
    calculationPolicies: CalculationPolicy[];
  };
  warnings: Array<{ code: string; message: string }>;
  errors: Array<{ code: string; message: string }>;
} {
  const warnings: Array<{ code: string; message: string }> = [];
  const errors: Array<{ code: string; message: string }> = [];

  // Parse
  const { records, errors: parseErrors } = parseRaw(allRecords);
  parseErrors.forEach((e) => errors.push({ code: "PARSE_ERROR", message: e }));

  // Normalize
  const { grouped, paperNums } = normalizeRecords(records);

  // ── Board ──
  const board: Board = {
    id: ids.boardId("caie"),
    code: "CAIE",
    name: "Cambridge Assessment International Education",
    aliases: ["Cambridge", "CAIE", "CIE"],
  };

  // ── Grading Scale ──
  const gradingScale: GradingScale = {
    id: ids.gradingScaleId("caie-a-level-a-star-to-e"),
    name: "CAIE A-Level A*-E",
    kind: "A_STAR_TO_E",
    hasAStar: true,
    thresholds: [
      { grade: "A*", minMark: 90 },
      { grade: "A", minMark: 80 },
      { grade: "B", minMark: 70 },
      { grade: "C", minMark: 60 },
      { grade: "D", minMark: 50 },
      { grade: "E", minMark: 40 },
      { grade: "U", minMark: 0 },
    ],
    sources: [CAIE_SOURCE],
  };

  // ── Policies ──
  const aggregationPolicy: AggregationPolicy = {
    id: ids.aggregationPolicyId("caie-a-level-pum-average"),
    name: "CAIE A-Level PUM Average",
    method: "WEIGHTED_AVERAGE_PUM",
    description: "Average PUM across all papers in the route",
    sources: [CAIE_SOURCE],
  };

  const gradePolicy: GradePolicy = {
    id: ids.gradePolicyId("caie-9709-default"),
    name: "CAIE 9709 Default",
    gradingScaleId: gradingScale.id,
    gradeThresholds: { A: 0.8, B: 0.7, C: 0.6, D: 0.5, E: 0.4 },
    sources: [CAIE_SOURCE],
  };

  const calculationPolicy: CalculationPolicy = {
    id: ids.calculationPolicyId("caie-pum"),
    name: "CAIE PUM",
    kind: "CAIE_PUM",
    description: "Piece-wise linear interpolation from raw to PUM using fixed grade boundaries",
    sources: [CAIE_SOURCE],
  };

  // ── Qualification ──
  const qualification: Qualification = {
    id: ids.qualificationId("caie", "al", "9709"),
    boardId: board.id,
    level: "A_LEVEL",
    subjectCode: "9709",
    subjectName: "Mathematics",
    gradingScaleId: gradingScale.id,
    specificationIds: [],
    status: "verified",
    sources: [CAIE_SOURCE],
  };

  // ── Specification ──
  const spec: SpecificationVersion = {
    id: ids.specificationId("caie", "al", "9709", "current"),
    qualificationId: qualification.id,
    label: "Current Specification",
    validFrom: "2018",
    routeIds: [],
    unitIds: [],
    status: "verified",
    sources: [CAIE_SOURCE],
  };

  // ── Units ──
  const units: AssessmentUnit[] = [];
  const paperNumToUnitId = new Map<number, string>();

  const sortedPaperNums = Array.from(paperNums).sort((a, b) => a - b);
  for (const paperNum of sortedPaperNums) {
    const unitCode = `9709/${paperNum}`;
    const paperInfo = COMPONENT_TO_PAPER[String(paperNum) + "1"]; // Use x1 as representative
    const unit: AssessmentUnit = {
      id: ids.unitId("caie", "al", unitCode),
      specificationId: spec.id,
      code: unitCode,
      aliases: [`P${paperNum}`],
      name: paperInfo?.name ?? `Paper ${paperNum}`,
      stage: paperNum <= 2 ? "AS" : paperNum <= 4 ? "AS" : "A2",
      paperIds: [],
      status: "verified",
      sources: [CAIE_SOURCE],
    };
    units.push(unit);
    paperNumToUnitId.set(paperNum, unit.id);
  }

  spec.unitIds = units.map((u) => u.id);

  // ── Papers and Variants ──
  const papers: Paper[] = [];
  const paperVariants: PaperVariant[] = [];
  const boundarySets: BoundarySet[] = [];

  for (const unit of units) {
    const paperNum = parseInt(unit.code.split("/")[1]);
    const unitRecords = grouped.get(String(paperNum)) ?? [];

    // Compute maxMark (majority vote)
    const maxMarkCounts = new Map<number, number>();
    for (const r of unitRecords) {
      if (r.MaxRawMark !== null) {
        maxMarkCounts.set(r.MaxRawMark, (maxMarkCounts.get(r.MaxRawMark) ?? 0) + 1);
      }
    }
    let maxMark = 0;
    let maxCount = 0;
    for (const [mark, count] of maxMarkCounts) {
      if (count > maxCount) {
        maxMark = mark;
        maxCount = count;
      }
    }

    const paper: Paper = {
      id: ids.paperId("caie", "9709", unit.code),
      unitId: unit.id,
      qualificationId: qualification.id,
      numberOrCode: unit.code,
      name: unit.name,
      rawMax: maxMark > 0 ? maxMark : undefined,
      paperType: "WRITTEN",
      variantIds: [],
      sources: [CAIE_SOURCE],
    };
    papers.push(paper);
    unit.paperIds = [paper.id];

    // Create variants from component codes
    const seenComponents = new Set<string>();
    for (const r of unitRecords) {
      if (seenComponents.has(r.Component)) continue;
      seenComponents.add(r.Component);

      const variant: PaperVariant = {
        id: ids.paperVariantId("caie", "9709", unit.code, r.Component),
        paperId: paper.id,
        code: r.Component,
        aliases: [],
      };
      paperVariants.push(variant);
      paper.variantIds = [...(paper.variantIds ?? []), variant.id];
    }

    // Boundary sets (one per component+series, series includes component for uniqueness)
    const seenKeys = new Set<string>();
    for (const r of unitRecords) {
      const baseSeries = canonicalSeries(r.Series);
      // Include component in series to disambiguate zone variants
      const series = `${baseSeries}-${r.Component}`;
      const key = `${r.Component}-${baseSeries}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      if (r.MaxRawMark === null) {
        warnings.push({ code: "MISSING_MAX_MARK", message: `No maxMark for ${unit.code} ${series}` });
        continue;
      }

      const thresholds: BoundaryThreshold[] = [];
      if (r.A !== null) thresholds.push({ grade: "A", minMark: r.A });
      if (r.B !== null) thresholds.push({ grade: "B", minMark: r.B });
      if (r.C !== null) thresholds.push({ grade: "C", minMark: r.C });
      if (r.D !== null) thresholds.push({ grade: "D", minMark: r.D });
      if (r.E !== null) thresholds.push({ grade: "E", minMark: r.E });

      // Validate monotonicity
      let prevMin = Infinity;
      let monotonic = true;
      for (const t of thresholds) {
        if (t.minMark >= prevMin) { monotonic = false; break; }
        prevMin = t.minMark;
      }
      if (!monotonic) {
        errors.push({ code: "NON_MONOTONIC", message: `Non-monotonic for ${unit.code} ${series}` });
        continue;
      }

      boundarySets.push({
        id: ids.boundarySetId("caie", "9709", unit.code, series),
        unitId: unit.id,
        series,
        maxMark: r.MaxRawMark,
        thresholds,
        scale: "RAW",
        status: "verified",
        sources: [CAIE_SOURCE],
      });
    }
  }

  // ── Award Routes ──
  const p1Id = paperNumToUnitId.get(1) ?? "";
  const p3Id = paperNumToUnitId.get(3) ?? "";
  const p4Id = paperNumToUnitId.get(4) ?? "";
  const p5Id = paperNumToUnitId.get(5) ?? "";
  const p6Id = paperNumToUnitId.get(6) ?? "";

  const asRoute: AwardRoute = {
    id: ids.routeId("caie", "al", "9709", "as"),
    specificationId: spec.id,
    name: "AS Mathematics",
    awardType: "AS",
    selectionRules: [
      { kind: "REQUIRE_ALL", unitIds: [p1Id].filter(Boolean) },
      { kind: "EXACTLY_N_FROM", count: 1, unitIds: [p4Id, p5Id].filter(Boolean) },
      { kind: "TOTAL_UNIT_COUNT", count: 2 },
      { kind: "NO_DUPLICATES" },
    ],
    aggregationPolicyId: aggregationPolicy.id,
    gradePolicyId: gradePolicy.id,
    status: "verified",
    sources: [CAIE_SOURCE],
  };

  const aLevelRoute: AwardRoute = {
    id: ids.routeId("caie", "al", "9709", "full-a-level"),
    specificationId: spec.id,
    name: "A-Level Mathematics",
    awardType: "FULL",
    selectionRules: [
      { kind: "REQUIRE_ALL", unitIds: [p1Id, p3Id].filter(Boolean) },
      { kind: "EXACTLY_N_FROM", count: 2, unitIds: [p4Id, p5Id, p6Id].filter(Boolean) },
      { kind: "TOTAL_UNIT_COUNT", count: 4 },
      { kind: "NO_DUPLICATES" },
    ],
    aggregationPolicyId: aggregationPolicy.id,
    gradePolicyId: gradePolicy.id,
    status: "verified",
    sources: [CAIE_SOURCE],
  };

  spec.routeIds = [asRoute.id, aLevelRoute.id];
  qualification.specificationIds = [spec.id];

  return {
    catalogPartial: {
      boards: [board],
      qualifications: [qualification],
      specifications: [spec],
      units,
      papers,
      paperVariants,
      boundarySets,
      routes: [asRoute, aLevelRoute],
      gradingScales: [gradingScale],
      aggregationPolicies: [aggregationPolicy],
      gradePolicies: [gradePolicy],
      calculationPolicies: [calculationPolicy],
    },
    warnings,
    errors,
  };
}

/** Convert CAIE series format to canonical */
function canonicalSeries(series: string): string {
  // CAIE format: "november-2025" or "june-2024" or "march-2023"
  const parts = series.split("-");
  if (parts.length === 2) {
    const [session, year] = parts;
    return `${year}-${session}`;
  }
  return series;
}
