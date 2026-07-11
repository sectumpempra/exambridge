/**
 * YMA01 ETL Adapter — Pearson Edexcel IAL Mathematics
 *
 * Transforms raw edexcel_al.json records into canonical catalog entities.
 * ETL steps: parseRaw → normalize → link → validate
 *
 * First vertical slice for Phase 1.
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
  AStarPolicy,
  CalculationPolicy,
  SourceRef,
  ExamCatalog,
  BoundaryThreshold,
} from "@/domain-v2/catalog/schema";
import * as ids from "@/domain-v2/catalog/ids";

// ── Raw data types ─────────────────────────────────────────────────────────

interface RawRecord {
  year: string;
  session: string;
  code: string;
  unit: string;
  max_mark: number;
  a_star?: number;
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  e?: number;
  u?: number;
}

// ── Step 1: Parse Raw ──────────────────────────────────────────────────────

export function parseRaw(allRecords: unknown[]): { records: RawRecord[]; errors: string[] } {
  const records: RawRecord[] = [];
  const errors: string[] = [];

  for (let i = 0; i < allRecords.length; i++) {
    const r = allRecords[i] as Record<string, unknown>;
    if (!r || typeof r !== "object") {
      errors.push(`Record ${i}: not an object`);
      continue;
    }
    const code = String(r.code ?? "");
    // Only WMA* codes (IAL Mathematics)
    if (!code.startsWith("WMA") && !code.startsWith("WME") && !code.startsWith("WST") && !code.startsWith("WDM")) {
      continue; // Skip non-math records
    }
    records.push({
      year: String(r.year ?? ""),
      session: String(r.session ?? ""),
      code,
      unit: String(r.unit ?? ""),
      max_mark: Number(r.max_mark ?? 0),
      a_star: r.a_star !== undefined ? Number(r.a_star) : undefined,
      a: r.a !== undefined ? Number(r.a) : undefined,
      b: r.b !== undefined ? Number(r.b) : undefined,
      c: r.c !== undefined ? Number(r.c) : undefined,
      d: r.d !== undefined ? Number(r.d) : undefined,
      e: r.e !== undefined ? Number(r.e) : undefined,
      u: r.u !== undefined ? Number(r.u) : undefined,
    });
  }

  return { records, errors };
}

// ── Step 2: Normalize ──────────────────────────────────────────────────────

/** Map raw unit code to canonical unit metadata */
const UNIT_METADATA: Record<string, {
  name: string;
  shortCode: string;
  stage: "AS" | "A2" | "FULL";
  umsMax: number;
  spec: "new" | "old";
}> = {
  // New spec units (2018+)
  WMA11: { name: "Pure Mathematics 1", shortCode: "P1", stage: "AS", umsMax: 100, spec: "new" },
  WMA12: { name: "Pure Mathematics 2", shortCode: "P2", stage: "AS", umsMax: 100, spec: "new" },
  WMA13: { name: "Pure Mathematics 3", shortCode: "P3", stage: "A2", umsMax: 100, spec: "new" },
  WMA14: { name: "Pure Mathematics 4", shortCode: "P4", stage: "A2", umsMax: 100, spec: "new" },
  WME01: { name: "Mechanics 1", shortCode: "M1", stage: "AS", umsMax: 100, spec: "new" },
  WME02: { name: "Mechanics 2", shortCode: "M2", stage: "A2", umsMax: 100, spec: "new" },
  WME03: { name: "Mechanics 3", shortCode: "M3", stage: "A2", umsMax: 100, spec: "new" },
  WST01: { name: "Statistics 1", shortCode: "S1", stage: "AS", umsMax: 100, spec: "new" },
  WST02: { name: "Statistics 2", shortCode: "S2", stage: "A2", umsMax: 100, spec: "new" },
  WST03: { name: "Statistics 3", shortCode: "S3", stage: "A2", umsMax: 100, spec: "new" },
  WDM01: { name: "Decision Mathematics 1", shortCode: "D1", stage: "AS", umsMax: 100, spec: "new" },
  WDM11: { name: "Decision Mathematics 1 (New)", shortCode: "D1N", stage: "AS", umsMax: 100, spec: "new" },
  // Old spec units (pre-2018)
  WMA01: { name: "Core Mathematics C12", shortCode: "C12", stage: "FULL", umsMax: 200, spec: "old" },
  WMA02: { name: "Core Mathematics C34", shortCode: "C34", stage: "FULL", umsMax: 200, spec: "old" },
};

const PEARSON_SOURCE: SourceRef = {
  title: "Pearson Edexcel International Advanced Level Mathematics specification",
  publisher: "Pearson",
  url: "https://qualifications.pearson.com/en/qualifications/edexcel-international-advanced-levels/mathematics.coursematerials.html",
  accessedAt: "2026-07-11",
  note: "YMA01 IAL Mathematics specification and grade boundaries",
};

export function normalizeRecords(records: RawRecord[]): {
  grouped: Map<string, RawRecord[]>;
  unitCodes: Set<string>;
} {
  // Group by canonical unit code
  const grouped = new Map<string, RawRecord[]>();
  const unitCodes = new Set<string>();

  for (const r of records) {
    const meta = UNIT_METADATA[r.code];
    if (!meta) continue;
    unitCodes.add(r.code);
    if (!grouped.has(r.code)) grouped.set(r.code, []);
    grouped.get(r.code)!.push(r);
  }

  return { grouped, unitCodes };
}

// ── Step 3 & 4: Link and Build Catalog ─────────────────────────────────────

export function buildYMA01Catalog(allRecords: unknown[]): {
  catalog: ExamCatalog;
  warnings: Array<{ code: string; message: string }>;
  errors: Array<{ code: string; message: string }>;
} {
  const warnings: Array<{ code: string; message: string }> = [];
  const errors: Array<{ code: string; message: string }> = [];

  // Parse
  const { records, errors: parseErrors } = parseRaw(allRecords);
  parseErrors.forEach((e) => errors.push({ code: "PARSE_ERROR", message: e }));

  // Normalize
  const { grouped, unitCodes } = normalizeRecords(records);

  // ── Board ──
  const board: Board = {
    id: ids.boardId("pearson"),
    code: "PEARSON",
    name: "Pearson Edexcel",
    aliases: ["Edexcel", "Pearson"],
  };

  // ── Grading Scale ──
  const gradingScale: GradingScale = {
    id: ids.gradingScaleId("pearson-ial-a-star-to-e"),
    name: "Pearson IAL A*-E",
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
    sources: [PEARSON_SOURCE],
  };

  // ── Policies ──
  const aggregationPolicy: AggregationPolicy = {
    id: ids.aggregationPolicyId("pearson-ial-sum-ums"),
    name: "Pearson IAL UMS Sum",
    method: "SUM_UMS",
    description: "Sum UMS across all units in the route",
    sources: [PEARSON_SOURCE],
  };

  const gradePolicy: GradePolicy = {
    id: ids.gradePolicyId("pearson-ial-default"),
    name: "Pearson IAL Default",
    gradingScaleId: gradingScale.id,
    gradeThresholds: { A: 0.8, B: 0.7, C: 0.6, D: 0.5, E: 0.4 },
    sources: [PEARSON_SOURCE],
  };

  const aStarPolicy: AStarPolicy = {
    id: ids.aStarPolicyId("yma01-a-star"),
    name: "YMA01 A*",
    conditions: [
      { kind: "TOTAL_MIN", minTotal: 480 },
      { kind: "UNIT_PAIR_MIN", unitIds: [], minSum: 180 }, // P3+P4 >= 180
    ],
    sources: [PEARSON_SOURCE],
  };

  const calculationPolicy: CalculationPolicy = {
    id: ids.calculationPolicyId("pearson-ums"),
    name: "Pearson UMS",
    kind: "PEARSON_UMS",
    description: "Fixed grade boundaries with piece-wise linear interpolation to UMS",
    sources: [PEARSON_SOURCE],
  };

  // ── Qualification ──
  const qualification: Qualification = {
    id: ids.qualificationId("pearson", "ial", "yma01"),
    boardId: board.id,
    level: "IAL",
    subjectCode: "YMA01",
    subjectName: "Mathematics",
    gradingScaleId: gradingScale.id,
    specificationIds: [],
    status: "verified",
    sources: [PEARSON_SOURCE],
  };

  // ── Specifications ──
  const newSpec: SpecificationVersion = {
    id: ids.specificationId("pearson", "ial", "yma01", "new-spec-2018"),
    qualificationId: qualification.id,
    label: "New Specification (2018+)",
    validFrom: "2018",
    routeIds: [],
    unitIds: [],
    status: "verified",
    sources: [PEARSON_SOURCE],
  };

  const oldSpec: SpecificationVersion = {
    id: ids.specificationId("pearson", "ial", "yma01", "old-spec-pre2018"),
    qualificationId: qualification.id,
    label: "Old Specification (Pre-2018)",
    validFrom: "2013",
    validTo: "2018",
    routeIds: [],
    unitIds: [],
    status: "verified",
    sources: [PEARSON_SOURCE],
  };

  // ── Units ──
  const units: AssessmentUnit[] = [];
  const newUnitIds: string[] = [];
  const oldUnitIds: string[] = [];

  for (const [unitCode, meta] of Object.entries(UNIT_METADATA)) {
    if (!unitCodes.has(unitCode)) {
      warnings.push({ code: "MISSING_UNIT_DATA", message: `No boundary data for ${unitCode} (${meta.name})` });
      continue;
    }

    const specId = meta.spec === "new" ? newSpec.id : oldSpec.id;
    const unit: AssessmentUnit = {
      id: ids.unitId("pearson", "ial", unitCode),
      specificationId: specId,
      code: unitCode,
      aliases: [meta.shortCode],
      name: meta.name,
      stage: meta.stage,
      umsMax: meta.umsMax,
      paperIds: [],
      status: "verified",
      sources: [PEARSON_SOURCE],
    };
    units.push(unit);

    if (meta.spec === "new") newUnitIds.push(unit.id);
    else oldUnitIds.push(unit.id);
  }

  // Update spec unit lists
  newSpec.unitIds = newUnitIds;
  oldSpec.unitIds = oldUnitIds;

  // ── Papers (1:1 with units for IAL) ──
  const papers: Paper[] = [];
  const paperVariants: PaperVariant[] = [];
  const boundarySets: BoundarySet[] = [];

  for (const unit of units) {
    // Find the raw code from metadata
    const rawCode = Object.entries(UNIT_METADATA).find(([, m]) => m.name === unit.name)?.[0] ?? unit.code;
    const unitRecords = grouped.get(rawCode) ?? [];

    // Compute rawMax from data (majority vote)
    const maxMarkCounts = new Map<number, number>();
    for (const r of unitRecords) {
      maxMarkCounts.set(r.max_mark, (maxMarkCounts.get(r.max_mark) ?? 0) + 1);
    }
    let rawMax = 0;
    let maxCount = 0;
    for (const [mark, count] of maxMarkCounts) {
      if (count > maxCount) {
        rawMax = mark;
        maxCount = count;
      }
    }

    const paper: Paper = {
      id: ids.paperId("pearson", "yma01", unit.code),
      unitId: unit.id,
      qualificationId: qualification.id,
      numberOrCode: unit.code,
      name: unit.name,
      rawMax: rawMax > 0 ? rawMax : undefined,
      paperType: "WRITTEN",
      variantIds: [],
      sources: [PEARSON_SOURCE],
    };
    papers.push(paper);
    unit.paperIds = [paper.id];

    // Single variant per paper (IAL doesn't have zone variants in the data)
    const variant: PaperVariant = {
      id: ids.paperVariantId("pearson", "yma01", unit.code, "01"),
      paperId: paper.id,
      code: "01",
      aliases: [],
    };
    paperVariants.push(variant);
    paper.variantIds = [variant.id];

    // Boundary sets from records
    const seenKeys = new Set<string>();
    for (const r of unitRecords) {
      const series = ids.canonicalSeries(r.session, r.year);
      const key = `${rawCode}-${series}`;
      if (seenKeys.has(key)) {
        // Duplicate — skip with warning
        warnings.push({
          code: "DUPLICATE_BOUNDARY",
          message: `Duplicate boundary for ${rawCode} ${series} — skipping`,
        });
        continue;
      }
      seenKeys.add(key);

      const thresholds: BoundaryThreshold[] = [];
      if (r.a !== undefined && r.a > 0) thresholds.push({ grade: "A", minMark: r.a });
      if (r.b !== undefined && r.b > 0) thresholds.push({ grade: "B", minMark: r.b });
      if (r.c !== undefined && r.c > 0) thresholds.push({ grade: "C", minMark: r.c });
      if (r.d !== undefined && r.d > 0) thresholds.push({ grade: "D", minMark: r.d });
      if (r.e !== undefined && r.e > 0) thresholds.push({ grade: "E", minMark: r.e });

      // Validate threshold monotonicity
      let prevMin = Infinity;
      let monotonic = true;
      for (const t of thresholds) {
        if (t.minMark >= prevMin) {
          monotonic = false;
          break;
        }
        prevMin = t.minMark;
      }
      if (!monotonic) {
        errors.push({
          code: "NON_MONOTONIC_BOUNDARY",
          message: `Non-monotonic thresholds for ${rawCode} ${series}`,
        });
        continue;
      }

      boundarySets.push({
        id: ids.boundarySetId("pearson", "yma01", rawCode, series),
        unitId: unit.id,
        series,
        maxMark: r.max_mark,
        thresholds,
        scale: "RAW",
        status: "verified",
        sources: [PEARSON_SOURCE],
      });
    }
  }

  // ── Award Routes ──
  const newSpecUnitIds = units.filter((u) => u.specificationId === newSpec.id).map((u) => u.id);

  const p1Id = units.find((u) => u.code === "WMA11")?.id ?? "";
  const p2Id = units.find((u) => u.code === "WMA12")?.id ?? "";
  const p3Id = units.find((u) => u.code === "WMA13")?.id ?? "";
  const p4Id = units.find((u) => u.code === "WMA14")?.id ?? "";

  // Applied unit groups for ONE_OF_GROUPS
  const m1Id = units.find((u) => u.code === "WME01")?.id ?? "";
  const m2Id = units.find((u) => u.code === "WME02")?.id ?? "";
  const s1Id = units.find((u) => u.code === "WST01")?.id ?? "";
  const s2Id = units.find((u) => u.code === "WST02")?.id ?? "";
  const d1Id = units.find((u) => u.code === "WDM01")?.id ?? "";
  void d1Id; // referenced in applied group

  const newRoute: AwardRoute = {
    id: ids.routeId("pearson", "ial", "yma01", "full-al-new-spec"),
    specificationId: newSpec.id,
    name: "IAL Mathematics Full A-Level (New Spec)",
    awardType: "FULL",
    selectionRules: [
      { kind: "REQUIRE_ALL", unitIds: [p1Id, p2Id, p3Id, p4Id].filter(Boolean) },
      {
        kind: "ONE_OF_GROUPS",
        groups: [
          [m1Id, m2Id].filter(Boolean),
          [s1Id, s2Id].filter(Boolean),
          [m1Id, s1Id].filter(Boolean),
          [m1Id, d1Id].filter(Boolean),
          [s1Id, d1Id].filter(Boolean),
        ].filter((g) => g.length === 2),
      },
      { kind: "TOTAL_UNIT_COUNT", count: 6 },
      { kind: "NO_DUPLICATES" },
    ],
    aggregationPolicyId: aggregationPolicy.id,
    gradePolicyId: gradePolicy.id,
    aStarPolicyId: aStarPolicy.id,
    status: "verified",
    sources: [PEARSON_SOURCE],
  };

  const c12Id = units.find((u) => u.code === "WMA01")?.id ?? "";
  const c34Id = units.find((u) => u.code === "WMA02")?.id ?? "";
  const oldAppliedIds = units
    .filter((u) => {
      const meta = Object.entries(UNIT_METADATA).find(([, m]) => m.name === u.name)?.[1];
      return meta?.spec === "old" && !u.code.startsWith("WMA0");
    })
    .map((u) => u.id)
    .filter(Boolean);

  const oldRoute: AwardRoute = {
    id: ids.routeId("pearson", "ial", "yma01", "full-al-old-spec"),
    specificationId: oldSpec.id,
    name: "IAL Mathematics Full A-Level (Old Spec)",
    awardType: "FULL",
    selectionRules: [
      { kind: "REQUIRE_ALL", unitIds: [c12Id, c34Id].filter(Boolean) },
      { kind: "EXACTLY_N_FROM", count: 2, unitIds: oldAppliedIds },
      { kind: "TOTAL_UNIT_COUNT", count: 4 },
      { kind: "NO_DUPLICATES" },
      { kind: "MUTUALLY_EXCLUSIVE", unitIds: newSpecUnitIds }, // Cannot mix with new spec
    ],
    aggregationPolicyId: aggregationPolicy.id,
    gradePolicyId: gradePolicy.id,
    aStarPolicyId: undefined, // Old spec A* rule different
    status: "verified",
    sources: [PEARSON_SOURCE],
  };

  newSpec.routeIds = [newRoute.id];
  oldSpec.routeIds = [oldRoute.id];
  qualification.specificationIds = [newSpec.id, oldSpec.id];

  // Update A* policy unitIds for P3+P4
  aStarPolicy.conditions[1].unitIds = [p3Id, p4Id].filter(Boolean);

  // ── Assemble Catalog ──
  const catalog: ExamCatalog = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    boards: [board],
    qualifications: [qualification],
    specifications: [newSpec, oldSpec],
    units,
    papers,
    paperVariants,
    sittings: [], // No sitting data in raw files
    boundarySets,
    routes: [newRoute, oldRoute],
    gradingScales: [gradingScale],
    aggregationPolicies: [aggregationPolicy],
    gradePolicies: [gradePolicy],
    aStarPolicies: [aStarPolicy],
    calculationPolicies: [calculationPolicy],
  };

  return { catalog, warnings, errors };
}
