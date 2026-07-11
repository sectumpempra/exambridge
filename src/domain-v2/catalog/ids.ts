/**
 * Stable ID Generator for Canonical Catalog
 *
 * All IDs are deterministic, readable, and case-fixed.
 * Same input always produces the same ID.
 */

// ── Board IDs ──────────────────────────────────────────────────────────────

export function boardId(code: string): string {
  return `board:${code.toLowerCase()}`;
}

// ── Qualification IDs ──────────────────────────────────────────────────────

export function qualificationId(
  boardCode: string,
  level: string,
  subjectCode: string
): string {
  return `qual:${boardCode.toLowerCase()}:${level.toLowerCase()}:${subjectCode.toLowerCase()}`;
}

// ── Specification IDs ──────────────────────────────────────────────────────

export function specificationId(
  boardCode: string,
  level: string,
  subjectCode: string,
  specLabel: string
): string {
  const sanitized = specLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `spec:${boardCode.toLowerCase()}:${level.toLowerCase()}:${subjectCode.toLowerCase()}:${sanitized}`;
}

// ── Unit IDs ───────────────────────────────────────────────────────────────

export function unitId(
  boardCode: string,
  level: string,
  unitCode: string
): string {
  return `unit:${boardCode.toLowerCase()}:${level.toLowerCase()}:${unitCode.toLowerCase()}`;
}

// ── Paper IDs ──────────────────────────────────────────────────────────────

export function paperId(
  boardCode: string,
  subjectCode: string,
  paperCode: string
): string {
  return `paper:${boardCode.toLowerCase()}:${subjectCode.toLowerCase()}:${paperCode.toLowerCase()}`;
}

// ── Paper Variant IDs ──────────────────────────────────────────────────────

export function paperVariantId(
  boardCode: string,
  subjectCode: string,
  paperCode: string,
  variantCode: string
): string {
  return `variant:${boardCode.toLowerCase()}:${subjectCode.toLowerCase()}:${paperCode.toLowerCase()}:${variantCode.toLowerCase()}`;
}

// ── Sitting IDs ────────────────────────────────────────────────────────────

export function sittingId(
  boardCode: string,
  subjectCode: string,
  paperCode: string,
  variantCode: string,
  series: string
): string {
  const sanitizedSeries = series.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return `sitting:${boardCode.toLowerCase()}:${subjectCode.toLowerCase()}:${paperCode.toLowerCase()}:${variantCode.toLowerCase()}:${sanitizedSeries}`;
}

// ── Boundary Set IDs ───────────────────────────────────────────────────────

export function boundarySetId(
  boardCode: string,
  subjectCode: string,
  unitCode: string,
  series: string,
  variantIndex: number = 0
): string {
  const sanitizedSeries = series.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const suffix = variantIndex > 0 ? `:v${variantIndex + 1}` : "";
  return `boundary:${boardCode.toLowerCase()}:${subjectCode.toLowerCase()}:${unitCode.toLowerCase()}:${sanitizedSeries}${suffix}`;
}

// ── Route IDs ──────────────────────────────────────────────────────────────

export function routeId(
  boardCode: string,
  level: string,
  subjectCode: string,
  routeName: string
): string {
  const sanitized = routeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `route:${boardCode.toLowerCase()}:${level.toLowerCase()}:${subjectCode.toLowerCase()}:${sanitized}`;
}

// ── Policy IDs ─────────────────────────────────────────────────────────────

export function gradingScaleId(name: string): string {
  return `scale:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function aggregationPolicyId(name: string): string {
  return `agg:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function gradePolicyId(name: string): string {
  return `grade:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function aStarPolicyId(name: string): string {
  return `astar:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function calculationPolicyId(name: string): string {
  return `policy:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

// ── Canonical series format ────────────────────────────────────────────────

/**
 * Convert raw series strings (e.g. "s-2024", "w-2025", "june-2025")
 * to canonical format "2024-june", "2025-november".
 */
export function canonicalSeries(session: string, year: string): string {
  const sessionMap: Record<string, string> = {
    s: "june",
    jun: "june",
    june: "june",
    "june a": "june",
    "june r": "june",
    m: "march",
    march: "march",
    w: "november",
    nov: "november",
    november: "november",
    jan: "january",
    january: "january",
    oct: "october",
    october: "october",
  };
  const canonicalSession = sessionMap[session.toLowerCase()] || session.toLowerCase();
  return `${year}-${canonicalSession}`;
}
