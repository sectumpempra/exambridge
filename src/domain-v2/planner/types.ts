/**
 * Planner Core v2 — Types
 *
 * Deterministic scheduling engine. All date-only values use local calendar
 * semantics — never new Date("YYYY-MM-DD") UTC interpretation.
 */

import type { DomainWarning } from "@/domain-v2/shared";

// ── Input ──────────────────────────────────────────────────────────────────

export interface PastPaperRef {
  id: string;           // stable ID, e.g. "pp:yma01:p1:2024-june"
  paperId: string;      // canonical paper ID
  variantId?: string;   // canonical variant ID
  series: string;       // e.g. "2024-june"
  year: string;         // e.g. "2024"
}

export interface SittingRef {
  sittingId: string;    // canonical sitting ID
  qualificationId: string;
  paperId: string;
  variantId?: string;
  examDate: string;     // YYYY-MM-DD
  series: string;
}

export interface PlanRequest {
  startDate: string;              // YYYY-MM-DD, local calendar
  timezone: string;               // IANA, e.g. "Asia/Shanghai"
  sittings: SittingRef[];         // target sittings to prepare for
  restWeekdays: number[];         // 0=Sun...6=Sat
  intensity: "low" | "normal" | "high";
  maxTasksPerDay: number;         // hard cap, >= 1
  pastPaperPool: Record<string, PastPaperRef[]>; // key = paperId
  overrides?: Record<string, PastPaperRef[]>;    // key = paperId
  allowTasksOnExamDay?: boolean;  // default false
}

// ── Output ─────────────────────────────────────────────────────────────────

export interface PlannedDay {
  date: string;           // YYYY-MM-DD
  tasks: PlannedTask[];
}

export interface PlannedTask {
  paperId: string;
  sittingId: string;
  pastPaperId: string;
  date: string;
}

export interface PlannedWeek {
  weekNum: number;        // 1-based
  weekLabel: string;      // e.g. "Week 1 (Jan 6–12)"
  days: PlannedDay[];
}

export type UnscheduleReason =
  | "NO_AVAILABLE_DAY"
  | "DAILY_CAPACITY_EXHAUSTED"
  | "NO_PAST_PAPER_AVAILABLE"
  | "EXAM_ALREADY_PASSED"
  | "MISSING_EXAM_DATE"
  | "AMBIGUOUS_SITTING"
  | "INVALID_CONFIGURATION";

export interface UnscheduledRequirement {
  reason: UnscheduleReason;
  sittingId: string;
  paperId: string;
  qualificationId: string;
  detail: string;
}

export interface PlanExplanation {
  section: string;
  details: string[];
}

export interface PlanResult {
  status: "SUCCESS" | "PARTIAL" | "IMPOSSIBLE";
  days: PlannedDay[];
  weeks: PlannedWeek[];
  scheduledTaskCount: number;
  unscheduled: UnscheduledRequirement[];
  warnings: DomainWarning[];
  explanation: PlanExplanation[];
}
