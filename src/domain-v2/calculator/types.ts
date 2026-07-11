/**
 * Calculator Core v2 — Types (Phase 0 stub)
 *
 * 完整类型将在 Phase 2 (首个纵切片) 中实现。
 * 当前仅包含 facade 所需的最小定义。
 */

import type { DomainWarning, DomainError, SourceRef } from "@/domain-v2/shared";

export interface CalculatorPaperInput {
  unitId: string;
  paperVariantId?: string;
  series: string;
  rawScore: number;
  boundarySetId?: string;
}

export interface CalculateQualificationInput {
  qualificationId: string;
  routeId?: string;
  specificationId?: string;
  papers: CalculatorPaperInput[];
}

export type CalculationErrorCode =
  | "UNKNOWN_QUALIFICATION"
  | "UNSUPPORTED_QUALIFICATION"
  | "UNVERIFIED_RULE"
  | "UNKNOWN_UNIT"
  | "DUPLICATE_UNIT"
  | "SERIES_SPEC_MISMATCH"
  | "AMBIGUOUS_ROUTE"
  | "INVALID_ROUTE"
  | "INCOMPLETE_ROUTE"
  | "MISSING_BOUNDARY"
  | "AMBIGUOUS_BOUNDARY"
  | "SCORE_OUT_OF_RANGE";

export interface PaperCalculationResult {
  unitId: string;
  rawScore: number;
  maxMark: number;
  normalizedScore: number;
  normalizedMax: number;
  scoreType: "RAW" | "UMS" | "PUM" | "GNS";
  grade?: string;
}

export interface RouteValidationResult {
  valid: boolean;
  routeId?: string;
  missingUnits?: string[];
  extraUnits?: string[];
  explanation: string[];
}

export interface GradeCheck {
  grade: string;
  threshold: number;
  achieved: boolean;
  gap: number;
}

export interface AStarCheck {
  eligible: boolean;
  totalMet: boolean;
  a2Met: boolean;
  totalThreshold: number;
  a2Threshold: number;
  details: string[];
}

export interface CalculationResult {
  status: "SUCCESS" | "INCOMPLETE" | "INVALID" | "UNSUPPORTED";
  qualificationId: string;
  specificationId?: string;
  routeId?: string;
  predictedGrade: string | null;
  normalizedTotal?: number;
  normalizedMax?: number;
  percentage?: number;
  paperResults: PaperCalculationResult[];
  routeValidation: RouteValidationResult;
  gradeChecks: GradeCheck[];
  aStarCheck?: AStarCheck;
  nextGrade?: { grade: string; gap: number; scale: "RAW" | "UMS" | "PUM" | "GNS" };
  warnings: DomainWarning[];
  errors: DomainError[];
  explanation: string[];
  sources: SourceRef[];
}
