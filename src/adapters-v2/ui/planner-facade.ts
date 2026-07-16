/**
 * Planner Facade v2
 *
 * Entry point for the Planner page. Converts legacy ExamEvent inputs
 * to PlanRequest, then delegates to v2 engine or legacy.
 */

import { getFeatureFlags, isV2Planner } from "@/domain-v2/shared";
import { planSchedule as v2PlanSchedule } from "@/domain-v2/planner/engine";
import type {
  PlanRequest,
  PlanResult,
  SittingRef,
  PastPaperRef,
} from "@/domain-v2/planner/types";

// ── Legacy adapter types ──

export interface LegacyExamEvent {
  subjectCode: string;
  paperLabel: string;
  paperName: string;
  examDate: string;
  variants: { code: string; component: string }[];
}

export interface PlannerFacadeInput {
  startDate: string;
  timezone: string;
  events: LegacyExamEvent[];
  restWeekdays: number[];
  intensity: "low" | "normal" | "high";
  maxTasksPerDay: number;
  // Optional: pre-built past paper pool (if not provided, facade builds a minimal one)
  pastPaperPool?: Record<string, PastPaperRef[]>;
}

export interface PlannerFacadeOutput {
  result: PlanResult | null;
  v2Result?: PlanResult | null;
}

/**
 * Convert legacy ExamEvents to PlanRequest.
 *
 * Each ExamEvent becomes a SittingRef. Past papers must come from the
 * audited catalog; the facade never invents historical sittings.
 */
function buildPlanRequest(input: PlannerFacadeInput): PlanRequest {
  const sittings: SittingRef[] = input.events.map((e, idx) => {
    // Derive qualificationId from subjectCode
    // Legacy uses "CAIE-9709" format; convert to canonical
    const parts = e.subjectCode.split("-");
    const board = parts[0]?.toLowerCase() ?? "unknown";
    const subjectCode = parts[1] ?? "unknown";
    const qualId = `qual:${board}:al:${subjectCode}`;
    const paperId = `paper:${board}:${subjectCode}:${e.paperLabel.toLowerCase().replace(/\s+/g, "-")}`;

    return {
      sittingId: `sitting:${board}:${subjectCode}:${e.paperLabel}:${e.examDate}:${idx}`,
      qualificationId: qualId,
      paperId,
      examDate: e.examDate,
      series: `${e.examDate.substring(0, 4)}-june`,
    };
  });

  const pool = input.pastPaperPool ?? {};

  return {
    startDate: input.startDate,
    timezone: input.timezone,
    sittings,
    restWeekdays: input.restWeekdays,
    intensity: input.intensity,
    maxTasksPerDay: input.maxTasksPerDay,
    pastPaperPool: pool,
  };
}

/**
 * Plan schedule from legacy-format inputs.
 *
 * - v2 mode: uses v2 engine
 * - legacy mode: returns null (page uses old implementation)
 */
export function planSchedule(input: PlannerFacadeInput): PlannerFacadeOutput {
  const flags = getFeatureFlags();

  if (isV2Planner(flags)) {
    const request = buildPlanRequest(input);
    const result = v2PlanSchedule(request);
    return { result, v2Result: result };
  }

  // Legacy mode
  return { result: null, v2Result: null };
}

// Re-export for direct use
export { getFeatureFlags } from "@/domain-v2/shared";
export type { PlanRequest, PlanResult, PastPaperRef, SittingRef };
