import { CourseContextEntrySchema, toCalculatorFeature, type CourseContextEntry, type CourseFeature } from "./types";
import { awardCatalog } from "@/domain-v2/awards/catalog";

export type CourseCatalogAudit = { ok: boolean; errors: string[]; entries: number };

export function auditCourseCatalog(catalog: CourseContextEntry[]): CourseCatalogAudit {
  const errors: string[] = [];
  const ids = new Set<string>();
  const features: CourseFeature[] = ["boundaries", "statistics", "papers", "syllabus", "calculator", "planner", "graph", "examOverview"];

  for (const [index, rawEntry] of catalog.entries()) {
    const parsed = CourseContextEntrySchema.safeParse(rawEntry);
    if (!parsed.success) {
      errors.push(`entry ${index}: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
      continue;
    }
    const entry = parsed.data;
    if (ids.has(entry.qualificationId)) errors.push(`duplicate qualificationId: ${entry.qualificationId}`);
    ids.add(entry.qualificationId);
    if (entry.subjectName.trim() === entry.subjectCode.trim()) {
      errors.push(`${entry.qualificationId}: subject name must not be a bare code`);
    }
    if (!entry.lifecycleEvidence.trim()) errors.push(`${entry.qualificationId}: lifecycle evidence is required`);
    if (entry.lifecycleStatus === "current" && (entry.lastObservedYear ?? 0) < 2024
      && entry.capabilities.examOverview.status === "unavailable"
      && !entry.lifecycleEvidence.includes("官方现行科目目录")) {
      errors.push(`${entry.qualificationId}: current lifecycle needs recent, official-list or approved-overview evidence`);
    }
    if (entry.lifecycleStatus === "historical" && (entry.lastObservedYear ?? 0) >= 2024) {
      errors.push(`${entry.qualificationId}: historical lifecycle conflicts with recent official data`);
    }
    if (entry.lifecycleStatus === "current" && entry.boardName === "AQA" && /\bAdv\b/i.test(entry.subjectName)) {
      errors.push(`${entry.qualificationId}: current AQA display name contains export suffix Adv`);
    }
    if (entry.specificationId && !entry.specificationId.includes(entry.subjectCode.toLowerCase().replace(/[^a-z0-9]+/g, "-"))) {
      errors.push(`specification does not match qualification: ${entry.qualificationId}`);
    }
    for (const feature of features) {
      const availability = entry.capabilities[feature];
      if (!availability) errors.push(`${entry.qualificationId}: missing ${feature}`);
      if (availability?.status === "unavailable" && !availability.reason) errors.push(`${entry.qualificationId}: unavailable ${feature} needs a reason`);
      if (availability?.status !== "unavailable" && !availability.href) errors.push(`${entry.qualificationId}: ${feature} needs an href`);
      if (availability?.status === "available" && availability.verificationStatus === "unverified") {
        errors.push(`${entry.qualificationId}: available ${feature} cannot be unverified`);
      }
    }
    if (entry.boardName === "WJEC/Eduqas" && Object.entries(entry.capabilities).some(
      ([feature, availability]) => feature !== "statistics" && availability.status !== "unavailable",
    )) {
      errors.push(`${entry.qualificationId}: WJEC/Eduqas may only expose statistics`);
    }
    if (entry.capabilities.calculator.status === "available" && entry.capabilities.calculator.verificationStatus !== "verified") {
      errors.push(`${entry.qualificationId}: calculator must be verified`);
    }
    const expectedCalculator = toCalculatorFeature(entry.gradeCalculation);
    const actualCalculator = entry.capabilities.calculator;
    if (actualCalculator.status !== expectedCalculator.status ||
      actualCalculator.verificationStatus !== expectedCalculator.verificationStatus ||
      actualCalculator.href !== expectedCalculator.href ||
      actualCalculator.reason !== expectedCalculator.reason) {
      errors.push(`${entry.qualificationId}: calculator capability does not match grade calculation`);
    }
    if (entry.gradeCalculation.status === "official") {
      if (entry.capabilities.calculator.status !== "available" || entry.capabilities.calculator.verificationStatus !== "verified") {
        errors.push(`${entry.qualificationId}: official calculator must be available and verified`);
      }
      for (const routeId of entry.gradeCalculation.routeIds) {
        if (routeId === "legacy:edexcel:ial:wma" && entry.boardName === "Edexcel" && entry.level === "A-Level" && entry.subjectCode === "WMA") continue;
        if (!awardCatalog.getAwardRoute(routeId)) errors.push(`${entry.qualificationId}: unknown official Award route ${routeId}`);
      }
    }
    if (entry.gradeCalculation.status === "estimated") {
      if (entry.capabilities.calculator.status !== "partial" || entry.capabilities.calculator.verificationStatus === "verified") {
        errors.push(`${entry.qualificationId}: estimated calculator must remain partial and unverified`);
      }
      const estimatedRouteIds = new Set(awardCatalog.estimatedBoundaries.map(boundary => boundary.routeId));
      for (const routeId of entry.gradeCalculation.routeIds) {
        if (!estimatedRouteIds.has(routeId)) errors.push(`${entry.qualificationId}: unknown estimated Award route ${routeId}`);
      }
    }
    if (entry.gradeCalculation.status === "unavailable" && entry.capabilities.calculator.status !== "unavailable") {
      errors.push(`${entry.qualificationId}: unavailable grade calculation must not expose a calculator action`);
    }
  }
  return { ok: errors.length === 0, errors, entries: catalog.length };
}
