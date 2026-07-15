import { z } from "zod";
import {
  GradeCalculationAvailabilitySchema,
  type GradeCalculationAvailability,
} from "@/domain-v2/awards/schema";

export const CourseFeatureSchema = z.enum([
  "boundaries",
  "statistics",
  "papers",
  "syllabus",
  "calculator",
  "planner",
  "graph",
  "examOverview",
]);

export type CourseFeature = z.infer<typeof CourseFeatureSchema>;

export const SubjectCategorySchema = z.enum([
  "mathematics", "physics", "chemistry", "biology", "computer-science",
  "economics", "accounting", "humanities", "languages", "creative", "other",
]);

export type SubjectCategory = z.infer<typeof SubjectCategorySchema>;

export const CourseLifecycleStatusSchema = z.enum(["current", "historical"]);
export type CourseLifecycleStatus = z.infer<typeof CourseLifecycleStatusSchema>;

export const FeatureAvailabilitySchema = z.object({
  status: z.enum(["available", "partial", "unavailable"]),
  reason: z.string().optional(),
  href: z.string().optional(),
  verificationStatus: z.enum(["verified", "mixed", "unverified"]),
});

export type FeatureAvailability = z.infer<typeof FeatureAvailabilitySchema>;

export function toCalculatorFeature(value: GradeCalculationAvailability): FeatureAvailability {
  if (value.status === "official") {
    return { status: "available", verificationStatus: "verified", href: "/calculator" };
  }
  if (value.status === "estimated") {
    return {
      status: "partial",
      verificationStatus: "unverified",
      href: "/calculator",
      reason: "仅提供明确标注的非官方预估",
    };
  }
  return { status: "unavailable", verificationStatus: "unverified", reason: value.reason };
}

export const CourseContextSchema = z.object({
  qualificationId: z.string().min(1),
  specificationId: z.string().min(1).optional(),
});

export type CourseContext = z.infer<typeof CourseContextSchema>;

export const CourseContextEntrySchema = z.object({
  qualificationId: z.string().min(1),
  specificationId: z.string().min(1).optional(),
  specificationLabel: z.string().min(1).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  boardId: z.string().min(1),
  boardName: z.string().min(1),
  level: z.string().min(1),
  subjectCode: z.string().min(1),
  subjectName: z.string().min(1),
  subjectCategory: SubjectCategorySchema,
  lifecycleStatus: CourseLifecycleStatusSchema,
  lifecycleEvidence: z.string().min(1),
  lastObservedYear: z.number().int().optional(),
  label: z.string().min(1),
  sourceUrl: z.string().url(),
  accessedAt: z.string(),
  knowledgeTreeCode: z.string().optional(),
  calculatorBoardKey: z.string().optional(),
  plannerLevel: z.string().optional(),
  plannerBoard: z.string().optional(),
  gradeCalculation: GradeCalculationAvailabilitySchema,
  capabilities: z.record(CourseFeatureSchema, FeatureAvailabilitySchema),
});

export type CourseContextEntry = z.infer<typeof CourseContextEntrySchema>;

export const StoredCourseContextSchema = z.object({
  version: z.literal(1),
  current: CourseContextSchema,
  recent: z.array(CourseContextSchema).max(5),
});

export type StoredCourseContext = z.infer<typeof StoredCourseContextSchema>;
