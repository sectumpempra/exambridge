/**
 * ETL Pipeline — Build canonical catalog from legacy data files.
 *
 * Steps: parseRaw → normalize → link → validate
 * Phase 1: YMA01 (Pearson Edexcel IAL Mathematics)
 * Phase 5: CAIE 9709 (A-Level Mathematics)
 */

import type { ExamCatalog } from "./schema";
import { ExamCatalogSchema } from "./schema";
import { Catalog } from "./catalog";
import { buildYMA01Catalog } from "@/adapters-v2/legacy-data/yma01-etl";
import { buildCAIE9709Catalog } from "@/adapters-v2/legacy-data/caie-9709-etl";

export interface ETLResult {
  catalog: ExamCatalog;
  catalogInstance: Catalog;
  manifest: CatalogManifest;
  qaReport: QAReport;
  warnings: Array<{ code: string; message: string }>;
  errors: Array<{ code: string; message: string }>;
  success: boolean;
}

export interface CatalogManifest {
  schemaVersion: string;
  generatedAt: string;
  sourceHashes: Record<string, string>;
  entityCounts: {
    boards: number;
    qualifications: number;
    specifications: number;
    units: number;
    papers: number;
    paperVariants: number;
    sittings: number;
    boundarySets: number;
    routes: number;
    gradingScales: number;
    aggregationPolicies: number;
    gradePolicies: number;
    aStarPolicies: number;
    calculationPolicies: number;
  };
  supportedQualifications: string[];
}

export interface QAReport {
  blockingErrors: Array<{ code: string; message: string; entity?: string }>;
  warnings: Array<{ code: string; message: string; entity?: string }>;
  invariants: Array<{ name: string; passed: boolean; detail?: string }>;
  summary: string;
}

/**
 * Run the full ETL pipeline for all supported qualifications.
 * Phase 1: YMA01. Phase 5: CAIE 9709.
 */
export function runETL(legacyData: Record<string, unknown[]>): ETLResult {
  const allWarnings: Array<{ code: string; message: string }> = [];
  const allErrors: Array<{ code: string; message: string }> = [];

  // ── Build individual catalogs ──
  const { catalog: yma01Catalog, warnings: yma01Warnings, errors: yma01Errors } =
    buildYMA01Catalog(legacyData.edexcelAL ?? []);
  allWarnings.push(...yma01Warnings);
  allErrors.push(...yma01Errors);

  // Only build CAIE catalog if data is provided
  const caieAL = legacyData.caieAL ?? [];
  const caiePartial = caieAL.length > 0
    ? buildCAIE9709Catalog(caieAL)
    : null;
  if (caiePartial) {
    allWarnings.push(...caiePartial.warnings);
    allErrors.push(...caiePartial.errors);
  }

  // ── Merge catalogs ──
  const mergedCatalog: ExamCatalog = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    boards: [...yma01Catalog.boards, ...(caiePartial?.catalogPartial.boards ?? [])],
    qualifications: [...yma01Catalog.qualifications, ...(caiePartial?.catalogPartial.qualifications ?? [])],
    specifications: [...yma01Catalog.specifications, ...(caiePartial?.catalogPartial.specifications ?? [])],
    units: [...yma01Catalog.units, ...(caiePartial?.catalogPartial.units ?? [])],
    papers: [...yma01Catalog.papers, ...(caiePartial?.catalogPartial.papers ?? [])],
    paperVariants: [...yma01Catalog.paperVariants, ...(caiePartial?.catalogPartial.paperVariants ?? [])],
    sittings: [...yma01Catalog.sittings],
    boundarySets: [...yma01Catalog.boundarySets, ...(caiePartial?.catalogPartial.boundarySets ?? [])],
    routes: [...yma01Catalog.routes, ...(caiePartial?.catalogPartial.routes ?? [])],
    gradingScales: [...yma01Catalog.gradingScales, ...(caiePartial?.catalogPartial.gradingScales ?? [])],
    aggregationPolicies: [...yma01Catalog.aggregationPolicies, ...(caiePartial?.catalogPartial.aggregationPolicies ?? [])],
    gradePolicies: [...yma01Catalog.gradePolicies, ...(caiePartial?.catalogPartial.gradePolicies ?? [])],
    aStarPolicies: [...yma01Catalog.aStarPolicies],
    calculationPolicies: [...yma01Catalog.calculationPolicies, ...(caiePartial?.catalogPartial.calculationPolicies ?? [])],
  };

  // ── Step 4: Validate ──
  const qaReport = validateCatalog(mergedCatalog);
  allErrors.push(...qaReport.blockingErrors.map((e) => ({ code: e.code, message: e.message })));

  // Schema validation
  const schemaResult = ExamCatalogSchema.safeParse(mergedCatalog);
  if (!schemaResult.success) {
    allErrors.push({
      code: "SCHEMA_VALIDATION_FAILED",
      message: `Catalog schema validation failed: ${schemaResult.error.message}`,
    });
  }

  const success = allErrors.length === 0;

  // ── Build Manifest ──
  const manifest: CatalogManifest = {
    schemaVersion: mergedCatalog.schemaVersion,
    generatedAt: mergedCatalog.generatedAt,
    sourceHashes: {},
    entityCounts: {
      boards: mergedCatalog.boards.length,
      qualifications: mergedCatalog.qualifications.length,
      specifications: mergedCatalog.specifications.length,
      units: mergedCatalog.units.length,
      papers: mergedCatalog.papers.length,
      paperVariants: mergedCatalog.paperVariants.length,
      sittings: mergedCatalog.sittings.length,
      boundarySets: mergedCatalog.boundarySets.length,
      routes: mergedCatalog.routes.length,
      gradingScales: mergedCatalog.gradingScales.length,
      aggregationPolicies: mergedCatalog.aggregationPolicies.length,
      gradePolicies: mergedCatalog.gradePolicies.length,
      aStarPolicies: mergedCatalog.aStarPolicies.length,
      calculationPolicies: mergedCatalog.calculationPolicies.length,
    },
    supportedQualifications: mergedCatalog.qualifications
      .filter((q) => q.status === "verified")
      .map((q) => q.id),
  };

  const catalogInstance = new Catalog(mergedCatalog);

  return {
    catalog: mergedCatalog,
    catalogInstance,
    manifest,
    qaReport,
    warnings: allWarnings,
    errors: allErrors,
    success,
  };
}

// ── Validation ─────────────────────────────────────────────────────────────

function validateCatalog(catalog: ExamCatalog): QAReport {
  const blockingErrors: Array<{ code: string; message: string; entity?: string }> = [];
  const warnings: Array<{ code: string; message: string; entity?: string }> = [];
  const invariants: Array<{ name: string; passed: boolean; detail?: string }> = [];

  // Invariant 1: No duplicate IDs
  const allIds: string[] = [
    ...catalog.boards.map((b) => b.id),
    ...catalog.qualifications.map((q) => q.id),
    ...catalog.specifications.map((s) => s.id),
    ...catalog.units.map((u) => u.id),
    ...catalog.papers.map((p) => p.id),
    ...catalog.paperVariants.map((v) => v.id),
    ...catalog.sittings.map((s) => s.id),
    ...catalog.boundarySets.map((b) => b.id),
    ...catalog.routes.map((r) => r.id),
  ];
  const idCounts = new Map<string, number>();
  for (const id of allIds) {
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  const duplicates = Array.from(idCounts.entries()).filter(([, count]) => count > 1);
  invariants.push({
    name: "No duplicate IDs",
    passed: duplicates.length === 0,
    detail: duplicates.length > 0 ? `Duplicates: ${duplicates.map(([id]) => id).join(", ")}` : undefined,
  });
  if (duplicates.length > 0) {
    for (const [id] of duplicates) {
      blockingErrors.push({ code: "DUPLICATE_ID", message: `Duplicate ID: ${id}`, entity: id });
    }
  }

  // Invariant 2: Boundary thresholds monotonic
  let monotonicPassed = true;
  for (const b of catalog.boundarySets) {
    let prevMin = Infinity;
    for (const t of b.thresholds) {
      if (t.minMark >= prevMin) {
        monotonicPassed = false;
        blockingErrors.push({
          code: "NON_MONOTONIC_THRESHOLD",
          message: `Grade ${t.grade} threshold ${t.minMark} >= previous ${prevMin} in ${b.id}`,
          entity: b.id,
        });
      }
      prevMin = t.minMark;
    }
  }
  invariants.push({ name: "Boundary thresholds monotonic", passed: monotonicPassed });

  // Invariant 3: maxMark > 0
  const validMaxMark = catalog.boundarySets.every((b) => b.maxMark > 0);
  invariants.push({
    name: "All boundary maxMarks > 0",
    passed: validMaxMark,
    detail: validMaxMark ? undefined : catalog.boundarySets.filter((b) => b.maxMark <= 0).map((b) => b.id).join(", "),
  });
  if (!validMaxMark) {
    for (const b of catalog.boundarySets.filter((x) => x.maxMark <= 0)) {
      blockingErrors.push({ code: "INVALID_MAX_MARK", message: `maxMark <= 0: ${b.id}`, entity: b.id });
    }
  }

  // Invariant 4: Route references exist
  let routeRefsPassed = true;
  const unitIds = new Set(catalog.units.map((u) => u.id));
  for (const route of catalog.routes) {
    for (const rule of route.selectionRules) {
      if ("unitIds" in rule && rule.unitIds) {
        for (const uid of rule.unitIds) {
          if (uid && !unitIds.has(uid)) {
            routeRefsPassed = false;
            blockingErrors.push({
              code: "ROUTE_REF_UNKNOWN_UNIT",
              message: `Route ${route.id} references unknown unit ${uid}`,
              entity: route.id,
            });
          }
        }
      }
      if ("groups" in rule && rule.groups) {
        for (const group of rule.groups) {
          for (const uid of group) {
            if (uid && !unitIds.has(uid)) {
              routeRefsPassed = false;
              blockingErrors.push({
                code: "ROUTE_REF_UNKNOWN_UNIT",
                message: `Route ${route.id} references unknown unit ${uid}`,
                entity: route.id,
              });
            }
          }
        }
      }
    }
  }
  invariants.push({ name: "Route unit references valid", passed: routeRefsPassed });

  // Invariant 5: Verified rules have sources
  const verifiedWithSources = [
    ...catalog.qualifications.filter((q) => q.status === "verified" && q.sources.length === 0).map((q) => q.id),
    ...catalog.specifications.filter((s) => s.status === "verified" && s.sources.length === 0).map((s) => s.id),
    ...catalog.units.filter((u) => u.status === "verified" && u.sources.length === 0).map((u) => u.id),
    ...catalog.boundarySets.filter((b) => b.status === "verified" && b.sources.length === 0).map((b) => b.id),
    ...catalog.routes.filter((r) => r.status === "verified" && r.sources.length === 0).map((r) => r.id),
  ];
  invariants.push({
    name: "Verified entities have sources",
    passed: verifiedWithSources.length === 0,
    detail: verifiedWithSources.length > 0 ? `Missing sources: ${verifiedWithSources.join(", ")}` : undefined,
  });

  // Invariant 6: umsMax consistency (C12/C34 = 200, others = 100 for YMA01)
  let umsMaxPassed = true;
  for (const unit of catalog.units) {
    if (unit.code === "WMA01" || unit.code === "WMA02") {
      if (unit.umsMax !== 200) {
        umsMaxPassed = false;
        warnings.push({ code: "UMSMAX_MISMATCH", message: `${unit.code} umsMax=${unit.umsMax}, expected 200`, entity: unit.id });
      }
    } else if (unit.umsMax && unit.umsMax !== 100) {
      warnings.push({ code: "UMSMAX_UNEXPECTED", message: `${unit.code} umsMax=${unit.umsMax}, expected 100`, entity: unit.id });
    }
  }
  invariants.push({ name: "UMS max values consistent", passed: umsMaxPassed });

  // Summary
  const summary = [
    `Entities: ${catalog.qualifications.length} qualifications, ${catalog.units.length} units, ${catalog.boundarySets.length} boundary sets`,
    `Blocking errors: ${blockingErrors.length}`,
    `Warnings: ${warnings.length}`,
    `Invariants: ${invariants.filter((i) => i.passed).length}/${invariants.length} passed`,
  ].join(" | ");

  return { blockingErrors, warnings, invariants, summary };
}
